"""Booking flow with mandatory items/notes/photos (iter 15)."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://move-tracker-dev.preview.emergentagent.com"
API = f"{BASE_URL}/api"

CUSTOMER_EMAIL = "customer@example.com"
CUSTOMER_PASS = "Customer#2026"


@pytest.fixture(scope="module")
def customer_token():
    s = requests.Session()
    # Try login first
    r = s.post(f"{API}/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASS})
    if r.status_code != 200:
        # Register
        r = s.post(f"{API}/auth/register", json={
            "name": "Test Customer", "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASS, "phone": "07123456789",
        })
        assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("token")
    assert token, f"no token in {data}"
    return token


def test_upload_requires_auth():
    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"0" * 100, "image/png")}
    r = requests.post(f"{API}/upload", files=files)
    assert r.status_code in (401, 403), f"expected auth-required, got {r.status_code}"


def test_upload_and_booking_with_photos(customer_token):
    headers = {"Authorization": f"Bearer {customer_token}"}
    # Upload a photo
    png = b"\x89PNG\r\n\x1a\n" + b"testdata" * 32
    files = {"file": ("photo.png", png, "image/png")}
    r = requests.post(f"{API}/upload", files=files, headers=headers)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    photo_path = r.json().get("path")
    assert photo_path, f"no path in {r.json()}"

    # Create booking with items/notes/photos
    payload = {
        "pickup": "SW1A 1AA, London",
        "dropoff": "E16 2FR, London",
        "pickup_floor": 0, "dropoff_floor": 0,
        "pickup_lift": True, "dropoff_lift": True,
        "date": "2026-06-15", "time": "10:00",
        "van_size": "small",
        "needs_helper": False, "heavy_items": False,
        "items": "Double bed, sofa, 10 boxes",
        "photos": [photo_path],
        "customer_name": "Test Customer",
        "customer_phone": "07123456789",
        "notes": "Parking is tight; call on arrival",
        "promo_code": "",
    }
    r = requests.post(f"{API}/bookings", json=payload, headers=headers)
    assert r.status_code == 200, f"booking failed: {r.status_code} {r.text}"
    b = r.json()
    assert b.get("items") == payload["items"]
    assert b.get("notes") == payload["notes"]
    assert b.get("photos") == [photo_path]
    assert b.get("booking_id", "").startswith("MWV")


def test_register_new_user_and_book_end_to_end():
    """Simulate the guest sign-in-at-end flow via API."""
    s = requests.Session()
    email = f"bookflow_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Guest Flow", "email": email,
        "password": "Book#2026", "phone": "07999888777",
    })
    assert r.status_code == 200, f"register: {r.status_code} {r.text}"
    token = r.json().get("session_token") or r.json().get("token")
    assert token
    headers = {"Authorization": f"Bearer {token}"}

    png = b"\x89PNG\r\n\x1a\n" + b"x" * 200
    up = requests.post(f"{API}/upload", files={"file": ("g.png", png, "image/png")}, headers=headers)
    assert up.status_code == 200
    path = up.json()["path"]

    payload = {
        "pickup": "SW1A 1AA", "dropoff": "E16 2FR",
        "pickup_floor": 0, "dropoff_floor": 0,
        "pickup_lift": True, "dropoff_lift": True,
        "date": "2026-07-10", "time": "09:00", "van_size": "small",
        "needs_helper": False, "heavy_items": False,
        "items": "Guest items", "photos": [path],
        "customer_name": "Guest Flow", "customer_phone": "07999888777",
        "notes": "Guest notes", "promo_code": "",
    }
    r = requests.post(f"{API}/bookings", json=payload, headers=headers)
    assert r.status_code == 200
    b = r.json()
    assert b["photos"] == [path]
    assert b["items"] == "Guest items"
    assert b["notes"] == "Guest notes"
