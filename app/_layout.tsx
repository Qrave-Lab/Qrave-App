// app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { NotificationProvider } from "../contexts/NotificationContext";
import { Platform, LogBox, Text, TextInput } from "react-native";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from "@expo-google-fonts/inter";

// Global font hack for React Native to apply the sleek Inter font everywhere
const applyGlobalFont = () => {
  const oldTextRender = (Text as any).render;
  if (oldTextRender) {
    (Text as any).render = function render(props: any, ref: any) {
      return oldTextRender.call(this, { ...props, style: [{ fontFamily: "Inter_400Regular" }, props.style] }, ref);
    };
  }

  const oldTextInputRender = (TextInput as any).render;
  if (oldTextInputRender) {
    (TextInput as any).render = function render(props: any, ref: any) {
      return oldTextInputRender.call(this, { ...props, style: [{ fontFamily: "Inter_400Regular" }, props.style] }, ref);
    };
  }
};
applyGlobalFont();

// Prevent splash screen from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Ignore */
});

LogBox.ignoreLogs([
  "Cannot connect to expo cli",
  "Cannot connect to Expo CLI",
  "cannot connect to expo cli",
  "Cannot connect to Metro",
  "Console warning"
]);

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

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

  if (!fontsLoaded) return null;

  return (
    <NotificationProvider>
      {/* Stack from expo-router will render child routes */}
      <Stack screenOptions={{ headerShown: false }} />
    </NotificationProvider>
  );
}
