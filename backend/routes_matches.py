"""Matches: CRUD, referee assignment, live events, and the result authorization
workflow (UNDER_REVIEW -> FINISHED)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from league_engine import recalculate_standings
from security import current_user, has_permission, is_super_admin, optional_user

router = APIRouter(tags=["matches"])

MATCH_STATUSES = ("SCHEDULED", "LIVE", "UNDER_REVIEW", "FINISHED", "CANCELLED", "POSTPONED")
EVENT_TYPES = ("GOAL", "OWN_GOAL", "PENALTY_GOAL", "YELLOW_CARD", "RED_CARD",
               "SUBSTITUTION", "KICKOFF", "HALFTIME", "FULLTIME", "NOTE")


# ------------------------------- helpers ----------------------------------
async def get_match_or_404(mid: str) -> dict:
    m = await db.matches.find_one({"_id": mid, "deleted_at": None})
    if not m:
        raise HTTPException(404, "المباراة غير موجودة")
    return m


async def _is_match_official(user: dict, match: dict) -> bool:
    """True if the user is a referee assigned to this match."""
    ref = await db.referees.find_one({"user_id": user["_id"], "deleted_at": None})
    if not ref:
        return False
    assign = await db.referee_assignments.find_one({
        "match_id": match["_id"], "referee_id": ref["_id"], "deleted_at": None})
    return assign is not None


async def _can_record_live(user: dict, match: dict) -> bool:
    return has_permission(user, "matches.live") or await _is_match_official(user, match)


async def _can_submit_result(user: dict, match: dict) -> bool:
    return has_permission(user, "matches.result") or await _is_match_official(user, match)


# ------------------------------- models -----------------------------------
class MatchBody(BaseModel):
    league_id: Optional[str] = None
    season_id: Optional[str] = None
    tournament_id: Optional[str] = None
    division_id: Optional[str] = None
    home_team_id: str
    away_team_id: str
    scheduled_at: Optional[datetime] = None
    venue: Optional[str] = None
    round: Optional[int] = None
    round_name: Optional[str] = None


class RescheduleBody(BaseModel):
    scheduled_at: datetime


class EventBody(BaseModel):
    type: str
    team_id: Optional[str] = None
    player_id: Optional[str] = None
    player_name: Optional[str] = None
    minute: Optional[int] = Field(default=None, ge=0, le=150)
    note: Optional[str] = None


class LineupBody(BaseModel):
    team_id: str
    starters: list = []
    substitutes: list = []
    formation: Optional[str] = None


class ResultBody(BaseModel):
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)
    notes: Optional[str] = None


class AssignRefereeBody(BaseModel):
    referee_id: str


# -------------------------------- routes ----------------------------------
@router.post("/matches", status_code=201)
async def create_match(body: MatchBody, request: Request,
                       user: dict = Depends(current_user)):
    if not has_permission(user, "matches.create"):
        raise HTTPException(403, "لا تملك صلاحية إنشاء مباراة")
    if body.home_team_id == body.away_team_id:
        raise HTTPException(400, "لا يمكن أن يلعب الفريق ضد نفسه")
    for tid in (body.home_team_id, body.away_team_id):
        if not await db.teams.find_one({"_id": tid, "deleted_at": None}):
            raise HTTPException(404, "أحد الفريقين غير موجود")
    doc = {"_id": new_id(), **body.model_dump(), "status": "SCHEDULED",
           "home_score": None, "away_score": None, "referee_id": None,
           "result_submitted_by": None, "created_by": user["_id"],
           "deleted_at": None, "created_at": now(), "updated_at": now()}
    await db.matches.insert_one(doc)
    await write_audit(user, "match_created", "matches", doc["_id"], request)
    return ser(doc)


@router.get("/matches")
async def list_matches(league_id: Optional[str] = None, season_id: Optional[str] = None,
                       tournament_id: Optional[str] = None, team_id: Optional[str] = None,
                       status_f: Optional[str] = Query(None, alias="status"),
                       page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    query = {"deleted_at": None}
    if league_id:
        query["league_id"] = league_id
    if season_id:
        query["season_id"] = season_id
    if tournament_id:
        query["tournament_id"] = tournament_id
    if team_id:
        query["$or"] = [{"home_team_id": team_id}, {"away_team_id": team_id}]
    if status_f:
        query["status"] = status_f
    total = await db.matches.count_documents(query)
    docs = await db.matches.find(query).sort("scheduled_at", 1).skip(
        (page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


@router.get("/matches/{mid}")
async def get_match(mid: str, user: Optional[dict] = Depends(optional_user)):
    m = await get_match_or_404(mid)
    out = ser(m)
    out["events"] = ser_many(await db.match_events.find(
        {"match_id": mid}).sort("minute", 1).to_list(500))
    out["lineups"] = ser_many(await db.match_lineups.find(
        {"match_id": mid}).to_list(10))
    return out


@router.patch("/matches/{mid}")
async def update_match(mid: str, body: dict, request: Request,
                       user: dict = Depends(current_user)):
    if not has_permission(user, "matches.update"):
        raise HTTPException(403, "لا تملك صلاحية تعديل المباراة")
    m = await get_match_or_404(mid)
    if m["status"] in ("LIVE", "FINISHED"):
        raise HTTPException(400, "لا يمكن تعديل مباراة جارية أو منتهية")
    allowed = {"venue", "round", "round_name", "division_id", "league_id", "season_id"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.matches.update_one({"_id": mid}, {"$set": updates})
    await write_audit(user, "match_updated", "matches", mid, request, before=ser(m))
    return ser(await db.matches.find_one({"_id": mid}))


@router.delete("/matches/{mid}")
async def delete_match(mid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "matches.update"):
        raise HTTPException(403, "لا تملك صلاحية حذف المباراة")
    m = await get_match_or_404(mid)
    await db.matches.update_one({"_id": mid},
                                {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "match_deleted", "matches", mid, request, before=ser(m))
    return {"ok": True}


@router.post("/matches/{mid}/reschedule")
async def reschedule_match(mid: str, body: RescheduleBody, request: Request,
                           user: dict = Depends(current_user)):
    if not has_permission(user, "matches.reschedule"):
        raise HTTPException(403, "لا تملك صلاحية إعادة جدولة المباراة")
    m = await get_match_or_404(mid)
    if m["status"] in ("LIVE", "FINISHED", "CANCELLED"):
        raise HTTPException(400, "لا يمكن إعادة جدولة هذه المباراة بحالتها الحالية")
    before = ser(m)
    await db.matches.update_one({"_id": mid}, {"$set": {
        "scheduled_at": body.scheduled_at, "status": "SCHEDULED", "updated_at": now()}})
    await write_audit(user, "match_rescheduled", "matches", mid, request, before=before)
    return ser(await db.matches.find_one({"_id": mid}))


@router.post("/matches/{mid}/cancel")
async def cancel_match(mid: str, request: Request, user: dict = Depends(current_user)):
    if not has_permission(user, "matches.cancel"):
        raise HTTPException(403, "لا تملك صلاحية إلغاء المباراة")
    m = await get_match_or_404(mid)
    if m["status"] == "FINISHED":
        raise HTTPException(400, "لا يمكن إلغاء مباراة منتهية")
    before = ser(m)
    await db.matches.update_one({"_id": mid}, {"$set": {
        "status": "CANCELLED", "updated_at": now()}})
    await write_audit(user, "match_cancelled", "matches", mid, request, before=before)
    return ser(await db.matches.find_one({"_id": mid}))


@router.post("/matches/{mid}/start")
async def start_match(mid: str, request: Request, user: dict = Depends(current_user)):
    if not await _can_record_live(user, await get_match_or_404(mid)):
        raise HTTPException(403, "لا تملك صلاحية بدء المباراة")
    m = await get_match_or_404(mid)
    if m["status"] not in ("SCHEDULED", "POSTPONED"):
        raise HTTPException(400, "لا يمكن بدء المباراة بحالتها الحالية")
    await db.matches.update_one({"_id": mid}, {"$set": {
        "status": "LIVE", "home_score": 0, "away_score": 0, "updated_at": now()}})
    await write_audit(user, "match_started", "matches", mid, request)
    return ser(await db.matches.find_one({"_id": mid}))


# ---------------------------- referee assignment ---------------------------
@router.post("/matches/{mid}/assign-referee")
async def assign_referee(mid: str, body: AssignRefereeBody, request: Request,
                         user: dict = Depends(current_user)):
    if not has_permission(user, "referees.assign"):
        raise HTTPException(403, "لا تملك صلاحية تعيين الحكام")
    m = await get_match_or_404(mid)
    ref = await db.referees.find_one({"_id": body.referee_id, "deleted_at": None})
    if not ref:
        raise HTTPException(404, "الحكم غير موجود")
    existing = await db.referee_assignments.find_one(
        {"match_id": mid, "referee_id": body.referee_id, "deleted_at": None})
    if existing:
        raise HTTPException(400, "هذا الحكم معيّن مسبقاً لهذه المباراة")
    doc = {"_id": new_id(), "match_id": mid, "referee_id": body.referee_id,
           "role": "main", "assigned_by": user["_id"],
           "deleted_at": None, "created_at": now()}
    await db.referee_assignments.insert_one(doc)
    await db.matches.update_one({"_id": mid},
                                {"$set": {"referee_id": body.referee_id, "updated_at": now()}})
    await write_audit(user, "match_referee_assigned", "matches", mid, request,
                      after={"referee_id": body.referee_id})
    return ser(doc)


@router.delete("/matches/{mid}/assign-referee/{aid}")
async def unassign_referee(mid: str, aid: str, request: Request,
                           user: dict = Depends(current_user)):
    if not has_permission(user, "referees.assign"):
        raise HTTPException(403, "لا تملك صلاحية تعيين الحكام")
    a = await db.referee_assignments.find_one(
        {"_id": aid, "match_id": mid, "deleted_at": None})
    if not a:
        raise HTTPException(404, "التعيين غير موجود")
    await db.referee_assignments.update_one(
        {"_id": aid}, {"$set": {"deleted_at": now()}})
    await write_audit(user, "match_referee_unassigned", "matches", mid, request)
    return {"ok": True}


# ------------------------------- live events ------------------------------
@router.post("/matches/{mid}/events", status_code=201)
async def record_event(mid: str, body: EventBody, request: Request,
                       user: dict = Depends(current_user)):
    m = await get_match_or_404(mid)
    if not await _can_record_live(user, m):
        raise HTTPException(403, "لا تملك صلاحية تسجيل أحداث المباراة")
    if m["status"] != "LIVE":
        raise HTTPException(400, "يمكن تسجيل الأحداث فقط أثناء سير المباراة")
    if body.type not in EVENT_TYPES:
        raise HTTPException(400, "نوع الحدث غير صالح")
    if body.team_id and body.team_id not in (m["home_team_id"], m["away_team_id"]):
        raise HTTPException(400, "الفريق لا يشارك في هذه المباراة")
    ev = {"_id": new_id(), "match_id": mid, **body.model_dump(),
          "recorded_by": user["_id"], "created_at": now()}
    await db.match_events.insert_one(ev)
    # keep the live score in sync
    if body.type in ("GOAL", "PENALTY_GOAL"):
        field = "home_score" if body.team_id == m["home_team_id"] else "away_score"
        await db.matches.update_one({"_id": mid}, {"$inc": {field: 1},
                                                  "$set": {"updated_at": now()}})
    elif body.type == "OWN_GOAL":
        field = "away_score" if body.team_id == m["home_team_id"] else "home_score"
        await db.matches.update_one({"_id": mid}, {"$inc": {field: 1},
                                                  "$set": {"updated_at": now()}})
    await write_audit(user, "match_event_recorded", "match_events", ev["_id"], request,
                      after={"match_id": mid, "type": body.type})
    return ser(ev)


@router.post("/matches/{mid}/lineups", status_code=201)
async def submit_lineup(mid: str, body: LineupBody, request: Request,
                        user: dict = Depends(current_user)):
    m = await get_match_or_404(mid)
    if not await _can_record_live(user, m):
        raise HTTPException(403, "لا تملك صلاحية تسجيل التشكيلة")
    if body.team_id not in (m["home_team_id"], m["away_team_id"]):
        raise HTTPException(400, "الفريق لا يشارك في هذه المباراة")
    doc = {"_id": new_id(), "match_id": mid, **body.model_dump(),
           "submitted_by": user["_id"], "created_at": now(), "updated_at": now()}
    await db.match_lineups.update_one(
        {"match_id": mid, "team_id": body.team_id},
        {"$set": doc}, upsert=True)
    await write_audit(user, "match_lineup_submitted", "match_lineups", doc["_id"], request)
    return ser(doc)


# ---------------------------- result workflow -----------------------------
@router.post("/matches/{mid}/submit-result")
async def submit_result(mid: str, body: ResultBody, request: Request,
                        user: dict = Depends(current_user)):
    m = await get_match_or_404(mid)
    if not await _can_submit_result(user, m):
        raise HTTPException(403, "لا تملك صلاحية إرسال نتيجة المباراة")
    if m["status"] not in ("LIVE", "SCHEDULED"):
        raise HTTPException(400, "لا يمكن إرسال النتيجة بحالة المباراة الحالية")
    before = ser(m)
    await db.matches.update_one({"_id": mid}, {"$set": {
        "home_score": body.home_score, "away_score": body.away_score,
        "status": "UNDER_REVIEW", "result_submitted_by": user["_id"],
        "result_notes": body.notes, "updated_at": now()}})
    await write_audit(user, "match_result_submitted", "matches", mid, request,
                      before=before,
                      after={"home_score": body.home_score, "away_score": body.away_score})
    return ser(await db.matches.find_one({"_id": mid}))


@router.post("/matches/{mid}/approve-result")
async def approve_result(mid: str, request: Request,
                         user: dict = Depends(current_user)):
    if not has_permission(user, "matches.result"):
        raise HTTPException(403, "لا تملك صلاحية اعتماد النتائج")
    m = await get_match_or_404(mid)
    if m["status"] != "UNDER_REVIEW":
        raise HTTPException(400, "النتيجة ليست قيد المراجعة")
    before = ser(m)
    await db.matches.update_one({"_id": mid}, {"$set": {
        "status": "FINISHED", "updated_at": now()}})
    # refresh standings for league fixtures
    if m.get("league_id") and m.get("season_id"):
        await recalculate_standings(m["league_id"], m["season_id"])
    await write_audit(user, "match_result_approved", "matches", mid, request,
                      before=before, after={"status": "FINISHED"})
    return ser(await db.matches.find_one({"_id": mid}))


@router.post("/matches/{mid}/reject-result")
async def reject_result(mid: str, request: Request,
                        user: dict = Depends(current_user)):
    if not has_permission(user, "matches.result"):
        raise HTTPException(403, "لا تملك صلاحية اعتماد النتائج")
    m = await get_match_or_404(mid)
    if m["status"] != "UNDER_REVIEW":
        raise HTTPException(400, "النتيجة ليست قيد المراجعة")
    before = ser(m)
    await db.matches.update_one({"_id": mid}, {"$set": {
        "status": "LIVE", "updated_at": now()}})
    await write_audit(user, "match_result_rejected", "matches", mid, request,
                      before=before, after={"status": "LIVE"})
    return ser(await db.matches.find_one({"_id": mid}))
