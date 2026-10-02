"""Notification center + Web Push subscription endpoints.

Router variable: `router` (APIRouter with no prefix; full paths are declared on
each route, e.g. "/api/notifications/...").
Coordinator wiring (backend/server.py):
    from routes_notifications import router as notifications_router
    app.include_router(notifications_router)

Auth: uses the project's `current_user` dependency from security.py.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from db import db, new_id, now
from push import vapid_public_key
from security import current_user

router = APIRouter()


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeIn(BaseModel):
    endpoint: str
    keys: PushKeys
    device_name: Optional[str] = None
    platform: Optional[str] = None  # e.g. "web", "ios", "android"


class UnsubscribeIn(BaseModel):
    endpoint: str


def _user_id(user: dict) -> str:
    uid = user.get("_id") or user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="غير مصرح: يلزم تسجيل الدخول")
    return str(uid)


@router.post("/api/notifications/subscribe")
async def subscribe(
    payload: SubscribeIn, request: Request, user: dict = Depends(current_user)
):
    """Register (or refresh) a Web Push subscription for the current user."""
    uid = _user_id(user)
    doc = {
        "user_id": uid,
        "endpoint": payload.endpoint,
        "keys": {"p256dh": payload.keys.p256dh, "auth": payload.keys.auth},
        "device_name": payload.device_name,
        "platform": payload.platform or "web",
        "user_agent": request.headers.get("user-agent"),
        "last_seen_at": now(),
    }
    await db.push_subscriptions.update_one(
        {"user_id": uid, "endpoint": payload.endpoint},
        {"$set": doc, "$setOnInsert": {"_id": new_id(), "created_at": now()}},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/api/notifications/subscribe")
async def unsubscribe(payload: UnsubscribeIn, user: dict = Depends(current_user)):
    """Remove a Web Push subscription by endpoint."""
    uid = _user_id(user)
    result = await db.push_subscriptions.delete_one(
        {"user_id": uid, "endpoint": payload.endpoint}
    )
    return {"ok": True, "removed": result.deleted_count}


@router.get("/api/notifications/devices")
async def list_devices(user: dict = Depends(current_user)):
    """List the current user's registered push devices."""
    uid = _user_id(user)
    devices = []
    async for sub in db.push_subscriptions.find({"user_id": uid}).sort("last_seen_at", -1):
        devices.append(
            {
                "id": str(sub["_id"]),
                "device_name": sub.get("device_name"),
                "platform": sub.get("platform"),
                "created_at": sub.get("created_at"),
                "last_seen_at": sub.get("last_seen_at"),
            }
        )
    return {"devices": devices}


@router.delete("/api/notifications/devices/{device_id}")
async def delete_device(device_id: str, user: dict = Depends(current_user)):
    """Remove one registered push device."""
    uid = _user_id(user)
    result = await db.push_subscriptions.delete_one({"_id": device_id, "user_id": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الجهاز غير موجود")
    return {"ok": True}


@router.get("/api/notifications")
async def list_notifications(
    user: dict = Depends(current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    category: Optional[str] = Query(None),
):
    """Paginated notification list for the current user.

    `category` filters on the notification `type` field (e.g. booking_reminder).
    """
    uid = _user_id(user)
    query: dict = {"user_id": uid}
    if unread_only:
        query["read"] = False
    if category:
        query["type"] = category

    total = await db.notifications.count_documents(query)
    unread_count = await db.notifications.count_documents({"user_id": uid, "read": False})

    items = []
    cursor = (
        db.notifications.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    async for n in cursor:
        items.append(
            {
                "id": str(n["_id"]),
                "type": n.get("type"),
                "title": n.get("title"),
                "body": n.get("body"),
                "data": n.get("data") or {},
                "read": bool(n.get("read")),
                "created_at": n.get("created_at"),
            }
        )
    return {
        "items": items,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "limit": limit,
    }


@router.post("/api/notifications/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(current_user)):
    """Mark one notification as read (only the owner's)."""
    uid = _user_id(user)
    result = await db.notifications.update_one(
        {"_id": notification_id, "user_id": uid},
        {"$set": {"read": True, "read_at": now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")
    return {"ok": True}


@router.post("/api/notifications/read-all")
async def mark_all_read(user: dict = Depends(current_user)):
    """Mark all of the current user's notifications as read."""
    uid = _user_id(user)
    result = await db.notifications.update_many(
        {"user_id": uid, "read": False},
        {"$set": {"read": True, "read_at": now()}},
    )
    return {"ok": True, "updated": result.modified_count}


@router.get("/api/notifications/vapid-public-key")
async def get_vapid_public_key():
    """Expose the VAPID public key (public by design) for web clients.

    The web app normally reads EXPO_PUBLIC_VAPID_PUBLIC_KEY at build time; this
    endpoint is a runtime fallback.
    """
    key = vapid_public_key()
    if not key:
        raise HTTPException(status_code=503, detail="خدمة الإشعارات غير مفعّلة")
    return {"vapid_public_key": key}
