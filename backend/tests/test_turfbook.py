"""End-to-end API tests for TurfBook.
Covers: auth, RBAC, facilities workflow, availability, pricing, booking lifecycle,
concurrency/conflict prevention, coupons, reviews, favorites, notifications,
admin dashboards, audit logs, uploads.
"""
import uuid
import concurrent.futures as cf
from datetime import datetime, timedelta

import requests

from conftest import API, _auth, _login, PLAYER

TEST_DOMAIN = "example.com"


# ----------------------------- health & smoke ------------------------------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# ================================= AUTH ===================================
class TestAuth:
    def test_login_me_logout_refresh(self):
        tok = _login(PLAYER)
        assert "access_token" in tok and "refresh_token" in tok
        me = requests.get(f"{API}/auth/me", headers=_auth(tok["access_token"])).json()
        assert me["email"] == PLAYER["email"]
        assert "customer" in me["roles"]

        # refresh rotation
        r = requests.post(f"{API}/auth/refresh", json={"token": tok["refresh_token"]})
        assert r.status_code == 200, f"refresh failed: {r.status_code} {r.text}"
        new_tokens = r.json()
        assert new_tokens["refresh_token"] != tok["refresh_token"]

        # old refresh token must not work (rotation)
        r2 = requests.post(f"{API}/auth/refresh", json={"token": tok["refresh_token"]})
        assert r2.status_code == 401

        # logout
        r3 = requests.post(f"{API}/auth/logout",
                           json={"token": new_tokens["refresh_token"]},
                           headers=_auth(new_tokens["access_token"]))
        assert r3.status_code == 200

    def test_register_customer_and_owner(self):
        for role in ("customer", "owner"):
            email = f"test_{role}_{uuid.uuid4().hex[:8]}@{TEST_DOMAIN}"
            body = {"name": f"T {role}", "email": email, "password": "Passw0rd!23", "role": role}
            r = requests.post(f"{API}/auth/register", json=body)
            assert r.status_code == 201, r.text
            data = r.json()
            assert data["user"]["email"] == email
            assert role in data["user"]["roles"]
            assert "access_token" in data

    def test_login_invalid_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": PLAYER["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_bruteforce_lockout(self):
        """5 failed attempts should lock the account (429)."""
        email = f"test_lock_{uuid.uuid4().hex[:8]}@{TEST_DOMAIN}"
        reg = requests.post(f"{API}/auth/register", json={
            "name": "Lock Test", "email": email, "password": "GoodPass123!", "role": "customer"})
        assert reg.status_code == 201
        for _ in range(5):
            requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong-pw"})
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "GoodPass123!"})
        assert r.status_code == 429, f"lockout did not trigger: {r.status_code} {r.text}"

    def test_forgot_reset_password_flow(self):
        email = f"test_reset_{uuid.uuid4().hex[:8]}@{TEST_DOMAIN}"
        reg = requests.post(f"{API}/auth/register", json={
            "name": "Reset Test", "email": email, "password": "OldPass123!", "role": "customer"})
        assert reg.status_code == 201
        r = requests.post(f"{API}/auth/forgot", json={"email": email})
        assert r.status_code == 200
        token = r.json().get("reset_token")
        assert token
        r2 = requests.post(f"{API}/auth/reset", json={"token": token, "password": "NewPass123!"})
        assert r2.status_code == 200
        r3 = requests.post(f"{API}/auth/login", json={"email": email, "password": "OldPass123!"})
        assert r3.status_code == 401
        r4 = requests.post(f"{API}/auth/login", json={"email": email, "password": "NewPass123!"})
        assert r4.status_code == 200


# ================================= RBAC ===================================
class TestRBAC:
    def test_customer_denied_admin_overview(self, player_headers):
        r = requests.get(f"{API}/admin/overview", headers=player_headers)
        assert r.status_code == 403

    def test_customer_denied_admin_users(self, player_headers):
        r = requests.get(f"{API}/admin/users", headers=player_headers)
        assert r.status_code == 403

    def test_customer_denied_owner_bookings(self, player_headers):
        r = requests.get(f"{API}/owner/bookings", headers=player_headers)
        assert r.status_code == 403

    def test_owner_denied_admin_user_management(self, owner_headers):
        """Owner must NOT be able to list/modify users."""
        r = requests.get(f"{API}/admin/users", headers=owner_headers)
        assert r.status_code == 403, f"owner should not list users: {r.status_code}"

    def test_owner_denied_admin_roles(self, owner_headers):
        r = requests.get(f"{API}/admin/roles", headers=owner_headers)
        # roles.read is admin-only
        assert r.status_code == 403

    def test_admin_overview_ok(self, admin_headers):
        r = requests.get(f"{API}/admin/overview", headers=admin_headers)
        assert r.status_code == 200
        for k in ("users_total", "facilities_verified", "bookings_total", "revenue"):
            assert k in r.json()

    def test_owner_cannot_touch_other_owner_facility(self):
        """IDOR: register a second owner, patch an owner@turfbook.com facility must 403."""
        email = f"test_owner2_{uuid.uuid4().hex[:8]}@{TEST_DOMAIN}"
        reg = requests.post(f"{API}/auth/register", json={
            "name": "Owner2", "email": email, "password": "Pass1234!", "role": "owner"})
        assert reg.status_code == 201, reg.text
        other_token = reg.json()["access_token"]

        search = requests.get(f"{API}/facilities?limit=1").json()
        assert search["items"]
        fid = search["items"][0]["id"]

        r = requests.patch(f"{API}/facilities/{fid}",
                           json={"name": "HACKED"}, headers=_auth(other_token))
        assert r.status_code == 403, f"IDOR not blocked: {r.status_code} {r.text}"


# =========================== Facilities / Pitches ==========================
class TestFacilities:
    def test_public_search(self):
        r = requests.get(f"{API}/facilities")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and data["total"] >= 1

    def test_facility_detail_public(self):
        items = requests.get(f"{API}/facilities").json()["items"]
        r = requests.get(f"{API}/facilities/{items[0]['id']}")
        assert r.status_code == 200
        assert "pitches" in r.json()

    def test_owner_create_submit_verify_flow(self, owner_headers, admin_headers):
        name = f"TEST_FAC_{uuid.uuid4().hex[:6]}"
        body = {"name": name, "description": "d", "address": "a", "city": "Dubai",
                "contact_phone": "+1", "contact_email": "x@y.com", "approval_mode": "auto"}
        r = requests.post(f"{API}/facilities", json=body, headers=owner_headers)
        assert r.status_code == 201, r.text
        fid = r.json()["id"]
        assert r.json()["status"] == "DRAFT"

        # submit without pitch -> 400
        r = requests.post(f"{API}/facilities/{fid}/submit", headers=owner_headers)
        assert r.status_code == 400

        # add a pitch
        pbody = {"name": "P1", "pricing": {"base_hourly": 50, "weekend_multiplier": 1.5,
                                           "peak_hours": [{"start": 1080, "end": 1260, "multiplier": 1.25}]}}
        r = requests.post(f"{API}/facilities/{fid}/pitches", json=pbody, headers=owner_headers)
        assert r.status_code == 201, r.text
        pid = r.json()["id"]

        # submit
        r = requests.post(f"{API}/facilities/{fid}/submit", headers=owner_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "PENDING_REVIEW"

        # admin verify
        r = requests.post(f"{API}/admin/facilities/{fid}/verify", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "VERIFIED"

        requests.delete(f"{API}/pitches/{pid}", headers=owner_headers)
        requests.delete(f"{API}/facilities/{fid}", headers=owner_headers)


# ======================= Availability / Pricing / Booking ==================
def _pick_pitch_for_auto_approval():
    items = requests.get(f"{API}/facilities").json()["items"]
    for it in items:
        full = requests.get(f"{API}/facilities/{it['id']}").json()
        if full.get("approval_mode", "auto") == "auto" and full.get("pitches"):
            return full, full["pitches"][0]
    full = requests.get(f"{API}/facilities/{items[0]['id']}").json()
    return full, full["pitches"][0]


def _future_date(days=3):
    return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")


class TestBookingFlow:
    def test_availability_endpoint(self):
        _, pitch = _pick_pitch_for_auto_approval()
        d = _future_date(2)
        r = requests.get(f"{API}/availability?pitch_id={pitch['id']}&date={d}")
        assert r.status_code == 200
        j = r.json()
        assert j["slots"] and isinstance(j["slots"], list)
        statuses = {s["status"] for s in j["slots"]}
        assert statuses.issubset({"available", "reserved", "blocked", "past"})

    def test_price_quote_weekend_and_peak(self):
        fac, pitch = _pick_pitch_for_auto_approval()
        d = datetime.utcnow()
        while d.weekday() not in fac.get("weekend_days", [5, 6]):
            d += timedelta(days=1)
        date = d.strftime("%Y-%m-%d")
        r = requests.post(f"{API}/bookings/quote", json={
            "pitch_id": pitch["id"], "date": date, "start_min": 1080, "end_min": 1140})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["subtotal"] > 0
        assert abs(p["total"] - (p["subtotal"] - p.get("discount", 0))) < 0.01

    def test_booking_create_and_conflict_409(self, player_headers):
        _, pitch = _pick_pitch_for_auto_approval()
        date = _future_date(5)
        slots = requests.get(f"{API}/availability?pitch_id={pitch['id']}&date={date}").json()["slots"]
        slot = next((s for s in slots if s["status"] == "available"), None)
        assert slot
        body = {"pitch_id": pitch["id"], "date": date,
                "start_min": slot["start_min"], "end_min": slot["end_min"]}
        r1 = requests.post(f"{API}/bookings", json=body, headers=player_headers)
        assert r1.status_code == 201, r1.text
        booking = r1.json()
        assert booking["status"] in ("CONFIRMED", "PENDING")
        assert booking["final_amount"] >= 0

        r2 = requests.post(f"{API}/bookings", json=body, headers=player_headers)
        assert r2.status_code == 409

        c = requests.post(f"{API}/bookings/{booking['id']}/cancel",
                          json={"reason": "test"}, headers=player_headers)
        assert c.status_code == 200
        assert c.json()["status"] == "CANCELLED"

    def test_concurrent_double_booking_prevention(self, player_headers):
        _, pitch = _pick_pitch_for_auto_approval()
        date = _future_date(7)
        slots = requests.get(f"{API}/availability?pitch_id={pitch['id']}&date={date}").json()["slots"]
        slot = next((s for s in slots if s["status"] == "available"), None)
        assert slot
        body = {"pitch_id": pitch["id"], "date": date,
                "start_min": slot["start_min"], "end_min": slot["end_min"]}

        def _post(_):
            return requests.post(f"{API}/bookings", json=body, headers=player_headers).status_code

        with cf.ThreadPoolExecutor(max_workers=5) as ex:
            codes = list(ex.map(_post, range(5)))
        successes = [c for c in codes if c == 201]
        assert len(successes) == 1, f"expected exactly 1 success, got {codes}"
        assert any(c == 409 for c in codes), f"no 409 observed: {codes}"

        my = requests.get(f"{API}/bookings?scope=upcoming", headers=player_headers).json()
        for b in my:
            if b["pitch_id"] == pitch["id"] and b["date"] == date and b["start_min"] == slot["start_min"]:
                requests.post(f"{API}/bookings/{b['id']}/cancel",
                              json={"reason": "cleanup"}, headers=player_headers)

    def test_owner_bookings_list(self, owner_headers):
        r = requests.get(f"{API}/owner/bookings", headers=owner_headers)
        assert r.status_code == 200
        data = r.json()
        # endpoint returns list or paginated object
        items = data["items"] if isinstance(data, dict) else data
        assert isinstance(items, list)


# =============================== Coupons ===================================
class TestCoupons:
    def test_customer_cannot_create_coupon(self, player_headers):
        r = requests.post(f"{API}/coupons",
                          json={"code": "HACK10", "discount_type": "percent", "value": 10,
                                "facility_id": "any"},
                          headers=player_headers)
        assert r.status_code in (401, 403, 422), f"got {r.status_code}: {r.text[:200]}"

    def test_owner_can_list_coupons(self, owner_headers):
        r = requests.get(f"{API}/coupons", headers=owner_headers)
        assert r.status_code == 200


# =========================== Favorites / Notifications =====================
class TestEngagement:
    def test_favorites_toggle(self, player_headers):
        items = requests.get(f"{API}/facilities").json()["items"]
        fid = items[0]["id"]
        # toggle on
        r1 = requests.post(f"{API}/favorites/{fid}", headers=player_headers)
        assert r1.status_code == 200
        # list
        r = requests.get(f"{API}/favorites", headers=player_headers)
        assert r.status_code == 200
        # toggle off (same POST toggles)
        r2 = requests.post(f"{API}/favorites/{fid}", headers=player_headers)
        assert r2.status_code == 200
        assert r2.json()["favorited"] is False

    def test_notifications_list(self, player_headers):
        r = requests.get(f"{API}/notifications", headers=player_headers)
        assert r.status_code == 200
        assert "items" in r.json()


# =============================== Admin APIs ================================
class TestAdmin:
    def test_users_list_search(self, admin_headers):
        r = requests.get(f"{API}/admin/users?q=player", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(u["email"] == PLAYER["email"] for u in items)

    def test_analytics(self, admin_headers):
        r = requests.get(f"{API}/admin/analytics", headers=admin_headers)
        assert r.status_code == 200
        j = r.json()
        assert "revenue_series" in j and len(j["revenue_series"]) == 30

    def test_roles_list(self, admin_headers):
        r = requests.get(f"{API}/admin/roles", headers=admin_headers)
        assert r.status_code == 200
        roles = r.json()
        assert any((r_.get("id") or r_.get("_id")) == "super_admin" for r_ in roles)

    def test_audit_logs(self, admin_headers):
        r = requests.get(f"{API}/admin/audit-logs", headers=admin_headers)
        assert r.status_code == 200
        assert "items" in r.json()


# =============================== Uploads ===================================
class TestUploads:
    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/uploads")
        assert r.status_code in (401, 403, 422)

    def test_upload_png(self, owner_headers):
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
               b"\xc0\x00\x00\x00\x03\x00\x01\xa6\xe5\x8d\xba\x00\x00\x00\x00IEND\xaeB`\x82")
        r = requests.post(f"{API}/uploads",
                          files={"file": ("t.png", png, "image/png")},
                          headers=owner_headers)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "path" in j and "url" in j
        # Fetch via the public API path (not the URL returned, which uses internal base)
        f = requests.get(f"{API}/files/{j['path']}")
        assert f.status_code == 200, f"GET file failed: {f.status_code}"
        assert f.content.startswith(b"\x89PNG")
