"""Public geography endpoints for Jordan (governorates, cities, areas)."""
from fastapi import APIRouter

from db import db, ser_many
from jordan import GOVERNORATES

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/governorates")
async def list_governorates():
    """List the 12 Jordanian governorates.

    Reads the seeded `governorates` collection when available, otherwise
    falls back to the constants in `jordan.py`.
    """
    docs = await db.governorates.find({"deleted_at": None}).sort("order", 1).to_list(50)
    if docs:
        return ser_many(docs)
    return [
        {"key": g["key"], "name_ar": g["name_ar"], "name_en": g["name_en"]}
        for g in GOVERNORATES
    ]


@router.get("/governorates/{governorate_key}/cities")
async def list_cities(governorate_key: str):
    """List cities for a governorate (empty until seeded)."""
    docs = (
        await db.cities.find({"governorate_key": governorate_key, "deleted_at": None})
        .sort("name_ar", 1)
        .to_list(500)
    )
    return ser_many(docs)


@router.get("/cities/{city_id}/areas")
async def list_areas(city_id: str):
    """List areas/neighborhoods for a city (empty until seeded)."""
    docs = (
        await db.areas.find({"city_id": city_id, "deleted_at": None})
        .sort("name_ar", 1)
        .to_list(500)
    )
    return ser_many(docs)
