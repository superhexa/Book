"""Jordan localization: constants and helpers.

Single source of truth for Jordan-specific platform settings:
- 12 governorates (keys + Arabic/English names)
- +962 phone normalization for Jordanian mobile numbers
- JOD currency formatting
- Asia/Amman timezone helpers

Phone rules (Jordanian mobiles are 9 national digits starting with
77 / 78 / 79 — Zain 79x, Orange 77x, Umniah 78x):
  accepted: 07XXXXXXXX, 9627XXXXXXXX, +9627XXXXXXXX, 009627XXXXXXXX
  output:   +9627XXXXXXXX
Anything else -> None (invalid).
"""
import re
from datetime import datetime
from zoneinfo import ZoneInfo

COUNTRY = "JO"
TIMEZONE = "Asia/Amman"
CURRENCY = "JOD"
CURRENCY_SYMBOL = "د.أ"
DEFAULT_LOCALE = "ar-JO"

AMMAN_TZ = ZoneInfo(TIMEZONE)

GOVERNORATES = [
    {"key": "amman", "name_ar": "عمّان", "name_en": "Amman"},
    {"key": "irbid", "name_ar": "إربد", "name_en": "Irbid"},
    {"key": "zarqa", "name_ar": "الزرقاء", "name_en": "Zarqa"},
    {"key": "balqa", "name_ar": "البلقاء", "name_en": "Balqa"},
    {"key": "mafraq", "name_ar": "المفرق", "name_en": "Mafraq"},
    {"key": "jerash", "name_ar": "جرش", "name_en": "Jerash"},
    {"key": "ajloun", "name_ar": "عجلون", "name_en": "Ajloun"},
    {"key": "madaba", "name_ar": "مادبا", "name_en": "Madaba"},
    {"key": "karak", "name_ar": "الكرك", "name_en": "Karak"},
    {"key": "tafilah", "name_ar": "الطفيلة", "name_en": "Tafilah"},
    {"key": "maan", "name_ar": "معان", "name_en": "Ma'an"},
    {"key": "aqaba", "name_ar": "العقبة", "name_en": "Aqaba"},
]

_GOVERNORATE_KEYS = {g["key"] for g in GOVERNORATES}

_JO_MOBILE_RE = re.compile(r"^7[789]\d{7}$")


def is_governorate_key(key: str) -> bool:
    """True if `key` is one of the 12 Jordanian governorate keys."""
    return key in _GOVERNORATE_KEYS


def normalize_phone_jo(raw) -> str | None:
    """Normalize a Jordanian mobile number to ``+9627XXXXXXXX``.

    Accepts ``07XXXXXXXX``, ``9627XXXXXXXX``, ``+9627XXXXXXXX`` and
    ``009627XXXXXXXX`` (spaces/dashes are stripped). Returns ``None``
    when the number is not a valid Jordanian mobile.
    """
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("962"):
        digits = digits[3:]
    digits = digits.lstrip("0")
    if not _JO_MOBILE_RE.match(digits):
        return None
    return f"+962{digits}"


def format_jod(amount) -> str:
    """Format an amount as Jordanian dinars, e.g. ``format_jod(120)`` -> ``"120.00 د.أ"``."""
    try:
        value = float(amount)
    except (TypeError, ValueError):
        value = 0.0
    return f"{value:,.2f} {CURRENCY_SYMBOL}"


def amman_now() -> datetime:
    """Current time as a timezone-aware datetime in Asia/Amman."""
    return datetime.now(AMMAN_TZ)
