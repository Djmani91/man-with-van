"""Backend API tests for Man With Van MVP."""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://move-tracker-dev.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"

TOMORROW = (date.today() + timedelta(days=1)).isoformat()


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def customer():
    s = requests.Session()
    email = f"testcust+{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Test Customer", "email": email, "password": "Test#2026", "phone": "07000000000"
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "user": r.json()}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"session": s, "user": r.json()}


# ---------------- Public routes ----------------
class TestPublic:
    def test_van_sizes(self):
        r = requests.get(f"{API}/vansizes")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 4
        ids = {v["id"] for v in data}
        assert ids == {"small", "medium", "large", "xl"}

    def test_quote_breakdown(self):
        r = requests.post(f"{API}/quote", json={
            "pickup": "SW1A 1AA London", "dropoff": "E1 6AN London",
            "van_size": "medium", "date": TOMORROW, "time": "10:00"
        })
        assert r.status_code == 200
        d = r.json()
        for k in ("distance_miles", "base_price", "mileage_price", "surcharges", "total", "currency"):
            assert k in d
        assert d["currency"] == "GBP"
        assert d["total"] > 0

    def test_quote_invalid_van(self):
        r = requests.post(f"{API}/quote", json={
            "pickup": "A", "dropoff": "B", "van_size": "nope",
            "date": TOMORROW, "time": "10:00"
        })
        assert r.status_code == 400


# ---------------- Auth ----------------
class TestAuth:
    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_and_me(self, customer):
        r = customer["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == customer["email"]
        assert r.json()["role"] == "customer"

    def test_duplicate_register(self, customer):
        r = requests.post(f"{API}/auth/register", json={
            "name": "x", "email": customer["email"], "password": "Test#2026"
        })
        assert r.status_code == 400

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "bad"})
        assert r.status_code == 401

    def test_logout(self):
        s = requests.Session()
        email = f"testcust+{uuid.uuid4().hex[:8]}@example.com"
        s.post(f"{API}/auth/register", json={"name": "L", "email": email, "password": "Test#2026"})
        assert s.get(f"{API}/auth/me").status_code == 200
        s.post(f"{API}/auth/logout")
        assert s.get(f"{API}/auth/me").status_code == 401

    def test_admin_login(self, admin):
        assert admin["user"]["role"] == "admin"


# ---------------- Bookings ----------------
class TestBookings:
    def test_create_booking_requires_auth(self):
        r = requests.post(f"{API}/bookings", json={
            "pickup": "A", "dropoff": "B", "van_size": "small",
            "date": TOMORROW, "time": "10:00",
            "customer_name": "x", "customer_phone": "07"
        })
        assert r.status_code == 401

    def test_full_booking_flow(self, customer, admin):
        s = customer["session"]
        # create booking
        r = s.post(f"{API}/bookings", json={
            "pickup": "SW1A 1AA London", "dropoff": "M1 1AE Manchester",
            "van_size": "large", "date": TOMORROW, "time": "10:00",
            "customer_name": "Test C", "customer_phone": "07123456789",
            "notes": "Handle with care"
        })
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "confirmed"
        assert b["price"] > 0
        assert b["booking_id"].startswith("MWV")
        assert "_id" not in b
        bid = b["booking_id"]

        # list mine
        r = s.get(f"{API}/bookings")
        assert r.status_code == 200
        assert any(x["booking_id"] == bid for x in r.json())

        # get single
        r = s.get(f"{API}/bookings/{bid}")
        assert r.status_code == 200
        assert r.json()["booking_id"] == bid

        # track
        r = s.get(f"{API}/bookings/{bid}/track")
        assert r.status_code == 200
        t = r.json()
        for k in ("status", "status_label", "pickup_coords", "dropoff_coords", "driver_position", "timeline", "eta_minutes"):
            assert k in t

        # admin creates driver
        ad = admin["session"]
        r = ad.post(f"{API}/admin/drivers", json={
            "name": "TEST Driver", "phone": "07000000001", "vehicle": "Luton XYZ"
        })
        assert r.status_code == 200, r.text
        driver_id = r.json()["driver_id"]

        # admin stats
        r = ad.get(f"{API}/admin/stats")
        assert r.status_code == 200
        stats = r.json()
        for k in ("total_bookings", "active_jobs", "completed", "revenue", "drivers"):
            assert k in stats

        # assign driver
        r = ad.post(f"{API}/admin/bookings/{bid}/assign", json={"driver_id": driver_id})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "assigned"
        assert r.json()["driver"]["name"] == "TEST Driver"

        # driver status becomes on_job
        r = ad.get(f"{API}/admin/drivers")
        drv = next(d for d in r.json() if d["driver_id"] == driver_id)
        assert drv["status"] == "on_job"

        # update status: in_transit
        r = ad.post(f"{API}/admin/bookings/{bid}/status", json={"status": "in_transit"})
        assert r.status_code == 200
        assert r.json()["status"] == "in_transit"

        # customer track reflects
        r = s.get(f"{API}/bookings/{bid}/track")
        assert r.json()["status"] == "in_transit"

        # complete
        r = ad.post(f"{API}/admin/bookings/{bid}/status", json={"status": "completed"})
        assert r.status_code == 200
        # driver back to available
        r = ad.get(f"{API}/admin/drivers")
        drv = next(d for d in r.json() if d["driver_id"] == driver_id)
        assert drv["status"] == "available"

    def test_invalid_status(self, admin, customer):
        s = customer["session"]
        r = s.post(f"{API}/bookings", json={
            "pickup": "A", "dropoff": "B", "van_size": "small",
            "date": TOMORROW, "time": "10:00",
            "customer_name": "x", "customer_phone": "07"
        })
        bid = r.json()["booking_id"]
        r = admin["session"].post(f"{API}/admin/bookings/{bid}/status", json={"status": "bogus"})
        assert r.status_code == 400


# ---------------- Role gating ----------------
class TestRoles:
    def test_customer_cannot_admin(self, customer):
        r = customer["session"].get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_unauth_cannot_admin(self):
        r = requests.get(f"{API}/admin/stats")
        assert r.status_code == 401
