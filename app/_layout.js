// app/_layout.js
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { NotificationProvider } from "../contexts/NotificationContext";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export default function Layout() {
  useEffect(() => {
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
