from datetime import datetime, timezone
from sqlalchemy import case, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from ..models import Listing, ListingStatus, Property
from .rules import PRIORITY_POSTCODE_DISTRICTS


async def search_listings(
    session: AsyncSession,
    max_rent: int = 1000,
    min_sqft: float = 600,
    max_commute: int | None = 40,
    postcode_districts: list[str] | None = None,
    limit: int = 100,
):
    max_rent = min(max_rent, 1000)
    min_sqft = max(min_sqft, 600)

    priority_case = case(
        *[(Property.postcode_district == district, score) for district, score in PRIORITY_POSTCODE_DISTRICTS.items()],
        else_=50,
    )

    stmt = (
        select(Listing)
        .join(Listing.property)
        .options(joinedload(Listing.property))
        .where(
            Listing.status == ListingStatus.ACTIVE,
            Listing.archived_at.is_(None),
            Listing.rent_pcm <= max_rent,
            Listing.is_pbsa.is_(False),
            Listing.is_student_only.is_(False),
            Listing.is_academic_tenancy.is_(False),
            Property.bedrooms == 2,
            Property.floor_area_sqft.is_not(None),
            Property.floor_area_sqft >= min_sqft,
        )
    )

    if postcode_districts:
        stmt = stmt.where(Property.postcode_district.in_([p.upper() for p in postcode_districts]))
    if max_commute is not None:
        stmt = stmt.where(Property.commute_minutes.is_not(None), Property.commute_minutes <= max_commute)

    stmt = stmt.order_by(desc(priority_case), Property.commute_minutes.asc().nullslast(), Listing.rent_pcm.asc()).limit(limit)
    return list((await session.scalars(stmt)).all())


def freshness_minutes(last_checked_at):
    if not last_checked_at:
        return None
    if last_checked_at.tzinfo is None:
        last_checked_at = last_checked_at.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - last_checked_at).total_seconds() // 60))
