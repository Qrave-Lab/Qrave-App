import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { HapticTab } from "../../components/common/HapticTab";
import { KitchenColors } from "../../constants/theme";

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  orders: { icon: "restaurant-menu", label: "Orders" },
  profile: { icon: "person", label: "Profile" },
};

function KitchenTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const visibleTabs = ["orders", "profile"];

  return (
    <View style={styles.tabBarContainer}>
      {state.routes
        .filter((route) => visibleTabs.includes(route.name))
        .map((route) => {
          const realIndex = state.routes.findIndex((r) => r.name === route.name);
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
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                <MaterialIcons
                  name={config.icon as any}
                  size={24}
                  color={focused ? KitchenColors.primary : KitchenColors.textMuted}
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

export default function KitchenLayout() {
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
          const parsed = JSON.parse(user);
          const role = parsed?.role;
          const isKitchen = role === "kitchen" || role === "chef";
          const isAdmin = role === "owner" || role === "manager";
          const isWaiter = role === "waiter";

          if (isAdmin) {
            router.replace("/admin/customize-tables");
            return;
          }
          if (isWaiter) {
            router.replace("/waiter");
            return;
          }
          if (!isKitchen) {
            router.replace("/setup");
            return;
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
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarButton: HapticTab,
        }}
        tabBar={(props) => <KitchenTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="orders" options={{ title: "Orders" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KitchenColors.background,
  },
  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: KitchenColors.card,
    borderTopWidth: 1,
    borderTopColor: KitchenColors.border,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrap: {
    width: 48,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    marginBottom: 4,
  },
  tabIconWrapActive: {
    backgroundColor: KitchenColors.secondary,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: KitchenColors.textMuted,
  },
  tabLabelActive: {
    color: KitchenColors.primaryDark,
    fontWeight: "800",
  },
});
