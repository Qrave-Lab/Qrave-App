// app/dashboard.js
import React, { useEffect, useState, useContext } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from "react-native";
import OrderCard from "../components/OrderCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NotificationContext } from "../contexts/NotificationContext";
import { useRouter } from "expo-router";

const generateMockOrder = () => {
  const id = Math.floor(Math.random() * 1000000).toString();
  const items = [
    { name: "Veg Burger", qty: 1 },
    { name: "Fries", qty: 1 },
    { name: "Coke", qty: 1 }
  ];
  return {
    id,
    customer: `Table ${Math.floor(Math.random()*50)+1}`,
    items,
    total: (Math.random()*300 + 50).toFixed(2),
    status: "new",
    time: new Date().toISOString()
  };
};

export default function DashboardScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const { pushNotificationLocal } = useContext(NotificationContext);

  useEffect(() => {
    // Check if user is logged in
    (async () => {
      try {
        const user = await AsyncStorage.getItem("user");
        if (!user) {
          router.replace("/");
        } else {
          // Load orders if user is logged in
          const s = await AsyncStorage.getItem("orders");
          if (s) setOrders(JSON.parse(s));
        }
      } catch (e) {
        console.warn("Failed to check user", e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("orders", JSON.stringify(orders)).catch(() => {});
  }, [orders]);

  const simulateNewOrder = async () => {
    const newOrder = generateMockOrder();
    setOrders(prev => [newOrder, ...prev]);
    await pushNotificationLocal("New Order", `Order #${newOrder.id} from ${newOrder.customer}`, { orderId: newOrder.id });
  };

  const openOrder = (order) => {
    // pass order as encoded JSON query param to the order-detail route
    router.push({
      pathname: "/order-detail",
      params: { order: encodeURIComponent(JSON.stringify(order)) },
    });
  };

  const updateOrder = (updated) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const clearOrders = () => {
    Alert.alert("Clear orders", "Are you sure you want to clear all orders?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => setOrders([]) }
    ]);
  };

  // Immediate logout (no confirmation)
  const logout = async () => {
    try {
      await AsyncStorage.removeItem("user");
    } catch (e) {
      console.warn("Failed to remove user during logout", e);
    }
    // navigate to login
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Orders</Text>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push("/notifications")}>
            <Text style={styles.headerBtnText}>Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={simulateNewOrder}>
            <Text style={styles.headerBtnText}>Simulate Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: "#ff3b30" }]} onPress={clearOrders}>
            <Text style={styles.headerBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: "#ff9500" }]} onPress={logout}>
            <Text style={styles.headerBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({item}) => (
          <OrderCard order={item} onPress={() => openOrder(item)} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet. Tap "Simulate Order" to test.</Text>}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f8fa" },
  headerRow: { padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  headerBtn: { backgroundColor: "#0a84ff", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  headerBtnText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 40, color: "#666" }
});
