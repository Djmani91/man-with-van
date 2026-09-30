import asyncio, os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client["test_database"]

async def main():
    now = datetime.now(timezone.utc)
    past = (now - timedelta(minutes=5)).isoformat()
    bid = "MWVRELTEST1"
    await db.bookings.delete_many({"booking_id": bid})
    await db.bookings.insert_one({
        "booking_id": bid, "user_id": "cust-rel-test", "driver_id": "drv-rel-test",
        "driver": {"name": "Rel Driver", "phone": "0700", "vehicle": "Van", "rating": 5.0},
        "mode": "instant", "status": "assigned",
        "awaiting_driver_accept": True, "accept_deadline": past,
        "price": 80.0, "van_name": "Medium van", "van_size": "medium",
        "pickup": "1 A St, London E1 1AA", "dropoff": "2 B St, London E2 2BB",
        "pickup_coords": {"lat": 51.5, "lng": -0.1}, "dropoff_coords": {"lat": 51.51, "lng": -0.12},
        "distance_miles": 4, "date": now.strftime("%Y-%m-%d"), "time": "10:00",
        "payment": {"status": "paid", "type": "deposit", "amount": 12.0, "balance_due": 68.0},
        "timeline": [], "created_at": now.isoformat(),
    })
    print("Seeded assigned instant booking with expired deadline.")

    # call cron
    import httpx
    secret = "c8f3a91d7e2b4f6a0c5d8e1b9a3f7c2d6e4b8a1f0c9d3e7b5a2f6c4d8e0b1a9f"
    async with httpx.AsyncClient() as c:
        r = await c.post("http://localhost:8001/api/cron/release-unaccepted",
                         headers={"Authorization": f"Bearer {secret}"})
        print("cron status:", r.status_code, r.json())
    await asyncio.sleep(1.5)  # let background task run

    b = await db.bookings.find_one({"booking_id": bid}, {"_id": 0})
    print("AFTER:", {"mode": b["mode"], "status": b["status"], "driver_id": b["driver_id"],
                     "awaiting": b.get("awaiting_driver_accept"), "fixed_price": b.get("fixed_price")})
    ok = b["mode"] == "fixed" and b["status"] == "quoting" and b["driver_id"] is None and b.get("awaiting_driver_accept") is False
    print("RELEASE TEST:", "PASS" if ok else "FAIL")
    await db.bookings.delete_many({"booking_id": bid})
    print("cleaned up")

asyncio.run(main())
