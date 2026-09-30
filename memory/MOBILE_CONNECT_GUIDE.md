# How to Connect Your Emergent Mobile App to This Backend

Your mobile app and website share ONE backend and ONE database:

    Mobile app  ─┐
                 ├──►  THIS project's deployed API (/api)  ──►  MongoDB
    Website     ─┘

Same users, jobs, drivers, messages — everywhere. The mobile app NEVER
connects to MongoDB directly. It only calls the API over HTTPS.

---

## STEP 1 — Get your deployed backend URL
1. Deploy THIS web project (Deploy button). Wait until it says "Live".
2. Copy the live URL, e.g. `https://your-app.emergent.host`
3. Your API base is that URL + `/api`
   → `https://your-app.emergent.host/api`

(While testing before deploy you may use the preview URL, but it is
temporary. The mobile app must point at the DEPLOYED URL.)

## STEP 2 — In your separate Emergent Mobile App project
Create ONE config file and put the base URL there:

```js
// config.js
export const API_BASE = "https://your-app.emergent.host/api";
```

Do NOT hardcode the URL anywhere else — always import from here.

## STEP 3 — Log in and store the token
Login/Register return a `token` in the response body. Save it on the
device (e.g. AsyncStorage / SecureStore) and send it as a Bearer header
on every authenticated request.

```js
import { API_BASE } from "./config";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();      // { user_id, email, name, role, token }
  await AsyncStorage.setItem("token", data.token);
  return data;
}
```

## STEP 4 — Call any protected endpoint with the token
```js
export async function apiGet(path) {
  const token = await AsyncStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  return res.json();
}

// examples
const me       = await apiGet("/auth/me");
const myJobs   = await apiGet("/bookings");
```

## STEP 5 — Test it
- Register a user in the mobile app → then log into the WEBSITE with the
  same email/password. You should see the same account. That proves both
  surfaces share the backend and database.

---

## Key endpoints for the mobile app
(all prefixed with `/api`, all authenticated ones need the Bearer header)

Auth:
- POST /auth/register            {name,email,phone,password}      → returns token
- POST /auth/login               {email,password}                 → returns token
- POST /auth/driver-register     {name,email,phone,password,...}  → returns token
- GET  /auth/me                                                   (Bearer)

Customer:
- GET  /vansizes
- POST /quote
- GET  /address/suggest?q=
- POST /bookings                                                  (Bearer)
- GET  /bookings                                                  (Bearer)
- GET  /bookings/{id}                                             (Bearer)
- GET  /bookings/{id}/instant-offers                              (Bearer)
- POST /bookings/{id}/broadcast                                   (Bearer)
- GET  /bookings/{id}/bids                                        (Bearer)
- POST /bookings/{id}/select-driver                               (Bearer)
- GET  /bookings/{id}/track                                       (Bearer)
- GET  /bookings/{id}/messages                                    (Bearer)
- POST /bookings/{id}/messages                                    (Bearer)

Driver / Admin: same pattern, all under /api, all Bearer-protected.

---

## Notes
- The website uses a cookie for the same session; the mobile app uses the
  Bearer token. Both work against the same backend at the same time.
- Google login on mobile is a native flow and is a separate later task.
- Point the mobile app at the DEPLOYED URL only — never the preview URL,
  and never directly at MongoDB.
