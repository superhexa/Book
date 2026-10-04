from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from notify import notify
from rbac import (ALL_PERMISSIONS, DEFAULT_ROLE_KEYS, ORG_PERMISSIONS,
                  PERMISSION_GROUPS)
from security import current_user, is_super_admin, require_permission

router = APIRouter(prefix="/admin", tags=["admin"])


# =============================== overview ==================================
@router.get("/overview")
async def overview(user: dict = Depends(require_permission("analytics.read"))):
    users_total = await db.users.count_documents({"deleted_at": None})
    active_users = await db.users.count_documents({"deleted_at": None, "is_active": True})
    owners = await db.users.count_documents({"deleted_at": None, "roles": "owner"})
    verified = await db.facilities.count_documents({"deleted_at": None, "status": "VERIFIED"})
    pending = await db.facilities.count_documents({"deleted_at": None, "status": "PENDING_REVIEW"})
    bookings_total = await db.bookings.count_documents({"deleted_at": None})
    revenue_states = {"CONFIRMED", "COMPLETED", "NO_SHOW"}
    revenue = 0.0
    refunds = 0.0
    cancels = 0
    async for b in db.bookings.find({"deleted_at": None}):
        if b["status"] in revenue_states:
            revenue += b["final_amount"]
        if b["status"] in ("CANCELLED", "REJECTED"):
            cancels += 1
        refunds += b.get("refund_amount", 0) or 0
    reported_reviews = await db.reviews.count_documents({"reported": True, "deleted_at": None})
    return {
        "users_total": users_total, "active_users": active_users, "owners": owners,
        "facilities_verified": verified, "facilities_pending": pending,
        "bookings_total": bookings_total, "revenue": round(revenue, 2),
        "refunds": round(refunds, 2), "cancellations": cancels,
        "reported_reviews": reported_reviews, "system_health": "operational",
    }


@router.get("/analytics")
async def admin_analytics(user: dict = Depends(require_permission("analytics.read"))):
    from collections import defaultdict
    from datetime import timedelta
    bookings = await db.bookings.find({"deleted_at": None}).to_list(50000)
    revenue_states = {"CONFIRMED", "COMPLETED", "NO_SHOW"}
    today = now().date()
    rev_series, book_series = [], []
    for i in range(29, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        day = [b for b in bookings if b["date"] == d]
        rev_series.append({"date": d, "value": round(sum(b["final_amount"] for b in day if b["status"] in revenue_states), 2)})
        book_series.append({"date": d, "value": len(day)})
    # new facilities over time (last 30d by created date)
    fac = await db.facilities.find({"deleted_at": None}).to_list(50000)
    cancelled = len([b for b in bookings if b["status"] in ("CANCELLED", "REJECTED")])
    return {
        "revenue_series": rev_series, "booking_series": book_series,
        "total_bookings": len(bookings), "total_facilities": len(fac),
        "cancellation_count": cancelled,
        "cancellation_rate": round(cancelled / len(bookings) * 100, 1) if bookings else 0,
    }


# =============================== users =====================================
@router.get("/users")
async def list_users(q: Optional[str] = None, role: Optional[str] = None,
                     status_filter: Optional[str] = Query(None, alias="status"),
                     page: int = 1, limit: int = 20,
                     user: dict = Depends(require_permission("users.read"))):
    query = {"deleted_at": None}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]
    if role:
        query["roles"] = role
    if status_filter == "active":
        query["is_active"] = True
    elif status_filter == "suspended":
        query["is_active"] = False
    total = await db.users.count_documents(query)
    docs = await db.users.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


@router.get("/users/{uid}")
async def get_user(uid: str, user: dict = Depends(require_permission("users.read"))):
    u = await db.users.find_one({"_id": uid, "deleted_at": None})
    if not u:
        raise HTTPException(404, "User not found")
    out = ser(u)
    out["bookings_count"] = await db.bookings.count_documents({"customer_id": uid})
    out["facilities_count"] = await db.facilities.count_documents({"owner_id": uid, "deleted_at": None})
    out["recent_activity"] = ser_many(await db.audit_logs.find({"actor_id": uid}).sort("created_at", -1).to_list(20))
    return out


class StatusBody(BaseModel):
    is_active: bool


@router.patch("/users/{uid}/status")
async def set_user_status(uid: str, body: StatusBody, request: Request,
                          user: dict = Depends(require_permission("users.update"))):
    u = await db.users.find_one({"_id": uid, "deleted_at": None})
    if not u:
        raise HTTPException(404, "User not found")
    if "super_admin" in u.get("roles", []) and not is_super_admin(user):
        raise HTTPException(403, "Cannot modify a super admin")
    update = {"is_active": body.is_active, "updated_at": now()}
    if not body.is_active:
        update["password_version"] = u.get("password_version", 0) + 1  # revoke sessions
    await db.users.update_one({"_id": uid}, {"$set": update})
    if not body.is_active:
        await db.sessions.update_many({"user_id": uid}, {"$set": {"revoked_at": now()}})
    await write_audit(user, "user_suspended" if not body.is_active else "user_activated",
                      "users", uid, request, before={"is_active": u.get("is_active")},
                      after={"is_active": body.is_active})
    return ser(await db.users.find_one({"_id": uid}))


class RolesBody(BaseModel):
    roles: list


@router.put("/users/{uid}/roles")
async def set_user_roles(uid: str, body: RolesBody, request: Request,
                         user: dict = Depends(require_permission("permissions.assign"))):
    u = await db.users.find_one({"_id": uid, "deleted_at": None})
    if not u:
        raise HTTPException(404, "User not found")
    valid_roles = [r["_id"] async for r in db.roles.find({})]
    roles = [r for r in body.roles if r in valid_roles]
    if "super_admin" in roles and not is_super_admin(user):
        raise HTTPException(403, "Only a super admin can grant the super admin role")
    await db.users.update_one({"_id": uid}, {"$set": {"roles": roles, "updated_at": now()}})
    await write_audit(user, "role_changed", "users", uid, request,
                      before={"roles": u.get("roles")}, after={"roles": roles})
    return ser(await db.users.find_one({"_id": uid}))


# =============================== facility verification =====================
@router.get("/facilities")
async def admin_facilities(status_filter: Optional[str] = Query(None, alias="status"),
                           q: Optional[str] = None, page: int = 1, limit: int = 20,
                           user: dict = Depends(require_permission("fields.read"))):
    query = {"deleted_at": None}
    if status_filter:
        query["status"] = status_filter
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    total = await db.facilities.count_documents(query)
    docs = await db.facilities.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    out = []
    for f in docs:
        f = ser(f)
        owner = await db.users.find_one({"_id": f["owner_id"]})
        f["owner_name"] = owner.get("name") if owner else None
        f["owner_email"] = owner.get("email") if owner else None
        f["pitch_count"] = await db.pitches.count_documents({"facility_id": f["id"], "deleted_at": None})
        out.append(f)
    return {"items": out, "total": total, "page": page, "limit": limit}


class VerifyBody(BaseModel):
    reason: str = ""


@router.post("/facilities/{fid}/verify")
async def verify_facility(fid: str, request: Request, user: dict = Depends(require_permission("fields.verify"))):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    if not f:
        raise HTTPException(404, "Facility not found")
    await db.facilities.update_one({"_id": fid}, {"$set": {"status": "VERIFIED", "rejection_reason": None, "updated_at": now()}})
    await notify(f["owner_id"], "facility_verified", "Facility verified",
                 f"{f['name']} is now live on the platform", {"facility_id": fid})
    await write_audit(user, "field_verified", "facilities", fid, request,
                      before={"status": f["status"]}, after={"status": "VERIFIED"})
    return ser(await db.facilities.find_one({"_id": fid}))


@router.post("/facilities/{fid}/reject")
async def reject_facility(fid: str, body: VerifyBody, request: Request,
                          user: dict = Depends(require_permission("fields.verify"))):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    if not f:
        raise HTTPException(404, "Facility not found")
    await db.facilities.update_one({"_id": fid}, {"$set": {"status": "REJECTED", "rejection_reason": body.reason, "updated_at": now()}})
    await notify(f["owner_id"], "facility_rejected", "Facility rejected", body.reason or "See details", {"facility_id": fid})
    await write_audit(user, "field_rejected", "facilities", fid, request, after={"reason": body.reason})
    return ser(await db.facilities.find_one({"_id": fid}))


@router.post("/facilities/{fid}/suspend")
async def suspend_facility(fid: str, body: VerifyBody, request: Request,
                           user: dict = Depends(require_permission("fields.verify"))):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    if not f:
        raise HTTPException(404, "Facility not found")
    await db.facilities.update_one({"_id": fid}, {"$set": {"status": "SUSPENDED", "rejection_reason": body.reason, "updated_at": now()}})
    await write_audit(user, "field_suspended", "facilities", fid, request)
    return ser(await db.facilities.find_one({"_id": fid}))


# =============================== bookings / payments =======================
@router.get("/bookings")
async def admin_bookings(status_filter: Optional[str] = Query(None, alias="status"),
                         q: Optional[str] = None, page: int = 1, limit: int = 30,
                         user: dict = Depends(require_permission("bookings.read"))):
    query = {"deleted_at": None}
    if status_filter:
        query["status"] = status_filter
    if q:
        query["$or"] = [{"ref": {"$regex": q, "$options": "i"}}, {"customer_name": {"$regex": q, "$options": "i"}}]
    total = await db.bookings.count_documents(query)
    docs = await db.bookings.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


class OverrideBody(BaseModel):
    status: str
    reason: str = ""


@router.post("/bookings/{bid}/override")
async def override_booking(bid: str, body: OverrideBody, request: Request,
                           user: dict = Depends(require_permission("bookings.override"))):
    b = await db.bookings.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "Booking not found")
    valid = {"PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW", "EXPIRED"}
    if body.status not in valid:
        raise HTTPException(400, "Invalid status")
    if body.status in ("CANCELLED", "REJECTED", "EXPIRED"):
        await db.slot_reservations.delete_many({"booking_id": bid})
    await db.bookings.update_one({"_id": bid}, {"$set": {"status": body.status, "updated_at": now(),
                                 "cancellation_reason": body.reason or b.get("cancellation_reason")}})
    await write_audit(user, "booking_overridden", "bookings", bid, request,
                      before={"status": b["status"]}, after={"status": body.status})
    return ser(await db.bookings.find_one({"_id": bid}))


@router.get("/payments")
async def admin_payments(page: int = 1, limit: int = 30, user: dict = Depends(require_permission("payments.read"))):
    total = await db.payments.count_documents({})
    docs = await db.payments.find({}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


class RefundBody(BaseModel):
    amount: Optional[float] = None


@router.post("/payments/{pid}/refund")
async def refund_payment(pid: str, body: RefundBody, request: Request,
                         user: dict = Depends(require_permission("payments.refund"))):
    p = await db.payments.find_one({"_id": pid})
    if not p:
        raise HTTPException(404, "Payment not found")
    amount = body.amount if body.amount is not None else p["amount"]
    status_new = "REFUNDED" if amount >= p["amount"] else "PARTIALLY_REFUNDED"
    await db.payments.update_one({"_id": pid}, {"$set": {"status": status_new, "refund_amount": amount, "updated_at": now()}})
    await db.bookings.update_one({"_id": p["booking_id"]}, {"$set": {"payment_status": status_new, "refund_amount": amount}})
    await write_audit(user, "refund_created", "payments", pid, request, after={"amount": amount})
    return ser(await db.payments.find_one({"_id": pid}))


# =============================== reviews moderation ========================
@router.get("/reviews")
async def admin_reviews(reported: bool = False, user: dict = Depends(require_permission("reviews.read"))):
    query = {"deleted_at": None}
    if reported:
        query["reported"] = True
    return ser_many(await db.reviews.find(query).sort("created_at", -1).to_list(500))


@router.post("/reviews/{rid}/hide")
async def hide_review(rid: str, request: Request, user: dict = Depends(require_permission("reviews.moderate"))):
    r = await db.reviews.find_one({"_id": rid, "deleted_at": None})
    if not r:
        raise HTTPException(404, "Review not found")
    await db.reviews.update_one({"_id": rid}, {"$set": {"hidden": True, "reported": False}})
    await write_audit(user, "review_hidden", "reviews", rid, request)
    from routes_engagement import _recalc_rating
    await _recalc_rating(r["facility_id"])
    return {"message": "Review hidden"}


@router.post("/reviews/{rid}/unhide")
async def unhide_review(rid: str, user: dict = Depends(require_permission("reviews.moderate"))):
    r = await db.reviews.find_one({"_id": rid, "deleted_at": None})
    if not r:
        raise HTTPException(404, "Review not found")
    await db.reviews.update_one({"_id": rid}, {"$set": {"hidden": False}})
    from routes_engagement import _recalc_rating
    await _recalc_rating(r["facility_id"])
    return {"message": "Review restored"}


# =============================== audit logs ================================
@router.get("/audit-logs")
async def audit_logs(action: Optional[str] = None, page: int = 1, limit: int = 40,
                     user: dict = Depends(require_permission("audit_logs.read"))):
    query = {}
    if action:
        query["action"] = action
    total = await db.audit_logs.count_documents(query)
    docs = await db.audit_logs.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


# =============================== roles & permissions =======================
@router.get("/permissions")
async def list_permissions(user: dict = Depends(require_permission("permissions.read"))):
    return {"groups": PERMISSION_GROUPS, "all": ALL_PERMISSIONS, "org": ORG_PERMISSIONS}


@router.get("/roles")
async def list_roles(user: dict = Depends(require_permission("roles.read"))):
    return ser_many(await db.roles.find({}).sort("is_system", -1).to_list(200))


class RoleBody(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: str = ""
    permissions: list = []


@router.post("/roles", status_code=201)
async def create_role(body: RoleBody, request: Request, user: dict = Depends(require_permission("roles.create"))):
    key = body.name.lower().replace(" ", "_")
    if await db.roles.find_one({"_id": key}):
        raise HTTPException(409, "A role with this name already exists")
    perms = [p for p in body.permissions if p in ALL_PERMISSIONS]
    doc = {"_id": key, "key": key, "name": body.name, "description": body.description,
           "permissions": perms, "is_system": False, "editable": True, "created_at": now()}
    await db.roles.insert_one(doc)
    await write_audit(user, "role_created", "roles", key, request, after={"permissions": perms})
    return ser(doc)


@router.patch("/roles/{key}")
async def update_role(key: str, body: dict, request: Request, user: dict = Depends(require_permission("roles.update"))):
    role = await db.roles.find_one({"_id": key})
    if not role:
        raise HTTPException(404, "Role not found")
    if role.get("is_system") and not role.get("editable"):
        raise HTTPException(400, "This system role cannot be edited")
    updates = {}
    if "permissions" in body:
        updates["permissions"] = [p for p in body["permissions"] if p in ALL_PERMISSIONS]
    if "name" in body and not role.get("is_system"):
        updates["name"] = body["name"]
    if "description" in body:
        updates["description"] = body["description"]
    await db.roles.update_one({"_id": key}, {"$set": updates})
    await write_audit(user, "role_updated", "roles", key, request,
                      before={"permissions": role.get("permissions")}, after=updates)
    return ser(await db.roles.find_one({"_id": key}))


@router.delete("/roles/{key}")
async def delete_role(key: str, request: Request, user: dict = Depends(require_permission("roles.delete"))):
    role = await db.roles.find_one({"_id": key})
    if not role:
        raise HTTPException(404, "Role not found")
    if role.get("is_system"):
        raise HTTPException(400, "System roles cannot be deleted")
    await db.users.update_many({"roles": key}, {"$pull": {"roles": key}})
    await db.roles.delete_one({"_id": key})
    await write_audit(user, "role_deleted", "roles", key, request)
    return {"message": "Role deleted"}


# ============================ broadcasts =================================
class BroadcastBody(BaseModel):
    audience: str = "all"  # all | customers | owners
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=3, max_length=500)


@router.post("/notifications/broadcast", status_code=201)
async def broadcast_notifications(
    body: BroadcastBody, request: Request,
    user: dict = Depends(require_permission("notifications.broadcast")),
):
    """Send a broadcast: in-app notification + web push to an audience."""
    if body.audience not in ("all", "customers", "owners"):
        raise HTTPException(400, "الجمهور غير صالح")
    query: dict = {"deleted_at": None, "is_active": True}
    if body.audience == "customers":
        query["roles"] = "customer"
    elif body.audience == "owners":
        query["roles"] = "owner"

    recipients = 0
    push_sent = 0
    async for u in db.users.find(query, {"_id": 1}):
        uid = str(u["_id"])
        await notify(uid, "broadcast", body.title.strip(), body.body.strip(),
                     {"audience": body.audience})
        recipients += 1
    # web push (best effort per user)
    from push import push_to_user
    async for u in db.users.find(query, {"_id": 1}):
        try:
            push_sent += await push_to_user(str(u["_id"]), {
                "title": body.title.strip(), "body": body.body.strip(),
                "url": "/notifications",
            })
        except Exception:
            continue

    doc = {
        "_id": new_id(), "audience": body.audience,
        "title": body.title.strip(), "body": body.body.strip(),
        "recipients": recipients, "push_sent": push_sent,
        "created_by": user["_id"], "created_at": now(),
    }
    await db.broadcasts.insert_one(doc)
    await write_audit(user, "broadcast_sent", "broadcasts", doc["_id"], request,
                      after={"audience": body.audience, "recipients": recipients})
    return ser(doc)


@router.get("/notifications/broadcasts")
async def list_broadcasts(
    user: dict = Depends(require_permission("notifications.broadcast")),
    limit: int = Query(50, ge=1, le=200),
):
    docs = await db.broadcasts.find().sort("created_at", -1).to_list(limit)
    return ser_many(docs)
