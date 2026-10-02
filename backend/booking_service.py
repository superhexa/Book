"""Booking service: atomic creation, lifecycle state machine, expiry sweeper.

Phase 3b hardening for the Jordan football platform.

Concurrency model
-----------------
Double-booking is prevented by a UNIQUE index on
``slot_reservations(pitch_id, date, slot_min)`` (see ``ensure_indexes``).
Creating a booking inserts one reservation document per 30-minute part with
``insert_many(ordered=True)``. If two requests race for the same part, MongoDB
rejects the loser's insert with ``DuplicateKeyError``/``BulkWriteError`` --
atomic at the storage engine -- and the service rolls back the booking document
and returns HTTP 409. This is race-safe on any MongoDB topology;
multi-document transactions are deliberately NOT used because they require a
replica set.

Validation order (fail fast, Arabic errors):
  1. pitch + facility exist and the facility is bookable,
  2. slot alignment / operating hours / past-time (mirrors engines rules),
  3. cross-check against the availability engine grid (``build_availability``),
  4. maintenance / manual blocks (``availability_blocks``),
  5. league-match blocks (``matches`` with status SCHEDULED/LIVE).

Lifecycle: PENDING -> CONFIRMED -> (REJECTED | CANCELLED | COMPLETED | NO_SHOW | EXPIRED)
plus PENDING -> REJECTED / CANCELLED / EXPIRED. All transitions are audited.

All user-facing errors are in Arabic. Currency is JOD (د.أ); datetimes are
stored in UTC.
"""
from datetime import datetime, timedelta

from fastapi import HTTPException, Request
from pymongo.errors import BulkWriteError, DuplicateKeyError

from audit import write_audit
from db import db, new_id, now
from engines import (SLOT_PART, build_availability, build_price_breakdown,
                     compute_refund, next_booking_ref, validate_coupon,
                     weekday_of)
from notify import notify

# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------
BOOKING_TRANSITIONS = {
    "PENDING": {"CONFIRMED", "REJECTED", "CANCELLED", "EXPIRED"},
    "CONFIRMED": {"CANCELLED", "COMPLETED", "NO_SHOW"},
    "REJECTED": set(),
    "CANCELLED": set(),
    "COMPLETED": set(),
    "NO_SHOW": set(),
    "EXPIRED": set(),
}
TERMINAL_STATUSES = {"REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW", "EXPIRED"}
ACTIVE_STATUSES = ["PENDING", "CONFIRMED"]

DEFAULT_PENDING_TTL_MINUTES = 30


async def ensure_indexes():
    """Idempotent index setup. The unique slot_reservations index is what makes
    booking creation race-safe; call once at application startup."""
    await db.slot_reservations.create_index(
        [("pitch_id", 1), ("date", 1), ("slot_min", 1)], unique=True)
    await db.bookings.create_index([("customer_id", 1), ("date", 1)])
    await db.bookings.create_index([("facility_id", 1), ("date", 1), ("status", 1)])
    await db.payments.create_index("booking_id")
    await db.payments.create_index("idempotency_key", unique=True, sparse=True)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
async def check_match_conflict(pitch_id: str, date_str: str, start_min: int, end_min: int):
    """Reject the slot if a league match (SCHEDULED/LIVE) overlaps it."""
    clash = await db.matches.find_one({
        "pitch_id": pitch_id,
        "date": date_str,
        "status": {"$in": ["SCHEDULED", "LIVE"]},
        "start_min": {"$lt": end_min},
        "end_min": {"$gt": start_min},
        "deleted_at": None,
    })
    if clash:
        raise HTTPException(
            409, "تعارض مع مباراة مجدولة على هذا الملعب في نفس الوقت")


async def validate_booking_slot(pitch: dict, facility: dict, date_str: str,
                                start_min: int, end_min: int):
    """Full pre-booking validation. Raises HTTPException with Arabic detail."""
    if end_min <= start_min:
        raise HTTPException(400, "الفترة الزمنية غير صالحة")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "صيغة التاريخ غير صالحة (YYYY-MM-DD)")

    schedule = pitch.get("schedule", {})
    wd = weekday_of(date_str)
    day_cfg = (schedule.get("weekly") or {}).get(str(wd))
    if not day_cfg or day_cfg.get("closed") or date_str in (schedule.get("closed_dates") or []):
        raise HTTPException(409, "الملعب مغلق في هذا التاريخ")
    open_min = day_cfg.get("open_min", 360)
    close_min = day_cfg.get("close_min", 1380)
    if start_min < open_min or end_min > close_min:
        raise HTTPException(409, "الوقت المحدد خارج ساعات عمل الملعب")
    slot_duration = int(pitch.get("slot_duration", 60))
    if (start_min - open_min) % slot_duration != 0 or (end_min - start_min) % slot_duration != 0:
        raise HTTPException(400, "يجب أن يتوافق الحجز مع بداية الفترات المتاحة")
    today = now().strftime("%Y-%m-%d")
    if date_str < today or (date_str == today and start_min <= now().hour * 60 + now().minute):
        raise HTTPException(409, "لا يمكن الحجز في وقت مضى")

    # Cross-check against the availability engine grid: every 30-min part must
    # be reported "available".
    slots = await build_availability(pitch, facility, date_str)
    status_by_part = {}
    for s in slots:
        for p in range(s["start_min"], s["end_min"], SLOT_PART):
            status_by_part[p] = s["status"]
    wanted = list(range(start_min, end_min, SLOT_PART))
    if any(status_by_part.get(p) != "available" for p in wanted):
        raise HTTPException(409, "هذه الفترة غير متاحة للحجز")

    # Maintenance / manual blocks (defensive; also covered by the grid above).
    async for b in db.availability_blocks.find(
            {"pitch_id": pitch["_id"], "date": date_str, "deleted_at": None}):
        if not (end_min <= b["start_min"] or start_min >= b["end_min"]):
            raise HTTPException(409, "هذه الفترة محظورة من قبل إدارة المنشأة")

    # League-match blocks.
    await check_match_conflict(pitch["_id"], date_str, start_min, end_min)


_COUPON_AR = {
    "Invalid or inactive coupon": "كوبون الخصم غير صالح أو غير مفعّل",
    "Coupon is not active yet": "كوبون الخصم غير مفعّل بعد",
    "Coupon has expired": "انتهت صلاحية كوبون الخصم",
    "Coupon not valid for this facility": "كوبون الخصم غير صالح لهذه المنشأة",
    "Coupon not valid for this pitch": "كوبون الخصم غير صالح لهذا الملعب",
    "Coupon usage limit reached": "تم الوصول إلى الحد الأقصى لاستخدام كوبون الخصم",
    "You have already used this coupon the maximum number of times":
        "لقد استخدمت كوبون الخصم بالحد الأقصى المسموح",
}


def _ar_coupon_error(e: HTTPException) -> HTTPException:
    detail = str(e.detail)
    for en, ar in _COUPON_AR.items():
        if en in detail:
            return HTTPException(e.status_code, ar)
    if "Minimum booking amount" in detail:
        return HTTPException(e.status_code, "الحد الأدنى لمبلغ الحجز لهذا الكوبون غير مستوفى")
    return HTTPException(e.status_code, "كوبون الخصم غير صالح")


# ---------------------------------------------------------------------------
# Atomic creation
# ---------------------------------------------------------------------------
async def create_booking_atomic(*, user: dict, pitch_id: str, date_str: str,
                                start_min: int, end_min: int,
                                coupon_code: str = None, notes: str = "",
                                players: int = None, payment_method: str = None,
                                request: Request = None) -> dict:
    """Create a booking race-safely. Returns the raw booking document.

    Steps: validate -> price (JOD snapshot) -> coupon -> insert booking ->
    insert slot reservations atomically (unique index) -> coupon usage ->
    payment record -> notifications + audit. On reservation conflict the
    booking insert is rolled back and HTTP 409 is raised.
    """
    pitch = await db.pitches.find_one({"_id": pitch_id, "deleted_at": None})
    if not pitch:
        raise HTTPException(404, "الملعب غير موجود")
    facility = await db.facilities.find_one({"_id": pitch["facility_id"], "deleted_at": None})
    if not facility or facility.get("status") != "VERIFIED" or not facility.get("is_active"):
        raise HTTPException(400, "هذه المنشأة غير متاحة للحجز حالياً")

    await validate_booking_slot(pitch, facility, date_str, start_min, end_min)

    breakdown = build_price_breakdown(pitch, facility, date_str, start_min, end_min)
    subtotal = breakdown["subtotal"]
    discount = 0.0
    coupon_doc = None
    if coupon_code:
        try:
            res = await validate_coupon(coupon_code, facility["_id"], pitch["_id"],
                                        subtotal, user["_id"])
        except HTTPException as e:
            raise _ar_coupon_error(e)
        discount = res["discount"]
        coupon_doc = res["coupon"]
    final_amount = round(subtotal - discount, 2)
    currency = facility.get("currency") or "JOD"

    methods = facility.get("payment_methods") or ["cash"]
    method = payment_method or methods[0]
    if method not in methods:
        raise HTTPException(400, "طريقة الدفع المحددة غير متاحة لهذه المنشأة")

    approval = facility.get("approval_mode", "auto")
    initial_status = "CONFIRMED" if approval == "auto" else "PENDING"
    bid = new_id()
    t = now()
    booking = {
        "_id": bid,
        "ref": await next_booking_ref(),
        "customer_id": user["_id"],
        "customer_name": user.get("name"),
        "facility_id": facility["_id"],
        "facility_name": facility["name"],
        "owner_id": facility["owner_id"],
        "pitch_id": pitch["_id"],
        "pitch_name": pitch["name"],
        "date": date_str,
        "start_min": start_min,
        "end_min": end_min,
        "duration_min": end_min - start_min,
        "players": players,
        "price_snapshot": breakdown,  # immutable JOD breakdown; history-safe
        "subtotal": subtotal,
        "discount": discount,
        "coupon_code": coupon_doc["code"] if coupon_doc else None,
        "final_amount": final_amount,
        "currency": currency,
        "status": initial_status,
        "status_reason": None,
        "payment_status": "PENDING",
        "payment_method": method,
        "cancellation_reason": None,
        "refund_amount": 0.0,
        "notes": notes,
        "deleted_at": None,
        "created_at": t,
        "updated_at": t,
    }
    await db.bookings.insert_one(booking)

    # Atomic conflict prevention: one reservation per 30-min part; the unique
    # index on (pitch_id, date, slot_min) makes concurrent double-inserts fail.
    parts = list(range(start_min, end_min, SLOT_PART))
    reservations = [{"_id": new_id(), "pitch_id": pitch["_id"], "date": date_str,
                     "slot_min": p, "booking_id": bid, "created_at": t} for p in parts]
    try:
        await db.slot_reservations.insert_many(reservations, ordered=True)
    except (DuplicateKeyError, BulkWriteError):
        # Lost the race: roll back and report the slot as taken.
        await db.slot_reservations.delete_many({"booking_id": bid})
        await db.bookings.delete_one({"_id": bid})
        raise HTTPException(409, "تم حجز هذه الفترة للتو من قبل شخص آخر")

    if coupon_doc:
        await db.coupons.update_one({"_id": coupon_doc["_id"]}, {"$inc": {"used_count": 1}})

    provider = "cash" if method != "online" else (facility.get("payment_provider") or "online")
    await db.payments.insert_one({
        "_id": new_id(),
        "idempotency_key": f"{bid}:{method}",
        "booking_id": bid,
        "booking_ref": booking["ref"],
        "customer_id": user["_id"],
        "facility_id": facility["_id"],
        "amount": final_amount,
        "currency": currency,
        "method": method,
        "provider": provider,
        "provider_payment_id": None,
        "status": "PENDING",
        "refunded_amount": 0.0,
        "webhook_events": [],
        "created_at": t,
        "updated_at": t,
    })

    await notify(user["_id"], "booking_created",
                 "تم طلب الحجز" if initial_status == "PENDING" else "تم تأكيد الحجز",
                 f"{facility['name']} · {pitch['name']} · {date_str}", {"booking_id": bid})
    await notify(facility["owner_id"], "owner_new_booking", "حجز جديد",
                 f"{user.get('name')} حجز {pitch['name']} بتاريخ {date_str}", {"booking_id": bid})
    await write_audit(user, "booking_created", "bookings", bid, request)
    return booking


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------
async def _free_slots(booking_id: str):
    await db.slot_reservations.delete_many({"booking_id": booking_id})


async def _sync_payment_on_terminal(booking: dict, to_status: str):
    """Best-effort payment sync for terminal transitions (non-refund paths)."""
    if to_status in ("EXPIRED", "REJECTED"):
        await db.payments.update_many(
            {"booking_id": booking["_id"], "status": {"$in": ["PENDING", "AUTHORIZED"]}},
            {"$set": {"status": "CANCELLED", "updated_at": now()}})
    elif to_status == "COMPLETED":
        # Cash / pay-on-arrival is collected on site at completion time.
        await db.payments.update_many(
            {"booking_id": booking["_id"], "method": {"$in": ["cash", "pay_on_arrival"]},
             "status": "PENDING"},
            {"$set": {"status": "PAID", "updated_at": now()}})


async def transition_booking(bid: str, to_status: str, actor: dict = None,
                             request: Request = None, reason: str = None,
                             *, force: bool = False) -> dict:
    """Move a booking through the lifecycle state machine.

    Raises 404 if missing, 400 on illegal transitions (unless force=True, which
    is reserved for super-admin override). Frees slot reservations on terminal
    non-COMPLETED states, syncs payment records, notifies and audits.
    """
    b = await db.bookings.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    frm = b["status"]
    if to_status == frm:
        return b
    if to_status not in BOOKING_TRANSITIONS:
        raise HTTPException(400, "حالة الحجز المطلوبة غير صالحة")
    if not force and to_status not in BOOKING_TRANSITIONS.get(frm, set()):
        raise HTTPException(
            400, f"لا يمكن نقل الحجز من الحالة {frm} إلى {to_status}")

    update = {"status": to_status, "updated_at": now()}
    if reason:
        update["status_reason"] = reason
    await db.bookings.update_one({"_id": bid}, {"$set": update})

    if to_status in TERMINAL_STATUSES and to_status != "COMPLETED":
        await _free_slots(bid)
    await _sync_payment_on_terminal(b, to_status)

    if to_status in ("REJECTED", "CANCELLED", "EXPIRED"):
        await notify(b["customer_id"], "booking_status_changed", "تغيّرت حالة حجزك",
                     f"حجزك في {b['facility_name']} بتاريخ {b['date']} أصبح {to_status}",
                     {"booking_id": bid})
    await write_audit(actor, "booking_status_changed", "bookings", bid, request,
                      before={"status": frm}, after={"status": to_status, "reason": reason})
    return await db.bookings.find_one({"_id": bid})


async def cancel_booking(*, bid: str, actor: dict, request: Request = None,
                         reason: str = "", by_owner: bool = False) -> dict:
    """Cancel an active booking with refund computed from the facility policy
    (engines.compute_refund). Returns the updated booking + refund detail."""
    b = await db.bookings.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b["status"] not in ACTIVE_STATUSES:
        raise HTTPException(400, "لا يمكن إلغاء حجز غير نشط")

    facility = await db.facilities.find_one({"_id": b["facility_id"]})
    policy = (facility or {}).get("cancellation_policy", {})
    if by_owner:
        refund = {"eligible": True, "refund": float(b["final_amount"]), "rate": 100}
    else:
        refund = compute_refund(b, policy)
        if not refund["eligible"]:
            raise HTTPException(400, "انتهت مهلة الإلغاء المجاني لهذا الحجز")

    new_payment_status = b["payment_status"]
    if b["payment_status"] == "PAID":
        if refund["refund"] >= float(b["final_amount"]):
            new_payment_status = "REFUNDED"
        elif refund["refund"] > 0:
            new_payment_status = "PARTIALLY_REFUNDED"

    await db.bookings.update_one({"_id": bid}, {"$set": {
        "status": "CANCELLED",
        "cancellation_reason": reason or ("أُلغي من قبل الإدارة" if by_owner else "أُلغي من قبل العميل"),
        "refund_amount": refund["refund"],
        "payment_status": new_payment_status,
        "updated_at": now(),
    }})
    await db.payments.update_many(
        {"booking_id": bid, "status": {"$ne": "PAID"}},
        {"$set": {"status": "CANCELLED", "updated_at": now()}})
    if new_payment_status != b["payment_status"]:
        await db.payments.update_many(
            {"booking_id": bid, "status": "PAID"},
            {"$set": {"status": new_payment_status, "updated_at": now()}})
    await _free_slots(bid)

    recipient = b["owner_id"] if not by_owner else b["customer_id"]
    await notify(recipient, "booking_cancelled", "تم إلغاء الحجز",
                 f"حجز {b['facility_name']} بتاريخ {b['date']} أُلغي", {"booking_id": bid})
    await write_audit(actor, "booking_cancelled", "bookings", bid, request,
                      before={"status": b["status"]},
                      after={"status": "CANCELLED", "refund": refund})
    updated = await db.bookings.find_one({"_id": bid})
    updated["_refund_detail"] = refund
    return updated


async def expire_pending_bookings(default_ttl_minutes: int = DEFAULT_PENDING_TTL_MINUTES) -> dict:
    """Background-job entrypoint: expire PENDING bookings older than the TTL
    (facility-level ``pending_hold_minutes`` overrides the default)."""
    expired = 0
    cutoff = now() - timedelta(minutes=default_ttl_minutes)
    async for b in db.bookings.find(
            {"status": "PENDING", "deleted_at": None, "created_at": {"$lt": cutoff}}):
        facility = await db.facilities.find_one(
            {"_id": b["facility_id"]}, {"pending_hold_minutes": 1})
        ttl = (facility or {}).get("pending_hold_minutes") or default_ttl_minutes
        if b["created_at"] < now() - timedelta(minutes=ttl):
            await transition_booking(
                b["_id"], "EXPIRED", actor=None, reason="انتهت مهلة التأكيد")
            expired += 1
    return {"expired": expired}


async def admin_override_status(bid: str, to_status: str, actor: dict,
                                request: Request = None, reason: str = "") -> dict:
    """Super-admin forced transition. Bypasses the state machine but still
    frees slots, syncs payments and writes a full audit trail."""
    if not reason or len(reason.strip()) < 3:
        raise HTTPException(400, "يجب ذكر سبب التجاوز الإداري")
    b = await db.bookings.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    updated = await transition_booking(bid, to_status, actor, request,
                                       reason=f"[تجاوز إداري] {reason}", force=True)
    await write_audit(actor, "booking_admin_override", "bookings", bid, request,
                      before={"status": b["status"]},
                      after={"status": to_status, "reason": reason})
    return updated
