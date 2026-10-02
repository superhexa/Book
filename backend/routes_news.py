"""CMS for news and announcements: DRAFT / PUBLISHED / SCHEDULED / ARCHIVED."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from security import current_user, has_permission, is_super_admin, optional_user

router = APIRouter(tags=["news"])

NEWS_STATUSES = ("DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED")
KINDS = ("news", "announcement")


# ------------------------------- helpers ----------------------------------
def _can_manage(user: Optional[dict]) -> bool:
    return bool(user and (is_super_admin(user) or has_permission(user, "news.read")))


async def get_item_or_404(nid: str) -> dict:
    n = await db.news.find_one({"_id": nid, "deleted_at": None})
    if not n:
        raise HTTPException(404, "المحتوى غير موجود")
    return n


# ------------------------------- models -----------------------------------
class NewsBody(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=10)
    kind: str = "news"  # news | announcement
    cover_image: Optional[str] = None
    summary: str = ""
    tags: list = []
    category: str = "general"
    audience: str = "all"  # all | players | teams | referees
    scheduled_at: Optional[datetime] = None


# -------------------------------- routes ----------------------------------
@router.post("/news", status_code=201)
async def create_news(body: NewsBody, request: Request,
                      user: dict = Depends(current_user)):
    if not has_permission(user, "news.create"):
        raise HTTPException(403, "لا تملك صلاحية إنشاء محتوى")
    if body.kind not in KINDS:
        raise HTTPException(400, "نوع المحتوى غير صالح")
    status_ = "DRAFT"
    if body.scheduled_at and body.scheduled_at > now():
        status_ = "SCHEDULED"
    doc = {"_id": new_id(), "author_id": user["_id"], **body.model_dump(),
           "status": status_, "published_at": None,
           "deleted_at": None, "created_at": now(), "updated_at": now()}
    await db.news.insert_one(doc)
    await write_audit(user, "news_created", "news", doc["_id"], request)
    return ser(doc)


async def _list_items(kind: str, status_f: Optional[str], audience: Optional[str],
                      q: Optional[str], page: int, limit: int, user: Optional[dict]):
    query = {"deleted_at": None, "kind": kind}
    if _can_manage(user) and status_f:
        query["status"] = status_f
    elif _can_manage(user) and not status_f:
        pass  # managers see everything by default
    else:
        query["status"] = "PUBLISHED"
        query["audience"] = {"$in": ["all", audience or "all"]}
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}},
                        {"body": {"$regex": q, "$options": "i"}}]
    total = await db.news.count_documents(query)
    docs = await db.news.find(query).sort("published_at", -1).sort(
        "created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


@router.get("/news")
async def list_news(status_f: Optional[str] = Query(None, alias="status"),
                    q: Optional[str] = None,
                    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                    user: Optional[dict] = Depends(optional_user)):
    return await _list_items("news", status_f, "all", q, page, limit, user)


@router.get("/announcements")
async def list_announcements(status_f: Optional[str] = Query(None, alias="status"),
                             audience: Optional[str] = None,
                             page: int = Query(1, ge=1),
                             limit: int = Query(20, ge=1, le=100),
                             user: Optional[dict] = Depends(optional_user)):
    return await _list_items("announcement", status_f, audience, None, page, limit, user)


@router.get("/news/{nid}")
async def get_news(nid: str, user: Optional[dict] = Depends(optional_user)):
    n = await get_item_or_404(nid)
    if n["status"] != "PUBLISHED" and not _can_manage(user):
        raise HTTPException(404, "المحتوى غير موجود")
    return ser(n)


@router.patch("/news/{nid}")
async def update_news(nid: str, body: dict, request: Request,
                      user: dict = Depends(current_user)):
    if not has_permission(user, "news.update"):
        raise HTTPException(403, "لا تملك صلاحية تعديل المحتوى")
    n = await get_item_or_404(nid)
    allowed = set(NewsBody.model_fields.keys())
    updates = {k: v for k, v in body.items() if k in allowed}
    if "kind" in updates and updates["kind"] not in KINDS:
        raise HTTPException(400, "نوع المحتوى غير صالح")
    if "scheduled_at" in updates and updates["scheduled_at"] and n["status"] == "DRAFT":
        updates["status"] = "SCHEDULED"
    updates["updated_at"] = now()
    await db.news.update_one({"_id": nid}, {"$set": updates})
    await write_audit(user, "news_updated", "news", nid, request, before=ser(n))
    return ser(await db.news.find_one({"_id": nid}))


@router.delete("/news/{nid}")
async def delete_news(nid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "news.delete"):
        raise HTTPException(403, "لا تملك صلاحية حذف المحتوى")
    n = await get_item_or_404(nid)
    await db.news.update_one({"_id": nid},
                             {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "news_deleted", "news", nid, request, before=ser(n))
    return {"ok": True}


@router.post("/news/{nid}/publish")
async def publish_news(nid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "news.publish"):
        raise HTTPException(403, "لا تملك صلاحية نشر المحتوى")
    n = await get_item_or_404(nid)
    if n["status"] == "PUBLISHED":
        raise HTTPException(400, "المحتوى منشور مسبقاً")
    before = ser(n)
    await db.news.update_one({"_id": nid}, {"$set": {
        "status": "PUBLISHED", "published_at": now(), "scheduled_at": None,
        "updated_at": now()}})
    await write_audit(user, "news_published", "news", nid, request, before=before)
    return ser(await db.news.find_one({"_id": nid}))


@router.post("/news/{nid}/unpublish")
async def unpublish_news(nid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "news.publish"):
        raise HTTPException(403, "لا تملك صلاحية نشر المحتوى")
    n = await get_item_or_404(nid)
    before = ser(n)
    await db.news.update_one({"_id": nid}, {"$set": {
        "status": "DRAFT", "updated_at": now()}})
    await write_audit(user, "news_unpublished", "news", nid, request, before=before)
    return ser(await db.news.find_one({"_id": nid}))


@router.post("/news/{nid}/archive")
async def archive_news(nid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "news.update"):
        raise HTTPException(403, "لا تملك صلاحية تعديل المحتوى")
    n = await get_item_or_404(nid)
    before = ser(n)
    await db.news.update_one({"_id": nid}, {"$set": {
        "status": "ARCHIVED", "updated_at": now()}})
    await write_audit(user, "news_archived", "news", nid, request, before=before)
    return ser(await db.news.find_one({"_id": nid}))
