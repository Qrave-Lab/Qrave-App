// @ts-nocheck
// app/dashboard.js
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function DashboardScreen() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rawUser = await AsyncStorage.getItem("user");
        if (!mounted) return;
        if (!rawUser) {
          router.replace("/" as any);
          return;
        }

        const parsed = JSON.parse(rawUser);
        const role = parsed?.role;
        const isAdmin = role === "owner" || role === "manager";
        const isWaiter = role === "waiter";
        const isKitchen = role === "kitchen" || role === "chef";
        router.replace(isAdmin ? "/admin" : isWaiter ? "/waiter" : isKitchen ? "/kitchen" : "/setup");
      } catch {
        if (mounted) router.replace("/");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
