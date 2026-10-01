# Paste this into your mobile-app-kit project

IMPORTANT: This is a mobile APP, not a website. NO landing page, NO marketing/SEO
pages (no Home, Areas, Services, Pricing, FAQ). The app opens on a Login screen.
After login: customers see only the booking app (Book, My Jobs, Account); drivers
see only the Driver Hub (Quotation, Accepted, Message, Settings).

Build my "Man With Van" mobile app. I already have the complete React Native /
Expo source code (in the /app/mobile_app folder of my website project) — use it
exactly as-is, don't redesign it.

1. USE MY CODE: I'm providing a full Expo app (screens, API client, auth, Driver
   Hub, booking flow). Import these files exactly and keep the same design, layout
   and flows — do NOT change the structure or features:
   - App.js, src/config.js, src/api.js, src/auth.js, src/theme.js, src/ui.js,
     src/navigation.js, src/payments.js
   - src/screens/: LoginScreen, RegisterScreen, AccountScreen, BookingScreen,
     OffersScreen, MyJobsScreen, ChatScreen, DriverHubScreen

2. CONNECT TO MY EXISTING BACKEND (do NOT build a new backend, do NOT touch
   MongoDB directly): Set API_BASE in src/config.js to my deployed backend URL:
   https://manwithvanapp.co.uk  (my custom domain; it serves the same backend).
   All endpoints are prefixed with /api. Auth uses a
   Bearer token returned by /api/auth/login and /api/auth/register — store it and
   send Authorization: Bearer <token> on every request. The backend already
   supports this; no backend changes.

3. KEEP THE SAME DESIGN AS MY WEBSITE: brand purple #5B21B6, same card style, the
   single-scroll booking form (Ground/Stairs/Lift access, 15%-deposit vs
   pay-in-full with NO default), and the Driver Hub with 4 bottom tabs —
   Quotation, Accepted, Message, Settings — including: fixed-price jobs show the
   driver's earnings (not the full customer price) with Accept/Cancel/Message,
   bidding jobs enforce a £50 minimum, and instant jobs must be confirmed within
   30 minutes.

4. APP IDENTITY (reuse EXACTLY — keeps my store reviews/ratings): iOS
   bundleIdentifier and Android package = com.base6a789f0035d4228147cfc5c9.app.
   Reuse the same signing/upload key.

5. ONE THING TO WIRE: card payments use Square — install
   react-native-square-in-app-payments and complete tokenizeCard() in
   src/payments.js to return the card nonce (sent to
   /api/bookings/{id}/select-driver as source_id). Everything else is ready.

Then run it with `npx expo start` and prepare it for Play Store + App Store
publishing.
