# Man With Van — Mobile App (Expo / React Native)

This is the **native mobile app** (iOS + Android) for Man With Van. It talks to the
**same backend** as the website — one backend, one database, same accounts and data.
It does **NOT** connect to MongoDB directly; it only calls the HTTP API (`/api/...`).

It mirrors the website: customer booking + instant quotes + payment + tracking + chat,
and the Driver Hub (Quotation / Accepted / Message / Settings), including the new rules:
- Instant/fixed-price jobs show the driver's **earnings** (not the full customer price),
  with **Accept / Cancel / Message** (no bidding).
- Bidding jobs enforce a **£50 minimum** quote.
- Instant jobs the driver was chosen for must be **confirmed within 30 minutes**.
- Customer must actively choose **15% deposit** or **pay in full** (no default).

## 1. Point it at your backend
Open `src/config.js` and set `API_BASE` to your backend URL:
```js
export const API_BASE = "https://YOUR-BACKEND-URL"; // e.g. https://manwithvanapp.co.uk
```
(The preview URL is set by default for testing.)

## 2. Install & run
```bash
cd mobile_app
npx expo install        # install native deps for your Expo SDK
npx expo start          # press i (iOS simulator) or a (Android), or scan QR in Expo Go
```

## 3. One thing to wire for payments
Card payment uses Square. On mobile you tokenise the card with Square's native SDK:
```bash
npx expo install react-native-square-in-app-payments
```
Then fill in `src/payments.js` → `tokenizeCard()` to return the card **nonce**. That nonce
is sent to `POST /api/bookings/{id}/select-driver` as `source_id`. Everything else is ready.

## 4. Auth
- Login/register return a `token` in the response; it's stored with `expo-secure-store`
  and sent as `Authorization: Bearer <token>` on every request (see `src/api.js`).
- No backend change is required — the backend already supports Bearer auth.

## 5. Store identity (reuse EXACTLY to keep reviews/ratings)
Already set in `app.json`:
- iOS `bundleIdentifier` / Android `package`: `com.base6a789f0035d4228147cfc5c9.app`
Reuse the same signing/upload key so a release ships as an UPDATE to your existing listings.

## 6. File map
```
App.js                      app root (auth + navigation)
app.json                    Expo config (name, bundle id, API_BASE)
src/config.js               backend URL (change this)
src/api.js                  fetch client + Bearer token + file/upload helpers
src/auth.js                 auth context (login/register/logout)
src/theme.js, src/ui.js     colours + shared Button/Field/Card/Chip
src/navigation.js           stacks + customer bottom tabs + driver stack
src/payments.js             Square card tokenisation (wire this up)
src/screens/
  LoginScreen, RegisterScreen, AccountScreen
  BookingScreen             single-scroll customer booking + quote
  OffersScreen              instant offers + 15%/full choice + pay + select driver
  MyJobsScreen              bookings list, payment/settlement notes, chat entry
  ChatScreen                contact-masked customer↔driver chat
  DriverHubScreen           Quotation / Accepted / Message / Settings + job detail modal
```

## 7. Notes
- Date uses a simple `YYYY-MM-DD` text field to avoid extra native deps; swap in a date
  picker (`@react-native-community/datetimepicker`) if you prefer.
- Protected images use `?auth=<token>` (see `api.fileUrl`) because `<Image>` can't send
  the Authorization header.
- This is a clean starting codebase generated to match the web app's API contract; refine
  styling/branding (add your `logo.png` to `assets/`) as you like.
