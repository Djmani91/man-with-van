"""Tests for driver document uploads (profile/van/licence/insurance)."""
import io
import os
import uuid

import pytest
import requests
from pathlib import Path

def _load_env():
    envp = Path("/app/frontend/.env")
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("REACT_APP_BACKEND_URL", "")

BASE_URL = _load_env().rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\x00\x00\x00\x03\x00\x01\x9a\xa3z\x83\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(scope="module")
def driver_session():
    s = requests.Session()
    email = f"TEST_drv_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Test Driver",
        "email": email,
        "phone": "07123000000",
        "password": "Drive#2026",
        "vehicle": "Large Luton — TE12 STV",
        "licence_no": "TEST12345",
        "insurance_no": "INS12345",
        "mot_expiry": None,
        "home_postcode": "M1 1AA",
        "address": "1 Test St",
        "pricing": {
            "rates": {"small": 35, "medium": 40, "large": 45, "xl": 50},
            "stairs_fee": 5, "helper_rate": 15,
        },
    }
    r = s.post(f"{BASE_URL}/api/auth/driver-register", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"session": s, "user_id": body["user_id"], "email": email}


def test_driver_profile_has_photo_fields(driver_session):
    s = driver_session["session"]
    r = s.get(f"{BASE_URL}/api/driver/profile", timeout=15)
    assert r.status_code == 200, r.text
    p = r.json()
    for k in ("profile_photo", "van_photo", "licence_photo", "insurance_photo"):
        assert k in p, f"missing key {k}"
        assert p[k] is None


def _upload(session, name="a.png"):
    files = {"file": (name, io.BytesIO(PNG_BYTES), "image/png")}
    r = session.post(f"{BASE_URL}/api/upload", files=files, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "path" in data and isinstance(data["path"], str) and data["path"]
    return data["path"]


def test_upload_returns_path(driver_session):
    p = _upload(driver_session["session"])
    assert p


def test_driver_documents_persists_all_four(driver_session):
    s = driver_session["session"]
    docs = {
        "profile_photo": _upload(s, "profile.png"),
        "van_photo": _upload(s, "van.png"),
        "licence_photo": _upload(s, "lic.png"),
        "insurance_photo": _upload(s, "ins.png"),
    }
    r = s.post(f"{BASE_URL}/api/driver/documents", json=docs, timeout=30)
    assert r.status_code == 200, r.text
    updated = r.json()
    for k, v in docs.items():
        assert updated[k] == v

    # GET verify persistence
    r2 = s.get(f"{BASE_URL}/api/driver/profile", timeout=15)
    assert r2.status_code == 200
    p = r2.json()
    for k, v in docs.items():
        assert p[k] == v


def test_admin_sees_driver_with_docs_count():
    a = requests.Session()
    r = a.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    r = a.get(f"{BASE_URL}/api/admin/drivers", timeout=30)
    assert r.status_code == 200
    drivers = r.json()
    # find any driver with all 4 photos set
    matches = [d for d in drivers
               if all(d.get(k) for k in ("profile_photo", "van_photo", "licence_photo", "insurance_photo"))]
    assert matches, "No driver with all 4 docs found in admin listing"
    d = matches[0]
    assert "email" in d and d["email"]


def test_upload_requires_auth():
    r = requests.post(f"{BASE_URL}/api/upload",
                      files={"file": ("a.png", io.BytesIO(PNG_BYTES), "image/png")},
                      timeout=15)
    assert r.status_code in (401, 403)
