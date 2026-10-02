"""اختبارات المصادقة — Authentication tests.

Covers the contract of ``routes_auth`` (prefix ``/api/auth``):
registration, login, logout, wrong password, the forgot/reset flow and the
existence of rate limiting. Runs fully offline via ``fakes.FakeDb``.
"""
import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from slowapi.errors import RateLimitExceeded

import fakes
from fakes import make_request, make_user, new_test_db, patch_modules, seed_roles

import audit
import routes_auth
import security

PASSWORD = "Passw0rd!23"


@pytest.fixture()
def tdb(monkeypatch):
    fake = new_test_db()
    seed_roles(fake)
    patch_modules(monkeypatch, fake, routes_auth, security, audit)
    return fake


def _run(coro):
    return asyncio.run(coro)


def _register(ip, name="ليث", email="lith@example.com", password=PASSWORD, role="customer"):
    body = routes_auth.RegisterBody(name=name, email=email, password=password, role=role)
    return _run(routes_auth.register(make_request(ip), body))


class TestRegister:
    def test_register_customer_returns_tokens(self, tdb):
        out = _register("10.10.0.1", email="cust1@example.com")
        assert out["user"]["email"] == "cust1@example.com"
        assert "customer" in out["user"]["roles"]
        assert out["access_token"] and out["refresh_token"]
        assert out["token_type"] == "bearer"
        # password must never be stored in clear text
        stored = _run(tdb.users.find_one({"email": "cust1@example.com"}))
        assert stored["password_hash"] != PASSWORD
        assert security.verify_password(PASSWORD, stored["password_hash"])

    def test_register_owner_role(self, tdb):
        out = _register("10.10.0.2", email="owner1@example.com", role="owner")
        assert "owner" in out["user"]["roles"]

    def test_register_duplicate_email_409(self, tdb):
        _register("10.10.0.3", email="dup@example.com")
        with pytest.raises(HTTPException) as exc:
            _register("10.10.0.3", email="dup@example.com")
        assert exc.value.status_code == 409

    def test_register_rejects_weak_password(self, tdb):
        with pytest.raises(ValidationError):
            routes_auth.RegisterBody(name="سامي", email="x@example.com", password="short")


class TestLogin:
    def _seed(self, tdb, email="login@example.com", password=PASSWORD):
        user = make_user(email, password=password)
        _run(tdb.users.insert_one(user))
        return user

    def test_login_success(self, tdb):
        self._seed(tdb)
        body = routes_auth.LoginBody(email="login@example.com", password=PASSWORD)
        out = _run(routes_auth.login(make_request("10.11.0.1"), body))
        assert out["access_token"] and out["refresh_token"]
        assert out["user"]["email"] == "login@example.com"

    def test_login_wrong_password_401(self, tdb):
        self._seed(tdb)
        body = routes_auth.LoginBody(email="login@example.com", password="WrongPass99")
        with pytest.raises(HTTPException) as exc:
            _run(routes_auth.login(make_request("10.11.0.2"), body))
        assert exc.value.status_code == 401

    def test_login_unknown_email_401(self, tdb):
        body = routes_auth.LoginBody(email="nobody@example.com", password=PASSWORD)
        with pytest.raises(HTTPException) as exc:
            _run(routes_auth.login(make_request("10.11.0.3"), body))
        assert exc.value.status_code == 401

    def test_account_locks_after_repeated_failures(self, tdb):
        self._seed(tdb, email="lockme@example.com")
        bad = routes_auth.LoginBody(email="lockme@example.com", password="WrongPass99")
        for _ in range(5):
            with pytest.raises(HTTPException):
                _run(routes_auth.login(make_request("10.11.0.4"), bad))
        # account is now locked: even the right password is rejected with 429
        good = routes_auth.LoginBody(email="lockme@example.com", password=PASSWORD)
        with pytest.raises(HTTPException) as exc:
            _run(routes_auth.login(make_request("10.11.0.4"), good))
        assert exc.value.status_code == 429


class TestSessionLifecycle:
    def test_logout_revokes_session(self, tdb):
        reg = _register("10.12.0.1", email="sess@example.com")
        body = routes_auth.TokenBody(token=reg["refresh_token"])
        out = _run(routes_auth.logout(body, reg["user"] | {"_id": _user_id(tdb, "sess@example.com")}))
        assert out["message"] == "Logged out"
        # refresh after logout must fail
        with pytest.raises(HTTPException) as exc:
            _run(routes_auth.refresh(make_request("10.12.0.2"), body))
        assert exc.value.status_code == 401

    def test_refresh_rotation_rejects_reuse(self, tdb):
        reg = _register("10.12.0.3", email="rot@example.com")
        body = routes_auth.TokenBody(token=reg["refresh_token"])
        new = _run(routes_auth.refresh(make_request("10.12.0.4"), body))
        assert new["refresh_token"] != reg["refresh_token"]
        # old token reuse is detected and rejected
        with pytest.raises(HTTPException) as exc:
            _run(routes_auth.refresh(make_request("10.12.0.5"), body))
        assert exc.value.status_code == 401

    def test_me_returns_public_profile(self, tdb):
        reg = _register("10.12.0.6", email="me@example.com")
        user = _run(tdb.users.find_one({"email": "me@example.com"}))
        me = _run(routes_auth.me(user))
        assert me["email"] == "me@example.com"
        assert "password_hash" not in me


def _user_id(tdb, email):
    return _run(tdb.users.find_one({"email": email}))["_id"]


class TestPasswordReset:
    def test_forgot_reset_flow(self, tdb):
        _register("10.13.0.1", email="reset@example.com")
        forgot = _run(routes_auth.forgot(make_request("10.13.0.2"),
                                         routes_auth.ForgotBody(email="reset@example.com")))
        assert forgot["reset_token"], "dev flow must return a reset token"
        out = _run(routes_auth.reset(
            make_request("10.13.0.3"),
            routes_auth.ResetBody(token=forgot["reset_token"], password="NewPassw0rd!9")))
        assert "successfully" in out["message"]
        # new password works
        login = _run(routes_auth.login(
            make_request("10.13.0.4"),
            routes_auth.LoginBody(email="reset@example.com", password="NewPassw0rd!9")))
        assert login["access_token"]

    def test_reset_token_single_use(self, tdb):
        _register("10.13.0.5", email="once@example.com")
        forgot = _run(routes_auth.forgot(make_request("10.13.0.6"),
                                         routes_auth.ForgotBody(email="once@example.com")))
        _run(routes_auth.reset(make_request("10.13.0.7"),
                               routes_auth.ResetBody(token=forgot["reset_token"],
                                                     password="NewPassw0rd!9")))
        with pytest.raises(HTTPException) as exc:
            _run(routes_auth.reset(make_request("10.13.0.8"),
                                   routes_auth.ResetBody(token=forgot["reset_token"],
                                                         password="Another1!x")))
        assert exc.value.status_code == 400

    def test_reset_invalid_token_400(self, tdb):
        with pytest.raises(HTTPException) as exc:
            _run(routes_auth.reset(make_request("10.13.0.9"),
                                   routes_auth.ResetBody(token="bogus-token",
                                                         password="NewPassw0rd!9")))
        assert exc.value.status_code == 400


class TestRateLimiting:
    def test_login_is_rate_limited(self, tdb):
        """The 11th login attempt from one IP inside a minute must be rejected.

        slowapi raises ``RateLimitExceeded``; ``server.py`` maps it to HTTP 429.
        A dedicated IP keeps this isolated from other tests sharing the process.
        """
        body = routes_auth.LoginBody(email="nobody-here@example.com", password="x")
        # NOTE: a fresh Request per call — slowapi marks a request object once
        # checked, so reusing one object would not accumulate the limit.
        for _ in range(10):
            with pytest.raises(HTTPException) as exc:
                _run(routes_auth.login(make_request("10.99.0.1"), body))
            assert exc.value.status_code == 401  # bad creds, not yet limited
        with pytest.raises(RateLimitExceeded):
            _run(routes_auth.login(make_request("10.99.0.1"), body))

    def test_register_endpoint_has_limit_decorator(self):
        # the decorator is applied — slowapi wraps the original function
        assert hasattr(routes_auth.register, "__wrapped__")
        assert hasattr(routes_auth.login, "__wrapped__")
        assert hasattr(routes_auth.forgot, "__wrapped__")
        assert hasattr(routes_auth.reset, "__wrapped__")
