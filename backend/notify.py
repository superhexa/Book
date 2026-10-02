from db import db, new_id, now


async def notify(user_id: str, ntype: str, title: str, body: str, data: dict = None):
    if not user_id:
        return
    pref = await db.notification_prefs.find_one({"user_id": user_id})
    if pref and ntype in (pref.get("muted", []) or []):
        return
    doc = {
        "_id": new_id(), "user_id": user_id, "type": ntype, "title": title,
        "body": body, "data": data or {}, "read": False, "created_at": now(),
    }
    await db.notifications.insert_one(doc)
    return doc
