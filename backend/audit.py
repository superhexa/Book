"""Audit logging. Records are append-only; there is no update/delete endpoint."""
from typing import Optional

from fastapi import Request

from db import db, new_id, now


async def write_audit(
    actor: Optional[dict],
    action: str,
    resource: str,
    resource_id: Optional[str] = None,
    request: Optional[Request] = None,
    before=None,
    after=None,
):
    """Write one append-only audit record.

    Captures: actor (id + email), action, resource, resource_id, timestamp
    (`created_at`), client IP, user-agent, and prev/new state (before/after).
    """
    doc = {
        "_id": new_id(),
        "actor_id": actor.get("_id") if actor else None,
        "actor_email": actor.get("email") if actor else None,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "before": before,
        "after": after,
        "ip": (request.client.host if request and request.client else None),
        "user_agent": (request.headers.get("user-agent") if request else None),
        "created_at": now(),
    }
    await db.audit_logs.insert_one(doc)
    return doc


async def audit_booking_override(
    actor: Optional[dict],
    booking_id: str,
    before,
    after,
    request: Optional[Request] = None,
    reason: Optional[str] = None,
):
    """Audit an admin/staff override of a booking (status, time, pitch, price...)."""
    return await write_audit(
        actor,
        "booking.override",
        "booking",
        booking_id,
        request=request,
        before=before,
        after={"state": after, "reason": reason} if reason else after,
    )


async def audit_refund(
    actor: Optional[dict],
    booking_id: str,
    amount: float,
    currency: str = "JOD",
    request: Optional[Request] = None,
    reason: Optional[str] = None,
    payment_id: Optional[str] = None,
):
    """Audit a refund issued against a booking/payment."""
    return await write_audit(
        actor,
        "payment.refund",
        "booking",
        booking_id,
        request=request,
        after={
            "amount": amount,
            "currency": currency,
            "reason": reason,
            "payment_id": payment_id,
        },
    )


async def audit_role_change(
    actor: Optional[dict],
    target_user_id: str,
    before_role: Optional[str],
    after_role: str,
    request: Optional[Request] = None,
):
    """Audit a change to a user's role (privilege escalation sensitive)."""
    return await write_audit(
        actor,
        "user.role_change",
        "user",
        target_user_id,
        request=request,
        before={"role": before_role},
        after={"role": after_role},
    )
