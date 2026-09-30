# Man With Van — Product Requirements & Progress

## Original Problem Statement
Moving/removals booking platform. Customers get an instant quote, book a local van + driver, (pay online — deferred), and track the move live. One shared backend powers the website and a future mobile app. Also a lightweight admin/dispatch web screen.

## Scope decisions (v1)
- Web platform + FastAPI backend only. React Native mobile app cannot be compiled/previewed in this environment (deferred — backend is reusable).
- Payments: SKIPPED for v1 (user chose Square, which isn't first-class; deferred, no payment taken at booking).
- Email: Resend (Emergent-managed) transactional confirmations only.
- SMS: not included (email-only chosen).
- Maps/tracking: SIMULATED live tracking + manual address entry (no external maps key).
- Auth: JWT email+password AND Emergent-managed Google OAuth (both set httpOnly session_token cookie).
- Region: any UK, GBP, English.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`, `emails.py`), MongoDB (motor). All routes under `/api`.
- Auth: DB-backed sessions (sessions collection), bcrypt password hashing, admin seeded on startup.
- Quote engine: 4 van sizes, deterministic pseudo-distance from postcodes, weekend/peak surcharges.
- Tracking: deterministic pseudo coords + driver position interpolated along route by status.
- Frontend: React (CRA) + Tailwind + shadcn/ui + framer-motion. AuthContext + ProtectedRoute.
- Pages: Home, Login, Register, Book (4-step wizard), Account, Track (live), Admin (dispatch), AuthCallback.

## User Personas
- Customer: books moves, tracks live, views history (web + future app).
- Dispatch/Admin: views all bookings, adds drivers, assigns drivers, updates job status.

## Core Requirements (static)
- Instant quote (van size, distance, date/time)
- Multi-step booking flow with date/time
- Live move tracking (driver location + status timeline)
- Booking history + account
- Email confirmations
- Admin/dispatch: view bookings, assign drivers, update job status

## Implemented (2026-06-29)
- Full auth (email/password + Google OAuth), admin seeding, role gating
- Quote engine + van sizes API
- Booking creation with confirmation email (Resend managed)
- Customer account + booking history
- Simulated live tracking page (map, timeline, ETA, 5s polling)
- Admin dispatch dashboard: stats, bookings table, add/assign drivers, status updates + status-change email
- 100% pass on backend (14 pytest) + frontend e2e testing

## Backlog / Remaining
- P1: Real payments (Stripe recommended) — quote already computed; add checkout + receipt
- P1: Real maps/geocoding + real GPS tracking (Google Maps key) to replace simulation
- P2: SMS notifications (Twilio)
- P2: React Native mobile app (iOS + Android) reusing this API
- P2: Cancellations/refunds window, no-driver-available waitlist flow, brute-force login lockout
- P2: Address autocomplete / postcode lookup

## Next tasks
- Confirm payments provider and wire checkout
- Decide edge-case policies (cancellation window, no-driver-available handling)

## Mobile app store identifiers (for future React Native build — NOT used by the web app)
- SINGLE shared identifier, used VERBATIM on BOTH platforms (no prefix/suffix/module name appended):
  com.base6a789f0035d4228147cfc5c9.app
  - iOS bundle identifier (Xcode Target > Bundle Identifier; App Store Connect App ID): com.base6a789f0035d4228147cfc5c9.app
  - Android applicationId / package name (app/build.gradle): com.base6a789f0035d4228147cfc5c9.app
- CRITICAL: user already has LIVE apps on the App Store and Google Play under this exact ID. Reuse it exactly so it ships as an UPDATE and preserves reviews, ratings, ranking and existing users. Do NOT create a new/renamed identifier.

## Marketplace layer status (iteration_3 — 100% backend 25/25 + frontend E2E passed)
- Customer app shell: bottom tabs Book/My Jobs/Messages/Account.
- Booking -> status 'quoting' -> choose Instant offers OR Bidding -> MOCK payment (15% deposit or full) -> assigned -> live track.
- Driver: home-base postcode, per-van hourly rates within bands, in-app + email job alerts, place bids, chat.
- Contact (phone/email) masked in chat and hidden until deposit paid. PAYMENTS ARE MOCKED (no real Stripe yet).
