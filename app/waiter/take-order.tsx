import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";
import WaiterWavyHeader from "../../components/waiter/WaiterWavyHeader";

type Variant = {
  id: string;
  label: string;
  price: number;
};

type MenuItem = {
  id: string;
  name: string;
  categoryName: string;
  parentCategoryName: string;
  price: number;
  isAvailable: boolean;
  isArchived: boolean;
  isOutOfStock: boolean;
  stockCount: number | null;
  imageUrl: string;
  description: string;
  variants: Variant[];
};

type CategoryOption = {
  id: string;
  name: string;
  parent_id?: string | null;
};

type CartEntry = {
  qty: number;
  variantId: string | null;
  price: number;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFB" },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: WaiterColors.text,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabsScroll: { flexGrow: 0, marginBottom: 10 },
  tabsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tabActive: {
    backgroundColor: WaiterColors.primary,
    borderColor: WaiterColors.primary,
  },
  tabText: {
    color: "#64748B",
    fontWeight: "600",
    textTransform: "capitalize",
    fontSize: 13,
  },
  tabTextActive: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 180 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  imageBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  image: { width: 56, height: 56, borderRadius: 10 },
  name: { fontSize: 15, fontWeight: "700", color: WaiterColors.text },
  desc: { color: "#64748B", fontSize: 12, marginTop: 2 },
  price: { fontWeight: "800", color: WaiterColors.text, marginTop: 2 },
  categoryText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  meta: { marginTop: 2 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#E6F7F5",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontWeight: "800",
    color: WaiterColors.text,
    minWidth: 16,
    textAlign: "center",
  },
  loadingBox: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 10, color: "#6b7280", fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyStateText: { color: "#6b7280", fontWeight: "600", textAlign: "center" },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 85,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerTotal: { fontWeight: "800", color: WaiterColors.text },
  footerBtn: {
    backgroundColor: WaiterColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  footerBtnDisabled: { opacity: 0.5 },
  footerBtnText: { color: "#fff", fontWeight: "800" },
  instructionsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 100, // Make sure it sits above the footerBar which is at bottom: 85
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  instructionsInput: {
    fontSize: 13,
    color: WaiterColors.text,
    minHeight: 36,
  },
  fab: {
    position: "absolute",
    bottom: 160,
    right: 24,
    backgroundColor: WaiterColors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: WaiterColors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalCategoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
    textTransform: "capitalize",
  },
  categoryTextActive: {
    color: WaiterColors.primary,
    fontWeight: "800",
  },
});

export default function TakeOrder() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tableId = String(params.table_id || "");
  const tableNumber = params.table_number
    ? Number(params.table_number)
    : undefined;
  const initialSessionId = params.session_id ? String(params.session_id) : "";
  const initialRestaurantId = params.restaurant_id
    ? String(params.restaurant_id)
    : "";

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );

  const resolveParentName = (item: MenuItem) =>
    item.parentCategoryName || item.categoryName || "Uncategorized";

  const getDefaultVariant = (item: MenuItem) =>
    item.variants && item.variants.length > 0 ? item.variants[0] : null;

  const refreshMenu = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get("/api/admin/menu");
      const list = Array.isArray(data) ? data : [];
      const normalized: MenuItem[] = list.map((item: any) => {
        const name =
          typeof item.name === "object"
            ? (item.name?.String ?? "")
            : (item.name ?? "");
        const description = item.description?.String ?? item.description ?? "";
        const categoryName =
          typeof item.categoryName === "object"
            ? (item.categoryName?.String ?? "")
            : (item.categoryName ?? "");
        const parentCategoryName =
          typeof item.parentCategoryName === "object"
            ? (item.parentCategoryName?.String ?? "")
            : (item.parentCategoryName ?? "");
        const imageUrl =
          item.imageUrl?.String ??
          item.imageUrl ??
          item.image_url?.String ??
          item.image_url ??
          "";
        const priceRaw =
          typeof item.price === "object"
            ? (item.price?.Float ?? item.price?.Int)
            : item.price;
        const variants = Array.isArray(item.variants) ? item.variants : [];

        return {
          id: String(item.id ?? item.menu_item_id ?? item.item_id ?? name),
          name,
          categoryName,
          parentCategoryName,
          price: Number(priceRaw) || 0,
          isAvailable: item.isAvailable ?? true,
          isArchived: item.isArchived ?? item.is_archived ?? false,
          isOutOfStock: item.isOutOfStock ?? item.is_out_of_stock ?? false,
          stockCount: item.stockCount ?? null,
          imageUrl,
          description: description || "",
          variants,
        };
      });
      setItems(normalized);
    } catch (e: any) {
      setLoadError(e?.message || "Failed to load menu items");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const data = await api.get("/api/admin/menu/categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      // categories optional
    }
  }, []);

  useEffect(() => {
    refreshMenu();
    refreshCategories();
  }, [refreshMenu, refreshCategories]);

  useEffect(() => {
    setCart({});
  }, [tableId, initialSessionId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshMenu(true), refreshCategories()]);
    setRefreshing(false);
  }, [refreshMenu, refreshCategories]);

  const availableItems = useMemo(() => {
    return items.filter((item) => {
      if (item.isArchived) return false;
      if (!item.isAvailable) return false;
      if (item.isOutOfStock) return false;
      if (item.stockCount != null && item.stockCount <= 0) return false;
      return true;
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    return availableItems.filter((item) => {
      const matchesTab =
        activeCategory === "all" || resolveParentName(item) === activeCategory;
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [availableItems, activeCategory, search]);

  const categoryTabs = useMemo(
    () => ["all", ...parentCategories.map((c) => c.name)],
    [parentCategories],
  );

  const updateQty = (item: MenuItem, delta: number) => {
    const variant = getDefaultVariant(item);
    const variantId = variant ? variant.id : null;
    const price = variant ? Number(variant.price) || item.price : item.price;

    setCart((prev) => {
      const current = prev[item.id]?.qty || 0;
      const nextQty = Math.max(0, current + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return {
        ...prev,
        [item.id]: { qty: nextQty, variantId, price },
      };
    });
  };

  const totalAmount = useMemo(() => {
    return Object.values(cart).reduce(
      (sum, entry) => sum + entry.qty * (entry.price || 0),
      0,
    );
  }, [cart]);

  const totalItems = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
  }, [cart]);

  const handlePlaceOrder = async () => {
    if (submitting) return;
    const cartItems = Object.entries(cart);
    if (cartItems.length === 0) return;

    setSubmitting(true);
    try {
      let sessionId = initialSessionId;
      let restaurantId = initialRestaurantId;

      if (!restaurantId) {
        try {
          const me: any = await api.get("/api/admin/me");
          restaurantId = me?.restaurant_id || "";
        } catch {
          // ignore
        }
      }

      if (!sessionId) {
        const payload: any = {};
        if (restaurantId) payload.restaurant_id = restaurantId;
        if (tableId) payload.table_id = tableId;
        if (!tableId && tableNumber) payload.table_number = tableNumber;

        const started: any = await api.post("/public/session/start", payload);
        sessionId = started?.session_id || started?.sessionId || "";
      }

      if (!sessionId) {
        Alert.alert("Error", "Unable to start session for this table.");
        return;
      }

      const orderPayload: any = {
        session_id: sessionId,
      };
      if (specialInstructions.trim()) {
        orderPayload.special_instructions = specialInstructions.trim();
        orderPayload.notes = specialInstructions.trim();
      }

      const orderRes: any = await api.post(
        `/api/customer/orders?session_id=${sessionId}`,
        orderPayload,
      );
      const orderId = orderRes?.order_id || orderRes?.orderId;
      if (!orderId) {
        Alert.alert("Error", "Failed to create order.");
        return;
      }

      for (const [itemId, entry] of cartItems) {
        await api.post(`/api/customer/orders/items?session_id=${sessionId}`, {
          order_id: orderId,
          menu_item_id: itemId,
          variant_id: entry.variantId,
          quantity: entry.qty,
          price: entry.price,
        });
      }

      const finalizePayload: any = {
        order_id: orderId,
      };
      if (specialInstructions.trim()) {
        finalizePayload.special_instructions = specialInstructions.trim();
        finalizePayload.notes = specialInstructions.trim();
      }

      await api.post(`/api/customer/orders/finalize?session_id=${sessionId}`, finalizePayload);
      Alert.alert("Success", "Order placed successfully.");
      router.replace("/waiter/customize-tables");
    } catch (e: any) {
      const msg = e?.body?.message || e?.message || "Failed to place order";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <WaiterWavyHeader
        title={`Take Order${tableNumber ? ` - Table ${tableNumber}` : ""}`}
        subtitle="Select items to add to the order"
        height={130}
      />

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search items..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor="#64748B"
        />
      </View>


      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={WaiterColors.primary} />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{loadError}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={WaiterColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No available items found.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const variant = getDefaultVariant(item);
            const price = variant
              ? Number(variant.price) || item.price
              : item.price;
            const qty = cart[item.id]?.qty || 0;

            return (
              <View style={styles.card}>
                <View style={styles.imageBox}>
                  {item.imageUrl && !imageErrors[item.id] ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.image}
                      onError={() =>
                        setImageErrors((prev) => ({ ...prev, [item.id]: true }))
                      }
                    />
                  ) : (
                    <Text style={{ color: "#94A3B8", fontWeight: "700" }}>
                      {item.name.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.desc} numberOfLines={2}>
                    {item.description || "No description"}
                  </Text>
                  <View style={styles.meta}>
                    <Text style={styles.categoryText}>
                      {resolveParentName(item)}
                    </Text>
                    <Text style={styles.price}>
                      Rs {price.toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQty(item, -1)}
                  >
                    <Text
                      style={{ fontWeight: "800", color: WaiterColors.text }}
                    >
                      -
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQty(item, 1)}
                  >
                    <Text
                      style={{ fontWeight: "800", color: WaiterColors.text }}
                    >
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {totalItems > 0 && (
        <View style={styles.instructionsBox}>
          <TextInput
            placeholder="📝 Special client notes / Kitchen instructions..."
            placeholderTextColor="#94A3B8"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            style={styles.instructionsInput}
            multiline
          />
        </View>
      )}

      {/* Filter FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => setFilterModalVisible(true)}
      >
        <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
        <Text style={styles.fabText}>Filter</Text>
      </TouchableOpacity>

      <View style={styles.footerBar}>
        <Text style={styles.footerTotal}>
          {totalItems} items · Rs {totalAmount.toLocaleString()}
        </Text>
        <TouchableOpacity
          style={[
            styles.footerBtn,
            totalItems === 0 || submitting ? styles.footerBtnDisabled : null,
          ]}
          disabled={totalItems === 0 || submitting}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.footerBtnText}>
            {submitting ? "Placing..." : "Place Order"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categories Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setFilterModalVisible(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <MaterialIcons name="close" size={28} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {categoryTabs.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={styles.categoryRow}
                  onPress={() => {
                    setActiveCategory(tab);
                    setFilterModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalCategoryText,
                      activeCategory === tab && styles.categoryTextActive,
                    ]}
                  >
                    {tab === "all" ? "All Categories" : tab}
                  </Text>
                  {activeCategory === tab && (
                    <MaterialIcons name="check-circle" size={24} color={WaiterColors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}
