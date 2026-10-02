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


# ===========================================================================
# Phase 6 — Jordanian development demo seed (بيانات تجريبية أردنية)
# ---------------------------------------------------------------------------
# Appended 2026-10-02. Guarded by the SEED_DEMO env flag: this demo seed only
# runs when SEED_DEMO=1 is set explicitly. It NEVER runs in production.
# Idempotent: guarded by the `seeded_jo_v1` marker in `app_meta`.
# Run:  SEED_DEMO=1 python seed.py
# ===========================================================================
import os

SEED_DEMO = os.environ.get("SEED_DEMO") == "1"

JO_OWNERS = [
    {"email": "owner.amman@turfbook.com", "name": "أحمد الحوراني", "password": "Owner@12345"},
    {"email": "owner.irbid@turfbook.com", "name": "ليث النجار", "password": "Owner@12345"},
]

JO_FACILITIES = [
    {"owner": 0, "name": "ملعب النخبة", "city": "عمّان", "area": "الصويفية",
     "desc": "ملاعب عشب صناعي بإضاءة كاشفة وغرف تبديل ملابس حديثة في قلب الصويفية.",
     "lat": 31.9539, "lng": 35.9106, "phone": "+962790000001"},
    {"owner": 1, "name": "ستاد الشمال", "city": "إربد", "area": "شارع الجامعة",
     "desc": "مجمع رياضي متكامل بملاعب خماسية وسباعية ومواقف واسعة.",
     "lat": 32.5553, "lng": 35.8478, "phone": "+962790000002"},
    {"owner": 0, "name": "ملعب البحر الأحمر", "city": "العقبة", "area": "الكورنيش",
     "desc": "ملاعب خارجية بإطلالة على البحر الأحمر مع كافتيريا للجمهور.",
     "lat": 29.5321, "lng": 35.0063, "phone": "+962790000003"},
]

JO_PITCH_NAMES = ["ملعب 1", "ملعب 2"]

# أربعة فرق — فريقان بتشكيلتين كاملتين (11 لاعباً لكل فريق)
JO_TEAMS = [
    {"name": "نسور عمّان", "city": "عمّان", "short": "NSR",
     "players": [
         ("عمر الشريف", "حارس مرمى", 1), ("خالد المصري", "دفاع", 2),
         ("محمد أبو زيد", "دفاع", 3), ("عبدالله القيسي", "دفاع", 4),
         ("يوسف حداد", "دفاع", 5), ("سامي الخطيب", "وسط", 6),
         ("رامي عوض", "وسط", 7), ("ناصر الدين", "وسط", 8),
         ("كريم سعادة", "هجوم", 9), ("فادي مراد", "وسط", 10),
         ("طارق النمري", "هجوم", 11),
     ]},
    {"name": "صقور إربد", "city": "إربد", "short": "SQR",
     "players": [
         ("حسن العبادي", "حارس مرمى", 1), ("علي الشمايلة", "دفاع", 2),
         ("إبراهيم مقابلة", "دفاع", 3), ("زيد الرواشدة", "دفاع", 4),
         ("عمر بني هاني", "دفاع", 5), ("أحمد الخصاونة", "وسط", 6),
         ("محمد الشلول", "وسط", 7), ("سيف الدين", "وسط", 8),
         ("حمزة التل", "هجوم", 9), ("ليث القضاة", "وسط", 10),
         ("يزن العزام", "هجوم", 11),
     ]},
    {"name": "أشبال العقبة", "city": "العقبة", "short": "ASH", "players": []},
    {"name": "نجوم الزرقاء", "city": "الزرقاء", "short": "NZM", "players": []},
]

JO_LEAGUE = {"name": "دوري الملاعب الأردني", "season": "موسم 2026/2027"}


def _jo_round_robin(team_ids):
    """Circle method — every pair meets exactly once."""
    teams = list(team_ids)
    n = len(teams)
    order = teams[:]
    rounds = []
    for _ in range(n - 1):
        rounds.append([(order[i], order[n - 1 - i]) for i in range(n // 2)])
        order = [order[0]] + [order[-1]] + order[1:-1]
    return rounds


def _jo_standings(team_ids, matches):
    """3 pts win / 1 draw, ordered by points, goal difference, goals for."""
    table = {t: {"team_id": t, "played": 0, "won": 0, "drawn": 0, "lost": 0,
                 "gf": 0, "ga": 0, "gd": 0, "points": 0} for t in team_ids}
    for m in matches:
        if m.get("home_goals") is None:
            continue
        h, a = table[m["home_team_id"]], table[m["away_team_id"]]
        hg, ag = m["home_goals"], m["away_goals"]
        h["played"] += 1
        a["played"] += 1
        h["gf"] += hg
        h["ga"] += ag
        a["gf"] += ag
        a["ga"] += hg
        if hg > ag:
            h["won"] += 1
            a["lost"] += 1
            h["points"] += 3
        elif ag > hg:
            a["won"] += 1
            h["lost"] += 1
            a["points"] += 3
        else:
            h["drawn"] += 1
            a["drawn"] += 1
            h["points"] += 1
            a["points"] += 1
    for row in table.values():
        row["gd"] = row["gf"] - row["ga"]
    return sorted(table.values(), key=lambda r: (-r["points"], -r["gd"], -r["gf"]))


async def seed_jordan_demo():
    """Jordanian dev demo seed. No-op unless SEED_DEMO=1 (production-safe)."""
    if not SEED_DEMO:
        print("SEED_DEMO not set — skipping Jordan demo seed.")
        return
    if await db.app_meta.find_one({"_id": "seeded_jo_v1"}):
        print("Jordan demo already seeded.")
        return

    owners = [await ensure_user(o["email"], o["name"], "owner", o["password"])
              for o in JO_OWNERS]

    for i, fdata in enumerate(JO_FACILITIES):
        if await db.facilities.find_one({"name": fdata["name"], "city": fdata["city"]}):
            continue
        fid = new_id()
        await db.facilities.insert_one({
            "_id": fid, "owner_id": owners[fdata["owner"]]["_id"],
            "name": fdata["name"], "description": fdata["desc"],
            "address": f"شارع {fdata['area']}", "city": fdata["city"], "area": fdata["area"],
            "latitude": fdata["lat"], "longitude": fdata["lng"],
            "contact_phone": fdata["phone"], "contact_email": "info@turfbook.com",
            "cover_image": None, "gallery": [], "amenities": AMENITIES[:4],
            "field_type": "outdoor", "currency": "JOD",
            "weekend_days": [4, 5], "approval_mode": "auto",
            "cancellation_policy": {"free_cancellation_hours": 24,
                                    "partial_refund_hours": 6,
                                    "partial_refund_percent": 50},
            "rules": ["ممنوع استخدام الأحذية ذات المسامير المعدنية",
                      "الحضور قبل الموعد بعشر دقائق"],
            "status": "VERIFIED", "rejection_reason": None,
            "rating_avg": 0, "rating_count": 0,
            "is_active": True, "deleted_at": None,
            "created_at": now(), "updated_at": now(),
        })
        for pn, pname in enumerate(JO_PITCH_NAMES, start=1):
            await db.pitches.insert_one({
                "_id": new_id(), "facility_id": fid,
                "owner_id": owners[fdata["owner"]]["_id"],
                "name": pname, "field_size": "5-a-side" if pn == 1 else "7-a-side",
                "grass_type": "عشب صناعي", "indoor": False, "slot_duration": 60,
                "pricing": {"base_hourly": 20 + i * 5 + pn * 2,
                            "weekend_multiplier": 1.25,
                            "peak_hours": [{"start_min": 1080, "end_min": 1320,
                                            "multiplier": 1.3}],
                            "special_dates": {}},
                "schedule": {"weekly": weekly(), "closed_dates": []},
                "is_active": True, "deleted_at": None,
                "created_at": now(), "updated_at": now(),
            })

    team_ids = []
    for tdata in JO_TEAMS:
        existing = await db.teams.find_one({"name": tdata["name"]})
        if existing:
            team_ids.append(existing["_id"])
            continue
        tid = new_id()
        await db.teams.insert_one({
            "_id": tid, "name": tdata["name"], "short_name": tdata["short"],
            "city": tdata["city"], "logo_url": None,
            "is_active": True, "deleted_at": None,
            "created_at": now(), "updated_at": now(),
        })
        for pname, position, number in tdata["players"]:
            await db.players.insert_one({
                "_id": new_id(), "team_id": tid, "name": pname,
                "position": position, "number": number,
                "is_active": True, "deleted_at": None, "created_at": now(),
            })
        team_ids.append(tid)

    league_id = new_id()
    await db.leagues.insert_one({
        "_id": league_id, "name": JO_LEAGUE["name"], "country": "الأردن",
        "is_active": True, "deleted_at": None,
        "created_at": now(), "updated_at": now(),
    })
    season_id = new_id()
    await db.seasons.insert_one({
        "_id": season_id, "league_id": league_id, "name": JO_LEAGUE["season"],
        "team_ids": team_ids, "status": "ONGOING",
        "is_active": True, "deleted_at": None,
        "created_at": now(), "updated_at": now(),
    })
    # نتائج تجريبية لكل مباريات الدور الأول (مرتبة حسب ترتيب الفرق)
    sample_results = {(0, 1): (2, 1), (0, 2): (1, 1), (0, 3): (3, 0),
                      (1, 2): (0, 2), (1, 3): (2, 2), (2, 3): (1, 0)}
    matches = []
    for rnd_no, pairs in enumerate(_jo_round_robin(team_ids), start=1):
        for home, away in pairs:
            i, j = team_ids.index(home), team_ids.index(away)
            key = (min(i, j), max(i, j))
            hg, ag = sample_results[key]
            if (i, j) != key:  # the fixture came out reversed
                hg, ag = ag, hg
            matches.append({
                "_id": new_id(), "season_id": season_id, "round": rnd_no,
                "home_team_id": home, "away_team_id": away,
                "home_goals": hg, "away_goals": ag, "status": "PLAYED",
                "deleted_at": None, "created_at": now(), "updated_at": now(),
            })
    if matches:
        await db.matches.insert_many(matches)
    for rank, row in enumerate(_jo_standings(team_ids, matches), start=1):
        doc = {"_id": new_id(), "season_id": season_id, "team_id": row["team_id"],
               "rank": rank, "updated_at": now()}
        doc.update({k: v for k, v in row.items() if k != "team_id"})
        await db.standings.insert_one(doc)

    await db.app_meta.insert_one({"_id": "seeded_jo_v1", "at": now()})
    print("Jordan demo seed complete: 2 owners, 3 facilities (عمّان/إربد/العقبة), "
          "4 teams (22 players), 1 league + season with fixtures & standings.")


if __name__ == "__main__":
    asyncio.run(main())
    asyncio.run(seed_jordan_demo())