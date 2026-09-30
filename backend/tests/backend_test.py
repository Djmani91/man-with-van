"""Backend API tests for Man With Van MVP (iteration 2 - driver marketplace + uploads + floors + address suggest)."""
import io
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


@pytest.fixture(scope="module")
def driver_signup():
    s = requests.Session()
    email = f"testdrv+{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/driver-register", json={
        "name": "TEST Driver", "email": email, "password": "Drive#2026", "phone": "07123999888",
        "vehicle": "Ford Transit LWB", "licence_no": "LIC-123", "insurance_no": "INS-456",
        "mot_expiry": "2027-01-01"
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "user": r.json()}


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

    def test_quote_floors_surcharge(self):
        # floor >0 + lift False => stairs surcharge
        base = requests.post(f"{API}/quote", json={
            "pickup": "SW1A 1AA", "dropoff": "E1 6AN", "van_size": "medium",
            "date": TOMORROW, "time": "11:00", "pickup_floor": 0, "dropoff_floor": 0,
            "pickup_lift": True, "dropoff_lift": True
        }).json()
        with_stairs = requests.post(f"{API}/quote", json={
            "pickup": "SW1A 1AA", "dropoff": "E1 6AN", "van_size": "medium",
            "date": TOMORROW, "time": "11:00", "pickup_floor": 3, "dropoff_floor": 2,
            "pickup_lift": False, "dropoff_lift": False
        }).json()
        stairs = [s for s in with_stairs["surcharges"] if "floor" in s["label"].lower() or "stairs" in s["label"].lower()]
        assert stairs, with_stairs
        assert with_stairs["total"] > base["total"]

    def test_quote_invalid_van(self):
        r = requests.post(f"{API}/quote", json={
            "pickup": "A", "dropoff": "B", "van_size": "nope",
            "date": TOMORROW, "time": "10:00"
        })
        assert r.status_code == 400

    def test_address_suggest(self):
        r = requests.get(f"{API}/address/suggest", params={"q": "SW"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert "label" in data[0] and "postcode" in data[0]

    def test_address_suggest_too_short(self):
        r = requests.get(f"{API}/address/suggest", params={"q": "S"})
        assert r.status_code == 200
        assert r.json() == []


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

    def test_admin_login(self, admin):
        assert admin["user"]["role"] == "admin"


# ---------------- Uploads ----------------
class TestUpload:
    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/upload", files={"file": ("a.png", b"x", "image/png")})
        assert r.status_code == 401

    def test_upload_ok(self, customer):
        # A 1x1 png
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x00\x00\x00\x00IEND\xaeB`\x82")
        r = customer["session"].post(f"{API}/upload", files={"file": ("test.png", io.BytesIO(png), "image/png")})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "path" in data and data["path"].endswith(".png")


# ---------------- Driver marketplace flow ----------------
class TestDriverMarketplace:
    def test_driver_signup_pending(self, driver_signup):
        s = driver_signup["session"]
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "driver"
        r = s.get(f"{API}/driver/profile")
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_pending_driver_blocked_from_available(self, driver_signup):
        r = driver_signup["session"].get(f"{API}/driver/available")
        assert r.status_code == 403

    def test_full_marketplace_flow(self, customer, driver_signup, admin):
        cust = customer["session"]
        drv = driver_signup["session"]
        ad = admin["session"]
        drv_user_id = driver_signup["user"]["user_id"]

        # 1. customer creates booking (unassigned confirmed)
        r = cust.post(f"{API}/bookings", json={
            "pickup": "SW1A 1AA London", "dropoff": "M1 1AE Manchester",
            "van_size": "large", "date": TOMORROW, "time": "10:00",
            "customer_name": "Test C", "customer_phone": "07123456789",
            "pickup_floor": 2, "pickup_lift": False,
        })
        assert r.status_code == 200, r.text
        booking = r.json()
        assert "_id" not in booking
        bid = booking["booking_id"]

        # 2. admin approves driver
        r = ad.post(f"{API}/admin/drivers/{drv_user_id}/approve")
        assert r.status_code == 200

        # 3. driver sees available jobs
        r = drv.get(f"{API}/driver/available")
        assert r.status_code == 200
        avail = r.json()
        assert any(j["booking_id"] == bid for j in avail), avail

        # 4. driver quotes on job
        r = drv.post(f"{API}/driver/jobs/{bid}/quote")
        assert r.status_code == 200
        assert r.json()["status"] == "waiting"

        # 5. driver sees waiting request; job no longer in available
        r = drv.get(f"{API}/driver/requests")
        assert r.status_code == 200
        assert any(j["booking_id"] == bid for j in r.json())
        r = drv.get(f"{API}/driver/available")
        assert not any(j["booking_id"] == bid for j in r.json())

        # 6. admin assigns driver -> booking.assigned; request accepted
        r = ad.post(f"{API}/admin/bookings/{bid}/assign", json={"driver_id": drv_user_id})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "assigned"

        # 7. driver sees it in jobs (accepted tab)
        r = drv.get(f"{API}/driver/jobs")
        assert any(j["booking_id"] == bid for j in r.json())

        # 8. driver updates status through states
        for st in ("en_route_pickup", "loading", "in_transit", "completed"):
            r = drv.post(f"{API}/driver/jobs/{bid}/status", json={"status": st})
            assert r.status_code == 200, r.text
            assert r.json()["status"] == st

        # 9. availability toggle
        r = drv.post(f"{API}/driver/availability", json={"available": False})
        assert r.status_code == 200
        assert r.json()["availability"] == "off"
        r = drv.post(f"{API}/driver/availability", json={"available": True})
        assert r.json()["availability"] == "available"

    def test_driver_cannot_update_others_job(self, driver_signup):
        # random bogus booking id
        r = driver_signup["session"].post(f"{API}/driver/jobs/NOPE123/status", json={"status": "loading"})
        assert r.status_code == 403


# ---------------- Role gating ----------------
class TestRoles:
    def test_customer_cannot_admin(self, customer):
        r = customer["session"].get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_customer_cannot_driver(self, customer):
        r = customer["session"].get(f"{API}/driver/profile")
        assert r.status_code == 403

    def test_unauth_cannot_admin(self):
        r = requests.get(f"{API}/admin/stats")
        assert r.status_code == 401
