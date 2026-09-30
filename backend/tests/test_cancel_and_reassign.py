"""Iteration 11 — Cancel/refund + Change driver + Reassignment (no double charge)
and Pending-driver visibility on the admin drivers list.

Uses the ADMIN manual-assign path to get a booking to `assigned` without Square.
For reassignment "no double charge" path, we bump payment.status → 'paid' in Mongo
(mimicking a real Square-paid booking) so the `already_paid` branch in
_assign_and_pay is exercised without hitting Square LIVE.
"""
import os
import uuid
import asyncio
from datetime import date, timedelta

import pytest
import requests

# Env
def _env(k):
    envf = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    try:
        for line in open(envf):
            if line.startswith(k + "="):
                return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return os.environ.get(k, "")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL") or _env_mongo() if False else "mongodb://localhost:27017"  # noqa
# Load MONGO_URL/DB_NAME from backend .env (same host)
def _backend_env(k):
    envf = os.path.join(os.path.dirname(__file__), "..", ".env")
    try:
        for line in open(envf):
            if line.startswith(k + "="):
                return line.split("=", 1)[1].strip().strip('"')
    except FileNotFoundError:
        pass
    return None

MONGO_URL = _backend_env("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = _backend_env("DB_NAME") or "test_database"

ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"
TOMORROW = (date.today() + timedelta(days=1)).isoformat()


# ---- fixtures ----------
@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def customer():
    s = requests.Session()
    email = f"TEST_cx_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "TEST Cust", "email": email, "password": "Test#2026", "phone": "07000000000",
    })
    assert r.status_code == 200, r.text
    return s


def _register_driver(admin_s, approved=True, pcode="SW1A 1AA", van_size="large"):
    s = requests.Session()
    email = f"TEST_dr_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/driver-register", json={
        "name": f"TEST Drv {uuid.uuid4().hex[:4]}", "email": email, "password": "Drive#2026",
        "phone": "07123999888", "vehicle": "Ford Transit LWB", "licence_no": "LIC-X",
        "insurance_no": "INS-X", "mot_expiry": "2027-01-01", "home_postcode": pcode,
        "van_size": van_size,
    })
    assert r.status_code == 200, r.text
    uid = r.json()["user_id"]
    if approved:
        assert admin_s.post(f"{API}/admin/drivers/{uid}/approve").status_code == 200
    return {"session": s, "user_id": uid, "email": email}


def _make_booking(cust, pickup="SW1A 1AA London", dropoff="M1 1AE Manchester", van="large"):
    r = cust.post(f"{API}/bookings", json={
        "pickup": pickup, "dropoff": dropoff, "van_size": van,
        "date": TOMORROW, "time": "10:00",
        "customer_name": "TEST C", "customer_phone": "07123456789",
    })
    assert r.status_code == 200, r.text
    return r.json()


def _mongo_set_payment_paid(booking_id, charge_amount=100.0):
    """Directly mark booking payment paid (simulating a Square-paid booking) without hitting Square."""
    from motor.motor_asyncio import AsyncIOMotorClient
    async def _run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]
        b = await db.bookings.find_one({"booking_id": booking_id})
        pay = b.get("payment") or {}
        pay.update({"status": "paid", "type": "full", "amount": charge_amount,
                    "card_charged": charge_amount, "provider": "square",
                    "transaction_id": f"TEST_TXN_{uuid.uuid4().hex[:8]}"})
        await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"payment": pay}})
        cli.close()
    asyncio.new_event_loop().run_until_complete(_run())


# ---------------------------------------------------------------------------
# (A) Pending driver visibility on admin drivers list
# ---------------------------------------------------------------------------
class TestPendingDriverVisibility:
    def test_pending_no_photos_driver_shows_up_and_is_searchable(self, admin):
        drv = _register_driver(admin, approved=False)
        r = admin.get(f"{API}/admin/drivers")
        assert r.status_code == 200
        rows = r.json()
        row = next((d for d in rows if d.get("user_id") == drv["user_id"]), None)
        assert row is not None, "pending driver missing from /admin/drivers"
        assert row.get("status") == "pending"
        assert (row.get("email") or "").lower() == drv["email"].lower()
        # zero photos
        for f in ("profile_photo", "van_photo", "licence_photo", "insurance_photo"):
            assert row.get(f) in (None, "")
        # "search" is client-side over these fields → confirm the email present so UI search will match
        matching = [d for d in rows if drv["email"].lower() in (d.get("email") or "").lower()]
        assert matching, "email-substring search on /admin/drivers response would return 0"

    def test_approve_pending_driver(self, admin):
        drv = _register_driver(admin, approved=False)
        r = admin.post(f"{API}/admin/drivers/{drv['user_id']}/approve")
        assert r.status_code == 200
        assert r.json().get("status") == "approved"


# ---------------------------------------------------------------------------
# (B) Cancel (paid booking) → refund requested + driver freed
# ---------------------------------------------------------------------------
class TestCancelPaid:
    def test_cancel_paid_booking_requests_refund_and_frees_driver(self, admin, customer):
        drv = _register_driver(admin)
        b = _make_booking(customer)
        assert admin.post(f"{API}/admin/bookings/{b['booking_id']}/assign",
                          json={"driver_id": drv["user_id"]}).status_code == 200
        # simulate Square-paid state for the "refund requested" branch
        _mongo_set_payment_paid(b["booking_id"], charge_amount=120.0)

        reason = "My plans changed"
        r = customer.post(f"{API}/bookings/{b['booking_id']}/cancel", json={"reason": reason})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "cancelled"
        assert body["refund_requested"] is True

        # GET booking to confirm persistence
        g = customer.get(f"{API}/bookings/{b['booking_id']}")
        assert g.status_code == 200
        bk = g.json()
        assert bk["status"] == "cancelled"
        assert bk["cancel_reason"] == reason
        ref = (bk.get("payment") or {}).get("refund") or {}
        assert ref.get("status") == "requested"
        assert ref.get("reason") == reason
        assert ref.get("amount") == 120.0

        # Previous driver freed
        prof = admin.get(f"{API}/admin/drivers").json()
        d = next(x for x in prof if x.get("user_id") == drv["user_id"])
        assert d.get("availability") == "available"

    def test_cancel_unpaid_no_refund(self, customer):
        b = _make_booking(customer)
        r = customer.post(f"{API}/bookings/{b['booking_id']}/cancel", json={"reason": "changed mind"})
        assert r.status_code == 200
        assert r.json()["refund_requested"] is False


# ---------------------------------------------------------------------------
# (C) Admin refund flow: mark refunded
# ---------------------------------------------------------------------------
class TestAdminRefund:
    def test_admin_can_mark_refunded(self, admin, customer):
        drv = _register_driver(admin)
        b = _make_booking(customer)
        admin.post(f"{API}/admin/bookings/{b['booking_id']}/assign", json={"driver_id": drv["user_id"]})
        _mongo_set_payment_paid(b["booking_id"], charge_amount=80.0)
        customer.post(f"{API}/bookings/{b['booking_id']}/cancel", json={"reason": "Driver is late"})

        # Booking shows up on admin bookings list
        r = admin.get(f"{API}/admin/bookings")
        assert r.status_code == 200
        assert any(x["booking_id"] == b["booking_id"] for x in r.json())

        # Mark refunded
        r2 = admin.post(f"{API}/admin/bookings/{b['booking_id']}/refund")
        assert r2.status_code == 200, r2.text
        ref = r2.json()["refund"]
        assert ref["status"] == "refunded"
        assert ref.get("processed_at")

        # Verify persistence
        g = customer.get(f"{API}/bookings/{b['booking_id']}")
        pay = g.json().get("payment") or {}
        assert (pay.get("refund") or {}).get("status") == "refunded"

    def test_refund_rejects_when_none_requested(self, admin, customer):
        b = _make_booking(customer)
        r = admin.post(f"{API}/admin/bookings/{b['booking_id']}/refund")
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# (D) Change driver → back to quoting, driver freed, reassignments[] recorded
# ---------------------------------------------------------------------------
class TestChangeDriver:
    def test_change_driver_reverts_to_quoting(self, admin, customer):
        drv = _register_driver(admin)
        b = _make_booking(customer)
        admin.post(f"{API}/admin/bookings/{b['booking_id']}/assign", json={"driver_id": drv["user_id"]})
        _mongo_set_payment_paid(b["booking_id"], charge_amount=95.0)

        reason = "Driver not responding"
        r = customer.post(f"{API}/bookings/{b['booking_id']}/change-driver", json={"reason": reason})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "quoting"

        # Persistence checks
        g = customer.get(f"{API}/bookings/{b['booking_id']}").json()
        assert g["status"] == "quoting"
        assert g.get("driver_id") in (None, "")
        assert g.get("driver") in (None, {})
        reasigns = g.get("reassignments") or []
        assert reasigns and reasigns[-1]["prev_driver_id"] == drv["user_id"]
        assert reasigns[-1]["reason"] == reason
        # payment stays 'paid' (not cleared)
        assert (g.get("payment") or {}).get("status") == "paid"

        # Prev driver freed
        drivers = admin.get(f"{API}/admin/drivers").json()
        prev = next(x for x in drivers if x.get("user_id") == drv["user_id"])
        assert prev.get("availability") == "available"

        # instant-offers still returns candidates
        o = customer.get(f"{API}/bookings/{b['booking_id']}/instant-offers")
        assert o.status_code == 200
        assert isinstance(o.json().get("offers"), list)


# ---------------------------------------------------------------------------
# (E) Reassignment via select-driver — MUST NOT touch Square (no source_id)
# ---------------------------------------------------------------------------
class TestReassignmentNoDoubleCharge:
    def test_select_driver_without_source_id_when_already_paid(self, admin, customer):
        d1 = _register_driver(admin)
        b = _make_booking(customer)
        admin.post(f"{API}/admin/bookings/{b['booking_id']}/assign", json={"driver_id": d1["user_id"]})
        _mongo_set_payment_paid(b["booking_id"], charge_amount=110.0)

        # change-driver → back to quoting
        r0 = customer.post(f"{API}/bookings/{b['booking_id']}/change-driver",
                           json={"reason": "Driver is late"})
        assert r0.status_code == 200

        # New driver
        d2 = _register_driver(admin)

        # Critical: reassignment call WITHOUT source_id / WITHOUT payment_type.
        # (Even the default "full" is allowed because already_paid branch is taken.)
        r = customer.post(f"{API}/bookings/{b['booking_id']}/select-driver",
                          json={"driver_id": d2["user_id"]})
        assert r.status_code == 200, f"select-driver reassignment failed: {r.status_code} {r.text}"
        j = r.json()
        assert j["status"] == "assigned"
        assert j["driver_id"] == d2["user_id"]

        # Payment unchanged (no new Square charge, txn id preserved, still paid)
        pay = j.get("payment") or {}
        assert pay.get("status") == "paid"
        assert str(pay.get("transaction_id", "")).startswith("TEST_TXN_"), \
            f"transaction_id changed → Square would have been called! got {pay.get('transaction_id')}"

    def test_first_time_select_driver_without_source_still_requires_payment(self, admin, customer):
        """Sanity: not-yet-paid booking still enforces payment (source_id required)."""
        d = _register_driver(admin)
        b = _make_booking(customer)
        r = customer.post(f"{API}/bookings/{b['booking_id']}/select-driver",
                          json={"driver_id": d["user_id"]})
        # payment.status is 'unpaid' here → already_paid = False → source_id required
        assert r.status_code == 400
        assert "Payment details required" in r.text
