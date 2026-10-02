"""Payments: provider-agnostic collection, webhook confirmation, refunds.

State machine: PENDING -> AUTHORIZED -> PAID -> (REFUNDED | PARTIALLY_REFUNDED)
                    |-> FAILED | CANCELLED

Security rule: the frontend is NEVER trusted for payment success. Only
provider webhooks (signature-verified) or an explicit admin/owner confirmation
may move a payment to PAID. All user-facing errors are in Arabic.

Mount: app.include_router(routes_payments.router, prefix="/api")
"""
import hashlib
import hmac
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import config
from audit import write_audit
from db import db, new_id, now, ser, ser_many
from notify import notify
from security import assert_facility_access, current_user, is_super_admin

router = APIRouter(tags=["payments"])

PAYMENT_METHODS = ("online", "cash", "pay_on_arrival")

TERMINAL_PAYMENT_STATUSES = {"PAID", "FAILED", "REFUNDED", "CANCELLED"}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class InitiateBody(BaseModel):
    booking_id: str
    method: str = "cash"  # online | cash | pay_on_arrival
    provider: Optional[str] = None  # e.g. stripe | tap | paypal
    idempotency_key: Optional[str] = None
    return_url: Optional[str] = None


class RefundBody(BaseModel):
    amount: Optional[float] = None  # default: full remaining refundable
    reason: str = Field(default="", max_length=500)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _booking_for_payer(booking_id: str, user: dict) -> dict:
    b = await db.bookings.find_one({"_id": booking_id, "deleted_at": None})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b["customer_id"] != user["_id"] and b["owner_id"] != user["_id"] \
            and not is_super_admin(user):
        raise HTTPException(403, "لا تملك صلاحية الدفع لهذا الحجز")
    return b


def _webhook_secrets() -> dict:
    return getattr(config, "PAYMENT_WEBHOOK_SECRETS", {}) or {}


def verify_webhook_signature(provider: str, raw_body: bytes, signature: Optional[str]) -> bool:
    """HMAC-SHA256 signature check.

    This is a structural stub: it enforces verification whenever a secret is
    configured for the provider and REJECTS the webhook otherwise (fail-closed).
    Configure PAYMENT_WEBHOOK_SECRETS = {provider: secret} in config to enable
    a provider. Per-provider header/payload parsing belongs here as providers
    are integrated.
    """
    secret = _webhook_secrets().get(provider)
    if not secret:
        # No secret configured -> we cannot verify -> reject (fail closed).
        return False
    if not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    # Accept "sha256=<hex>" or raw hex.
    sig = signature.removeprefix("sha256=").strip()
    return hmac.compare_digest(expected, sig)


def map_provider_status(raw: str) -> Optional[str]:
    s = (raw or "").strip().lower()
    if s in ("succeeded", "success", "paid", "captured", "completed", "approved"):
        return "PAID"
    if s in ("authorized", "pending_capture", "requires_capture"):
        return "AUTHORIZED"
    if s in ("failed", "error", "declined"):
        return "FAILED"
    if s == "refunded":
        return "REFUNDED"
    if s == "partially_refunded":
        return "PARTIALLY_REFUNDED"
    if s in ("canceled", "cancelled", "voided", "expired"):
        return "CANCELLED"
    return None


async def _set_payment_status(payment: dict, to_status: str, *, provider_payment_id=None,
                              event: dict = None, actor=None, request=None) -> dict:
    """Atomic status move, only from non-terminal states. Returns fresh doc."""
    allowed_from = ["PENDING", "AUTHORIZED"] if to_status in ("PAID", "AUTHORIZED") \
        else ["PENDING", "AUTHORIZED", "PAID", "PARTIALLY_REFUNDED", "FAILED"]
    update = {"status": to_status, "updated_at": now()}
    if provider_payment_id:
        update["provider_payment_id"] = provider_payment_id
    res = await db.payments.find_one_and_update(
        {"_id": payment["_id"], "status": {"$in": allowed_from}},
        {"$set": update,
         **({"$push": {"webhook_events": event}} if event else {})},
        return_document=True)
    if res is None:
        # Already in a terminal state -> treat as duplicate delivery.
        return await db.payments.find_one({"_id": payment["_id"]})
    # Mirror onto the booking for quick reads.
    await db.bookings.update_one(
        {"_id": payment["booking_id"]},
        {"$set": {"payment_status": to_status, "updated_at": now()}})
    await write_audit(actor, "payment_status_changed", "payments", payment["_id"],
                      request, before={"status": payment["status"]},
                      after={"status": to_status})
    return res


# ---------------------------------------------------------------------------
# Initiate
# ---------------------------------------------------------------------------
@router.post("/payments/initiate")
async def initiate_payment(body: InitiateBody, request: Request,
                           user: dict = Depends(current_user)):
    if body.method not in PAYMENT_METHODS:
        raise HTTPException(400, "طريقة الدفع غير مدعومة")
    b = await _booking_for_payer(body.booking_id, user)
    if b["status"] not in ("PENDING", "CONFIRMED"):
        raise HTTPException(409, "لا يمكن الدفع لحجز بهذه الحالة")
    facility = await db.facilities.find_one({"_id": b["facility_id"]})
    allowed = (facility or {}).get("payment_methods") or ["cash", "pay_on_arrival"]
    if body.method not in allowed:
        raise HTTPException(400, "طريقة الدفع غير متاحة لهذه المنشأة")

    # Idempotency: an existing open payment for the same booking+method is reused.
    existing = await db.payments.find_one({
        "booking_id": b["_id"], "method": body.method,
        "status": {"$in": ["PENDING", "AUTHORIZED"]}})
    if existing:
        return {**ser(existing), "reused": True}
    paid = await db.payments.find_one({"booking_id": b["_id"], "status": "PAID"})
    if paid:
        raise HTTPException(409, "تم دفع هذا الحجز مسبقاً")

    provider = body.provider or (facility or {}).get("payment_provider")
    if body.method == "online" and not provider:
        provider = "online"
    t = now()
    payment = {
        "_id": new_id(),
        "idempotency_key": body.idempotency_key or f"{b['_id']}:{body.method}",
        "booking_id": b["_id"],
        "booking_ref": b.get("ref"),
        "customer_id": b["customer_id"],
        "facility_id": b["facility_id"],
        "amount": float(b["final_amount"]),
        "currency": b.get("currency") or "JOD",
        "method": body.method,
        "provider": provider or "cash",
        "provider_payment_id": None,
        "status": "PENDING",
        "refunded_amount": 0.0,
        "return_url": body.return_url,
        "webhook_events": [],
        "created_at": t,
        "updated_at": t,
    }
    try:
        await db.payments.insert_one(payment)
    except DuplicateKeyError:
        existing = await db.payments.find_one(
            {"idempotency_key": payment["idempotency_key"]})
        return {**ser(existing), "reused": True}

    await write_audit(user, "payment_initiated", "payments", payment["_id"], request,
                      after={"booking_id": b["_id"], "amount": payment["amount"],
                             "method": body.method})

    response = {**ser(payment), "reused": False}
    if body.method == "online":
        # Provider checkout integration goes here (create session/intent and
        # return its URL). Until a provider is wired, the payment stays PENDING
        # and only a verified webhook (or admin confirm) can mark it PAID.
        response["provider_integration"] = "stub"
        if not (facility or {}).get("payment_provider"):
            response["notice"] = "الدفع الإلكتروني غير مفعّل لهذه المنشأة بعد"
    return response


@router.get("/payments/by-booking/{bid}")
async def payments_for_booking(bid: str, user: dict = Depends(current_user)):
    b = await _booking_for_payer(bid, user)
    docs = await db.payments.find({"booking_id": b["_id"]}) \
        .sort("created_at", -1).to_list(20)
    return ser_many(docs)


@router.get("/payments/{pid}")
async def get_payment(pid: str, user: dict = Depends(current_user)):
    p = await db.payments.find_one({"_id": pid})
    if not p:
        raise HTTPException(404, "الدفعة غير موجودة")
    await _booking_for_payer(p["booking_id"], user)
    return ser(p)


# ---------------------------------------------------------------------------
# Webhook (the ONLY trusted source of online-payment success, besides admin)
# ---------------------------------------------------------------------------
@router.post("/payments/webhook/{provider}")
async def payment_webhook(provider: str, request: Request):
    raw = await request.body()
    signature = request.headers.get("x-signature") \
        or request.headers.get("x-webhook-signature") \
        or request.headers.get("stripe-signature")
    if not verify_webhook_signature(provider, raw, signature):
        # Fail closed: never apply an unverifiable webhook.
        raise HTTPException(401, "توقيع الـ webhook غير صالح أو غير مهيأ")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "بيانات الـ webhook غير صالحة")

    event_id = payload.get("id") or payload.get("event_id") or "unknown"
    data = payload.get("data") or payload
    obj = data.get("object") or data
    meta = obj.get("metadata") or {}
    payment_id = meta.get("payment_id") or obj.get("payment_id") or payload.get("payment_id")
    provider_payment_id = obj.get("id") or payload.get("provider_payment_id")
    raw_status = obj.get("status") or payload.get("status") or ""
    to_status = map_provider_status(str(raw_status))
    if not to_status:
        raise HTTPException(400, "حالة الدفع الواردة غير معروفة")

    payment = None
    if payment_id:
        payment = await db.payments.find_one({"_id": payment_id})
    if not payment and provider_payment_id:
        payment = await db.payments.find_one({"provider_payment_id": provider_payment_id})
    if not payment:
        raise HTTPException(404, "لا يمكن مطابقة الدفعة مع أي سجل")

    # Webhook idempotency: ignore already-processed events.
    if any(e.get("event_id") == event_id for e in payment.get("webhook_events", [])):
        return {"ok": True, "duplicate": True}

    event = {"event_id": event_id, "provider": provider,
             "raw_status": str(raw_status), "at": now()}
    updated = await _set_payment_status(
        payment, to_status, provider_payment_id=provider_payment_id, event=event)

    if to_status == "PAID":
        booking = await db.bookings.find_one({"_id": payment["booking_id"]})
        if booking:
            await notify(booking["customer_id"], "payment_confirmed", "تم تأكيد الدفع",
                         f"تم استلام دفعة حجزك في {booking['facility_name']}",
                         {"booking_id": booking["_id"], "payment_id": payment["_id"]})
    return {"ok": True, "payment_id": payment["_id"], "status": updated["status"]}


# ---------------------------------------------------------------------------
# Admin / owner confirmation (cash collected on site, manual verification)
# ---------------------------------------------------------------------------
@router.post("/payments/{pid}/confirm")
async def confirm_payment(pid: str, request: Request, user: dict = Depends(current_user)):
    """Owner/staff/admin confirms a non-online payment (e.g. cash received).
    This is the manual counterpart to the webhook path."""
    p = await db.payments.find_one({"_id": pid})
    if not p:
        raise HTTPException(404, "الدفعة غير موجودة")
    facility = await db.facilities.find_one({"_id": p["facility_id"]})
    await assert_facility_access(user, facility, "bookings.update")
    if p["method"] == "online":
        raise HTTPException(
            400, "الدفع الإلكتروني يُعتمد عبر الـ webhook فقط، وليس يدوياً")
    if p["status"] == "PAID":
        return ser(p)
    if p["status"] not in ("PENDING", "AUTHORIZED"):
        raise HTTPException(400, "لا يمكن تأكيد دفعة بهذه الحالة")
    updated = await _set_payment_status(p, "PAID", actor=user, request=request)
    booking = await db.bookings.find_one({"_id": p["booking_id"]})
    if booking:
        await notify(booking["customer_id"], "payment_confirmed", "تم تأكيد الدفع",
                     f"تم تأكيد دفعة حجزك في {booking['facility_name']}",
                     {"booking_id": booking["_id"], "payment_id": pid})
    return ser(updated)


# ---------------------------------------------------------------------------
# Refunds
# ---------------------------------------------------------------------------
@router.post("/payments/{pid}/refund")
async def refund_payment(pid: str, body: RefundBody, request: Request,
                         user: dict = Depends(current_user)):
    """Issue a refund. Requires the ``payments.refund`` permission (facility
    owners and platform admins). Writes to the ``refunds`` collection and is
    fully audit-logged. For cash/manual the refund completes immediately; for
    online providers the record stays PROCESSING until the provider settles it
    (provider refund integration is a stub)."""
    p = await db.payments.find_one({"_id": pid})
    if not p:
        raise HTTPException(404, "الدفعة غير موجودة")
    facility = await db.facilities.find_one({"_id": p["facility_id"]})
    await assert_facility_access(user, facility, "payments.refund")

    if p["status"] not in ("PAID", "PARTIALLY_REFUNDED"):
        raise HTTPException(400, "لا يمكن استرداد دفعة غير مكتملة")
    refunded_so_far = float(p.get("refunded_amount") or 0.0)
    remaining = round(float(p["amount"]) - refunded_so_far, 2)
    amount = round(float(body.amount), 2) if body.amount is not None else remaining
    if amount <= 0 or amount - remaining > 1e-9:
        raise HTTPException(400, "مبلغ الاسترداد غير صالح")
    if not body.reason or len(body.reason.strip()) < 3:
        raise HTTPException(400, "يجب ذكر سبب الاسترداد")

    is_manual = p["provider"] in ("cash", "manual") or p["method"] in ("cash", "pay_on_arrival")
    t = now()
    refund = {
        "_id": new_id(),
        "payment_id": pid,
        "booking_id": p["booking_id"],
        "customer_id": p["customer_id"],
        "facility_id": p["facility_id"],
        "amount": amount,
        "currency": p.get("currency") or "JOD",
        "reason": body.reason.strip(),
        # PROCESSING = waiting on the online provider; COMPLETED = cash/manual.
        "status": "COMPLETED" if is_manual else "PROCESSING",
        "provider_refund_id": None,
        "note": None if is_manual else "بانتظار تنفيذ الاسترداد عبر بوابة الدفع",
        "created_by": user["_id"],
        "created_at": t,
        "updated_at": t,
    }
    await db.refunds.insert_one(refund)

    new_refunded = round(refunded_so_far + amount, 2)
    new_status = "REFUNDED" if new_refunded >= float(p["amount"]) - 1e-9 else "PARTIALLY_REFUNDED"
    await db.payments.update_one({"_id": pid}, {"$set": {
        "refunded_amount": new_refunded, "status": new_status, "updated_at": t}})
    booking = await db.bookings.find_one({"_id": p["booking_id"]})
    if booking:
        await db.bookings.update_one({"_id": booking["_id"]}, {"$set": {
            "refund_amount": round(float(booking.get("refund_amount") or 0.0) + amount, 2),
            "payment_status": new_status, "updated_at": t}})

    await write_audit(user, "payment_refunded", "refunds", refund["_id"], request,
                      before={"payment_status": p["status"], "refunded": refunded_so_far},
                      after={"payment_status": new_status, "refunded": new_refunded,
                             "refund_amount": amount})
    if booking:
        await notify(booking["customer_id"], "payment_refunded", "تم إصدار استرداد",
                     f"تم إصدار استرداد بمبلغ {amount} د.أ لحجزك في {booking['facility_name']}",
                     {"booking_id": booking["_id"], "refund_id": refund["_id"]})
    return {**ser(refund), "payment_status": new_status}
