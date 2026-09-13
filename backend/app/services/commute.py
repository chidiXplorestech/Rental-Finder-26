from datetime import datetime, timezone
import httpx
from .rules import location_priority
from ..config import get_settings

settings = get_settings()


async def public_transport_minutes(lat: float, lng: float) -> int | None:
    if not settings.traveltime_app_id or not settings.traveltime_api_key:
        return None

    payload = {
        "locations": [
            {"id": "home", "coords": {"lat": lat, "lng": lng}},
            {"id": "centre", "coords": {"lat": settings.city_centre_lat, "lng": settings.city_centre_lng}},
        ],
        "arrival_searches": [
            {
                "id": "to-centre",
                "arrival_location_id": "centre",
                "transportation": {"type": "public_transport"},
                "arrival_time": datetime.now(timezone.utc).replace(hour=8, minute=45, second=0, microsecond=0).isoformat(),
                "properties": ["travel_time"],
                "range": {"enabled": True, "width": 3600, "max_results": 1},
            }
        ],
    }
    headers = {
        "X-Application-Id": settings.traveltime_app_id,
        "X-Api-Key": settings.traveltime_api_key,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post("https://api.traveltimeapp.com/v4/time-filter", json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
    try:
        seconds = data["results"][0]["locations"][0]["properties"][0]["travel_time"]
        return round(seconds / 60)
    except (KeyError, IndexError, TypeError):
        return None


def fallback_commute_score(postcode_district: str) -> int:
    return location_priority(postcode_district)
