import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import iconPng from "../../assets/images/icon.png";
import AdminWavyHeader from "../../components/AdminWavyHeader";
import apiClient from "../../lib/apiClient";

/* ── Types ─────────────────────────────────────────────────── */
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

type TableOption = {
  id: string;
  table_number?: number;
  number?: number;
  capacity?: number;
  is_archived?: boolean;
  archived?: boolean;
  is_deleted?: boolean;
  deleted?: boolean;
};

/* ── Helpers ───────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; bg: string; text: string }> =
  {
    pending: { label: "Pending", bg: "#FEF3C7", text: "#92400E" },
    preparing: { label: "Preparing", bg: "#DBEAFE", text: "#1D4ED8" },
    ready: { label: "Ready", bg: "#D1FAE5", text: "#047857" },
    completed: { label: "Completed", bg: "#F1F5F9", text: "#475569" },
    cancelled: { label: "Cancelled", bg: "#FFE4E6", text: "#BE123C" },
  };

const NEXT_STATUS: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

const fmtCur = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ── Component ─────────────────────────────────────────────── */
const toIsoFromInputs = (date: string, time: string) => {
  const iso = new Date(`${date}T${time}`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
};

const todayInput = () => new Date().toISOString().slice(0, 10);
const defaultTimeInput = () => {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  return `${String(next.getHours()).padStart(2, "0")}:${String(
    next.getMinutes(),
  ).padStart(2, "0")}`;
};

export default function TakeawayTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [orders, setOrders] = useState<TakeawayOrder[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [taxPercent, setTaxPercent] = useState<number>(0);

  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showReservationActions, setShowReservationActions] = useState(false);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [searchMenu, setSearchMenu] = useState("");
  const [orderType, setOrderType] = useState<"takeout" | "delivery">("takeout");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [reservationForm, setReservationForm] = useState({
    name: "",
    partySize: "2",
    date: todayInput(),
    time: defaultTimeInput(),
    tableId: "any",
    phone: "",
    notes: "",
  });
  const [walkInForm, setWalkInForm] = useState({
    name: "",
    partySize: "2",
    phone: "",
    quotedMins: "20",
  });

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) || null,
    [selectedZoneId, zones],
  );

  const tableOptions = useMemo(
    () =>
      tables
        .filter(
          (t) =>
            !(
              t?.is_archived ||
              t?.archived ||
              t?.is_deleted ||
              t?.deleted
            ),
        )
        .sort(
          (a, b) =>
            Number(a.table_number || a.number || 0) -
            Number(b.table_number || b.number || 0),
        ),
    [tables],
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

  /* ── Data Loading ───────────────────────────────────────── */
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
    const [me, menuRes, zonesRes, tablesRes] = await Promise.all([
      apiClient.get("/api/admin/me"),
      apiClient.get("/api/admin/menu"),
      apiClient.get("/api/admin/delivery/zones"),
      apiClient.get("/api/admin/tables"),
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
    setTables(Array.isArray(tablesRes) ? (tablesRes as TableOption[]) : []);

    // Logo
    const rId = me?.restaurant_id || me?.id;
    if (rId) {
      try {
        const logoRes = await fetch(
          `https://qrave-backend.onrender.com/public/restaurants/${rId}/logo`,
        );
        const logoData = await logoRes.json();
        setLogoUrl(logoData?.logo_url || null);
      } catch {
        setLogoUrl(null);
      }
    }
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

  /* ── Cart Helpers ───────────────────────────────────────── */
  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing)
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
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
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
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

  /* ── Create Order ───────────────────────────────────────── */
  const resetReservationForm = useCallback(() => {
    setReservationForm({
      name: "",
      partySize: "2",
      date: todayInput(),
      time: defaultTimeInput(),
      tableId: "any",
      phone: "",
      notes: "",
    });
    setShowReservationForm(false);
  }, []);

  const resetWalkInForm = useCallback(() => {
    setWalkInForm({
      name: "",
      partySize: "2",
      phone: "",
      quotedMins: "20",
    });
    setShowWalkInForm(false);
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
      Alert.alert("Created", "Order created successfully.");
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

  /* ── Status Update ──────────────────────────────────────── */
  const createReservation = useCallback(async () => {
    if (!reservationForm.name.trim()) {
      Alert.alert("Guest required", "Enter a guest name for the reservation.");
      return;
    }
    const iso = toIsoFromInputs(reservationForm.date, reservationForm.time);
    if (!iso) {
      Alert.alert("Invalid time", "Use a valid date and time.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/api/admin/reservations", {
        guest_name: reservationForm.name.trim(),
        party_size: Math.max(1, Number(reservationForm.partySize) || 1),
        reserved_at: iso,
        table_id: reservationForm.tableId || "any",
        phone: reservationForm.phone.trim() || undefined,
        notes: reservationForm.notes.trim() || undefined,
      });
      resetReservationForm();
      Alert.alert("Booked", "Reservation added successfully.");
    } catch {
      Alert.alert("Create failed", "Could not add reservation.");
    } finally {
      setBusy(false);
    }
  }, [reservationForm, resetReservationForm]);

  const createWalkIn = useCallback(async () => {
    if (!walkInForm.name.trim()) {
      Alert.alert("Guest required", "Enter a guest name for the waitlist.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/api/admin/waitlist", {
        guest_name: walkInForm.name.trim(),
        party_size: Math.max(1, Number(walkInForm.partySize) || 1),
        phone: walkInForm.phone.trim() || undefined,
        quoted_minutes: Math.max(5, Number(walkInForm.quotedMins) || 5),
      });
      resetWalkInForm();
      Alert.alert("Added", "Walk-in added to waitlist.");
    } catch {
      Alert.alert("Create failed", "Could not add walk-in.");
    } finally {
      setBusy(false);
    }
  }, [resetWalkInForm, walkInForm]);

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

  /* ── Loading State ──────────────────────────────────────── */
  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8CB46" />
        <ActivityIndicator color="#F59E0B" size="large" />
        <Text style={s.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8CB46" />

      {/* ── WAVY HEADER ── */}
      <AdminWavyHeader height={160}>
        <View style={s.headerTopRow}>
          <TouchableOpacity
            style={s.profileAvatar}
            activeOpacity={0.8}
            onPress={() => router.replace("/admin/profile")}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={s.profileImage} />
            ) : (
              <Image source={iconPng} style={s.profileImage} />
            )}
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Orders</Text>
          </View>
          <View style={s.headerActions}>
            <Pressable
              style={s.queueBtn}
              onPress={() => router.push("/admin/queue")}
            >
              <MaterialIcons name="format-list-bulleted" size={24} color="#0F172A" />
            </Pressable>
            <Pressable
              style={s.reservationBtn}
              onPress={() => setShowReservationActions(true)}
            >
              <MaterialIcons name="event-seat" size={22} color="#0F172A" />
            </Pressable>
            <Pressable
              style={s.newOrderBtn}
              onPress={() => setShowNewOrder(true)}
            >
              <MaterialIcons name="add" size={24} color="#0F172A" />
            </Pressable>
          </View>
        </View>
      </AdminWavyHeader>

      {/* ── MAIN CONTENT ── */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── FILTER TABS ── */}
        <View style={s.filterRow}>
          {[
            { key: "active", label: "Active" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
            { key: "all", label: "All" },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                s.filterChip,
                statusFilter === tab.key && s.filterChipActive,
              ]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text
                style={[
                  s.filterChipText,
                  statusFilter === tab.key && s.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── ORDER LIST ── */}
        {orders.length === 0 ? (
          <View style={s.emptyWrap}>
            <MaterialIcons name="inventory-2" size={48} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No orders yet</Text>
            <Text style={s.emptySub}>New orders will appear here.</Text>
          </View>
        ) : (
          <View style={s.orderList}>
            {orders.map((order) => {
              const meta = STATUS_META[order.status] || STATUS_META.pending;
              const nextStatus = NEXT_STATUS[order.status];
              const isExpanded = expandedOrder === order.id;
              return (
                <View key={order.id} style={s.orderCard}>
                  {/* Top Row */}
                  <View style={s.orderTopRow}>
                    <View style={s.badgeRow}>
                      <View
                        style={[s.statusBadge, { backgroundColor: meta.bg }]}
                      >
                        <Text style={[s.statusBadgeText, { color: meta.text }]}>
                          {meta.label}
                        </Text>
                      </View>
                      <View style={s.typeBadge}>
                        <MaterialIcons
                          name={
                            order.order_type === "delivery"
                              ? "delivery-dining"
                              : "shopping-bag"
                          }
                          size={12}
                          color="#475569"
                        />
                        <Text style={s.typeBadgeText}>
                          {order.order_type === "delivery"
                            ? "Delivery"
                            : "Takeout"}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.orderTotal}>{fmtCur(order.total || 0)}</Text>
                  </View>

                  {/* Time */}
                  <Text style={s.orderTime}>
                    {new Date(order.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </Text>

                  {/* Customer Info */}
                  {!!order.customer_name && (
                    <View style={s.metaRow}>
                      <MaterialIcons name="person" size={13} color="#94A3B8" />
                      <Text style={s.metaText}>{order.customer_name}</Text>
                    </View>
                  )}
                  {!!order.customer_phone && (
                    <View style={s.metaRow}>
                      <MaterialIcons name="phone" size={13} color="#94A3B8" />
                      <Text style={s.metaText}>{order.customer_phone}</Text>
                    </View>
                  )}
                  {!!order.delivery_zone && (
                    <View style={s.metaRow}>
                      <MaterialIcons name="place" size={13} color="#94A3B8" />
                      <Text style={s.metaText}>
                        {order.delivery_zone}
                        {order.delivery_fee > 0
                          ? ` · +${fmtCur(order.delivery_fee)}`
                          : ""}
                      </Text>
                    </View>
                  )}

                  {/* Expand / Collapse Items */}
                  <Pressable
                    style={s.expandBtn}
                    onPress={() =>
                      setExpandedOrder(isExpanded ? null : order.id)
                    }
                  >
                    <Text style={s.expandBtnText}>
                      {isExpanded
                        ? "Hide items"
                        : `${(order.items || []).length} item(s)`}
                    </Text>
                    <MaterialIcons
                      name={isExpanded ? "expand-less" : "expand-more"}
                      size={18}
                      color="#94A3B8"
                    />
                  </Pressable>

                  {isExpanded && (
                    <View style={s.itemsWrap}>
                      {(order.items || []).map((item, idx) => (
                        <View key={item.id || idx} style={s.itemRow}>
                          <Text style={s.itemName} numberOfLines={1}>
                            {item.menu_item_name}
                            {item.variant_label
                              ? ` (${item.variant_label})`
                              : ""}
                          </Text>
                          <Text style={s.itemQty}>
                            x{item.quantity} ·{" "}
                            {fmtCur(
                              item.total_price ||
                                item.unit_price * item.quantity,
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Actions */}
                  {(nextStatus || order.status === "pending") && (
                    <View style={s.orderActions}>
                      {nextStatus && (
                        <Pressable
                          style={s.primaryAction}
                          onPress={() => updateStatus(order.id, nextStatus)}
                          disabled={updatingOrderId === order.id}
                        >
                          {updatingOrderId === order.id ? (
                            <ActivityIndicator color="#FFF" size="small" />
                          ) : (
                            <Text style={s.primaryActionText}>
                              Mark{" "}
                              {STATUS_META[nextStatus]?.label || nextStatus}
                            </Text>
                          )}
                        </Pressable>
                      )}
                      {order.status === "pending" && (
                        <Pressable
                          style={s.cancelAction}
                          onPress={() =>
                            Alert.alert(
                              "Cancel Order?",
                              "This cannot be undone.",
                              [
                                { text: "No", style: "cancel" },
                                {
                                  text: "Yes, Cancel",
                                  style: "destructive",
                                  onPress: () =>
                                    updateStatus(order.id, "cancelled"),
                                },
                              ],
                            )
                          }
                        >
                          <Text style={s.cancelActionText}>Cancel</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── NEW ORDER MODAL ── */}
      <Modal
        visible={showReservationActions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowReservationActions(false)}
      >
        <View style={s.choiceOverlay}>
          <View style={s.choiceCard}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Reservations & Waitlist</Text>
              <Pressable onPress={() => setShowReservationActions(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <Text style={s.choiceSub}>
              Reserve a table or add walk-in guests to the live queue.
            </Text>
            <View style={s.choiceActions}>
              <Pressable
                style={s.choiceBtn}
                onPress={() => {
                  setShowReservationActions(false);
                  setShowReservationForm(true);
                }}
              >
                <MaterialIcons
                  name="event-available"
                  size={22}
                  color="#0F172A"
                />
                <View style={s.choiceTextWrap}>
                  <Text style={s.choiceTitle}>Book Reservation</Text>
                  <Text style={s.choiceHint}>Schedule a table hold</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
              </Pressable>
              <Pressable
                style={[s.choiceBtn, s.choiceBtnGreen]}
                onPress={() => {
                  setShowReservationActions(false);
                  setShowWalkInForm(true);
                }}
              >
                <MaterialIcons name="group-add" size={22} color="#047857" />
                <View style={s.choiceTextWrap}>
                  <Text style={[s.choiceTitle, s.choiceTitleGreen]}>
                    Add Walk-in
                  </Text>
                  <Text style={s.choiceHint}>Place guests on waitlist</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#10B981" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReservationForm}
        animationType="slide"
        transparent
        onRequestClose={resetReservationForm}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Book Reservation</Text>
              <Pressable onPress={resetReservationForm}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={s.fieldLabel}>Guest Name</Text>
              <TextInput
                style={s.input}
                value={reservationForm.name}
                onChangeText={(text) =>
                  setReservationForm((prev) => ({ ...prev, name: text }))
                }
                placeholder="Aanya Sharma"
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.fieldLabel}>Party Size</Text>
              <TextInput
                style={s.input}
                value={reservationForm.partySize}
                onChangeText={(text) =>
                  setReservationForm((prev) => ({ ...prev, partySize: text }))
                }
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor="#94A3B8"
              />
              <View style={s.formGrid}>
                <View style={s.formHalf}>
                  <Text style={s.fieldLabel}>Date</Text>
                  <TextInput
                    style={s.input}
                    value={reservationForm.date}
                    onChangeText={(text) =>
                      setReservationForm((prev) => ({ ...prev, date: text }))
                    }
                    placeholder="yyyy-mm-dd"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={s.formHalf}>
                  <Text style={s.fieldLabel}>Time</Text>
                  <TextInput
                    style={s.input}
                    value={reservationForm.time}
                    onChangeText={(text) =>
                      setReservationForm((prev) => ({ ...prev, time: text }))
                    }
                    placeholder="19:30"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
              <Text style={s.fieldLabel}>Table Pre-assignment</Text>
              <View style={s.chipRow}>
                <Pressable
                  style={[
                    s.zoneChip,
                    reservationForm.tableId === "any" && s.zoneChipActive,
                  ]}
                  onPress={() =>
                    setReservationForm((prev) => ({ ...prev, tableId: "any" }))
                  }
                >
                  <Text
                    style={[
                      s.zoneChipText,
                      reservationForm.tableId === "any" &&
                        s.zoneChipTextActive,
                    ]}
                  >
                    Any table
                  </Text>
                </Pressable>
                {tableOptions.slice(0, 18).map((table) => {
                  const tableLabel =
                    table.table_number || table.number || table.id;
                  const tableId = String(table.id || tableLabel);
                  return (
                    <Pressable
                      key={tableId}
                      style={[
                        s.zoneChip,
                        reservationForm.tableId === tableId &&
                          s.zoneChipActive,
                      ]}
                      onPress={() =>
                        setReservationForm((prev) => ({
                          ...prev,
                          tableId,
                        }))
                      }
                    >
                      <Text
                        style={[
                          s.zoneChipText,
                          reservationForm.tableId === tableId &&
                            s.zoneChipTextActive,
                        ]}
                      >
                        T{tableLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.fieldLabel}>Phone (optional)</Text>
              <TextInput
                style={s.input}
                value={reservationForm.phone}
                onChangeText={(text) =>
                  setReservationForm((prev) => ({ ...prev, phone: text }))
                }
                keyboardType="phone-pad"
                placeholder="+91 98xxxxxx"
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[s.input, { minHeight: 58 }]}
                value={reservationForm.notes}
                onChangeText={(text) =>
                  setReservationForm((prev) => ({ ...prev, notes: text }))
                }
                placeholder="Anniversary seating"
                placeholderTextColor="#94A3B8"
                multiline
              />
              <View style={s.modalActions}>
                <Pressable style={s.cancelBtn} onPress={resetReservationForm}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.createBtn, busy && s.btnDisabled]}
                  onPress={createReservation}
                  disabled={busy}
                >
                  <Text style={s.createBtnText}>
                    {busy ? "Saving..." : "Add Reservation"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWalkInForm}
        animationType="slide"
        transparent
        onRequestClose={resetWalkInForm}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Add Walk-in</Text>
              <Pressable onPress={resetWalkInForm}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={s.fieldLabel}>Guest Name</Text>
              <TextInput
                style={s.input}
                value={walkInForm.name}
                onChangeText={(text) =>
                  setWalkInForm((prev) => ({ ...prev, name: text }))
                }
                placeholder="Rahul Singh"
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.fieldLabel}>Party Size</Text>
              <TextInput
                style={s.input}
                value={walkInForm.partySize}
                onChangeText={(text) =>
                  setWalkInForm((prev) => ({ ...prev, partySize: text }))
                }
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.fieldLabel}>Phone (optional)</Text>
              <TextInput
                style={s.input}
                value={walkInForm.phone}
                onChangeText={(text) =>
                  setWalkInForm((prev) => ({ ...prev, phone: text }))
                }
                keyboardType="phone-pad"
                placeholder="+91 98xxxxxx"
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.fieldLabel}>Quoted Wait (mins)</Text>
              <TextInput
                style={s.input}
                value={walkInForm.quotedMins}
                onChangeText={(text) =>
                  setWalkInForm((prev) => ({ ...prev, quotedMins: text }))
                }
                keyboardType="number-pad"
                placeholder="20"
                placeholderTextColor="#94A3B8"
              />
              <View style={s.modalActions}>
                <Pressable style={s.cancelBtn} onPress={resetWalkInForm}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.createBtn, s.createBtnGreen, busy && s.btnDisabled]}
                  onPress={createWalkIn}
                  disabled={busy}
                >
                  <Text style={s.createBtnText}>
                    {busy ? "Saving..." : "Add to Waitlist"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNewOrder}
        animationType="slide"
        transparent
        onRequestClose={resetForm}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>New Order</Text>
              <Pressable onPress={resetForm}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Order Type */}
              <Text style={s.fieldLabel}>Order Type</Text>
              <View style={s.segmentRow}>
                {(["takeout", "delivery"] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[
                      s.segmentBtn,
                      orderType === t && s.segmentBtnActive,
                    ]}
                    onPress={() => setOrderType(t)}
                  >
                    <MaterialIcons
                      name={
                        t === "delivery" ? "delivery-dining" : "shopping-bag"
                      }
                      size={16}
                      color={orderType === t ? "#0F172A" : "#94A3B8"}
                    />
                    <Text
                      style={[
                        s.segmentText,
                        orderType === t && s.segmentTextActive,
                      ]}
                    >
                      {t === "takeout" ? "Takeout" : "Delivery"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Customer */}
              <Text style={s.fieldLabel}>Customer Name</Text>
              <TextInput
                style={s.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Optional"
                placeholderTextColor="#94A3B8"
              />

              <Text style={s.fieldLabel}>Phone Number</Text>
              <TextInput
                style={s.input}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="Optional"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              {orderType === "delivery" && (
                <>
                  <Text style={s.fieldLabel}>Delivery Address</Text>
                  <TextInput
                    style={s.input}
                    value={deliveryAddress}
                    onChangeText={setDeliveryAddress}
                    placeholder="Full delivery address"
                    placeholderTextColor="#94A3B8"
                  />

                  {zones.length > 0 && (
                    <>
                      <Text style={s.fieldLabel}>Delivery Zone</Text>
                      <View style={s.chipRow}>
                        {zones.map((z) => (
                          <Pressable
                            key={z.id}
                            style={[
                              s.zoneChip,
                              selectedZoneId === z.id && s.zoneChipActive,
                            ]}
                            onPress={() => setSelectedZoneId(z.id)}
                          >
                            <Text
                              style={[
                                s.zoneChipText,
                                selectedZoneId === z.id && s.zoneChipTextActive,
                              ]}
                            >
                              {z.name} · {fmtCur(z.fee)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Payment */}
              <Text style={s.fieldLabel}>Payment Mode</Text>
              <View style={s.chipRow}>
                {["cash", "upi", "card"].map((m) => (
                  <Pressable
                    key={m}
                    style={[s.zoneChip, paymentMode === m && s.zoneChipActive]}
                    onPress={() => setPaymentMode(m)}
                  >
                    <Text
                      style={[
                        s.zoneChipText,
                        paymentMode === m && s.zoneChipTextActive,
                      ]}
                    >
                      {m.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Notes */}
              <Text style={s.fieldLabel}>Notes</Text>
              <TextInput
                style={[s.input, { minHeight: 60 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Special instructions..."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
              />

              {/* Menu Search */}
              <Text style={s.fieldLabel}>Add Items</Text>
              <TextInput
                style={s.input}
                value={searchMenu}
                onChangeText={setSearchMenu}
                placeholder="Search menu..."
                placeholderTextColor="#94A3B8"
              />

              <View style={s.menuList}>
                {filteredMenu.map((item) => (
                  <Pressable
                    key={item.id}
                    style={s.menuRow}
                    onPress={() => addToCart(item)}
                  >
                    <View>
                      <Text style={s.menuName}>{item.name}</Text>
                      <Text style={s.menuPrice}>{fmtCur(item.price)}</Text>
                    </View>
                    <MaterialIcons
                      name="add-circle-outline"
                      size={20}
                      color="#0F172A"
                    />
                  </Pressable>
                ))}
              </View>

              {/* Cart */}
              <Text style={s.fieldLabel}>Cart ({cart.length})</Text>
              {cart.length === 0 ? (
                <Text style={s.emptyCart}>No items added</Text>
              ) : (
                cart.map((c) => (
                  <View key={c.menuItemId} style={s.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cartName}>{c.menuItemName}</Text>
                      <Text style={s.menuPrice}>
                        {fmtCur(c.unitPrice * c.quantity)}
                      </Text>
                    </View>
                    <View style={s.qtyWrap}>
                      <Pressable
                        style={s.qtyBtn}
                        onPress={() => updateQty(c.menuItemId, -1)}
                      >
                        <MaterialIcons
                          name="remove"
                          size={14}
                          color="#475569"
                        />
                      </Pressable>
                      <Text style={s.qtyText}>{c.quantity}</Text>
                      <Pressable
                        style={s.qtyBtn}
                        onPress={() => updateQty(c.menuItemId, 1)}
                      >
                        <MaterialIcons name="add" size={14} color="#475569" />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}

              {/* Total */}
              <View style={s.totalBox}>
                <Text style={s.totalLine}>Subtotal: {fmtCur(cartTotal)}</Text>
                {taxPercent > 0 && (
                  <Text style={s.totalLine}>
                    Tax ({taxPercent}%): {fmtCur(computedTax)}
                  </Text>
                )}
                {deliveryFee > 0 && (
                  <Text style={s.totalLine}>
                    Delivery Fee: {fmtCur(deliveryFee)}
                  </Text>
                )}
                <Text style={s.totalFinal}>Total: {fmtCur(finalTotal)}</Text>
              </View>

              {/* Actions */}
              <View style={s.modalActions}>
                <Pressable style={s.cancelBtn} onPress={resetForm}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.createBtn, busy && s.btnDisabled]}
                  onPress={createOrder}
                  disabled={busy}
                >
                  <Text style={s.createBtnText}>
                    {busy ? "Creating..." : "Create Order"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    gap: 12,
  },
  loadingText: { color: "#64748B", fontWeight: "700", fontSize: 14 },

  /* Header */
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: "hidden",
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  reservationBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 21,
  },
  queueBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 21,
  },
  newOrderBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 21,
  },

  /* Scroll */
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 30 },

  /* Filter Tabs */
  filterRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  filterChipActive: { borderColor: "#0F172A", backgroundColor: "#0F172A" },
  filterChipText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  filterChipTextActive: { color: "#FFFFFF" },

  /* Empty */
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: { color: "#475569", fontSize: 16, fontWeight: "800" },
  emptySub: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },

  /* Order Card */
  orderList: { gap: 12 },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
  },
  typeBadgeText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  orderTotal: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  orderTime: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },

  /* Meta */
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  metaText: { color: "#475569", fontSize: 12, fontWeight: "600" },

  /* Expand */
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
    backgroundColor: "#F8FAFC",
  },
  expandBtnText: { color: "#475569", fontSize: 12, fontWeight: "700" },

  /* Items */
  itemsWrap: { marginTop: 6, gap: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  itemName: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  itemQty: { color: "#475569", fontSize: 12, fontWeight: "800" },

  /* Actions */
  orderActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  primaryAction: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#0F172A",
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
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelActionText: { color: "#DC2626", fontSize: 12, fontWeight: "800" },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  choiceOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 18,
  },
  choiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  choiceSub: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  choiceActions: { gap: 10 },
  choiceBtn: {
    minHeight: 66,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
  },
  choiceBtnGreen: { backgroundColor: "#ECFDF5", borderColor: "#D1FAE5" },
  choiceTextWrap: { flex: 1 },
  choiceTitle: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  choiceTitleGreen: { color: "#047857" },
  choiceHint: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  queuePreviewGrid: { gap: 10, marginTop: 14 },
  queuePreviewCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 12,
  },
  queuePreviewLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  queueRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    marginTop: 8,
  },
  queueName: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  queueMeta: { color: "#64748B", fontSize: 12, fontWeight: "600", marginTop: 2 },
  queueEmptyText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  modalSheet: {
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitle: { color: "#0F172A", fontSize: 20, fontWeight: "900" },
  fieldLabel: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#0F172A",
    fontWeight: "600",
    backgroundColor: "#FFFFFF",
    marginBottom: 4,
  },
  formGrid: { flexDirection: "row", gap: 10 },
  formHalf: { flex: 1 },
  segmentRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  segmentBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
  },
  segmentBtnActive: { borderColor: "#0F172A", backgroundColor: "#F1F5F9" },
  segmentText: { color: "#94A3B8", fontSize: 13, fontWeight: "700" },
  segmentTextActive: { color: "#0F172A", fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  zoneChip: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  zoneChipActive: { borderColor: "#0F172A", backgroundColor: "#F1F5F9" },
  zoneChipText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  zoneChipTextActive: { color: "#0F172A" },
  menuList: { marginTop: 4, marginBottom: 8, gap: 6 },
  menuRow: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  menuName: { color: "#334155", fontSize: 13, fontWeight: "700" },
  menuPrice: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  emptyCart: { color: "#94A3B8", fontWeight: "600", marginBottom: 6 },
  cartRow: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cartName: { color: "#334155", fontSize: 13, fontWeight: "700" },
  qtyWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  qtyText: {
    color: "#0F172A",
    fontWeight: "800",
    minWidth: 18,
    textAlign: "center",
  },
  totalBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 12,
    marginBottom: 8,
  },
  totalLine: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 3,
  },
  totalFinal: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: { color: "#475569", fontSize: 14, fontWeight: "700" },
  createBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnGreen: { backgroundColor: "#059669" },
  createBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
});
