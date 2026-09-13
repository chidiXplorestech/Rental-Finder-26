import asyncio
import json
from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .config import get_settings
from .db import engine, get_session, SessionLocal
from .models import Base, ListingEvent
from .schemas import DiscoveryResponse, ListingOut, SearchResponse
from .services.search import freshness_minutes, search_listings
from .services.discovery import discover_live_listings
from .ingestion.web_search import SearchProviderNotConfigured

settings = get_settings()
app = FastAPI(title="Notts Rental Tracker API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "web_search_enabled": bool(settings.brave_search_api_key),
        "direct_verify_domains": settings.direct_verify_domains,
    }


@app.post("/api/v1/discovery/run", response_model=DiscoveryResponse)
async def run_discovery():
    if not settings.brave_search_api_key:
        return DiscoveryResponse(enabled=False, message="Set BRAVE_SEARCH_API_KEY to enable live internet discovery.")
    try:
        stats = await discover_live_listings()
    except SearchProviderNotConfigured as exc:
        return DiscoveryResponse(enabled=False, message=str(exc))
    return DiscoveryResponse(enabled=True, message="Live web discovery completed.", **stats.__dict__)


@app.get("/api/v1/listings", response_model=SearchResponse)
async def listings(
    max_rent: int = Query(1000, ge=1),
    min_sqft: float = Query(600, ge=0),
    max_commute: int | None = Query(None, ge=1, le=180),
    postcode: list[str] | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    rows = await search_listings(session, max_rent, min_sqft, max_commute, postcode)
    items = [
        ListingOut(
            id=row.id,
            title=row.title,
            rent_pcm=row.rent_pcm,
            source=row.source,
            source_url=row.source_url,
            postcode=row.property.postcode,
            postcode_district=row.property.postcode_district,
            bedrooms=row.property.bedrooms,
            floor_area_sqft=row.property.floor_area_sqft or 0,
            floor_area_source=row.property.floor_area_source.value,
            commute_minutes=row.property.commute_minutes,
            last_checked_at=row.last_checked_at,
            freshness_minutes=freshness_minutes(row.last_checked_at or row.last_seen_at),
            verification_method=("direct_http" if row.last_checked_at else "search_index"),
        )
        for row in rows
    ]
    return SearchResponse(count=len(items), items=items)


@app.get("/api/v1/events")
async def events(after_id: int = 0):
    async def stream():
        cursor = after_id
        while True:
            async with SessionLocal() as session:
                rows = (
                    await session.scalars(
                        select(ListingEvent).where(ListingEvent.id > cursor).order_by(ListingEvent.id.asc()).limit(100)
                    )
                ).all()
                for row in rows:
                    cursor = row.id
                    payload = {"id": row.id, "listing_id": str(row.listing_id), "type": row.event_type}
                    yield f"id: {row.id}\nevent: listing\ndata: {json.dumps(payload)}\n\n"
            yield ": keepalive\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(stream(), media_type="text/event-stream")
