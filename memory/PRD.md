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

## Update 2026-06 (fork) — Real Square payments + London SEO area pages + mobile bearer token
- REAL PAYMENTS LIVE: Square integrated (squareup SDK, production). Backend /bookings/{id}/select-driver now charges the card via Square (deposit 15% or full) BEFORE assigning the driver; amount computed server-side; real Square payment id stored as transaction_id, provider="square". Frontend: SquarePaymentModal.jsx (Web Payments SDK, tokenize → source_id). Env: backend SQUARE_ENV/SQUARE_ACCESS_TOKEN/SQUARE_LOCATION_ID; frontend REACT_APP_SQUARE_ENV/APPLICATION_ID/LOCATION_ID. Square location = "Man with van" (L2G3MNWF2ZD8F, GBP, production ACTIVE). Payment flow NOT yet tested with a live charge by user.
- Mobile-friendly auth: /auth/register, /auth/driver-register, /auth/login, /auth/session now also return "token" in the JSON body (website still uses cookie). Bearer auth via Authorization header verified. Guide at /app/memory/MOBILE_CONNECT_GUIDE.md (Way A: separate Emergent Mobile App → this deployed backend → MongoDB).
- SEO London area pages: /man-and-van (index) + /man-and-van/:slug for 16 areas (Kilburn, Central London, Harrow, Camden, Islington, Hackney, Wembley, Brent, Ealing, Willesden, Cricklewood, Hampstead, Finchley, Wood Green, Stratford, Croydon). Data in src/data/areas.js; pages AreaLanding.jsx + Areas.jsx. Each: unique H1/H2/H3, long local copy, local FAQ (answer-optimised for ChatGPT/Gemini), nearby-area internal links, embedded BookingWizard. Seo.jsx extended with JSON-LD (LocalBusiness + Service + FAQPage + BreadcrumbList) + keywords + OG/twitter. public/sitemap.xml (19 urls) + public/robots.txt added. Navbar "Areas" → /man-and-van; Footer + Home link to area pages.
- KNOWN SEO LIMITATION: app is CRA client-rendered — meta/JSON-LD injected via react-helmet after JS runs. Googlebot renders JS, but prerendering/SSR would help AI crawlers (ChatGPT/Gemini) and is the top SEO enhancement. sitemap/robots use the preview domain; regenerate for the live domain after deploy.

## Update 2026-06 (fork) — Student discount page + nav
- Dedicated SEO/AI page at /student-discount (StudentDiscountPage.jsx): H1 "Student man & van — 10% off", code box (STUDENT10) with copy + "Apply & book", embedded BookingWizard (id="book"), benefit cards, how-it-works, "student moves we do", and a 12-question FAQ. JSON-LD: Service + Offer + FAQPage + BreadcrumbList. Keyword-rich for AI (ChatGPT/Gemini) + Google: "man with a van", "cheap van with man", "van with man near me", "student man and van", "student removals", STUDENT10, halls/house-share moves.
- Navbar: added "Student Discount" link (Areas / Services / How it works / Pricing / Student Discount / Reviews / FAQ).
- Homepage StudentDiscount widget now links to /student-discount ("See student offer & FAQs").
- Sitemap updated to 20 URLs (added /student-discount). BookingWizard: clears saved promo from localStorage when the field is emptied (review fix). STUDENT10 promo feature tested 100% in iteration_5 (7/7 backend + all frontend flows).
