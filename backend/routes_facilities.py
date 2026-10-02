from typing import Optional

from fastapi import (APIRouter, Depends, File, HTTPException, Query, Request,
                     Response, UploadFile, status)
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

import storage_service
from audit import write_audit
from db import db, new_id, now, ser, ser_many
from security import (assert_facility_access, current_user, has_permission,
                      is_super_admin, optional_user, require_permission)

router = APIRouter(tags=["facilities"])


# ----------------------------- models -------------------------------------
class PitchPricing(BaseModel):
    base_hourly: float = 0
    weekend_multiplier: float = 1.0
    peak_hours: list = []
    special_dates: dict = {}


class PitchBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    field_size: str = "5-a-side"
    grass_type: str = "Artificial Turf"
    indoor: bool = False
    slot_duration: int = 60
    pricing: PitchPricing = PitchPricing()
    schedule: dict = {}


class FacilityBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    address: str = ""
    city: str = ""
    area: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_phone: str = ""
    contact_email: str = ""
    cover_image: Optional[str] = None
    gallery: list = []
    amenities: list = []
    field_type: str = "outdoor"
    currency: str = "USD"
    weekend_days: list = [4, 5]
    approval_mode: str = "auto"  # auto | manual
    cancellation_policy: dict = Field(default_factory=lambda: {
        "free_cancellation_hours": 24, "partial_refund_hours": 6, "partial_refund_percent": 50,
    })
    rules: list = []


class BlockBody(BaseModel):
    date: str
    start_min: int
    end_min: int
    reason: str = "Maintenance"


# ----------------------------- uploads ------------------------------------
@router.post("/uploads")
async def upload_image(request: Request, file: UploadFile = File(...),
                       user: dict = Depends(current_user)):
    content = await file.read()
    if len(content) > storage_service.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 10MB)")
    ctype = file.content_type or "application/octet-stream"
    if ctype not in storage_service.ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Unsupported image type. Use JPEG, PNG, WEBP or HEIC.")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
           "image/heic": "heic", "image/heif": "heif"}.get(ctype, "bin")
    path = storage_service.object_path(user["_id"], ext)
    try:
        await run_in_threadpool(storage_service.put_object, path, content, ctype)
    except Exception as e:
        raise HTTPException(502, f"Upload failed: {e}")
    await db.uploads.insert_one({"_id": new_id(), "owner_id": user["_id"], "path": path,
                                 "content_type": ctype, "created_at": now()})
    base = str(request.base_url).rstrip("/")
    return {"path": path, "url": f"{base}/api/files/{path}"}


@router.get("/files/{path:path}")
async def get_file(path: str):
    rec = await db.uploads.find_one({"path": path})
    if not rec:
        raise HTTPException(404, "File not found")
    try:
        content, ctype = await run_in_threadpool(storage_service.get_object, path)
    except Exception:
        raise HTTPException(404, "File not found")
    return Response(content=content, media_type=ctype,
                    headers={"Cache-Control": "public, max-age=86400"})


# ----------------------------- facilities ---------------------------------
@router.post("/facilities", status_code=201)
async def create_facility(body: FacilityBody, request: Request,
                          user: dict = Depends(require_permission("fields.create"))):
    doc = {"_id": new_id(), "owner_id": user["_id"], **body.dict(),
           "status": "DRAFT", "rejection_reason": None,
           "rating_avg": 0.0, "rating_count": 0, "is_active": True,
           "deleted_at": None, "created_at": now(), "updated_at": now()}
    await db.facilities.insert_one(doc)
    await write_audit(user, "facility_created", "facilities", doc["_id"], request)
    return ser(doc)


@router.get("/facilities/mine")
async def my_facilities(user: dict = Depends(current_user)):
    docs = await db.facilities.find({"owner_id": user["_id"], "deleted_at": None}).sort("created_at", -1).to_list(200)
    out = []
    for f in docs:
        f = ser(f)
        f["pitches"] = ser_many(await db.pitches.find({"facility_id": f["id"], "deleted_at": None}).to_list(100))
        out.append(f)
    return out


@router.get("/facilities")
async def search_facilities(
    q: Optional[str] = None, city: Optional[str] = None, area: Optional[str] = None,
    field_type: Optional[str] = None, grass_type: Optional[str] = None,
    indoor: Optional[bool] = None, min_rating: Optional[float] = None,
    min_price: Optional[float] = None, max_price: Optional[float] = None,
    amenities: Optional[str] = None, sort: str = "relevance",
    page: int = 1, limit: int = 20,
):
    query = {"status": "VERIFIED", "is_active": True, "deleted_at": None}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if city:
        query["city"] = city
    if area:
        query["area"] = area
    if field_type:
        query["field_type"] = field_type
    if indoor is not None:
        query["field_type"] = "indoor" if indoor else "outdoor"
    if min_rating is not None:
        query["rating_avg"] = {"$gte": min_rating}
    if amenities:
        query["amenities"] = {"$all": [a.strip() for a in amenities.split(",") if a.strip()]}

    sort_map = {"rating": [("rating_avg", -1)], "popularity": [("rating_count", -1)],
                "relevance": [("rating_avg", -1), ("created_at", -1)]}
    cursor = db.facilities.find(query)
    total = await db.facilities.count_documents(query)
    cursor = cursor.sort(sort_map.get(sort, sort_map["relevance"]))
    docs = await cursor.skip((page - 1) * limit).limit(limit).to_list(limit)

    out = []
    for f in docs:
        f = ser(f)
        pitches = ser_many(await db.pitches.find({"facility_id": f["id"], "deleted_at": None}).to_list(50))
        if grass_type:
            if not any(p.get("grass_type") == grass_type for p in pitches):
                continue
        prices = [p.get("pricing", {}).get("base_hourly", 0) for p in pitches]
        f["min_price"] = min(prices) if prices else 0
        f["pitch_count"] = len(pitches)
        if min_price is not None and f["min_price"] < min_price:
            continue
        if max_price is not None and f["min_price"] > max_price:
            continue
        out.append(f)
    return {"items": out, "total": total, "page": page, "limit": limit}


@router.get("/facilities/{fid}")
async def get_facility(fid: str, user: Optional[dict] = Depends(optional_user)):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    if not f:
        raise HTTPException(404, "Facility not found")
    is_owner_or_admin = user and (user["_id"] == f["owner_id"] or is_super_admin(user)
                                  or has_permission(user, "fields.read"))
    if f["status"] != "VERIFIED" and not is_owner_or_admin:
        raise HTTPException(404, "Facility not found")
    out = ser(f)
    out["pitches"] = ser_many(await db.pitches.find({"facility_id": fid, "deleted_at": None}).to_list(100))
    owner = await db.users.find_one({"_id": f["owner_id"]})
    out["owner"] = {"id": owner["_id"], "name": owner.get("name")} if owner else None
    return out


@router.patch("/facilities/{fid}")
async def update_facility(fid: str, body: dict, request: Request, user: dict = Depends(current_user)):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    await assert_facility_access(user, f, "fields.update")
    allowed = set(FacilityBody.model_fields.keys())
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.facilities.update_one({"_id": fid}, {"$set": updates})
    await write_audit(user, "facility_updated", "facilities", fid, request, before=ser(f))
    return ser(await db.facilities.find_one({"_id": fid}))


@router.post("/facilities/{fid}/submit")
async def submit_for_review(fid: str, request: Request, user: dict = Depends(current_user)):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    await assert_facility_access(user, f, "fields.update")
    if f["status"] in ("VERIFIED",):
        raise HTTPException(400, "Facility is already verified")
    pitch_count = await db.pitches.count_documents({"facility_id": fid, "deleted_at": None})
    if pitch_count == 0:
        raise HTTPException(400, "Add at least one pitch before submitting for review")
    await db.facilities.update_one({"_id": fid}, {"$set": {"status": "PENDING_REVIEW", "updated_at": now()}})
    await write_audit(user, "facility_submitted", "facilities", fid, request)
    return ser(await db.facilities.find_one({"_id": fid}))


@router.delete("/facilities/{fid}")
async def delete_facility(fid: str, request: Request, user: dict = Depends(current_user)):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    await assert_facility_access(user, f, "fields.delete")
    await db.facilities.update_one({"_id": fid}, {"$set": {"deleted_at": now()}})
    await write_audit(user, "facility_deleted", "facilities", fid, request)
    return {"message": "Facility deleted"}


# ----------------------------- pitches ------------------------------------
@router.post("/facilities/{fid}/pitches", status_code=201)
async def create_pitch(fid: str, body: PitchBody, request: Request, user: dict = Depends(current_user)):
    f = await db.facilities.find_one({"_id": fid, "deleted_at": None})
    await assert_facility_access(user, f, "fields.update")
    doc = {"_id": new_id(), "facility_id": fid, "owner_id": f["owner_id"],
           **body.dict(), "is_active": True, "deleted_at": None,
           "created_at": now(), "updated_at": now()}
    if not doc.get("schedule"):
        doc["schedule"] = _default_schedule()
    await db.pitches.insert_one(doc)
    await write_audit(user, "pitch_created", "pitches", doc["_id"], request)
    return ser(doc)


@router.get("/pitches/{pid}")
async def get_pitch(pid: str):
    p = await db.pitches.find_one({"_id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Pitch not found")
    f = await db.facilities.find_one({"_id": p["facility_id"], "deleted_at": None})
    out = ser(p)
    out["facility"] = {
        "id": f["_id"], "name": f["name"], "currency": f.get("currency", "USD"),
        "status": f.get("status"), "cancellation_policy": f.get("cancellation_policy", {}),
        "approval_mode": f.get("approval_mode", "auto"),
    } if f else None
    return out


@router.patch("/pitches/{pid}")
async def update_pitch(pid: str, body: dict, request: Request, user: dict = Depends(current_user)):
    p = await db.pitches.find_one({"_id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Pitch not found")
    f = await db.facilities.find_one({"_id": p["facility_id"]})
    await assert_facility_access(user, f, "fields.update")
    before = ser(p)
    allowed = {"name", "field_size", "grass_type", "indoor", "slot_duration", "pricing", "schedule", "is_active"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.pitches.update_one({"_id": pid}, {"$set": updates})
    action = "price_changed" if "pricing" in updates else "pitch_updated"
    await write_audit(user, action, "pitches", pid, request, before=before)
    return ser(await db.pitches.find_one({"_id": pid}))


@router.delete("/pitches/{pid}")
async def delete_pitch(pid: str, request: Request, user: dict = Depends(current_user)):
    p = await db.pitches.find_one({"_id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Pitch not found")
    f = await db.facilities.find_one({"_id": p["facility_id"]})
    await assert_facility_access(user, f, "fields.update")
    await db.pitches.update_one({"_id": pid}, {"$set": {"deleted_at": now()}})
    await write_audit(user, "pitch_deleted", "pitches", pid, request)
    return {"message": "Pitch deleted"}


# ----------------------------- availability blocks -------------------------
@router.get("/pitches/{pid}/blocks")
async def list_blocks(pid: str, user: dict = Depends(current_user)):
    p = await db.pitches.find_one({"_id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Pitch not found")
    f = await db.facilities.find_one({"_id": p["facility_id"]})
    await assert_facility_access(user, f, "fields.update")
    return ser_many(await db.availability_blocks.find({"pitch_id": pid, "deleted_at": None}).to_list(500))


@router.post("/pitches/{pid}/blocks", status_code=201)
async def add_block(pid: str, body: BlockBody, request: Request, user: dict = Depends(current_user)):
    p = await db.pitches.find_one({"_id": pid, "deleted_at": None})
    if not p:
        raise HTTPException(404, "Pitch not found")
    f = await db.facilities.find_one({"_id": p["facility_id"]})
    await assert_facility_access(user, f, "fields.update")
    doc = {"_id": new_id(), "pitch_id": pid, "facility_id": p["facility_id"], **body.dict(),
           "deleted_at": None, "created_at": now()}
    await db.availability_blocks.insert_one(doc)
    await write_audit(user, "block_added", "availability_blocks", doc["_id"], request)
    return ser(doc)


@router.delete("/blocks/{bid}")
async def remove_block(bid: str, user: dict = Depends(current_user)):
    b = await db.availability_blocks.find_one({"_id": bid, "deleted_at": None})
    if not b:
        raise HTTPException(404, "Block not found")
    f = await db.facilities.find_one({"_id": b["facility_id"]})
    await assert_facility_access(user, f, "fields.update")
    await db.availability_blocks.update_one({"_id": bid}, {"$set": {"deleted_at": now()}})
    return {"message": "Block removed"}


def _default_schedule():
    weekly = {}
    for d in range(7):
        weekly[str(d)] = {"closed": False, "open_min": 360, "close_min": 1380}
    return {"weekly": weekly, "closed_dates": []}
