# Man With Van — Mobile Handoff (iOS + Android)

This document lets a React Native (Expo) app connect to the **same backend** that powers the website. One backend + one database serves web, iOS and Android — same accounts, same data.

---

## 1. App identity (use EXACTLY — do not append anything)
- iOS bundle identifier: `com.base6a789f0035d4228147cfc5c9.app`
- Android applicationId / package: `com.base6a789f0035d4228147cfc5c9.app`
- Reusing this exact ID ships as an UPDATE to your existing store listings and preserves reviews/ratings/users.

## 2. Backend base URL
- Preview/dev: `https://move-tracker-dev.preview.emergentagent.com`
- Production: your deployed URL (the `*.emergent.host` URL or your custom domain) once deployed.
- **All endpoints are prefixed with `/api`.** Example: `https://<host>/api/quote`
- Put this in the mobile app config (e.g. Expo `extra.API_BASE`), never hardcode per-screen.

## 3. Auth model (IMPORTANT for mobile)
- The web uses an httpOnly cookie (`session_token`, SameSite=None). Every auth endpoint returns/sets this cookie.
- Mobile (React Native) should use the **Bearer token** path the backend already supports:
  - `get_current_user` and `/api/files` accept `Authorization: Bearer <session_token>`.
  - BUT the login/register endpoints currently set the token as a cookie, not in the JSON body.
  - **Handoff task for the mobile build:** add the session token to the login/register JSON response (one line each) so the app can store it in secure storage and send `Authorization: Bearer <token>` on every request. (Trivial change — note it in the mobile project.)
- Google login on mobile: use the same Emergent OAuth redirect flow adapted for Expo AuthSession → exchange `session_id` at `POST /api/auth/session` with header `X-Session-ID`.

## 4. Roles
- `customer` → book, choose driver, pay (mock), track, chat
- `driver` → set pricing, receive/bid jobs, update status, chat
- `admin` → dispatch dashboard (approve drivers, assign, update status)

---

## 5. API endpoints (all prefixed with `/api`)

### Auth
| Method | Path | Body / Notes |
|---|---|---|
| POST | `/auth/register` | `{name,email,password,phone?}` → customer |
| POST | `/auth/driver-register` | `{name,email,password,phone,vehicle,licence_no,insurance_no,mot_expiry?,home_postcode,pricing?}` |
| POST | `/auth/login` | `{email,password}` |
| POST | `/auth/session` | header `X-Session-ID` (Google OAuth exchange) |
| POST | `/auth/logout` | — |
| GET | `/auth/me` | current user |

### Quote / reference data
| Method | Path | Notes |
|---|---|---|
| GET | `/vansizes` | 4 van types + rate bands |
| GET | `/pricing-bounds` | driver rate bands (small 35-45, medium 40-50, large 45-55, xl 50-60, stairs 5-15, helper 15-25) |
| POST | `/quote` | `{pickup,dropoff,van_size,date,time,pickup_floor?,dropoff_floor?,pickup_lift?,dropoff_lift?}` → estimate |
| GET | `/address/suggest?q=` | mock postcode/street autocomplete (min 2 chars) |

### Files
| Method | Path | Notes |
|---|---|---|
| POST | `/upload` | multipart `file` (≤8MB) → `{path}` (auth) |
| GET | `/files/{path}` | serve file; `Authorization: Bearer` or `?auth=<token>` |

### Customer bookings & marketplace
| Method | Path | Notes |
|---|---|---|
| POST | `/bookings` | create booking (status `quoting`). Body incl. addresses, van_size, date/time, floors, needs_helper, items, photos[], customer_name/phone, notes |
| GET | `/bookings` | my bookings (driver phone hidden until deposit paid) |
| GET | `/bookings/{id}` | one booking |
| GET | `/bookings/{id}/instant-offers` | nearby approved+available drivers, auto-priced, tags cheapest/closest |
| POST | `/bookings/{id}/broadcast` | switch to bidding; notify drivers within 30mi (in-app + email) |
| GET | `/bookings/{id}/bids` | incoming driver bids (tagged) |
| POST | `/bookings/{id}/select-driver` | `{driver_id, payment_type:"deposit"\|"full"}` → **MOCK payment**, assigns driver, reveals contact |
| GET | `/bookings/{id}/track` | live status, driver position, ETA, timeline, payment summary |
| GET | `/bookings/{id}/messages` | chat history |
| POST | `/bookings/{id}/messages` | `{text}` — phone/email auto-masked; opens only after driver assigned |

### Driver
| Method | Path | Notes |
|---|---|---|
| GET | `/driver/profile` | profile + pricing + status |
| POST | `/driver/pricing` | `{rates:{small,medium,large,xl}, stairs_fee, helper_rate}` (clamped to bands) |
| GET | `/driver/available` | open bidding jobs within 30mi + suggested price |
| POST | `/driver/jobs/{id}/bid` | `{price}` |
| GET | `/driver/requests` | my pending bids |
| GET | `/driver/jobs` | my assigned jobs |
| POST | `/driver/jobs/{id}/status` | `{status}` en_route_pickup/loading/in_transit/completed |
| POST | `/driver/availability` | `{available:bool}` |
| GET | `/driver/notifications` | in-app job alerts |
| POST | `/driver/notifications/read` | mark all read |

### Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | totals, active, completed, revenue, drivers |
| GET | `/admin/bookings` | all bookings |
| GET | `/admin/drivers` | all driver profiles |
| POST | `/admin/drivers` | create approved driver `{name,email,password,phone,vehicle,home_postcode?}` |
| POST | `/admin/drivers/{driver_user_id}/approve` | approve pending driver |
| POST | `/admin/bookings/{id}/status` | update job status |

---

## 6. Recommended mobile screens (map to endpoints)
- **Auth**: Login / Register / Driver signup (Google via Expo AuthSession)
- **Customer tabs**: Book (6-step wizard) · My Jobs (offers/bidding + payment) · Messages (chat) · Account
- **Driver tabs**: Quotation (bid) · Waiting · Accepted (status + chat) · Settings (pricing, availability)
- Reuse the exact flows already built on web (same request/response shapes).

## 7. Business rules to preserve in the app
- Payment: 15% deposit (balance cash to driver) OR pay in full. **Currently MOCKED** — swap to Stripe when ready.
- Contact masking: hide phone/email in chat; reveal driver phone only after deposit paid.
- Matching: instant = within 5mi of driver home base; bidding = broadcast within 30mi. (Distances simulated until a real maps key is added.)
- Refund guarantee: cancel ≥6h before slot for full refund (policy copy shown; enforcement is a future task).

## 8. Test accounts
- Admin: `anisha91ahmed@gmail.com` / `MoveAdmin#2026`
- Driver: `drv1@example.com` / `Drive#2026`
- Customers: register fresh.

## 9. Notes / future work
- Add `token` to login/register JSON responses for mobile Bearer auth (see §3).
- Real payments (Stripe), real maps/geocoding + GPS, real push notifications (FCM/APNs), driver ratings, cancellation-window enforcement.
