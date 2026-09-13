import httpx
from .base import FeedAdapter, FeedListing


class JsonFeedAdapter(FeedAdapter):
    """Generic adapter for a JSON feed you own or are explicitly permitted to consume."""

    def __init__(self, url: str):
        self.url = url

    async def fetch(self) -> list[FeedListing]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(self.url)
            response.raise_for_status()
            payload = response.json()

        rows = payload if isinstance(payload, list) else payload.get("listings", [])
        return [
            FeedListing(
                source=str(row["source"]),
                source_listing_id=str(row["id"]),
                source_url=str(row["url"]),
                title=str(row.get("title", "2 bedroom rental")),
                description=str(row.get("description", "")),
                address_line=str(row["address"]),
                postcode=str(row["postcode"]),
                bedrooms=int(row["bedrooms"]),
                rent_pcm=int(row["rent_pcm"]),
                floor_area_sqft=float(row["floor_area_sqft"]) if row.get("floor_area_sqft") else None,
                latitude=float(row["latitude"]) if row.get("latitude") else None,
                longitude=float(row["longitude"]) if row.get("longitude") else None,
                status_selector=row.get("status_selector"),
                status_selector_means=row.get("status_selector_means"),
                raw=row,
            )
            for row in rows
        ]
