import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from "react-native";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";
import WaiterWavyHeader from "../../components/WaiterWavyHeader";
import { MaterialIcons } from "@expo/vector-icons";

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
};

type CategoryOption = {
  id: string;
  name: string;
  parent_id?: string | null;
};

export default function WaiterMenu() {
  const { width } = useWindowDimensions();
  // Determine if we should use grid or list. Grid for tablets/web
  const isTablet = width > 700;
  
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

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
        const name = typeof item.name === "object" ? (item.name?.String ?? "") : (item.name ?? "");
        const description = item.description?.String ?? item.description ?? "";
        const categoryName = typeof item.categoryName === "object" ? (item.categoryName?.String ?? "") : (item.categoryName ?? "");
        const parentCategoryName = typeof item.parentCategoryName === "object" ? (item.parentCategoryName?.String ?? "") : (item.parentCategoryName ?? "");
        const imageUrl = item.imageUrl?.String ?? item.imageUrl ?? item.image_url?.String ?? item.image_url ?? "";
        const priceRaw = typeof item.price === "object" ? (item.price?.Float ?? item.price?.Int) : item.price;

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

  // Waiters might want to see out of stock items but grayed out
  const availableItems = useMemo(() => {
    return items.filter((item) => {
      if (item.isArchived) return false;
      if (!item.isAvailable) return false;
      return true;
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    return availableItems.filter((item) => {
      const matchesTab = activeCategory === "all" || resolveParentName(item) === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [availableItems, activeCategory, search]);

  const categoryTabs = useMemo(
    () => ["all", ...parentCategories.map((c) => c.name)],
    [parentCategories],
  );

  return (
    <View style={s.container}>
      <WaiterWavyHeader title="Menu" subtitle="Browse menu & availability" height={150} />

      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <MaterialIcons name="search" size={20} color="#94A3B8" />
          <TextInput
            placeholder="Search for dishes..."
            value={search}
            onChangeText={setSearch}
            style={s.searchInput}
            placeholderTextColor="#94A3B8"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <MaterialIcons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsContainer}
      >
        {categoryTabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveCategory(tab)}
            style={[s.tab, activeCategory === tab && s.tabActive]}
          >
            <Text style={[s.tabText, activeCategory === tab && s.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={WaiterColors.primary} />
          <Text style={s.loadingText}>Loading menu...</Text>
        </View>
      ) : loadError ? (
        <View style={s.emptyState}>
          <Text style={s.emptyStateText}>{loadError}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredItems.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialIcons name="restaurant-menu" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
              <Text style={s.emptyStateText}>No items match your search.</Text>
            </View>
          ) : (
            <View style={isTablet ? s.gridContainer : s.listContainer}>
              {filteredItems.map((item) => {
                const outOfStock = item.isOutOfStock || (item.stockCount != null && item.stockCount <= 0);
                return (
                  <View key={item.id} style={[isTablet ? s.gridCard : s.listCard, outOfStock && s.cardOutOfStock]}>
                    <View style={[isTablet ? s.gridImageBox : s.listImageBox]}>
                      {item.imageUrl && !imageErrors[item.id] ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={[isTablet ? s.gridImage : s.listImage, outOfStock && { opacity: 0.5, grayscale: 1 } as any]}
                          onError={() => setImageErrors((prev) => ({ ...prev, [item.id]: true }))}
                        />
                      ) : (
                        <MaterialIcons name="restaurant" size={32} color="#CBD5E1" />
                      )}
                      {outOfStock && (
                        <View style={s.outOfStockBadge}>
                          <Text style={s.outOfStockText}>SOLD OUT</Text>
                        </View>
                      )}
                    </View>
                    <View style={isTablet ? s.gridContent : s.listContentWrap}>
                      <Text style={[s.itemName, outOfStock && s.textMuted]} numberOfLines={isTablet ? 1 : 2}>
                        {item.name}
                      </Text>
                      <Text style={s.itemDesc} numberOfLines={2}>
                        {item.description || "No description"}
                      </Text>
                      <View style={s.itemBottom}>
                        <Text style={s.itemCategory}>{resolveParentName(item)}</Text>
                        <Text style={[s.itemPrice, outOfStock && s.textMuted]}>
                          Rs {item.price.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: WaiterColors.background },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: WaiterColors.border,
    shadowColor: WaiterColors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: WaiterColors.text },
  tabsScroll: { maxHeight: 54, flexGrow: 0, marginBottom: 4 },
  tabsContainer: { paddingHorizontal: 16, paddingBottom: 10, gap: 10, alignItems: "center" },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tabActive: { backgroundColor: WaiterColors.primary, borderColor: WaiterColors.primary },
  tabText: { color: "#64748B", fontWeight: "700", textTransform: "capitalize", fontSize: 13 },
  tabTextActive: { color: "#FFFFFF", fontWeight: "800" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  loadingText: { marginTop: 12, color: "#6b7280", fontWeight: "700", fontSize: 15 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60, paddingHorizontal: 30 },
  emptyStateText: { color: "#64748B", fontWeight: "600", fontSize: 15, textAlign: "center" },
  
  listContent: { padding: 16, paddingBottom: 40 },
  listContainer: { gap: 12 },
  listCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: WaiterColors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  listImageBox: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  listImage: { width: "100%", height: "100%" },
  listContentWrap: { flex: 1, justifyContent: "space-between" },
  
  gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "flex-start" },
  gridCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WaiterColors.border,
    width: Platform.select({ web: "31%", default: "47%" }),
    minWidth: 200,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gridImageBox: {
    width: "100%",
    height: 140,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gridImage: { width: "100%", height: "100%" },
  gridContent: { padding: 14, flex: 1, justifyContent: "space-between" },
  
  itemName: { fontSize: 15, fontWeight: "800", color: WaiterColors.text, marginBottom: 4 },
  itemDesc: { color: "#64748B", fontSize: 12, lineHeight: 16, marginBottom: 12 },
  itemBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto" },
  itemCategory: { fontSize: 11, color: "#94A3B8", fontWeight: "800", textTransform: "uppercase" },
  itemPrice: { fontSize: 16, fontWeight: "900", color: WaiterColors.primaryDark },
  
  cardOutOfStock: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  textMuted: { color: "#94A3B8" },
  outOfStockBadge: {
    position: "absolute",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  outOfStockText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
});
