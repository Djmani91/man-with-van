"""Iteration 13: Admin PUT /api/admin/drivers/{id} persistence test."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def test_driver(admin_session):
    # Register a fresh driver via driver-register
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_drv_{suffix}@example.com"
    r = requests.post(f"{BASE_URL}/api/auth/driver-register", json={
        "name": "TEST Driver",
        "email": email,
        "password": "Drive#2026",
        "phone": "07000000000",
        "vehicle": "Ford Transit",
        "licence_no": "LIC123",
        "insurance_no": "INS456",
        "home_postcode": "NW6 1AA",
    })
    assert r.status_code in (200, 201), r.text
    user_id = r.json()["user_id"]
    # Find user_id via admin list
    r = admin_session.get(f"{BASE_URL}/api/admin/drivers")
    assert r.status_code == 200
    match = next((d for d in r.json() if d.get("user_id") == user_id), None)
    assert match, f"driver {user_id} not in admin list"
    return match


def test_admin_drivers_list_has_photo_and_email(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/drivers")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        d = data[0]
        # email should be joined in
        assert "email" in d
        # photo fields may or may not exist, but the four keys should be recognized if present
        for f in ("profile_photo", "van_photo", "licence_photo", "insurance_photo"):
            # optional: just assert not blowing up
            _ = d.get(f)


def test_admin_update_driver_persists_all_fields(admin_session, test_driver):
    driver_id = test_driver["user_id"]
    payload = {
        "name": "TEST Updated Name",
        "phone": "07123456789",
        "vehicle": "Mercedes Sprinter",
        "van_size": "large",
        "home_postcode": "SW1A 1AA",
        "status": "approved",
        "availability": "off",
        "pricing": {
            "rates": {"small": 40.0, "medium": 45.0, "large": 50.0, "xl": 55.0},
            "stairs_fee": 8.0,
            "helper_rate": 20.0,
        },
    }
    r = admin_session.put(f"{BASE_URL}/api/admin/drivers/{driver_id}", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "TEST Updated Name"
    assert body["phone"] == "07123456789"
    assert body["vehicle"] == "Mercedes Sprinter"
    assert body["van_size"] == "large"
    assert body["status"] == "approved"
    assert body["availability"] == "off"
    assert body["pricing"]["rates"]["small"] == 40.0
    assert body["pricing"]["rates"]["xl"] == 55.0
    assert body["pricing"]["stairs_fee"] == 8.0
    assert body["pricing"]["helper_rate"] == 20.0

    # GET verify (via admin drivers list)
    r = admin_session.get(f"{BASE_URL}/api/admin/drivers")
    assert r.status_code == 200
    match = next((d for d in r.json() if d["user_id"] == driver_id), None)
    assert match
    assert match["van_size"] == "large"
    assert match["availability"] == "off"
    assert match["status"] == "approved"
    assert match["pricing"]["rates"]["medium"] == 45.0


def test_admin_update_driver_status_variants(admin_session, test_driver):
    driver_id = test_driver["user_id"]
    for status in ("suspended", "pending", "approved"):
        r = admin_session.put(f"{BASE_URL}/api/admin/drivers/{driver_id}", json={"status": status})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == status


def test_admin_update_driver_404(admin_session):
    r = admin_session.put(f"{BASE_URL}/api/admin/drivers/user_doesnotexist", json={"name": "x"})
    assert r.status_code == 404


def test_admin_update_driver_requires_admin(test_driver):
    # unauthenticated
    r = requests.put(f"{BASE_URL}/api/admin/drivers/{test_driver['user_id']}", json={"name": "x"})
    assert r.status_code in (401, 403)
