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
import { HapticTab } from "../../components/common/HapticTab";

const ORANGE = "#F97316";

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  "customize-tables": { icon: "grid-view", label: "Floor" },
  waitlist: { icon: "access-time", label: "Waitlist" },
  menu: { icon: "restaurant-menu", label: "Menu" },
  profile: { icon: "person-outline", label: "Profile" },
};

function WaiterTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const visibleTabs = ["customize-tables", "waitlist", "menu", "profile"];

  return (
    <View style={styles.tabBarContainer}>
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
              <View style={styles.tabIconWrap}>
                <MaterialIcons
                  name={config.icon as any}
                  size={26}
                  color={focused ? ORANGE : "#9CA3AF"}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  focused && styles.tabLabelActive,
                ]}
              >
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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    position: "relative",
  },
  tabIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 2,
  },
  tabLabelActive: {
    color: ORANGE,
    fontWeight: "800",
  },
});
