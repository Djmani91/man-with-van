// --------------------------------------------------------------------------
// Square card tokenisation for mobile.
//
// On the WEB the app uses the Square Web Payments SDK to turn card details
// into a single-use token (source_id). On MOBILE you must use Square's
// native SDK to get the same token:
//
//   npx expo install react-native-square-in-app-payments
//
// Then replace the body of tokenizeCard() below with the SDK card-entry flow,
// e.g. SQIPCardEntry.startCardEntryFlow(...), and resolve with cardDetails.nonce.
//
// The resulting nonce/token is sent to POST /api/bookings/{id}/select-driver
// as `source_id`. The backend charges it via Square.
// --------------------------------------------------------------------------

export async function tokenizeCard() {
  // TODO: wire up react-native-square-in-app-payments and return the real nonce.
  throw new Error(
    "Card payment not wired yet. Install react-native-square-in-app-payments and return the card nonce from tokenizeCard() in src/payments.js."
  );
}
