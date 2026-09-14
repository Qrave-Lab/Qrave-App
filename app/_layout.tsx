// app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { NotificationProvider } from "../contexts/NotificationContext";
import { Platform, LogBox } from "react-native";
import Constants from "expo-constants";

LogBox.ignoreLogs([
  "Cannot connect to expo cli",
  "Cannot connect to Expo CLI",
  "cannot connect to expo cli",
  "Cannot connect to Metro",
  "Console warning"
]);

export default function Layout() {
  useEffect(() => {
    if (Constants.appOwnership === "expo") {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Notifications: any;
    try {
      Notifications = require("expo-notifications");
    } catch {
      return;
    }
    // show notifications while foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("orders", {
        name: "Order notifications",
        importance: Notifications.AndroidImportance.MAX,
      });
    }
  }, []);

  return (
    <NotificationProvider>
      {/* Stack from expo-router will render child routes */}
      <Stack screenOptions={{ headerShown: false }} />
    </NotificationProvider>
  );
}
