"""Leagues, seasons, divisions; team registration (apply/approve/reject/waitlist);
publish/freeze; fixture generation; standings view/recalculation."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from league_engine import generate_knockout, generate_round_robin, recalculate_standings
from security import current_user, has_permission, is_super_admin, optional_user
from routes_teams import assert_team_access, get_team_or_404, team_membership

router = APIRouter(tags=["leagues"])

LEAGUE_STATUSES = ("DRAFT", "PUBLISHED", "ACTIVE", "COMPLETED", "FROZEN")
REGISTRATION_STATUSES = ("PENDING", "APPROVED", "REJECTED", "WAITLISTED")


# ------------------------------- helpers ----------------------------------
async def get_league_or_404(lid: str) -> dict:
    l = await db.leagues.find_one({"_id": lid, "deleted_at": None})
    if not l:
        raise HTTPException(404, "الدوري غير موجود")
    return l


async def get_season_or_404(sid: str) -> dict:
    s = await db.seasons.find_one({"_id": sid, "deleted_at": None})
    if not s:
        raise HTTPException(404, "الموسم غير موجود")
    return s


def _guard_not_frozen(league: dict):
    if league.get("status") == "FROZEN":
        raise HTTPException(400, "الدوري مجمّد ولا يمكن تعديله")


# ------------------------------- models -----------------------------------
class LeagueBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    logo_url: Optional[str] = None
    governorate: str = ""
    format: str = "league"  # league | knockout | mixed
    max_teams: Optional[int] = None
    rules: list = []


class SeasonBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class DivisionBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    level: int = 1


class RegisterBody(BaseModel):
    team_id: str


class FixturesBody(BaseModel):
    format: str = "round_robin"  # round_robin | double_round_robin | knockout
    division_id: Optional[str] = None
    start_date: Optional[datetime] = None
    days_between_rounds: int = 7


# -------------------------------- leagues ---------------------------------
@router.post("/leagues", status_code=201)
async def create_league(body: LeagueBody, request: Request,
                        user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.create"):
        raise HTTPException(403, "لا تملك صلاحية إنشاء دوري")
    doc = {"_id": new_id(), "created_by": user["_id"], **body.model_dump(),
           "status": "DRAFT", "deleted_at": None,
           "created_at": now(), "updated_at": now()}
    await db.leagues.insert_one(doc)
    await write_audit(user, "league_created", "leagues", doc["_id"], request)
    return ser(doc)


@router.get("/leagues")
async def list_leagues(status_f: Optional[str] = Query(None, alias="status"),
                       governorate: Optional[str] = None,
                       page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    query = {"deleted_at": None}
    if status_f:
        query["status"] = status_f
    else:
        query["status"] = {"$in": ["PUBLISHED", "ACTIVE", "COMPLETED"]}
    if governorate:
        query["governorate"] = governorate
    total = await db.leagues.count_documents(query)
    docs = await db.leagues.find(query).sort("created_at", -1).skip(
        (page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


@router.get("/leagues/{lid}")
async def get_league(lid: str, user: Optional[dict] = Depends(optional_user)):
    l = await get_league_or_404(lid)
    if l["status"] == "DRAFT" and not (
            user and (is_super_admin(user) or has_permission(user, "leagues.read"))):
        raise HTTPException(404, "الدوري غير موجود")
    out = ser(l)
    out["seasons"] = ser_many(await db.seasons.find(
        {"league_id": lid, "deleted_at": None}).sort("created_at", 1).to_list(50))
    return out


@router.patch("/leagues/{lid}")
async def update_league(lid: str, body: dict, request: Request,
                        user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.update"):
        raise HTTPException(403, "لا تملك صلاحية تعديل الدوري")
    l = await get_league_or_404(lid)
    _guard_not_frozen(l)
    allowed = set(LeagueBody.model_fields.keys())
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.leagues.update_one({"_id": lid}, {"$set": updates})
    await write_audit(user, "league_updated", "leagues", lid, request, before=ser(l))
    return ser(await db.leagues.find_one({"_id": lid}))


@router.delete("/leagues/{lid}")
async def delete_league(lid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.delete"):
        raise HTTPException(403, "لا تملك صلاحية حذف الدوري")
    l = await get_league_or_404(lid)
    await db.leagues.update_one({"_id": lid},
                                {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "league_deleted", "leagues", lid, request, before=ser(l))
    return {"ok": True}


@router.post("/leagues/{lid}/publish")
async def publish_league(lid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.publish"):
        raise HTTPException(403, "لا تملك صلاحية نشر الدوري")
    l = await get_league_or_404(lid)
    if l["status"] not in ("DRAFT",):
        raise HTTPException(400, "يمكن نشر الدوري من حالة المسودة فقط")
    await db.leagues.update_one({"_id": lid},
                                {"$set": {"status": "PUBLISHED", "updated_at": now()}})
    await write_audit(user, "league_published", "leagues", lid, request)
    return ser(await db.leagues.find_one({"_id": lid}))


@router.post("/leagues/{lid}/freeze")
async def freeze_league(lid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة الدوري")
    l = await get_league_or_404(lid)
    await db.leagues.update_one({"_id": lid},
                                {"$set": {"status": "FROZEN", "updated_at": now()}})
    await write_audit(user, "league_frozen", "leagues", lid, request, before=ser(l))
    return ser(await db.leagues.find_one({"_id": lid}))


# -------------------------------- seasons ---------------------------------
@router.post("/leagues/{lid}/seasons", status_code=201)
async def create_season(lid: str, body: SeasonBody, request: Request,
                        user: dict = Depends(current_user)):
    if not has_permission(user, "seasons.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة المواسم")
    l = await get_league_or_404(lid)
    _guard_not_frozen(l)
    doc = {"_id": new_id(), "league_id": lid, **body.model_dump(),
           "status": "DRAFT", "deleted_at": None,
           "created_at": now(), "updated_at": now()}
    await db.seasons.insert_one(doc)
    await write_audit(user, "season_created", "seasons", doc["_id"], request)
    return ser(doc)


@router.get("/leagues/{lid}/seasons")
async def list_seasons(lid: str):
    await get_league_or_404(lid)
    return ser_many(await db.seasons.find(
        {"league_id": lid, "deleted_at": None}).sort("created_at", 1).to_list(50))


@router.get("/seasons/{sid}")
async def get_season(sid: str):
    s = await get_season_or_404(sid)
    out = ser(s)
    out["divisions"] = ser_many(await db.divisions.find(
        {"season_id": sid, "deleted_at": None}).sort("level", 1).to_list(50))
    return out


@router.patch("/seasons/{sid}")
async def update_season(sid: str, body: dict, request: Request,
                        user: dict = Depends(current_user)):
    if not has_permission(user, "seasons.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة المواسم")
    s = await get_season_or_404(sid)
    allowed = set(SeasonBody.model_fields.keys()) | {"status"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.seasons.update_one({"_id": sid}, {"$set": updates})
    await write_audit(user, "season_updated", "seasons", sid, request, before=ser(s))
    return ser(await db.seasons.find_one({"_id": sid}))


@router.delete("/seasons/{sid}")
async def delete_season(sid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "seasons.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة المواسم")
    s = await get_season_or_404(sid)
    await db.seasons.update_one({"_id": sid},
                                {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "season_deleted", "seasons", sid, request, before=ser(s))
    return {"ok": True}


# ------------------------------- divisions --------------------------------
@router.post("/seasons/{sid}/divisions", status_code=201)
async def create_division(sid: str, body: DivisionBody, request: Request,
                          user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة الدوري")
    s = await get_season_or_404(sid)
    doc = {"_id": new_id(), "league_id": s["league_id"], "season_id": sid,
           **body.model_dump(), "deleted_at": None,
           "created_at": now(), "updated_at": now()}
    await db.divisions.insert_one(doc)
    await write_audit(user, "division_created", "divisions", doc["_id"], request)
    return ser(doc)


@router.get("/seasons/{sid}/divisions")
async def list_divisions(sid: str):
    await get_season_or_404(sid)
    return ser_many(await db.divisions.find(
        {"season_id": sid, "deleted_at": None}).sort("level", 1).to_list(50))


@router.patch("/divisions/{did}")
async def update_division(did: str, body: dict, request: Request,
                          user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة الدوري")
    d = await db.divisions.find_one({"_id": did, "deleted_at": None})
    if not d:
        raise HTTPException(404, "الدرجة غير موجودة")
    allowed = set(DivisionBody.model_fields.keys())
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.divisions.update_one({"_id": did}, {"$set": updates})
    await write_audit(user, "division_updated", "divisions", did, request, before=ser(d))
    return ser(await db.divisions.find_one({"_id": did}))


@router.delete("/divisions/{did}")
async def delete_division(did: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة الدوري")
    d = await db.divisions.find_one({"_id": did, "deleted_at": None})
    if not d:
        raise HTTPException(404, "الدرجة غير موجودة")
    await db.divisions.update_one({"_id": did},
                                  {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "division_deleted", "divisions", did, request)
    return {"ok": True}


# ------------------------------ registration ------------------------------
@router.post("/leagues/{lid}/seasons/{sid}/register", status_code=201)
async def register_team(lid: str, sid: str, body: RegisterBody, request: Request,
                        user: dict = Depends(current_user)):
    l = await get_league_or_404(lid)
    _guard_not_frozen(l)
    s = await get_season_or_404(sid)
    if s["league_id"] != lid:
        raise HTTPException(400, "الموسم لا يتبع هذا الدوري")
    t = await get_team_or_404(body.team_id)
    # only team owner/captain (or a league manager) may register the team
    if not has_permission(user, "leagues.manage"):
        await assert_team_access(user, t, None)
    if await db.league_teams.find_one({"league_id": lid, "season_id": sid,
                                       "team_id": body.team_id, "deleted_at": None}):
        raise HTTPException(400, "الفريق مسجل مسبقاً في هذا الموسم")
    if l.get("max_teams"):
        approved = await db.league_teams.count_documents(
            {"league_id": lid, "season_id": sid, "status": "APPROVED", "deleted_at": None})
        if approved >= l["max_teams"]:
            raise HTTPException(400, "اكتمل عدد الفرق المسموح به في هذا الدوري")
    doc = {"_id": new_id(), "league_id": lid, "season_id": sid,
           "team_id": body.team_id, "division_id": None,
           "status": "PENDING", "registered_by": user["_id"],
           "deleted_at": None, "created_at": now(), "updated_at": now()}
    await db.league_teams.insert_one(doc)
    await write_audit(user, "league_team_registered", "league_teams", doc["_id"], request)
    return ser(doc)


@router.get("/leagues/{lid}/seasons/{sid}/registrations")
async def list_registrations(lid: str, sid: str, user: dict = Depends(current_user),
                             status_f: Optional[str] = Query(None, alias="status")):
    if not has_permission(user, "leagues.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة الدوري")
    query = {"league_id": lid, "season_id": sid, "deleted_at": None}
    if status_f:
        query["status"] = status_f
    return ser_many(await db.league_teams.find(query).sort(
        "created_at", 1).to_list(500))


async def _registration_transition(rid: str, to: str, user: dict, request: Request):
    if not has_permission(user, "leagues.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة الدوري")
    reg = await db.league_teams.find_one({"_id": rid, "deleted_at": None})
    if not reg:
        raise HTTPException(404, "طلب التسجيل غير موجود")
    if to not in REGISTRATION_STATUSES:
        raise HTTPException(400, "حالة التسجيل غير صالحة")
    before = ser(reg)
    await db.league_teams.update_one({"_id": rid},
                                     {"$set": {"status": to, "updated_at": now(),
                                               "decided_by": user["_id"]}})
    await write_audit(user, f"league_registration_{to.lower()}", "league_teams",
                      rid, request, before=before)
    return ser(await db.league_teams.find_one({"_id": rid}))


@router.post("/league-registrations/{rid}/approve")
async def approve_registration(rid: str, request: Request, user: dict = Depends(current_user)):
    return await _registration_transition(rid, "APPROVED", user, request)


@router.post("/league-registrations/{rid}/reject")
async def reject_registration(rid: str, request: Request, user: dict = Depends(current_user)):
    return await _registration_transition(rid, "REJECTED", user, request)


@router.post("/league-registrations/{rid}/waitlist")
async def waitlist_registration(rid: str, request: Request, user: dict = Depends(current_user)):
    return await _registration_transition(rid, "WAITLISTED", user, request)


# ------------------------------- fixtures ---------------------------------
@router.post("/leagues/{lid}/seasons/{sid}/generate-fixtures", status_code=201)
async def generate_fixtures(lid: str, sid: str, body: FixturesBody, request: Request,
                            user: dict = Depends(current_user)):
    if not has_permission(user, "leagues.manage"):
        raise HTTPException(403, "لا تملك صلاحية إدارة الدوري")
    l = await get_league_or_404(lid)
    _guard_not_frozen(l)
    s = await get_season_or_404(sid)
    if s["league_id"] != lid:
        raise HTTPException(400, "الموسم لا يتبع هذا الدوري")
    regs = await db.league_teams.find({"league_id": lid, "season_id": sid,
                                       "status": "APPROVED", "deleted_at": None}).to_list(500)
    team_ids = [r["team_id"] for r in regs]
    if len(team_ids) < 2:
        raise HTTPException(400, "يلزم فريقان معتمدان على الأقل لتوليد المباريات")
    if body.format == "knockout":
        bracket = generate_knockout(team_ids)
        pairings = [m for rnd in bracket for m in rnd["matches"]
                    if m["home_team_id"] and m["away_team_id"]]
        rounds = None
    elif body.format in ("round_robin", "double_round_robin"):
        rounds = generate_round_robin(team_ids, double=(body.format == "double_round_robin"))
    else:
        raise HTTPException(400, "صيغة توليد المباريات غير صالحة")

    from datetime import timedelta
    created = 0
    base = body.start_date or now()
    if rounds is not None:
        for ri, rnd in enumerate(rounds):
            for hi, (h, a) in enumerate(rnd):
                when = base + timedelta(days=ri * body.days_between_rounds)
                await db.matches.insert_one({
                    "_id": new_id(), "league_id": lid, "season_id": sid,
                    "tournament_id": None, "division_id": body.division_id,
                    "home_team_id": h, "away_team_id": a,
                    "round": ri + 1, "round_name": f"الجولة {ri + 1}",
                    "status": "SCHEDULED", "scheduled_at": when,
                    "venue": None, "home_score": None, "away_score": None,
                    "referee_id": None, "created_by": user["_id"],
                    "deleted_at": None, "created_at": now(), "updated_at": now(),
                })
                created += 1
    else:  # knockout: first round only, rest scheduled as rounds progress
        for i, m in enumerate(pairings):
            await db.matches.insert_one({
                "_id": new_id(), "league_id": lid, "season_id": sid,
                "tournament_id": None, "division_id": body.division_id,
                "home_team_id": m["home_team_id"], "away_team_id": m["away_team_id"],
                "round": 1, "round_name": bracket[0]["round_name"],
                "status": "SCHEDULED", "scheduled_at": base,
                "venue": None, "home_score": None, "away_score": None,
                "referee_id": None, "created_by": user["_id"],
                "deleted_at": None, "created_at": now(), "updated_at": now(),
            })
            created += 1
    await write_audit(user, "league_fixtures_generated", "matches", None, request,
                      after={"league_id": lid, "season_id": sid, "count": created})
    return {"created": created, "format": body.format}


# ------------------------------- standings --------------------------------
@router.get("/leagues/{lid}/seasons/{sid}/standings")
async def get_standings(lid: str, sid: str):
    await get_league_or_404(lid)
    await get_season_or_404(sid)
    docs = await db.standings.find({"league_id": lid, "season_id": sid}).sort(
        [("points", -1), ("gd", -1), ("gf", -1)]).to_list(500)
    return ser_many(docs)


@router.post("/leagues/{lid}/seasons/{sid}/standings/recalculate")
async def recalculate(lid: str, sid: str, request: Request,
                      user: dict = Depends(current_user)):
    if not has_permission(user, "standings.recalculate"):
        raise HTTPException(403, "لا تملك صلاحية إعادة حساب الترتيب")
    await get_league_or_404(lid)
    s = await get_season_or_404(sid)
    if s["league_id"] != lid:
        raise HTTPException(400, "الموسم لا يتبع هذا الدوري")
    rows = await recalculate_standings(lid, sid)
    await write_audit(user, "standings_recalculated", "standings", None, request,
                      after={"league_id": lid, "season_id": sid, "teams": len(rows)})
    return rows
