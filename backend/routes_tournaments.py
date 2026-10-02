"""Tournaments: CRUD, entries, group generation, bracket generation, entries."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from league_engine import generate_knockout
from security import current_user, has_permission, is_super_admin, optional_user
from routes_teams import assert_team_access, get_team_or_404

router = APIRouter(tags=["tournaments"])

TOURNAMENT_STATUSES = ("DRAFT", "REGISTRATION_OPEN", "ONGOING", "COMPLETED", "CANCELLED")
ENTRY_STATUSES = ("PENDING", "APPROVED", "REJECTED")


# ------------------------------- helpers ----------------------------------
async def get_tournament_or_404(tid: str) -> dict:
    t = await db.tournaments.find_one({"_id": tid, "deleted_at": None})
    if not t:
        raise HTTPException(404, "البطولة غير موجودة")
    return t


# ------------------------------- models -----------------------------------
class TournamentBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    logo_url: Optional[str] = None
    governorate: str = ""
    format: str = "knockout"  # knockout | groups | mixed
    max_teams: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class EntryBody(BaseModel):
    team_id: str


class GroupsBody(BaseModel):
    groups_count: Optional[int] = None
    teams_per_group: Optional[int] = None


class BracketBody(BaseModel):
    source: str = "entries"  # entries | group_winners
    group_winners_per_group: int = 2
    start_date: Optional[datetime] = None
    days_between_rounds: int = 7


# -------------------------------- routes ----------------------------------
@router.post("/tournaments", status_code=201)
async def create_tournament(body: TournamentBody, request: Request,
                            user: dict = Depends(current_user)):
    if not has_permission(user, "tournaments.create"):
        raise HTTPException(403, "لا تملك صلاحية إنشاء بطولة")
    doc = {"_id": new_id(), "created_by": user["_id"], **body.model_dump(),
           "status": "DRAFT", "deleted_at": None,
           "created_at": now(), "updated_at": now()}
    await db.tournaments.insert_one(doc)
    await write_audit(user, "tournament_created", "tournaments", doc["_id"], request)
    return ser(doc)


@router.get("/tournaments")
async def list_tournaments(status_f: Optional[str] = Query(None, alias="status"),
                           page: int = Query(1, ge=1),
                           limit: int = Query(20, ge=1, le=100)):
    query = {"deleted_at": None}
    if status_f:
        query["status"] = status_f
    else:
        query["status"] = {"$in": ["REGISTRATION_OPEN", "ONGOING", "COMPLETED"]}
    total = await db.tournaments.count_documents(query)
    docs = await db.tournaments.find(query).sort("created_at", -1).skip(
        (page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


@router.get("/tournaments/{tid}")
async def get_tournament(tid: str, user: Optional[dict] = Depends(optional_user)):
    t = await get_tournament_or_404(tid)
    if t["status"] == "DRAFT" and not (
            user and (is_super_admin(user) or has_permission(user, "tournaments.read"))):
        raise HTTPException(404, "البطولة غير موجودة")
    return ser(t)


@router.patch("/tournaments/{tid}")
async def update_tournament(tid: str, body: dict, request: Request,
                            user: dict = Depends(current_user)):
    if not has_permission(user, "tournaments.update"):
        raise HTTPException(403, "لا تملك صلاحية تعديل البطولة")
    t = await get_tournament_or_404(tid)
    allowed = set(TournamentBody.model_fields.keys())
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.tournaments.update_one({"_id": tid}, {"$set": updates})
    await write_audit(user, "tournament_updated", "tournaments", tid, request, before=ser(t))
    return ser(await db.tournaments.find_one({"_id": tid}))


@router.delete("/tournaments/{tid}")
async def delete_tournament(tid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "tournaments.delete"):
        raise HTTPException(403, "لا تملك صلاحية حذف البطولة")
    t = await get_tournament_or_404(tid)
    await db.tournaments.update_one({"_id": tid},
                                    {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "tournament_deleted", "tournaments", tid, request, before=ser(t))
    return {"ok": True}


@router.post("/tournaments/{tid}/publish")
async def publish_tournament(tid: str, request: Request,
                             user: dict = Depends(current_user)):
    if not has_permission(user, "tournaments.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة البطولة")
    t = await get_tournament_or_404(tid)
    await db.tournaments.update_one({"_id": tid}, {"$set": {
        "status": "REGISTRATION_OPEN", "updated_at": now()}})
    await write_audit(user, "tournament_published", "tournaments", tid, request)
    return ser(await db.tournaments.find_one({"_id": tid}))


# -------------------------------- entries ---------------------------------
@router.post("/tournaments/{tid}/entries", status_code=201)
async def create_entry(tid: str, body: EntryBody, request: Request,
                       user: dict = Depends(current_user)):
    t = await get_tournament_or_404(tid)
    if t["status"] not in ("REGISTRATION_OPEN", "DRAFT"):
        raise HTTPException(400, "التسجيل في البطولة غير مفتوح حالياً")
    team = await get_team_or_404(body.team_id)
    if not has_permission(user, "tournaments.manage"):
        await assert_team_access(user, team, None)
    if await db.tournament_entries.find_one({"tournament_id": tid,
                                             "team_id": body.team_id,
                                             "deleted_at": None}):
        raise HTTPException(400, "الفريق مسجل مسبقاً في هذه البطولة")
    if t.get("max_teams"):
        count = await db.tournament_entries.count_documents(
            {"tournament_id": tid, "status": "APPROVED", "deleted_at": None})
        if count >= t["max_teams"]:
            raise HTTPException(400, "اكتمل عدد الفرق المسموح به في هذه البطولة")
    doc = {"_id": new_id(), "tournament_id": tid, "team_id": body.team_id,
           "status": "PENDING", "registered_by": user["_id"],
           "deleted_at": None, "created_at": now(), "updated_at": now()}
    await db.tournament_entries.insert_one(doc)
    await write_audit(user, "tournament_entry_created", "tournament_entries",
                      doc["_id"], request)
    return ser(doc)


@router.get("/tournaments/{tid}/entries")
async def list_entries(tid: str, user: dict = Depends(current_user),
                       status_f: Optional[str] = Query(None, alias="status")):
    await get_tournament_or_404(tid)
    if not has_permission(user, "tournaments.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة البطولة")
    query = {"tournament_id": tid, "deleted_at": None}
    if status_f:
        query["status"] = status_f
    return ser_many(await db.tournament_entries.find(query).sort(
        "created_at", 1).to_list(500))


async def _entry_transition(eid: str, to: str, user: dict, request: Request):
    if not has_permission(user, "tournaments.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة البطولة")
    e = await db.tournament_entries.find_one({"_id": eid, "deleted_at": None})
    if not e:
        raise HTTPException(404, "طلب المشاركة غير موجود")
    if to not in ENTRY_STATUSES:
        raise HTTPException(400, "حالة المشاركة غير صالحة")
    before = ser(e)
    await db.tournament_entries.update_one({"_id": eid}, {"$set": {
        "status": to, "decided_by": user["_id"], "updated_at": now()}})
    await write_audit(user, f"tournament_entry_{to.lower()}", "tournament_entries",
                      eid, request, before=before)
    return ser(await db.tournament_entries.find_one({"_id": eid}))


@router.post("/tournament-entries/{eid}/approve")
async def approve_entry(eid: str, request: Request, user: dict = Depends(current_user)):
    return await _entry_transition(eid, "APPROVED", user, request)


@router.post("/tournament-entries/{eid}/reject")
async def reject_entry(eid: str, request: Request, user: dict = Depends(current_user)):
    return await _entry_transition(eid, "REJECTED", user, request)


# ------------------------------- groups -----------------------------------
@router.post("/tournaments/{tid}/generate-groups", status_code=201)
async def generate_groups(tid: str, body: GroupsBody, request: Request,
                          user: dict = Depends(current_user)):
    if not has_permission(user, "tournaments.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة البطولة")
    t = await get_tournament_or_404(tid)
    entries = await db.tournament_entries.find(
        {"tournament_id": tid, "status": "APPROVED", "deleted_at": None}
    ).sort("created_at", 1).to_list(500)
    team_ids = [e["team_id"] for e in entries]
    if len(team_ids) < 2:
        raise HTTPException(400, "يلزم فريقان معتمدان على الأقل لتوليد المجموعات")
    if body.groups_count:
        g = body.groups_count
    elif body.teams_per_group:
        g = max(1, (len(team_ids) + body.teams_per_group - 1) // body.teams_per_group)
    else:
        g = 2 if len(team_ids) <= 8 else 4
    if g < 1 or g > len(team_ids):
        raise HTTPException(400, "عدد المجموعات غير صالح")
    await db.tournament_groups.delete_many({"tournament_id": tid})
    groups = []
    for i in range(g):
        members = [tid_ for idx, tid_ in enumerate(team_ids) if idx % g == i]  # snake seeding
        doc = {"_id": new_id(), "tournament_id": tid,
               "name": f"المجموعة {chr(0x0627 + i)}" if i < 28 else f"المجموعة {i + 1}",
               "team_ids": members, "created_at": now()}
        groups.append(doc)
    if groups:
        await db.tournament_groups.insert_many(groups)
    await write_audit(user, "tournament_groups_generated", "tournament_groups", None,
                      request, after={"tournament_id": tid, "groups": len(groups)})
    return ser_many(groups)


@router.get("/tournaments/{tid}/groups")
async def list_groups(tid: str):
    await get_tournament_or_404(tid)
    return ser_many(await db.tournament_groups.find(
        {"tournament_id": tid}).to_list(100))


# ------------------------------- bracket ----------------------------------
@router.post("/tournaments/{tid}/generate-bracket", status_code=201)
async def generate_bracket(tid: str, body: BracketBody, request: Request,
                           user: dict = Depends(current_user)):
    if not has_permission(user, "tournaments.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة البطولة")
    t = await get_tournament_or_404(tid)
    if body.source == "group_winners":
        groups = await db.tournament_groups.find(
            {"tournament_id": tid}).to_list(100)
        if not groups:
            raise HTTPException(400, "ولّد المجموعات أولاً قبل إنشاء القرعة")
        team_ids = []
        for gdoc in groups:
            team_ids.extend((gdoc.get("team_ids") or [])[:body.group_winners_per_group])
    else:
        entries = await db.tournament_entries.find(
            {"tournament_id": tid, "status": "APPROVED", "deleted_at": None}
        ).sort("created_at", 1).to_list(500)
        team_ids = [e["team_id"] for e in entries]
    if len(team_ids) < 2:
        raise HTTPException(400, "يلزم فريقان معتمدان على الأقل لإنشاء القرعة")
    bracket = generate_knockout(team_ids)
    await db.tournament_rounds.delete_many({"tournament_id": tid})
    rounds_docs = []
    for rnd in bracket:
        doc = {"_id": new_id(), "tournament_id": tid, "round": rnd["round"],
               "round_name": rnd["round_name"], "matches": rnd["matches"],
               "created_at": now()}
        rounds_docs.append(doc)
    if rounds_docs:
        await db.tournament_rounds.insert_many(rounds_docs)
    # materialize the first round as real matches
    base = body.start_date or now()
    created = 0
    for m in bracket[0]["matches"]:
        if not m["home_team_id"] or not m["away_team_id"]:
            continue
        await db.matches.insert_one({
            "_id": new_id(), "league_id": None, "season_id": None,
            "tournament_id": tid, "division_id": None,
            "home_team_id": m["home_team_id"], "away_team_id": m["away_team_id"],
            "round": 1, "round_name": bracket[0]["round_name"],
            "status": "SCHEDULED", "scheduled_at": base,
            "venue": None, "home_score": None, "away_score": None,
            "referee_id": None, "created_by": user["_id"],
            "deleted_at": None, "created_at": now(), "updated_at": now(),
        })
        created += 1
    await db.tournaments.update_one({"_id": tid},
                                    {"$set": {"status": "ONGOING", "updated_at": now()}})
    await write_audit(user, "tournament_bracket_generated", "tournament_rounds", None,
                      request, after={"tournament_id": tid, "matches": created})
    return {"rounds": ser_many(rounds_docs), "matches_created": created}


@router.get("/tournaments/{tid}/bracket")
async def get_bracket(tid: str):
    await get_tournament_or_404(tid)
    rounds = await db.tournament_rounds.find(
        {"tournament_id": tid}).sort("round", 1).to_list(20)
    return ser_many(rounds)
