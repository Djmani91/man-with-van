"""Tests for POST /api/driver/jobs/{id}/confirm (instant-quote 30-min accept window).

Covers:
- Happy path: driver confirms an awaiting job -> awaiting_driver_accept becomes False.
- 403 when the job is not assigned to this driver.
- 400 when the accept_deadline has already passed.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return s


def _admin_session() -> requests.Session:
    return _login("anisha91ahmed@gmail.com", "MoveAdmin#2026")


def _new_driver(admin: requests.Session) -> tuple[requests.Session, str, str]:
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_drv_{tag}@example.com"
    pw = "Drive#2026"
    s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/driver-register", json={
        "name": f"TEST Drv {tag}", "email": email, "password": pw,
        "phone": "+447000000010", "vehicle": "Ford Transit",
        "licence_no": f"L{tag}", "insurance_no": f"I{tag}",
        "home_postcode": "SW1A 2DD", "van_size": "medium",
    })
    assert r.status_code == 200, r.text
    duid = r.json()["user_id"]
    ar = admin.post(f"{API}/admin/drivers/{duid}/approve")
    assert ar.status_code == 200, ar.text
    # Re-login to refresh cookie/session (driver status changed)
    s = _login(email, pw)
    me = s.get(f"{API}/auth/me")
    assert me.status_code == 200
    return s, duid, email


def _seed_assigned_booking(db, driver_id: str, deadline: datetime) -> str:
    now = datetime.now(timezone.utc)
    bid = f"MWVCONF{uuid.uuid4().hex[:8].upper()}"
    db.bookings.delete_many({"booking_id": bid})
    db.bookings.insert_one({
        "booking_id": bid, "user_id": "cust-confirm-test", "driver_id": driver_id,
        "driver": {"name": "Confirm Driver", "phone": "0700", "vehicle": "Van", "rating": 5.0},
        "mode": "instant", "status": "assigned",
        "awaiting_driver_accept": True,
        "accept_deadline": deadline.isoformat(),
        "price": 80.0, "van_name": "Medium van", "van_size": "medium",
        "pickup": "1 A St, London E1 1AA", "dropoff": "2 B St, London E2 2BB",
        "pickup_coords": {"lat": 51.5, "lng": -0.1},
        "dropoff_coords": {"lat": 51.51, "lng": -0.12},
        "distance_miles": 4, "date": now.strftime("%Y-%m-%d"), "time": "10:00",
        "payment": {"status": "paid", "type": "deposit", "amount": 12.0, "balance_due": 68.0},
        "timeline": [], "created_at": now.isoformat(),
    })
    return bid


# ---------- Tests ----------

class TestDriverConfirm:
    @classmethod
    def setup_class(cls):
        cls.admin = _admin_session()
        cls.drv_session, cls.drv_id, cls.drv_email = _new_driver(cls.admin)
        # A second driver (for 403 check)
        cls.other_session, cls.other_id, cls.other_email = _new_driver(cls.admin)
        cls.seeded_ids: list[str] = []

    @classmethod
    def teardown_class(cls):
        client = MongoClient(MONGO_URL)
        client[DB_NAME].bookings.delete_many({"booking_id": {"$in": cls.seeded_ids}})

    def test_confirm_happy_path(self, db):
        deadline = datetime.now(timezone.utc) + timedelta(minutes=25)
        bid = _seed_assigned_booking(db, self.drv_id, deadline)
        self.__class__.seeded_ids.append(bid)

        r = self.drv_session.post(f"{API}/driver/jobs/{bid}/confirm")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "assigned"
        assert "confirmed" in data["message"].lower()

        # Persistence: awaiting_driver_accept flips to False
        b = db.bookings.find_one({"booking_id": bid}, {"_id": 0})
        assert b["awaiting_driver_accept"] is False
        assert b["status"] == "assigned"
        # Timeline appended
        labels = [t.get("label") for t in (b.get("timeline") or [])]
        assert any("confirmed" in (lbl or "").lower() for lbl in labels)

    def test_confirm_not_your_job_returns_403(self, db):
        deadline = datetime.now(timezone.utc) + timedelta(minutes=25)
        bid = _seed_assigned_booking(db, self.drv_id, deadline)
        self.__class__.seeded_ids.append(bid)

        r = self.other_session.post(f"{API}/driver/jobs/{bid}/confirm")
        assert r.status_code == 403, r.text

        # Original driver's job stays awaiting
        b = db.bookings.find_one({"booking_id": bid}, {"_id": 0})
        assert b["awaiting_driver_accept"] is True

    def test_confirm_expired_deadline_returns_400(self, db):
        past = datetime.now(timezone.utc) - timedelta(minutes=5)
        bid = _seed_assigned_booking(db, self.drv_id, past)
        self.__class__.seeded_ids.append(bid)

        r = self.drv_session.post(f"{API}/driver/jobs/{bid}/confirm")
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "30-minute" in detail or "window" in detail or "passed" in detail

        # Booking still awaiting (cron would flip it, but confirm alone should not)
        b = db.bookings.find_one({"booking_id": bid}, {"_id": 0})
        assert b["awaiting_driver_accept"] is True
