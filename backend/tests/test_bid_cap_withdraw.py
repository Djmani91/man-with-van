"""Tests for driver bid cap & withdraw flow (iteration 22).

Covers:
- POST /api/driver/jobs/{id}/bid (waiting, live-quote guard, 2x cap)
- POST /api/driver/jobs/{id}/withdraw
- GET  /api/driver/available (hides live/exhausted, exposes quotes_used)
- GET  /api/driver/requests (waiting bids)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://move-tracker-dev.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DRV_EMAIL = "drv1@example.com"
DRV_PASS = "Drive#2026"
CUST_EMAIL = "customer@example.com"
CUST_PASS = "Customer#2026"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def drv_token():
    return _login(DRV_EMAIL, DRV_PASS)


@pytest.fixture(scope="module")
def cust_token():
    return _login(CUST_EMAIL, CUST_PASS)


def _create_and_broadcast_bidding_job(cust_token, drv_token):
    """Create a booking as customer, broadcast it, and ensure drv1 sees it.

    Retries with different pickup postcodes because driver->job distance is
    simulated by hashing when the driver has no base_coords.
    """
    # Try several pickups to land within 20mi
    postcodes = ["M1 1AA", "M1 2AB", "M2 3CD", "M3 4EF", "M4 5GH", "M5 6IJ", "M6 7KL", "M7 8MN", "M8 9OP"]
    for pc in postcodes:
        payload = {
            "pickup": pc, "dropoff": "M20 2LN",
            "van_size": "large", "date": "2026-12-15", "time": "10:00",
            "pickup_floor": 0, "dropoff_floor": 0,
            "pickup_lift": True, "dropoff_lift": True,
            "needs_helper": False, "heavy_items": False,
            "items": "Boxes and small furniture", "photos": ["data:image/png;base64,iVBORw0KGgo="],
            "customer_name": "Test Customer", "customer_phone": "07000000000",
            "notes": "TEST_bid_cap flow",
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=_h(cust_token), timeout=30)
        assert r.status_code == 200, f"create booking failed: {r.status_code} {r.text}"
        bid_id = r.json()["booking_id"]
        # Broadcast for bidding
        rb = requests.post(f"{API}/bookings/{bid_id}/broadcast", headers=_h(cust_token), timeout=30)
        assert rb.status_code == 200, f"broadcast failed: {rb.status_code} {rb.text}"
        # Check if driver can see it
        ra = requests.get(f"{API}/driver/available", headers=_h(drv_token), timeout=30)
        assert ra.status_code == 200
        ids = [j["booking_id"] for j in ra.json()]
        if bid_id in ids:
            return bid_id
    pytest.skip("Could not seed a bidding job within driver radius (simulated distance).")


class TestBidCapWithdraw:
    def test_full_flow(self, cust_token, drv_token):
        bid_id = _create_and_broadcast_bidding_job(cust_token, drv_token)
        h = _h(drv_token)

        # (a) First bid -> waiting attempts 1
        r = requests.post(f"{API}/driver/jobs/{bid_id}/bid", json={"price": 60}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json(); assert d["status"] == "waiting" and d["attempts"] == 1

        # (b) Second bid while waiting -> 400 live-quote guard
        r = requests.post(f"{API}/driver/jobs/{bid_id}/bid", json={"price": 65}, headers=h, timeout=30)
        assert r.status_code == 400
        msg = (r.json().get("detail") or "").lower()
        assert "live quote" in msg and "withdraw" in msg, msg

        # Job listed in requests (waiting), not in available
        rq = requests.get(f"{API}/driver/requests", headers=h, timeout=30).json()
        assert bid_id in [j["booking_id"] for j in rq]
        av = requests.get(f"{API}/driver/available", headers=h, timeout=30).json()
        assert bid_id not in [j["booking_id"] for j in av]

        # (c) Withdraw -> 200, can_requote True
        r = requests.post(f"{API}/driver/jobs/{bid_id}/withdraw", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json(); assert d["status"] == "withdrawn" and d["can_requote"] is True

        # (d) Available now includes job with quotes_used=1; requests no longer lists it
        av = requests.get(f"{API}/driver/available", headers=h, timeout=30).json()
        found = [j for j in av if j["booking_id"] == bid_id]
        assert found, "Job should reappear on /driver/available after withdraw"
        assert found[0].get("quotes_used") == 1
        rq = requests.get(f"{API}/driver/requests", headers=h, timeout=30).json()
        assert bid_id not in [j["booking_id"] for j in rq]

        # (e) Re-quote -> attempts 2
        r = requests.post(f"{API}/driver/jobs/{bid_id}/bid", json={"price": 55}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json(); assert d["status"] == "waiting" and d["attempts"] == 2

        # (f) Withdraw second time -> can_requote False
        r = requests.post(f"{API}/driver/jobs/{bid_id}/withdraw", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json(); assert d["status"] == "withdrawn" and d["can_requote"] is False

        # (g) Third bid -> 400 max reached
        r = requests.post(f"{API}/driver/jobs/{bid_id}/bid", json={"price": 50}, headers=h, timeout=30)
        assert r.status_code == 400
        msg = (r.json().get("detail") or "").lower()
        assert "maximum of 2" in msg or "2 quotes" in msg, msg

        # (h) Available should NOT include the job (exhausted)
        av = requests.get(f"{API}/driver/available", headers=h, timeout=30).json()
        assert bid_id not in [j["booking_id"] for j in av], "Exhausted job must not appear on /driver/available"

    def test_withdraw_without_active_quote_returns_400(self, drv_token):
        # Use a fake booking id
        r = requests.post(f"{API}/driver/jobs/MWVDOESNOTEX/withdraw", headers=_h(drv_token), timeout=30)
        assert r.status_code == 400
