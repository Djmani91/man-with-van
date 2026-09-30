
## 2026-06 — "My moves" nav + Account email notification settings
- Navbar "My moves" menu now routes to /jobs (My Jobs) instead of /account.
- Account page: added "Email notifications" settings card with two toggles
  (Booking confirmations, Move status updates), saved to user.notify_prefs.
- Backend: PUT /api/account/notifications; /auth/me now returns notify_prefs.
  send_booking_confirmation and send_status_update are gated by the customer's prefs.
- Verified: backend curl E2E (default on, save, persist); frontend compiled clean.
