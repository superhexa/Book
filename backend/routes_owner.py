from collections import defaultdict
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from rbac import ORG_PERMISSIONS
from security import (assert_facility_access, current_user, is_super_admin,
                      require_permission)

router = APIRouter(prefix="/owner", tags=["owner"])


async def _owner_facility_ids(user: dict, facility_id: Optional[str] = None) -> list:
    if facility_id:
        f = await db.facilities.find_one({"_id": facility_id, "deleted_at": None})
        await assert_facility_access(user, f, "bookings.read")
        return [facility_id]
    if is_super_admin(user):
        docs = await db.facilities.find({"deleted_at": None}).to_list(1000)
    else:
        owned = await db.facilities.find({"owner_id": user["_id"], "deleted_at": None}).to_list(1000)
        member_ids = [m["facility_id"] async for m in db.organization_members.find({"user_id": user["_id"], "deleted_at": None})]
        member = await db.facilities.find({"_id": {"$in": member_ids}, "deleted_at": None}).to_list(1000)
        docs = owned + member
    return list({f["_id"] for f in docs})


@router.get("/bookings")
async def owner_bookings(facility_id: Optional[str] = None, status: Optional[str] = None,
                         user: dict = Depends(require_permission("bookings.read"))):
    fids = await _owner_facility_ids(user, facility_id)
    query = {"facility_id": {"$in": fids}, "deleted_at": None}
    if status:
        query["status"] = status
    docs = await db.bookings.find(query).sort([("date", -1), ("start_min", -1)]).to_list(500)
    return ser_many(docs)


@router.get("/analytics")
async def owner_analytics(facility_id: Optional[str] = None,
                          user: dict = Depends(require_permission("analytics.read"))):
    fids = await _owner_facility_ids(user, facility_id)
    bookings = await db.bookings.find({"facility_id": {"$in": fids}, "deleted_at": None}).to_list(10000)

    revenue_states = {"CONFIRMED", "COMPLETED", "NO_SHOW"}
    total_revenue = sum(b["final_amount"] for b in bookings if b["status"] in revenue_states)
    confirmed = [b for b in bookings if b["status"] in revenue_states]
    cancelled = [b for b in bookings if b["status"] in ("CANCELLED", "REJECTED")]
    cancel_rate = round(len(cancelled) / len(bookings) * 100, 1) if bookings else 0
    avg_value = round(total_revenue / len(confirmed), 2) if confirmed else 0

    # revenue + bookings over last 14 days
    today = now().date()
    rev_series, book_series = [], []
    for i in range(13, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        day_bookings = [b for b in bookings if b["date"] == d]
        rev_series.append({"date": d, "value": round(sum(b["final_amount"] for b in day_bookings if b["status"] in revenue_states), 2)})
        book_series.append({"date": d, "value": len([b for b in day_bookings if b["status"] in revenue_states])})

    # peak hours
    hour_counts = defaultdict(int)
    for b in confirmed:
        hour_counts[b["start_min"] // 60] += 1
    peak_hours = [{"hour": h, "count": c} for h, c in sorted(hour_counts.items())]

    # most booked pitches
    pitch_counts = defaultdict(lambda: {"count": 0, "revenue": 0.0, "name": ""})
    for b in confirmed:
        pc = pitch_counts[b["pitch_id"]]
        pc["count"] += 1
        pc["revenue"] += b["final_amount"]
        pc["name"] = b["pitch_name"]
    top_pitches = sorted([{"pitch_id": k, **v} for k, v in pitch_counts.items()],
                         key=lambda x: x["count"], reverse=True)[:5]

    # occupancy estimate (confirmed hours / available hours for last 14 days)
    occupancy = 0
    if fids:
        pitches = await db.pitches.count_documents({"facility_id": {"$in": fids}, "deleted_at": None})
        booked_hours = sum(b["duration_min"] for b in confirmed if b["date"] >= (today - timedelta(days=14)).isoformat()) / 60
        capacity = max(pitches, 1) * 14 * 14  # ~14 open hours/day over 14 days
        occupancy = round(min(booked_hours / capacity * 100, 100), 1) if capacity else 0

    return {
        "total_revenue": round(total_revenue, 2),
        "booking_count": len(bookings),
        "confirmed_count": len(confirmed),
        "cancellation_rate": cancel_rate,
        "avg_booking_value": avg_value,
        "occupancy": occupancy,
        "revenue_series": rev_series,
        "booking_series": book_series,
        "peak_hours": peak_hours,
        "top_pitches": top_pitches,
        "today_count": len([b for b in bookings if b["date"] == today.isoformat() and b["status"] in revenue_states]),
    }


# =============================== staff =====================================
class StaffBody(BaseModel):
    email: str
    permissions: list = Field(default_factory=list)


@router.get("/facilities/{fid}/staff")
async def list_staff(fid: str, user: dict = Depends(current_user)):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    await assert_facility_access(user, f, "fields.update")
    members = await db.organization_members.find({"facility_id": fid, "deleted_at": None}).to_list(200)
    out = []
    for m in members:
        u = await db.users.find_one({"_id": m["user_id"]})
        out.append({"id": m["_id"], "user_id": m["user_id"], "name": u.get("name") if u else None,
                    "email": u.get("email") if u else None, "permissions": m.get("permissions", [])})
    return out


@router.post("/facilities/{fid}/staff", status_code=201)
async def add_staff(fid: str, body: StaffBody, request: Request, user: dict = Depends(current_user)):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    await assert_facility_access(user, f, "fields.update")
    target = await db.users.find_one({"email": body.email.lower()})
    if not target:
        raise HTTPException(404, "No user found with this email. They must register first.")
    perms = [p for p in body.permissions if p in ORG_PERMISSIONS]
    existing = await db.organization_members.find_one({"facility_id": fid, "user_id": target["_id"], "deleted_at": None})
    if existing:
        await db.organization_members.update_one({"_id": existing["_id"]}, {"$set": {"permissions": perms}})
        mid = existing["_id"]
    else:
        mid = new_id()
        await db.organization_members.insert_one({"_id": mid, "facility_id": fid, "user_id": target["_id"],
                                                  "permissions": perms, "deleted_at": None, "created_at": now()})
    await write_audit(user, "staff_assigned", "organization_members", mid, request, after={"permissions": perms})
    return {"id": mid, "user_id": target["_id"], "name": target.get("name"),
            "email": target.get("email"), "permissions": perms}


@router.delete("/staff/{mid}")
async def remove_staff(mid: str, request: Request, user: dict = Depends(current_user)):
    m = await db.organization_members.find_one({"_id": mid, "deleted_at": None})
    if not m:
        raise HTTPException(404, "Staff member not found")
    f = await db.facilities.find_one({"_id": m["facility_id"]})
    await assert_facility_access(user, f, "fields.update")
    await db.organization_members.update_one({"_id": mid}, {"$set": {"deleted_at": now()}})
    await write_audit(user, "staff_removed", "organization_members", mid, request)
    return {"message": "Staff member removed"}


@router.get("/staff-permissions")
async def staff_permissions():
    return {"permissions": ORG_PERMISSIONS}
