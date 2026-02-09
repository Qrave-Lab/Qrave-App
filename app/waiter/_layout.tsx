import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import { HapticTab } from "../../components/haptic-tab";
import { IconSymbol } from "../../components/ui/icon-symbol";
import LogoutButton from "../../components/LogoutButton";
import { WaiterColors } from "../../constants/theme";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    paddingBottom: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: WaiterColors.text,
  },
  tabWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 110,
    borderRadius: 20,
    flexDirection: "row",
  },
  tabActive: {
    backgroundColor: WaiterColors.primary,
    shadowColor: WaiterColors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  tabText: { fontSize: 14, marginLeft: 8 },
});

function WaiterTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const iconsMap: Record<string, string> = {
    orders: "doc.text",
    tables: "fork.knife",
  };

  return (
    <View style={{ backgroundColor: WaiterColors.background, paddingVertical: 8 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 12,
        }}
      >
        {state.routes.map((route, idx) => {
          const focused = state.index === idx;
          const label =
            (descriptors[route.key].options.title as string) ?? route.name;
          const icon = iconsMap[route.name] ?? "circle";

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={[
                styles.tabWrap,
                focused
                  ? styles.tabActive
                  : { backgroundColor: WaiterColors.card },
                { marginHorizontal: 8 },
              ]}
              activeOpacity={0.9}
            >
              <IconSymbol
                size={18}
                name={icon}
                color={focused ? WaiterColors.card : WaiterColors.text}
              />
              <Text
                style={[
                  { color: focused ? WaiterColors.card : WaiterColors.text },
                  styles.tabText,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function WaiterTabLayout() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const user = await AsyncStorage.getItem("user");
        const token = await AsyncStorage.getItem("qrave_jwt");
        if (!user && !token) {
          router.replace("/");
          return;
        }
        if (user) {
          try {
            const parsed = JSON.parse(user);
            const role = parsed?.role;
            const isWaiter = role === "waiter";
            const isAdmin = role === "owner" || role === "manager";
            if (isAdmin) {
              router.replace("/admin" as any);
              return;
            }
            if (!isWaiter) {
              router.replace("/dashboard");
              return;
            }
          } catch (e) {
            console.warn("Failed to parse user role", e);
          }
        }
      } catch (e) {
        console.warn("Auth check failed", e);
      } finally {
        if (mounted) setCheckedAuth(true);
      }
    };
    check();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!checkedAuth) return null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: WaiterColors.background }}
      edges={["top", "left", "right"]}
    >
      <View style={{ flex: 1, backgroundColor: WaiterColors.background }}>
        <View style={styles.header}>
          <Text style={styles.title}>Waiter</Text>
          <LogoutButton />
        </View>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarButton: HapticTab,
          }}
          tabBar={(props) => <WaiterTabBar {...props} />}
        >
          <Tabs.Screen name="orders" options={{ title: "Orders" }} />
          <Tabs.Screen name="tables" options={{ title: "Tables" }} />
        </Tabs>
      </View>
    </SafeAreaView>
  );
}
