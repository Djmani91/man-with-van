"""Seed a bidding job and a fixed-price job for a fresh test driver, then print
JSON with credentials + booking ids to stdout. Used by the Playwright UI test.
"""
import json, os, sys, uuid, requests
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
MONGO = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DBN = os.environ.get("DB_NAME", "test_database")
ADMIN = ("anisha91ahmed@gmail.com", "MoveAdmin#2026")

def s():
    x = requests.Session(); x.headers.update({"Content-Type": "application/json"}); return x

# admin
admin = s()
r = admin.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]})
assert r.status_code == 200, r.text

# customer
cust = s()
tag = uuid.uuid4().hex[:8]
r = cust.post(f"{API}/auth/register", json={
    "name": f"TEST C {tag}", "email": f"TEST_c_{tag}@example.com",
    "password": "Cust#2026", "phone": "+447000000020"})
assert r.status_code == 200, r.text

# driver
drv = s()
dtag = uuid.uuid4().hex[:8]
demail = f"TEST_drv_{dtag}@example.com"
r = drv.post(f"{API}/auth/driver-register", json={
    "name": f"TEST Drv {dtag}", "email": demail, "password": "Drive#2026",
    "phone": "+447000000010", "vehicle": "Ford Transit",
    "licence_no": f"L{dtag}", "insurance_no": f"I{dtag}",
    "home_postcode": "SW1A 2DD", "van_size": "medium",
})
assert r.status_code == 200, r.text
duid = r.json()["user_id"]
r = admin.post(f"{API}/admin/drivers/{duid}/approve"); assert r.status_code == 200, r.text

def mkb():
    r = cust.post(f"{API}/bookings", json={
        "pickup": "Trafalgar Square, London SW1A 2DD",
        "dropoff": "Camden Town, London NW1 8NH",
        "van_size": "medium", "date": "2026-07-05", "time": "10:00",
        "pickup_floor": 0, "dropoff_floor": 0,
        "pickup_lift": False, "dropoff_lift": False, "needs_helper": False,
        "customer_name": "Test C", "customer_phone": "+447000000099",
        "items": "a couple boxes", "photos": [],
    })
    assert r.status_code == 200, r.text
    bid = r.json()["booking_id"]
    br = cust.post(f"{API}/bookings/{bid}/broadcast"); assert br.status_code == 200, br.text
    return bid

bidding_id = mkb()
fixed_id = mkb()

client = MongoClient(MONGO); db = client[DBN]
db.bookings.update_one({"booking_id": fixed_id},
    {"$set": {"mode": "fixed", "fixed_price": 120.0, "price": 120.0,
              "driver_id": None, "status": "quoting", "declined_by": []}})

print(json.dumps({
    "driver_email": demail, "driver_password": "Drive#2026",
    "bidding_id": bidding_id, "fixed_id": fixed_id,
}))
