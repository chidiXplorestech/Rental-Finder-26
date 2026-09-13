import asyncio
from datetime import datetime, timezone
from sqlalchemy import select, text
from .config import get_settings
from .db import SessionLocal, engine
from .ingestion.json_feed import JsonFeedAdapter
from .ingestion.pipeline import upsert_feed_listing
from .models import Base, Listing, ListingEvent, ListingStatus
from .services.freshness import check_listing_url
from .services.discovery import discover_live_listings, host_matches
from .ingestion.web_search import SearchProviderNotConfigured

settings = get_settings()
ADVISORY_LOCK_ID = 612_002_009


async def ingest_permitted_feeds():
    for url in settings.feed_urls:
        adapter = JsonFeedAdapter(url)
        items = await adapter.fetch()
        async with SessionLocal() as session:
            for item in items:
                await upsert_feed_listing(session, item)


async def discover_web():
    if not settings.brave_search_api_key:
        return
    try:
        stats = await discover_live_listings()
        print(f"web_discovery: {stats}", flush=True)
    except SearchProviderNotConfigured:
        return


async def verify_active_listings():
    async with SessionLocal() as session:
        rows = list((await session.scalars(select(Listing).where(Listing.archived_at.is_(None)))).all())
        for listing in rows:
            if not settings.direct_verify_domains or not host_matches(listing.source_url, settings.direct_verify_domains):
                continue
            result = await check_listing_url(
                listing.source_url,
                status_selector=listing.status_selector,
                status_selector_means=listing.status_selector_means,
            )
            listing.last_checked_at = result.checked_at
            if result.archive:
                listing.status = result.status
                listing.archived_at = datetime.now(timezone.utc)
                session.add(ListingEvent(listing_id=listing.id, event_type="archived", detail=result.reason))
            elif result.status == ListingStatus.ACTIVE:
                listing.status = ListingStatus.ACTIVE
            else:
                listing.status = ListingStatus.UNKNOWN
            await session.commit()


async def _cycle():
    await ingest_permitted_feeds()
    await discover_web()
    await verify_active_listings()


async def run_once():
    if settings.database_url.startswith("sqlite"):
        await _cycle()
        return

    async with SessionLocal() as lock_session:
        acquired = await lock_session.scalar(text(f"SELECT pg_try_advisory_lock({ADVISORY_LOCK_ID})"))
        if not acquired:
            return
        try:
            await _cycle()
        finally:
            await lock_session.execute(text(f"SELECT pg_advisory_unlock({ADVISORY_LOCK_ID})"))
            await lock_session.commit()


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    while True:
        try:
            await run_once()
        except Exception as exc:
            print(f"worker_cycle_error: {exc}", flush=True)
        await asyncio.sleep(max(600, min(settings.poll_interval_seconds, 900)))


if __name__ == "__main__":
    asyncio.run(main())
