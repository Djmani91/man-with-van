import React from "react";
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator, StyleSheet } from "react-native";
import { colors, radius } from "./theme";

export function Button({ title, onPress, variant = "primary", disabled, loading, style, testID }) {
  const bg = variant === "primary" ? colors.primary : variant === "outline" ? colors.white : "transparent";
  const border = variant === "outline" ? { borderWidth: 1, borderColor: colors.slate200 } : null;
  const txt = variant === "primary" ? colors.white : colors.slate900;
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={disabled || loading ? undefined : onPress}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, border, style]}
    >
      {loading ? <ActivityIndicator color={txt} /> : <Text style={[styles.btnTxt, { color: txt }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline, testID }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.slate400}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        multiline={multiline}
        style={[styles.input, multiline && { height: 90, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8}
      style={[styles.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}>
      <Text style={[styles.chipTxt, active ? { color: colors.white } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnTxt: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: colors.slate600, marginBottom: 6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: 14, height: 50, fontSize: 16, color: colors.slate900 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200, padding: 16 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: colors.white, marginRight: 8, marginBottom: 8 },
  chipTxt: { fontSize: 14, fontWeight: "600", color: colors.slate600 },
});
