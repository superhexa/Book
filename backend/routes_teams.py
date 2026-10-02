"""Teams: CRUD, members, invitations (invite/accept/reject/remove), captain transfer."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from audit import write_audit
from db import db, new_id, now, ser, ser_many
from security import current_user, has_permission, is_super_admin, optional_user

router = APIRouter(tags=["teams"])

INVITATION_STATUSES = ("PENDING", "ACCEPTED", "REJECTED", "CANCELLED")
MEMBER_ROLES = ("captain", "member", "staff")


# ------------------------------ helpers -----------------------------------
def _slugify(name: str) -> str:
    import re
    s = re.sub(r"\s+", "-", name.strip())
    s = re.sub(r"[^\w\-ء-غف-ي]", "", s, flags=re.UNICODE)
    return s.strip("-").lower() or "team"


async def get_team_or_404(tid: str) -> dict:
    t = await db.teams.find_one({"_id": tid, "deleted_at": None})
    if not t:
        raise HTTPException(404, "الفريق غير موجود")
    return t


async def team_membership(user_id: str, team_id: str) -> Optional[dict]:
    return await db.team_members.find_one(
        {"team_id": team_id, "user_id": user_id, "deleted_at": None})


async def assert_team_access(user: dict, team: dict, permission: Optional[str] = None):
    """Owner, captain or super_admin pass; otherwise need the global permission."""
    if is_super_admin(user):
        return
    if team.get("owner_id") == user["_id"]:
        return
    m = await team_membership(user["_id"], team["_id"])
    if m and m.get("role") == "captain":
        return
    if permission and has_permission(user, permission):
        return
    raise HTTPException(403, "لا تملك صلاحية إدارة هذا الفريق")


# ------------------------------- models -----------------------------------
class TeamBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: Optional[str] = None
    description: str = ""
    city: str = ""
    governorate: str = ""
    logo_url: Optional[str] = None
    home_colors: str = ""
    founded_year: Optional[int] = None


class InvitationBody(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: str = "member"


class TransferBody(BaseModel):
    new_captain_user_id: str


# -------------------------------- routes ----------------------------------
@router.post("/teams", status_code=201)
async def create_team(body: TeamBody, request: Request,
                      user: dict = Depends(current_user)):
    if not has_permission(user, "teams.create"):
        raise HTTPException(403, "لا تملك صلاحية إنشاء فريق")
    slug = (body.slug or _slugify(body.name)).strip().lower()
    if await db.teams.find_one({"slug": slug, "deleted_at": None}):
        raise HTTPException(400, "الاسم المختصر مستخدم مسبقاً، اختر اسماً آخر")
    doc = {"_id": new_id(), "owner_id": user["_id"], **body.model_dump(),
           "slug": slug, "is_active": True,
           "deleted_at": None, "created_at": now(), "updated_at": now()}
    await db.teams.insert_one(doc)
    # creator becomes captain
    await db.team_members.insert_one({
        "_id": new_id(), "team_id": doc["_id"], "user_id": user["_id"],
        "role": "captain", "joined_at": now(), "deleted_at": None,
    })
    await write_audit(user, "team_created", "teams", doc["_id"], request)
    return ser(doc)


@router.get("/teams")
async def list_teams(q: Optional[str] = None, governorate: Optional[str] = None,
                    city: Optional[str] = None,
                    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    query = {"deleted_at": None, "is_active": True}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if governorate:
        query["governorate"] = governorate
    if city:
        query["city"] = city
    total = await db.teams.count_documents(query)
    docs = await db.teams.find(query).sort("created_at", -1).skip(
        (page - 1) * limit).limit(limit).to_list(limit)
    return {"items": ser_many(docs), "total": total, "page": page, "limit": limit}


@router.get("/teams/{tid}")
async def get_team(tid: str, user: Optional[dict] = Depends(optional_user)):
    t = await get_team_or_404(tid)
    out = ser(t)
    out["members"] = ser_many(await db.team_members.find(
        {"team_id": tid, "deleted_at": None}).to_list(200))
    return out


@router.patch("/teams/{tid}")
async def update_team(tid: str, body: dict, request: Request,
                      user: dict = Depends(current_user)):
    t = await get_team_or_404(tid)
    await assert_team_access(user, t, "teams.update")
    allowed = set(TeamBody.model_fields.keys()) - {"slug"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "لا توجد حقول قابلة للتحديث")
    updates["updated_at"] = now()
    await db.teams.update_one({"_id": tid}, {"$set": updates})
    await write_audit(user, "team_updated", "teams", tid, request, before=ser(t))
    return ser(await db.teams.find_one({"_id": tid}))


@router.delete("/teams/{tid}")
async def delete_team(tid: str, request: Request, user: dict = Depends(current_user)):
    t = await get_team_or_404(tid)
    await assert_team_access(user, t, "teams.delete")
    await db.teams.update_one({"_id": tid},
                              {"$set": {"deleted_at": now(), "updated_at": now()}})
    await write_audit(user, "team_deleted", "teams", tid, request, before=ser(t))
    return {"ok": True}


@router.get("/teams/{tid}/members")
async def list_members(tid: str):
    await get_team_or_404(tid)
    return ser_many(await db.team_members.find(
        {"team_id": tid, "deleted_at": None}).to_list(200))


# ----------------------------- invitations --------------------------------
@router.post("/teams/{tid}/invitations", status_code=201)
async def invite_member(tid: str, body: InvitationBody, request: Request,
                        user: dict = Depends(current_user)):
    t = await get_team_or_404(tid)
    await assert_team_access(user, t, "teams.manage")
    if body.role not in MEMBER_ROLES:
        raise HTTPException(400, "دور العضو غير صالح")
    if not body.user_id and not body.email:
        raise HTTPException(400, "حدد المستخدم (user_id أو البريد الإلكتروني)")
    target = None
    if body.user_id:
        target = await db.users.find_one({"_id": body.user_id, "deleted_at": None})
        if not target:
            raise HTTPException(404, "المستخدم غير موجود")
    if target and await team_membership(target["_id"], tid):
        raise HTTPException(400, "هذا المستخدم عضو في الفريق مسبقاً")
    if await db.team_invitations.find_one({
            "team_id": tid, "status": "PENDING",
            "$or": ([{"user_id": body.user_id}] if body.user_id else [])
            + ([{"email": (body.email or "").lower()}] if body.email else [])}):
        raise HTTPException(400, "توجد دعوة معلقة لهذا المستخدم مسبقاً")
    doc = {
        "_id": new_id(), "team_id": tid, "inviter_id": user["_id"],
        "user_id": body.user_id, "email": (body.email or "").lower() or None,
        "role": body.role, "status": "PENDING",
        "created_at": now(), "updated_at": now(),
    }
    await db.team_invitations.insert_one(doc)
    await write_audit(user, "team_invitation_sent", "team_invitations", doc["_id"], request)
    return ser(doc)


@router.get("/teams/{tid}/invitations")
async def list_invitations(tid: str, user: dict = Depends(current_user),
                           status_f: Optional[str] = Query(None, alias="status")):
    t = await get_team_or_404(tid)
    await assert_team_access(user, t, "teams.manage")
    query = {"team_id": tid}
    if status_f:
        query["status"] = status_f
    return ser_many(await db.team_invitations.find(query).sort(
        "created_at", -1).to_list(200))


@router.post("/team-invitations/{iid}/accept")
async def accept_invitation(iid: str, request: Request, user: dict = Depends(current_user)):
    inv = await db.team_invitations.find_one({"_id": iid})
    if not inv or inv["status"] != "PENDING":
        raise HTTPException(404, "الدعوة غير موجودة أو منتهية")
    if inv.get("user_id") and inv["user_id"] != user["_id"]:
        raise HTTPException(403, "هذه الدعوة موجهة لمستخدم آخر")
    if inv.get("email") and inv["email"] != (user.get("email") or "").lower():
        raise HTTPException(403, "هذه الدعوة موجهة لمستخدم آخر")
    if await team_membership(user["_id"], inv["team_id"]):
        raise HTTPException(400, "أنت عضو في الفريق مسبقاً")
    await db.team_members.insert_one({
        "_id": new_id(), "team_id": inv["team_id"], "user_id": user["_id"],
        "role": inv.get("role", "member"), "joined_at": now(), "deleted_at": None,
    })
    await db.team_invitations.update_one(
        {"_id": iid}, {"$set": {"status": "ACCEPTED", "updated_at": now()}})
    await write_audit(user, "team_invitation_accepted", "team_invitations", iid, request)
    return ser(await db.team_invitations.find_one({"_id": iid}))


@router.post("/team-invitations/{iid}/reject")
async def reject_invitation(iid: str, request: Request, user: dict = Depends(current_user)):
    inv = await db.team_invitations.find_one({"_id": iid})
    if not inv or inv["status"] != "PENDING":
        raise HTTPException(404, "الدعوة غير موجودة أو منتهية")
    if inv.get("user_id") and inv["user_id"] != user["_id"]:
        raise HTTPException(403, "هذه الدعوة موجهة لمستخدم آخر")
    if inv.get("email") and inv["email"] != (user.get("email") or "").lower():
        raise HTTPException(403, "هذه الدعوة موجهة لمستخدم آخر")
    await db.team_invitations.update_one(
        {"_id": iid}, {"$set": {"status": "REJECTED", "updated_at": now()}})
    await write_audit(user, "team_invitation_rejected", "team_invitations", iid, request)
    return ser(await db.team_invitations.find_one({"_id": iid}))


@router.delete("/team-invitations/{iid}")
async def cancel_invitation(iid: str, request: Request, user: dict = Depends(current_user)):
    inv = await db.team_invitations.find_one({"_id": iid})
    if not inv or inv["status"] != "PENDING":
        raise HTTPException(404, "الدعوة غير موجودة أو منتهية")
    t = await get_team_or_404(inv["team_id"])
    await assert_team_access(user, t, "teams.manage")
    await db.team_invitations.update_one(
        {"_id": iid}, {"$set": {"status": "CANCELLED", "updated_at": now()}})
    await write_audit(user, "team_invitation_cancelled", "team_invitations", iid, request)
    return {"ok": True}


@router.delete("/teams/{tid}/members/{uid}")
async def remove_member(tid: str, uid: str, request: Request,
                        user: dict = Depends(current_user)):
    t = await get_team_or_404(tid)
    await assert_team_access(user, t, "teams.manage")
    m = await team_membership(uid, tid)
    if not m:
        raise HTTPException(404, "العضو غير موجود في الفريق")
    if m.get("role") == "captain":
        raise HTTPException(400, "انقل شارة القيادة أولاً قبل إزالة الكابتن")
    await db.team_members.update_one(
        {"_id": m["_id"]}, {"$set": {"deleted_at": now()}})
    await write_audit(user, "team_member_removed", "team_members", m["_id"], request)
    return {"ok": True}


@router.post("/teams/{tid}/transfer-captain")
async def transfer_captain(tid: str, body: TransferBody, request: Request,
                           user: dict = Depends(current_user)):
    t = await get_team_or_404(tid)
    if is_super_admin(user) or t.get("owner_id") == user["_id"]:
        pass
    else:
        m = await team_membership(user["_id"], tid)
        if not m or m.get("role") != "captain":
            raise HTTPException(403, "فقط الكابتن الحالي أو مالك الفريق يمكنه نقل الشارة")
    target = await team_membership(body.new_captain_user_id, tid)
    if not target:
        raise HTTPException(404, "المستخدم المستهدف ليس عضواً في الفريق")
    old = await db.team_members.find_one(
        {"team_id": tid, "role": "captain", "deleted_at": None})
    if old:
        await db.team_members.update_one(
            {"_id": old["_id"]}, {"$set": {"role": "member"}})
    await db.team_members.update_one(
        {"_id": target["_id"]}, {"$set": {"role": "captain"}})
    await write_audit(user, "team_captain_transferred", "teams", tid, request,
                      before={"old_captain": old["user_id"] if old else None},
                      after={"new_captain": body.new_captain_user_id})
    return {"ok": True}
