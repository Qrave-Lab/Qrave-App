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
import { api } from "../../lib/apiClient";
import KitchenWavyHeader from "../../components/kitchen/KitchenWavyHeader";
import { KitchenColors } from "../../constants/theme";

/* ── Kitchen brand colors ─── */
const K = {
  bg: "#FAFAF9",
  accent: KitchenColors.primary,
  text: KitchenColors.text,
  muted: KitchenColors.textMuted,
  cardBg: KitchenColors.card,
};

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
  container: { flex: 1, backgroundColor: K.bg },
  /* ── header content ── */
  headerContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  /* ── stat chips ── */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    gap: 10,
  },
  statChip: {
    flex: 1,
    backgroundColor: K.cardBg,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: "900", color: K.text },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: K.muted,
    marginTop: 2,
    textTransform: "uppercase",
  },
  /* ── cards ── */
  card: {
    backgroundColor: K.cardBg,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tableTitle: { fontSize: 16, fontWeight: "800", color: K.text },
  orderIdText: { fontSize: 12, color: K.muted, fontWeight: "600" },
  elapsedBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  elapsedText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  divider: { height: 1, backgroundColor: "#F5F5F4", marginVertical: 6 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  itemName: { color: K.text, fontWeight: "600", fontSize: 14, flex: 1 },
  itemQty: { color: K.accent, fontWeight: "800", fontSize: 14, marginLeft: 8 },
  /* ── empty / loading ── */
  loadingBox: { alignItems: "center", paddingTop: 40 },
  loadingText: { marginTop: 8, color: K.muted },
  emptyText: {
    color: K.muted,
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
});

export default function KitchenOrdersScreen() {
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getElapsedLabel = useCallback(
    (createdAt?: string) => {
      if (!createdAt) return "Elapsed: -";
      const start = new Date(createdAt).getTime();
      if (Number.isNaN(start)) return "Elapsed: -";
      const diffMin = Math.max(0, Math.floor((nowTs - start) / 60000));
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      if (hours > 0)
        return `Elapsed: ${hours}h ${String(mins).padStart(2, "0")}m`;
      return `Elapsed: ${mins}m`;
    },
    [nowTs],
  );

  const loadOrders = useCallback(async () => {
    try {
      const res: any = await api.get("/api/admin/orders/active");
      const list = (res as ActiveOrdersResponse)?.orders || [];
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <View style={styles.container}>
      {/* ── Wavy Header ── */}
      <KitchenWavyHeader title="Kitchen" subtitle="Accepted orders" height={150} />

      {/* ── Stats chips ── */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{acceptedOrders.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>
            {acceptedOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={K.accent} />
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
              tintColor={K.accent}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No accepted orders right now.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.tableTitle}>
                    Table {item.table_number ?? "-"}
                  </Text>
                  <Text style={styles.orderIdText}>
                    Order #{item.id || item.order_id}
                  </Text>
                </View>
                <View style={styles.elapsedBadge}>
                  <Text style={styles.elapsedText}>
                    {getElapsedLabel(item.created_at)}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              {(item.items || []).map((it, idx) => (
                <View key={`${item.id}-${idx}`} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.menu_item_name || "Item"}
                    {it.variant_label ? ` (${it.variant_label})` : ""}
                  </Text>
                  <Text style={styles.itemQty}>x{it.quantity || 0}</Text>
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 16 }}
        />
      )}
    </View>
  );
}
