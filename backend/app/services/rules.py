import re

STUDENT_ONLY_PATTERNS = [
    r"\bstudents?\s+only\b",
    r"\bstudent\s+property\b",
    r"\bstudent\s+house\b",
    r"\bstudent\s+hmo\b",
    r"\bstudent\s+accommodation\b",
    r"\bpurpose[- ]built student accommodation\b",
    r"\bpbsa\b",
]

ACADEMIC_TENANCY_PATTERNS = [
    r"\bacademic\s+year\b",
    r"\bterm[- ]time\b",
    r"\bseptember\s+to\s+(june|july|august)\b",
    r"\b(44|48|50|51)\s+week\s+tenancy\b",
]

PBSA_PATTERNS = [
    r"\bpbsa\b",
    r"\bpurpose[- ]built student accommodation\b",
    r"\bstudent\s+residence\b",
]

PRIORITY_POSTCODE_DISTRICTS = {
    "NG1": 100,
    "NG2": 95,
    "NG3": 90,
    "NG7": 90,
    "NG5": 85,
    "NG9": 85,
}


def classify_student_restrictions(title: str, description: str) -> tuple[bool, bool, bool]:
    text = f"{title} {description}".lower()
    is_student_only = any(re.search(p, text, re.I) for p in STUDENT_ONLY_PATTERNS)
    is_academic = any(re.search(p, text, re.I) for p in ACADEMIC_TENANCY_PATTERNS)
    is_pbsa = any(re.search(p, text, re.I) for p in PBSA_PATTERNS)
    return is_pbsa, is_student_only, is_academic


def location_priority(postcode_district: str) -> int:
    return PRIORITY_POSTCODE_DISTRICTS.get(postcode_district.upper(), 50)
