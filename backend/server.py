from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import secrets
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from emails import send_booking_confirmation, send_status_update

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

SESSION_DAYS = 7
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ---------------------------------------------------------------------------
# Van pricing + quote engine
# ---------------------------------------------------------------------------
VAN_SIZES = [
    {"id": "small", "name": "Small Van", "desc": "Studio flat, a few boxes & small items", "capacity": "Up to ~20 boxes", "base": 45.0, "per_mile": 1.6, "crew": 1},
    {"id": "medium", "name": "Medium Van (SWB Luton)", "desc": "1-bed flat, furniture & appliances", "capacity": "1-bed flat", "base": 65.0, "per_mile": 2.1, "crew": 1},
    {"id": "large", "name": "Large Luton Van", "desc": "2-3 bed house move", "capacity": "2-3 bed house", "base": 95.0, "per_mile": 2.9, "crew": 2},
    {"id": "xl", "name": "XL / Multiple Trips", "desc": "4+ bed house or office relocation", "capacity": "4+ bed / office", "base": 140.0, "per_mile": 3.6, "crew": 2},
]
VAN_BY_ID = {v["id"]: v for v in VAN_SIZES}

STATUS_FLOW = ["confirmed", "assigned", "en_route_pickup", "loading", "in_transit", "completed"]
STATUS_LABELS = {
    "pending": "Awaiting confirmation",
    "confirmed": "Booking confirmed",
    "assigned": "Driver assigned",
    "en_route_pickup": "Driver en route to pickup",
    "loading": "Loading at pickup",
    "in_transit": "In transit to destination",
    "completed": "Move completed",
    "cancelled": "Cancelled",
}
STATUS_PROGRESS = {
    "pending": 0.0, "confirmed": 0.0, "assigned": 0.05, "en_route_pickup": 0.15,
    "loading": 0.25, "in_transit": 0.65, "completed": 1.0, "cancelled": 0.0,
}


def _hash_float(*parts: str) -> float:
    h = hashlib.sha256("|".join(parts).encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def pseudo_coords(postcode: str):
    """Deterministic fake UK coordinates from a postcode string."""
    lat = 50.9 + _hash_float("lat", postcode) * 4.0   # 50.9 - 54.9
    lng = -3.1 + _hash_float("lng", postcode) * 3.0   # -3.1 - 0.0
    return {"lat": round(lat, 5), "lng": round(lng, 5)}


def pseudo_distance(pickup: str, dropoff: str) -> float:
    if pickup.strip().lower() == dropoff.strip().lower():
        return 3.0
    miles = 3.0 + _hash_float(pickup, dropoff) * 55.0
    return round(miles, 1)


def compute_quote(pickup: str, dropoff: str, van_size: str, date: str, time: str):
    van = VAN_BY_ID.get(van_size)
    if not van:
        raise HTTPException(status_code=400, detail="Invalid van size")
    distance = pseudo_distance(pickup, dropoff)
    base = van["base"]
    mileage = round(distance * van["per_mile"], 2)
    subtotal = base + mileage

    surcharges = []
    weekend = False
    try:
        d = datetime.fromisoformat(date)
        if d.weekday() >= 5:
            weekend = True
    except Exception:
        pass
    if weekend:
        wk = round(subtotal * 0.10, 2)
        surcharges.append({"label": "Weekend surcharge (10%)", "amount": wk})
    peak = False
    try:
        hour = int(time.split(":")[0])
        if 7 <= hour <= 9 or 16 <= hour <= 18:
            peak = True
    except Exception:
        pass
    if peak:
        pk = round(subtotal * 0.08, 2)
        surcharges.append({"label": "Peak-time surcharge (8%)", "amount": pk})

    total = round(subtotal + sum(s["amount"] for s in surcharges), 2)
    return {
        "van_size": van_size,
        "van_name": van["name"],
        "distance_miles": distance,
        "base_price": base,
        "mileage_price": mileage,
        "surcharges": surcharges,
        "subtotal": round(subtotal, 2),
        "total": total,
        "currency": "GBP",
    }


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=SESSION_DAYS * 86400, path="/",
    )


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(48)
    await db.sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"], "email": u["email"], "name": u.get("name", ""),
        "role": u.get("role", "customer"), "picture": u.get("picture"),
        "phone": u.get("phone"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class QuoteInput(BaseModel):
    pickup: str
    dropoff: str
    van_size: str
    date: str
    time: str


class BookingInput(BaseModel):
    pickup: str
    dropoff: str
    van_size: str
    date: str
    time: str
    customer_name: str
    customer_phone: str
    notes: Optional[str] = None


class DriverInput(BaseModel):
    name: str
    phone: str
    vehicle: str


class AssignInput(BaseModel):
    driver_id: str


class StatusInput(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": data.name.strip(),
        "phone": data.phone,
        "role": "customer",
        "password_hash": hash_password(data.password),
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return public_user(user)


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return public_user(user)


@api_router.post("/auth/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json()
    email = data["email"].lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": data.get("name", ""),
            "phone": None,
            "role": "customer",
            "password_hash": None,
            "picture": data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"email": email}, {"$set": {"picture": data.get("picture"), "name": user.get("name") or data.get("name", "")}})
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"status": "ok"}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------------------------------------------------------------------
# Quote routes
# ---------------------------------------------------------------------------
@api_router.get("/vansizes")
async def van_sizes():
    return VAN_SIZES


@api_router.post("/quote")
async def quote(data: QuoteInput):
    return compute_quote(data.pickup, data.dropoff, data.van_size, data.date, data.time)


# ---------------------------------------------------------------------------
# Booking routes
# ---------------------------------------------------------------------------
def booking_public(b: dict) -> dict:
    b = dict(b)
    b.pop("_id", None)
    return b


@api_router.post("/bookings")
async def create_booking(data: BookingInput, user: dict = Depends(get_current_user)):
    q = compute_quote(data.pickup, data.dropoff, data.van_size, data.date, data.time)
    now = datetime.now(timezone.utc).isoformat()
    booking = {
        "booking_id": f"MWV{uuid.uuid4().hex[:8].upper()}",
        "user_id": user["user_id"],
        "customer_name": data.customer_name.strip(),
        "customer_email": user["email"],
        "customer_phone": data.customer_phone.strip(),
        "pickup": data.pickup.strip(),
        "dropoff": data.dropoff.strip(),
        "pickup_coords": pseudo_coords(data.pickup),
        "dropoff_coords": pseudo_coords(data.dropoff),
        "van_size": data.van_size,
        "van_name": q["van_name"],
        "distance_miles": q["distance_miles"],
        "date": data.date,
        "time": data.time,
        "notes": data.notes,
        "quote": q,
        "price": q["total"],
        "currency": "GBP",
        "status": "confirmed",
        "driver_id": None,
        "driver": None,
        "timeline": [{"status": "confirmed", "label": STATUS_LABELS["confirmed"], "at": now}],
        "created_at": now,
    }
    await db.bookings.insert_one(booking)
    try:
        await send_booking_confirmation(booking)
    except Exception as e:
        logger.error(f"Confirmation email failed: {e}")
    return booking_public(booking)


@api_router.get("/bookings")
async def my_bookings(user: dict = Depends(get_current_user)):
    docs = await db.bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    return b


def driver_position(b: dict):
    """Simulated live driver coordinate along the route based on status."""
    p = STATUS_PROGRESS.get(b["status"], 0.0)
    pc, dc = b["pickup_coords"], b["dropoff_coords"]
    if b["status"] in ("assigned",):
        return {"lat": pc["lat"] + 0.02, "lng": pc["lng"] - 0.02}
    lat = pc["lat"] + (dc["lat"] - pc["lat"]) * p
    lng = pc["lng"] + (dc["lng"] - pc["lng"]) * p
    return {"lat": round(lat, 5), "lng": round(lng, 5)}


@api_router.get("/bookings/{booking_id}/track")
async def track_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    return {
        "booking_id": b["booking_id"],
        "status": b["status"],
        "status_label": STATUS_LABELS.get(b["status"], b["status"]),
        "progress": STATUS_PROGRESS.get(b["status"], 0.0),
        "pickup": b["pickup"],
        "dropoff": b["dropoff"],
        "pickup_coords": b["pickup_coords"],
        "dropoff_coords": b["dropoff_coords"],
        "driver_position": driver_position(b),
        "driver": b.get("driver"),
        "timeline": b.get("timeline", []),
        "eta_minutes": max(0, int((1 - STATUS_PROGRESS.get(b["status"], 0.0)) * (b["distance_miles"] * 2.2 + 15))),
    }


# ---------------------------------------------------------------------------
# Admin / dispatch routes
# ---------------------------------------------------------------------------
@api_router.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    all_b = await db.bookings.find({}, {"_id": 0, "price": 1, "status": 1}).to_list(2000)
    active = [b for b in all_b if b["status"] not in ("completed", "cancelled")]
    revenue = round(sum(b.get("price", 0) for b in all_b if b["status"] != "cancelled"), 2)
    drivers = await db.drivers.count_documents({})
    return {
        "total_bookings": len(all_b),
        "active_jobs": len(active),
        "completed": len([b for b in all_b if b["status"] == "completed"]),
        "revenue": revenue,
        "drivers": drivers,
    }


@api_router.get("/admin/bookings")
async def admin_bookings(user: dict = Depends(require_admin)):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/drivers")
async def admin_drivers(user: dict = Depends(require_admin)):
    return await db.drivers.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.post("/admin/drivers")
async def create_driver(data: DriverInput, user: dict = Depends(require_admin)):
    driver = {
        "driver_id": f"drv_{uuid.uuid4().hex[:8]}",
        "name": data.name.strip(),
        "phone": data.phone.strip(),
        "vehicle": data.vehicle.strip(),
        "status": "available",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.drivers.insert_one(driver)
    driver.pop("_id", None)
    return driver


@api_router.post("/admin/bookings/{booking_id}/assign")
async def assign_driver(booking_id: str, data: AssignInput, user: dict = Depends(require_admin)):
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    driver = await db.drivers.find_one({"driver_id": data.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    now = datetime.now(timezone.utc).isoformat()
    timeline = b.get("timeline", [])
    timeline.append({"status": "assigned", "label": f"{driver['name']} assigned", "at": now})
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {
        "driver_id": driver["driver_id"],
        "driver": {"name": driver["name"], "phone": driver["phone"], "vehicle": driver["vehicle"]},
        "status": "assigned",
        "timeline": timeline,
    }})
    await db.drivers.update_one({"driver_id": driver["driver_id"]}, {"$set": {"status": "on_job"}})
    updated = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    return updated


@api_router.post("/admin/bookings/{booking_id}/status")
async def update_status(booking_id: str, data: StatusInput, user: dict = Depends(require_admin)):
    if data.status not in STATUS_LABELS:
        raise HTTPException(status_code=400, detail="Invalid status")
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    now = datetime.now(timezone.utc).isoformat()
    timeline = b.get("timeline", [])
    timeline.append({"status": data.status, "label": STATUS_LABELS[data.status], "at": now})
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": data.status, "timeline": timeline}})
    if data.status == "completed" and b.get("driver_id"):
        await db.drivers.update_one({"driver_id": b["driver_id"]}, {"$set": {"status": "available"}})
    updated = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    try:
        await send_status_update(updated)
    except Exception as e:
        logger.error(f"Status email failed: {e}")
    return updated


@api_router.get("/")
async def root():
    return {"message": "Man With Van API"}


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"].lower().strip()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "name": "Dispatch Admin",
            "phone": None,
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user")
    else:
        updates = {}
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if not existing.get("password_hash") or not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.sessions.create_index("session_token", unique=True)
    await db.bookings.create_index("booking_id", unique=True)
    await db.drivers.create_index("driver_id", unique=True)
    await seed_admin()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
