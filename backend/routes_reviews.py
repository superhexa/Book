"""Reviews: one review per COMPLETED booking, owner responses, reporting and
a moderation queue.

Rules:
- Only the customer of a COMPLETED booking may review it, once (unique index
  on ``reviews.booking_id`` plus an application-level check).
- Rating 1-5, text, up to 5 images (must be the author's own uploads).
- Facility owner/staff may post one response per review.
- Any signed-in user (except the author) may report a review; at >= 2 open
  reports the review is hidden pending moderation.
- Moderation queue requires the ``reviews.moderate`` permission.

Mount: app.include_router(routes_reviews.router, prefix="/api")
All user-facing errors are in Arabic.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from notify import notify
from security import (assert_facility_access, current_user, is_super_admin,
                      require_permission)

router = APIRouter(tags=["reviews"])

REPORT_THRESHOLD = 2  # open reports before a review is hidden pending moderation

_indexes_ready = False


async def ensure_indexes():
    """Idempotent index setup; call once at application startup."""
    global _indexes_ready
    if _indexes_ready:
        return
    await db.reviews.create_index("booking_id", unique=True)
    await db.reviews.create_index([("facility_id", 1), ("status", 1), ("created_at", -1)])
    await db.review_reports.create_index([("review_id", 1), ("status", 1)])
    _indexes_ready = True


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ReviewBody(BaseModel):
    booking_id: str
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=1000)
    images: list = Field(default_factory=list, max_length=5)


class RespondBody(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ReportBody(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class ResolveBody(BaseModel):
    decision: str = Field(pattern=r"^(dismiss|remove)$")
    note: str = Field(default="", max_length=500)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _recompute_facility_rating(facility_id: str):
    pipeline = [
        {"$match": {"facility_id": facility_id, "status": "VISIBLE"}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ]
    res = await db.reviews.aggregate(pipeline).to_list(1)
    avg = round(res[0]["avg"], 2) if res else 0.0
    n = res[0]["n"] if res else 0
    await db.facilities.update_one(
        {"_id": facility_id},
        {"$set": {"rating_avg": avg, "rating_count": n, "updated_at": now()}})


async def _get_review_or_404(rid: str) -> dict:
    r = await db.reviews.find_one({"_id": rid, "deleted_at": None})
    if not r:
        raise HTTPException(404, "التقييم غير موجود")
    return r


# ---------------------------------------------------------------------------
# Create (one per COMPLETED booking)
# ---------------------------------------------------------------------------
@router.post("/reviews")
async def create_review(body: ReviewBody, request: Request,
                        user: dict = Depends(current_user)):
    await ensure_indexes()
    b = await db.bookings.find_one({"_id": body.booking_id, "deleted_at": None})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b["customer_id"] != user["_id"]:
        raise HTTPException(403, "لا يمكنك تقييم حجز لا يخصك")
    if b["status"] != "COMPLETED":
        raise HTTPException(400, "يمكن تقييم الحجوزات المكتملة فقط")

    existing = await db.reviews.find_one({"booking_id": b["_id"], "deleted_at": None})
    if existing:
        raise HTTPException(409, "لقد قيّمت هذا الحجز مسبقاً")

    images = [str(i) for i in (body.images or [])]
    if images:
        owned = await db.uploads.count_documents(
            {"path": {"$in": images}, "owner_id": user["_id"]})
        if owned != len(images):
            raise HTTPException(400, "بعض الصور المرفقة غير صالحة")

    t = now()
    review = {
        "_id": new_id(),
        "booking_id": b["_id"],
        "customer_id": user["_id"],
        "customer_name": user.get("name"),
        "facility_id": b["facility_id"],
        "facility_name": b.get("facility_name"),
        "pitch_id": b["pitch_id"],
        "rating": body.rating,
        "text": body.text.strip(),
        "images": images,
        "owner_response": None,
        "status": "VISIBLE",  # VISIBLE | UNDER_REVIEW | HIDDEN
        "reports_count": 0,
        "deleted_at": None,
        "created_at": t,
        "updated_at": t,
    }
    try:
        await db.reviews.insert_one(review)
    except DuplicateKeyError:
        raise HTTPException(409, "لقد قيّمت هذا الحجز مسبقاً")

    await _recompute_facility_rating(b["facility_id"])
    await notify(b["owner_id"], "new_review", "تقييم جديد",
                 f"{user.get('name')} قيّم منشأتك {body.rating}/5",
                 {"review_id": review["_id"], "facility_id": b["facility_id"]})
    await write_audit(user, "review_created", "reviews", review["_id"], request)
    return ser(review)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------
@router.get("/reviews/facility/{fid}")
async def facility_reviews(fid: str, limit: int = Query(20, ge=1, le=50),
                           skip: int = Query(0, ge=0)):
    """Public listing of visible reviews for a facility."""
    docs = await db.reviews.find(
        {"facility_id": fid, "status": "VISIBLE", "deleted_at": None}) \
        .sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.reviews.count_documents(
        {"facility_id": fid, "status": "VISIBLE", "deleted_at": None})
    facility = await db.facilities.find_one(
        {"_id": fid}, {"rating_avg": 1, "rating_count": 1, "name": 1})
    return {"reviews": ser_many(docs), "total": total,
            "rating_avg": (facility or {}).get("rating_avg", 0.0),
            "rating_count": (facility or {}).get("rating_count", 0)}


@router.get("/reviews/mine")
async def my_review(booking_id: str, user: dict = Depends(current_user)):
    r = await db.reviews.find_one(
        {"booking_id": booking_id, "customer_id": user["_id"], "deleted_at": None})
    if not r:
        raise HTTPException(404, "لا يوجد تقييم لهذا الحجز")
    return ser(r)


# ---------------------------------------------------------------------------
# Owner response
# ---------------------------------------------------------------------------
@router.post("/reviews/{rid}/respond")
async def respond_to_review(rid: str, body: RespondBody, request: Request,
                            user: dict = Depends(current_user)):
    r = await _get_review_or_404(rid)
    facility = await db.facilities.find_one({"_id": r["facility_id"]})
    await assert_facility_access(user, facility, "reviews.moderate")
    response = {"text": body.text.strip(), "by": user["_id"],
                "by_name": user.get("name"), "at": now()}
    await db.reviews.update_one(
        {"_id": rid}, {"$set": {"owner_response": response, "updated_at": now()}})
    await notify(r["customer_id"], "review_response", "ردّت المنشأة على تقييمك",
                 f"{r['facility_name']} ردّت على تقييمك", {"review_id": rid})
    await write_audit(user, "review_responded", "reviews", rid, request)
    return ser(await db.reviews.find_one({"_id": rid}))


# ---------------------------------------------------------------------------
# Report -> moderation queue
# ---------------------------------------------------------------------------
@router.post("/reviews/{rid}/report")
async def report_review(rid: str, body: ReportBody, request: Request,
                        user: dict = Depends(current_user)):
    r = await _get_review_or_404(rid)
    if r["customer_id"] == user["_id"]:
        raise HTTPException(400, "لا يمكنك الإبلاغ عن تقييمك")
    if r["status"] == "HIDDEN":
        raise HTTPException(400, "هذا التقييم محذوف ولا يمكن الإبلاغ عنه")
    dup = await db.review_reports.find_one(
        {"review_id": rid, "reporter_id": user["_id"], "status": "OPEN"})
    if dup:
        raise HTTPException(409, "لقد بلّغت عن هذا التقييم مسبقاً")

    report = {
        "_id": new_id(),
        "review_id": rid,
        "facility_id": r["facility_id"],
        "reporter_id": user["_id"],
        "reason": body.reason.strip(),
        "status": "OPEN",  # OPEN | CLOSED
        "resolution": None,
        "created_at": now(),
        "updated_at": now(),
    }
    await db.review_reports.insert_one(report)
    new_count = int(r.get("reports_count", 0)) + 1
    update = {"reports_count": new_count, "updated_at": now()}
    if new_count >= REPORT_THRESHOLD and r["status"] == "VISIBLE":
        update["status"] = "UNDER_REVIEW"  # hidden from public until moderated
    await db.reviews.update_one({"_id": rid}, {"$set": update})
    if update.get("status") == "UNDER_REVIEW":
        await _recompute_facility_rating(r["facility_id"])
    await write_audit(user, "review_reported", "review_reports", report["_id"], request)
    return ser(report)


@router.get("/reviews/moderation/queue")
async def moderation_queue(user: dict = Depends(require_permission("reviews.moderate"))):
    """Moderation queue: open reports with their review attached."""
    reports = await db.review_reports.find({"status": "OPEN"}) \
        .sort("created_at", 1).to_list(100)
    out = []
    for rep in reports:
        review = await db.reviews.find_one({"_id": rep["review_id"]})
        out.append({**ser(rep), "review": ser(review) if review else None})
    return out


@router.post("/reviews/moderation/{report_id}/resolve")
async def resolve_report(report_id: str, body: ResolveBody, request: Request,
                         user: dict = Depends(require_permission("reviews.moderate"))):
    rep = await db.review_reports.find_one({"_id": report_id})
    if not rep:
        raise HTTPException(404, "البلاغ غير موجود")
    if rep["status"] != "OPEN":
        raise HTTPException(400, "هذا البلاغ مغلق مسبقاً")

    review = await db.reviews.find_one({"_id": rep["review_id"]})
    if body.decision == "dismiss":
        if review and review["status"] == "UNDER_REVIEW":
            await db.reviews.update_one(
                {"_id": review["_id"]},
                {"$set": {"status": "VISIBLE", "updated_at": now()}})
            await _recompute_facility_rating(review["facility_id"])
        resolution = "DISMISSED"
    else:  # remove
        if review:
            await db.reviews.update_one(
                {"_id": review["_id"]},
                {"$set": {"status": "HIDDEN", "updated_at": now()}})
            await _recompute_facility_rating(review["facility_id"])
            await notify(review["customer_id"], "review_removed", "تمت إزالة تقييمك",
                         "أُزيل تقييمك لمخالفته سياسة المنصة", {"review_id": review["_id"]})
        resolution = "REMOVED"

    await db.review_reports.update_one({"_id": report_id}, {"$set": {
        "status": "CLOSED", "resolution": resolution,
        "resolved_by": user["_id"], "note": body.note, "updated_at": now()}})
    await write_audit(user, "review_report_resolved", "review_reports", report_id,
                      request, before={"status": "OPEN"},
                      after={"resolution": resolution})
    return ser(await db.review_reports.find_one({"_id": report_id}))
