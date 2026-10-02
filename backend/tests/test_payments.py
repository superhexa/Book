"""اختبارات المدفوعات — Payments tests.

Contract (the payments hardening workstream owns the routes; these tests pin
the state machine + webhook trust rules from the spec):

- payment statuses: PENDING → PAID / FAILED / EXPIRED / CANCELLED;
  PAID → REFUNDED / PARTIALLY_REFUNDED; PARTIALLY_REFUNDED → REFUNDED.
  Terminal states never transition.
- the webhook NEVER trusts the frontend: the signature is verified, the
  amount is recomputed from the booking server-side, and the new status is
  derived from the provider event type only — a client-supplied ``status``
  field is ignored.
- a refund inserts a row in ``refunds`` and an ``audit_logs`` entry
  (``payment_refunded``), and moves the payment to REFUNDED/PARTIALLY_REFUNDED.
"""
import asyncio
import hashlib
import hmac
import json

import pytest

import fakes
from fakes import new_test_db, patch_modules

import audit
import db as dbmod
import engines


# ------------------- reference implementation (spec contract) ---------------
class PaymentTransitionError(Exception):
    pass


class WebhookVerificationError(Exception):
    pass


PAYMENT_TRANSITIONS = {
    # (current_status, provider_event) -> new_status
    ("PENDING", "payment.succeeded"): "PAID",
    ("PENDING", "payment.failed"): "FAILED",
    ("PENDING", "payment.expired"): "EXPIRED",
    ("PENDING", "booking.cancelled_unpaid"): "CANCELLED",
    ("PAID", "refund.full"): "REFUNDED",
    ("PAID", "refund.partial"): "PARTIALLY_REFUNDED",
    ("PARTIALLY_REFUNDED", "refund.full"): "REFUNDED",
}


def apply_payment_event(current_status, event):
    """Return the new status for a provider event, or raise."""
    try:
        return PAYMENT_TRANSITIONS[(current_status, event)]
    except KeyError:
        raise PaymentTransitionError(
            f"illegal transition: {current_status} + {event}")


def _canonical(payload):
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def sign_payload(payload, secret):
    return hmac.new(secret.encode(), _canonical(payload).encode(),
                    hashlib.sha256).hexdigest()


def handle_payment_webhook(payload, signature, secret, booking, current_status):
    """Process a provider webhook. Never trusts the frontend:

    1. HMAC signature over the canonical payload must verify.
    2. ``amount``/``currency`` are recomputed from the server-side booking —
       a mismatch is rejected (the client amount is ignored, not applied).
    3. the new status comes ONLY from the provider event ``type``; a
       client-supplied ``status`` field is ignored.
    """
    if booking is None:
        raise WebhookVerificationError("unknown booking")
    expected = sign_payload(payload, secret)
    if not hmac.compare_digest(expected, signature or ""):
        raise WebhookVerificationError("invalid signature")
    if (abs(float(payload["amount"]) - float(booking["final_amount"])) > 0.009
            or payload.get("currency") != booking.get("currency")):
        raise WebhookVerificationError(
            "amount/currency mismatch with server-side booking — refusing")
    return apply_payment_event(current_status, payload["type"])


async def _refunded_total(db, payment_id):
    total = 0.0
    async for r in db.refunds.find({"payment_id": payment_id, "status": "COMPLETED"}):
        total += r["amount"]
    return total


async def issue_refund(db, payment_id, amount, actor, reason=""):
    """Create a refund record + audit log and move the payment state."""
    payment = await db.payments.find_one({"_id": payment_id})
    if not payment:
        raise PaymentTransitionError("payment not found")
    if payment["status"] not in ("PAID", "PARTIALLY_REFUNDED"):
        raise PaymentTransitionError(
            f"cannot refund a {payment['status']} payment")
    if amount <= 0:
        raise PaymentTransitionError("refund amount must be positive")
    already = await _refunded_total(db, payment_id)
    if already + amount - float(payment.get("final_amount", payment["amount"])) > 0.009:
        raise PaymentTransitionError("refund exceeds paid amount")
    total = round(already + amount, 2)
    new_status = ("REFUNDED" if total >= float(payment.get("final_amount", payment["amount"])) - 0.009
                  else "PARTIALLY_REFUNDED")
    refund = {
        "_id": dbmod.new_id(), "payment_id": payment_id,
        "booking_id": payment.get("booking_id"), "amount": round(amount, 2),
        "currency": payment.get("currency", "JOD"), "reason": reason,
        "status": "COMPLETED", "created_at": dbmod.now(),
    }
    await db.refunds.insert_one(refund)
    await db.payments.update_one(
        {"_id": payment_id},
        {"$set": {"status": new_status, "refunded_total": total,
                  "updated_at": dbmod.now()}})
    await audit.write_audit(actor, "payment_refunded", "payments", payment_id,
                            None, before={"status": payment["status"]},
                            after={"status": new_status, "refund_amount": amount})
    return refund, new_status


# --------------------------------- tests -----------------------------------
@pytest.fixture()
def tdb(monkeypatch):
    fake = new_test_db()
    patch_modules(monkeypatch, fake, audit, engines)
    return fake


def _run(coro):
    return asyncio.run(coro)


async def _collect(cursor):
    return [d async for d in cursor]


def _booking(final_amount=50.0, currency="JOD"):
    return {"_id": dbmod.new_id(), "final_amount": final_amount,
            "currency": currency}


def _payment(status="PENDING", amount=50.0):
    return {"_id": dbmod.new_id(), "booking_id": dbmod.new_id(),
            "amount": amount, "final_amount": amount, "currency": "JOD",
            "status": status, "refunded_total": 0.0}


class TestStateMachine:
    @pytest.mark.parametrize("start,event,end", [
        ("PENDING", "payment.succeeded", "PAID"),
        ("PENDING", "payment.failed", "FAILED"),
        ("PENDING", "payment.expired", "EXPIRED"),
        ("PENDING", "booking.cancelled_unpaid", "CANCELLED"),
        ("PAID", "refund.full", "REFUNDED"),
        ("PAID", "refund.partial", "PARTIALLY_REFUNDED"),
        ("PARTIALLY_REFUNDED", "refund.full", "REFUNDED"),
    ])
    def test_legal_transitions(self, start, event, end):
        assert apply_payment_event(start, event) == end

    @pytest.mark.parametrize("start,event", [
        ("REFUNDED", "payment.succeeded"),   # terminal: never leaves REFUNDED
        ("CANCELLED", "payment.succeeded"),
        ("FAILED", "payment.succeeded"),
        ("PENDING", "refund.full"),          # cannot refund an unpaid payment
        ("PAID", "payment.succeeded"),       # no double-capture
        ("PARTIALLY_REFUNDED", "refund.partial"),  # second partial must be full
    ])
    def test_illegal_transitions_rejected(self, start, event):
        with pytest.raises(PaymentTransitionError):
            apply_payment_event(start, event)


class TestWebhookTrust:
    SECRET = "whsec-test-secret"

    def _payload(self, booking, event_type="payment.succeeded", **over):
        p = {"event_id": "evt_1", "type": event_type,
             "booking_id": booking["_id"], "amount": booking["final_amount"],
             "currency": booking["currency"]}
        p.update(over)
        return p

    def test_valid_webhook_marks_paid(self):
        booking = _booking()
        payload = self._payload(booking)
        assert handle_payment_webhook(
            payload, sign_payload(payload, self.SECRET), self.SECRET,
            booking, "PENDING") == "PAID"

    def test_tampered_amount_rejected(self):
        """Frontend sends amount=1.0 for a 50.0 booking → rejected, unchanged."""
        booking = _booking(final_amount=50.0)
        payload = self._payload(booking, amount=1.0)
        with pytest.raises(WebhookVerificationError):
            handle_payment_webhook(
                payload, sign_payload(payload, self.SECRET), self.SECRET,
                booking, "PENDING")

    def test_bad_signature_rejected(self):
        booking = _booking()
        payload = self._payload(booking)
        with pytest.raises(WebhookVerificationError):
            handle_payment_webhook(payload, "deadbeef", self.SECRET, booking, "PENDING")

    def test_client_status_field_ignored(self):
        """A payload claiming status=REFUNDED with a success event → PAID."""
        booking = _booking()
        payload = self._payload(booking, status="REFUNDED")
        assert handle_payment_webhook(
            payload, sign_payload(payload, self.SECRET), self.SECRET,
            booking, "PENDING") == "PAID"

    def test_unknown_booking_rejected(self):
        booking = _booking()
        payload = self._payload(booking)
        with pytest.raises(WebhookVerificationError):
            handle_payment_webhook(
                payload, sign_payload(payload, self.SECRET), self.SECRET,
                None, "PENDING")


class TestRefunds:
    def _actor(self):
        return {"_id": "admin1", "email": "admin@turfbook.com"}

    def test_full_refund_creates_record_and_audit(self, tdb):
        payment = _payment(status="PAID")
        _run(tdb.payments.insert_one(payment))
        refund, new_status = _run(issue_refund(
            tdb, payment["_id"], 50.0, self._actor(), reason="إلغاء من المالك"))
        assert new_status == "REFUNDED"
        stored = _run(tdb.refunds.find_one({"_id": refund["_id"]}))
        assert stored["amount"] == 50.0 and stored["status"] == "COMPLETED"
        assert _run(tdb.payments.find_one(
            {"_id": payment["_id"]}))["status"] == "REFUNDED"
        logs = _run(_collect(tdb.audit_logs.find({"action": "payment_refunded"})))
        assert len(logs) == 1 and logs[0]["resource_id"] == payment["_id"]

    def test_partial_refund(self, tdb):
        payment = _payment(status="PAID")
        _run(tdb.payments.insert_one(payment))
        _, new_status = _run(issue_refund(tdb, payment["_id"], 20.0, self._actor()))
        assert new_status == "PARTIALLY_REFUNDED"
        # remaining 30 can still be refunded → REFUNDED
        _, new_status2 = _run(issue_refund(tdb, payment["_id"], 30.0, self._actor()))
        assert new_status2 == "REFUNDED"

    def test_refund_unpaid_rejected(self, tdb):
        payment = _payment(status="PENDING")
        _run(tdb.payments.insert_one(payment))
        with pytest.raises(PaymentTransitionError):
            _run(issue_refund(tdb, payment["_id"], 10.0, self._actor()))
        assert _run(tdb.refunds.count_documents({})) == 0

    def test_double_refund_rejected(self, tdb):
        payment = _payment(status="PAID")
        _run(tdb.payments.insert_one(payment))
        _run(issue_refund(tdb, payment["_id"], 50.0, self._actor()))
        with pytest.raises(PaymentTransitionError):
            _run(issue_refund(tdb, payment["_id"], 5.0, self._actor()))

    def test_refund_exceeding_paid_amount_rejected(self, tdb):
        payment = _payment(status="PAID", amount=50.0)
        _run(tdb.payments.insert_one(payment))
        with pytest.raises(PaymentTransitionError):
            _run(issue_refund(tdb, payment["_id"], 60.0, self._actor()))


class TestRefundPolicyEngine:
    def test_free_cancellation_far_future(self):
        from datetime import timedelta
        date = (dbmod.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        booking = {"date": date, "start_min": 1080, "final_amount": 40.0}
        policy = {"free_cancellation_hours": 24, "partial_refund_hours": 6,
                  "partial_refund_percent": 50}
        out = engines.compute_refund(booking, policy)
        assert out["eligible"] and out["refund"] == 40.0 and out["rate"] == 100

    def test_no_refund_too_late(self):
        from datetime import timedelta
        near = dbmod.now() + timedelta(hours=1)
        booking = {"date": near.strftime("%Y-%m-%d"),
                   "start_min": near.hour * 60 + near.minute + 30,
                   "final_amount": 40.0}
        policy = {"free_cancellation_hours": 24, "partial_refund_hours": 6,
                  "partial_refund_percent": 50}
        out = engines.compute_refund(booking, policy)
        assert not out["eligible"] and out["refund"] == 0.0
