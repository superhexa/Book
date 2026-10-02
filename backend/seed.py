"""Idempotent development seed. Safe to run multiple times.
The app functions with an empty DB; this only adds demo content for preview.
Run: python seed.py
"""
import asyncio

from db import db, new_id, now
from migrations import run_migrations
from jordan import GOVERNORATES
from security import hash_password

CITIES = ["Dubai", "Abu Dhabi", "Riyadh", "London"]
AMENITIES = ["parking", "changing_rooms", "showers", "cafeteria", "wifi", "lighting", "ball_rental", "referee"]

FACILITIES = [
    {"name": "Downtown Turf Arena", "city": "Dubai", "area": "Marina",
     "desc": "Premium 5-a-side and 7-a-side pitches in the heart of the Marina with floodlights and a rooftop cafe.",
     "cover": "https://images.unsplash.com/photo-1789476332262-3f9826198129?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80"},
    {"name": "Greenfield Sports Complex", "city": "Dubai", "area": "JLT",
     "desc": "Four full-size artificial turf pitches, parking, and professional changing rooms.",
     "cover": "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80"},
    {"name": "Capital Football Park", "city": "Abu Dhabi", "area": "Corniche",
     "desc": "Indoor and outdoor pitches with referee service and ball rental available.",
     "cover": "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80"},
    {"name": "Kingdom Arena", "city": "Riyadh", "area": "Olaya",
     "desc": "State of the art hybrid grass pitches with seating for spectators and cafeteria.",
     "cover": "https://images.unsplash.com/photo-1540379708242-14a809bef941?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80"},
]


def weekly():
    return {str(d): {"closed": False, "open_min": 360, "close_min": 1380} for d in range(7)}


async def ensure_user(email, name, role, password):
    u = await db.users.find_one({"email": email})
    if u:
        return u
    doc = {"_id": new_id(), "name": name, "email": email, "phone": None,
           "password_hash": hash_password(password), "roles": [role], "permissions": [],
           "is_active": True, "is_verified": True, "password_version": 0,
           "failed_attempts": 0, "locked_until": None, "deleted_at": None,
           "created_at": now(), "updated_at": now()}
    await db.users.insert_one(doc)
    return doc


async def seed_governorates():
    """Insert the 12 Jordanian governorates if missing (idempotent)."""
    for g in GOVERNORATES:
        if not await db.governorates.find_one({"key": g["key"]}):
            await db.governorates.insert_one({
                "_id": new_id(), "key": g["key"], "name_en": g["name_en"], "name_ar": g["name_ar"],
                "is_active": True, "created_at": now(), "updated_at": now(),
            })
    print("Governorates ensured: 12 Jordanian governorates.")


async def main():
    # Phase-2 indexes must exist before any seeding writes.
    await run_migrations()

    # Reference geography data — runs even when the demo seed was already done.
    await seed_governorates()

    if await db.app_meta.find_one({"_id": "seeded_v1"}):
        print("Already seeded.")
        return

    for c in CITIES:
        if not await db.catalog.find_one({"type": "city", "name": c}):
            await db.catalog.insert_one({"_id": new_id(), "type": "city", "name": c,
                                         "key": c.lower().replace(" ", "_"), "parent": None,
                                         "deleted_at": None, "created_at": now()})
    for a in AMENITIES:
        if not await db.catalog.find_one({"type": "amenity", "key": a}):
            await db.catalog.insert_one({"_id": new_id(), "type": "amenity", "name": a.replace("_", " ").title(),
                                         "key": a, "parent": None, "deleted_at": None, "created_at": now()})

    owner = await ensure_user("owner@turfbook.com", "Sam Owner", "owner", "Owner@12345")
    customer = await ensure_user("player@turfbook.com", "Alex Player", "customer", "Player@12345")

    for i, fdata in enumerate(FACILITIES):
        fid = new_id()
        await db.facilities.insert_one({
            "_id": fid, "owner_id": owner["_id"], "name": fdata["name"], "description": fdata["desc"],
            "address": f"{fdata['area']} District", "city": fdata["city"], "area": fdata["area"],
            "latitude": 25.07 + i * 0.01, "longitude": 55.14 + i * 0.01,
            "contact_phone": "+971500000000", "contact_email": "info@turfbook.com",
            "cover_image": fdata["cover"], "gallery": [fdata["cover"]], "amenities": AMENITIES[: 4 + i % 4],
            "field_type": "indoor" if i == 2 else "outdoor", "currency": "AED",
            "weekend_days": [4, 5], "approval_mode": "manual" if i == 1 else "auto",
            "cancellation_policy": {"free_cancellation_hours": 24, "partial_refund_hours": 6, "partial_refund_percent": 50},
            "rules": ["No metal studs", "Arrive 10 minutes early", "Max 2 guests per player"],
            "status": "VERIFIED", "rejection_reason": None, "rating_avg": 0, "rating_count": 0,
            "is_active": True, "deleted_at": None, "created_at": now(), "updated_at": now(),
        })
        for pn in range(1, 3 + (i % 2)):
            await db.pitches.insert_one({
                "_id": new_id(), "facility_id": fid, "owner_id": owner["_id"],
                "name": f"Pitch {pn}", "field_size": "5-a-side" if pn == 1 else "7-a-side",
                "grass_type": "Artificial Turf" if i != 3 else "Hybrid", "indoor": i == 2,
                "slot_duration": 60,
                "pricing": {"base_hourly": 120 + i * 30 + pn * 10, "weekend_multiplier": 1.25,
                            "peak_hours": [{"start_min": 1080, "end_min": 1320, "multiplier": 1.3}],
                            "special_dates": {}},
                "schedule": {"weekly": weekly(), "closed_dates": []},
                "is_active": True, "deleted_at": None, "created_at": now(), "updated_at": now(),
            })

    await db.app_meta.insert_one({"_id": "seeded_v1", "at": now()})
    print("Seed complete: 4 verified facilities, cities, demo owner & player.")


if __name__ == "__main__":
    asyncio.run(main())
