from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from audit import write_audit
from db import db, new_id, now
from ratelimit import limiter
from rbac import DEFAULT_ROLES
from security import (current_user, digest, hash_password, issue_session,
                      make_access_token, random_token, verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED = 5
LOCK_MINUTES = 15


class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    role: str = Field(default="customer")  # "customer" or "owner"


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenBody(BaseModel):
    token: str


class ForgotBody(BaseModel):
    email: EmailStr


class ResetBody(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


async def _public_user(user: dict) -> dict:
    from security import effective_permissions
    perms = await effective_permissions(user)
    return {
        "id": user["_id"],
        "name": user.get("name"),
        "email": user["email"],
        "phone": user.get("phone"),
        "roles": user.get("roles", []),
        "permissions": sorted(perms),
        "is_active": user.get("is_active", True),
        "is_verified": user.get("is_verified", False),
        "avatar_url": user.get("avatar_url"),
        "created_at": user.get("created_at").isoformat() if user.get("created_at") else None,
    }


@router.post("/register", status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterBody):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    role = body.role if body.role in ("customer", "owner") else "customer"
    user = {
        "_id": new_id(),
        "name": body.name.strip(),
        "email": email,
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "roles": [role],
        "permissions": [],
        "is_active": True,
        # Email verification architecture exists (one_time_tokens + /verify-email);
        # auto-verified here because no transactional email provider is configured.
        "is_verified": True,
        "password_version": 0,
        "failed_attempts": 0,
        "locked_until": None,
        "deleted_at": None,
        "created_at": now(),
        "updated_at": now(),
    }
    await db.users.insert_one(user)
    # issue a verification token record (architecture preserved)
    await db.one_time_tokens.insert_one({
        "_id": new_id(), "token_hash": digest(random_token()), "purpose": "verify_email",
        "user_id": user["_id"], "expires_at": now() + timedelta(hours=24), "created_at": now(),
    })
    await write_audit(user, "user_registered", "users", user["_id"], request)
    tokens = await issue_session(user, request)
    return {**tokens, "user": await _public_user(user)}


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if user and user.get("locked_until") and user["locked_until"] > now():
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Account temporarily locked due to failed attempts. Try again later.")
    ok = bool(user) and verify_password(body.password, user.get("password_hash", ""))
    if not ok:
        if user:
            attempts = user.get("failed_attempts", 0) + 1
            update = {"failed_attempts": attempts}
            if attempts >= MAX_FAILED:
                update["locked_until"] = now() + timedelta(minutes=LOCK_MINUTES)
                update["failed_attempts"] = 0
            await db.users.update_one({"_id": user["_id"]}, {"$set": update})
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.get("is_active") or user.get("deleted_at"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    await db.users.update_one({"_id": user["_id"]},
                              {"$set": {"failed_attempts": 0, "locked_until": None, "last_login_at": now()}})
    tokens = await issue_session(user, request)
    return {**tokens, "user": await _public_user(user)}


@router.post("/refresh")
@limiter.limit("60/minute")
async def refresh(request: Request, body: TokenBody):
    old = await db.sessions.find_one({"refresh_hash": digest(body.token)})
    if not old or old.get("revoked_at") or old["expires_at"] <= now():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    user = await db.users.find_one({"_id": old["user_id"], "is_active": True})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    new_raw = random_token()
    res = await db.sessions.update_one(
        {"_id": old["_id"], "revoked_at": {"$exists": False}},
        {"$set": {"revoked_at": now()}},
    )
    if res.modified_count != 1:
        await db.sessions.update_many({"sid": old["sid"]}, {"$set": {"revoked_at": now()}})
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token reuse detected")
    await db.sessions.insert_one({
        "_id": new_id(), "sid": old["sid"], "user_id": user["_id"],
        "refresh_hash": digest(new_raw), "expires_at": now() + timedelta(days=30), "created_at": now(),
    })
    return {"access_token": make_access_token(user, old["sid"]), "refresh_token": new_raw, "token_type": "bearer"}


@router.post("/logout")
async def logout(body: TokenBody, user: dict = Depends(current_user)):
    await db.sessions.update_one(
        {"refresh_hash": digest(body.token), "user_id": user["_id"]},
        {"$set": {"revoked_at": now()}},
    )
    return {"message": "Logged out"}


@router.post("/logout-all")
async def logout_all(user: dict = Depends(current_user)):
    await db.sessions.update_many({"user_id": user["_id"]}, {"$set": {"revoked_at": now()}})
    return {"message": "All sessions revoked"}


@router.post("/forgot")
@limiter.limit("5/hour")
async def forgot(request: Request, body: ForgotBody):
    user = await db.users.find_one({"email": body.email.lower()})
    raw = random_token()
    if user:
        await db.one_time_tokens.insert_one({
            "_id": new_id(), "token_hash": digest(raw), "purpose": "reset_password",
            "user_id": user["_id"], "expires_at": now() + timedelta(hours=1), "created_at": now(),
        })
    # Dev convenience: return the token so the flow is testable without email.
    return {"message": "If the account exists, a reset link has been sent",
            "reset_token": raw if user else None}


@router.post("/reset")
@limiter.limit("10/hour")
async def reset(request: Request, body: ResetBody):
    rec = await db.one_time_tokens.find_one_and_update(
        {"token_hash": digest(body.token), "purpose": "reset_password",
         "used_at": {"$exists": False}, "expires_at": {"$gt": now()}},
        {"$set": {"used_at": now()}},
    )
    if not rec:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token")
    await db.users.update_one(
        {"_id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(body.password)}, "$inc": {"password_version": 1}},
    )
    await db.sessions.update_many({"user_id": rec["user_id"]}, {"$set": {"revoked_at": now()}})
    return {"message": "Password reset successfully. Please sign in again."}


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return await _public_user(user)


class UpdateProfileBody(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    phone: str | None = Field(default=None, max_length=30)
    avatar_url: str | None = None


@router.patch("/me")
async def update_me(body: UpdateProfileBody, user: dict = Depends(current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        updates["updated_at"] = now()
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return await _public_user(fresh)
