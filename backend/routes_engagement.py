from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from notify import notify
from security import (assert_facility_access, current_user, has_permission,
                      is_super_admin, require_permission)

router = APIRouter(tags=["engagement"])


# =============================== coupons ===================================
class CouponBody(BaseModel):
    code: str = Field(min_length=2, max_length=24)
    discount_type: str = "percentage"  # percentage | fixed
    discount_value: float
    max_discount: Optional[float] = None
    min_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    per_user_limit: Optional[int] = None
    facility_id: Optional[str] = None
    pitch_id: Optional[str] = None
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: bool = True


@router.post("/coupons", status_code=201)
async def create_coupon(body: CouponBody, request: Request,
                        user: dict = Depends(require_permission("coupons.create"))):
    if body.facility_id:
        f = await db.facilities.find_one({"_id": body.facility_id, "deleted_at": None})
        await assert_facility_access(user, f, "fields.update")
    elif not is_super_admin(user):
        raise HTTPException(403, "Only platform admins can create global coupons")
    if await db.coupons.find_one({"code": body.code.upper(), "deleted_at": None}):
        raise HTTPException(409, "Coupon code already exists")
    from datetime import datetime
    doc = {"_id": new_id(), **body.dict(), "code": body.code.upper(), "owner_id": user["_id"],
           "used_count": 0, "deleted_at": None, "created_at": now(), "updated_at": now()}
    for k in ("starts_at", "expires_at"):
        if doc.get(k):
            doc[k] = datetime.fromisoformat(doc[k])
    await db.coupons.insert_one(doc)
    await write_audit(user, "coupon_created", "coupons", doc["_id"], request)
    return ser(doc)


@router.get("/coupons")
async def list_coupons(user: dict = Depends(require_permission("coupons.read"))):
    query = {"deleted_at": None}
    if not is_super_admin(user):
        query["owner_id"] = user["_id"]
    return ser_many(await db.coupons.find(query).sort("created_at", -1).to_list(500))


@router.patch("/coupons/{cid}")
async def update_coupon(cid: str, body: dict, user: dict = Depends(require_permission("coupons.update"))):
    c = await db.coupons.find_one({"_id": cid, "deleted_at": None})
    if not c:
        raise HTTPException(404, "Coupon not found")
    if not is_super_admin(user) and c.get("owner_id") != user["_id"]:
        raise HTTPException(403, "Not your coupon")
    allowed = {"discount_value", "discount_type", "max_discount", "min_amount", "usage_limit",
               "per_user_limit", "is_active", "expires_at", "starts_at"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.coupons.update_one({"_id": cid}, {"$set": updates})
    return ser(await db.coupons.find_one({"_id": cid}))


@router.delete("/coupons/{cid}")
async def delete_coupon(cid: str, user: dict = Depends(require_permission("coupons.delete"))):
    c = await db.coupons.find_one({"_id": cid, "deleted_at": None})
    if not c:
        raise HTTPException(404, "Coupon not found")
    if not is_super_admin(user) and c.get("owner_id") != user["_id"]:
        raise HTTPException(403, "Not your coupon")
    await db.coupons.update_one({"_id": cid}, {"$set": {"deleted_at": now()}})
    return {"message": "Coupon deleted"}


# =============================== reviews ===================================
class ReviewBody(BaseModel):
    booking_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""
    photos: list = []


async def _recalc_rating(facility_id: str):
    docs = await db.reviews.find({"facility_id": facility_id, "deleted_at": None, "hidden": {"$ne": True}}).to_list(5000)
    if docs:
        avg = round(sum(d["rating"] for d in docs) / len(docs), 2)
        await db.facilities.update_one({"_id": facility_id}, {"$set": {"rating_avg": avg, "rating_count": len(docs)}})
    else:
        await db.facilities.update_one({"_id": facility_id}, {"$set": {"rating_avg": 0, "rating_count": 0}})


@router.post("/reviews", status_code=201)
async def create_review(body: ReviewBody, user: dict = Depends(current_user)):
    booking = await db.bookings.find_one({"_id": body.booking_id, "deleted_at": None})
    if not booking or booking["customer_id"] != user["_id"]:
        raise HTTPException(404, "Booking not found")
    if booking["status"] != "COMPLETED":
        raise HTTPException(400, "You can only review completed bookings")
    if await db.reviews.find_one({"booking_id": body.booking_id, "deleted_at": None}):
        raise HTTPException(409, "You have already reviewed this booking")
    doc = {"_id": new_id(), "booking_id": body.booking_id, "facility_id": booking["facility_id"],
           "pitch_id": booking["pitch_id"], "customer_id": user["_id"], "customer_name": user.get("name"),
           "rating": body.rating, "comment": body.comment, "photos": body.photos,
           "owner_response": None, "hidden": False, "reported": False,
           "deleted_at": None, "created_at": now()}
    await db.reviews.insert_one(doc)
    await _recalc_rating(booking["facility_id"])
    await notify(booking["owner_id"], "new_review", "New review",
                 f"{user.get('name')} left a {body.rating}★ review", {"review_id": doc["_id"]})
    return ser(doc)


@router.get("/facilities/{fid}/reviews")
async def facility_reviews(fid: str):
    docs = await db.reviews.find({"facility_id": fid, "deleted_at": None, "hidden": {"$ne": True}}).sort("created_at", -1).to_list(500)
    return ser_many(docs)


class ResponseBody(BaseModel):
    response: str


@router.post("/reviews/{rid}/respond")
async def respond_review(rid: str, body: ResponseBody, user: dict = Depends(current_user)):
    r = await db.reviews.find_one({"_id": rid, "deleted_at": None})
    if not r:
        raise HTTPException(404, "Review not found")
    f = await db.facilities.find_one({"_id": r["facility_id"]})
    await assert_facility_access(user, f, "reviews.moderate")
    await db.reviews.update_one({"_id": rid}, {"$set": {"owner_response": body.response, "updated_at": now()}})
    await notify(r["customer_id"], "review_response", "Owner replied to your review",
                 body.response[:80], {"review_id": rid})
    return ser(await db.reviews.find_one({"_id": rid}))


@router.post("/reviews/{rid}/report")
async def report_review(rid: str, user: dict = Depends(current_user)):
    r = await db.reviews.find_one({"_id": rid, "deleted_at": None})
    if not r:
        raise HTTPException(404, "Review not found")
    await db.reviews.update_one({"_id": rid}, {"$set": {"reported": True}})
    return {"message": "Review reported for moderation"}


# =============================== favorites =================================
@router.get("/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["_id"]}).to_list(500)
    ids = [f["facility_id"] for f in favs]
    facilities = await db.facilities.find({"_id": {"$in": ids}, "deleted_at": None}).to_list(500)
    return ser_many(facilities)


@router.post("/favorites/{fid}")
async def toggle_favorite(fid: str, user: dict = Depends(current_user)):
    existing = await db.favorites.find_one({"user_id": user["_id"], "facility_id": fid})
    if existing:
        await db.favorites.delete_one({"_id": existing["_id"]})
        return {"favorited": False}
    await db.favorites.insert_one({"_id": new_id(), "user_id": user["_id"], "facility_id": fid, "created_at": now()})
    return {"favorited": True}


# =============================== notifications =============================
@router.get("/notifications")
async def list_notifications(user: dict = Depends(current_user)):
    docs = await db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(200)
    unread = await db.notifications.count_documents({"user_id": user["_id"], "read": False})
    return {"items": ser_many(docs), "unread": unread}


@router.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(current_user)):
    await db.notifications.update_one({"_id": nid, "user_id": user["_id"]}, {"$set": {"read": True}})
    return {"message": "ok"}


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["_id"], "read": False}, {"$set": {"read": True}})
    return {"message": "ok"}


class PrefBody(BaseModel):
    muted: list = []


@router.get("/notification-prefs")
async def get_prefs(user: dict = Depends(current_user)):
    pref = await db.notification_prefs.find_one({"user_id": user["_id"]})
    return {"muted": pref.get("muted", []) if pref else []}


@router.put("/notification-prefs")
async def set_prefs(body: PrefBody, user: dict = Depends(current_user)):
    await db.notification_prefs.update_one({"user_id": user["_id"]},
                                           {"$set": {"muted": body.muted, "user_id": user["_id"]}}, upsert=True)
    return {"muted": body.muted}
