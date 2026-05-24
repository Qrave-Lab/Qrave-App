import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import AdminSettingsHeader from "../../components/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  categoryId?: string;
  isArchived?: boolean;
  isOutOfStock?: boolean;
};

type CartItem = {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
};

type DeliveryZone = {
  id: string;
  name: string;
  distance_km?: number;
  fee: number;
  estimated_minutes?: number;
};

type TakeawayOrderItem = {
  id: string;
  menu_item_name: string;
  variant_label?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type TakeawayOrder = {
  id: string;
  order_type: "takeout" | "delivery";
  status: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  delivery_zone?: string;
  delivery_fee: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_mode?: string;
  notes?: string;
  created_at: string;
  items: TakeawayOrderItem[];
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "#92400E" },
  preparing: { label: "Preparing", tone: "#1D4ED8" },
  ready: { label: "Ready", tone: "#047857" },
  completed: { label: "Completed", tone: "#475569" },
  cancelled: { label: "Cancelled", tone: "#BE123C" },
};

const NEXT_STATUS: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

const fmtCur = (n: number) => `Rs ${Math.round(n).toLocaleString("en-IN")}`;

export default function SettingsTakeaway() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [orders, setOrders] = useState<TakeawayOrder[]>([]);
  const [taxPercent, setTaxPercent] = useState<number>(0);

  const [showNewOrder, setShowNewOrder] = useState(false);
  const [searchMenu, setSearchMenu] = useState("");
  const [orderType, setOrderType] = useState<"takeout" | "delivery">("takeout");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) || null,
    [selectedZoneId, zones],
  );

  const filteredMenu = useMemo(() => {
    const q = searchMenu.trim().toLowerCase();
    return menuItems
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true))
      .slice(0, 40);
  }, [menuItems, searchMenu]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0),
    [cart],
  );
  const deliveryFee = orderType === "delivery" ? selectedZone?.fee || 0 : 0;
  const computedTax = cartTotal * (taxPercent / 100);
  const finalTotal = cartTotal + computedTax + deliveryFee;

  const loadOrders = useCallback(
    async (sf = statusFilter) => {
      const apiStatus = sf === "all" ? "" : sf;
      const url = apiStatus
        ? `/api/admin/takeaway/orders?status=${apiStatus}`
        : "/api/admin/takeaway/orders";
      const res = await apiClient.get(url);
      const fetched = Array.isArray(res?.orders)
        ? (res.orders as TakeawayOrder[])
        : [];
      setOrders(
        fetched.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    },
    [statusFilter],
  );

  const bootstrap = useCallback(async () => {
    const [me, menuRes, zonesRes] = await Promise.all([
      apiClient.get("/api/admin/me"),
      apiClient.get("/api/admin/menu"),
      apiClient.get("/api/admin/delivery/zones"),
    ]);

    setTaxPercent(Number(me?.tax_percent || 0));
    const menuList = Array.isArray(menuRes)
      ? menuRes
      : Array.isArray(menuRes?.items)
        ? menuRes.items
        : [];
    setMenuItems(
      menuList
        .map((i: any) => ({
          id: String(i?.id || ""),
          name: String(i?.name || ""),
          price: Number(i?.price || 0),
          categoryId: String(i?.categoryId || ""),
          isArchived: Boolean(i?.isArchived),
          isOutOfStock: Boolean(i?.isOutOfStock),
        }))
        .filter((i: MenuItem) => !i.isArchived && !i.isOutOfStock),
    );
    setZones(Array.isArray(zonesRes?.zones) ? zonesRes.zones : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await bootstrap();
        await loadOrders("active");
      } catch {
        Alert.alert("Load failed", "Could not load takeaway data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [bootstrap, loadOrders]);

  useEffect(() => {
    if (loading) return;
    loadOrders(statusFilter).catch(() => undefined);
  }, [loading, loadOrders, statusFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await bootstrap();
      await loadOrders(statusFilter);
    } finally {
      setRefreshing(false);
    }
  }, [bootstrap, loadOrders, statusFilter]);

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          menuItemName: item.name,
          quantity: 1,
          unitPrice: item.price,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((c) =>
        c.menuItemId === menuItemId
          ? { ...c, quantity: c.quantity + delta }
          : c,
      );
      return updated.filter((c) => c.quantity > 0);
    });
  }, []);

  const resetForm = useCallback(() => {
    setOrderType("takeout");
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setSelectedZoneId("");
    setPaymentMode("cash");
    setNotes("");
    setCart([]);
    setSearchMenu("");
    setShowNewOrder(false);
  }, []);

  const createOrder = useCallback(async () => {
    if (cart.length === 0) {
      Alert.alert("Missing items", "Add at least one item.");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      Alert.alert("Missing address", "Delivery address is required.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/api/admin/takeaway/orders", {
        order_type: orderType,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        delivery_address: orderType === "delivery" ? deliveryAddress : null,
        delivery_zone:
          orderType === "delivery" ? (selectedZone?.name ?? null) : null,
        delivery_fee: deliveryFee,
        payment_mode: paymentMode,
        notes: notes || null,
        items: cart.map((c) => ({
          menu_item_id: c.menuItemId,
          menu_item_name: c.menuItemName,
          variant_label: null,
          quantity: c.quantity,
          unit_price: c.unitPrice,
        })),
      });
      resetForm();
      await loadOrders(statusFilter);
      Alert.alert("Created", "Takeaway order created.");
    } catch {
      Alert.alert("Create failed", "Could not create order.");
    } finally {
      setBusy(false);
    }
  }, [
    cart,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryFee,
    loadOrders,
    notes,
    orderType,
    paymentMode,
    resetForm,
    selectedZone?.name,
    statusFilter,
  ]);

  const updateStatus = useCallback(
    async (orderId: string, newStatus: string) => {
      setUpdatingOrderId(orderId);
      try {
        await apiClient.patch(`/api/admin/takeaway/orders/${orderId}/status`, {
          status: newStatus,
        });
        await loadOrders(statusFilter);
      } catch {
        Alert.alert("Update failed", "Could not update order status.");
      } finally {
        setUpdatingOrderId(null);
      }
    },
    [loadOrders, statusFilter],
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#0F172A" />
        <Text style={styles.loadingText}>Loading takeaway...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Takeaway & Delivery"
        subtitle="Take walk-in and delivery orders"
        actionButton={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={styles.queueBtn}
              onPress={() => router.push("/admin/queue")}
            >
              <MaterialIcons name="format-list-bulleted" size={24} color="#0F172A" />
            </Pressable>
            <Pressable
              style={styles.addBtn}
              onPress={() => setShowNewOrder(true)}
            >
              <MaterialIcons name="add" size={24} color="#0F172A" />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.filterRow}>
          {[
            { key: "active", label: "Active" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
            { key: "all", label: "All" },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.filterChip,
                statusFilter === tab.key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === tab.key && styles.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>
              New takeaway/delivery orders will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {orders.map((order) => {
              const statusMeta =
                STATUS_META[order.status] || STATUS_META.pending;
              const nextStatus = NEXT_STATUS[order.status];
              const isExpanded = expandedOrder === order.id;
              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View style={styles.badgeRow}>
                      <Text style={[styles.badge, { color: statusMeta.tone }]}>
                        {statusMeta.label}
                      </Text>
                      <Text style={styles.badge}>
                        {order.order_type === "delivery"
                          ? "Delivery"
                          : "Takeout"}
                      </Text>
                    </View>
                    <Text style={styles.total}>{fmtCur(order.total || 0)}</Text>
                  </View>
                  <Text style={styles.time}>
                    {new Date(order.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>

                  {!!order.customer_name && (
                    <Text style={styles.metaText}>
                      Customer: {order.customer_name}
                    </Text>
                  )}
                  {!!order.customer_phone && (
                    <Text style={styles.metaText}>
                      Phone: {order.customer_phone}
                    </Text>
                  )}
                  {!!order.delivery_zone && (
                    <Text style={styles.metaText}>
                      Zone: {order.delivery_zone}
                    </Text>
                  )}

                  <Pressable
                    style={styles.expandBtn}
                    onPress={() =>
                      setExpandedOrder(isExpanded ? null : order.id)
                    }
                  >
                    <Text style={styles.expandText}>
                      {isExpanded
                        ? "Hide items"
                        : `Show items (${order.items?.length || 0})`}
                    </Text>
                    <MaterialIcons
                      name={isExpanded ? "expand-less" : "expand-more"}
                      size={18}
                      color="#64748B"
                    />
                  </Pressable>

                  {isExpanded ? (
                    <View style={styles.itemWrap}>
                      {(order.items || []).map((it) => (
                        <View key={it.id} style={styles.itemRow}>
                          <Text style={styles.itemName}>
                            {it.menu_item_name}
                            {it.variant_label ? ` (${it.variant_label})` : ""}
                          </Text>
                          <Text style={styles.itemQty}>x{it.quantity}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.orderActions}>
                    {nextStatus ? (
                      <Pressable
                        style={styles.primaryAction}
                        onPress={() => updateStatus(order.id, nextStatus)}
                        disabled={updatingOrderId === order.id}
                      >
                        <Text style={styles.primaryActionText}>
                          {updatingOrderId === order.id
                            ? "Updating..."
                            : `Mark ${nextStatus}`}
                        </Text>
                      </Pressable>
                    ) : null}
                    {order.status !== "cancelled" &&
                    order.status !== "completed" ? (
                      <Pressable
                        style={styles.cancelAction}
                        onPress={() => updateStatus(order.id, "cancelled")}
                        disabled={updatingOrderId === order.id}
                      >
                        <Text style={styles.cancelActionText}>Cancel</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showNewOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewOrder(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>New Takeaway Order</Text>
              <Pressable onPress={() => setShowNewOrder(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Order Type</Text>
              <View style={styles.segmentRow}>
                <Pressable
                  style={[
                    styles.segmentBtn,
                    orderType === "takeout" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setOrderType("takeout")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      orderType === "takeout" && styles.segmentTextActive,
                    ]}
                  >
                    Takeout
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segmentBtn,
                    orderType === "delivery" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setOrderType("delivery")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      orderType === "delivery" && styles.segmentTextActive,
                    ]}
                  >
                    Delivery
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Customer Name</Text>
              <TextInput
                value={customerName}
                onChangeText={setCustomerName}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Customer Phone</Text>
              <TextInput
                value={customerPhone}
                onChangeText={setCustomerPhone}
                style={styles.input}
                keyboardType="phone-pad"
              />

              {orderType === "delivery" ? (
                <>
                  <Text style={styles.fieldLabel}>Delivery Address</Text>
                  <TextInput
                    value={deliveryAddress}
                    onChangeText={setDeliveryAddress}
                    style={styles.input}
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Delivery Zone</Text>
                  <View style={styles.chipRow}>
                    {zones.map((z) => (
                      <Pressable
                        key={z.id}
                        style={[
                          styles.zoneChip,
                          selectedZoneId === z.id && styles.zoneChipActive,
                        ]}
                        onPress={() => setSelectedZoneId(z.id)}
                      >
                        <Text
                          style={[
                            styles.zoneChipText,
                            selectedZoneId === z.id &&
                              styles.zoneChipTextActive,
                          ]}
                        >
                          {z.name} (+{fmtCur(z.fee)})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.fieldLabel}>Payment Mode</Text>
              <View style={styles.chipRow}>
                {["cash", "card", "upi"].map((pm) => (
                  <Pressable
                    key={pm}
                    style={[
                      styles.zoneChip,
                      paymentMode === pm && styles.zoneChipActive,
                    ]}
                    onPress={() => setPaymentMode(pm)}
                  >
                    <Text
                      style={[
                        styles.zoneChipText,
                        paymentMode === pm && styles.zoneChipTextActive,
                      ]}
                    >
                      {pm.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                style={styles.input}
                multiline
              />

              <Text style={styles.fieldLabel}>Add Items</Text>
              <TextInput
                value={searchMenu}
                onChangeText={setSearchMenu}
                style={styles.input}
                placeholder="Search menu item..."
              />
              <View style={styles.menuList}>
                {filteredMenu.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.menuRow}
                    onPress={() => addToCart(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuName}>{item.name}</Text>
                      <Text style={styles.menuPrice}>{fmtCur(item.price)}</Text>
                    </View>
                    <MaterialIcons
                      name="add-circle-outline"
                      size={20}
                      color="#0F172A"
                    />
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Cart</Text>
              {cart.length === 0 ? (
                <Text style={styles.emptyCart}>No items added.</Text>
              ) : (
                cart.map((c) => (
                  <View key={c.menuItemId} style={styles.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartName}>{c.menuItemName}</Text>
                      <Text style={styles.menuPrice}>
                        {fmtCur(c.unitPrice)}
                      </Text>
                    </View>
                    <View style={styles.qtyWrap}>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQty(c.menuItemId, -1)}
                      >
                        <MaterialIcons
                          name="remove"
                          size={16}
                          color="#334155"
                        />
                      </Pressable>
                      <Text style={styles.qtyText}>{c.quantity}</Text>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQty(c.menuItemId, 1)}
                      >
                        <MaterialIcons name="add" size={16} color="#334155" />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}

              <View style={styles.totalBox}>
                <Text style={styles.totalLine}>
                  Subtotal: {fmtCur(cartTotal)}
                </Text>
                <Text style={styles.totalLine}>Tax: {fmtCur(computedTax)}</Text>
                <Text style={styles.totalLine}>
                  Delivery Fee: {fmtCur(deliveryFee)}
                </Text>
                <Text style={styles.totalFinal}>
                  Total: {fmtCur(finalTotal)}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.createBtn, busy && styles.btnDisabled]}
                onPress={createOrder}
                disabled={busy}
              >
                <Text style={styles.createBtnText}>
                  {busy ? "Creating..." : "Create Order"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 8, color: "#64748B", fontWeight: "600" },
  queueBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 12, paddingBottom: 24 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterChipText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: "#FFFFFF" },
  emptyWrap: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyTitle: { color: "#334155", fontWeight: "800", fontSize: 16 },
  emptySub: { color: "#64748B", marginTop: 4, fontWeight: "600" },
  orderList: { gap: 10 },
  orderCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 10,
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  badge: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  total: { color: "#0F172A", fontSize: 16, fontWeight: "900" },
  time: { color: "#94A3B8", fontSize: 11, fontWeight: "600", marginTop: 3 },
  metaText: { color: "#475569", fontSize: 12, fontWeight: "600", marginTop: 2 },
  expandBtn: {
    marginTop: 8,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  expandText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  itemWrap: { marginTop: 6, gap: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemName: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  itemQty: { color: "#475569", fontSize: 12, fontWeight: "800" },
  orderActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  primaryAction: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  cancelAction: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelActionText: { color: "#DC2626", fontSize: 12, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 8,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalTitle: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  fieldLabel: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 5,
    marginTop: 4,
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    color: "#0F172A",
    fontWeight: "600",
    backgroundColor: "#FFFFFF",
    marginBottom: 6,
  },
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  segmentBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  segmentBtnActive: { borderColor: "#0F172A", backgroundColor: "#F1F5F9" },
  segmentText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: "#0F172A" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  zoneChip: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  zoneChipActive: { borderColor: "#0F172A", backgroundColor: "#F1F5F9" },
  zoneChipText: { color: "#475569", fontSize: 11, fontWeight: "700" },
  zoneChipTextActive: { color: "#0F172A" },
  menuList: { marginTop: 2, marginBottom: 6, gap: 6 },
  menuRow: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  menuName: { color: "#334155", fontSize: 12, fontWeight: "700" },
  menuPrice: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  emptyCart: { color: "#94A3B8", fontWeight: "600", marginBottom: 6 },
  cartRow: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cartName: { color: "#334155", fontSize: 12, fontWeight: "700" },
  qtyWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    color: "#0F172A",
    fontWeight: "800",
    minWidth: 16,
    textAlign: "center",
  },
  totalBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    padding: 10,
    marginBottom: 4,
  },
  totalLine: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  totalFinal: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  createBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
});
