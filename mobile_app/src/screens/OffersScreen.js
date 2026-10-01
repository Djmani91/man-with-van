import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { api } from "../api";
import { Button, Card, Chip } from "../ui";
import { colors, radius } from "../theme";
import { tokenizeCard } from "../payments";

export default function OffersScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const [data, setData] = useState(null);
  const [payType, setPayType] = useState(null); // "deposit" | "full"  (NO default — customer must choose)
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api.get(`/bookings/${bookingId}/instant-offers`).then(setData).catch((e) => Alert.alert("Error", String(e.message || e)));
  }, [bookingId]);

  async function choose(offer) {
    if (!payType) return Alert.alert("Choose payment", "Please choose 15% deposit or pay in full first.");
    setBusyId(offer.driver_id);
    try {
      // Card entry must be tokenised by the Square In-App Payments SDK (see src/payments.js)
      const sourceId = await tokenizeCard();
      await api.post(`/bookings/${bookingId}/select-driver`, {
        driver_id: offer.driver_id, payment_type: payType, source_id: sourceId,
      });
      Alert.alert("Booked!", "Your driver is confirmed. Track it in My Jobs.", [
        { text: "OK", onPress: () => navigation.navigate("CustomerTabs", { screen: "My Jobs" }) },
      ]);
    } catch (e) {
      Alert.alert("Payment / booking failed", String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;

  const offers = data.offers || [];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.slate100 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "700", color: colors.slate900, marginBottom: 10 }}>How would you like to pay?</Text>
        <View style={{ flexDirection: "row" }}>
          <Chip label="15% deposit now" active={payType === "deposit"} onPress={() => setPayType("deposit")} testID="pay-deposit" />
          <Chip label="Pay in full" active={payType === "full"} onPress={() => setPayType("full")} testID="pay-full" />
        </View>
        {payType === "deposit" && <Text style={{ color: colors.amber600, fontSize: 12, marginTop: 4 }}>You'll pay 15% now and the rest to the driver on moving day (cash or bank transfer).</Text>}
      </Card>

      {offers.length === 0 ? (
        <Text style={{ color: colors.slate500 }}>No drivers available right now. Please try again shortly.</Text>
      ) : offers.map((o) => (
        <Card key={o.driver_id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontWeight: "700", color: colors.slate900 }}>{o.name}</Text>
              <Text style={{ color: colors.slate500, fontSize: 13 }}>{o.vehicle} · {o.distance_mi} mi away · ★ {o.rating}</Text>
              {(o.tags || []).length > 0 && (
                <View style={{ flexDirection: "row", marginTop: 6 }}>
                  {o.tags.map((t) => (
                    <View key={t} style={{ backgroundColor: colors.violet100, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6 }}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>£{Math.round(o.price)}</Text>
          </View>
          <Button title={payType === "deposit" ? `Pay 15% deposit` : `Pay £${Math.round(o.price)}`} onPress={() => choose(o)} loading={busyId === o.driver_id} style={{ marginTop: 12 }} testID={`choose-${o.driver_id}`} />
        </Card>
      ))}
    </ScrollView>
  );
}
