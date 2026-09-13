from app.ingestion.web_listing import search_document_to_listing
from app.ingestion.web_search import SearchDocument


def doc(text: str) -> SearchDocument:
    return SearchDocument(url="https://example-agent.co.uk/listing/123", title="2 bedroom flat to rent in NG7", snippets=[text])


def test_extracts_strict_listing():
    item = search_document_to_listing(doc("£950 pcm. 2 bedrooms. Total floor area 68 m2. Nottingham NG7 1AA."))
    assert item is not None
    assert item.rent_pcm == 950
    assert item.bedrooms == 2
    assert item.floor_area_sqft >= 600
    assert item.postcode == "NG7 1AA"


def test_rejects_student_only():
    assert search_document_to_listing(doc("£900 pcm, 2 bedrooms, 720 sq ft, NG7 1AA. Students only.")) is None


def test_rejects_over_budget():
    assert search_document_to_listing(doc("£1,100 pcm, 2 bedrooms, 720 sq ft, NG7 1AA.")) is None


def test_rejects_unknown_floor_area():
    assert search_document_to_listing(doc("£900 pcm, 2 bedrooms, NG7 1AA.")) is None


def test_rejects_student_house_even_if_professionals_considered():
    assert search_document_to_listing(doc("£995 pcm, 2 bedrooms, 862 sq ft, NG1 2AB. Student house. Students and professionals considered.")) is None


def test_rejects_let_agreed_search_result():
    assert search_document_to_listing(doc("£950 pcm, 2 bedrooms, 624 sq ft, NG2 1AA. Let agreed. Long term let.")) is None


def test_rejects_aggregate_page_with_multiple_pcm_values():
    assert search_document_to_listing(doc("£900 pcm 2 beds 700 sq ft NG5. Another property £895 pcm 2 beds 650 sq ft NG5.")) is None
