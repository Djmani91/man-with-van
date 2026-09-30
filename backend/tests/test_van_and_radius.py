"""Iteration 10 — INSTANT radius (5→10mi), van-size fallback, BIDDING 20mi, admin job modal chat."""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests


def _load_env():
    envf = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    try:
        for line in open(envf):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return os.environ.get("REACT_APP_BACKEND_URL", "")


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_env()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "anisha91ahmed@gmail.com"
ADMIN_PASSWORD = "MoveAdmin#2026"
TOMORROW = (date.today() + timedelta(days=1)).isoformat()


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def customer():
    s = requests.Session()
    email = f"TEST_cust_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "TEST Customer", "email": email, "password": "Test#2026",
        "phone": "07000000000",
    })
    assert r.status_code == 200, r.text
    return s


def _register_and_approve_driver(admin_s, van_size=None, postcode="SW1A 1AA"):
    s = requests.Session()
    email = f"TEST_drv_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": f"TEST Drv {van_size or 'legacy'}",
        "email": email, "password": "Drive#2026", "phone": "07123999888",
        "vehicle": "Ford Transit LWB", "licence_no": "LIC-123", "insurance_no": "INS-456",
        "mot_expiry": "2027-01-01", "home_postcode": postcode,
    }
    if van_size:
        payload["van_size"] = van_size
    r = s.post(f"{API}/auth/driver-register", json=payload)
    assert r.status_code == 200, r.text
    uid = r.json()["user_id"]
    r2 = admin_s.post(f"{API}/admin/drivers/{uid}/approve")
    assert r2.status_code == 200
    return {"session": s, "user_id": uid, "email": email}


def _make_booking(cust, van="large", pickup="SW1A 1AA London", dropoff="M1 1AE Manchester"):
    r = cust.post(f"{API}/bookings", json={
        "pickup": pickup, "dropoff": dropoff,
        "van_size": van, "date": TOMORROW, "time": "10:00",
        "customer_name": "TEST C", "customer_phone": "07123456789",
    })
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------
# Driver signup accepts + stores van_size
# --------------------------------------------------------------------------
class TestDriverVanSize:
    def test_driver_register_stores_van_size(self, admin):
        d = _register_and_approve_driver(admin, van_size="xl")
        r = d["session"].get(f"{API}/driver/profile")
        assert r.status_code == 200
        assert r.json().get("van_size") == "xl"

    def test_driver_register_ignores_invalid_van_size(self, admin):
        d = _register_and_approve_driver(admin, van_size="massive")
        r = d["session"].get(f"{API}/driver/profile")
        assert r.status_code == 200
        # invalid van sizes should not be stored (falls back to None → legacy)
        assert r.json().get("van_size") in (None, "")


# --------------------------------------------------------------------------
# Instant offers response shape + tags + cap
# --------------------------------------------------------------------------
class TestInstantOffersShape:
    def test_shape_and_cap(self, customer, admin):
        # ensure at least one van=large approved+available driver exists (legacy pool will fill it too)
        _register_and_approve_driver(admin, van_size="large")
        b = _make_booking(customer, van="large")
        r = customer.get(f"{API}/bookings/{b['booking_id']}/instant-offers")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("radius_mi", "van_fallback", "requested_van_name", "offers"):
            assert k in data, f"missing key {k}"
        assert data["radius_mi"] in (5, 10)
        assert isinstance(data["van_fallback"], bool)
        assert "Large" in data["requested_van_name"]
        assert isinstance(data["offers"], list)
        assert len(data["offers"]) <= 5
        # each offer contains offered_van_size + offered_van_name
        for o in data["offers"]:
            assert "offered_van_size" in o and o["offered_van_size"] in ("small", "medium", "large", "xl")
            assert o.get("offered_van_name")
            assert o["price"] > 0
        # sorted by price ascending
        prices = [o["price"] for o in data["offers"]]
        assert prices == sorted(prices)
        # tags
        if data["offers"]:
            tags = set()
            for o in data["offers"]:
                tags.update(o.get("tags", []))
            assert "cheapest" in tags
            assert "closest" in tags


# --------------------------------------------------------------------------
# Radius expansion: try many pickups; require that at least one triggers radius=10
# --------------------------------------------------------------------------
class TestRadiusExpansion:
    def test_radius_expands_to_10_when_no_driver_in_5(self, customer, admin):
        # Ensure some drivers exist
        _register_and_approve_driver(admin, van_size="large")
        found_expanded = False
        for pc in ["EX1 1AA Exeter", "IV2 3AA Inverness", "TR1 1AA Truro",
                   "LL57 1AA Bangor", "DD1 1AA Dundee", "KA1 1AA Kilmarnock",
                   "YO1 1AA York", "NR1 1AA Norwich", "PL1 1AA Plymouth",
                   "PH1 1AA Perth"]:
            b = _make_booking(customer, van="large", pickup=pc)
            data = customer.get(f"{API}/bookings/{b['booking_id']}/instant-offers").json()
            if data["radius_mi"] == 10 and data["offers"]:
                found_expanded = True
                break
        assert found_expanded, "No pickup produced radius expansion to 10mi — check driver distance distribution"


# --------------------------------------------------------------------------
# Broadcast bidding radius = 20mi
# --------------------------------------------------------------------------
class TestBroadcast20mi:
    def test_broadcast_returns_20_radius(self, customer):
        b = _make_booking(customer, pickup="SE1 1AA London")
        r = customer.post(f"{API}/bookings/{b['booking_id']}/broadcast")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == "bidding"
        assert data["radius_mi"] == 20


# --------------------------------------------------------------------------
# Admin manual-assign + chat (customer & driver post → admin can read)
# --------------------------------------------------------------------------
class TestAdminAssignAndChat:
    def test_admin_can_read_chat_after_manual_assign(self, admin, customer):
        drv = _register_and_approve_driver(admin, van_size="large")
        b = _make_booking(customer)

        # admin manual assign (no payment)
        r = admin.post(f"{API}/admin/bookings/{b['booking_id']}/assign", json={"driver_id": drv["user_id"]})
        assert r.status_code == 200, r.text
        assigned = r.json()
        assert assigned["driver_id"] == drv["user_id"]
        assert assigned["status"] == "assigned"

        # customer & driver each post a message
        r1 = customer.post(f"{API}/bookings/{b['booking_id']}/messages", json={"text": "Hi driver!"})
        assert r1.status_code == 200, r1.text
        r2 = drv["session"].post(f"{API}/bookings/{b['booking_id']}/messages", json={"text": "Hello customer!"})
        assert r2.status_code == 200, r2.text

        # admin reads chat
        r3 = admin.get(f"{API}/bookings/{b['booking_id']}/messages")
        assert r3.status_code == 200
        msgs = r3.json()
        assert len(msgs) >= 2
        texts = " | ".join(m["text"] for m in msgs)
        assert "Hi driver!" in texts
        assert "Hello customer!" in texts
        # role ordering preserved
        roles = [m["sender_role"] for m in msgs]
        assert "customer" in roles and "driver" in roles

    def test_admin_reads_empty_thread(self, admin, customer):
        # booking with no driver → admin reading messages should still 200 with empty list (no driver check on GET)
        b = _make_booking(customer)
        r = admin.get(f"{API}/bookings/{b['booking_id']}/messages")
        assert r.status_code == 200
        assert r.json() == []
