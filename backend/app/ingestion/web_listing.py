import hashlib
import re
from urllib.parse import urlparse

from .base import FeedListing
from .web_search import SearchDocument
from ..services.rules import classify_student_restrictions

POSTCODE_RE = re.compile(r"\b(GIR\s?0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)\s?[0-9][ABD-HJLNP-UW-Z]{2})\b", re.I)
DISTRICT_RE = re.compile(r"\b(NG(?:1|2|3|5|7|9))\b", re.I)
BEDROOM_RE = re.compile(r"\b(\d+)\s*(?:bed(?:room)?s?)\b", re.I)
PCM_PATTERNS = [
    re.compile(r"£\s*([0-9]{3,4}(?:,[0-9]{3})?)\s*(?:pcm|per\s+calendar\s+month|per\s+month|/\s*month|pm)\b", re.I),
    re.compile(r"(?:rent|price)\s*[:\-]?\s*£\s*([0-9]{3,4}(?:,[0-9]{3})?)\b", re.I),
]
SQFT_PATTERNS = [
    re.compile(r"\b([6-9][0-9]{2}|1[0-9]{3}|2[0-9]{3})\s*(?:sq\.?\s*ft|sqft|square\s+feet)\b", re.I),
]
SQM_RE = re.compile(r"\b([5-9][0-9]|1[0-9]{2})\s*(?:m²|m2|sq\.?\s*m|square\s+metres?)\b", re.I)
STALE_RE = re.compile(
    r"\b(let agreed|now let|no longer on the market|no longer available|property has been removed|listing expired)\b",
    re.I,
)


def _source_name(url: str) -> str:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return host or "web"


def _source_id(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]


def _parse_pcm(text: str) -> int | None:
    values: list[int] = []
    for pattern in PCM_PATTERNS:
        for value in pattern.findall(text):
            try:
                values.append(int(value.replace(",", "")))
            except ValueError:
                pass
    unique = {v for v in values if 400 <= v <= 5000}
    return next(iter(unique)) if len(unique) == 1 else None


def _parse_bedrooms(text: str) -> int | None:
    values = [int(v) for v in BEDROOM_RE.findall(text)]
    unique = set(values)
    return next(iter(unique)) if len(unique) == 1 else None


def _parse_floor_area(text: str) -> float | None:
    sqft: list[float] = []
    for pattern in SQFT_PATTERNS:
        sqft.extend(float(v) for v in pattern.findall(text))
    for sqm in SQM_RE.findall(text):
        sqft.append(round(float(sqm) * 10.7639, 1))
    plausible = [v for v in sqft if 350 <= v <= 3000]
    if not plausible:
        return None
    anchor = plausible[0]
    if any(abs(v - anchor) > 8 for v in plausible[1:]):
        return None
    return round(sum(plausible) / len(plausible), 1)


def _parse_postcode(text: str) -> str | None:
    match = POSTCODE_RE.search(text)
    if match:
        raw = re.sub(r"\s+", "", match.group(1).upper())
        return f"{raw[:-3]} {raw[-3:]}"
    district = DISTRICT_RE.search(text)
    return district.group(1).upper() if district else None


def search_document_to_listing(doc: SearchDocument) -> FeedListing | None:
    text = " ".join(doc.text.split())
    rent = _parse_pcm(text)
    bedrooms = _parse_bedrooms(text)
    floor_area = _parse_floor_area(text)
    postcode = _parse_postcode(text)
    is_pbsa, is_student_only, is_academic = classify_student_restrictions(doc.title, text)

    if rent is None or rent > 1000:
        return None
    if bedrooms != 2:
        return None
    if floor_area is None or floor_area < 600:
        return None
    if postcode is None or not postcode.upper().startswith("NG"):
        return None
    if is_pbsa or is_student_only or is_academic or STALE_RE.search(text):
        return None

    return FeedListing(
        source=_source_name(doc.url),
        source_listing_id=_source_id(doc.url),
        source_url=doc.url,
        title=doc.title[:300],
        description=text[:12000],
        address_line=doc.title[:300],
        postcode=postcode,
        bedrooms=2,
        rent_pcm=rent,
        floor_area_sqft=floor_area,
        raw={"discovered_via": "brave_llm_context", "document": doc.raw},
    )
