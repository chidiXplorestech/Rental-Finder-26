from dataclasses import dataclass
from datetime import datetime, timezone
import re
import httpx
from bs4 import BeautifulSoup
from ..models import ListingStatus

STALE_TEXT = {
    ListingStatus.LET_AGREED: [r"\blet agreed\b", r"\bnow let\b"],
    ListingStatus.REMOVED: [r"\bproperty (?:has been )?removed\b", r"\blisting (?:is )?no longer available\b"],
    ListingStatus.EXPIRED: [r"\badvert(?:isement)? expired\b", r"\bthis listing has expired\b"],
}


@dataclass
class FreshnessResult:
    status: ListingStatus
    archive: bool
    reason: str
    checked_at: datetime


def _status_from_text(text: str) -> ListingStatus | None:
    normalized = " ".join(text.lower().split())
    for status, patterns in STALE_TEXT.items():
        if any(re.search(pattern, normalized, re.I) for pattern in patterns):
            return status
    return None


async def check_listing_url(
    url: str,
    status_selector: str | None = None,
    status_selector_means: str | None = None,
) -> FreshnessResult:
    checked_at = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
            headers={"User-Agent": "NottsRentalTracker/0.1 (+availability-check; permitted-sources-only)"},
        ) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        return FreshnessResult(ListingStatus.UNKNOWN, False, f"network_error:{type(exc).__name__}", checked_at)

    if response.status_code in {404, 410}:
        return FreshnessResult(ListingStatus.REMOVED, True, f"http_{response.status_code}", checked_at)

    if response.status_code in {401, 403, 429} or response.status_code >= 500:
        return FreshnessResult(ListingStatus.UNKNOWN, False, f"http_{response.status_code}", checked_at)

    soup = BeautifulSoup(response.text, "html.parser")
    if status_selector:
        node = soup.select_one(status_selector)
        if node:
            mapped = {
                "let_agreed": ListingStatus.LET_AGREED,
                "removed": ListingStatus.REMOVED,
                "expired": ListingStatus.EXPIRED,
            }.get((status_selector_means or "").lower())
            if mapped:
                return FreshnessResult(mapped, True, f"selector:{status_selector}", checked_at)

    status = _status_from_text(soup.get_text(" ", strip=True))
    if status:
        return FreshnessResult(status, True, "explicit_stale_text", checked_at)

    if 200 <= response.status_code < 400:
        return FreshnessResult(ListingStatus.ACTIVE, False, f"http_{response.status_code}", checked_at)

    return FreshnessResult(ListingStatus.UNKNOWN, False, f"http_{response.status_code}", checked_at)
