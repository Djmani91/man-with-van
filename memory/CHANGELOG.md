
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
