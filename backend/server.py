from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import secrets
import hashlib
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import httpx
from fastapi import (
    FastAPI, APIRouter, Request, Response, HTTPException, Depends,
    UploadFile, File, Header, Query,
)
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from emails import send_booking_confirmation, send_status_update
import storage

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
    {"id": "small", "name": "Small Van", "desc": "Perfect for a few boxes, a single item or a studio flat. One driver helps you load.", "capacity": "Up to ~15 boxes", "dimensions": "1.2m³ load space", "crew": 1, "hourly": 15, "base": 45.0, "per_mile": 1.6},
    {"id": "medium", "name": "Medium Van (SWB)", "desc": "Ideal for a 1-bed flat move — sofas, a bed, appliances and boxes.", "capacity": "1-bed flat", "dimensions": "6-7m³ load space", "crew": 1, "hourly": 25, "base": 65.0, "per_mile": 2.1},
    {"id": "large", "name": "Large Luton Van", "desc": "Our most popular — a full 2-3 bed house move with a tail-lift and two people.", "capacity": "2-3 bed house", "dimensions": "18-20m³ + tail lift", "crew": 2, "hourly": 40, "base": 95.0, "per_mile": 2.9},
    {"id": "xl", "name": "XL / Multi-Trip", "desc": "For 4+ bed homes or office relocations. Multiple trips or extra crew available.", "capacity": "4+ bed / office", "dimensions": "20m³+ / multiple", "crew": 2, "hourly": 55, "base": 140.0, "per_mile": 3.6},
]
VAN_BY_ID = {v["id"]: v for v in VAN_SIZES}

STATUS_LABELS = {
    "pending": "Awaiting confirmation", "confirmed": "Booking confirmed",
    "assigned": "Driver assigned", "en_route_pickup": "Driver en route to pickup",
    "loading": "Loading at pickup", "in_transit": "In transit to destination",
    "completed": "Move completed", "cancelled": "Cancelled",
}
STATUS_PROGRESS = {
    "pending": 0.0, "confirmed": 0.0, "assigned": 0.05, "en_route_pickup": 0.15,
    "loading": 0.25, "in_transit": 0.65, "completed": 1.0, "cancelled": 0.0,
}


def _hash_float(*parts: str) -> float:
    h = hashlib.sha256("|".join(parts).encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def pseudo_coords(postcode: str):
    lat = 50.9 + _hash_float("lat", postcode) * 4.0
    lng = -3.1 + _hash_float("lng", postcode) * 3.0
    return {"lat": round(lat, 5), "lng": round(lng, 5)}


def pseudo_distance(pickup: str, dropoff: str) -> float:
    if pickup.strip().lower() == dropoff.strip().lower():
        return 3.0
    return round(3.0 + _hash_float(pickup, dropoff) * 55.0, 1)


def compute_quote(pickup, dropoff, van_size, date, time,
                  pickup_floor=0, dropoff_floor=0, pickup_lift=True, dropoff_lift=True):
    van = VAN_BY_ID.get(van_size)
    if not van:
        raise HTTPException(status_code=400, detail="Invalid van size")
    distance = pseudo_distance(pickup, dropoff)
    base = van["base"]
    mileage = round(distance * van["per_mile"], 2)
    subtotal = base + mileage
    surcharges = []

    floor_charge = 0
    for floor, lift in [(int(pickup_floor or 0), pickup_lift), (int(dropoff_floor or 0), dropoff_lift)]:
        if floor > 0 and not lift:
            floor_charge += 6 * floor
    if floor_charge:
        surcharges.append({"label": "Stairs / floor access", "amount": round(float(floor_charge), 2)})

    weekend = False
    try:
        if datetime.fromisoformat(date).weekday() >= 5:
            weekend = True
    except Exception:
        pass
    if weekend:
        surcharges.append({"label": "Weekend surcharge (10%)", "amount": round(subtotal * 0.10, 2)})
    try:
        hour = int(time.split(":")[0])
        if 7 <= hour <= 9 or 16 <= hour <= 18:
            surcharges.append({"label": "Peak-time surcharge (8%)", "amount": round(subtotal * 0.08, 2)})
    except Exception:
        pass

    total = round(subtotal + sum(s["amount"] for s in surcharges), 2)
    return {
        "van_size": van_size, "van_name": van["name"], "distance_miles": distance,
        "base_price": base, "mileage_price": mileage, "surcharges": surcharges,
        "subtotal": round(subtotal, 2), "total": total, "currency": "GBP",
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
    response.set_cookie(key="session_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=SESSION_DAYS * 86400, path="/")


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(48)
    await db.sessions.insert_one({
        "session_token": token, "user_id": user_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token


def public_user(u: dict) -> dict:
    return {"user_id": u["user_id"], "email": u["email"], "name": u.get("name", ""),
            "role": u.get("role", "customer"), "picture": u.get("picture"), "phone": u.get("phone")}


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


async def require_driver(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None


class DriverRegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str
    vehicle: str
    licence_no: str
    insurance_no: str
    mot_expiry: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class QuoteInput(BaseModel):
    pickup: str
    dropoff: str
    van_size: str
    date: str
    time: str
    pickup_floor: int = 0
    dropoff_floor: int = 0
    pickup_lift: bool = True
    dropoff_lift: bool = True


class BookingInput(BaseModel):
    pickup: str
    dropoff: str
    pickup_flat: Optional[str] = None
    van_size: str
    date: str
    time: str
    pickup_floor: int = 0
    dropoff_floor: int = 0
    pickup_lift: bool = True
    dropoff_lift: bool = True
    items: Optional[str] = None
    photos: List[str] = []
    customer_name: str
    customer_phone: str
    notes: Optional[str] = None


class DriverInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str
    vehicle: str


class AssignInput(BaseModel):
    driver_id: str


class StatusInput(BaseModel):
    status: str


class AvailabilityInput(BaseModel):
    available: bool


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": data.name.strip(),
            "phone": data.phone, "role": "customer", "password_hash": hash_password(data.password),
            "picture": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    set_session_cookie(response, await create_session(user["user_id"]))
    return public_user(user)


@api_router.post("/auth/driver-register")
async def driver_register(data: DriverRegisterInput, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": data.name.strip(),
            "phone": data.phone, "role": "driver", "password_hash": hash_password(data.password),
            "picture": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    await db.driver_profiles.insert_one({
        "user_id": user["user_id"], "name": data.name.strip(), "phone": data.phone,
        "vehicle": data.vehicle.strip(), "licence_no": data.licence_no.strip(),
        "insurance_no": data.insurance_no.strip(), "mot_expiry": data.mot_expiry,
        "status": "pending", "availability": "available",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    set_session_cookie(response, await create_session(user["user_id"]))
    return public_user(user)


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    set_session_cookie(response, await create_session(user["user_id"]))
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
        user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": data.get("name", ""),
                "phone": None, "role": "customer", "password_hash": None,
                "picture": data.get("picture"), "created_at": datetime.now(timezone.utc).isoformat()}
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"email": email}, {"$set": {"picture": data.get("picture"), "name": user.get("name") or data.get("name", "")}})
    set_session_cookie(response, await create_session(user["user_id"]))
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
# Quote / address routes
# ---------------------------------------------------------------------------
@api_router.get("/vansizes")
async def van_sizes():
    return VAN_SIZES


@api_router.post("/quote")
async def quote(data: QuoteInput):
    return compute_quote(data.pickup, data.dropoff, data.van_size, data.date, data.time,
                         data.pickup_floor, data.dropoff_floor, data.pickup_lift, data.dropoff_lift)


_STREETS = ["High Street", "Church Road", "Station Road", "Victoria Road", "Green Lane",
            "Park Avenue", "Queens Road", "Kings Road", "Mill Lane", "Manor Road"]
_TOWNS = ["London", "Manchester", "Birmingham", "Leeds", "Bristol", "Liverpool"]


@api_router.get("/address/suggest")
async def address_suggest(q: str = Query("", min_length=0)):
    q = q.strip()
    if len(q) < 2:
        return []
    seed = q.upper().replace(" ", "")
    out = []
    for i in range(5):
        n = int(_hash_float(seed, str(i)) * 200) + 1
        street = _STREETS[int(_hash_float(seed, "s", str(i)) * len(_STREETS))]
        town = _TOWNS[int(_hash_float(seed, "t", str(i)) * len(_TOWNS))]
        pc = f"{q.upper()[:4].strip()} {int(_hash_float(seed, 'p', str(i)) * 9)}{chr(65 + i)}{chr(65 + (i * 3) % 26)}"
        out.append({"label": f"{n} {street}, {town} {pc}".strip(), "postcode": pc.strip()})
    return out


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin")
    ct = storage.MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    path = f"{storage.APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")
    result = await asyncio.to_thread(storage.put_object, path, data, ct)
    await db.files.insert_one({
        "id": str(uuid.uuid4()), "storage_path": result["path"], "original_filename": file.filename,
        "content_type": ct, "size": result.get("size"), "owner": user["user_id"],
        "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"]}


@api_router.get("/files/{path:path}")
async def download(path: str, authorization: str = Header(None), auth: str = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = await asyncio.to_thread(storage.get_object, path)
    return Response(content=data, media_type=record.get("content_type", ct))


# ---------------------------------------------------------------------------
# Booking routes
# ---------------------------------------------------------------------------
@api_router.post("/bookings")
async def create_booking(data: BookingInput, user: dict = Depends(get_current_user)):
    q = compute_quote(data.pickup, data.dropoff, data.van_size, data.date, data.time,
                      data.pickup_floor, data.dropoff_floor, data.pickup_lift, data.dropoff_lift)
    now = datetime.now(timezone.utc).isoformat()
    booking = {
        "booking_id": f"MWV{uuid.uuid4().hex[:8].upper()}", "user_id": user["user_id"],
        "customer_name": data.customer_name.strip(), "customer_email": user["email"],
        "customer_phone": data.customer_phone.strip(),
        "pickup": data.pickup.strip(), "pickup_flat": data.pickup_flat, "dropoff": data.dropoff.strip(),
        "pickup_coords": pseudo_coords(data.pickup), "dropoff_coords": pseudo_coords(data.dropoff),
        "pickup_floor": data.pickup_floor, "dropoff_floor": data.dropoff_floor,
        "pickup_lift": data.pickup_lift, "dropoff_lift": data.dropoff_lift,
        "items": data.items, "photos": data.photos,
        "van_size": data.van_size, "van_name": q["van_name"], "distance_miles": q["distance_miles"],
        "date": data.date, "time": data.time, "notes": data.notes,
        "quote": q, "price": q["total"], "currency": "GBP", "status": "confirmed",
        "driver_id": None, "driver": None,
        "timeline": [{"status": "confirmed", "label": STATUS_LABELS["confirmed"], "at": now}],
        "created_at": now,
    }
    await db.bookings.insert_one(booking)
    try:
        await send_booking_confirmation(booking)
    except Exception as e:
        logger.error(f"Confirmation email failed: {e}")
    booking.pop("_id", None)
    return booking


@api_router.get("/bookings")
async def my_bookings(user: dict = Depends(get_current_user)):
    return await db.bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    return b


def driver_position(b: dict):
    p = STATUS_PROGRESS.get(b["status"], 0.0)
    pc, dc = b["pickup_coords"], b["dropoff_coords"]
    if b["status"] == "assigned":
        return {"lat": pc["lat"] + 0.02, "lng": pc["lng"] - 0.02}
    return {"lat": round(pc["lat"] + (dc["lat"] - pc["lat"]) * p, 5),
            "lng": round(pc["lng"] + (dc["lng"] - pc["lng"]) * p, 5)}


@api_router.get("/bookings/{booking_id}/track")
async def track_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    return {
        "booking_id": b["booking_id"], "status": b["status"],
        "status_label": STATUS_LABELS.get(b["status"], b["status"]),
        "progress": STATUS_PROGRESS.get(b["status"], 0.0),
        "pickup": b["pickup"], "dropoff": b["dropoff"],
        "pickup_coords": b["pickup_coords"], "dropoff_coords": b["dropoff_coords"],
        "driver_position": driver_position(b), "driver": b.get("driver"),
        "timeline": b.get("timeline", []),
        "eta_minutes": max(0, int((1 - STATUS_PROGRESS.get(b["status"], 0.0)) * (b["distance_miles"] * 2.2 + 15))),
    }


# ---------------------------------------------------------------------------
# Admin / dispatch
# ---------------------------------------------------------------------------
@api_router.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    all_b = await db.bookings.find({}, {"_id": 0, "price": 1, "status": 1}).to_list(2000)
    active = [b for b in all_b if b["status"] not in ("completed", "cancelled")]
    revenue = round(sum(b.get("price", 0) for b in all_b if b["status"] != "cancelled"), 2)
    return {
        "total_bookings": len(all_b), "active_jobs": len(active),
        "completed": len([b for b in all_b if b["status"] == "completed"]),
        "revenue": revenue,
        "drivers": await db.driver_profiles.count_documents({"status": "approved"}),
        "pending_drivers": await db.driver_profiles.count_documents({"status": "pending"}),
    }


@api_router.get("/admin/bookings")
async def admin_bookings(user: dict = Depends(require_admin)):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/drivers")
async def admin_drivers(user: dict = Depends(require_admin)):
    return await db.driver_profiles.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.post("/admin/drivers")
async def create_driver(data: DriverInput, user: dict = Depends(require_admin)):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already in use")
    u = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": data.name.strip(),
         "phone": data.phone, "role": "driver", "password_hash": hash_password(data.password),
         "picture": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(u)
    profile = {"user_id": u["user_id"], "name": data.name.strip(), "phone": data.phone.strip(),
               "vehicle": data.vehicle.strip(), "licence_no": "-", "insurance_no": "-", "mot_expiry": None,
               "status": "approved", "availability": "available",
               "created_at": datetime.now(timezone.utc).isoformat()}
    await db.driver_profiles.insert_one(profile)
    profile.pop("_id", None)
    return profile


@api_router.post("/admin/drivers/{driver_user_id}/approve")
async def approve_driver(driver_user_id: str, user: dict = Depends(require_admin)):
    r = await db.driver_profiles.update_one({"user_id": driver_user_id}, {"$set": {"status": "approved"}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"status": "approved"}


@api_router.post("/admin/bookings/{booking_id}/assign")
async def assign_driver(booking_id: str, data: AssignInput, user: dict = Depends(require_admin)):
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    driver = await db.driver_profiles.find_one({"user_id": data.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    now = datetime.now(timezone.utc).isoformat()
    timeline = b.get("timeline", [])
    timeline.append({"status": "assigned", "label": f"{driver['name']} assigned", "at": now})
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {
        "driver_id": driver["user_id"],
        "driver": {"name": driver["name"], "phone": driver["phone"], "vehicle": driver["vehicle"]},
        "status": "assigned", "timeline": timeline}})
    await db.driver_profiles.update_one({"user_id": driver["user_id"]}, {"$set": {"availability": "on_job"}})
    await db.job_requests.update_many({"booking_id": booking_id, "driver_id": driver["user_id"]}, {"$set": {"status": "accepted"}})
    await db.job_requests.update_many({"booking_id": booking_id, "driver_id": {"$ne": driver["user_id"]}}, {"$set": {"status": "declined"}})
    return await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})


async def _apply_status(booking_id, new_status):
    if new_status not in STATUS_LABELS:
        raise HTTPException(status_code=400, detail="Invalid status")
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    now = datetime.now(timezone.utc).isoformat()
    timeline = b.get("timeline", [])
    timeline.append({"status": new_status, "label": STATUS_LABELS[new_status], "at": now})
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": new_status, "timeline": timeline}})
    if new_status in ("completed", "cancelled") and b.get("driver_id"):
        await db.driver_profiles.update_one({"user_id": b["driver_id"]}, {"$set": {"availability": "available"}})
    updated = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    try:
        await send_status_update(updated)
    except Exception as e:
        logger.error(f"Status email failed: {e}")
    return updated


@api_router.post("/admin/bookings/{booking_id}/status")
async def update_status(booking_id: str, data: StatusInput, user: dict = Depends(require_admin)):
    return await _apply_status(booking_id, data.status)


# ---------------------------------------------------------------------------
# Driver surface
# ---------------------------------------------------------------------------
@api_router.get("/driver/profile")
async def driver_profile(user: dict = Depends(require_driver)):
    p = await db.driver_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="No driver profile")
    return p


@api_router.get("/driver/jobs")
async def driver_jobs(user: dict = Depends(require_driver)):
    return await db.bookings.find({"driver_id": user["user_id"]}, {"_id": 0}).sort("date", 1).to_list(200)


@api_router.post("/driver/jobs/{booking_id}/status")
async def driver_update_status(booking_id: str, data: StatusInput, user: dict = Depends(require_driver)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b or b.get("driver_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    if data.status not in ("en_route_pickup", "loading", "in_transit", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status for driver")
    return await _apply_status(booking_id, data.status)


@api_router.post("/driver/availability")
async def driver_availability(data: AvailabilityInput, user: dict = Depends(require_driver)):
    await db.driver_profiles.update_one({"user_id": user["user_id"]},
                                        {"$set": {"availability": "available" if data.available else "off"}})
    return {"availability": "available" if data.available else "off"}


async def _require_approved_driver(user: dict) -> dict:
    p = await db.driver_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not p or p.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Your driver account is awaiting approval")
    return p


@api_router.get("/driver/available")
async def driver_available_jobs(user: dict = Depends(require_driver)):
    await _require_approved_driver(user)
    open_jobs = await db.bookings.find(
        {"driver_id": None, "status": "confirmed"}, {"_id": 0}
    ).sort("date", 1).to_list(200)
    my_reqs = await db.job_requests.find({"driver_id": user["user_id"]}, {"_id": 0}).to_list(500)
    requested = {r["booking_id"] for r in my_reqs}
    return [j for j in open_jobs if j["booking_id"] not in requested]


@api_router.post("/driver/jobs/{booking_id}/quote")
async def driver_quote(booking_id: str, user: dict = Depends(require_driver)):
    await _require_approved_driver(user)
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b or b.get("driver_id"):
        raise HTTPException(status_code=400, detail="This job is no longer available")
    existing = await db.job_requests.find_one({"booking_id": booking_id, "driver_id": user["user_id"]})
    if existing:
        return {"status": "waiting"}
    await db.job_requests.insert_one({
        "id": str(uuid.uuid4()), "booking_id": booking_id, "driver_id": user["user_id"],
        "status": "waiting", "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "waiting"}


@api_router.get("/driver/requests")
async def driver_requests(user: dict = Depends(require_driver)):
    reqs = await db.job_requests.find({"driver_id": user["user_id"], "status": "waiting"}, {"_id": 0}).to_list(200)
    out = []
    for r in reqs:
        b = await db.bookings.find_one({"booking_id": r["booking_id"]}, {"_id": 0})
        if b and not b.get("driver_id"):
            out.append({**b, "request_status": r["status"]})
    return out


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
        await db.users.insert_one({"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": admin_email,
                                   "name": "Dispatch Admin", "phone": None, "role": "admin",
                                   "password_hash": hash_password(admin_password), "picture": None,
                                   "created_at": datetime.now(timezone.utc).isoformat()})
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
    await db.driver_profiles.create_index("user_id", unique=True)
    await seed_admin()
    try:
        await asyncio.to_thread(storage.init_storage)
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
