import React, { useState } from "react";
import { View, Text, ScrollView, Image, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useAuth } from "../auth";
import { Button, Field } from "../ui";
import { colors } from "../theme";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      Alert.alert("Login failed", String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.slate100 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          {/* Put your logo.png in assets and update the require path if you like */}
          <View style={{ height: 64, width: 64, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.white, fontSize: 26, fontWeight: "800" }}>M</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.slate900, marginTop: 14 }}>Man With Van</Text>
          <Text style={{ color: colors.slate500, marginTop: 4 }}>Book a local man & van in minutes</Text>
        </View>

        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" testID="login-email" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry testID="login-password" />
        <Button title="Log in" onPress={submit} loading={busy} testID="login-submit" />
        <Button title="Create an account" variant="ghost" onPress={() => navigation.navigate("Register")} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
