import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { HapticTab } from "../../components/haptic-tab";
import { useColorScheme } from "../../hooks/use-color-scheme";

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs, useRouter, useSegments } from "expo-router";
import {
    BackHandler,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  "customize-tables": { icon: "table-restaurant", label: "Floor" },
  inventory: { icon: "inventory", label: "Menu" },
  takeaway: { icon: "delivery-dining", label: "Orders" },
  sales: { icon: "insights", label: "Sales" },
};

function AdminTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleTabs = ["customize-tables", "inventory", "takeaway", "sales"];

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes
        .filter((route) => visibleTabs.includes(route.name))
        .map((route) => {
          const realIndex = state.routes.findIndex(
            (r) => r.name === route.name,
          );
          const focused = state.index === realIndex;
          const config = TAB_CONFIG[route.name] || {
            icon: "circle",
            label: route.name,
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.tabIconWrap,
                  focused && styles.tabIconWrapActive,
                ]}
              >
                <MaterialIcons
                  name={config.icon as any}
                  size={22}
                  color={focused ? "#F59E0B" : "#9CA3AF"}
                />
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

export default function AdminTabLayout() {
  useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [checkedAuth, setCheckedAuth] = useState(false);

  /* ── Settings sub-screens: names that should back-navigate to profile ── */
  const SETTINGS_SUB_SCREENS = new Set([
    "profile-details",
    "qr-codes",
    "staff",
    "settings-devices",
    "settings-takeaway",
    "settings-team-members",
    "settings-offers",
    "settings-kitchen",
    "settings-audit",
    "settings-branches",
    "settings-access-control",
    "settings-feedback",
    "settings-delivery-zones",
    "billing",
    "settings-floor-plan",
    "subscription",
    "delete-account",
  ]);

  /* ── Android hardware back → Settings Hub when on a sub-screen ── */
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const currentScreen = segments[segments.length - 1];
    if (!currentScreen || !SETTINGS_SUB_SCREENS.has(currentScreen)) return;
    const handler = () => {
      router.replace("/admin/profile");
      return true; // prevent default back
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [segments, router]);

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
            const isAdmin = role === "owner" || role === "manager";
            if (!isAdmin) {
              const isWaiter = role === "waiter";
              const isKitchen = role === "kitchen" || role === "chef";
              router.replace(
                isWaiter ? "/waiter" : isKitchen ? "/kitchen" : "/setup",
              );
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
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarButton: HapticTab,
        }}
        tabBar={(props) => <AdminTabBar {...props} />}
      >
        <Tabs.Screen name="customize-tables" options={{ title: "Floor" }} />
        <Tabs.Screen name="inventory" options={{ title: "Menu" }} />
        <Tabs.Screen name="takeaway" options={{ title: "Orders" }} />
        <Tabs.Screen name="sales" options={{ title: "Sales" }} />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", href: null }}
        />
        <Tabs.Screen name="profile-details" options={{ href: null }} />
        <Tabs.Screen name="qr-codes" options={{ href: null }} />
        <Tabs.Screen name="staff" options={{ href: null }} />
        <Tabs.Screen name="settings-devices" options={{ href: null }} />
        <Tabs.Screen name="settings-takeaway" options={{ href: null }} />
        <Tabs.Screen name="settings-team-members" options={{ href: null }} />
        <Tabs.Screen name="settings-offers" options={{ href: null }} />
        <Tabs.Screen name="settings-kitchen" options={{ href: null }} />
        <Tabs.Screen name="settings-audit" options={{ href: null }} />
        <Tabs.Screen name="settings-branches" options={{ href: null }} />
        <Tabs.Screen name="settings-access-control" options={{ href: null }} />
        <Tabs.Screen name="settings-feedback" options={{ href: null }} />
        <Tabs.Screen name="settings-delivery-zones" options={{ href: null }} />
        <Tabs.Screen name="queue" options={{ href: null }} />
        <Tabs.Screen name="billing" options={{ href: null }} />
        <Tabs.Screen name="settings-floor-plan" options={{ href: null }} />
        <Tabs.Screen name="subscription" options={{ href: null }} />
        <Tabs.Screen name="delete-account" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  tabIconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  tabIconWrapActive: {},
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9CA3AF",
    marginTop: 1,
  },
  tabLabelActive: {
    color: "#1F2937",
    fontWeight: "700",
  },
});
