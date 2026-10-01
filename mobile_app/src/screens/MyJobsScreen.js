import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { Card, Button } from "../ui";
import { colors, radius } from "../theme";

const STATUS_LABEL = {
  quoting: "Finding a driver", assigned: "Driver assigned", en_route_pickup: "En route",
  loading: "Loading", in_transit: "In transit", completed: "Completed", cancelled: "Cancelled", confirmed: "Confirmed",
};

export default function MyJobsScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setJobs(await api.get("/bookings")); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.slate100 }}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.slate900, marginBottom: 16 }}>My Jobs</Text>
      {jobs.length === 0 ? (
        <Text style={{ color: colors.slate500 }}>No bookings yet. Create one from the Book tab.</Text>
      ) : jobs.map((b) => {
        const pay = b.payment || {};
        return (
          <Card key={b.booking_id} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700", color: colors.slate900 }}>{b.booking_id}</Text>
              <View style={{ backgroundColor: colors.violet100, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{STATUS_LABEL[b.status] || b.status}</Text>
              </View>
            </View>
            <Text style={{ color: colors.slate600, marginTop: 8 }}>{b.pickup}</Text>
            <Text style={{ color: colors.slate600 }}>→ {b.dropoff}</Text>
            <Text style={{ color: colors.slate400, fontSize: 13, marginTop: 4 }}>{b.date} · {b.time} · {b.van_name}</Text>
            {pay.status === "paid" && pay.type === "deposit" && (
              <Text style={{ color: colors.amber600, fontSize: 13, marginTop: 6 }}>
                Deposit paid £{(pay.amount || 0).toFixed(2)} — pay the driver £{(pay.balance_due || 0).toFixed(2)} on the day (cash/bank).
              </Text>
            )}
            {pay.status === "paid" && pay.type === "full" && (
              <Text style={{ color: colors.emerald600, fontSize: 13, marginTop: 6 }}>Paid in full by card.</Text>
            )}
            {b.driver_id && (
              <Button title="Message driver" variant="outline" style={{ marginTop: 12 }}
                onPress={() => navigation.navigate("Chat", { bookingId: b.booking_id, driverId: b.driver_id, role: "customer" })} />
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
