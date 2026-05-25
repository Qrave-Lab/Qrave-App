import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import KitchenWavyHeader from "../../components/KitchenWavyHeader";
import { KitchenColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";

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

/** Returns elapsed label and urgency level */
function getElapsedInfo(createdAt?: string, nowTs = Date.now()) {
  if (!createdAt) return { label: "—", urgency: "normal" as const };
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return { label: "—", urgency: "normal" as const };
  const diffMin = Math.max(0, Math.floor((nowTs - start) / 60000));
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  const label =
    hours > 0
      ? `${hours}h ${String(mins).padStart(2, "0")}m`
      : `${mins}m`;
  const urgency =
    diffMin >= 30 ? "critical" : diffMin >= 15 ? "warning" : "normal";
  return { label, urgency } as const;
}

export default function KitchenScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width > 700;

  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  /* Live clock — updates every 30 s */
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const checkAuth = useCallback(async () => {
    const user = await AsyncStorage.getItem("user");
    if (!user) { router.replace("/"); return false; }
    try {
      const parsed = JSON.parse(user);
      const role = parsed?.role;
      if (role === "owner" || role === "manager") { router.replace("/admin/customize-tables"); return false; }
      if (role === "waiter") { router.replace("/waiter"); return false; }
      if (role !== "kitchen" && role !== "chef") { router.replace("/setup"); return false; }
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

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const acceptedOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() === "accepted"),
    [orders],
  );

  const totalItems = useMemo(
    () => acceptedOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0),
    [acceptedOrders],
  );

  const logout = useCallback(async () => {
    try { await AsyncStorage.removeItem("user"); } catch {}
    router.replace("/");
  }, [router]);

  return (
    <View style={s.container}>
      <KitchenWavyHeader height={140}>
        <View style={s.headerContent}>
          <View>
            <Text style={s.headerTitle}>Kitchen Display</Text>
            <Text style={s.headerSubtitle}>Live Order Queue</Text>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
            <MaterialIcons name="logout" size={16} color="#FFFFFF" />
            <Text style={s.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </KitchenWavyHeader>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KitchenColors.primary} />}
      >
        {/* ── Stats Dashboard ── */}
        <View style={s.statsRow}>
          <View style={[s.statCard, s.statCardOrange]}>
            <View style={[s.statIconBox, { backgroundColor: "#FFEDD5" }]}>
              <MaterialIcons name="receipt-long" size={24} color="#C2410C" />
            </View>
            <View>
              <Text style={s.statValue}>{acceptedOrders.length}</Text>
              <Text style={s.statLabel}>Active Orders</Text>
            </View>
          </View>

          <View style={[s.statCard, s.statCardAmber]}>
            <View style={[s.statIconBox, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="restaurant-menu" size={24} color="#B45309" />
            </View>
            <View>
              <Text style={s.statValue}>{totalItems}</Text>
              <Text style={s.statLabel}>Total Items</Text>
            </View>
          </View>

          <View style={[s.statCard, s.statCardRed]}>
            <View style={[s.statIconBox, { backgroundColor: "#FEE2E2" }]}>
              <MaterialIcons name="timer" size={24} color="#B91C1C" />
            </View>
            <View>
              <Text style={s.statValue}>
                {acceptedOrders.filter((o) => getElapsedInfo(o.created_at, nowTs).urgency !== "normal").length}
              </Text>
              <Text style={s.statLabel}>Urgent Orders</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={KitchenColors.primary} />
            <Text style={s.loadingText}>Syncing orders...</Text>
          </View>
        ) : acceptedOrders.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconWrap}>
              <MaterialIcons name="check-circle" size={48} color="#10B981" />
            </View>
            <Text style={s.emptyTitle}>All caught up!</Text>
            <Text style={s.emptyHint}>No active orders in the queue.</Text>
          </View>
        ) : (
          <View style={[s.grid, isTablet && s.gridTablet]}>
            {acceptedOrders.map((item) => {
              const { label: elapsedLabel, urgency } = getElapsedInfo(item.created_at, nowTs);
              const isCritical = urgency === "critical";
              const isWarning = urgency === "warning";

              return (
                <View
                  key={item.id}
                  style={[
                    s.ticketCard,
                    isTablet && s.ticketCardTablet,
                    isCritical && s.ticketCritical,
                    isWarning && s.ticketWarning,
                  ]}
                >
                  {/* Ticket Header */}
                  <View style={[
                    s.ticketHeader,
                    isCritical && s.headerCritical,
                    isWarning && s.headerWarning,
                  ]}>
                    <View style={s.tableBadge}>
                      <Text style={s.tableBadgeText}>Table {item.table_number ?? "—"}</Text>
                    </View>
                    <View style={s.timeBadge}>
                      <MaterialIcons
                        name="schedule"
                        size={14}
                        color={isCritical ? "#FFFFFF" : isWarning ? "#B45309" : "#475569"}
                      />
                      <Text style={[
                        s.timeText,
                        isCritical && s.timeTextCritical,
                        isWarning && s.timeTextWarning,
                      ]}>
                        {elapsedLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={s.ticketBody}>
                    <Text style={s.orderId}>Order #{String(item.id || item.order_id || "—").slice(0, 8)}</Text>
                    
                    <View style={s.itemsList}>
                      {(item.items || []).map((it, idx) => (
                        <View key={`${item.id}-${idx}`} style={s.itemRow}>
                          <View style={s.itemQtyBox}>
                            <Text style={s.itemQtyText}>{it.quantity || 0}</Text>
                          </View>
                          <View style={s.itemDetails}>
                            <Text style={s.itemName}>{it.menu_item_name || "Unknown Item"}</Text>
                            {it.variant_label ? (
                              <Text style={s.itemVariant}>{it.variant_label}</Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Ticket Footer */}
                  <View style={s.ticketFooter}>
                    <MaterialIcons name="restaurant" size={14} color="#94A3B8" />
                    <Text style={s.footerText}>
                      {item.items?.length || 0} item{(item.items?.length || 0) !== 1 ? "s" : ""} total
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: KitchenColors.background },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#FFFFFF", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "600", marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginLeft: 6 },
  
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
    marginTop: -30,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: KitchenColors.border,
    shadowColor: KitchenColors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", marginTop: 2 },
  statCardOrange: { borderColor: "#FFEDD5" },
  statCardAmber: { borderColor: "#FEF3C7" },
  statCardRed: { borderColor: "#FEE2E2" },

  loadingBox: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  loadingText: { marginTop: 12, color: "#64748B", fontWeight: "700", fontSize: 15 },
  
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  emptyHint: { fontSize: 14, color: "#64748B", fontWeight: "500" },

  grid: { flexDirection: "column", gap: 16 },
  gridTablet: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  
  ticketCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ticketCardTablet: { width: Platform.select({ web: "32%", default: "48%" }), minWidth: 300 },
  ticketCritical: { borderColor: "#EF4444", borderWidth: 2, shadowColor: "#EF4444", shadowOpacity: 0.2 },
  ticketWarning: { borderColor: "#F59E0B", borderWidth: 2, shadowColor: "#F59E0B", shadowOpacity: 0.1 },

  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerCritical: { backgroundColor: "#FEF2F2", borderBottomColor: "#FCA5A5" },
  headerWarning: { backgroundColor: "#FFFBEB", borderBottomColor: "#FCD34D" },
  
  tableBadge: { backgroundColor: "#0F172A", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tableBadgeText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  
  timeBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeText: { fontSize: 15, fontWeight: "800", color: "#475569" },
  timeTextCritical: { color: "#EF4444" },
  timeTextWarning: { color: "#D97706" },

  ticketBody: { padding: 16 },
  orderId: { fontSize: 12, fontWeight: "700", color: "#94A3B8", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  
  itemsList: { gap: 12 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  itemQtyBox: {
    backgroundColor: KitchenColors.primaryDark,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemQtyText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 18, fontWeight: "800", color: "#0F172A", lineHeight: 24 },
  itemVariant: { fontSize: 14, fontWeight: "600", color: "#64748B", marginTop: 2 },
  
  ticketFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  footerText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
});
