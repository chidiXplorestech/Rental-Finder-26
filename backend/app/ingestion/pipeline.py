import json
import re
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .base import FeedListing
from ..models import FloorAreaSource, Listing, ListingEvent, ListingStatus, Property
from ..services.dedupe import canonical_property_key
from ..services.rules import classify_student_restrictions


def postcode_district(postcode: str) -> str:
    cleaned = postcode.strip().upper()
    match = re.match(r"^([A-Z]{1,2}\d{1,2})", cleaned)
    return match.group(1) if match else cleaned.split(" ")[0]


async def upsert_feed_listing(session: AsyncSession, item: FeedListing) -> str:
    now = datetime.now(timezone.utc)
    existing = await session.scalar(
        select(Listing).where(Listing.source == item.source, Listing.source_listing_id == item.source_listing_id)
    )

    is_pbsa, is_student_only, is_academic = classify_student_restrictions(item.title, item.description)
    canonical_key = canonical_property_key(item.address_line, item.postcode, item.bedrooms)
    property_row = await session.scalar(select(Property).where(Property.canonical_key == canonical_key))
    if not property_row:
        property_row = Property(
            canonical_key=canonical_key,
            address_line=item.address_line,
            postcode=item.postcode.upper(),
            postcode_district=postcode_district(item.postcode),
            latitude=item.latitude,
            longitude=item.longitude,
            bedrooms=item.bedrooms,
            floor_area_sqft=item.floor_area_sqft,
            floor_area_source=FloorAreaSource.LISTING if item.floor_area_sqft else FloorAreaSource.UNKNOWN,
        )
        session.add(property_row)
        await session.flush()
    elif item.floor_area_sqft and not property_row.floor_area_sqft:
        property_row.floor_area_sqft = item.floor_area_sqft
        property_row.floor_area_source = FloorAreaSource.LISTING

    if existing:
        existing.title = item.title
        existing.description = item.description
        existing.rent_pcm = item.rent_pcm
        existing.last_seen_at = now
        existing.status = ListingStatus.ACTIVE
        existing.archived_at = None
        existing.is_pbsa = is_pbsa
        existing.is_student_only = is_student_only
        existing.is_academic_tenancy = is_academic
        existing.raw_payload = json.dumps(item.raw)
        event = "updated"
    else:
        existing = Listing(
            property_id=property_row.id,
            source=item.source,
            source_listing_id=item.source_listing_id,
            source_url=item.source_url,
            title=item.title,
            description=item.description,
            rent_pcm=item.rent_pcm,
            status=ListingStatus.ACTIVE,
            is_pbsa=is_pbsa,
            is_student_only=is_student_only,
            is_academic_tenancy=is_academic,
            status_selector=item.status_selector,
            status_selector_means=item.status_selector_means,
            raw_payload=json.dumps(item.raw),
        )
        session.add(existing)
        await session.flush()
        event = "created"

    session.add(ListingEvent(listing_id=existing.id, event_type=event, detail=item.source))
    await session.commit()
    return event
