"""Iteration 9: verify a PENDING driver with ZERO photos (mobile-style register)
is present in /api/admin/drivers with email populated + null photo fields, and is approvable.
"""
import os
import uuid
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://move-tracker-dev.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def registered_driver():
    """Mimic mobile: register with pricing, no photos uploaded."""
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_pending_{unique}@example.com"
    payload = {
        "name": f"TEST Pending {unique}",
        "email": email,
        "password": "Passw0rd!",
        "phone": "07123456789",
        "vehicle": "Medium Van",
        "licence_no": f"LIC{unique}",
        "insurance_no": f"INS{unique}",
        "mot_expiry": "2026-12-31",
        "home_postcode": "SW1A 1AA",
        "address": "10 Downing St",
        "pricing": {
            "rates": {"small": 40, "medium": 55, "large": 75, "xl": 95},
            "stairs_fee": 10, "helper_rate": 15,
        },
    }
    r = requests.post(f"{BASE_URL}/api/auth/driver-register", json=payload, timeout=30)
    assert r.status_code == 200, f"driver-register failed: {r.status_code} {r.text}"
    body = r.json()
    user_id = body.get("user_id") or body.get("id")
    assert user_id
    return {"user_id": user_id, "email": email, "token": body["token"]}


def test_admin_lists_pending_no_photo_driver(admin_headers, registered_driver):
    r = requests.get(f"{BASE_URL}/api/admin/drivers", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    drivers = r.json()
    match = [d for d in drivers if d.get("user_id") == registered_driver["user_id"]]
    assert match, f"Pending driver {registered_driver['user_id']} not returned by admin list"
    d = match[0]
    # Email populated (join with users worked)
    assert (d.get("email") or "").lower() == registered_driver["email"].lower()
    # Status pending
    assert d.get("status") == "pending"
    # All 4 photo fields null/absent
    for f in ("profile_photo", "van_photo", "licence_photo", "insurance_photo"):
        assert d.get(f) in (None, ""), f"{f} unexpectedly set: {d.get(f)}"


def test_driver_profile_reflects_null_photos(registered_driver):
    h = {"Authorization": f"Bearer {registered_driver['token']}"}
    r = requests.get(f"{BASE_URL}/api/driver/profile", headers=h, timeout=30)
    assert r.status_code == 200
    prof = r.json()
    for f in ("profile_photo", "van_photo", "licence_photo", "insurance_photo"):
        assert prof.get(f) in (None, "")
    assert prof.get("status") == "pending"


def test_approve_pending_no_photo_driver(admin_headers, registered_driver):
    uid = registered_driver["user_id"]
    r = requests.post(f"{BASE_URL}/api/admin/drivers/{uid}/approve",
                      headers=admin_headers, timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "approved"
    # Verify persisted + still visible
    r2 = requests.get(f"{BASE_URL}/api/admin/drivers", headers=admin_headers, timeout=30)
    d = next(x for x in r2.json() if x.get("user_id") == uid)
    assert d.get("status") == "approved"
    assert (d.get("email") or "").lower() == registered_driver["email"].lower()
