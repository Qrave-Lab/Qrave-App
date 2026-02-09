import React, { useEffect, useState } from "react";
import { HapticTab } from "../../components/haptic-tab";
import AdminButton from "../../components/AdminButton";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { AdminColors } from "../../constants/theme";
import { useColorScheme } from "../../hooks/use-color-scheme";
import {
  // ...existing code...
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import LogoutButton from "../../components/LogoutButton";

const styles = StyleSheet.create({
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
    backgroundColor: AdminColors.primary,
    shadowColor: AdminColors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  tabText: { fontSize: 14, marginLeft: 8 },
});

function AdminTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const iconsMap: Record<string, string> = {
    "customize-tables": "table-restaurant",
    inventory: "inventory",
    sales: "insights",
  };

  return (
    <View
      style={{ backgroundColor: AdminColors.background, paddingVertical: 8 }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          justifyContent: "center",
          alignItems: "center",
          minWidth: "100%",
        }}
      >
        {state.routes
          .filter((route) => route.name !== "profile" && route.name !== "qr-codes")
          .map((route, idx) => {
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
                    : { backgroundColor: AdminColors.secondary },
                  { marginHorizontal: 8 },
                ]}
                activeOpacity={0.9}
              >
                <IconSymbol
                  size={route.name === "customize-tables" ? 20 : 18}
                  name={icon}
                  color={focused ? AdminColors.card : AdminColors.text}
                />
                <Text
                  style={[
                    { color: focused ? AdminColors.card : AdminColors.text },
                    styles.tabText,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

export default function AdminTabLayout() {
  useColorScheme();
  const router = useRouter();
  // ...existing code...
  const [checkedAuth, setCheckedAuth] = useState(false);
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const user = await AsyncStorage.getItem("user");
        const token = await AsyncStorage.getItem("qrave_jwt");
        if (!user && !token) {
          // no stored auth — redirect to login (app/index.js is the login route)
          router.replace("/");
          return;
        }
        if (user) {
          try {
            const parsed = JSON.parse(user);
            const role = parsed?.role;
            const isAdmin = role === "owner" || role === "manager";
            if (!isAdmin) {
              router.replace(role === "waiter" ? "/waiter" : "/dashboard");
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
      style={{ flex: 1, backgroundColor: AdminColors.background }}
      edges={["top", "left", "right"]}
    >
      <View style={{ flex: 1, backgroundColor: AdminColors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 12,
            paddingBottom: 0,
          }}
        >
          <AdminButton style={{}} />
          <LogoutButton />
        </View>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarButton: HapticTab,
          }}
          tabBar={(props) => <AdminTabBar {...props} />}
        >
          <Tabs.Screen
            name="customize-tables"
            options={{ title: "Customize" }}
          />
          <Tabs.Screen name="inventory" options={{ title: "Inventory" }} />
          <Tabs.Screen name="sales" options={{ title: "Sales" }} />
          <Tabs.Screen
            name="qr-codes"
            options={{ href: null }}
          />
          {/* Profile tab removed as requested */}
        </Tabs>
      </View>
    </SafeAreaView>
  );
}
