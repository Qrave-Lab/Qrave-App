import React from "react";
import { Tabs } from "expo-router";
import { HapticTab } from "../../components/haptic-tab";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { AdminColors } from "../../constants/theme";
import { useColorScheme } from "../../hooks/use-color-scheme";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

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
    staff: "people",
    billing: "receipt",
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarButton: HapticTab,
      }}
      tabBar={(props) => <AdminTabBar {...props} />}
    >
      <Tabs.Screen name="customize-tables" options={{ title: "Customize" }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventory" }} />
      <Tabs.Screen name="staff" options={{ title: "Staff" }} />
      <Tabs.Screen name="billing" options={{ title: "Billing" }} />
    </Tabs>
  );
}
