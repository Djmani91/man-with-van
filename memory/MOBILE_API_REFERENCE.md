# Man With Van — Mobile App API & Workflow Reference

Hand this file to your mobile developer. It is the single source of truth for how the
**mobile app (iOS + Android)** talks to the **same backend** that powers the website.

> One backend + one database serves web, iOS and Android — same accounts, same data.
> The mobile app must ONLY call the HTTP API below. **Never connect the mobile app to
> MongoDB directly.**

---

## 1. Base URL & rules
- **Base URL (production):** your deployed URL (e.g. `https://manwithvanapp.co.uk` or the
  `*.emergent.host` URL). Use the production URL for the live app.
- **Base URL (preview/testing):** the `*.preview.emergentagent.com` URL.
- **Every endpoint is prefixed with `/api`.** Example: `POST https://<host>/api/quote`.
- Store the base URL once in app config (e.g. Expo `extra.API_BASE`) — never hardcode per screen.
- All request/response bodies are JSON (except file upload = multipart).

## 2. Authentication (READ CAREFULLY — mobile differs from web)
- The **website** uses an httpOnly cookie (`session_token`). Mobile cannot rely on cookies.
- The backend's `get_current_user` and `/api/files` **already accept a Bearer token**:
  `Authorization: Bearer <session_token>`.
- **One small backend change is needed for mobile:** the login / register / session
  endpoints currently set the token as a cookie. Return that same token in the JSON body
  too, so the app can save it in secure storage (Expo SecureStore / Keychant / Keystore)
  and send `Authorization: Bearer <token>` on every request.
  - Endpoints to add the token to the response body: `/api/auth/login`,
    `/api/auth/register`, `/api/auth/driver-register`, `/api/auth/session`.
- **Google sign-in on mobile:** use Expo AuthSession with the Emergent OAuth flow, then
  `POST /api/auth/session` with header `X-Session-ID: <session_id>` to exchange it for the
  session token.
- Send `Authorization: Bearer <token>` on **every** authenticated request.

### Auth endpoints
| Method | Path | Body | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | `{name, email, password, phone}` | Customer sign up |
| POST | `/api/auth/driver-register` | driver fields (see §7) | Driver sign up (status=pending) |
| POST | `/api/auth/login` | `{email, password}` | Log in (customer/driver/admin) |
| POST | `/api/auth/session` | header `X-Session-ID` | Exchange Google OAuth session |
| POST | `/api/auth/logout` | — | Log out |
| GET  | `/api/auth/me` | — | Current user `{user_id, name, email, role}` |
| PUT  | `/api/account/notifications` | `{...prefs}` | Email notification preferences |
| GET  | `/api/referral/me` | — | Referral code + credit |

## 3. Roles
- `customer` → book, get quotes, choose driver, pay, track, chat, view invoice
- `driver` → Driver Hub: quote/accept jobs, confirm, update status, chat, settings
- `admin` → dispatch dashboard (usually web only)

Route the app to the right home screen by reading `role` from `/api/auth/me`.

---

## 4. Screens the mobile app needs (what's mobile vs web-only)
| Screen / flow | Mobile? | Notes |
|---|---|---|
| Customer booking (single scrolling form) | ✅ Yes | See §5. Web uses a step wizard; mobile is one page. |
| Instant quotes + choose driver + pay | ✅ Yes | Square card payment. |
| My Jobs / tracking / invoice / chat | ✅ Yes | |
| Driver Hub (Quotation / Accepted / Message / Settings) | ✅ Yes | See §6. |
| Admin / Dispatch dashboard | ⛔ Web only | Ops team uses the website `/admin`. |
| SEO landing pages, sitemap, robots | ⛔ Web only | Marketing pages — not needed in the app. |

---

## 5. Customer workflow (endpoints in order)
1. **Get a quote** → `POST /api/quote`
   Body: `{pickup, dropoff, pickup_coords, dropoff_coords, van_size, date, time,
   pickup_floor, dropoff_floor, pickup_lift, dropoff_lift, needs_helper, items}`
   Returns price + estimated hours. (Addresses via `GET /api/address/suggest?q=`.)
2. **Upload item photos** → `POST /api/upload` (multipart `file`) → returns `{path}`.
   Photos are REQUIRED on booking. Display later via `GET /api/files/{path}` (send Bearer).
3. **Create booking** → `POST /api/bookings` with the quote data + `photos:[path,...]` +
   customer details. Returns the booking with `booking_id`.
4. **Get instant offers** → `GET /api/bookings/{booking_id}/instant-offers`
   Returns nearby drivers with a fixed price each (cheapest/closest tagged).
   - (Optional) broaden to bidding: `POST /api/bookings/{booking_id}/broadcast`,
     then read `GET /api/bookings/{booking_id}/bids`.
5. **Choose driver + pay** → `POST /api/bookings/{booking_id}/select-driver`
   Body: `{driver_id, payment_type, source_id}`
   - `payment_type` = `"deposit"` (15%) or `"full"` — **the customer must actively choose;
     there is no default.**
   - `source_id` = Square card/wallet nonce from the Square Web/React Native SDK.
6. **Track** → `GET /api/bookings/{booking_id}/track` (status, driver position, ETA).
7. **Chat with driver** → `GET` / `POST /api/bookings/{booking_id}/messages?driver_id=<id>`.
   Contact details (phone/email/postcode) are auto-masked before acceptance.
8. **Manage** → `GET /api/bookings` (list), `POST .../cancel`, `POST .../change-driver`.
9. **Invoice** → built on the client from the paid booking data (PDF via jspdf on web;
   on mobile render your own invoice screen from the booking's `payment` object).

### Payment settlement wording to show the customer
- **Deposit paid (15%):** "You paid £X. Remaining £Y is payable to the driver on moving day
  by cash or bank transfer."
- **Paid in full by card:** nothing to pay on the day.

---

## 6. Driver Hub workflow (endpoints in order)
Bottom tabs: **Quotation · Accepted · Message · Settings**.

- **Profile / approval** → `GET /api/driver/profile` (status `pending`/`approved`,
  `blocked_until`). Set pricing `POST /api/driver/pricing`; docs `POST /api/driver/documents`.
- **Availability** → `POST /api/driver/availability` `{available: true|false}`.
- **Open jobs (Quotation tab)** → `GET /api/driver/available`
  Returns two kinds of jobs; check the `fixed_price` flag on each:
  - **INSTANT / FIXED-PRICE job** (`fixed_price: true`, usually `urgent: true`):
    - Driver **cannot bid**. Show the driver's earnings as the price (field `your_earnings`).
    - Actions: **Accept** (`POST /api/driver/jobs/{id}/accept`),
      **Cancel/decline** (`POST /api/driver/jobs/{id}/decline` → hides it for this driver only),
      **Message** (chat endpoints).
  - **BIDDING job** (`fixed_price` falsy):
    - Driver enters their own quote. **Minimum bid is £50** (backend rejects `< 50`).
    - Submit: `POST /api/driver/jobs/{id}/bid` `{price}` (max 2 quotes per job).
    - Withdraw: `POST /api/driver/jobs/{id}/withdraw` (re-quote once more, 2 max).
    - Message: chat endpoints.
- **Quotation-accepted / waiting** → `GET /api/driver/requests` (your live quotes awaiting
  the customer's decision).
- **Accepted tab** → `GET /api/driver/jobs` (your assigned jobs).
  - ⏱ **30-minute confirmation (instant jobs):** when a customer picks this driver and pays,
    the job appears with `awaiting_driver_accept: true` and an `accept_deadline`.
    The driver MUST confirm within 30 min → `POST /api/driver/jobs/{id}/confirm`.
    If not confirmed in time, the platform auto-releases it back to the Quotation market as a
    fixed-price job for other drivers (the customer's payment carries over).
    → Show a prominent "Confirm within 30 minutes" banner + Confirm button.
  - Update job progress → `POST /api/driver/jobs/{id}/status`
    (`en_route_pickup` → `loading` → `in_transit` → `completed`).
  - Cancel an assigned job → `POST /api/driver/jobs/{id}/cancel` (penalties apply if a
    deposit was paid; job re-lists as an urgent fixed-price re-offer).
- **Message tab** → `GET /api/driver/conversations`, then the booking `messages` endpoints.
- **Notifications** → `GET /api/driver/notifications`, `POST /api/driver/notifications/read`.

### Money shown to drivers
- Company commission is **15%**; the driver keeps **85%**.
- On fixed-price / re-offered jobs, show **`your_earnings`** (the 85% net), NOT the full
  customer price. Example: customer paid £50 → driver sees **£42.50**.
- Settlement guidance on a job (fields `payment_type`, `balance_due`, `your_earnings`):
  - `payment_type == "deposit"` → "Collect £`balance_due` from the customer (cash/bank) when
    you finish the job."
  - `payment_type == "full"` → "Customer paid in full. Man With Van pays your earnings
    (£`your_earnings`) after you complete the job."

---

## 7. Photos / files on mobile (important)
- Upload: `POST /api/upload` multipart → `{path}`.
- Display: `GET /api/files/{path}`. This endpoint is **protected**. A plain `<Image src>`
  cannot send the `Authorization` header, so on mobile either:
  - fetch the bytes with the Bearer header and show from a local/base64 source, **or**
  - append the token as a query param: `GET /api/files/{path}?auth=<token>` (backend supports
    `?auth=`). Do NOT log or expose the token anywhere else.

---

## 8. Full endpoint index
**Auth/account:** `/api/auth/register`, `/api/auth/driver-register`, `/api/auth/login`,
`/api/auth/session`, `/api/auth/logout`, `/api/auth/me`, `/api/account/notifications`,
`/api/referral/me`
**Catalog/quote:** `/api/vansizes`, `/api/pricing-bounds`, `/api/promo/{code}`, `/api/quote`,
`/api/address/suggest`, `/api/upload`, `/api/files/{path}`
**Customer bookings:** `/api/bookings` (POST create, GET list), `/api/bookings/{id}` (GET),
`/api/bookings/{id}/instant-offers`, `/api/bookings/{id}/broadcast`, `/api/bookings/{id}/bids`,
`/api/bookings/{id}/select-driver`, `/api/bookings/{id}/cancel`, `/api/bookings/{id}/change-driver`,
`/api/bookings/{id}/track`, `/api/bookings/{id}/messages` (GET/POST)
**Driver:** `/api/driver/profile`, `/api/driver/pricing`, `/api/driver/documents`,
`/api/driver/jobs` (GET), `/api/driver/available`, `/api/driver/requests`,
`/api/driver/conversations`, `/api/driver/availability`,
`/api/driver/jobs/{id}/bid`, `/api/driver/jobs/{id}/withdraw`, `/api/driver/jobs/{id}/decline`,
`/api/driver/jobs/{id}/accept`, `/api/driver/jobs/{id}/confirm`, `/api/driver/jobs/{id}/status`,
`/api/driver/jobs/{id}/cancel`, `/api/driver/notifications`, `/api/driver/notifications/read`
**Admin (web only):** `/api/admin/stats`, `/api/admin/bookings`, `/api/admin/drivers` (GET/POST),
`/api/admin/drivers/{id}/approve`, `/api/admin/drivers/{id}` (PUT),
`/api/admin/bookings/{id}/assign`, `/api/admin/bookings/{id}/status`,
`/api/admin/bookings/{id}/refund`
**Internal (do NOT call from the app):** `/api/cron/release-unaccepted` (platform scheduler only).

---

## 9. Store identity (reuse EXACTLY — preserves reviews/ratings)
- iOS bundle id: `com.base6a789f0035d4228147cfc5c9.app`
- Android applicationId / package: `com.base6a789f0035d4228147cfc5c9.app`
- Reuse the same signing/upload key. Reusing this exact ID ships as an UPDATE to the
  existing store listings and keeps reviews, ratings and users.
