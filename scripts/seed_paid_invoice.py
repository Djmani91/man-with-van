import asyncio, os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    user = await db.users.find_one({"email": "customer@example.com"})
    b = await db.bookings.find_one({"user_id": user["user_id"]}, sort=[("created_at", -1)])
    if not b:
        print("no booking"); return
    price = b.get("price") or 70.0
    deposit = round(price * 0.15, 2)
    now = datetime.now(timezone.utc).isoformat()
    payment = {"status": "paid", "type": "deposit", "amount": deposit, "deposit": deposit,
               "balance_due": round(price - deposit, 2), "paid_at": now,
               "transaction_id": "TEST_TXN_INV001", "provider": "square",
               "original_price": price, "promo_code": None, "discount": 0.0,
               "credit_applied": 0.0, "card_charged": deposit}
    await db.bookings.update_one({"booking_id": b["booking_id"]}, {"$set": {
        "payment": payment, "status": "assigned", "price": price,
        "driver": {"name": "Sam Driver", "phone": "07000000000", "vehicle": "Medium Van (SWB)", "rating": 5.0},
        "driver_id": b.get("driver_id") or "test_driver_inv",
    }})
    print("seeded paid deposit on", b["booking_id"], "price", price, "deposit", deposit)

asyncio.run(main())
