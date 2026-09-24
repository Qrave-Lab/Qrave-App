import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";
import WaiterWavyHeader from "../../components/waiter/WaiterWavyHeader";
import { MaterialIcons } from "@expo/vector-icons";

type MenuItem = {
  id: string;
  categoryId?: string;
  name: string;
  categoryName: string;
  parentCategoryName: string;
  price: number;
  isAvailable: boolean;
  isArchived: boolean;
  isOutOfStock: boolean;
  stockCount: number | null;
  imageUrl?: string;
  description?: string;
  modelGlb?: string;
  modelUsdz?: string;
  availableDays?: string[];
  _raw?: any;
};

type CategoryOption = {
  id: string;
  name: string;
  parent_id?: string | null;
};

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLUMN_GAP = 16;
const PADDING_HORIZONTAL = 20;
// Calculate precise card width for 2 columns with gaps
const CARD_WIDTH = (width - PADDING_HORIZONTAL * 2 - COLUMN_GAP) / 2;

export default function WaiterMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const keyboardSub = Keyboard.addListener("keyboardDidHide", () => {
      searchInputRef.current?.blur();
    });
    return () => keyboardSub.remove();
  }, []);

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );

  const resolveParentName = (item: MenuItem) =>
    item.parentCategoryName || item.categoryName || "Uncategorized";

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

        const modelGlb = item.modelGlb?.String ?? item.modelGlb ?? "";
        const modelUsdz = item.modelUsdz?.String ?? item.modelUsdz ?? "";

        return {
          id: String(item.id ?? item.menu_item_id ?? item.item_id ?? name),
          categoryId: item.categoryId ?? item.category_id ?? "",
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
          modelGlb,
          modelUsdz,
          availableDays: item.availableDays || item.available_days || [],
          _raw: item,
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshMenu(true), refreshCategories()]);
    setRefreshing(false);
  }, [refreshMenu, refreshCategories]);

  const toggleStock = async (item: MenuItem) => {
    const newVal = !item.isOutOfStock;
    
    // Optimistic UI Update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isOutOfStock: newVal } : i))
    );
    if (selectedItem?.id === item.id) {
      setSelectedItem((prev) => prev ? { ...prev, isOutOfStock: newVal } : null);
    }

    try {
      const raw = item._raw || {};
      await api.put(`/api/admin/menu/item?item_id=${item.id}`, {
        category_id: item.categoryId || undefined,
        name: item.name,
        price: item.price,
        description: item.description || "",
        calories: raw.calories,
        food_cost: raw.foodCost ?? raw.food_cost ?? 0,
        estimated_prep_minutes: raw.estimatedPrepMinutes ?? raw.estimated_prep_minutes,
        is_veg: raw.isVeg ?? raw.is_veg,
        dietary_manual_override: raw.dietaryManualOverride ?? raw.dietary_manual_override,
        image_url: item.imageUrl || "",
        model_glb: item.modelGlb || "",
        model_usdz: item.modelUsdz || "",
        available_days: item.availableDays || [],
        is_archived: item.isArchived,
        is_out_of_stock: newVal,
        is_todays_special: raw.isTodaysSpecial ?? raw.is_todays_special,
        is_chef_special: raw.isChefSpecial ?? raw.is_chef_special,
        is_best_seller: raw.isBestSeller ?? raw.is_best_seller,
        is_new: raw.isNew ?? raw.is_new,
        spice_level: raw.spiceLevel ?? raw.spice_level || "none",
        pair_with_item_ids: raw.pairWithItemIds ?? raw.pair_with_item_ids || [],
        publish_at: raw.publishAt ?? raw.publish_at,
        unpublish_at: raw.unpublishAt ?? raw.unpublish_at,
        scheduled_price: raw.scheduledPrice ?? raw.scheduled_price,
        scheduled_price_effective_at: raw.scheduledPriceEffectiveAt ?? raw.scheduled_price_effective_at,
        special_note: raw.specialNote ?? raw.special_note || "",
        hsn_code: raw.hsnCode ?? raw.hsn_code || "",
        gst_rate: raw.gstRate ?? raw.gst_rate,
        width_cm: raw.widthCm ?? raw.width_cm,
        height_cm: raw.heightCm ?? raw.height_cm,
        depth_cm: raw.depthCm ?? raw.depth_cm,
        has_steam: raw.hasSteam ?? raw.has_steam,
        model_scale: raw.modelScale ?? raw.model_scale,
      });
    } catch (error: any) {
      // Rollback on failure
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isOutOfStock: !newVal } : i))
      );
      if (selectedItem?.id === item.id) {
        setSelectedItem((prev) => prev ? { ...prev, isOutOfStock: !newVal } : null);
      }
      Alert.alert("Error", "Failed to update stock status: " + (error?.body?.message || error?.message || String(error)));
    }
  };

  const availableItems = useMemo(() => {
    return items.filter((item) => {
      if (item.isArchived) return false;
      if (!item.isAvailable) return false;
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <WaiterWavyHeader height={140}>
          <View style={styles.headerTopRow}>
            <Text style={styles.mainTitle}>Menu</Text>
            <Text style={styles.subTitle}>Explore available items</Text>
          </View>
        </WaiterWavyHeader>

        {/* Premium Search Bar mimicking Floor Tab */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={24} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              placeholder="Search food items..."
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholderTextColor="#94A3B8"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} style={styles.clearBtn}>
                <MaterialIcons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
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
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => setSelectedItem(item)}>
                <View style={styles.imageBox}>
                  {item.imageUrl && !imageErrors[item.id] ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={[styles.image, item.isOutOfStock && styles.imageOOS]}
                      resizeMode="cover"
                      onError={() =>
                        setImageErrors((prev) => ({ ...prev, [item.id]: true }))
                      }
                    />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <MaterialIcons name="fastfood" size={40} color="#CBD5E1" />
                    </View>
                  )}
                  {item.isOutOfStock && (
                    <View style={styles.oosOverlay}>
                      <Text style={styles.oosOverlayText}>Out of Stock</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.infoBox}>
                  <Text style={[styles.name, item.isOutOfStock && styles.textOOS]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.price, item.isOutOfStock && styles.textOOS]}>
                    Rs {item.price.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
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

        {/* Item Details Modal */}
        <Modal
          visible={!!selectedItem}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedItem(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={() => setSelectedItem(null)} 
            />
            {selectedItem && (
              <View style={[styles.modalContent, styles.detailContent]}>
                <View style={styles.detailImageWrapper}>
                  {selectedItem.imageUrl ? (
                    <Image source={{ uri: selectedItem.imageUrl }} style={styles.detailImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.detailImage, styles.placeholderImage]}>
                      <MaterialIcons name="fastfood" size={60} color="#CBD5E1" />
                    </View>
                  )}
                  
                  <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setSelectedItem(null)} activeOpacity={0.8}>
                    <MaterialIcons name="close" size={22} color="#0F172A" />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailBody}>
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailTitle} numberOfLines={2}>{selectedItem.name}</Text>
                  </View>
                  <Text style={styles.detailPrice}>Rs {selectedItem.price.toLocaleString()}</Text>
                  
                  <View style={styles.badgeRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{resolveParentName(selectedItem)}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.detailSectionTitle}>Description & Ingredients</Text>
                  <ScrollView style={styles.descScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.detailDesc}>
                      {selectedItem.description || "No description or ingredients provided for this item."}
                    </Text>
                  </ScrollView>

                  <View style={styles.detailActionRow}>
                    <TouchableOpacity
                      style={[
                        styles.stockBtn,
                        selectedItem.isOutOfStock ? styles.stockBtnOut : styles.stockBtnIn
                      ]}
                      onPress={() => toggleStock(selectedItem)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons 
                        name={selectedItem.isOutOfStock ? "cancel" : "check-circle"} 
                        size={22} 
                        color={selectedItem.isOutOfStock ? "#EF4444" : "#10B981"} 
                      />
                      <Text style={[
                        styles.stockBtnText,
                        selectedItem.isOutOfStock ? styles.stockBtnTextOut : styles.stockBtnTextIn
                      ]}>
                        {selectedItem.isOutOfStock ? "Mark as In Stock" : "Mark as Out of Stock"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </Modal>

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
                        styles.categoryText,
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
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC" 
  },
  headerTopRow: {
    // Removed redundant padding and marginTop since WaiterWavyHeader handles it
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -1,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#475569",
    marginTop: 4,
  },
  searchWrapper: {
    paddingHorizontal: PADDING_HORIZONTAL,
    marginTop: 0,
    marginBottom: 16,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "500",
    height: "100%",
  },
  clearBtn: {
    padding: 4,
  },
  listContent: { 
    paddingHorizontal: PADDING_HORIZONTAL, 
    paddingBottom: 100, // Room for FAB
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: COLUMN_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: "hidden",
  },
  imageBox: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  image: { 
    width: "100%", 
    height: "100%", 
    backgroundColor: "#F1F5F9"
  },
  imageOOS: {
    opacity: 0.5,
  },
  placeholderImage: {
    width: "100%", 
    height: "100%", 
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  oosOverlayText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoBox: {
    padding: 12,
  },
  name: { 
    fontSize: 15, 
    fontWeight: "700", 
    color: "#0F172A",
    lineHeight: 20,
    marginBottom: 6,
  },
  price: { 
    fontSize: 15,
    fontWeight: "800", 
    color: "#0F172A",
  },
  textOOS: {
    color: "#94A3B8",
  },
  fab: {
    position: "absolute",
    bottom: 90,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)", // Dim background
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
  categoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
    textTransform: "capitalize",
  },
  categoryTextActive: {
    color: WaiterColors.primary,
    fontWeight: "800",
  },
  loadingBox: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 10, color: "#6b7280", fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyStateText: { color: "#6b7280", fontWeight: "600", textAlign: "center" },

  // --- Detail Modal Styles ---
  detailContent: {
    padding: 0, // Reset padding for full-width image
    maxHeight: SCREEN_HEIGHT * 0.85,
    overflow: "hidden",
  },
  detailImageWrapper: {
    width: "100%",
    height: 250,
    position: "relative",
  },
  detailImage: {
    width: "100%",
    height: "100%",
  },
  closeDetailBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  detailBody: {
    padding: 24,
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    marginRight: 16,
    lineHeight: 30,
  },
  detailPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: WaiterColors.primary,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 24,
  },
  categoryBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  descScroll: {
    maxHeight: 120,
    marginBottom: 24,
  },
  detailDesc: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 24,
  },
  detailActionRow: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  stockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  stockBtnIn: {
    backgroundColor: "#F0FDF4",
    borderColor: "#10B981",
  },
  stockBtnOut: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  stockBtnText: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
  },
  stockBtnTextIn: {
    color: "#10B981",
  },
  stockBtnTextOut: {
    color: "#EF4444",
  },
});
