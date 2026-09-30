
## 2026-06 — "My moves" nav + Account email notification settings
- Navbar "My moves" menu now routes to /jobs (My Jobs) instead of /account.
- Account page: added "Email notifications" settings card with two toggles
  (Booking confirmations, Move status updates), saved to user.notify_prefs.
- Backend: PUT /api/account/notifications; /auth/me now returns notify_prefs.
  send_booking_confirmation and send_status_update are gated by the customer's prefs.
- Verified: backend curl E2E (default on, save, persist); frontend compiled clean.

## 2026-06 — Mobile horizontal-overflow fix (BookingWizard stepper)
- Bug: on phones, the hero badges, "Book your man & van" card, inputs and Continue
  button were cut off on the right. Root cause: stepper steps had min-w-[70px] x6,
  forcing the card ~440px wide and overflowing the viewport on all pages that embed
  the wizard (Home, /book, /student-discount, /man-and-van/:slug).
- Fix (BookingWizard.jsx): removed min-w-[70px] + overflow-x-auto; steps now flex-1
  min-w-0 (6 bars always fit); labels hidden on mobile with a single
  "Step X of N: <label>" line (data-testid wizard-step-label); wizard root w-full min-w-0.
- Verified by testing agent (iteration_12): scrollWidth==innerWidth==390 on all 4 pages,
  Continue button within viewport, desktop labels intact. 100% frontend pass.

## 2026-06 — Google addresses + instant-quote fix + booking-page nav
- Google Places (New) address autocomplete: backend proxy at GET /api/address/suggest now
  calls Google (UK-restricted) with the key kept server-side in GOOGLE_MAPS_API_KEY;
  falls back to mock list if key missing/error. Frontend unchanged (uses label).
  ACTION: add GOOGLE_MAPS_API_KEY to PRODUCTION secrets before redeploy.
- Instant-quotes bug: instant-offers returned empty whenever all drivers' simulated
  distances exceeded the 20mi cap (common when drivers have no home postcode). Now it
  always returns the closest up-to-5 available drivers (exact van, else larger-van
  fallback) so a cost always appears. Verified via curl (5 offers returned).
- Book page: for logged-in customers, /book hides the top navbar on mobile and shows
  the bottom nav (Book/My Jobs/Messages/Account); public visitors still see full navbar.

## 2026-06 — Real Google geocoding for distances & quotes
- geocode() now uses Google Places Text Search (New) (the Geocoding API was not authorized
  for the key; Places Text Search is, and returns accurate coords). Results cached in Mongo
  (geocache collection) to limit API calls.
- Booking creation geocodes pickup+dropoff -> stores real pickup_coords/dropoff_coords and a
  real journey distance (haversine) feeding compute_quote. Driver registration geocodes
  home_postcode -> real base_coords. driver_dist(profile,booking) = haversine(base_coords,
  pickup_coords), falling back to simulated for legacy records.
- Verified: Camden->Islington 1.7mi, London->Leeds 169mi; driver NW1 8NH -> real Camden coords.
- ACTION: GOOGLE_MAPS_API_KEY must be in PRODUCTION secrets for live geocoding/autocomplete.

## 2026-06 — Wallets, admin driver manage, driver photos, logout, congestion charge
- Payments: added Google Pay + Apple Pay buttons to SquarePaymentModal (auto-hide when
  wallet unavailable; card always works). Apple Pay needs Square domain registration +
  /.well-known association file before it appears. Payment labels reworded (removed
  "Nothing to pay on the day" -> "Pay the full amount now"; deposit -> "Pay the balance on the day").
- Booking wizard step 1: removed optional "Flat / house number & street" field.
- Admin: "Manage" button per driver -> dialog showing the 4 uploaded photos and editing
  name/phone/vehicle/van_size/postcode/rates/status/availability via PUT /api/admin/drivers/{id}.
- Driver Hub: job cards now show the customer's uploaded item photos.
- Account page: added "Log out" button (mobile customers had no logout).
- Congestion charge: bookings/quotes get congestion_charge=True when pickup or dropoff is in
  the Central London CCZ bounding box. Customer sees an amber note in MyJobs; driver sees a
  yellow warning on the job card. (Flag/warning only — not added to price.)
- Verified: iteration_13 (100% backend+frontend) for admin manage/logout/labels/flat-field;
  curl-verified congestion detection + admin driver update.

## 2026-06 — Telegram new-job alerts
- send_telegram_job_alert(booking) added; fires on every new booking in create_booking.
  Uses Telegram sendMessage (HTML), send-only, no webhook. No-op unless TELEGRAM_BOT_TOKEN
  and TELEGRAM_CHAT_ID are set; failures are caught and never break booking creation.
- Configured in preview .env: bot @Manwithvan2bot, personal chat (Rizwan, id 5811928111).
- Verified: direct sendMessage ok + booking-triggered alert delivered.
- ACTION: add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID to production (carried on next deploy).

## 2026-06 — Telegram payment alerts
- send_telegram_payment_alert(booking, payment) added; fires inside _assign_and_pay only when
  a real charge occurs (not on reassignment/already-paid). Shows deposit vs full, amount paid
  now, total, customer, driver. Send-only, failure-safe.
- Verified: sample payment alert delivered to chat 5811928111.
