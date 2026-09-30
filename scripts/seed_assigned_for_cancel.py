import asyncio, os, uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    drv = await db.users.find_one({"email": "drv1@example.com"})
    prof = await db.driver_profiles.find_one({"user_id": drv["user_id"]})
    base = prof.get("base_coords") or {"lat": 51.54, "lng": -0.14}
    cust = await db.users.find_one({"email": "customer@example.com"})
    now = datetime.now(timezone.utc).isoformat()
    bid = "MWVCANCEL01"
    doc = {
        "booking_id": bid, "user_id": cust["user_id"], "customer_name": "Test Customer",
        "customer_phone": "07000000000", "pickup": "Camden, London NW1 8NH",
        "dropoff": "Islington, London N1 9AL", "pickup_coords": base, "dropoff_coords": base,
        "date": "2026-10-05", "time": "10:00", "van_size": "medium", "van_name": "Medium Van (SWB)",
        "price": 80.0, "distance_miles": 2.0, "estimated_hours": 2, "mode": "instant",
        "status": "assigned", "driver_id": drv["user_id"],
        "driver": {"name": prof["name"], "phone": prof["phone"], "vehicle": prof["vehicle"], "rating": 5.0},
        "payment": {"status": "paid", "type": "deposit", "amount": 12.0, "deposit": 12.0,
                    "balance_due": 68.0, "paid_at": now, "transaction_id": "TEST_CANCEL",
                    "original_price": 80.0, "discount": 0.0, "credit_applied": 0.0, "card_charged": 12.0},
        "created_at": now,
    }
    await db.bookings.update_one({"booking_id": bid}, {"$set": doc}, upsert=True)
    print("seeded assigned+paid booking", bid, "to", prof["name"], "base", base)

asyncio.run(main())
