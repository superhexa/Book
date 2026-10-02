from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from pymongo.errors import BulkWriteError, DuplicateKeyError

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from engines import (SLOT_PART, build_availability, compute_price,
                     compute_refund, next_booking_ref, validate_coupon,
                     weekday_of)
from booking_service import (admin_override_status, expire_pending_bookings,
                             transition_booking)
from notify import notify
from security import (assert_facility_access, current_user, is_super_admin,
                      optional_user)

router = APIRouter(tags=["bookings"])

ACTIVE_STATUSES = ["PENDING", "CONFIRMED"]


class AvailabilityQuery(BaseModel):
    pitch_id: str
    date: str


class PriceQuoteBody(BaseModel):
    pitch_id: str
    date: str
    start_min: int
    end_min: int
    coupon_code: Optional[str] = None


class CreateBookingBody(BaseModel):
    pitch_id: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_min: int
    end_min: int
    coupon_code: Optional[str] = None
    notes: str = ""
    players: Optional[int] = None


class CancelBody(BaseModel):
    reason: str = ""


# ----------------------------- availability --------------------------------
@router.get("/availability")
async def availability(pitch_id: str, date: str):
    pitch = await db.pitches.find_one({"_id": pitch_id, "deleted_at": None})
    if not pitch:
        raise HTTPException(404, "Pitch not found")
    facility = await db.facilities.find_one({"_id": pitch["facility_id"]})
    slots = await build_availability(pitch, facility, date)
    return {"pitch_id": pitch_id, "date": date, "slot_duration": pitch.get("slot_duration", 60), "slots": slots}


async def _validate_slot(pitch, facility, date, start_min, end_min):
    if end_min <= start_min:
        raise HTTPException(400, "Invalid time range")
    schedule = pitch.get("schedule", {})
    wd = weekday_of(date)
    day_cfg = (schedule.get("weekly") or {}).get(str(wd))
    if not day_cfg or day_cfg.get("closed") or date in (schedule.get("closed_dates") or []):
        raise HTTPException(409, "The field is closed on this date")
    if start_min < day_cfg.get("open_min", 360) or end_min > day_cfg.get("close_min", 1380):
        raise HTTPException(409, "Selected time is outside operating hours")
    today = now().strftime("%Y-%m-%d")
    if date < today or (date == today and start_min <= now().hour * 60 + now().minute):
        raise HTTPException(409, "This time slot is in the past")
    # blocked ranges
    async for b in db.availability_blocks.find({"pitch_id": pitch["_id"], "date": date, "deleted_at": None}):
        if not (end_min <= b["start_min"] or start_min >= b["end_min"]):
            raise HTTPException(409, "This time range is blocked by the owner")


@router.post("/bookings/quote")
async def quote(body: PriceQuoteBody, user: dict = Depends(optional_user)):
    pitch = await db.pitches.find_one({"_id": body.pitch_id, "deleted_at": None})
    if not pitch:
        raise HTTPException(404, "Pitch not found")
    facility = await db.facilities.find_one({"_id": pitch["facility_id"]})
    price = compute_price(pitch, facility, body.date, body.start_min, body.end_min)
    if body.coupon_code and user:
        try:
            res = await validate_coupon(body.coupon_code, facility["_id"], pitch["_id"],
                                        price["subtotal"], user["_id"])
            price["discount"] = res["discount"]
            price["total"] = round(price["subtotal"] - res["discount"], 2)
            price["coupon_valid"] = True
        except HTTPException as e:
            price["coupon_valid"] = False
            price["coupon_error"] = e.detail
    return price


# ----------------------------- create booking ------------------------------
@router.post("/bookings", status_code=201)
async def create_booking(body: CreateBookingBody, request: Request, user: dict = Depends(current_user)):
    pitch = await db.pitches.find_one({"_id": body.pitch_id, "deleted_at": None})
    if not pitch:
        raise HTTPException(404, "Pitch not found")
    facility = await db.facilities.find_one({"_id": pitch["facility_id"], "deleted_at": None})
    if not facility or facility.get("status") != "VERIFIED" or not facility.get("is_active"):
        raise HTTPException(400, "This facility is not available for booking")

    await _validate_slot(pitch, facility, body.date, body.start_min, body.end_min)

    price = compute_price(pitch, facility, body.date, body.start_min, body.end_min)
    subtotal = price["subtotal"]
    discount = 0.0
    coupon_doc = None
    if body.coupon_code:
        res = await validate_coupon(body.coupon_code, facility["_id"], pitch["_id"], subtotal, user["_id"])
        discount = res["discount"]
        coupon_doc = res["coupon"]
    final_amount = round(subtotal - discount, 2)

    approval = facility.get("approval_mode", "auto")
    booking_status = "CONFIRMED" if approval == "auto" else "PENDING"
    ref = await next_booking_ref()
    bid = new_id()

    booking = {
        "_id": bid,
        "ref": ref,
        "customer_id": user["_id"],
        "customer_name": user.get("name"),
        "facility_id": facility["_id"],
        "facility_name": facility["name"],
        "owner_id": facility["owner_id"],
        "pitch_id": pitch["_id"],
        "pitch_name": pitch["name"],
        "date": body.date,
        "start_min": body.start_min,
        "end_min": body.end_min,
        "duration_min": body.end_min - body.start_min,
        "players": body.players,
        "price_snapshot": price,
        "subtotal": subtotal,
        "discount": discount,
        "coupon_code": coupon_doc["code"] if coupon_doc else None,
        "final_amount": final_amount,
        "currency": facility.get("currency", "USD"),
        "status": booking_status,
        "payment_status": "PENDING",
        "payment_method": "cash",
        "cancellation_reason": None,
        "refund_amount": 0.0,
        "notes": body.notes,
        "deleted_at": None,
        "created_at": now(),
        "updated_at": now(),
    }
    await db.bookings.insert_one(booking)

    # Atomic conflict prevention: insert one reservation per 30-min part.
    parts = list(range(body.start_min, body.end_min, SLOT_PART))
    reservations = [{"_id": new_id(), "pitch_id": pitch["_id"], "date": body.date,
                     "slot_min": p, "booking_id": bid} for p in parts]
    try:
        await db.slot_reservations.insert_many(reservations, ordered=True)
    except (DuplicateKeyError, BulkWriteError):
        await db.slot_reservations.delete_many({"booking_id": bid})
        await db.bookings.delete_one({"_id": bid})
        raise HTTPException(status.HTTP_409_CONFLICT, "This time slot is no longer available")

    if coupon_doc:
        await db.coupons.update_one({"_id": coupon_doc["_id"]}, {"$inc": {"used_count": 1}})

    await db.payments.insert_one({
        "_id": new_id(), "booking_id": bid, "customer_id": user["_id"], "amount": final_amount,
        "currency": facility.get("currency", "USD"), "status": "PENDING", "provider": "cash",
        "transaction_id": None, "created_at": now(), "updated_at": now(),
    })

    await notify(user["_id"], "booking_created",
                 "Booking requested" if booking_status == "PENDING" else "Booking confirmed",
                 f"{facility['name']} · {pitch['name']} · {body.date}", {"booking_id": bid})
    await notify(facility["owner_id"], "owner_new_booking", "New booking",
                 f"{user.get('name')} booked {pitch['name']} on {body.date}", {"booking_id": bid})
    await write_audit(user, "booking_created", "bookings", bid, request)
    return ser(booking)


# ----------------------------- list / detail -------------------------------
@router.get("/bookings")
async def my_bookings(scope: str = "all", user: dict = Depends(current_user)):
    query = {"customer_id": user["_id"], "deleted_at": None}
    today = now().strftime("%Y-%m-%d")
    if scope == "upcoming":
        query["status"] = {"$in": ACTIVE_STATUSES}
        query["date"] = {"$gte": today}
    elif scope == "past":
        query["$or"] = [{"status": {"$in": ["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW", "EXPIRED"]}},
                        {"date": {"$lt": today}}]
    docs = await db.bookings.find(query).sort([("date", -1), ("start_min", -1)]).to_list(300)
    return ser_many(docs)


# ----------------------------- expiry & admin override ---------------------
# NOTE (Phase 3b): NO_SHOW already exists below; EXPIRED transitions and the
# super-admin override live here. All new user-facing errors are in Arabic.


@router.post("/bookings/{bid}/expire")
async def expire_booking(bid: str, request: Request, user: dict = Depends(current_user)):
    """Owner/staff/admin: expire a stale PENDING booking (frees slots, cancels
    the open payment, notifies the customer)."""
    b = await _owner_booking(bid, user, "bookings.update")
    if b["status"] != "PENDING":
        raise HTTPException(400, "لا يمكن إنهاء صلاحية حجز غير معلّق")
    booking = await transition_booking(
        bid, "EXPIRED", user, request, reason="أُنهيت الصلاحية يدوياً")
    return ser(booking)


@router.post("/bookings/admin/expire-pending")
async def run_expire_pending(request: Request, user: dict = Depends(current_user)):
    """Super-admin: run the pending-booking expiry sweeper on demand
    (also meant to run as a scheduled background job)."""
    if not is_super_admin(user):
        raise HTTPException(403, "هذا الإجراء مخصص لإدارة المنصة")
    result = await expire_pending_bookings()
    await write_audit(user, "expire_pending_sweep", "bookings", None, request,
                      after=result)
    return result


class OverrideBody(BaseModel):
    to_status: str
    reason: str = Field(min_length=3, max_length=500)


@router.post("/bookings/admin/{bid}/override")
async def admin_override(bid: str, body: OverrideBody, request: Request,
                         user: dict = Depends(current_user)):
    """Super-admin forced status override. Bypasses the state machine but is
    fully audit-logged (before/after + reason) and still frees slots / syncs
    payments via the booking service."""
    if not is_super_admin(user):
        raise HTTPException(403, "هذا الإجراء مخصص لإدارة المنصة")
    booking = await admin_override_status(
        bid, body.to_status.upper(), user, request, body.reason)
    return ser(booking)


@router.get("/bookings/{bid}")
async def get_booking(bid: str, user: dict = Depends(current_user)):
    b = await db.bookings.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["customer_id"] != user["_id"] and b["owner_id"] != user["_id"] and not is_super_admin(user):
        # staff of the facility?
        member = await db.organization_members.find_one({"facility_id": b["facility_id"], "user_id": user["_id"], "deleted_at": None})
        if not member:
            raise HTTPException(403, "You don't have access to this booking")
    return ser(b)


# ----------------------------- state transitions ---------------------------
async def _free_slots(booking):
    await db.slot_reservations.delete_many({"booking_id": booking["_id"]})


@router.post("/bookings/{bid}/cancel")
async def cancel_booking(bid: str, body: CancelBody, request: Request, user: dict = Depends(current_user)):
    b = await db.bookings.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "Booking not found")
    is_customer = b["customer_id"] == user["_id"]
    is_owner = b["owner_id"] == user["_id"] or is_super_admin(user)
    if not (is_customer or is_owner):
        raise HTTPException(403, "You don't have permission to cancel this booking")
    if b["status"] not in ACTIVE_STATUSES:
        raise HTTPException(400, f"Cannot cancel a {b['status'].lower()} booking")

    facility = await db.facilities.find_one({"_id": b["facility_id"]})
    policy = facility.get("cancellation_policy", {})
    refund = compute_refund(b, policy) if is_customer else {"eligible": True, "refund": float(b["final_amount"]), "rate": 100}

    new_payment_status = b["payment_status"]
    if b["payment_status"] == "PAID":
        if refund["refund"] >= b["final_amount"]:
            new_payment_status = "REFUNDED"
        elif refund["refund"] > 0:
            new_payment_status = "PARTIALLY_REFUNDED"

    await db.bookings.update_one({"_id": bid}, {"$set": {
        "status": "CANCELLED", "cancellation_reason": body.reason or ("Cancelled by owner" if is_owner else "Cancelled by customer"),
        "refund_amount": refund["refund"], "payment_status": new_payment_status, "updated_at": now(),
    }})
    await db.payments.update_one({"booking_id": bid}, {"$set": {"status": new_payment_status, "updated_at": now()}})
    await _free_slots(b)

    recipient = b["owner_id"] if is_customer else b["customer_id"]
    await notify(recipient, "booking_cancelled", "Booking cancelled",
                 f"{b['facility_name']} · {b['date']} was cancelled", {"booking_id": bid})
    await write_audit(user, "booking_cancelled", "bookings", bid, request, before={"status": b["status"]},
                      after={"status": "CANCELLED", "refund": refund})
    return {**ser(await db.bookings.find_one({"_id": bid})), "refund_detail": refund}


@router.post("/bookings/{bid}/approve")
async def approve_booking(bid: str, request: Request, user: dict = Depends(current_user)):
    b = await _owner_booking(bid, user, "bookings.approve")
    if b["status"] != "PENDING":
        raise HTTPException(400, "Only pending bookings can be approved")
    await db.bookings.update_one({"_id": bid}, {"$set": {"status": "CONFIRMED", "updated_at": now()}})
    await notify(b["customer_id"], "booking_approved", "Booking confirmed",
                 f"Your booking at {b['facility_name']} was approved", {"booking_id": bid})
    await write_audit(user, "booking_approved", "bookings", bid, request)
    return ser(await db.bookings.find_one({"_id": bid}))


@router.post("/bookings/{bid}/reject")
async def reject_booking(bid: str, body: CancelBody, request: Request, user: dict = Depends(current_user)):
    b = await _owner_booking(bid, user, "bookings.reject")
    if b["status"] != "PENDING":
        raise HTTPException(400, "Only pending bookings can be rejected")
    await db.bookings.update_one({"_id": bid}, {"$set": {"status": "REJECTED",
                                 "cancellation_reason": body.reason or "Rejected by owner", "updated_at": now()}})
    await db.payments.update_one({"booking_id": bid}, {"$set": {"status": "CANCELLED", "updated_at": now()}})
    await _free_slots(b)
    await notify(b["customer_id"], "booking_rejected", "Booking rejected",
                 f"Your booking at {b['facility_name']} was rejected", {"booking_id": bid})
    await write_audit(user, "booking_rejected", "bookings", bid, request)
    return ser(await db.bookings.find_one({"_id": bid}))


@router.post("/bookings/{bid}/complete")
async def complete_booking(bid: str, request: Request, user: dict = Depends(current_user)):
    b = await _owner_booking(bid, user, "bookings.update")
    if b["status"] != "CONFIRMED":
        raise HTTPException(400, "Only confirmed bookings can be completed")
    await db.bookings.update_one({"_id": bid}, {"$set": {"status": "COMPLETED", "payment_status": "PAID", "updated_at": now()}})
    await db.payments.update_one({"booking_id": bid}, {"$set": {"status": "PAID", "updated_at": now()}})
    await write_audit(user, "booking_completed", "bookings", bid, request)
    return ser(await db.bookings.find_one({"_id": bid}))


@router.post("/bookings/{bid}/no-show")
async def no_show(bid: str, request: Request, user: dict = Depends(current_user)):
    b = await _owner_booking(bid, user, "bookings.update")
    if b["status"] != "CONFIRMED":
        raise HTTPException(400, "Only confirmed bookings can be marked no-show")
    await db.bookings.update_one({"_id": bid}, {"$set": {"status": "NO_SHOW", "updated_at": now()}})
    await write_audit(user, "booking_no_show", "bookings", bid, request)
    return ser(await db.bookings.find_one({"_id": bid}))


async def _owner_booking(bid: str, user: dict, permission: str):
    b = await db.bookings.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "Booking not found")
    facility = await db.facilities.find_one({"_id": b["facility_id"]})
    await assert_facility_access(user, facility, permission)
    return b
