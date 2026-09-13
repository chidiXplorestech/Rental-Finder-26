from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import select

from ..config import get_settings
from ..db import SessionLocal
from ..ingestion.pipeline import upsert_feed_listing
from ..ingestion.web_listing import search_document_to_listing
from ..ingestion.web_search import BraveLlmContextSearch, SearchProviderNotConfigured
from ..models import Listing, ListingEvent, ListingStatus

settings = get_settings()
DISTRICTS = ("NG1", "NG2", "NG3", "NG5", "NG7", "NG9")


@dataclass
class DiscoveryStats:
    queries: int = 0
    documents: int = 0
    strict_candidates: int = 0
    created: int = 0
    updated: int = 0
    archived_by_search: int = 0


def build_queries() -> list[str]:
    return [
        f'"2 bedroom" rent {district} Nottingham "sq ft" -"students only" -"student accommodation"'
        for district in DISTRICTS
    ]


def _host(url: str) -> str:
    return urlparse(url).netloc.lower().split(":", 1)[0].removeprefix("www.")


def host_matches(url: str, domains: list[str]) -> bool:
    host = _host(url)
    return any(host == d or host.endswith(f".{d}") for d in domains)


async def discover_live_listings() -> DiscoveryStats:
    provider = BraveLlmContextSearch(settings.brave_search_api_key)
    if not provider.configured:
        raise SearchProviderNotConfigured("BRAVE_SEARCH_API_KEY is not configured")

    stats = DiscoveryStats()
    seen_urls: set[str] = set()
    for query in build_queries():
        stats.queries += 1
        documents = await provider.search(query, maximum_urls=settings.search_results_per_query)
        stats.documents += len(documents)
        async with SessionLocal() as session:
            for doc in documents:
                item = search_document_to_listing(doc)
                if item is None:
                    continue
                stats.strict_candidates += 1
                seen_urls.add(item.source_url)
                event = await upsert_feed_listing(session, item)
                if event == "created":
                    stats.created += 1
                else:
                    stats.updated += 1

    cutoff = datetime.now(timezone.utc).timestamp() - settings.search_stale_after_seconds
    async with SessionLocal() as session:
        rows = list((await session.scalars(select(Listing).where(Listing.archived_at.is_(None)))).all())
        for listing in rows:
            if listing.source_url in seen_urls:
                continue
            if listing.last_seen_at and listing.last_seen_at.timestamp() < cutoff:
                listing.status = ListingStatus.EXPIRED
                listing.archived_at = datetime.now(timezone.utc)
                session.add(ListingEvent(listing_id=listing.id, event_type="archived", detail="search_index_stale"))
                stats.archived_by_search += 1
        await session.commit()

    return stats
