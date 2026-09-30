"""Backend tests for driver job detail enrichment (iteration 14).

Verifies /api/driver/available and /api/driver/jobs return:
- pickup_postcode, dropoff_postcode (postcode-only)
- deposit_paid flag; pickup/dropoff hidden until paid
- customer_pays, your_earnings = round(cp*0.85,2), commission_rate=0.15
- meta fields (date/time/van_name/needs_helper/floors/lifts/photos/items/distance_mi/est_hours)
- reveal=True on assigned+paid job
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://move-tracker-dev.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"

PICKUP_ADDR = "Trafalgar Square, London SW1A 2DD"
DROPOFF_ADDR = "Camden Town, London NW1 8NH"


def _mk_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin():
    s = _mk_session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def driver():
    s = _mk_session()
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_drv_{tag}@example.com"
    payload = {
        "name": f"TEST Driver {tag}", "email": email, "password": "Drive#2026",
        "phone": "+447000000001", "vehicle": "Ford Transit",
        "licence_no": f"L{tag}", "insurance_no": f"I{tag}",
        "home_postcode": "SW1A 2DD", "van_size": "medium",
    }
    r = s.post(f"{API}/auth/driver-register", json=payload)
    assert r.status_code == 200, f"driver-register failed: {r.status_code} {r.text}"
    return {"session": s, "email": email, "user_id": r.json()["user_id"]}


@pytest.fixture(scope="module")
def approved_driver(admin, driver):
    r = admin.post(f"{API}/admin/drivers/{driver['user_id']}/approve")
    assert r.status_code == 200, f"approve failed: {r.status_code} {r.text}"
    return driver


@pytest.fixture(scope="module")
def customer():
    s = _mk_session()
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_cust_{tag}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": f"TEST Customer {tag}", "email": email, "password": "Cust#2026",
        "phone": "+447000000002",
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return {"session": s, "email": email, "user_id": r.json()["user_id"]}


def _create_bidding_booking(customer_session):
    payload = {
        "pickup": PICKUP_ADDR, "dropoff": DROPOFF_ADDR, "van_size": "medium",
        "date": "2026-06-15", "time": "10:00", "pickup_floor": 2, "dropoff_floor": 3,
        "pickup_lift": False, "dropoff_lift": False, "needs_helper": True,
        "customer_name": "Test C", "customer_phone": "+447000000099",
        "items": "3 boxes and a sofa", "photos": [],
    }
    r = customer_session.post(f"{API}/bookings", json=payload)
    assert r.status_code == 200, f"booking create failed: {r.status_code} {r.text}"
    return r.json()


# ---------- /api/driver/available enrichment ----------
class TestDriverAvailable:
    def test_available_enrichment_and_privacy(self, customer, approved_driver):
        b = _create_bidding_booking(customer["session"])
        booking_id = b["booking_id"]
        # Broadcast to switch mode -> bidding
        r = customer["session"].post(f"{API}/bookings/{booking_id}/broadcast")
        assert r.status_code == 200, f"broadcast failed: {r.text}"

        # Driver fetches available
        r = approved_driver["session"].get(f"{API}/driver/available")
        assert r.status_code == 200, f"available failed: {r.text}"
        jobs = r.json()
        assert isinstance(jobs, list)
        job = next((j for j in jobs if j["booking_id"] == booking_id), None)
        assert job is not None, f"Bidding job {booking_id} not in available list: {[j['booking_id'] for j in jobs]}"

        # Postcode extraction
        assert job["pickup_postcode"] == "SW1A 2DD", job.get("pickup_postcode")
        assert job["dropoff_postcode"] == "NW1 8NH", job.get("dropoff_postcode")

        # Address hidden
        assert job["deposit_paid"] is False
        assert job["pickup"] is None
        assert job["dropoff"] is None

        # Earnings math
        assert job["commission_rate"] == 0.15
        cp = job["customer_pays"]
        assert job["your_earnings"] == round(cp * 0.85, 2)

        # Required meta fields present
        for k in ("date", "time", "van_name", "needs_helper",
                  "pickup_floor", "dropoff_floor", "pickup_lift", "dropoff_lift",
                  "photos", "items", "distance_mi", "est_hours"):
            assert k in job, f"missing {k} in available job"


# ---------- /api/driver/jobs reveal after paid ----------
class TestDriverJobsReveal:
    def test_paid_job_reveals_full_address_and_earnings(self, admin, customer, approved_driver):
        b = _create_bidding_booking(customer["session"])
        booking_id = b["booking_id"]

        # Admin assigns => payment.status = "office" => paid() True
        r = admin.post(f"{API}/admin/bookings/{booking_id}/assign",
                       json={"driver_id": approved_driver["user_id"]})
        assert r.status_code == 200, f"admin assign failed: {r.text}"

        # Driver fetches jobs
        r = approved_driver["session"].get(f"{API}/driver/jobs")
        assert r.status_code == 200
        jobs = r.json()
        job = next((j for j in jobs if j["booking_id"] == booking_id), None)
        assert job is not None, "Assigned job not in /driver/jobs"

        # Reveal
        assert job["deposit_paid"] is True
        assert job["pickup"] and PICKUP_ADDR.split(",")[0].lower() in job["pickup"].lower()
        assert job["dropoff"] and DROPOFF_ADDR.split(",")[0].lower() in job["dropoff"].lower()
        assert job["pickup_postcode"] == "SW1A 2DD"
        assert job["dropoff_postcode"] == "NW1 8NH"

        # Earnings
        assert job["commission_rate"] == 0.15
        cp = job["customer_pays"]
        assert cp > 0
        assert job["your_earnings"] == round(cp * 0.85, 2)
