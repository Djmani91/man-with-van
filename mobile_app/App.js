import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./src/auth";
import { colors } from "./src/theme";
import RootNavigator from "./src/navigation";

function Gate() {
  const { ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return <RootNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Gate />
      </NavigationContainer>
    </AuthProvider>
  );
}
