import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { WaiterColors } from "../../constants/theme";

type OrderItem = {
  name: string;
  qty: number;
};

type Order = {
  id: string;
  customer: string;
  items: OrderItem[];
  total: string;
  status: "new" | "in_progress" | "served";
  time: string;
};

const SAMPLE_ORDERS: Order[] = [
  {
    id: "A102",
    customer: "Table 3",
    items: [
      { name: "Smash Burger", qty: 2 },
      { name: "Fries", qty: 1 },
    ],
    total: "560",
    status: "new",
    time: new Date().toISOString(),
  },
  {
    id: "A103",
    customer: "Table 7",
    items: [{ name: "Pasta Alfredo", qty: 1 }],
    total: "420",
    status: "in_progress",
    time: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "A104",
    customer: "Table 2",
    items: [{ name: "Iced Tea", qty: 3 }],
    total: "210",
    status: "served",
    time: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WaiterColors.background },
  header: { padding: 12 },
  title: { fontSize: 22, fontWeight: "800", color: WaiterColors.text },
  subtitle: { color: "#475569", marginTop: 4 },
  filterRow: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 8 },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: WaiterColors.card,
  },
  filterBtnActive: { backgroundColor: WaiterColors.primary },
  filterText: { color: WaiterColors.text },
  filterTextActive: { color: WaiterColors.card, fontWeight: "700" },
  card: {
    backgroundColor: WaiterColors.card,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    elevation: 2,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  id: { fontWeight: "800", color: WaiterColors.text },
  status: { fontWeight: "700", color: WaiterColors.primary },
  customer: { color: "#475569", marginTop: 6 },
  items: { color: "#334155", marginTop: 6 },
  total: { fontWeight: "700", color: WaiterColors.text, marginTop: 8 },
  actions: { flexDirection: "row", marginTop: 10 },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "#E2E8F0",
  },
  actionPrimary: { backgroundColor: WaiterColors.primary },
  actionText: { color: "#0F172A", fontWeight: "600" },
  actionTextLight: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", color: "#64748B", marginTop: 40 },
});

export default function WaiterOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "served">(
    "all",
  );

  const loadOrders = useCallback(async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (!user) {
        router.replace("/");
        return;
      }
      const stored = await AsyncStorage.getItem("orders");
      if (stored) {
        setOrders(JSON.parse(stored));
      } else {
        setOrders(SAMPLE_ORDERS);
      }
    } catch (e) {
      console.warn("Failed to load orders", e);
      setOrders(SAMPLE_ORDERS);
    } finally {
      setHydrated(true);
    }
  }, [router]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem("orders", JSON.stringify(orders)).catch(() => {});
  }, [orders, hydrated]);

  const visibleOrders = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const updateStatus = (orderId: string, status: Order["status"]) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
    );
  };

  const openOrder = (order: Order) => {
    router.push({
      pathname: "/order-detail",
      params: { order: encodeURIComponent(JSON.stringify(order)) },
    });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>See and update current tickets</Text>
      </View>

      <View style={styles.filterRow}>
        {[
          { key: "all", label: "All" },
          { key: "new", label: "New" },
          { key: "in_progress", label: "In Progress" },
          { key: "served", label: "Served" },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key as any)}
            style={[
              styles.filterBtn,
              filter === f.key ? styles.filterBtnActive : null,
            ]}
          >
            <Text
              style={filter === f.key ? styles.filterTextActive : styles.filterText}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={WaiterColors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openOrder(item)}>
            <View style={styles.row}>
              <Text style={styles.id}>#{item.id}</Text>
              <Text style={styles.status}>{item.status.replace("_", " ")}</Text>
            </View>
            <Text style={styles.customer}>
              {item.customer} - {new Date(item.time).toLocaleTimeString()}
            </Text>
            <Text numberOfLines={1} style={styles.items}>
              {item.items.map((it) => `${it.qty}x ${it.name}`).join(", ")}
            </Text>
            <Text style={styles.total}>Rs {item.total}</Text>
            <View style={styles.actions}>
              {item.status === "new" ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionPrimary]}
                  onPress={() => updateStatus(item.id, "in_progress")}
                >
                  <Text style={styles.actionTextLight}>Start</Text>
                </TouchableOpacity>
              ) : null}
              {item.status !== "served" ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => updateStatus(item.id, "served")}
                >
                  <Text style={styles.actionText}>Mark Served</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No orders yet.</Text>
        }
      />
    </View>
  );
}
