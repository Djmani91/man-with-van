"""Backend tests for minimum bid enforcement (£50) and driver decline hiding jobs.

Covers review items:
1. POST /api/driver/jobs/{id}/bid rejects price < 50 with 400 + friendly message.
2. Bid of exactly 50 succeeds and returns status='waiting'.
3. POST /api/driver/jobs/{id}/decline returns status='declined' and, once
   declined, that job is no longer in GET /api/driver/available for that driver
   (both for fixed-price and bidding jobs). Other drivers still see it.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"

PICKUP = "Trafalgar Square, London SW1A 2DD"
DROPOFF = "Camden Town, London NW1 8NH"


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def admin():
    s = _session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code} {r.text}")
    return s


def _register_driver(home_postcode="SW1A 2DD"):
    s = _session()
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_drv_{tag}@example.com"
    r = s.post(f"{API}/auth/driver-register", json={
        "name": f"TEST Drv {tag}", "email": email, "password": "Drive#2026",
        "phone": "+447000000010", "vehicle": "Ford Transit",
        "licence_no": f"L{tag}", "insurance_no": f"I{tag}",
        "home_postcode": home_postcode, "van_size": "medium",
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "user_id": r.json()["user_id"]}


@pytest.fixture(scope="module")
def driver_a(admin):
    d = _register_driver()
    r = admin.post(f"{API}/admin/drivers/{d['user_id']}/approve")
    assert r.status_code == 200, r.text
    return d


@pytest.fixture(scope="module")
def driver_b(admin):
    d = _register_driver()
    r = admin.post(f"{API}/admin/drivers/{d['user_id']}/approve")
    assert r.status_code == 200, r.text
    return d


@pytest.fixture(scope="module")
def customer():
    s = _session()
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_cust_{tag}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": f"TEST C {tag}", "email": email, "password": "Cust#2026",
        "phone": "+447000000020",
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "user_id": r.json()["user_id"]}


def _create_bidding_booking(cust):
    r = cust["session"].post(f"{API}/bookings", json={
        "pickup": PICKUP, "dropoff": DROPOFF, "van_size": "medium",
        "date": "2026-07-01", "time": "10:00",
        "pickup_floor": 0, "dropoff_floor": 0,
        "pickup_lift": False, "dropoff_lift": False,
        "needs_helper": False,
        "customer_name": "Test C", "customer_phone": "+447000000099",
        "items": "a couple boxes", "photos": [],
    })
    assert r.status_code == 200, r.text
    booking_id = r.json()["booking_id"]
    br = cust["session"].post(f"{API}/bookings/{booking_id}/broadcast")
    assert br.status_code == 200, br.text
    return booking_id


# ---------- Minimum bid enforcement ----------
class TestMinBid:
    def test_bid_below_50_rejected(self, customer, driver_a):
        booking_id = _create_bidding_booking(customer)
        r = driver_a["session"].post(f"{API}/driver/jobs/{booking_id}/bid", json={"price": 30})
        assert r.status_code == 400, r.text
        msg = (r.json().get("detail") or "").lower()
        assert "minimum" in msg and "50" in msg, msg

    def test_bid_exactly_50_accepted(self, customer, driver_a):
        booking_id = _create_bidding_booking(customer)
        r = driver_a["session"].post(f"{API}/driver/jobs/{booking_id}/bid", json={"price": 50})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "waiting", body


# ---------- Decline hides job for that driver only ----------
class TestDeclineHidesJob:
    def test_decline_fixed_job_hides_for_driver_only(self, mongo, customer, driver_a, driver_b):
        # Create a booking then flip it to fixed-price re-offer state via Mongo
        # (mirrors the state after a driver cancels an assigned job).
        booking_id = _create_bidding_booking(customer)
        res = mongo.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"mode": "fixed", "fixed_price": 120.0, "driver_id": None,
                      "status": "quoting", "declined_by": []}},
        )
        assert res.matched_count == 1

        # Both drivers see the fixed job initially
        for d in (driver_a, driver_b):
            r = d["session"].get(f"{API}/driver/available")
            assert r.status_code == 200
            ids = [j["booking_id"] for j in r.json()]
            assert booking_id in ids, f"{d['email']} missing fixed job {booking_id} in {ids}"

        # driver_a declines
        r = driver_a["session"].post(f"{API}/driver/jobs/{booking_id}/decline")
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "declined"

        # driver_a no longer sees it
        r = driver_a["session"].get(f"{API}/driver/available")
        assert r.status_code == 200
        ids = [j["booking_id"] for j in r.json()]
        assert booking_id not in ids, f"declined fixed job still visible to driver_a: {ids}"

        # driver_b still sees it
        r = driver_b["session"].get(f"{API}/driver/available")
        assert r.status_code == 200
        ids = [j["booking_id"] for j in r.json()]
        assert booking_id in ids, f"fixed job disappeared for driver_b: {ids}"

    def test_decline_bidding_job_hides_for_driver_only(self, customer, driver_a, driver_b):
        booking_id = _create_bidding_booking(customer)

        # both see it
        for d in (driver_a, driver_b):
            r = d["session"].get(f"{API}/driver/available")
            assert r.status_code == 200
            assert booking_id in [j["booking_id"] for j in r.json()]

        r = driver_a["session"].post(f"{API}/driver/jobs/{booking_id}/decline")
        assert r.status_code == 200 and r.json().get("status") == "declined"

        r = driver_a["session"].get(f"{API}/driver/available")
        assert booking_id not in [j["booking_id"] for j in r.json()]

        r = driver_b["session"].get(f"{API}/driver/available")
        assert booking_id in [j["booking_id"] for j in r.json()]
