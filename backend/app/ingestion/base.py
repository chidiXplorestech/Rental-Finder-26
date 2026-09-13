from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class FeedListing:
    source: str
    source_listing_id: str
    source_url: str
    title: str
    description: str
    address_line: str
    postcode: str
    bedrooms: int
    rent_pcm: int
    floor_area_sqft: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    status_selector: str | None = None
    status_selector_means: str | None = None
    raw: dict = field(default_factory=dict)


class FeedAdapter(ABC):
    @abstractmethod
    async def fetch(self) -> list[FeedListing]:
        raise NotImplementedError
