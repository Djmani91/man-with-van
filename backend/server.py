from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import secrets
import hashlib
import asyncio
import logging
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

import bcrypt
import httpx
from fastapi import (
    FastAPI, APIRouter, Request, Response, HTTPException, Depends,
    UploadFile, File, Header, Query,
)
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from emails import send_booking_confirmation, send_status_update, send_driver_job_alert
import storage
from square import Square
from square.environment import SquareEnvironment
from square.core.api_error import ApiError

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

square_client = Square(
    token=os.environ["SQUARE_ACCESS_TOKEN"],
    environment=SquareEnvironment.PRODUCTION if os.environ.get("SQUARE_ENV") == "production" else SquareEnvironment.SANDBOX,
)
SQUARE_LOCATION_ID = os.environ["SQUARE_LOCATION_ID"]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

SESSION_DAYS = 7
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
INSTANT_RADIUS_MI = 5
INSTANT_RADIUS_EXPANDED_MI = 10
BIDDING_RADIUS_MI = 20
VAN_ORDER = ["small", "medium", "large", "xl"]


def van_rank(v: str) -> int:
    return VAN_ORDER.index(v) if v in VAN_ORDER else 0
DEPOSIT_PCT = 0.15
PROMO_CODES = {"STUDENT10": {"pct": 0.10, "label": "Student 10% off"}}
REFERRAL_REWARD = 5.0  # £ credit for referrer and friend on friend's first paid booking
MIN_CARD_CHARGE = 0.50  # never charge a card below this (Square minimum guard)

# ---------------------------------------------------------------------------
# Van pricing + thresholds
# ---------------------------------------------------------------------------
VAN_SIZES = [
    {"id": "small", "name": "Small Van", "desc": "A few boxes, a single item or a studio flat.", "capacity": "Up to ~15 boxes", "dimensions": "1.2m³ load space", "crew": 1, "load_hours": 1.0, "rate_min": 35, "rate_max": 45},
    {"id": "medium", "name": "Medium Van (SWB)", "desc": "1-bed flat — sofas, a bed, appliances and boxes.", "capacity": "1-bed flat", "dimensions": "6-7m³ load space", "crew": 1, "load_hours": 1.5, "rate_min": 40, "rate_max": 50},
    {"id": "large", "name": "Large Luton Van", "desc": "Full 2-3 bed house move with a tail-lift.", "capacity": "2-3 bed house", "dimensions": "18-20m³ + tail lift", "crew": 2, "load_hours": 2.0, "rate_min": 45, "rate_max": 55},
    {"id": "xl", "name": "XL Luton / Multi-Trip", "desc": "4+ bed homes or office relocations.", "capacity": "4+ bed / office", "dimensions": "20m³+ / multiple", "crew": 2, "load_hours": 3.0, "rate_min": 50, "rate_max": 60},
]
VAN_BY_ID = {v["id"]: v for v in VAN_SIZES}
STAIRS_MIN, STAIRS_MAX = 5, 15
HELPER_MIN, HELPER_MAX = 15, 25

PRICING_BOUNDS = {
    "rates": {v["id"]: (v["rate_min"], v["rate_max"]) for v in VAN_SIZES},
    "stairs_fee": (STAIRS_MIN, STAIRS_MAX),
    "helper_rate": (HELPER_MIN, HELPER_MAX),
}


def default_pricing():
    return {
        "rates": {v["id"]: v["rate_min"] for v in VAN_SIZES},
        "stairs_fee": STAIRS_MIN,
        "helper_rate": HELPER_MIN,
    }


def clamp_pricing(p: dict) -> dict:
    out = default_pricing()
    rates = p.get("rates", {}) or {}
    for vid, (lo, hi) in PRICING_BOUNDS["rates"].items():
        val = rates.get(vid, lo)
        out["rates"][vid] = max(lo, min(hi, float(val)))
    lo, hi = PRICING_BOUNDS["stairs_fee"]
    out["stairs_fee"] = max(lo, min(hi, float(p.get("stairs_fee", lo))))
    lo, hi = PRICING_BOUNDS["helper_rate"]
    out["helper_rate"] = max(lo, min(hi, float(p.get("helper_rate", lo))))
    return out


STATUS_LABELS = {
    "quoting": "Choosing a driver", "pending": "Awaiting confirmation", "confirmed": "Booking confirmed",
    "assigned": "Driver assigned", "en_route_pickup": "Driver en route to pickup",
    "loading": "Loading at pickup", "in_transit": "In transit to destination",
    "completed": "Move completed", "cancelled": "Cancelled",
}
STATUS_PROGRESS = {
    "quoting": 0.0, "pending": 0.0, "confirmed": 0.0, "assigned": 0.05, "en_route_pickup": 0.15,
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


def driver_distance_mi(base_postcode: str, pickup: str) -> float:
    """Deterministic simulated distance (0.5–34 mi) from a driver's home base to a pickup."""
    return round(0.5 + _hash_float("dist", base_postcode or "", pickup) * 33.5, 1)


def driver_rating(uid: str) -> float:
    return round(4.3 + _hash_float("rating", uid) * 0.7, 1)


def driver_reviews(uid: str) -> int:
    return 18 + int(_hash_float("rev", uid) * 180)


def estimated_hours(distance, van_size, pf, df, needs_helper=False, heavy_items=False) -> float:
    load = VAN_BY_ID.get(van_size, {}).get("load_hours", 1.5)
    h = load + (distance or 0) / 20.0 + 0.25 * ((pf or 0) + (df or 0))
    if heavy_items:
        h += 0.5
    return max(2.0, round(h * 2) / 2)


def compute_quote(pickup, dropoff, van_size, date, time,
                  pickup_floor=0, dropoff_floor=0, pickup_lift=True, dropoff_lift=True, heavy_items=False):
    van = VAN_BY_ID.get(van_size)
    if not van:
        raise HTTPException(status_code=400, detail="Invalid van size")
    distance = pseudo_distance(pickup, dropoff)
    hours = estimated_hours(distance, van_size, pickup_floor, dropoff_floor, heavy_items=heavy_items)
    est = round(van["rate_min"] * hours, 2)
    return {
        "van_size": van_size, "van_name": van["name"], "distance_miles": distance,
        "estimated_hours": hours, "rate_from": van["rate_min"],
        "estimate_from": est, "total": est, "currency": "GBP",
    }


def driver_job_price(profile: dict, booking: dict, van_override: str = None):
    van = van_override or booking["van_size"]
    pricing = profile.get("pricing") or default_pricing()
    rate = pricing["rates"].get(van, VAN_BY_ID[van]["rate_min"])
    hours = estimated_hours(booking["distance_miles"], van, booking.get("pickup_floor", 0),
                            booking.get("dropoff_floor", 0), booking.get("needs_helper"), booking.get("heavy_items"))
    price = rate * hours
    floors = 0
    if booking.get("pickup_floor") and not booking.get("pickup_lift"):
        floors += booking["pickup_floor"]
    if booking.get("dropoff_floor") and not booking.get("dropoff_lift"):
        floors += booking["dropoff_floor"]
    price += pricing["stairs_fee"] * floors
    if booking.get("needs_helper"):
        price += pricing["helper_rate"] * hours
    return round(price, 2), hours


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
            "role": u.get("role", "customer"), "picture": u.get("picture"), "phone": u.get("phone"),
            "referral_code": u.get("referral_code"), "referral_credit": round(u.get("referral_credit", 0.0), 2)}


async def gen_referral_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars
    for _ in range(20):
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        if not await db.users.find_one({"referral_code": code}):
            return code
    return "R" + uuid.uuid4().hex[:6].upper()


async def resolve_referrer(ref: Optional[str], new_user_id: str) -> Optional[str]:
    if not ref:
        return None
    ref = ref.strip().upper()
    if not ref:
        return None
    referrer = await db.users.find_one({"referral_code": ref})
    if referrer and referrer["user_id"] != new_user_id:
        return referrer["user_id"]
    return None


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


async def _require_approved_driver(user: dict) -> dict:
    p = await db.driver_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not p or p.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Your driver account is awaiting approval")
    return p


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None
    ref: Optional[str] = None  # referral code of the friend who invited them


class PricingInput(BaseModel):
    rates: Dict[str, float] = {}
    stairs_fee: float = STAIRS_MIN
    helper_rate: float = HELPER_MIN


class DriverRegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str
    vehicle: str
    licence_no: str
    insurance_no: str
    mot_expiry: Optional[str] = None
    home_postcode: str
    address: Optional[str] = None
    van_size: Optional[str] = None
    pricing: Optional[PricingInput] = None


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
    heavy_items: bool = False


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
    needs_helper: bool = False
    heavy_items: bool = False
    items: Optional[str] = None
    photos: List[str] = []
    customer_name: str
    customer_phone: str
    notes: Optional[str] = None
    promo_code: Optional[str] = None


class DriverInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str
    vehicle: str
    home_postcode: str = "M1 1AA"


class StatusInput(BaseModel):
    status: str


class AvailabilityInput(BaseModel):
    available: bool


class SelectDriverInput(BaseModel):
    driver_id: str
    payment_type: str = "full"  # "deposit" | "full" (ignored on reassignment)
    source_id: str = ""  # single-use card token; empty for reassignment (already paid)


class CancelInput(BaseModel):
    reason: str


class ChangeDriverInput(BaseModel):
    reason: str


class BidInput(BaseModel):
    price: float


class MessageInput(BaseModel):
    text: str


class DocumentsInput(BaseModel):
    profile_photo: Optional[str] = None
    van_photo: Optional[str] = None
    licence_photo: Optional[str] = None
    insurance_photo: Optional[str] = None


class AssignInput(BaseModel):
    driver_id: str


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    referred_by = await resolve_referrer(data.ref, user_id)
    user = {"user_id": user_id, "email": email, "name": data.name.strip(),
            "phone": data.phone, "role": "customer", "password_hash": hash_password(data.password),
            "picture": None, "referral_code": await gen_referral_code(),
            "referral_credit": 0.0, "referred_by": referred_by, "referral_rewarded": False,
            "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {**public_user(user), "token": token}


@api_router.post("/auth/driver-register")
async def driver_register(data: DriverRegisterInput, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": data.name.strip(),
            "phone": data.phone, "role": "driver", "password_hash": hash_password(data.password),
            "picture": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    pricing = clamp_pricing(data.pricing.model_dump() if data.pricing else default_pricing())
    await db.driver_profiles.insert_one({
        "user_id": user["user_id"], "name": data.name.strip(), "phone": data.phone,
        "vehicle": data.vehicle.strip(), "licence_no": data.licence_no.strip(),
        "insurance_no": data.insurance_no.strip(), "mot_expiry": data.mot_expiry,
        "home_postcode": data.home_postcode.strip(), "base_coords": pseudo_coords(data.home_postcode),
        "address": (data.address or "").strip() or None,
        "van_size": data.van_size if data.van_size in VAN_ORDER else None,
        "profile_photo": None, "van_photo": None, "licence_photo": None, "insurance_photo": None,
        "pricing": pricing, "rating": driver_rating(user["user_id"]), "reviews": driver_reviews(user["user_id"]),
        "status": "pending", "availability": "available",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {**public_user(user), "token": token}


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {**public_user(user), "token": token}


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
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {**public_user(user), "token": token}


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


@api_router.get("/referral/me")
async def my_referral(user: dict = Depends(get_current_user)):
    code = user.get("referral_code")
    if not code:
        code = await gen_referral_code()
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"referral_code": code}})
    referred_count = await db.users.count_documents({"referred_by": user["user_id"]})
    rewarded_count = await db.users.count_documents({"referred_by": user["user_id"], "referral_rewarded": True})
    return {
        "code": code,
        "credit": round(user.get("referral_credit", 0.0), 2),
        "reward_each": REFERRAL_REWARD,
        "referred_count": referred_count,
        "rewarded_count": rewarded_count,
    }


# ---------------------------------------------------------------------------
# Quote / address / pricing meta
# ---------------------------------------------------------------------------
@api_router.get("/vansizes")
async def van_sizes():
    return VAN_SIZES


@api_router.get("/pricing-bounds")
async def pricing_bounds():
    return {"rates": {v["id"]: {"min": v["rate_min"], "max": v["rate_max"], "name": v["name"]} for v in VAN_SIZES},
            "stairs_fee": {"min": STAIRS_MIN, "max": STAIRS_MAX},
            "helper_rate": {"min": HELPER_MIN, "max": HELPER_MAX}}


@api_router.get("/promo/{code}")
async def validate_promo(code: str):
    promo = PROMO_CODES.get(code.strip().upper())
    if not promo:
        return {"valid": False}
    return {"valid": True, "code": code.strip().upper(), "discount_pct": promo["pct"], "label": promo["label"]}


@api_router.post("/quote")
async def quote(data: QuoteInput):
    return compute_quote(data.pickup, data.dropoff, data.van_size, data.date, data.time,
                         data.pickup_floor, data.dropoff_floor, data.pickup_lift, data.dropoff_lift, data.heavy_items)


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
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not await db.sessions.find_one({"session_token": token}):
        raise HTTPException(status_code=401, detail="Invalid session")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = await asyncio.to_thread(storage.get_object, path)
    return Response(content=data, media_type=record.get("content_type", ct))


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------
def strip_booking(b: dict) -> dict:
    b = dict(b)
    b.pop("_id", None)
    return b


@api_router.post("/bookings")
async def create_booking(data: BookingInput, user: dict = Depends(get_current_user)):
    q = compute_quote(data.pickup, data.dropoff, data.van_size, data.date, data.time,
                      data.pickup_floor, data.dropoff_floor, data.pickup_lift, data.dropoff_lift, data.heavy_items)
    now = datetime.now(timezone.utc).isoformat()
    promo_code = (data.promo_code or "").strip().upper()
    promo = PROMO_CODES.get(promo_code)
    booking = {
        "booking_id": f"MWV{uuid.uuid4().hex[:8].upper()}", "user_id": user["user_id"],
        "customer_name": data.customer_name.strip(), "customer_email": user["email"],
        "customer_phone": data.customer_phone.strip(),
        "pickup": data.pickup.strip(), "pickup_flat": data.pickup_flat, "dropoff": data.dropoff.strip(),
        "pickup_coords": pseudo_coords(data.pickup), "dropoff_coords": pseudo_coords(data.dropoff),
        "pickup_floor": data.pickup_floor, "dropoff_floor": data.dropoff_floor,
        "pickup_lift": data.pickup_lift, "dropoff_lift": data.dropoff_lift, "needs_helper": data.needs_helper,
        "heavy_items": data.heavy_items,
        "items": data.items, "photos": data.photos,
        "van_size": data.van_size, "van_name": q["van_name"], "distance_miles": q["distance_miles"],
        "estimated_hours": q["estimated_hours"], "date": data.date, "time": data.time, "notes": data.notes,
        "quote": q, "price": None, "currency": "GBP",
        "promo_code": promo_code if promo else None,
        "promo_discount_pct": promo["pct"] if promo else 0.0,
        "mode": None, "status": "quoting",
        "driver_id": None, "driver": None,
        "payment": {"status": "unpaid", "type": None, "amount": 0.0, "deposit": 0.0},
        "timeline": [], "created_at": now,
    }
    await db.bookings.insert_one(booking)
    return strip_booking(booking)


@api_router.get("/bookings")
async def my_bookings(user: dict = Depends(get_current_user)):
    docs = await db.bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [mask_contact_for_customer(b) for b in docs]


def paid(b: dict) -> bool:
    return (b.get("payment") or {}).get("status") in ("paid", "office")


def mask_contact_for_customer(b: dict) -> dict:
    b = dict(b)
    if not paid(b) and b.get("driver"):
        d = dict(b["driver"])
        d["phone"] = None
        b["driver"] = d
    return b


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    return mask_contact_for_customer(b)


async def _offer_for(profile: dict, booking: dict, offered_size: str = None) -> dict:
    size = offered_size or booking["van_size"]
    price, hours = driver_job_price(profile, booking, van_override=size)
    dist = driver_distance_mi(profile.get("home_postcode", ""), booking["pickup"])
    return {
        "driver_id": profile["user_id"], "name": profile["name"], "vehicle": profile["vehicle"],
        "rating": profile.get("rating", 5.0), "reviews": profile.get("reviews", 0),
        "price": price, "hours": hours, "distance_mi": dist,
        "offered_van_size": size, "offered_van_name": VAN_BY_ID.get(size, {}).get("name", size),
    }


def _tag_offers(offers: List[dict]) -> List[dict]:
    if not offers:
        return offers
    cheapest = min(o["price"] for o in offers)
    closest = min(o["distance_mi"] for o in offers)
    for o in offers:
        tags = []
        if o["price"] == cheapest:
            tags.append("cheapest")
        if o["distance_mi"] == closest:
            tags.append("closest")
        o["tags"] = tags
    return offers


@api_router.get("/bookings/{booking_id}/instant-offers")
async def instant_offers(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b or b["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    req = b["van_size"]
    drivers = await db.driver_profiles.find({"status": "approved", "availability": "available"}, {"_id": 0}).to_list(500)
    for d in drivers:
        d["_dist"] = driver_distance_mi(d.get("home_postcode", ""), b["pickup"])

    def can_exact(d):
        vs = d.get("van_size")
        return (not vs) or vs == req  # legacy drivers (no van_size) can quote any size

    def can_bigger(d):
        vs = d.get("van_size")
        return bool(vs) and van_rank(vs) > van_rank(req)

    for radius in (INSTANT_RADIUS_MI, INSTANT_RADIUS_EXPANDED_MI):
        pool = [d for d in drivers if d["_dist"] <= radius]
        exact = [d for d in pool if can_exact(d)]
        if exact:
            offers = [await _offer_for(d, b) for d in exact]
            offers = _tag_offers(sorted(offers, key=lambda o: o["price"]))[:5]
            return {"radius_mi": radius, "van_fallback": False, "requested_van_name": VAN_BY_ID.get(req, {}).get("name", req), "offers": offers}
        bigger = [d for d in pool if can_bigger(d)]
        if bigger:
            offers = [await _offer_for(d, b, offered_size=d["van_size"]) for d in bigger]
            offers = _tag_offers(sorted(offers, key=lambda o: o["price"]))[:5]
            return {"radius_mi": radius, "van_fallback": True, "requested_van_name": VAN_BY_ID.get(req, {}).get("name", req), "offers": offers}

    return {"radius_mi": INSTANT_RADIUS_EXPANDED_MI, "van_fallback": False, "requested_van_name": VAN_BY_ID.get(req, {}).get("name", req), "offers": []}


@api_router.post("/bookings/{booking_id}/broadcast")
async def broadcast_bidding(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b or b["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"mode": "bidding"}})
    drivers = await db.driver_profiles.find({"status": "approved"}, {"_id": 0}).to_list(500)
    notified = 0
    for d in drivers:
        dist = driver_distance_mi(d.get("home_postcode", ""), b["pickup"])
        if dist <= BIDDING_RADIUS_MI:
            notified += 1
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()), "driver_id": d["user_id"], "booking_id": booking_id,
                "type": "new_job", "title": "New job in your area",
                "body": f"{b['van_name']} · {b['pickup']} → {b['dropoff']} · {dist} mi away",
                "read": False, "created_at": datetime.now(timezone.utc).isoformat(),
            })
            u = await db.users.find_one({"user_id": d["user_id"]}, {"_id": 0})
            if u:
                try:
                    await send_driver_job_alert(u["email"], d["name"], b)
                except Exception as e:
                    logger.error(f"Driver alert email failed: {e}")
    return {"mode": "bidding", "notified_drivers": notified, "radius_mi": BIDDING_RADIUS_MI}


@api_router.get("/bookings/{booking_id}/bids")
async def booking_bids(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b or b["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    bids = await db.bids.find({"booking_id": booking_id}, {"_id": 0}).to_list(200)
    out = []
    for bid in bids:
        prof = await db.driver_profiles.find_one({"user_id": bid["driver_id"]}, {"_id": 0})
        if not prof:
            continue
        out.append({
            "driver_id": bid["driver_id"], "name": prof["name"], "vehicle": prof["vehicle"],
            "rating": prof.get("rating", 5.0), "reviews": prof.get("reviews", 0),
            "price": bid["price"], "distance_mi": driver_distance_mi(prof.get("home_postcode", ""), b["pickup"]),
            "created_at": bid["created_at"],
        })
    return _tag_offers(sorted(out, key=lambda o: o["price"]))


async def _charge_square(amount_gbp: float, booking_id: str, payment_type: str, source_id: str) -> str:
    """Charge the card via Square. Returns the Square payment id or raises HTTPException."""
    amount_pence = int(round(amount_gbp * 100))
    if amount_pence <= 0:
        raise HTTPException(status_code=400, detail="Nothing to pay")
    try:
        result = await asyncio.to_thread(
            square_client.payments.create,
            source_id=source_id,
            idempotency_key=uuid.uuid4().hex,
            amount_money={"amount": amount_pence, "currency": "GBP"},
            autocomplete=True,
            location_id=SQUARE_LOCATION_ID,
            reference_id=booking_id[:40],
            note=f"Man With Van {booking_id} ({payment_type})",
        )
    except ApiError as exc:
        errs = getattr(exc, "errors", None) or []
        msg = errs[0].detail if errs and getattr(errs[0], "detail", None) else "Card was declined. Please try another card."
        logger.error(f"Square payment failed for {booking_id}: {errs}")
        raise HTTPException(status_code=402, detail=msg)
    except Exception as exc:
        logger.error(f"Square payment error for {booking_id}: {exc}")
        raise HTTPException(status_code=502, detail="Payment could not be processed. Please try again.")
    payment = getattr(result, "payment", None)
    if not payment or getattr(payment, "status", None) not in ("COMPLETED", "APPROVED"):
        status = getattr(payment, "status", "unknown") if payment else "none"
        logger.error(f"Square payment not completed for {booking_id}: {status}")
        raise HTTPException(status_code=402, detail="Payment was not completed. Please try again.")
    return payment.id


async def _assign_and_pay(booking_id: str, driver_id: str, payment_type: str, source_id: str, customer_id: str):
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b or b["user_id"] != customer_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("driver_id"):
        raise HTTPException(status_code=400, detail="This booking already has a driver")
    prof = await db.driver_profiles.find_one({"user_id": driver_id}, {"_id": 0})
    if not prof or prof.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Driver unavailable")

    if b.get("mode") == "bidding":
        bid = await db.bids.find_one({"booking_id": booking_id, "driver_id": driver_id}, {"_id": 0})
        price = bid["price"] if bid else driver_job_price(prof, b)[0]
    else:
        price = driver_job_price(prof, b)[0]

    if payment_type not in ("deposit", "full"):
        raise HTTPException(status_code=400, detail="Invalid payment type")

    now = datetime.now(timezone.utc).isoformat()
    already_paid = (b.get("payment") or {}).get("status") in ("paid", "office")

    if already_paid:
        # Reassignment after a "change driver" request — payment stays, no new charge.
        price = b.get("price") or round(price, 2)
        payment = b["payment"]
        timeline = (b.get("timeline") or []) + [{"status": "assigned", "label": f"{prof['name']} assigned", "at": now}]
    else:
        promo_code = b.get("promo_code")
        promo_pct = b.get("promo_discount_pct") or 0.0
        original_price = round(price, 2)
        discount_amount = round(original_price * promo_pct, 2) if promo_pct else 0.0
        price = round(original_price - discount_amount, 2)
        deposit = round(price * DEPOSIT_PCT, 2)
        amount = deposit if payment_type == "deposit" else price

        customer = await db.users.find_one({"user_id": customer_id})
        available_credit = round((customer or {}).get("referral_credit", 0.0), 2)
        credit_applied = min(available_credit, amount)
        if amount - credit_applied < MIN_CARD_CHARGE:
            credit_applied = round(max(0.0, amount - MIN_CARD_CHARGE), 2)
        charge_amount = round(amount - credit_applied, 2)

        if not source_id:
            raise HTTPException(status_code=400, detail="Payment details required")
        square_payment_id = await _charge_square(charge_amount, booking_id, payment_type, source_id)

        if credit_applied > 0:
            await db.users.update_one({"user_id": customer_id}, {"$inc": {"referral_credit": -credit_applied}})
        if customer and customer.get("referred_by") and not customer.get("referral_rewarded"):
            await db.users.update_one({"user_id": customer["referred_by"]}, {"$inc": {"referral_credit": REFERRAL_REWARD}})
            await db.users.update_one({"user_id": customer_id}, {"$inc": {"referral_credit": REFERRAL_REWARD}, "$set": {"referral_rewarded": True}})

        payment = {"status": "paid", "type": payment_type, "amount": amount, "deposit": deposit,
                   "balance_due": round(price - amount, 2), "paid_at": now,
                   "transaction_id": square_payment_id, "provider": "square",
                   "original_price": original_price, "promo_code": promo_code, "discount": discount_amount,
                   "credit_applied": credit_applied, "card_charged": charge_amount}
        timeline = [{"status": "confirmed", "label": STATUS_LABELS["confirmed"], "at": now},
                    {"status": "assigned", "label": f"{prof['name']} assigned", "at": now}]

    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {
        "driver_id": driver_id,
        "driver": {"name": prof["name"], "phone": prof["phone"], "vehicle": prof["vehicle"],
                   "rating": prof.get("rating", 5.0)},
        "price": price, "status": "assigned",
        "payment": payment,
        "timeline": timeline, "mode": b.get("mode") or "instant",
    }})
    await db.driver_profiles.update_one({"user_id": driver_id}, {"$set": {"availability": "on_job"}})
    await db.bids.update_many({"booking_id": booking_id, "driver_id": driver_id}, {"$set": {"status": "accepted"}})
    await db.bids.update_many({"booking_id": booking_id, "driver_id": {"$ne": driver_id}}, {"$set": {"status": "declined"}})
    updated = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "driver_id": driver_id, "booking_id": booking_id, "type": "job_won",
        "title": "You've got the job!", "body": f"{updated['pickup']} → {updated['dropoff']} · £{price:.2f}",
        "read": False, "created_at": now,
    })
    try:
        await send_booking_confirmation(updated)
    except Exception as e:
        logger.error(f"Confirmation email failed: {e}")
    return updated


@api_router.post("/bookings/{booking_id}/select-driver")
async def select_driver(booking_id: str, data: SelectDriverInput, user: dict = Depends(get_current_user)):
    return await _assign_and_pay(booking_id, data.driver_id, data.payment_type, data.source_id, user["user_id"])


@api_router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, data: CancelInput, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b or b["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="This booking can no longer be cancelled")
    now = datetime.now(timezone.utc).isoformat()
    updates = {"status": "cancelled", "cancel_reason": data.reason.strip(), "cancelled_at": now}
    paid = (b.get("payment") or {}).get("status") == "paid"
    if paid:
        pay = dict(b["payment"])
        pay["refund"] = {"status": "requested", "amount": pay.get("card_charged", pay.get("amount", 0)),
                         "reason": data.reason.strip(), "requested_at": now}
        updates["payment"] = pay
    updates["timeline"] = (b.get("timeline") or []) + [{"status": "cancelled", "label": "Cancelled by customer", "at": now}]
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": updates})
    if b.get("driver_id"):
        await db.driver_profiles.update_one({"user_id": b["driver_id"]}, {"$set": {"availability": "available"}})
    return {"status": "cancelled", "refund_requested": paid}


@api_router.post("/bookings/{booking_id}/change-driver")
async def change_driver(booking_id: str, data: ChangeDriverInput, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b or b["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] != "assigned" or not b.get("driver_id"):
        raise HTTPException(status_code=400, detail="No assigned driver to change")
    now = datetime.now(timezone.utc).isoformat()
    prev_driver = b.get("driver_id")
    reassignment = {"prev_driver_id": prev_driver, "prev_driver_name": (b.get("driver") or {}).get("name"),
                    "reason": data.reason.strip(), "at": now}
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {
        "status": "quoting", "driver_id": None, "driver": None,
        "timeline": (b.get("timeline") or []) + [{"status": "quoting", "label": "Looking for a new driver", "at": now}],
    }, "$push": {"reassignments": reassignment}})
    # Free the previous driver and let them know.
    if prev_driver:
        await db.driver_profiles.update_one({"user_id": prev_driver}, {"$set": {"availability": "available"}})
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "driver_id": prev_driver, "booking_id": booking_id, "type": "job_reassigned",
            "title": "A job was reassigned", "body": f"The customer chose to change driver ({data.reason.strip()}).",
            "read": False, "created_at": now,
        })
    return {"status": "quoting", "message": "We're finding you another driver. This isn't guaranteed and may take a little longer, especially close to your move time."}


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
    driver = b.get("driver")
    if driver and not paid(b):
        driver = {**driver, "phone": None}
    return {
        "booking_id": b["booking_id"], "status": b["status"],
        "status_label": STATUS_LABELS.get(b["status"], b["status"]),
        "progress": STATUS_PROGRESS.get(b["status"], 0.0),
        "pickup": b["pickup"], "dropoff": b["dropoff"],
        "pickup_coords": b["pickup_coords"], "dropoff_coords": b["dropoff_coords"],
        "driver_position": driver_position(b), "driver": driver, "payment": b.get("payment"),
        "price": b.get("price"), "timeline": b.get("timeline", []),
        "eta_minutes": max(0, int((1 - STATUS_PROGRESS.get(b["status"], 0.0)) * (b["distance_miles"] * 2.2 + 15))),
    }


# ---------------------------------------------------------------------------
# Chat (contact-masked)
# ---------------------------------------------------------------------------
_PHONE_RE = re.compile(r"(\+?\d[\d\s().-]{7,}\d)")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def mask_message(text: str) -> str:
    text = _EMAIL_RE.sub("[contact hidden]", text)
    text = _PHONE_RE.sub("[contact hidden]", text)
    return text


async def _chat_participant(booking_id: str, user: dict):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    is_customer = b["user_id"] == user["user_id"]
    is_driver = b.get("driver_id") == user["user_id"]
    if not (is_customer or is_driver or user.get("role") == "admin"):
        raise HTTPException(status_code=403, detail="Not allowed")
    return b, ("customer" if is_customer else "driver")


@api_router.get("/bookings/{booking_id}/messages")
async def get_messages(booking_id: str, user: dict = Depends(get_current_user)):
    await _chat_participant(booking_id, user)
    return await db.messages.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api_router.post("/bookings/{booking_id}/messages")
async def post_message(booking_id: str, data: MessageInput, user: dict = Depends(get_current_user)):
    b, role = await _chat_participant(booking_id, user)
    if not b.get("driver_id"):
        raise HTTPException(status_code=400, detail="Chat opens once a driver is engaged")
    msg = {"id": str(uuid.uuid4()), "booking_id": booking_id, "sender_role": role,
           "sender_name": user.get("name", role.title()), "text": mask_message(data.text.strip()),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return msg


# ---------------------------------------------------------------------------
# Admin / dispatch
# ---------------------------------------------------------------------------
@api_router.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    all_b = await db.bookings.find({}, {"_id": 0, "price": 1, "status": 1}).to_list(2000)
    active = [b for b in all_b if b["status"] not in ("completed", "cancelled", "quoting")]
    revenue = round(sum((b.get("price") or 0) for b in all_b if b["status"] not in ("cancelled", "quoting")), 2)
    return {"total_bookings": len(all_b), "active_jobs": len(active),
            "completed": len([b for b in all_b if b["status"] == "completed"]), "revenue": revenue,
            "drivers": await db.driver_profiles.count_documents({"status": "approved"}),
            "pending_drivers": await db.driver_profiles.count_documents({"status": "pending"})}


@api_router.get("/admin/bookings")
async def admin_bookings(user: dict = Depends(require_admin)):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/drivers")
async def admin_drivers(user: dict = Depends(require_admin)):
    profiles = await db.driver_profiles.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    ids = [p["user_id"] for p in profiles]
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "email": 1}).to_list(len(ids) or 1)
    email_by_id = {u["user_id"]: u.get("email") for u in users}
    for p in profiles:
        p["email"] = email_by_id.get(p["user_id"])
    return profiles


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
               "home_postcode": data.home_postcode.strip(), "base_coords": pseudo_coords(data.home_postcode),
               "pricing": default_pricing(), "rating": driver_rating(u["user_id"]), "reviews": driver_reviews(u["user_id"]),
               "status": "approved", "availability": "available",
               "created_at": datetime.now(timezone.utc).isoformat()}
    await db.driver_profiles.insert_one(profile)
    return strip_booking(profile)


@api_router.post("/admin/drivers/{driver_user_id}/approve")
async def approve_driver(driver_user_id: str, user: dict = Depends(require_admin)):
    r = await db.driver_profiles.update_one({"user_id": driver_user_id}, {"$set": {"status": "approved"}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"status": "approved"}


@api_router.post("/admin/bookings/{booking_id}/assign")
async def admin_assign(booking_id: str, data: AssignInput, user: dict = Depends(require_admin)):
    b = await db.bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    prof = await db.driver_profiles.find_one({"user_id": data.driver_id}, {"_id": 0})
    if not prof or prof.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Driver not found or not approved")
    price, _ = driver_job_price(prof, b)
    now = datetime.now(timezone.utc).isoformat()
    timeline = b.get("timeline", [])
    if not any(t.get("status") == "confirmed" for t in timeline):
        timeline.append({"status": "confirmed", "label": STATUS_LABELS["confirmed"], "at": now})
    timeline.append({"status": "assigned", "label": f"{prof['name']} assigned by dispatch", "at": now})
    payment = b.get("payment") or {}
    if payment.get("status") != "paid":
        payment = {"status": "office", "type": "office", "amount": 0.0, "deposit": 0.0,
                   "balance_due": price, "paid_at": now, "transaction_id": None}
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {
        "driver_id": prof["user_id"],
        "driver": {"name": prof["name"], "phone": prof["phone"], "vehicle": prof["vehicle"], "rating": prof.get("rating", 5.0)},
        "price": price, "status": "assigned", "payment": payment, "mode": b.get("mode") or "office", "timeline": timeline,
    }})
    await db.driver_profiles.update_one({"user_id": prof["user_id"]}, {"$set": {"availability": "on_job"}})
    updated = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    try:
        await send_booking_confirmation(updated)
    except Exception as e:
        logger.error(f"Confirmation email failed: {e}")
    return updated


@api_router.post("/admin/bookings/{booking_id}/status")
async def update_status(booking_id: str, data: StatusInput, user: dict = Depends(require_admin)):
    return await _apply_status(booking_id, data.status)


@api_router.post("/admin/bookings/{booking_id}/refund")
async def process_refund(booking_id: str, user: dict = Depends(require_admin)):
    b = await db.bookings.find_one({"booking_id": booking_id})
    pay = (b or {}).get("payment") or {}
    if not b or (pay.get("refund") or {}).get("status") != "requested":
        raise HTTPException(status_code=400, detail="No refund to process for this booking")
    now = datetime.now(timezone.utc).isoformat()
    pay = dict(pay)
    pay["refund"] = {**pay["refund"], "status": "refunded", "processed_at": now}
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"payment": pay}})
    return {"refund": pay["refund"]}


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


# ---------------------------------------------------------------------------
# Driver surface
# ---------------------------------------------------------------------------
@api_router.get("/driver/profile")
async def driver_profile(user: dict = Depends(require_driver)):
    p = await db.driver_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="No driver profile")
    return p


@api_router.post("/driver/pricing")
async def driver_set_pricing(data: PricingInput, user: dict = Depends(require_driver)):
    pricing = clamp_pricing(data.model_dump())
    await db.driver_profiles.update_one({"user_id": user["user_id"]}, {"$set": {"pricing": pricing}})
    return pricing


@api_router.post("/driver/documents")
async def driver_set_documents(data: DocumentsInput, user: dict = Depends(require_driver)):
    updates = {k: v for k, v in data.model_dump().items() if v}
    if updates:
        await db.driver_profiles.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return await db.driver_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})


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


@api_router.get("/driver/available")
async def driver_available_jobs(user: dict = Depends(require_driver)):
    prof = await _require_approved_driver(user)
    open_jobs = await db.bookings.find({"driver_id": None, "mode": "bidding", "status": "quoting"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    my_bids = await db.bids.find({"driver_id": user["user_id"]}, {"_id": 0}).to_list(500)
    bid_ids = {b["booking_id"] for b in my_bids}
    out = []
    for j in open_jobs:
        dist = driver_distance_mi(prof.get("home_postcode", ""), j["pickup"])
        if dist <= BIDDING_RADIUS_MI and j["booking_id"] not in bid_ids:
            suggested, hours = driver_job_price(prof, j)
            out.append({**j, "distance_mi": dist, "suggested_price": suggested, "est_hours": hours})
    return out


@api_router.post("/driver/jobs/{booking_id}/bid")
async def driver_bid(booking_id: str, data: BidInput, user: dict = Depends(require_driver)):
    await _require_approved_driver(user)
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b or b.get("driver_id") or b.get("mode") != "bidding":
        raise HTTPException(status_code=400, detail="This job is not open for bids")
    if await db.bids.find_one({"booking_id": booking_id, "driver_id": user["user_id"]}):
        raise HTTPException(status_code=400, detail="You already bid on this job")
    await db.bids.insert_one({"id": str(uuid.uuid4()), "booking_id": booking_id, "driver_id": user["user_id"],
                              "price": round(float(data.price), 2), "status": "waiting",
                              "created_at": datetime.now(timezone.utc).isoformat()})
    return {"status": "waiting"}


@api_router.get("/driver/requests")
async def driver_requests(user: dict = Depends(require_driver)):
    bids = await db.bids.find({"driver_id": user["user_id"], "status": "waiting"}, {"_id": 0}).to_list(200)
    out = []
    for r in bids:
        b = await db.bookings.find_one({"booking_id": r["booking_id"]}, {"_id": 0})
        if b and not b.get("driver_id"):
            out.append({**b, "my_bid": r["price"]})
    return out


@api_router.get("/driver/notifications")
async def driver_notifications(user: dict = Depends(require_driver)):
    return await db.notifications.find({"driver_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api_router.post("/driver/notifications/read")
async def driver_notifications_read(user: dict = Depends(require_driver)):
    await db.notifications.update_many({"driver_id": user["user_id"], "read": False}, {"$set": {"read": True}})
    return {"status": "ok"}


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
    await db.bids.create_index([("booking_id", 1), ("driver_id", 1)])
    await db.messages.create_index("booking_id")
    await db.notifications.create_index("driver_id")
    await seed_admin()
    try:
        await asyncio.to_thread(storage.init_storage)
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
