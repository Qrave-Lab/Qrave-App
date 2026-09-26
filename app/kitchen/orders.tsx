import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "../../lib/apiClient";
import KitchenWavyHeader from "../../components/kitchen/KitchenWavyHeader";
import { KitchenColors } from "../../constants/theme";

/* ── Kitchen brand colors ─── */
const K = {
  bg: "#FAFAF9",
  accent: KitchenColors.primary,
  accentDark: KitchenColors.primaryDark,
  accentLight: KitchenColors.primaryLight,
  accentBg: KitchenColors.secondary,
  text: KitchenColors.text,
  muted: KitchenColors.textMuted,
  cardBg: KitchenColors.card,
  border: "#E5E7EB",
};

export type OrderItem = {
  menu_item_name?: string;
  variant_label?: string | null;
  quantity?: number;
  price?: number;
  notes?: string;
  description?: string;
  special_instructions?: string;
  instructions?: string;
  customizations?: string;
};

export type ActiveOrder = {
  id?: string;
  order_id?: string;
  status?: string;
  created_at?: string;
  session_id?: string;
  table_number?: number;
  notes?: string;
  description?: string;
  special_instructions?: string;
  instructions?: string;
  customer_notes?: string;
  customer_name?: string;
  remarks?: string;
  items?: OrderItem[];
};

type ActiveOrdersResponse = {
  orders: ActiveOrder[];
};

const getClientDescription = (order: ActiveOrder): string | null => {
  const note =
    order.special_instructions ||
    order.notes ||
    order.description ||
    order.instructions ||
    order.customer_notes ||
    order.remarks ||
    "";
  if (typeof note === "string" && note.trim().length > 0) {
    return note.trim();
  }
  return null;
};

const getItemDescription = (item: OrderItem): string | null => {
  const note =
    item.special_instructions ||
    item.notes ||
    item.description ||
    item.instructions ||
    item.customizations ||
    "";
  if (typeof note === "string" && note.trim().length > 0) {
    return note.trim();
  }
  return null;
};

export default function KitchenOrdersScreen() {
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const getElapsedInfo = useCallback(
    (createdAt?: string) => {
      if (!createdAt) return { label: "Just now", isUrgent: false };
      const start = new Date(createdAt).getTime();
      if (Number.isNaN(start)) return { label: "Just now", isUrgent: false };
      const diffMin = Math.max(0, Math.floor((nowTs - start) / 60000));
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      const isUrgent = diffMin >= 20;

      if (hours > 0) {
        return {
          label: `${hours}h ${String(mins).padStart(2, "0")}m ago`,
          isUrgent,
        };
      }
      return { label: `${mins}m ago`, isUrgent };
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
    const interval = setInterval(loadOrders, 20000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const updateOrderStatus = async (order: ActiveOrder, newStatus: string) => {
    const orderId = order.id || order.order_id;
    if (!orderId) return;

    setUpdatingId(orderId);
    try {
      await api.patch(`/api/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => {
          if ((o.id || o.order_id) === orderId) {
            return { ...o, status: newStatus };
          }
          return o;
        }),
      );
    } catch (e: any) {
      const msg = e?.body?.message || e?.message || "Failed to update order status";
      Alert.alert("Update Failed", msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const st = (o.status || "").toLowerCase();
      return st !== "cancelled" && st !== "delivered" && st !== "completed" && st !== "served";
    });
  }, [orders]);

  const getStatusBadge = (status?: string) => {
    const st = (status || "").toLowerCase();
    switch (st) {
      case "preparing":
        return { label: "PREPARING", bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
      case "ready":
        return { label: "READY", bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
      case "delivered":
      case "completed":
        return { label: "DELIVERED", bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" };
      case "accepted":
        return { label: "ACCEPTED", bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" };
      default:
        return { label: "NEW ORDER", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Wavy Header ── */}
      <KitchenWavyHeader
        title="Kitchen Display"
        subtitle="Live orders & cook preparation"
        height={150}
      />

      <View style={{ height: 16 }} />

      {/* ── Order Cards List ── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={K.accent} />
          <Text style={styles.loadingText}>Fetching orders from kitchen...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id || item.order_id || Math.random())}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={K.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="restaurant-menu" size={54} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Kitchen Orders</Text>
              <Text style={styles.emptyText}>
                No pending orders at the moment.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const clientNote = getClientDescription(item);
            const elapsed = getElapsedInfo(item.created_at);
            const statusBadge = getStatusBadge(item.status);
            const orderIdStr = String(item.id || item.order_id || "");
            const shortOrderId = orderIdStr.length > 8 ? orderIdStr.slice(-6) : orderIdStr;
            const isUpdating = updatingId === orderIdStr;
            const currentStatus = (item.status || "").toLowerCase();

            return (
              <View style={styles.card}>
                {/* ── Card Header ── */}
                <View style={styles.cardHeader}>
                  <View style={styles.tableBadge}>
                    <MaterialIcons name="table-restaurant" size={18} color="#FFF" />
                    <Text style={styles.tableBadgeText}>
                      Table {item.table_number != null ? item.table_number : "-"}
                    </Text>
                  </View>

                  <View style={styles.headerRight}>
                    <View
                      style={[
                        styles.elapsedBadge,
                        elapsed.isUrgent && styles.elapsedBadgeUrgent,
                      ]}
                    >
                      <MaterialIcons
                        name="schedule"
                        size={13}
                        color={elapsed.isUrgent ? "#B91C1C" : "#92400E"}
                      />
                      <Text
                        style={[
                          styles.elapsedText,
                          elapsed.isUrgent && styles.elapsedTextUrgent,
                        ]}
                      >
                        {elapsed.label}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusBadge.bg,
                          borderColor: statusBadge.border,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ── Subtitle / ID ── */}
                <View style={styles.orderMetaRow}>
                  <Text style={styles.orderIdText}>Order #{shortOrderId}</Text>
                  <Text style={styles.itemsCountText}>
                    {(item.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0)} Total Qty
                  </Text>
                </View>

                {/* ── CLIENT DESCRIPTION / SPECIAL INSTRUCTIONS CALLOUT ── */}
                {clientNote ? (
                  <View style={styles.clientNoteCard}>
                    <View style={styles.clientNoteHeader}>
                      <MaterialIcons name="speaker-notes" size={18} color="#B45309" />
                      <Text style={styles.clientNoteTitle}>NOTE FROM CLIENT</Text>
                    </View>
                    <Text style={styles.clientNoteBody}>{clientNote}</Text>
                  </View>
                ) : null}

                <View style={styles.divider} />

                {/* ── Items List ── */}
                <View style={styles.itemsContainer}>
                  {(item.items || []).map((it, idx) => {
                    const itemNote = getItemDescription(it);
                    return (
                      <View key={`${orderIdStr}-${idx}`} style={styles.itemWrapper}>
                        <View style={styles.itemMainRow}>
                          <View style={styles.itemQtyBadge}>
                            <Text style={styles.itemQtyBadgeText}>x{it.quantity || 1}</Text>
                          </View>
                          <View style={styles.itemTextCol}>
                            <Text style={styles.itemName}>{it.menu_item_name || "Menu Item"}</Text>
                            {it.variant_label ? (
                              <View style={styles.variantChip}>
                                <Text style={styles.variantChipText}>{it.variant_label}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {itemNote ? (
                          <View style={styles.itemNoteRow}>
                            <MaterialIcons name="info-outline" size={13} color="#D97706" />
                            <Text style={styles.itemNoteText}>{itemNote}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* ── Action Buttons for Cook ── */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnReady, { paddingVertical: 14 }]}
                    onPress={() => updateOrderStatus(item, "delivered")}
                    disabled={isUpdating}
                    activeOpacity={0.8}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="check-circle" size={24} color="#FFF" />
                        <Text style={[styles.actionBtnReadyText, { fontSize: 16 }]}>Mark as Done / Delivered</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 28 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.bg },

  /* ── Stats chips ── */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },
  statChip: {
    flex: 1,
    backgroundColor: K.cardBg,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  statValue: { fontSize: 20, fontWeight: "900", color: K.text },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: K.muted,
    marginTop: 2,
    textTransform: "uppercase",
  },

  /* ── Filter Tabs ── */
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabBtnActive: {
    backgroundColor: K.accent,
    borderColor: K.accent,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },

  /* ── Cards ── */
  card: {
    backgroundColor: K.cardBg,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tableBadgeText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  elapsedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  elapsedBadgeUrgent: {
    backgroundColor: "#FEE2E2",
  },
  elapsedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },
  elapsedTextUrgent: {
    color: "#B91C1C",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  orderMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  itemsCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },

  /* ── CLIENT NOTE / SPECIAL INSTRUCTIONS ── */
  clientNoteCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#FCD34D",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  clientNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  clientNoteTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#92400E",
    letterSpacing: 0.5,
  },
  clientNoteBody: {
    fontSize: 14,
    fontWeight: "700",
    color: "#78350F",
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 8,
  },

  /* ── Items ── */
  itemsContainer: {
    gap: 8,
    marginVertical: 4,
  },
  itemWrapper: {
    paddingVertical: 4,
  },
  itemMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemQtyBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 34,
    alignItems: "center",
  },
  itemQtyBadgeText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#B45309",
  },
  itemTextCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  itemName: {
    color: K.text,
    fontWeight: "700",
    fontSize: 15,
  },
  variantChip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  variantChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
  },
  itemNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 44,
    marginTop: 4,
  },
  itemNoteText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D97706",
    fontStyle: "italic",
  },

  /* ── Action Buttons ── */
  cardActionsRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 46,
  },
  actionBtnPrep: {
    backgroundColor: "#F59E0B",
  },
  actionBtnPrepText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  actionBtnReady: {
    backgroundColor: "#10B981",
  },
  actionBtnReadyText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  actionBtnDelivered: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
  },
  actionBtnDeliveredText: {
    color: "#059669",
    fontWeight: "800",
    fontSize: 14,
  },
  deliveredPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  deliveredPillText: {
    color: "#16A34A",
    fontWeight: "800",
    fontSize: 13,
  },

  /* ── Empty & Loading ── */
  loadingBox: {
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    color: K.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#374151",
    marginTop: 12,
  },
  emptyText: {
    color: K.muted,
    textAlign: "center",
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
});
