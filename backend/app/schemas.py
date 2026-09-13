from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    rent_pcm: int
    source: str
    source_url: str
    postcode: str
    postcode_district: str
    bedrooms: int
    floor_area_sqft: float
    floor_area_source: str
    commute_minutes: int | None
    last_checked_at: datetime | None
    freshness_minutes: int | None
    verification_method: str


class SearchResponse(BaseModel):
    count: int
    items: list[ListingOut]


class DiscoveryResponse(BaseModel):
    enabled: bool
    message: str
    queries: int = 0
    documents: int = 0
    strict_candidates: int = 0
    created: int = 0
    updated: int = 0
    archived_by_search: int = 0
