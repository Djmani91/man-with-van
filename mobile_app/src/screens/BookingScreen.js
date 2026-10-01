import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { Button, Field, Card, Chip } from "../ui";
import { colors, radius } from "../theme";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const ACCESS = ["Ground", "Stairs", "Lift"];
const FLOORS = [
  { label: "1st", v: 1 },
  { label: "2nd", v: 2 },
  { label: "3rd+", v: 3 },
];

function AddressInput({ label, value, onPick }) {
  const [q, setQ] = useState(value || "");
  const [sugs, setSugs] = useState([]);
  useEffect(() => {
    let active = true;
    if (q.trim().length < 3) { setSugs([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/address/suggest?q=${encodeURIComponent(q.trim())}`);
        if (active) setSugs(Array.isArray(r) ? r.slice(0, 5) : []);
      } catch { if (active) setSugs([]); }
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [q]);
  return (
    <View>
      <Field label={label} value={q} onChangeText={setQ} placeholder="Type a postcode or street…" />
      {sugs.map((s, i) => (
        <TouchableOpacity key={i} onPress={() => { onPick(s.label); setQ(s.label); setSugs([]); }}
          style={{ padding: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.sm, marginBottom: 6 }}>
          <Text style={{ color: colors.slate700 }}>{s.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AccessPicker({ title, access, setAccess, floor, setFloor }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.slate600, marginBottom: 8 }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {ACCESS.map((a) => <Chip key={a} label={a} active={access === a} onPress={() => setAccess(a)} />)}
      </View>
      {access === "Stairs" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
          {FLOORS.map((f) => <Chip key={f.v} label={f.label} active={floor === f.v} onPress={() => setFloor(f.v)} />)}
        </View>
      )}
    </View>
  );
}

export default function BookingScreen({ navigation }) {
  const [vans, setVans] = useState([]);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pAccess, setPAccess] = useState(null); const [pFloor, setPFloor] = useState(1);
  const [dAccess, setDAccess] = useState(null); const [dFloor, setDFloor] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState(null);
  const [vanSize, setVanSize] = useState(null);
  const [crew, setCrew] = useState(null); // "me" | "helper"
  const [items, setItems] = useState("");
  const [photos, setPhotos] = useState([]); // local uris
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/vansizes").then(setVans).catch(() => {}); }, []);

  async function addPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to add item photos.");
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!res.canceled && res.assets?.[0]) setPhotos((p) => [...p, res.assets[0].uri]);
  }

  function floorFor(access, floor) {
    if (access === "Stairs") return { floor, lift: false };
    if (access === "Lift") return { floor: 1, lift: true };
    return { floor: 0, lift: true }; // Ground
  }

  async function submit() {
    if (!pickup || !dropoff) return Alert.alert("Addresses", "Please choose pickup and drop-off addresses.");
    if (!pAccess || !dAccess) return Alert.alert("Access", "Please select access for both addresses.");
    if (!date || !time) return Alert.alert("Date & time", "Please choose a date and time.");
    if (!vanSize) return Alert.alert("Van", "Please choose a van.");
    if (!crew) return Alert.alert("Crew", "Please choose who will help on the day.");
    if (!items.trim()) return Alert.alert("Items", "Please describe what you're moving.");
    if (photos.length === 0) return Alert.alert("Photos", "Please add at least one photo of your items.");
    if (!name || !phone) return Alert.alert("Your details", "Please add your name and phone.");

    setBusy(true);
    try {
      const uploaded = [];
      for (const uri of photos) {
        const u = await api.uploadPhoto(uri);
        uploaded.push(u.path);
      }
      const pf = floorFor(pAccess, pFloor);
      const df = floorFor(dAccess, dFloor);
      const booking = await api.post("/bookings", {
        pickup, dropoff, van_size: vanSize, date, time,
        pickup_floor: pf.floor, dropoff_floor: df.floor,
        pickup_lift: pf.lift, dropoff_lift: df.lift,
        needs_helper: crew === "helper",
        items: items.trim(), photos: uploaded,
        customer_name: name.trim(), customer_phone: phone.trim(),
      });
      navigation.navigate("Offers", { bookingId: booking.booking_id });
    } catch (e) {
      Alert.alert("Could not create booking", String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.slate100 }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 48 }}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: colors.slate900, marginBottom: 4 }}>Book your move</Text>
      <Text style={{ color: colors.slate500, marginBottom: 20 }}>One quick form — we'll show you nearby drivers.</Text>

      <Card style={{ marginBottom: 16 }}>
        <AddressInput label="Pickup address" value={pickup} onPick={setPickup} />
        <AddressInput label="Drop-off address" value={dropoff} onPick={setDropoff} />
        <Text style={{ color: colors.slate400, fontSize: 12 }}>Pickup must be within our coverage area. Drop-off can be anywhere in the UK.</Text>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <AccessPicker title="Pickup access" access={pAccess} setAccess={setPAccess} floor={pFloor} setFloor={setPFloor} />
        <AccessPicker title="Drop-off access" access={dAccess} setAccess={setDAccess} floor={dFloor} setFloor={setDFloor} />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-07-01" />
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.slate600, marginBottom: 8 }}>Time</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {TIMES.map((t) => <Chip key={t} label={t} active={time === t} onPress={() => setTime(t)} />)}
        </View>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.slate600, marginBottom: 8 }}>Choose your van</Text>
        {vans.map((v) => (
          <TouchableOpacity key={v.id} onPress={() => setVanSize(v.id)} activeOpacity={0.8}
            style={{ padding: 14, borderRadius: radius.md, borderWidth: 1.5, marginBottom: 8, borderColor: vanSize === v.id ? colors.primary : colors.slate200, backgroundColor: vanSize === v.id ? colors.violet50 : colors.white }}>
            <Text style={{ fontWeight: "700", color: colors.slate900 }}>{v.name}</Text>
            <Text style={{ color: colors.slate500, fontSize: 13, marginTop: 2 }}>{v.desc}</Text>
          </TouchableOpacity>
        ))}
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.slate600, marginTop: 6, marginBottom: 8 }}>Who will help on the day?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Chip label="Driver + me (I'll help)" active={crew === "me"} onPress={() => setCrew("me")} />
          <Chip label="Driver + 1 helper" active={crew === "helper"} onPress={() => setCrew("helper")} />
        </View>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Field label="What are you moving?" value={items} onChangeText={setItems} placeholder="e.g. 1 sofa, 1 double bed, 8 boxes…" multiline />
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.slate600, marginBottom: 8 }}>Photos of your items</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {photos.map((uri, i) => (
            <Image key={i} source={{ uri }} style={{ height: 72, width: 72, borderRadius: radius.sm, marginRight: 8, marginBottom: 8 }} />
          ))}
          <TouchableOpacity onPress={addPhoto} style={{ height: 72, width: 72, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.slate200, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 28 }}>+</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <Field label="Your name" value={name} onChangeText={setName} placeholder="Jane Doe" />
        <Field label="Your phone" value={phone} onChangeText={setPhone} placeholder="07123 456789" keyboardType="phone-pad" />
      </Card>

      <Button title={busy ? "Creating booking…" : "See available drivers"} onPress={submit} loading={busy} testID="booking-submit" />
    </ScrollView>
  );
}
