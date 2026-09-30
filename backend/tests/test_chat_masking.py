"""Chat masking + pre-acceptance chat + per-driver threads + driver conversations tests."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"

CUSTOMER = {"email": "customer@example.com", "password": "Customer#2026"}
DRIVER1 = {"email": "drv1@example.com", "password": "Drive#2026"}


def _login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def cust_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def drv_token():
    return _login(DRIVER1)


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def quoting_booking(cust_token):
    # find an active quoting booking with offers
    r = requests.get(f"{BASE}/bookings", headers=_h(cust_token), timeout=20)
    assert r.status_code == 200, r.text
    bookings = r.json()
    quoting = [b for b in bookings if b.get("status") == "quoting"]
    assert quoting, "No quoting booking available for customer"
    # look for one with >=2 offers
    for b in quoting:
        off = requests.get(f"{BASE}/bookings/{b['booking_id']}/instant-offers",
                           headers=_h(cust_token), timeout=20)
        if off.status_code == 200 and len(off.json().get("offers", [])) >= 2:
            return b, off.json()["offers"]
    # fallback: any with >=1
    for b in quoting:
        off = requests.get(f"{BASE}/bookings/{b['booking_id']}/instant-offers",
                           headers=_h(cust_token), timeout=20)
        if off.status_code == 200 and off.json().get("offers"):
            return b, off.json()["offers"]
    pytest.skip("No quoting booking with offers")


class TestMasking:
    def test_phone_email_postcode_masked(self, cust_token, quoting_booking):
        b, offers = quoting_booking
        drv_id = offers[0]["driver_id"]
        text = "call me on 07123 456789 or me@example.com I'm at SW1A 1AA"
        r = requests.post(f"{BASE}/bookings/{b['booking_id']}/messages",
                          params={"driver_id": drv_id},
                          json={"text": text}, headers=_h(cust_token), timeout=20)
        assert r.status_code == 200, r.text
        stored = r.json()["text"]
        assert "07123" not in stored
        assert "example.com" not in stored
        assert "SW1A" not in stored
        assert "[contact hidden]" in stored
        assert "[address hidden]" in stored

        # GET back
        g = requests.get(f"{BASE}/bookings/{b['booking_id']}/messages",
                        params={"driver_id": drv_id}, headers=_h(cust_token), timeout=20)
        assert g.status_code == 200
        texts = [m["text"] for m in g.json()]
        assert any("[contact hidden]" in t and "[address hidden]" in t for t in texts)

    def test_plain_text_unchanged(self, cust_token, quoting_booking):
        b, offers = quoting_booking
        drv_id = offers[0]["driver_id"]
        plain = "Hello, is my sofa able to fit in your van?"
        r = requests.post(f"{BASE}/bookings/{b['booking_id']}/messages",
                          params={"driver_id": drv_id},
                          json={"text": plain}, headers=_h(cust_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["text"] == plain


class TestPerDriverThreads:
    def test_threads_separated_per_driver(self, cust_token, quoting_booking):
        b, offers = quoting_booking
        if len(offers) < 2:
            pytest.skip("need 2+ offers")
        a, c = offers[0]["driver_id"], offers[1]["driver_id"]
        assert a != c
        ra = requests.post(f"{BASE}/bookings/{b['booking_id']}/messages",
                           params={"driver_id": a}, json={"text": "PDT-A hello driver A"},
                           headers=_h(cust_token), timeout=20)
        rc = requests.post(f"{BASE}/bookings/{b['booking_id']}/messages",
                           params={"driver_id": c}, json={"text": "PDT-C hello driver C"},
                           headers=_h(cust_token), timeout=20)
        assert ra.status_code == 200 and rc.status_code == 200
        ga = requests.get(f"{BASE}/bookings/{b['booking_id']}/messages",
                          params={"driver_id": a}, headers=_h(cust_token), timeout=20).json()
        gc = requests.get(f"{BASE}/bookings/{b['booking_id']}/messages",
                          params={"driver_id": c}, headers=_h(cust_token), timeout=20).json()
        ta = " ".join(m["text"] for m in ga)
        tc = " ".join(m["text"] for m in gc)
        assert "PDT-A" in ta and "PDT-C" not in ta
        assert "PDT-C" in tc and "PDT-A" not in tc


class TestDriverConversations:
    def test_customer_missing_driver_id_400(self, cust_token, quoting_booking):
        b, _ = quoting_booking
        r = requests.get(f"{BASE}/bookings/{b['booking_id']}/messages",
                        headers=_h(cust_token), timeout=20)
        assert r.status_code == 400

    def test_driver_sees_conversation_pre_acceptance(self, cust_token, drv_token, quoting_booking):
        b, offers = quoting_booking
        # figure out drv1's driver_id from offers list
        # Fetch driver profile via /auth/me or by matching email in offers
        me = requests.get(f"{BASE}/auth/me", headers=_h(drv_token), timeout=20)
        assert me.status_code == 200, me.text
        drv1_id = me.json()["user_id"]

        # drv1 may not be among offer drivers in this env; the endpoint accepts any driver_id
        # for the customer chat thread, so we message drv1 directly.

        # customer messages drv1
        rc = requests.post(f"{BASE}/bookings/{b['booking_id']}/messages",
                           params={"driver_id": drv1_id},
                           json={"text": "PRE-ACCEPT hi drv1"},
                           headers=_h(cust_token), timeout=20)
        assert rc.status_code == 200

        # driver's /driver/conversations should list this booking
        conv = requests.get(f"{BASE}/driver/conversations", headers=_h(drv_token), timeout=20)
        assert conv.status_code == 200, conv.text
        bids = [c["booking_id"] for c in conv.json()]
        assert b["booking_id"] in bids, f"Expected booking in driver conversations, got: {bids}"

        # driver can GET the messages without driver_id
        g = requests.get(f"{BASE}/bookings/{b['booking_id']}/messages",
                        headers=_h(drv_token), timeout=20)
        assert g.status_code == 200
        assert any("PRE-ACCEPT" in m["text"] for m in g.json())

        # driver replies
        rp = requests.post(f"{BASE}/bookings/{b['booking_id']}/messages",
                          json={"text": "PRE-REPLY from drv1"},
                          headers=_h(drv_token), timeout=20)
        assert rp.status_code == 200, rp.text

        # customer sees the reply via same driver thread
        gcust = requests.get(f"{BASE}/bookings/{b['booking_id']}/messages",
                            params={"driver_id": drv1_id},
                            headers=_h(cust_token), timeout=20).json()
        assert any("PRE-REPLY" in m["text"] for m in gcust)
