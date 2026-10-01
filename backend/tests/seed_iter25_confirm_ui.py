"""Seed data for iter-25 UI test: create a fresh approved driver + a customer,
then seed:
 - one assigned instant booking with awaiting_driver_accept=True (future deadline) -> Accepted tab prompt
 - one assigned instant booking with awaiting_driver_accept=False (already confirmed) -> Accepted tab status dropdown
 - one fixed_price quoting booking (Trafalgar Sq area) so driver sees it in Quotation tab

Prints JSON with credentials + booking ids to stdout.
"""
import json, os, sys, uuid, requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
MONGO = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DBN = os.environ.get("DB_NAME", "test_database")
ADMIN = ("anisha91ahmed@gmail.com", "MoveAdmin#2026")

def s():
    x = requests.Session(); x.headers.update({"Content-Type": "application/json"}); return x

admin = s()
r = admin.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]})
assert r.status_code == 200, r.text

cust = s()
tag = uuid.uuid4().hex[:8]
r = cust.post(f"{API}/auth/register", json={
    "name": f"TEST C {tag}", "email": f"TEST_c_{tag}@example.com",
    "password": "Cust#2026", "phone": "+447000000020"})
assert r.status_code == 200, r.text

dtag = uuid.uuid4().hex[:8]
demail = f"TEST_drv_{dtag}@example.com"
dpw = "Drive#2026"
drv = s()
r = drv.post(f"{API}/auth/driver-register", json={
    "name": f"TEST Drv {dtag}", "email": demail, "password": dpw,
    "phone": "+447000000010", "vehicle": "Ford Transit",
    "licence_no": f"L{dtag}", "insurance_no": f"I{dtag}",
    "home_postcode": "SW1A 2DD", "van_size": "medium",
})
assert r.status_code == 200, r.text
duid = r.json()["user_id"]
r = admin.post(f"{API}/admin/drivers/{duid}/approve"); assert r.status_code == 200, r.text

# Customer creates a fixed-price quoting booking (broadcast to market)
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
fixed_id = r.json()["booking_id"]
br = cust.post(f"{API}/bookings/{fixed_id}/broadcast"); assert br.status_code == 200, br.text

client = MongoClient(MONGO); db = client[DBN]
# Make it fixed-price at £80 -> your_earnings should be £68
db.bookings.update_one({"booking_id": fixed_id},
    {"$set": {"mode": "fixed", "fixed_price": 80.0, "price": 80.0,
              "driver_id": None, "status": "quoting", "declined_by": []}})

now = datetime.now(timezone.utc)
future = (now + timedelta(minutes=25)).isoformat()

# Awaiting-confirm instant booking assigned to our driver
awaiting_id = f"MWVAWAIT{uuid.uuid4().hex[:6].upper()}"
db.bookings.insert_one({
    "booking_id": awaiting_id, "user_id": "cust-ui-test", "driver_id": duid,
    "driver": {"name": "Confirm Driver", "phone": "0700", "vehicle": "Van", "rating": 5.0},
    "mode": "instant", "status": "assigned",
    "awaiting_driver_accept": True, "accept_deadline": future,
    "price": 80.0, "van_name": "Medium van", "van_size": "medium",
    "pickup": "1 A St, London E1 1AA", "dropoff": "2 B St, London E2 2BB",
    "pickup_coords": {"lat": 51.5, "lng": -0.1},
    "dropoff_coords": {"lat": 51.51, "lng": -0.12},
    "distance_miles": 4, "date": now.strftime("%Y-%m-%d"), "time": "10:00",
    "payment": {"status": "paid", "type": "deposit", "amount": 12.0, "balance_due": 68.0},
    "timeline": [], "created_at": now.isoformat(),
})

# Already-confirmed instant booking assigned to our driver (no confirm prompt)
confirmed_id = f"MWVDONE{uuid.uuid4().hex[:6].upper()}"
db.bookings.insert_one({
    "booking_id": confirmed_id, "user_id": "cust-ui-test-2", "driver_id": duid,
    "driver": {"name": "Confirm Driver", "phone": "0700", "vehicle": "Van", "rating": 5.0},
    "mode": "instant", "status": "assigned",
    "awaiting_driver_accept": False,
    "price": 90.0, "van_name": "Medium van", "van_size": "medium",
    "pickup": "3 C St, London E3 3CC", "dropoff": "4 D St, London E4 4DD",
    "pickup_coords": {"lat": 51.52, "lng": -0.11},
    "dropoff_coords": {"lat": 51.53, "lng": -0.13},
    "distance_miles": 5, "date": now.strftime("%Y-%m-%d"), "time": "11:00",
    "payment": {"status": "paid", "type": "deposit", "amount": 13.5, "balance_due": 76.5},
    "timeline": [], "created_at": now.isoformat(),
})

print(json.dumps({
    "driver_email": demail, "driver_password": dpw, "driver_id": duid,
    "fixed_id": fixed_id, "awaiting_id": awaiting_id, "confirmed_id": confirmed_id,
}))
