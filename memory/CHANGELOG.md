
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

## 2026-06 — Driver job-detail view (matches mobile app) + congestion fee
- Congestion fee: £15 auto-added to hourly-rate quotes (website estimate + instant offers +
  office/admin assign). Excluded from custom bids (bidders set own price) and the bidding
  "suggested price". compute_quote returns congestion_fee; wizard shows "Includes £15..." line.
- New DriverJobDetail.jsx: full-screen job detail opened when a driver taps a job — DATE AND TIME
  (amber), postcode-only pickup/dropoff chips (green/purple dots) with "Full address revealed
  after deposit payment", Google Maps Embed route (REACT_APP_GMAPS_KEY), duration+distance chips,
  customer budget (bidding) / earnings breakdown (Customer pays / Your earnings = 85%), crew
  required box, pickup/dropoff floor lines, amber "Important requirement" stairs warning,
  customer item photos & notes, and quote/status/message actions.
- Backend driver_job_view(): postcode extraction, address hidden until deposit paid
  (deposit_paid), your_earnings = price*0.85, commission_rate=0.15. Applied to
  /driver/available, /driver/requests, /driver/jobs. COMMISSION_RATE=0.15.
- Verified: iteration_14 100% backend+frontend (pytest 2/2 + full UI flow).

## 2026-06 — Driver cancel + escalating penalty + fixed-price re-offer
- Driver can cancel any job. POST /api/driver/jobs/{id}/cancel:
  - If customer had PAID: escalating penalty — 1st = warning, 2nd = blocked 24h, 3rd+ = blocked 48h
    (driver_profiles.penalty_cancels + blocked_until). _require_approved_driver blocks jobs while blocked_until is in future.
  - If unpaid: free cancel, no penalty.
  - Frontend: confirm() warning before cancelling a paid job; toast shows the penalty message; red "Temporarily blocked" banner on dashboard.
- Cancelled job goes back to marketplace as FIXED PRICE (mode="fixed", price kept from the cancelling driver's agreed price). No bidding. First-come-first-served.
  - /driver/available now also returns fixed jobs within 30 mi (FIXED_RADIUS_MI), flagged fixed_price=True, shown first (priority).
  - POST /api/driver/jobs/{id}/accept: atomic first-come claim; payment carries over (no new charge); whoever accepts first wins, others get "just been taken".
  - Driver UI: fixed jobs show an "Accept job (£earnings)" button instead of a bid input; detail view shows "Fixed price" priority badge + Accept.
- Verified via curl: cancel escalation 1/2/3 (warning/24h/48h), cancel→fixed conversion, B sees fixed £60 (earns £51, 30mi), B accepts, A gets "taken".

## 2026-06 — Booking form mandatory fields + reference-match driver detail
- DriverJobDetail.jsx: matched user reference screenshots — heading renamed "Notes & photo"; accept-job screen now shows full "Earnings breakdown — Customer pays / Your earnings" block above Accept/Decline (Accept styled primary/purple).
- BookingWizard.jsx: ALL customer booking fields now mandatory — "What are we moving?" items list, at least ONE photo, and Notes are required (Continue/Confirm disabled until filled). Addresses/date/time/van/name/phone already required.
- Sign-in / register now happens at the END via an inline modal (booking-auth-modal) inside the wizard — no navigation away — so uploaded photos are NOT lost. Guests fill everything (photos held locally as File objects), then register/login in the modal; on success photos upload and booking is created, navigates to /jobs.
- Verified: iteration_15.json — 100% backend + frontend. Photos confirmed persisted (non-empty) after sign-in-at-end. Logged-in customers skip the modal.

## 2026-06 — Remove estimated price + force floor/access choice
- BookingWizard.jsx: REMOVED the live "estimated price" block entirely (and the /quote fetch effect) — no price is shown anywhere in the booking wizard.
- Floors & access step now requires ACTIVE selection: floor defaults changed to blank/null; FloorPicker shows "Select floor" placeholder + "Lift available"/"Stairs only" buttons (no default). Continue stays disabled until pickup floor + pickup access + dropoff floor + dropoff access are all chosen.
- Verified iteration_16.json (frontend 100%): no wizard-price/wizard-total at any step; floor gating enforced (disabled until all 4 chosen); booking creates and persists pickup_floor/dropoff_floor/pickup_lift/dropoff_lift correctly.
- Note (out of scope): testing agent observed GET /api/bookings may return id=null for latest booking; downstream uses booking_id so not blocking.

## 2026-06 — Ground/Stairs/Lift access selector (mobile-reference match)
- BookingWizard Floors step redesigned to match user's mobile screenshot: 3-button access selector per address (Ground | Stairs | Lift), solid purple when selected. Floor dropdown ("Which floor?" 1st/2nd/3rd+) appears ONLY when Stairs is chosen.
- Added pickup_access/dropoff_access form state; setAccess() maps: ground->floor0/lift false, lift->floor0/lift true, stairs->lift false + chosen floor. Backend ignores the extra access fields and persists floor/lift.
- Gating: Continue disabled until both addresses have access chosen (+ a floor if Stairs).
- Verified iteration_17.json (frontend 100%): selectors, conditional floor, gating combos, and persistence (Lift->floor0/lift true, Stairs 3rd+->floor3/lift false) all correct.

## 2026-06 — Driver Hub bottom-nav redesign + quotation cards + customer deposit choice
- Driver Hub (DriverDashboard.jsx): replaced TOP tabs with a fixed BOTTOM nav (Quotation, Accepted, Message, Settings). 'Waiting' removed from the bar.
- Quotation tab now has two sub-tabs: 'Quotation' (open jobs) and 'Quotation accepted' (submitted quotes awaiting customer = old Waiting). Added a day filter (All + next 7 days) that filters jobs by date.
- New Message tab lists all job conversations (accepted jobs); tapping opens the chat.
- Quotation job cards: big date badge ("FRI 04" weekday+day); removed inline bid input / accept buttons — driver now quotes/accepts ONLY from inside the job detail. Removed 'Suggested from your rates' hint and suggested-price prefill (driver decides their own price; DriverJobDetail quote input starts empty).
- Customer payment (MyJobs.jsx): deposit choice ('15% deposit' vs 'Pay in full') is NO LONGER pre-selected; every driver Accept button is disabled ('Choose payment first') until the customer picks a payment option.
- Verified iteration_18.json (nav/sub-tabs/day filter/message/deposit gating, 100%) and iteration_19.json (date badge, no inline controls, quote/accept from detail, 100%).
- Known: Google Maps embed in driver detail shows key-not-authorized error in preview (needs Maps Embed API enabled + referrer allowance for the domain).

## 2026-06 — Pre-acceptance customer↔driver chat with contact masking
- The offer 'Message' button on instant quotes / bidding is now ENABLED — customers can message a driver BEFORE accepting/paying.
- Chat is per (booking_id, driver_id): customer passes ?driver_id, driver's own id is inferred. Separate thread per offered driver. Backend: _chat_thread + _thread_query (legacy no-driver_id messages still surface in the assigned driver's thread). New GET /api/driver/conversations powers the Driver Hub Message tab (shows pre-acceptance chats too, not just assigned jobs).
- mask_message() now also redacts UK postcodes → '[address hidden]' (phone/email already → '[contact hidden]'). Contact info is always hidden so parties stay on-platform.
- Frontend: ChatModal takes driverId prop (appends ?driver_id); MyJobs chat state is {bookingId, driverId}; DriverDashboard Message tab renders /driver/conversations.
- Verified iteration_20.json: 100% backend + frontend; masking, per-driver threads, driver pre-acceptance conversations, round-trip replies, and legacy assigned-job history all pass.

## 2026-06 — Mobile single-page booking form (web keeps wizard)
- BookingWizard.jsx: on mobile (<640px) the booking form is now ONE scrolling page (all sections stacked, no Continue/Back, single mobile-confirm gated by allValid). Desktop (>=640px) keeps the step-by-step wizard. Detected via matchMedia; Section gains hideNum for mobile.
- Time selection changed from native time input to a dropdown (Select) of hourly slots 8:00 AM–6:00 PM ("Pick a time").
- Removed the "from £X/hr" price line from van cards.
- Section titles: "When do you need the van?" and "Which van do you need?"; added coverage note under addresses ("within 20 miles of London, Oxford, Birmingham, Manchester, Liverpool, or Blackpool…").
- Verified iteration_21.json (frontend 100%): mobile single-page + desktop wizard both correct; end-to-end mobile booking created.

## 2026-06 — Fix: customer photos not showing on driver side
- Root cause: GET /api/files/{path} only authenticated via Authorization: Bearer header or ?auth= query param. An <img src> tag can send neither, so driver-side photo requests returned 401 and images never rendered.
- Fix: /files now also reads the session_token cookie (falls back to Bearer header, then ?auth=). Web <img> requests now load (cookie sent automatically); still 401 without any auth.
- Verified via curl: with cookie -> HTTP 200 image/png; no auth -> 401. driver_job_view already includes `photos` for assigned + available/instant jobs.
