"""اختبارات الصلاحيات — RBAC tests.

Contract of ``security.require_permission`` / ``assert_facility_access``:
- a user without the permission gets 403,
- ``super_admin`` holds the wildcard ``*``,
- tenant isolation: owner A can never touch owner B's facility even though the
  ``owner`` role globally grants ``fields.update``.
"""
import asyncio

import pytest
from fastapi import HTTPException

import fakes
from fakes import make_request, make_user, new_test_db, patch_modules, seed_roles, user_with_perms

import audit
import routes_facilities
import security


@pytest.fixture()
def tdb(monkeypatch):
    fake = new_test_db()
    seed_roles(fake)
    patch_modules(monkeypatch, fake, security, routes_facilities, audit)
    return fake


def _run(coro):
    return asyncio.run(coro)


def _facility(owner_id, name="ملعب الاختبار"):
    import db as dbmod

    t = dbmod.now()
    return {
        "_id": dbmod.new_id(),
        "owner_id": owner_id,
        "name": name,
        "description": "منشأة اختبار",
        "city": "عمّان",
        "status": "VERIFIED",
        "is_active": True,
        "deleted_at": None,
        "created_at": t,
        "updated_at": t,
    }


def _guard(permission, user):
    guard = security.require_permission(permission)
    return _run(guard(user))


class TestPermissionGuards:
    def test_denied_without_permission(self, tdb):
        user = _run(user_with_perms(tdb, make_user("c1@example.com", roles=["customer"])))
        with pytest.raises(HTTPException) as exc:
            _guard("fields.delete", user)
        assert exc.value.status_code == 403

    def test_granted_with_permission(self, tdb):
        user = _run(user_with_perms(tdb, make_user("o1@example.com", roles=["owner"])))
        assert _guard("fields.create", user)["email"] == "o1@example.com"

    def test_wildcard_super_admin_passes_anything(self, tdb):
        user = _run(user_with_perms(tdb, make_user("sa@example.com", roles=["super_admin"])))
        assert security.WILDCARD in user["_perms"]
        assert security.is_super_admin(user)
        assert _guard("whatever.not.real", user)["email"] == "sa@example.com"

    def test_is_super_admin_false_for_owner(self, tdb):
        user = _run(user_with_perms(tdb, make_user("o2@example.com", roles=["owner"])))
        assert not security.is_super_admin(user)


class TestTenantIsolation:
    def _two_owners(self, tdb):
        owner_a = make_user("owner-a@example.com", name="المالك أ", roles=["owner"])
        owner_b = make_user("owner-b@example.com", name="المالك ب", roles=["owner"])
        _run(tdb.users.insert_one(owner_a))
        _run(tdb.users.insert_one(owner_b))
        fac_a = _facility(owner_a["_id"], name="ملعب المالك أ")
        _run(tdb.facilities.insert_one(fac_a))
        user_a = _run(user_with_perms(tdb, owner_a))
        user_b = _run(user_with_perms(tdb, owner_b))
        return user_a, user_b, fac_a

    def test_owner_cannot_access_other_tenant_facility(self, tdb):
        user_a, user_b, fac_a = self._two_owners(tdb)
        # sanity: the owner role globally grants fields.update ...
        assert security.has_permission(user_b, "fields.update")
        # ... but it must NOT grant access to another tenant's facility
        with pytest.raises(HTTPException) as exc:
            _run(security.assert_facility_access(user_b, fac_a, "fields.update"))
        assert exc.value.status_code == 403
        # owner A passes for their own facility
        _run(security.assert_facility_access(user_a, fac_a, "fields.update"))

    def test_route_level_tenant_isolation(self, tdb):
        """PATCH /api/facilities/{fid} by owner B on owner A's facility → 403."""
        user_a, user_b, fac_a = self._two_owners(tdb)
        with pytest.raises(HTTPException) as exc:
            _run(routes_facilities.update_facility(
                fac_a["_id"], {"name": "اسم مخترق"}, make_request(), user_b))
        assert exc.value.status_code == 403
        # unchanged
        assert _run(tdb.facilities.find_one({"_id": fac_a["_id"]}))["name"] == "ملعب المالك أ"
        # owner A can update their own facility
        out = _run(routes_facilities.update_facility(
            fac_a["_id"], {"name": "الاسم الجديد"}, make_request(), user_a))
        assert out["name"] == "الاسم الجديد"
        # an audit entry was written
        assert _run(tdb.audit_logs.count_documents({"action": "facility_updated"})) == 1

    def test_admin_without_ownership_denied(self, tdb):
        user_a, _, fac_a = self._two_owners(tdb)
        admin = _run(user_with_perms(tdb, make_user("adm@example.com", roles=["admin"])))
        with pytest.raises(HTTPException) as exc:
            _run(security.assert_facility_access(admin, fac_a, "fields.update"))
        assert exc.value.status_code == 403

    def test_super_admin_bypasses_tenant_isolation(self, tdb):
        _, _, fac_a = self._two_owners(tdb)
        sa = _run(user_with_perms(tdb, make_user("sa2@example.com", roles=["super_admin"])))
        _run(security.assert_facility_access(sa, fac_a, "fields.delete"))

    def test_staff_member_with_org_permission_allowed(self, tdb):
        _, _, fac_a = self._two_owners(tdb)
        staff = make_user("staff@example.com", name="موظف", roles=[])
        _run(tdb.users.insert_one(staff))
        _run(tdb.organization_members.insert_one({
            "_id": "m1", "facility_id": fac_a["_id"], "user_id": staff["_id"],
            "permissions": ["manage_field"], "deleted_at": None,
        }))
        staff_u = _run(user_with_perms(tdb, staff))
        # platform permission fields.update maps to org permission manage_field
        _run(security.assert_facility_access(staff_u, fac_a, "fields.update"))

    def test_staff_member_without_org_permission_denied(self, tdb):
        _, _, fac_a = self._two_owners(tdb)
        staff = make_user("staff2@example.com", name="موظف ٢", roles=[])
        _run(tdb.users.insert_one(staff))
        _run(tdb.organization_members.insert_one({
            "_id": "m2", "facility_id": fac_a["_id"], "user_id": staff["_id"],
            "permissions": ["view_bookings"], "deleted_at": None,
        }))
        staff_u = _run(user_with_perms(tdb, staff))
        with pytest.raises(HTTPException) as exc:
            _run(security.assert_facility_access(staff_u, fac_a, "fields.update"))
        assert exc.value.status_code == 403
