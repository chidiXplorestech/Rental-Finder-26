import asyncio
from datetime import datetime, timezone
from .db import SessionLocal, engine
from .models import Base, FloorAreaSource, Listing, Property
from .services.dedupe import canonical_property_key

SEED = [
    {"address":"12 Demo Street, Nottingham","postcode":"NG1 2AB","rent":995,"sqft":685,"commute":8,"title":"Spacious two-bedroom city apartment"},
    {"address":"7 Example Road, West Bridgford","postcode":"NG2 6XY","rent":975,"sqft":720,"commute":18,"title":"Two-bedroom flat with separate kitchen"},
    {"address":"4 Sample Avenue, Carrington","postcode":"NG5 2ZZ","rent":925,"sqft":640,"commute":21,"title":"Large two-bedroom professional let"},
    {"address":"99 Fiction Lane, Beeston","postcode":"NG9 2AA","rent":950,"sqft":760,"commute":27,"title":"Two-bedroom home near tram corridor"},
]


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        for i, row in enumerate(SEED, start=1):
            prop = Property(
                canonical_key=canonical_property_key(row["address"], row["postcode"], 2),
                address_line=row["address"],
                postcode=row["postcode"],
                postcode_district=row["postcode"].split()[0],
                bedrooms=2,
                floor_area_sqft=row["sqft"],
                floor_area_source=FloorAreaSource.MANUAL,
                commute_minutes=row["commute"],
                commute_mode="public_transport_demo",
                commute_checked_at=datetime.now(timezone.utc),
            )
            session.add(prop)
            await session.flush()
            session.add(Listing(
                property_id=prop.id,
                source="demo",
                source_listing_id=f"demo-{i}",
                source_url="https://example.com/",
                title=row["title"],
                description="Fictional seed listing for local UI development only.",
                rent_pcm=row["rent"],
                last_checked_at=datetime.now(timezone.utc),
            ))
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
