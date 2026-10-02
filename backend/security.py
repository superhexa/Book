"""Authentication & authorization: password hashing, JWT, session issuing,
current-user dependency, and permission guards (global + object-level)."""
import hashlib
import secrets
from datetime import timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import config
from db import db, new_id, now
from rbac import WILDCARD

bearer = HTTPBearer(auto_error=False)

# Pre-computed dummy hash so login timing does not reveal account existence.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password-constant", bcrypt.gensalt(rounds=12)).decode()


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def random_token() -> str:
    return secrets.token_urlsafe(32)


def make_access_token(user: dict, sid: str) -> str:
    t = now()
    payload = {
        "sub": user["_id"],
        "sid": sid,
        "roles": user.get("roles", []),
        "pv": user.get("password_version", 0),
        "type": "access",
        "iat": t,
        "exp": t + timedelta(minutes=config.ACCESS_MINUTES),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALG)


async def issue_session(user: dict, request: Request) -> dict:
    raw = random_token()
    sid = secrets.token_hex(16)
    await db.sessions.insert_one({
        "_id": new_id(),
        "sid": sid,
        "user_id": user["_id"],
        "refresh_hash": digest(raw),
        "expires_at": now() + timedelta(days=config.REFRESH_DAYS),
        "created_at": now(),
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    })
    return {
        "access_token": make_access_token(user, sid),
        "refresh_token": raw,
        "token_type": "bearer",
    }


async def effective_permissions(user: dict) -> set:
    """Union of permissions from the user's global roles plus direct grants."""
    role_keys = user.get("roles", [])
    perms = set(user.get("permissions", []))
    if role_keys:
        async for role in db.roles.find({"_id": {"$in": role_keys}}):
            perms.update(role.get("permissions", []))
    return perms


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, config.JWT_SECRET, algorithms=[config.JWT_ALG])
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = await db.users.find_one({"_id": payload["sub"]})
    if not user or not user.get("is_active") or user.get("deleted_at"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account unavailable")
    if user.get("password_version", 0) != payload.get("pv", 0):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    user["_perms"] = await effective_permissions(user)
    return user


async def optional_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> Optional[dict]:
    if not creds:
        return None
    try:
        return await current_user(creds)
    except HTTPException:
        return None


def has_permission(user: dict, permission: str) -> bool:
    perms = user.get("_perms", set())
    return WILDCARD in perms or permission in perms


def require_permission(permission: str):
    async def guard(user: dict = Depends(current_user)) -> dict:
        if not has_permission(user, permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have permission to perform this action")
        return user
    return guard


def is_super_admin(user: dict) -> bool:
    return WILDCARD in user.get("_perms", set()) or "super_admin" in user.get("roles", [])


# Maps platform permission strings to facility-scoped (staff) permissions.
_PLATFORM_TO_ORG = {
    "fields.update": "manage_field", "fields.delete": "manage_field",
    "bookings.read": "view_bookings", "bookings.create": "create_booking",
    "bookings.update": "edit_booking", "bookings.approve": "edit_booking",
    "bookings.reject": "edit_booking", "bookings.cancel": "cancel_booking",
    "analytics.read": "view_revenue", "revenue.read": "view_revenue",
    "reviews.moderate": "manage_reviews",
}


async def assert_facility_access(user: dict, facility: dict, permission: Optional[str] = None):
    """Object-level authorization: platform admins pass; owners pass for their own
    facility; staff pass if they are a member with the needed org permission."""
    if facility is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility not found")
    if is_super_admin(user):
        return
    if facility.get("owner_id") == user["_id"]:
        return
    # staff membership
    member = await db.organization_members.find_one({
        "facility_id": facility["_id"], "user_id": user["_id"], "deleted_at": None,
    })
    if member:
        org_perm = _PLATFORM_TO_ORG.get(permission)
        if permission is None or (org_perm and org_perm in member.get("permissions", [])):
            return
    # Tenant isolation: holding a global permission (e.g. the owner role's
    # fields.update) does NOT grant access to another tenant's facility.
    # Only super admins bypass ownership (handled above).
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this facility")
