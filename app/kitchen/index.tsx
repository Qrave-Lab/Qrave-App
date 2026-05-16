import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { api } from "../../lib/apiClient";

/* ── Kitchen brand colors ─── */
const K = {
  bg: "#FAFAF9",
  headerFrom: "#F59E0B",
  headerTo: "#D97706",
  accent: "#F59E0B",
  text: "#1C1917",
  muted: "#78716C",
  cardBg: "#FFFFFF",
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
  /* ── wavy header ── */
  headerWrap: {
    width: "100%",
    overflow: "hidden",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0,
    marginBottom: -2,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    marginTop: 2,
    fontSize: 13,
  },
  logoutBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
        router.replace("/setup");
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

  const { width: screenW } = useWindowDimensions();
  const HEADER_H = 150;
  const curveH = HEADER_H * 0.85;
  const gIds = useMemo(
    () => ({
      a: `kh_a_${Math.random().toString(36).slice(2, 9)}`,
      b: `kh_b_${Math.random().toString(36).slice(2, 9)}`,
      c: `kh_c_${Math.random().toString(36).slice(2, 9)}`,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      {/* ── Wavy Header ── */}
      <View style={[styles.headerWrap, { height: HEADER_H }]}>
        <View style={StyleSheet.absoluteFill}>
          <Svg
            height="100%"
            width="100%"
            viewBox={`0 0 ${screenW} ${HEADER_H}`}
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id={gIds.a} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FDE68A" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#FCD34D" stopOpacity="0.3" />
              </LinearGradient>
              <LinearGradient id={gIds.b} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FBBF24" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#F59E0B" stopOpacity="0.4" />
              </LinearGradient>
              <LinearGradient id={gIds.c} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={K.headerFrom} stopOpacity="1" />
                <Stop offset="1" stopColor={K.headerTo} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Path
              d={`M0,0 L${screenW},0 L${screenW},${curveH * 0.7} C${screenW * 0.6},${curveH * 0.9} ${screenW * 0.3},${curveH * 0.5} 0,${curveH * 0.8} Z`}
              fill={`url(#${gIds.a})`}
            />
            <Path
              d={`M0,0 L${screenW},0 L${screenW},${curveH * 0.55} C${screenW * 0.7},${curveH * 0.75} ${screenW * 0.4},${curveH * 0.4} 0,${curveH * 0.65} Z`}
              fill={`url(#${gIds.b})`}
            />
            <Path
              d={`M0,0 L${screenW},0 L${screenW},${HEADER_H * 0.85} C${screenW * 0.75},${HEADER_H} ${screenW * 0.25},${HEADER_H * 0.75} 0,${HEADER_H} Z`}
              fill={`url(#${gIds.c})`}
            />
          </Svg>
        </View>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Kitchen</Text>
            <Text style={styles.subtitle}>Accepted orders</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

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
