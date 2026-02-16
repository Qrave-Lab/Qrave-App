import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { api } from "../../lib/apiClient";
import { WaiterColors } from "../../constants/theme";

type OrderItem = {
  menu_item_name?: string;
  variant_label?: string | null;
  quantity?: number;
};

type ActiveOrder = {
  id?: string;
  order_id?: string;
  status?: string;
  created_at?: string;
  session_id?: string;
  table_number?: number;
  items?: OrderItem[];
};

type ActiveOrdersResponse = {
  orders: ActiveOrder[];
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF7ED" },
  header: {
    padding: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#7C2D12" },
  subtitle: { color: "#9A3412", marginTop: 4 },
  headerLeft: { flex: 1 },
  logoutBtn: {
    backgroundColor: "#7C2D12",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: "#FFFBF5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  tableTitle: { fontSize: 16, fontWeight: "800", color: "#7C2D12" },
  meta: { color: "#9A3412", marginTop: 2 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  itemName: { color: "#7C2D12", fontWeight: "600" },
  itemQty: { color: "#9A3412", fontWeight: "700" },
  loadingBox: { alignItems: "center", paddingTop: 40 },
  loadingText: { marginTop: 8, color: "#9A3412" },
  emptyText: { color: "#9A3412", textAlign: "center", marginTop: 40 },
});

export default function KitchenScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getElapsedLabel = useCallback((createdAt?: string) => {
    if (!createdAt) return "Elapsed: -";
    const start = new Date(createdAt).getTime();
    if (Number.isNaN(start)) return "Elapsed: -";
    const diffMin = Math.max(0, Math.floor((nowTs - start) / 60000));
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hours > 0) return `Elapsed: ${hours}h ${String(mins).padStart(2, "0")}m`;
    return `Elapsed: ${mins}m`;
  }, [nowTs]);

  const checkAuth = useCallback(async () => {
    const user = await AsyncStorage.getItem("user");
    if (!user) {
      router.replace("/");
      return false;
    }
    try {
      const parsed = JSON.parse(user);
      const role = parsed?.role;
      const isKitchen = role === "kitchen" || role === "chef";
      const isAdmin = role === "owner" || role === "manager";
      const isWaiter = role === "waiter";
      if (isAdmin) {
        router.replace("/admin/customize-tables");
        return false;
      }
      if (isWaiter) {
        router.replace("/waiter");
        return false;
      }
      if (!isKitchen) {
        router.replace("/dashboard");
        return false;
      }
      return true;
    } catch {
      router.replace("/");
      return false;
    }
  }, [router]);

  const loadOrders = useCallback(async () => {
    const ok = await checkAuth();
    if (!ok) return;
    try {
      const res: any = await api.get("/api/admin/orders/active");
      const list = (res as ActiveOrdersResponse)?.orders || [];
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [checkAuth]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const acceptedOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() === "accepted"),
    [orders],
  );

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem("user");
    } catch {}
    router.replace("/");
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Kitchen</Text>
          <Text style={styles.subtitle}>Accepted orders</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={WaiterColors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={acceptedOrders}
          keyExtractor={(item) => String(item.id || item.order_id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={WaiterColors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No accepted orders right now.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.tableTitle}>
                Table {item.table_number ?? "-"}
              </Text>
              <Text style={styles.meta}>Order #{item.id || item.order_id}</Text>
              <Text style={styles.meta}>{getElapsedLabel(item.created_at)}</Text>
              {(item.items || []).map((it, idx) => (
                <View key={`${item.id}-${idx}`} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    {it.menu_item_name || "Item"}
                    {it.variant_label ? ` (${it.variant_label})` : ""}
                  </Text>
                  <Text style={styles.itemQty}>x{it.quantity || 0}</Text>
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </View>
  );
}
