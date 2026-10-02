"""اختبارات تزامن الحجوزات — Booking concurrency tests.

Contract: two (or N) concurrent ``POST /api/bookings`` for the same slot must
result in exactly one CONFIRMED booking; the losers get HTTP 409 and leave no
orphan booking/reservation rows. The guarantee comes from the unique index on
``slot_reservations(pitch_id, date, slot_min)`` + atomic ``insert_many`` —
``FakeDb`` enforces the same uniqueness so the test is faithful offline.
"""
import asyncio
from datetime import timedelta

import pytest
from fastapi import HTTPException

import fakes
from fakes import make_user, new_test_db, patch_modules

import audit
import db as dbmod
import engines
import notify
import routes_bookings
import security


@pytest.fixture()
def tdb(monkeypatch):
    fake = new_test_db()
    patch_modules(monkeypatch, fake, routes_bookings, engines, audit, notify, security)
    return fake


def _run(coro):
    return asyncio.run(coro)


def _seed_world(tdb):
    """Owner + customer + VERIFIED auto-approve facility + one pitch."""
    owner = make_user("owner-c@example.com", name="مالك", roles=["owner"])
    customer = make_user("cust-c@example.com", name="لاعب")
    _run(tdb.users.insert_one(owner))
    _run(tdb.users.insert_one(customer))
    t = dbmod.now()
    fid = dbmod.new_id()
    _run(tdb.facilities.insert_one({
        "_id": fid, "owner_id": owner["_id"], "name": "ملعب التزامن",
        "city": "عمّان", "area": "الصويفية",
        "weekend_days": [4, 5], "approval_mode": "auto",
        "cancellation_policy": {"free_cancellation_hours": 24,
                                "partial_refund_hours": 6,
                                "partial_refund_percent": 50},
        "currency": "JOD", "status": "VERIFIED", "is_active": True,
        "deleted_at": None, "created_at": t, "updated_at": t,
    }))
    pid = dbmod.new_id()
    weekly = {str(d): {"closed": False, "open_min": 360, "close_min": 1380}
              for d in range(7)}
    _run(tdb.pitches.insert_one({
        "_id": pid, "facility_id": fid, "owner_id": owner["_id"],
        "name": "ملعب 1", "slot_duration": 60,
        "pricing": {"base_hourly": 25.0, "weekend_multiplier": 1.25,
                    "peak_hours": [], "special_dates": {}},
        "schedule": {"weekly": weekly, "closed_dates": []},
        "is_active": True, "deleted_at": None, "created_at": t, "updated_at": t,
    }))
    return customer, pid


def _body(pid, start_min=1080, end_min=1140):
    date = (dbmod.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    return routes_bookings.CreateBookingBody(
        pitch_id=pid, date=date, start_min=start_min, end_min=end_min, players=10)


class TestConcurrentBooking:
    def test_exactly_one_confirmed(self, tdb):
        """8 concurrent attempts on the same slot → 1 CONFIRMED, 7 × 409."""
        customer, pid = _seed_world(tdb)

        async def attempt():
            try:
                out = await routes_bookings.create_booking(_body(pid), None, customer)
                return ("ok", out["status"])
            except HTTPException as e:
                return ("err", e.status_code)

        async def race():
            return await asyncio.gather(*[attempt() for _ in range(8)])

        results = _run(race())
        ok = [r for r in results if r[0] == "ok"]
        errs = [r for r in results if r[0] == "err"]
        assert len(ok) == 1, f"expected exactly one success, got {results}"
        assert ok[0][1] == "CONFIRMED"  # facility is auto-approve
        assert len(errs) == 7
        assert all(code == 409 for _, code in errs)

        # no orphan rows: exactly one booking and its two 30-min reservations
        assert _run(tdb.bookings.count_documents({})) == 1
        booking = _run(tdb.bookings.find_one({}))
        assert booking["status"] == "CONFIRMED"
        assert _run(tdb.slot_reservations.count_documents(
            {"booking_id": booking["_id"]})) == 2
        # a payment row was created for the winner only
        assert _run(tdb.payments.count_documents({})) == 1

    def test_sequential_double_booking_409(self, tdb):
        customer, pid = _seed_world(tdb)

        async def go():
            first = await routes_bookings.create_booking(_body(pid), None, customer)
            try:
                await routes_bookings.create_booking(_body(pid), None, customer)
                return ("no-conflict", None)
            except HTTPException as e:
                return ("conflict", e.status_code, first["id"])

        status, code, bid = _run(go())
        assert (status, code) == ("conflict", 409)
        assert _run(tdb.bookings.count_documents({})) == 1

    def test_non_overlapping_slots_both_succeed(self, tdb):
        """Sanity: the lock is per slot-part, not per pitch/day."""
        customer, pid = _seed_world(tdb)

        async def go():
            a = await routes_bookings.create_booking(_body(pid, 1080, 1140), None, customer)
            b = await routes_bookings.create_booking(_body(pid, 1140, 1200), None, customer)
            return a["status"], b["status"]

        assert _run(go()) == ("CONFIRMED", "CONFIRMED")
        assert _run(tdb.bookings.count_documents({})) == 2
