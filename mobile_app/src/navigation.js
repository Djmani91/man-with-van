import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "./auth";
import { colors } from "./theme";

import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import BookingScreen from "./screens/BookingScreen";
import OffersScreen from "./screens/OffersScreen";
import MyJobsScreen from "./screens/MyJobsScreen";
import ChatScreen from "./screens/ChatScreen";
import AccountScreen from "./screens/AccountScreen";
import DriverHubScreen from "./screens/DriverHubScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICON = { Book: "cube", "My Jobs": "list", Account: "person", Hub: "car" };

function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate400,
        tabBarIcon: ({ color, size }) => <Ionicons name={ICON[route.name] || "ellipse"} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Book" component={BookingScreen} />
      <Tab.Screen name="My Jobs" component={MyJobsScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : user.role === "driver" ? (
        <>
          <Stack.Screen name="DriverHub" component={DriverHubScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: true, title: "Messages" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
          <Stack.Screen name="Offers" component={OffersScreen} options={{ headerShown: true, title: "Choose your driver" }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: true, title: "Messages" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
