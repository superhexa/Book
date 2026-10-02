"""Booking business logic: availability engine, pricing engine, coupon validation,
cancellation policy and booking reference generation. The backend is the single
source of truth for all of these."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from db import db, now

SLOT_PART = 30  # atomic reservation granularity in minutes


def minutes_to_label(m: int) -> str:
    h = m // 60
    mm = m % 60
    ampm = "AM" if h < 12 else "PM"
    hh = h % 12
    if hh == 0:
        hh = 12
    return f"{hh}:{mm:02d} {ampm}"


def slot_part(m: int) -> str:
    """Time-of-day bucket used to group slots in the UI."""
    if m < 12 * 60:
        return "morning"
    if m < 17 * 60:
        return "afternoon"
    return "evening"


def weekday_of(date_str: str) -> int:
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return d.weekday()  # Mon=0 .. Sun=6


async def next_booking_ref() -> str:
    year = now().year
    key = f"booking_{year}"
    doc = await db.counters.find_one_and_update(
        {"_id": key}, {"$inc": {"seq": 1}}, upsert=True, return_document=True,
    )
    seq = doc["seq"]
    return f"FB-{year}-{seq:06d}"


def _hourly_rate_for(pricing: dict, date_str: str, start_min: int, is_weekend: bool) -> float:
    special = (pricing.get("special_dates") or {}).get(date_str)
    if special and special.get("price_hourly") is not None:
        rate = float(special["price_hourly"])
    else:
        rate = float(pricing.get("base_hourly", 0))
        if is_weekend and pricing.get("weekend_multiplier"):
            rate *= float(pricing["weekend_multiplier"])
    # peak windows (applied on top, multiplicative)
    for peak in pricing.get("peak_hours", []) or []:
        if peak["start_min"] <= start_min < peak["end_min"]:
            rate *= float(peak.get("multiplier", 1))
            break
    return rate


def compute_price(pitch: dict, facility: dict, date_str: str, start_min: int, end_min: int) -> dict:
    """Return a full price breakdown. Prices are computed per 30-min part so peak
    windows apply fairly across a multi-hour booking."""
    pricing = pitch.get("pricing", {})
    weekend_days = facility.get("weekend_days", [4, 5])  # default Fri, Sat
    wd = weekday_of(date_str)
    is_weekend = wd in weekend_days

    subtotal = 0.0
    peak_applied = False
    m = start_min
    while m < end_min:
        part = min(SLOT_PART, end_min - m)
        rate = _hourly_rate_for(pricing, date_str, m, is_weekend)
        base_rate = float((pricing.get("special_dates") or {}).get(date_str, {}).get("price_hourly")
                          or pricing.get("base_hourly", 0))
        if rate > base_rate:
            peak_applied = True
        subtotal += rate * (part / 60.0)
        m += SLOT_PART

    subtotal = round(subtotal, 2)
    return {
        "currency": facility.get("currency", "USD"),
        "subtotal": subtotal,
        "is_weekend": is_weekend,
        "peak_applied": peak_applied,
        "discount": 0.0,
        "total": subtotal,
    }


async def validate_coupon(code: str, facility_id: str, pitch_id: str, amount: float,
                          user_id: str) -> dict:
    coupon = await db.coupons.find_one({"code": code.upper(), "deleted_at": None})
    if not coupon or not coupon.get("is_active", True):
        raise HTTPException(400, "Invalid or inactive coupon")
    t = now()
    if coupon.get("starts_at") and t < coupon["starts_at"]:
        raise HTTPException(400, "Coupon is not active yet")
    if coupon.get("expires_at") and t > coupon["expires_at"]:
        raise HTTPException(400, "Coupon has expired")
    if coupon.get("min_amount") and amount < coupon["min_amount"]:
        raise HTTPException(400, f"Minimum booking amount for this coupon is {coupon['min_amount']}")
    # scope: platform coupon (no facility_id) or owner coupon for a specific facility
    if coupon.get("facility_id") and coupon["facility_id"] != facility_id:
        raise HTTPException(400, "Coupon not valid for this facility")
    if coupon.get("pitch_id") and coupon["pitch_id"] != pitch_id:
        raise HTTPException(400, "Coupon not valid for this pitch")
    if coupon.get("usage_limit") is not None and coupon.get("used_count", 0) >= coupon["usage_limit"]:
        raise HTTPException(400, "Coupon usage limit reached")
    if coupon.get("per_user_limit") is not None:
        used_by_user = await db.bookings.count_documents({
            "customer_id": user_id, "coupon_code": code.upper(),
            "status": {"$nin": ["CANCELLED", "REJECTED", "EXPIRED"]},
        })
        if used_by_user >= coupon["per_user_limit"]:
            raise HTTPException(400, "You have already used this coupon the maximum number of times")

    if coupon["discount_type"] == "percentage":
        discount = round(amount * float(coupon["discount_value"]) / 100.0, 2)
        if coupon.get("max_discount"):
            discount = min(discount, float(coupon["max_discount"]))
    else:
        discount = min(float(coupon["discount_value"]), amount)
    return {"coupon": coupon, "discount": round(discount, 2)}


async def build_availability(pitch: dict, facility: dict, date_str: str) -> list:
    """Produce the full slot grid for a pitch on a given date with status + price."""
    schedule = pitch.get("schedule", {})
    wd = weekday_of(date_str)
    day_cfg = (schedule.get("weekly") or {}).get(str(wd))
    slot_duration = int(pitch.get("slot_duration", 60))

    closed_dates = set(schedule.get("closed_dates", []) or [])
    day_closed = (not day_cfg) or day_cfg.get("closed") or (date_str in closed_dates)

    open_min = (day_cfg or {}).get("open_min", 360)
    close_min = (day_cfg or {}).get("close_min", 1380)

    # existing reservations for this date
    reserved_parts = set()
    async for r in db.slot_reservations.find({"pitch_id": pitch["_id"], "date": date_str}):
        reserved_parts.add(r["slot_min"])

    # blocked ranges (maintenance / manual blocks)
    blocks = []
    async for b in db.availability_blocks.find({"pitch_id": pitch["_id"], "date": date_str, "deleted_at": None}):
        blocks.append((b["start_min"], b["end_min"]))

    # determine "past" relative to now (compare in UTC date-time naive-ish)
    today = now().strftime("%Y-%m-%d")
    current_min = now().hour * 60 + now().minute if date_str == today else -1
    is_past_date = date_str < today

    slots = []
    if day_closed:
        return slots

    m = open_min
    while m + slot_duration <= close_min:
        start, end = m, m + slot_duration
        status = "available"
        # reserved if any 30-min part within [start,end) is taken
        parts = list(range(start, end, SLOT_PART))
        if any(p in reserved_parts for p in parts):
            status = "reserved"
        elif any(not (end <= bs or start >= be) for (bs, be) in blocks):
            status = "blocked"
        elif is_past_date or (current_min >= 0 and start <= current_min):
            status = "past"
        price = compute_price(pitch, facility, date_str, start, end)
        slots.append({
            "start_min": start,
            "end_min": end,
            "label": f"{minutes_to_label(start)} - {minutes_to_label(end)}",
            "part": slot_part(start),
            "status": status,
            "price": price["total"],
            "peak": price["peak_applied"],
        })
        m += slot_duration
    return slots


def compute_refund(booking: dict, policy: dict) -> dict:
    """Determine cancellation eligibility + refund amount from the facility policy."""
    final = float(booking.get("final_amount", 0))
    start_dt = datetime.strptime(f"{booking['date']} {booking['start_min']//60:02d}:{booking['start_min']%60:02d}",
                                 "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    hours_before = (start_dt - now()).total_seconds() / 3600.0
    free_window = policy.get("free_cancellation_hours", 24)
    partial_pct = policy.get("partial_refund_percent", 50)
    partial_window = policy.get("partial_refund_hours", 6)

    if hours_before >= free_window:
        return {"eligible": True, "refund": round(final, 2), "rate": 100, "hours_before": round(hours_before, 1)}
    if hours_before >= partial_window:
        return {"eligible": True, "refund": round(final * partial_pct / 100.0, 2),
                "rate": partial_pct, "hours_before": round(hours_before, 1)}
    return {"eligible": False, "refund": 0.0, "rate": 0, "hours_before": round(hours_before, 1)}


# ---------------------------------------------------------------------------
# Phase 3b: Jordan / JOD pricing additions (append-only)
# ---------------------------------------------------------------------------
# Currency for the Jordanian platform is the Jordanian Dinar (JOD, د.أ) and the
# display timezone is Asia/Amman. The functions below only ADD behaviour; the
# pricing logic above is untouched.
from zoneinfo import ZoneInfo  # noqa: E402

AMMAN_TZ = ZoneInfo("Asia/Amman")
CURRENCY_JOD = "JOD"
CURRENCY_LABEL_AR = "د.أ"


def amman_now():
    """Current time in Asia/Amman (storage stays UTC; this is for display)."""
    return now().astimezone(AMMAN_TZ)


def format_jod(amount: float, currency: str = CURRENCY_JOD) -> str:
    """Arabic price label, e.g. '25.00 د.أ'."""
    label = CURRENCY_LABEL_AR if currency == CURRENCY_JOD else currency
    return f"{float(amount):.2f} {label}"


def build_price_breakdown(pitch: dict, facility: dict, date_str: str,
                          start_min: int, end_min: int,
                          discount: float = 0.0, coupon_code: Optional[str] = None) -> dict:
    """Full immutable JOD price breakdown for a booking.

    Stored as ``price_snapshot`` on the booking so later price changes never
    alter history. Includes the pricing inputs in effect, so the snapshot is
    self-describing.
    """
    base = compute_price(pitch, facility, date_str, start_min, end_min)
    currency = facility.get("currency") or CURRENCY_JOD
    pricing = pitch.get("pricing", {})

    # Per-part rates (30-min granularity) for a transparent history record.
    parts = []
    m = start_min
    weekend_days = facility.get("weekend_days", [4, 5])
    is_weekend = weekday_of(date_str) in weekend_days
    while m < end_min:
        part = min(SLOT_PART, end_min - m)
        rate = _hourly_rate_for(pricing, date_str, m, is_weekend)
        parts.append({"start_min": m, "end_min": m + part,
                      "hourly_rate": round(rate, 2),
                      "amount": round(rate * (part / 60.0), 2)})
        m += SLOT_PART

    subtotal = base["subtotal"]
    discount = round(float(discount or 0.0), 2)
    total = round(subtotal - discount, 2)
    return {
        "currency": currency,
        "subtotal": subtotal,
        "discount": discount,
        "coupon_code": coupon_code,
        "total": total,
        "total_ar": format_jod(total, currency),
        "is_weekend": base["is_weekend"],
        "peak_applied": base["peak_applied"],
        "parts": parts,
        "pricing_inputs": {
            "base_hourly": pricing.get("base_hourly", 0),
            "weekend_multiplier": pricing.get("weekend_multiplier", 1.0),
            "peak_hours": pricing.get("peak_hours", []) or [],
            "special_date": (pricing.get("special_dates") or {}).get(date_str),
            "slot_duration": pitch.get("slot_duration", 60),
        },
        "computed_at": now(),
        "computed_at_amman": amman_now().isoformat(),
    }


async def ensure_booking_price_snapshot(booking: dict) -> dict:
    """Guarantee a confirmed booking carries a full JOD price snapshot.

    Returns the existing snapshot when present; otherwise rebuilds one from
    current pitch/facility pricing, persists it, and flags it as reconstructed
    (pricing may have changed since the booking was made -- the flag keeps the
    history honest).
    """
    snap = booking.get("price_snapshot") or {}
    if snap.get("currency") and snap.get("total") is not None and "parts" in snap:
        return snap
    pitch = await db.pitches.find_one({"_id": booking["pitch_id"]})
    facility = await db.facilities.find_one({"_id": booking["facility_id"]})
    if not pitch or not facility:
        return snap
    rebuilt = build_price_breakdown(
        pitch, facility, booking["date"], booking["start_min"], booking["end_min"],
        discount=booking.get("discount", 0.0), coupon_code=booking.get("coupon_code"))
    rebuilt["reconstructed"] = True
    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": {"price_snapshot": rebuilt, "updated_at": now()}})
    return rebuilt
