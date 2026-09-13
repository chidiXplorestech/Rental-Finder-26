import hashlib
import re


def normalize_address(value: str) -> str:
    value = value.upper().strip()
    value = re.sub(r"[^A-Z0-9 ]+", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def canonical_property_key(address_line: str, postcode: str, bedrooms: int) -> str:
    raw = f"{normalize_address(address_line)}|{postcode.replace(' ', '').upper()}|{bedrooms}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
