import React from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useAuth } from "../auth";
import { Button, Card } from "../ui";
import { colors } from "../theme";

export default function AccountScreen() {
  const { user, logout } = useAuth();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.slate100 }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.slate900, marginBottom: 16 }}>Account</Text>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.slate900 }}>{user?.name}</Text>
        <Text style={{ color: colors.slate500, marginTop: 4 }}>{user?.email}</Text>
        <Text style={{ color: colors.slate400, marginTop: 2, textTransform: "capitalize" }}>{user?.role}</Text>
      </Card>
      <Button
        title="Log out"
        variant="outline"
        style={{ marginTop: 20 }}
        onPress={() => Alert.alert("Log out", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          { text: "Log out", style: "destructive", onPress: logout },
        ])}
        testID="account-logout"
      />
    </ScrollView>
  );
}
