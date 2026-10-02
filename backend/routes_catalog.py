from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from security import current_user, require_permission

router = APIRouter(tags=["catalog"])

DEFAULT_AMENITIES = [
    "parking", "changing_rooms", "showers", "bathrooms", "seating", "cafeteria",
    "wifi", "lighting", "equipment_rental", "ball_rental", "referee", "first_aid",
]
DEFAULT_FIELD_TYPES = ["indoor", "outdoor"]
DEFAULT_GRASS_TYPES = ["Natural Grass", "Artificial Turf", "Hybrid", "Futsal Court"]


@router.get("/catalog")
async def get_catalog():
    cities = ser_many(await db.catalog.find({"type": "city", "deleted_at": None}).to_list(500))
    amenities = ser_many(await db.catalog.find({"type": "amenity", "deleted_at": None}).to_list(500))
    categories = ser_many(await db.catalog.find({"type": "category", "deleted_at": None}).to_list(500))
    return {
        "cities": cities,
        "amenities": amenities or [{"id": a, "name": a, "key": a} for a in DEFAULT_AMENITIES],
        "categories": categories,
        "field_types": DEFAULT_FIELD_TYPES,
        "grass_types": DEFAULT_GRASS_TYPES,
    }


class CatalogBody(BaseModel):
    type: str  # city | area | amenity | category
    name: str
    parent: str | None = None


@router.post("/catalog", status_code=201)
async def add_catalog(body: CatalogBody, request: Request,
                      user: dict = Depends(require_permission("settings.update"))):
    doc = {"_id": new_id(), "type": body.type, "name": body.name, "key": body.name.lower().replace(" ", "_"),
           "parent": body.parent, "deleted_at": None, "created_at": now()}
    await db.catalog.insert_one(doc)
    await write_audit(user, "catalog_added", "catalog", doc["_id"], request, after={"type": body.type, "name": body.name})
    return ser(doc)


@router.delete("/catalog/{cid}")
async def remove_catalog(cid: str, user: dict = Depends(require_permission("settings.update"))):
    await db.catalog.update_one({"_id": cid}, {"$set": {"deleted_at": now()}})
    return {"message": "Removed"}


@router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"_id": "global"})
    if not s:
        return {"platform_name": "TurfBook", "default_currency": "USD",
                "max_booking_days_ahead": 30, "min_booking_hours_ahead": 1}
    return ser(s)


class SettingsBody(BaseModel):
    platform_name: str | None = None
    default_currency: str | None = None
    max_booking_days_ahead: int | None = None
    min_booking_hours_ahead: int | None = None


@router.put("/settings")
async def update_settings(body: SettingsBody, request: Request,
                          user: dict = Depends(require_permission("settings.update"))):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    updates["updated_at"] = now()
    await db.settings.update_one({"_id": "global"}, {"$set": updates}, upsert=True)
    await write_audit(user, "settings_updated", "settings", "global", request, after=updates)
    return ser(await db.settings.find_one({"_id": "global"}))
