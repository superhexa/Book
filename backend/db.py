import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import config

client = AsyncIOMotorClient(config.MONGO_URL, tz_aware=True, tzinfo=timezone.utc)
db = client[config.DB_NAME]


def new_id() -> str:
    return uuid.uuid4().hex


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.astimezone(timezone.utc).isoformat()


def ser(doc):
    """Convert a mongo document to a JSON-safe dict (strip _id -> id, soft-delete field removed)."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = doc.pop("_id")
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = iso(v)
    doc.pop("password_hash", None)
    return doc


def ser_many(docs):
    return [ser(d) for d in docs]
