import React, { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useAuth } from "../auth";
import { Button, Field } from "../ui";
import { colors } from "../theme";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name || !email || !password) return Alert.alert("Missing details", "Name, email and password are required.");
    setBusy(true);
    try {
      await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
    } catch (e) {
      Alert.alert("Sign up failed", String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.slate100 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.slate900, marginBottom: 20 }}>Create your account</Text>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" testID="reg-name" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" testID="reg-email" />
        <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="07123 456789" keyboardType="phone-pad" testID="reg-phone" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry testID="reg-password" />
        <Button title="Sign up" onPress={submit} loading={busy} testID="reg-submit" />
        <Button title="I already have an account" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
        <Text style={{ color: colors.slate400, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Driver? Sign up as a driver on our website, then log in here.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
