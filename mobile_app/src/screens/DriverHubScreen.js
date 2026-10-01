import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Switch, TextInput, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Chip } from "../ui";
import { colors, radius } from "../theme";

const MIN_BID = 50;
const STEPS = [
  { v: "en_route_pickup", l: "En route" },
  { v: "loading", l: "Loading" },
  { v: "in_transit", l: "In transit" },
  { v: "completed", l: "Completed" },
];

export default function DriverHubScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("quotation");
  const [available, setAvailable] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [profile, setProfile] = useState(null);
  const [detail, setDetail] = useState(null); // { job }
  const [bid, setBid] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, av, acc, conv] = await Promise.all([
      api.get("/driver/profile").catch(() => null),
      api.get("/driver/available").catch(() => []),
      api.get("/driver/jobs").catch(() => []),
      api.get("/driver/conversations").catch(() => []),
    ]);
    setProfile(p); setAvailable(av); setAccepted(acc); setConversations(conv);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  function openDetail(job) { setBid(String(job.my_bid || "")); setDetail(job); }
  function toChat(id) { setDetail(null); navigation.navigate("Chat", { bookingId: id, role: "driver" }); }

  async function act(fn) {
    try { const r = await fn(); if (r?.message) Alert.alert("Done", r.message); setDetail(null); await load(); }
    catch (e) { Alert.alert("Error", String(e.message || e)); }
  }
  const accept = (id) => act(() => api.post(`/driver/jobs/${id}/accept`));
  const decline = (id) => act(() => api.post(`/driver/jobs/${id}/decline`));
  const confirmJob = (id) => act(() => api.post(`/driver/jobs/${id}/confirm`));
  const setStatus = (id, status) => act(() => api.post(`/driver/jobs/${id}/status`, { status }));
  const submitBid = (id) => {
    const n = Number(bid);
    if (!n || n < MIN_BID) return Alert.alert("Minimum £50", `Minimum quote is £${MIN_BID}. Please enter £${MIN_BID} or more.`);
    act(() => api.post(`/driver/jobs/${id}/bid`, { price: n }));
  };

  const activeAccepted = accepted.filter((j) => j.status !== "completed" && j.status !== "cancelled");
  const NAV = [
    { v: "quotation", l: "Quotation", icon: "clipboard" },
    { v: "accepted", l: "Accepted", icon: "checkmark-circle" },
    { v: "message", l: "Message", icon: "chatbubbles" },
    { v: "settings", l: "Settings", icon: "settings" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.slate100 }}>
      <View style={{ backgroundColor: colors.slate900, paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>Driver Hub</Text>
        <TouchableOpacity onPress={logout}><Text style={{ color: colors.slate400 }}>Logout</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {profile && profile.status !== "approved" && (
          <Card style={{ marginBottom: 12, backgroundColor: colors.amber50, borderColor: colors.amber400 }}>
            <Text style={{ fontWeight: "700", color: colors.slate900 }}>Application under review</Text>
            <Text style={{ color: colors.slate600, fontSize: 13 }}>You can take jobs once approved.</Text>
          </Card>
        )}

        {tab === "quotation" && (available.length === 0
          ? <Text style={{ color: colors.slate500 }}>No open jobs right now.</Text>
          : available.map((j) => {
            const amount = j.fixed_price ? j.your_earnings : (j.customer_pays ?? j.price);
            return (
              <TouchableOpacity key={j.booking_id} onPress={() => openDetail(j)} activeOpacity={0.85}>
                <Card style={{ marginBottom: 12 }}>
                  {j.fixed_price && (
                    <View style={{ alignSelf: "flex-start", backgroundColor: colors.rose600, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 }}>
                      <Text style={{ color: colors.white, fontSize: 11, fontWeight: "800" }}>URGENT · FIXED PRICE</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700", color: colors.slate900 }}>{j.booking_id}</Text>
                    <Text style={{ fontWeight: "800", color: colors.primary }}>£{Math.round(amount || 0)}</Text>
                  </View>
                  <Text style={{ color: colors.slate600, marginTop: 6 }}>{j.pickup_postcode} → {j.dropoff_postcode}</Text>
                  <Text style={{ color: colors.slate400, fontSize: 13, marginTop: 2 }}>{j.date} · {j.time} · {j.distance_mi} mi · {j.van_name}</Text>
                </Card>
              </TouchableOpacity>
            );
          }))}

        {tab === "accepted" && (activeAccepted.length === 0
          ? <Text style={{ color: colors.slate500 }}>No accepted jobs yet.</Text>
          : activeAccepted.map((j) => (
            <Card key={j.booking_id} style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: "700", color: colors.slate900 }}>{j.booking_id}</Text>
              <Text style={{ color: colors.slate600, marginTop: 6 }}>{j.pickup || j.pickup_postcode} → {j.dropoff || j.dropoff_postcode}</Text>
              <Text style={{ color: colors.slate400, fontSize: 13, marginTop: 2 }}>{j.date} · {j.time} · {j.van_name}</Text>
              {j.awaiting_driver_accept ? (
                <View style={{ marginTop: 10, backgroundColor: colors.amber50, borderWidth: 1.5, borderColor: colors.amber400, borderRadius: radius.md, padding: 12 }}>
                  <Text style={{ fontWeight: "700", color: colors.amber600 }}>Confirm within 30 minutes</Text>
                  <Text style={{ color: colors.slate600, fontSize: 13, marginBottom: 8 }}>Confirm now or this job goes to other drivers.</Text>
                  <Button title="Confirm job" onPress={() => confirmJob(j.booking_id)} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
                  {STEPS.map((s) => <Chip key={s.v} label={s.l} active={j.status === s.v} onPress={() => setStatus(j.booking_id, s.v)} />)}
                </View>
              )}
              <Button title="Message customer" variant="outline" style={{ marginTop: 8 }} onPress={() => toChat(j.booking_id)} />
            </Card>
          )))}

        {tab === "message" && (conversations.length === 0
          ? <Text style={{ color: colors.slate500 }}>No conversations yet.</Text>
          : conversations.map((c) => (
            <TouchableOpacity key={c.booking_id} onPress={() => toChat(c.booking_id)}>
              <Card style={{ marginBottom: 10 }}>
                <Text style={{ fontWeight: "700", color: colors.slate900 }}>{c.customer_name || "Customer"}</Text>
                <Text style={{ color: colors.slate500, fontSize: 13 }}>{c.pickup_postcode} → {c.dropoff_postcode}</Text>
                <Text style={{ color: colors.slate400, fontSize: 12 }} numberOfLines={1}>{c.last_text || `${c.date || ""} · ${c.status}`}</Text>
              </Card>
            </TouchableOpacity>
          )))}

        {tab === "settings" && profile && (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.slate900, fontSize: 16 }}>{profile.name}</Text>
            <Text style={{ color: colors.slate500, marginBottom: 12 }}>{user?.email}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderColor: colors.slate100 }}>
              <Text style={{ color: colors.slate700, fontWeight: "600" }}>Available for jobs</Text>
              <Switch value={profile.availability === "available"} disabled={profile.status !== "approved"}
                onValueChange={async (v) => { await api.post("/driver/availability", { available: v }).catch(() => {}); load(); }} />
            </View>
            <Text style={{ color: colors.slate400, fontSize: 12, marginTop: 4 }}>Vehicle: {profile.vehicle}</Text>
          </Card>
        )}
      </ScrollView>

      {/* bottom tab bar */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.slate200, paddingBottom: 18, paddingTop: 8 }}>
        {NAV.map((n) => (
          <TouchableOpacity key={n.v} onPress={() => setTab(n.v)} style={{ flex: 1, alignItems: "center" }}>
            <Ionicons name={n.icon} size={22} color={tab === n.v ? colors.primary : colors.slate400} />
            <Text style={{ fontSize: 11, marginTop: 2, color: tab === n.v ? colors.primary : colors.slate400 }}>{n.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Job detail modal (quotation) */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.slate100, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" }}>
            {detail && (
              <ScrollView>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.slate900 }}>{detail.booking_id}</Text>
                  <TouchableOpacity onPress={() => setDetail(null)}><Ionicons name="close" size={24} color={colors.slate500} /></TouchableOpacity>
                </View>
                <Card style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.slate600 }}>{detail.pickup_postcode} → {detail.dropoff_postcode}</Text>
                  <Text style={{ color: colors.slate400, fontSize: 13, marginTop: 4 }}>{detail.date} · {detail.time} · {detail.van_name}</Text>
                  <Text style={{ color: colors.slate400, fontSize: 13 }}>{detail.needs_helper ? "Driver + helper needed" : "Driver + customer (customer will assist)"}</Text>
                  {detail.items ? <Text style={{ color: colors.slate700, marginTop: 8 }}>{detail.items}</Text> : null}
                </Card>

                {detail.fixed_price ? (
                  <>
                    <Card style={{ marginBottom: 12, backgroundColor: colors.emerald50, borderColor: colors.emerald600 }}>
                      <Text style={{ fontWeight: "800", color: colors.emerald600, fontSize: 16 }}>You earn £{Math.round(detail.your_earnings || 0)}</Text>
                      <Text style={{ color: colors.slate600, fontSize: 13 }}>Fixed price — no bidding. First driver to accept gets it.</Text>
                    </Card>
                    <Button title="Accept job" onPress={() => accept(detail.booking_id)} />
                    <View style={{ flexDirection: "row", marginTop: 8 }}>
                      <Button title="Cancel" variant="outline" style={{ flex: 1, marginRight: 8 }} onPress={() => decline(detail.booking_id)} />
                      <Button title="Message" variant="outline" style={{ flex: 1 }} onPress={() => toChat(detail.booking_id)} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={{ fontWeight: "600", color: colors.slate600, marginBottom: 6 }}>Your quote (minimum £{MIN_BID})</Text>
                    <TextInput value={bid} onChangeText={setBid} keyboardType="numeric" placeholder={`£${MIN_BID}+`}
                      placeholderTextColor={colors.slate400}
                      style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: 14, height: 52, fontSize: 18, color: colors.slate900 }} />
                    {bid !== "" && Number(bid) < MIN_BID && <Text style={{ color: colors.red600, fontSize: 12, marginTop: 6 }}>Minimum quote is £{MIN_BID}.</Text>}
                    <View style={{ flexDirection: "row", marginTop: 12 }}>
                      <Button title="Submit quote" style={{ flex: 1, marginRight: 8 }} disabled={!bid || Number(bid) < MIN_BID} onPress={() => submitBid(detail.booking_id)} />
                      <Button title="Message" variant="outline" style={{ flex: 1 }} onPress={() => toChat(detail.booking_id)} />
                    </View>
                  </>
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
