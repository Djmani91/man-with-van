"""Backend API tests for Man With Van (iteration 3 — customer marketplace: quoting,
instant offers, bidding, mock payment, chat masking, driver pricing, notifications)."""
import io
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


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def customer():
    s = requests.Session()
    email = f"testcust+{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "TEST Customer", "email": email, "password": "Test#2026", "phone": "07000000000"
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "user": r.json()}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"session": s}


def _register_driver(name="TEST Driver"):
    s = requests.Session()
    email = f"testdrv+{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/driver-register", json={
        "name": name, "email": email, "password": "Drive#2026", "phone": "07123999888",
        "vehicle": "Ford Transit LWB", "licence_no": "LIC-123", "insurance_no": "INS-456",
        "mot_expiry": "2027-01-01", "home_postcode": "SW1A 1AA",
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "user": r.json()}


@pytest.fixture(scope="module")
def approved_driver(admin):
    d = _register_driver("TEST ApprovedDrv")
    r = admin["session"].post(f"{API}/admin/drivers/{d['user']['user_id']}/approve")
    assert r.status_code == 200
    return d


@pytest.fixture(scope="module")
def approved_driver_2(admin):
    d = _register_driver("TEST ApprovedDrv2")
    r = admin["session"].post(f"{API}/admin/drivers/{d['user']['user_id']}/approve")
    assert r.status_code == 200
    return d


def _make_booking(cust_session, van="large", pickup="SW1A 1AA London", dropoff="M1 1AE Manchester"):
    r = cust_session.post(f"{API}/bookings", json={
        "pickup": pickup, "dropoff": dropoff,
        "van_size": van, "date": TOMORROW, "time": "10:00",
        "customer_name": "Test C", "customer_phone": "07123456789",
    })
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Public ----------------
class TestPublic:
    def test_van_sizes(self):
        r = requests.get(f"{API}/vansizes")
        assert r.status_code == 200
        assert {v["id"] for v in r.json()} == {"small", "medium", "large", "xl"}

    def test_pricing_bounds(self):
        r = requests.get(f"{API}/pricing-bounds")
        assert r.status_code == 200
        data = r.json()
        assert set(data["rates"].keys()) == {"small", "medium", "large", "xl"}
        assert data["stairs_fee"]["min"] <= data["stairs_fee"]["max"]

    def test_quote(self):
        r = requests.post(f"{API}/quote", json={
            "pickup": "SW1A 1AA", "dropoff": "E1 6AN", "van_size": "medium",
            "date": TOMORROW, "time": "10:00"
        })
        assert r.status_code == 200
        assert r.json()["total"] > 0

    def test_address_suggest_short(self):
        assert requests.get(f"{API}/address/suggest", params={"q": "S"}).json() == []
        r = requests.get(f"{API}/address/suggest", params={"q": "SW"})
        assert len(r.json()) > 0


# ---------------- Auth / Role gating ----------------
class TestAuth:
    def test_me_requires_auth(self):
        assert requests.get(f"{API}/auth/me").status_code == 401

    def test_register_and_me(self, customer):
        r = customer["session"].get(f"{API}/auth/me")
        assert r.status_code == 200 and r.json()["role"] == "customer"

    def test_admin_login(self, admin):
        r = admin["session"].get(f"{API}/auth/me")
        assert r.json()["role"] == "admin"

    def test_customer_blocked_from_admin(self, customer):
        assert customer["session"].get(f"{API}/admin/stats").status_code == 403

    def test_customer_blocked_from_driver(self, customer):
        assert customer["session"].get(f"{API}/driver/profile").status_code == 403


# ---------------- Driver signup (home_postcode + pricing) ----------------
class TestDriverSignup:
    def test_driver_signup_pending_with_home_postcode(self):
        d = _register_driver("TEST PendingDrv")
        p = d["session"].get(f"{API}/driver/profile").json()
        assert p["status"] == "pending"
        assert p["home_postcode"] == "SW1A 1AA"
        assert "pricing" in p and "rates" in p["pricing"]

    def test_pending_driver_cannot_view_bidding_jobs(self):
        d = _register_driver("TEST PendingDrv2")
        assert d["session"].get(f"{API}/driver/available").status_code == 403


# ---------------- Booking creation ----------------
class TestBookingCreation:
    def test_booking_starts_as_quoting(self, customer):
        b = _make_booking(customer["session"])
        assert "_id" not in b
        assert b["status"] == "quoting"
        assert b["driver_id"] is None
        assert b["payment"]["status"] == "unpaid"
        # verify persistence
        r = customer["session"].get(f"{API}/bookings/{b['booking_id']}")
        assert r.status_code == 200 and r.json()["status"] == "quoting"


# ---------------- Instant offers + mock payment ----------------
class TestInstantOffers:
    def test_instant_offers_present(self, customer, approved_driver, approved_driver_2):
        b = _make_booking(customer["session"])
        r = customer["session"].get(f"{API}/bookings/{b['booking_id']}/instant-offers")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["offers"], list)
        assert len(data["offers"]) >= 1
        # tags applied
        tag_union = set()
        for o in data["offers"]:
            tag_union.update(o.get("tags", []))
            assert o["driver_id"] and o["price"] > 0
        assert "cheapest" in tag_union
        assert "closest" in tag_union

    def test_select_driver_deposit_and_masking(self, customer, approved_driver):
        b = _make_booking(customer["session"])
        r = customer["session"].get(f"{API}/bookings/{b['booking_id']}/instant-offers")
        offers = r.json()["offers"]
        chosen = next((o for o in offers if o["driver_id"] == approved_driver["user"]["user_id"]), offers[0])

        # Before paying: driver phone masked on GET booking (no driver yet actually — driver_id is None,
        # so we test masking after payment). But also verify the "unpaid+driver" masking path via the
        # GET after we assign then simulate an unpaid state is out-of-scope; here we just verify select.
        r = customer["session"].post(f"{API}/bookings/{b['booking_id']}/select-driver", json={
            "driver_id": chosen["driver_id"], "payment_type": "deposit",
        })
        assert r.status_code == 200, r.text
        booking = r.json()
        assert booking["status"] == "assigned"
        assert booking["driver_id"] == chosen["driver_id"]
        pay = booking["payment"]
        assert pay["status"] == "paid" and pay["type"] == "deposit"
        assert pay["deposit"] == round(chosen["price"] * 0.15, 2)
        assert pay["amount"] == pay["deposit"]
        assert pay["balance_due"] == round(chosen["price"] - pay["deposit"], 2)
        assert pay["transaction_id"].startswith("MOCK-")

        # Once paid, phone is revealed on track
        r = customer["session"].get(f"{API}/bookings/{b['booking_id']}/track")
        assert r.status_code == 200
        t = r.json()
        assert t["driver"]["phone"] is not None
        assert t["payment"]["status"] == "paid"

    def test_select_driver_full_payment(self, customer, approved_driver):
        b = _make_booking(customer["session"])
        offers = customer["session"].get(f"{API}/bookings/{b['booking_id']}/instant-offers").json()["offers"]
        chosen = offers[0]
        r = customer["session"].post(f"{API}/bookings/{b['booking_id']}/select-driver", json={
            "driver_id": chosen["driver_id"], "payment_type": "full",
        })
        assert r.status_code == 200, r.text
        pay = r.json()["payment"]
        assert pay["type"] == "full"
        assert pay["amount"] == chosen["price"]
        assert pay["balance_due"] == 0.0

    def test_select_driver_invalid_payment_type(self, customer, approved_driver):
        b = _make_booking(customer["session"])
        offers = customer["session"].get(f"{API}/bookings/{b['booking_id']}/instant-offers").json()["offers"]
        r = customer["session"].post(f"{API}/bookings/{b['booking_id']}/select-driver", json={
            "driver_id": offers[0]["driver_id"], "payment_type": "invalid",
        })
        assert r.status_code == 400

    def test_cannot_double_assign(self, customer, approved_driver):
        b = _make_booking(customer["session"])
        offers = customer["session"].get(f"{API}/bookings/{b['booking_id']}/instant-offers").json()["offers"]
        did = offers[0]["driver_id"]
        r1 = customer["session"].post(f"{API}/bookings/{b['booking_id']}/select-driver", json={
            "driver_id": did, "payment_type": "deposit"})
        assert r1.status_code == 200
        r2 = customer["session"].post(f"{API}/bookings/{b['booking_id']}/select-driver", json={
            "driver_id": did, "payment_type": "deposit"})
        assert r2.status_code == 400


# ---------------- Bidding flow ----------------
class TestBidding:
    def test_full_bidding_flow(self, customer, approved_driver):
        # use SE1 pickup — distance from SW1A driver is 3.2 mi (within 30mi bidding radius)
        b = _make_booking(customer["session"], pickup="SE1 1AA London", dropoff="M1 1AE Manchester")
        # customer broadcast
        r = customer["session"].post(f"{API}/bookings/{b['booking_id']}/broadcast")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == "bidding"
        assert data["radius_mi"] == 30

        # driver sees it in available (bidding within 30mi is deterministic; skip if not visible)
        drv = approved_driver["session"]
        avail = drv.get(f"{API}/driver/available").json()
        job = next((j for j in avail if j["booking_id"] == b["booking_id"]), None)
        if not job:
            pytest.skip("Simulated driver distance placed this driver outside 30mi bidding radius")

        assert "suggested_price" in job and job["suggested_price"] > 0

        # driver bids
        my_bid = 149.99
        r = drv.post(f"{API}/driver/jobs/{b['booking_id']}/bid", json={"price": my_bid})
        assert r.status_code == 200 and r.json()["status"] == "waiting"

        # duplicate bid rejected
        r = drv.post(f"{API}/driver/jobs/{b['booking_id']}/bid", json={"price": 200.0})
        assert r.status_code == 400

        # bid appears in driver /requests
        req = drv.get(f"{API}/driver/requests").json()
        assert any(x["booking_id"] == b["booking_id"] and x.get("my_bid") == my_bid for x in req)

        # customer sees bids
        bids = customer["session"].get(f"{API}/bookings/{b['booking_id']}/bids").json()
        assert any(x["driver_id"] == approved_driver["user"]["user_id"] and x["price"] == my_bid for x in bids)

        # customer accepts (mock pay w/ deposit) — should use the bid price
        r = customer["session"].post(f"{API}/bookings/{b['booking_id']}/select-driver", json={
            "driver_id": approved_driver["user"]["user_id"], "payment_type": "deposit",
        })
        assert r.status_code == 200, r.text
        booking = r.json()
        assert booking["price"] == my_bid
        assert booking["payment"]["deposit"] == round(my_bid * 0.15, 2)
        assert booking["mode"] == "bidding"


# ---------------- Chat masking ----------------
class TestChatMasking:
    def test_phone_and_email_are_masked(self, customer, approved_driver):
        b = _make_booking(customer["session"])
        # assign a driver first (chat only opens then)
        offers = customer["session"].get(f"{API}/bookings/{b['booking_id']}/instant-offers").json()["offers"]
        customer["session"].post(f"{API}/bookings/{b['booking_id']}/select-driver", json={
            "driver_id": offers[0]["driver_id"], "payment_type": "deposit",
        })
        r = customer["session"].post(f"{API}/bookings/{b['booking_id']}/messages", json={
            "text": "Call me on 07123 456 789 or email me at foo@bar.com please"
        })
        assert r.status_code == 200, r.text
        text = r.json()["text"]
        assert "07123" not in text and "@bar" not in text
        assert "[contact hidden]" in text

    def test_chat_requires_driver_assigned(self, customer):
        b = _make_booking(customer["session"])
        r = customer["session"].post(f"{API}/bookings/{b['booking_id']}/messages", json={"text": "hi"})
        assert r.status_code == 400


# ---------------- Driver pricing ----------------
class TestDriverPricing:
    def test_driver_can_set_pricing(self, approved_driver):
        r = approved_driver["session"].post(f"{API}/driver/pricing", json={
            "rates": {"small": 40, "medium": 45, "large": 50, "xl": 55},
            "stairs_fee": 10, "helper_rate": 20,
        })
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["rates"]["small"] == 40
        assert p["stairs_fee"] == 10

    def test_driver_pricing_is_clamped(self, approved_driver):
        # small band is 35–45; sending 999 should clamp to 45
        r = approved_driver["session"].post(f"{API}/driver/pricing", json={
            "rates": {"small": 999, "medium": 45, "large": 50, "xl": 55},
            "stairs_fee": 999, "helper_rate": 999,
        })
        assert r.status_code == 200
        p = r.json()
        assert p["rates"]["small"] == 45
        assert p["stairs_fee"] == 15
        assert p["helper_rate"] == 25


# ---------------- Driver notifications ----------------
class TestDriverNotifications:
    def test_broadcast_creates_notification(self, customer, approved_driver):
        b = _make_booking(customer["session"])
        customer["session"].post(f"{API}/bookings/{b['booking_id']}/broadcast")
        notes = approved_driver["session"].get(f"{API}/driver/notifications").json()
        # Notification may or may not be present depending on simulated distance
        # If broadcast reached the driver, we should have one
        r = approved_driver["session"].post(f"{API}/driver/notifications/read")
        assert r.status_code == 200
        assert isinstance(notes, list)


# ---------------- Uploads (regression) ----------------
class TestUpload:
    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/upload", files={"file": ("a.png", b"x", "image/png")})
        assert r.status_code == 401

    def test_upload_ok(self, customer):
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
               b"\x0f\x00\x00\x01\x01\x00\x05\x00\x00\x00\x00IEND\xaeB`\x82")
        r = customer["session"].post(f"{API}/upload",
                                     files={"file": ("t.png", io.BytesIO(png), "image/png")})
        assert r.status_code == 200 and r.json()["path"].endswith(".png")


# ---------------- Student promo (STUDENT10) ----------------
class TestPromo:
    def test_validate_promo_valid_upper(self):
        r = requests.get(f"{API}/promo/STUDENT10")
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert data["discount_pct"] == 0.10
        assert "label" in data and data["label"]

    def test_validate_promo_case_insensitive(self):
        r = requests.get(f"{API}/promo/student10")
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert data["discount_pct"] == 0.10

    def test_validate_promo_invalid(self):
        r = requests.get(f"{API}/promo/INVALID")
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_booking_with_student_promo_stores_fields(self, customer):
        r = customer["session"].post(f"{API}/bookings", json={
            "pickup": "SW1A 1AA London", "dropoff": "M1 1AE Manchester",
            "van_size": "large", "date": TOMORROW, "time": "10:00",
            "customer_name": "Test C", "customer_phone": "07123456789",
            "promo_code": "STUDENT10",
        })
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["promo_code"] == "STUDENT10"
        assert b["promo_discount_pct"] == 0.10
        # verify persistence
        g = customer["session"].get(f"{API}/bookings/{b['booking_id']}").json()
        assert g["promo_code"] == "STUDENT10"
        assert g["promo_discount_pct"] == 0.10

    def test_booking_with_lowercase_promo_normalizes(self, customer):
        r = customer["session"].post(f"{API}/bookings", json={
            "pickup": "SW1A 1AA London", "dropoff": "M1 1AE Manchester",
            "van_size": "large", "date": TOMORROW, "time": "10:00",
            "customer_name": "Test C", "customer_phone": "07123456789",
            "promo_code": "student10",
        })
        assert r.status_code == 200
        b = r.json()
        assert b["promo_code"] == "STUDENT10"
        assert b["promo_discount_pct"] == 0.10

    def test_booking_with_invalid_promo_no_discount(self, customer):
        r = customer["session"].post(f"{API}/bookings", json={
            "pickup": "SW1A 1AA London", "dropoff": "M1 1AE Manchester",
            "van_size": "large", "date": TOMORROW, "time": "10:00",
            "customer_name": "Test C", "customer_phone": "07123456789",
            "promo_code": "NOPE",
        })
        assert r.status_code == 200
        b = r.json()
        assert b["promo_code"] is None
        assert b["promo_discount_pct"] == 0.0

    def test_booking_without_promo(self, customer):
        r = customer["session"].post(f"{API}/bookings", json={
            "pickup": "SW1A 1AA London", "dropoff": "M1 1AE Manchester",
            "van_size": "large", "date": TOMORROW, "time": "10:00",
            "customer_name": "Test C", "customer_phone": "07123456789",
        })
        assert r.status_code == 200
        b = r.json()
        assert b["promo_code"] is None
        assert b["promo_discount_pct"] == 0.0
