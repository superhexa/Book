"""Disputes: lifecycle OPEN -> UNDER_REVIEW -> WAITING_FOR_EVIDENCE ->
RESOLVED / REJECTED / ESCALATED, evidence metadata, admin decisions, history."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from security import current_user, has_permission, is_super_admin

router = APIRouter(tags=["disputes"])

DISPUTE_STATUSES = ("OPEN", "UNDER_REVIEW", "WAITING_FOR_EVIDENCE",
                    "RESOLVED", "REJECTED", "ESCALATED")
TERMINAL = ("RESOLVED", "REJECTED")

# Allowed lifecycle transitions.
TRANSITIONS = {
    "OPEN": ("UNDER_REVIEW", "REJECTED"),
    "UNDER_REVIEW": ("WAITING_FOR_EVIDENCE", "RESOLVED", "REJECTED", "ESCALATED"),
    "WAITING_FOR_EVIDENCE": ("UNDER_REVIEW", "RESOLVED", "REJECTED", "ESCALATED"),
    "ESCALATED": ("UNDER_REVIEW", "RESOLVED", "REJECTED"),
    "RESOLVED": (),
    "REJECTED": (),
}

RELATED_TYPES = ("match", "league", "tournament", "team", "other")


# ------------------------------- helpers ----------------------------------
async def get_dispute_or_404(did: str) -> dict:
    d = await db.disputes.find_one({"_id": did, "deleted_at": None})
    if not d:
        raise HTTPException(404, "النزاع غير موجود")
    return d


def _can_view(user: dict, dispute: dict) -> bool:
    return (is_super_admin(user) or has_permission(user, "disputes.read")
            or dispute.get("reporter_id") == user["_id"])


# ------------------------------- models -----------------------------------
class DisputeBody(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    category: str = "general"
    related_type: str = "other"
    related_id: Optional[str] = None


class EvidenceBody(BaseModel):
    file_url: str
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    note: Optional[str] = None


class TransitionBody(BaseModel):
    to_status: str = Field(alias="to")
    note: Optional[str] = None

    class Config:
        populate_by_name = True


class DecisionBody(BaseModel):
    decision: str  # RESOLVED | REJECTED
    notes: Optional[str] = None


# -------------------------------- routes ----------------------------------
@router.post("/disputes", status_code=201)
async def create_dispute(body: DisputeBody, request: Request,
                         user: dict = Depends(current_user)):
    if not has_permission(user, "disputes.create"):
        raise HTTPException(403, "لا تملك صلاحية تقديم نزاع")
    if body.related_type not in RELATED_TYPES:
        raise HTTPException(400, "نوع الجهة المرتبطة غير صالح")
    doc = {"_id": new_id(), "reporter_id": user["_id"],
           **body.model_dump(exclude_none=False),
           "status": "OPEN", "evidence": [],
           "decision": None, "assigned_to": None,
           "history": [{"from_status": None, "to_status": "OPEN",
                        "by_id": user["_id"], "note": None, "at": now()}],
           "deleted_at": None, "created_at": now(), "updated_at": now()}
    await db.disputes.insert_one(doc)
    await write_audit(user, "dispute_created", "disputes", doc["_id"], request)
    return ser(doc)


@router.get("/disputes")
async def list_disputes(status_f: Optional[str] = Query(None, alias="status"),
                        user: dict = Depends(current_user)):
    query = {"deleted_at": None}
    if status_f:
        query["status"] = status_f
    if not (is_super_admin(user) or has_permission(user, "disputes.read")):
        raise HTTPException(403, "لا تملك صلاحية عرض النزاعات")
    privileged = has_permission(user, "disputes.resolve") or is_super_admin(user)
    if not privileged:
        query["reporter_id"] = user["_id"]
    total = await db.disputes.count_documents(query)
    docs = await db.disputes.find(query).sort("created_at", -1).to_list(200)
    return {"items": ser_many(docs), "total": total}


@router.get("/disputes/{did}")
async def get_dispute(did: str, user: dict = Depends(current_user)):
    d = await get_dispute_or_404(did)
    if not _can_view(user, d):
        raise HTTPException(403, "لا تملك صلاحية عرض هذا النزاع")
    return ser(d)


@router.patch("/disputes/{did}")
async def update_dispute(did: str, body: dict, request: Request,
                         user: dict = Depends(current_user)):
    d = await get_dispute_or_404(did)
    if d["status"] in TERMINAL:
        raise HTTPException(400, "لا يمكن تعديل نزاع مغلق")
    if not has_permission(user, "disputes.update"):
        # the reporter may edit their own open dispute
        if not (d.get("reporter_id") == user["_id"] and d["status"] == "OPEN"):
            raise HTTPException(403, "لا تملك صلاحية تعديل هذا النزاع")
    allowed = {"title", "description", "category"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = now()
    await db.disputes.update_one({"_id": did}, {"$set": updates})
    await write_audit(user, "dispute_updated", "disputes", did, request, before=ser(d))
    return ser(await db.disputes.find_one({"_id": did}))


@router.delete("/disputes/{did}")
async def delete_dispute(did: str, request: Request, user: dict = Depends(current_user)):
    d = await get_dispute_or_404(did)
    if not has_permission(user, "disputes.update"):
        raise HTTPException(403, "لا تملك صلاحية حذف النزاع")
    await db.disputes.update_one({"_id": did},
                                 {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "dispute_deleted", "disputes", did, request, before=ser(d))
    return {"ok": True}


@router.post("/disputes/{did}/evidence", status_code=201)
async def add_evidence(did: str, body: EvidenceBody, request: Request,
                       user: dict = Depends(current_user)):
    d = await get_dispute_or_404(did)
    if d["status"] in TERMINAL:
        raise HTTPException(400, "لا يمكن إضافة أدلة لنزاع مغلق")
    if not has_permission(user, "disputes.update"):
        if d.get("reporter_id") != user["_id"]:
            raise HTTPException(403, "لا تملك صلاحية إضافة أدلة لهذا النزاع")
    ev = {"_id": new_id(), "uploaded_by": user["_id"], **body.model_dump(),
          "created_at": now()}
    await db.disputes.update_one({"_id": did}, {
        "$push": {"evidence": ev}, "$set": {"updated_at": now()}})
    await write_audit(user, "dispute_evidence_added", "disputes", did, request)
    return ser(ev)


@router.post("/disputes/{did}/transition")
async def transition_dispute(did: str, body: TransitionBody, request: Request,
                             user: dict = Depends(current_user)):
    if not has_permission(user, "disputes.resolve"):
        raise HTTPException(403, "لا تملك صلاحية معالجة النزاعات")
    d = await get_dispute_or_404(did)
    to = body.to_status
    if to not in TRANSITIONS.get(d["status"], ()):
        raise HTTPException(400, "الانتقال إلى هذه الحالة غير مسموح")
    entry = {"from_status": d["status"], "to_status": to,
             "by_id": user["_id"], "note": body.note, "at": now()}
    before = ser(d)
    await db.disputes.update_one({"_id": did}, {
        "$set": {"status": to, "updated_at": now()},
        "$push": {"history": entry}})
    await write_audit(user, "dispute_transition", "disputes", did, request,
                      before=before, after={"status": to})
    return ser(await db.disputes.find_one({"_id": did}))


@router.post("/disputes/{did}/decision")
async def decide_dispute(did: str, body: DecisionBody, request: Request,
                         user: dict = Depends(current_user)):
    if not has_permission(user, "disputes.resolve"):
        raise HTTPException(403, "لا تملك صلاحية البت في النزاعات")
    d = await get_dispute_or_404(did)
    if body.decision not in ("RESOLVED", "REJECTED"):
        raise HTTPException(400, "القرار يجب أن يكون قبولاً أو رفضاً")
    if d["status"] not in ("UNDER_REVIEW", "ESCALATED", "WAITING_FOR_EVIDENCE", "OPEN"):
        raise HTTPException(400, "لا يمكن البت في النزاع بحالته الحالية")
    entry = {"from_status": d["status"], "to_status": body.decision,
             "by_id": user["_id"], "note": body.notes, "at": now()}
    before = ser(d)
    await db.disputes.update_one({"_id": did}, {
        "$set": {"status": body.decision, "updated_at": now(),
                 "decision": {"decision": body.decision, "notes": body.notes,
                              "decided_by": user["_id"], "decided_at": now()}},
        "$push": {"history": entry}})
    await write_audit(user, "dispute_decided", "disputes", did, request,
                      before=before, after={"status": body.decision})
    return ser(await db.disputes.find_one({"_id": did}))
