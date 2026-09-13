from app.services.rules import classify_student_restrictions
from app.services.dedupe import canonical_property_key


def test_students_only_is_excluded():
    pbsa, student, academic = classify_student_restrictions("2 bed flat", "Students only - academic year tenancy")
    assert student is True
    assert academic is True
    assert pbsa is False


def test_pbsa_is_detected():
    pbsa, student, academic = classify_student_restrictions("Student residence", "Purpose-built student accommodation")
    assert pbsa is True


def test_canonical_key_is_stable():
    assert canonical_property_key("12 Demo St.", "NG1 2AB", 2) == canonical_property_key("12 demo st", "ng12ab", 2)
