"""Backend tests for Admin Drivers email fix (iteration 7)."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://move-tracker-dev.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("role") == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_admin_login(admin_token):
    assert admin_token


def test_admin_drivers_includes_email(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/drivers", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    drivers = r.json()
    assert isinstance(drivers, list)
    assert len(drivers) > 0, "Expected preview DB to have drivers"
    # Every driver row must contain email key
    missing = [d for d in drivers if "email" not in d]
    assert not missing, f"Some driver objects missing 'email' key: {len(missing)}"
    # At least most drivers should have non-null emails (normally-registered ones)
    non_null = [d for d in drivers if d.get("email")]
    assert len(non_null) > 0, "No driver has a populated email — join with users failed"
    print(f"Total drivers: {len(drivers)} | with email: {len(non_null)}")


def test_register_driver_and_visible_with_email(admin_headers):
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_driver_{unique}@example.com"
    payload = {
        "name": f"TEST Driver {unique}",
        "email": email,
        "password": "Passw0rd!",
        "phone": "07000000000",
        "vehicle": "Medium Van",
        "licence_no": f"LIC{unique}",
        "insurance_no": f"INS{unique}",
        "mot_expiry": "2026-12-31",
        "home_postcode": "SW1A 1AA",
        "address": "10 Downing St",
    }
    r = requests.post(f"{BASE_URL}/api/auth/driver-register", json=payload, timeout=30)
    assert r.status_code == 200, f"driver-register failed: {r.status_code} {r.text}"
    body = r.json()
    user_id = body.get("user_id") or body.get("id")
    assert user_id, f"No user_id in register response: {body}"

    # Admin listing should now contain this driver with email
    r2 = requests.get(f"{BASE_URL}/api/admin/drivers", headers=admin_headers, timeout=30)
    assert r2.status_code == 200
    drivers = r2.json()
    match = [d for d in drivers if d.get("user_id") == user_id]
    assert match, f"Newly registered driver {user_id} not in admin list"
    driver = match[0]
    assert driver.get("email", "").lower() == email.lower(), f"Email mismatch: got {driver.get('email')}"
    assert driver.get("status") == "pending"

    # Approve action
    r3 = requests.post(f"{BASE_URL}/api/admin/drivers/{user_id}/approve", headers=admin_headers, timeout=30)
    assert r3.status_code == 200
    assert r3.json().get("status") == "approved"

    # Verify approval persisted
    r4 = requests.get(f"{BASE_URL}/api/admin/drivers", headers=admin_headers, timeout=30)
    driver2 = next(d for d in r4.json() if d.get("user_id") == user_id)
    assert driver2.get("status") == "approved"
    assert driver2.get("email", "").lower() == email.lower()


def test_admin_drivers_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/drivers", timeout=30)
    assert r.status_code in (401, 403)
