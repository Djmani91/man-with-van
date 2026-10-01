import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { api } from "../api";
import { colors, radius } from "../theme";

export default function ChatScreen({ route }) {
  const { bookingId, driverId, role } = route.params || {};
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const scroller = useRef(null);
  // customers must pass ?driver_id; drivers/admin don't
  const qs = role === "customer" && driverId ? `?driver_id=${driverId}` : "";

  async function load() {
    try { setMsgs(await api.get(`/bookings/${bookingId}/messages${qs}`)); } catch {}
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [bookingId]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await api.post(`/bookings/${bookingId}/messages${qs}`, { text: t });
      load();
    } catch {}
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.slate100 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16 }} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
        <Text style={{ color: colors.slate400, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
          For your safety, phone numbers, emails and addresses are hidden until the job is confirmed.
        </Text>
        {msgs.map((m) => {
          const mine = (role === "customer" && m.sender_role === "customer") || (role === "driver" && m.sender_role === "driver");
          return (
            <View key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%", marginBottom: 8 }}>
              <View style={{ backgroundColor: mine ? colors.primary : colors.white, borderRadius: radius.md, padding: 10, borderWidth: mine ? 0 : 1, borderColor: colors.slate200 }}>
                <Text style={{ color: mine ? colors.white : colors.slate900 }}>{m.text}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", padding: 12, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.slate200 }}>
        <TextInput value={text} onChangeText={setText} placeholder="Type a message…" placeholderTextColor={colors.slate400}
          style={{ flex: 1, height: 44, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.pill, paddingHorizontal: 16, color: colors.slate900 }} />
        <TouchableOpacity onPress={send} style={{ marginLeft: 8, height: 44, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.white, fontWeight: "700" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
