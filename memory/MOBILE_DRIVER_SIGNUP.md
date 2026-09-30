# Mobile — Driver signup with 4 photos (React Native / Expo)

Paste this into your Emergent Mobile App project. It creates a driver, then
uploads the 4 photos (profile, van, licence, insurance) to the SAME backend,
so they appear on the website and in the admin panel automatically.

## 0. One-time setup
```
npx expo install expo-image-picker
```

## 1. config.js  (point at your DEPLOYED backend)
```js
export const API_BASE = "https://YOUR-DEPLOYED-URL/api"; // e.g. https://your-app.emergent.host/api
```

## 2. api.js  (token helper — reuse across the app)
```js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./config";

export async function apiPost(path, body, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${await AsyncStorage.getItem("token")}`;
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

// Upload one image (React Native FormData needs {uri, name, type})
export async function uploadImage(asset) {
  const token = await AsyncStorage.getItem("token");
  const name = asset.fileName || `photo_${Date.now()}.jpg`;
  const type = asset.mimeType || "image/jpeg";
  const fd = new FormData();
  fd.append("file", { uri: asset.uri, name, type });
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // DO NOT set Content-Type; RN sets the multipart boundary
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Upload failed");
  return data.path; // storage path to save on the profile
}
```

## 3. DriverSignupScreen.js
```jsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost, uploadImage } from "./api";

const PHOTO_FIELDS = [
  { key: "profile_photo", label: "Profile photo" },
  { key: "van_photo",     label: "Van photo" },
  { key: "licence_photo", label: "Driving licence" },
  { key: "insurance_photo", label: "Insurance" },
];

export default function DriverSignupScreen({ navigation }) {
  const [f, setF] = useState({
    name: "", email: "", phone: "", password: "", vehicle: "",
    licence_no: "", insurance_no: "", mot_expiry: "", home_postcode: "", address: "",
    rate_small: "35", rate_medium: "40", rate_large: "45", rate_xl: "50", stairs_fee: "5", helper_rate: "15",
  });
  const [photos, setPhotos] = useState({});   // { profile_photo: asset, ... }
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const pick = async (key) => {
    // ask camera OR library — here we use the library; swap for launchCameraAsync to force the camera
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to upload.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) setPhotos((p) => ({ ...p, [key]: res.assets[0] }));
  };

  const submit = async () => {
    // basic validation
    for (const r of ["name","email","phone","password","vehicle","home_postcode","licence_no","insurance_no"])
      if (!f[r].trim()) return Alert.alert("Missing info", "Please fill all required fields.");
    for (const p of PHOTO_FIELDS)
      if (!photos[p.key]) return Alert.alert("Missing photo", `Please add: ${p.label}`);

    setBusy(true);
    try {
      const n = (v, d) => (isNaN(Number(v)) ? d : Number(v));
      // 1) create the driver account (returns token)
      const data = await apiPost("/auth/driver-register", {
        name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password,
        vehicle: f.vehicle.trim(), licence_no: f.licence_no.trim(), insurance_no: f.insurance_no.trim(),
        mot_expiry: f.mot_expiry || null, home_postcode: f.home_postcode.trim(), address: f.address.trim(),
        pricing: {
          rates: { small: n(f.rate_small,35), medium: n(f.rate_medium,40), large: n(f.rate_large,45), xl: n(f.rate_xl,50) },
          stairs_fee: n(f.stairs_fee,5), helper_rate: n(f.helper_rate,15),
        },
      });
      await AsyncStorage.setItem("token", data.token); // store token for authed calls

      // 2) upload the 4 photos, then 3) save them on the profile
      const docs = {};
      for (const p of PHOTO_FIELDS) docs[p.key] = await uploadImage(photos[p.key]);
      await apiPost("/driver/documents", docs, true);

      Alert.alert("Submitted", "Application received — awaiting approval.");
      navigation.replace("DriverHub");
    } catch (e) {
      Alert.alert("Could not submit", e.message);
    } finally { setBusy(false); }
  };

  const Field = ({ k, ph, kb }) => (
    <TextInput placeholder={ph} value={f[k]} onChangeText={set(k)} keyboardType={kb}
      secureTextEntry={k === "password"} autoCapitalize={k === "email" ? "none" : "sentences"}
      style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 10 }} />
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>Drive with us</Text>
      <Field k="name" ph="Full name" />
      <Field k="phone" ph="Phone" kb="phone-pad" />
      <Field k="email" ph="Email" kb="email-address" />
      <Field k="password" ph="Password (min 6)" />
      <Field k="vehicle" ph="Vehicle (e.g. Large Luton — AB12 CDE)" />
      <Field k="home_postcode" ph="Home base postcode" />
      <Field k="address" ph="Home address (optional)" />
      <Field k="licence_no" ph="Licence number" />
      <Field k="insurance_no" ph="Insurance policy no." />

      <Text style={{ fontWeight: "600", marginTop: 8, marginBottom: 6 }}>Hourly rates</Text>
      <Field k="rate_small" ph="Small (35–45)" kb="numeric" />
      <Field k="rate_medium" ph="Medium (40–50)" kb="numeric" />
      <Field k="rate_large" ph="Large (45–55)" kb="numeric" />
      <Field k="rate_xl" ph="Luton XL (50–60)" kb="numeric" />
      <Field k="stairs_fee" ph="Stairs/floor (5–15)" kb="numeric" />
      <Field k="helper_rate" ph="Helper/hr (15–25)" kb="numeric" />

      <Text style={{ fontWeight: "600", marginTop: 8, marginBottom: 6 }}>Upload documents (all required)</Text>
      {PHOTO_FIELDS.map((p) => (
        <TouchableOpacity key={p.key} onPress={() => pick(p.key)}
          style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderStyle: "dashed",
                   borderColor: "#c4b5fd", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          {photos[p.key]
            ? <Image source={{ uri: photos[p.key].uri }} style={{ width: 44, height: 44, borderRadius: 8 }} />
            : <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "#ede9fe" }} />}
          <Text style={{ marginLeft: 12 }}>{photos[p.key] ? `${p.label} ✓` : `Add ${p.label}`}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity disabled={busy} onPress={submit}
        style={{ backgroundColor: "#6d28d9", padding: 15, borderRadius: 12, alignItems: "center", marginTop: 8 }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>{busy ? "Submitting…" : "Submit application"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

## Notes
- The 4 photo keys MUST be exactly: `profile_photo`, `van_photo`, `licence_photo`, `insurance_photo`.
- For uploads in React Native, DO NOT set the `Content-Type` header manually — RN adds the multipart boundary itself.
- Everything saves to the same backend + database, so the driver + photos appear on the website and admin (docs 4/4) automatically.
- To force the camera instead of the gallery, use `ImagePicker.launchCameraAsync(...)` with `requestCameraPermissionsAsync()`.
