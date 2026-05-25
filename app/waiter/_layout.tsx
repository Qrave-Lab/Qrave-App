import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { HapticTab } from "../../components/haptic-tab";
import { WaiterColors } from "../../constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  "customize-tables": { icon: "table-restaurant", label: "Floor" },
  waitlist: { icon: "event-seat", label: "Waitlist" },
  menu: { icon: "restaurant-menu", label: "Menu" },
  profile: { icon: "person", label: "Profile" },
};

function WaiterTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleTabs = ["customize-tables", "waitlist", "menu", "profile"];

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
                  color={focused ? WaiterColors.primary : "#9CA3AF"}
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
              const isKitchen = role === "kitchen" || role === "chef";
              router.replace(isKitchen ? "/kitchen" : "/setup");
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
        tabBar={(props) => <WaiterTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="customize-tables" options={{ title: "Floor" }} />
        <Tabs.Screen name="waitlist" options={{ title: "Waitlist" }} />
        <Tabs.Screen name="menu" options={{ title: "Menu" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        <Tabs.Screen name="take-order" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#D1FAE5",
    paddingTop: 10,
    shadowColor: "#16A34A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabIconWrap: {
    width: 44,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginBottom: 2,
  },
  tabIconWrapActive: {
    backgroundColor: "#DCFCE7",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 1,
  },
  tabLabelActive: {
    color: WaiterColors.primary,
    fontWeight: "800",
  },
});
