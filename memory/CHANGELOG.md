
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
