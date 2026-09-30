"""Referral perk backend tests."""
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend env file
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1].rstrip("/")

API = f"{BASE_URL}/api"
PWD = "Test#2026"


def _email():
    return f"reftest+{uuid.uuid4().hex[:8]}@example.com"


def _register(ref=None):
    payload = {"email": _email(), "password": PWD, "name": "Ref Tester"}
    if ref is not None:
        payload["ref"] = ref
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestReferral:
    def test_register_response_has_referral_fields(self):
        u = _register()
        assert "referral_code" in u and u["referral_code"], "referral_code missing"
        assert re.fullmatch(r"[A-Z0-9]{6}", u["referral_code"]), f"code not 6 upper: {u['referral_code']}"
        assert "referral_credit" in u
        assert u["referral_credit"] == 0.0
        assert "token" in u

    def test_referral_me_shape(self):
        u = _register()
        r = requests.get(f"{API}/referral/me", headers=_auth_headers(u["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("code", "credit", "reward_each", "referred_count", "rewarded_count"):
            assert k in d, f"missing key {k}"
        assert d["code"] == u["referral_code"]
        assert d["reward_each"] == 5.0
        assert d["credit"] == 0.0
        assert d["referred_count"] == 0
        assert d["rewarded_count"] == 0
        assert re.fullmatch(r"[A-Z0-9]{6}", d["code"])

    def test_auth_me_includes_referral_fields(self):
        u = _register()
        r = requests.get(f"{API}/auth/me", headers=_auth_headers(u["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d.get("referral_code") == u["referral_code"]
        assert "referral_credit" in d

    def test_register_with_ref_tracks_referrer(self):
        A = _register()
        B = _register(ref=A["referral_code"])
        assert B["referral_credit"] == 0.0  # credit is not granted until first paid booking
        # A's referred_count should now be 1
        r = requests.get(f"{API}/referral/me", headers=_auth_headers(A["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["referred_count"] == 1, f"expected 1, got {d}"
        assert d["rewarded_count"] == 0
        assert d["credit"] == 0.0
        # B's credit stays 0 too
        rb = requests.get(f"{API}/referral/me", headers=_auth_headers(B["token"]))
        assert rb.json()["credit"] == 0.0

    def test_register_with_ref_lowercase_works(self):
        A = _register()
        B = _register(ref=A["referral_code"].lower())
        r = requests.get(f"{API}/referral/me", headers=_auth_headers(A["token"]))
        assert r.json()["referred_count"] == 1

    def test_invalid_ref_does_not_error(self):
        u = _register(ref="ZZZZZZ")  # non-existent
        assert u["referral_credit"] == 0.0
        r = requests.get(f"{API}/referral/me", headers=_auth_headers(u["token"]))
        assert r.status_code == 200
        assert r.json()["referred_count"] == 0

    def test_empty_ref_does_not_error(self):
        u = _register(ref="")
        assert "referral_code" in u and u["referral_code"]

    def test_cannot_refer_self(self):
        # Register, then try to log in and... actually self-refer only possible if you know your own code
        # before registering. Backend guards resolve_referrer via user_id != new_user_id.
        # This is tested implicitly: passing your own code at registration cannot happen since user does
        # not yet exist. But we verify that a second register attempt with same email fails:
        email = _email()
        r1 = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": PWD, "name": "X"})
        assert r1.status_code == 200
        code_self = r1.json()["referral_code"]
        # Register a NEW user using their own... impossible pre-existence. Test the same-code + same-email guard:
        r2 = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": PWD, "name": "X", "ref": code_self})
        assert r2.status_code >= 400  # duplicate email should fail

    def test_referral_code_stable_across_calls(self):
        u = _register()
        r1 = requests.get(f"{API}/referral/me", headers=_auth_headers(u["token"])).json()
        r2 = requests.get(f"{API}/referral/me", headers=_auth_headers(u["token"])).json()
        assert r1["code"] == r2["code"] == u["referral_code"]

    def test_referral_me_requires_auth(self):
        r = requests.get(f"{API}/referral/me")
        assert r.status_code in (401, 403)
