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
} from "react-native";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WaiterColors.background },
  header: { padding: 16, paddingBottom: 6 },
  title: { fontSize: 22, fontWeight: "800", color: WaiterColors.text },
  subtitle: { color: "#475569", marginTop: 4 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchInput: {
    backgroundColor: "#E2F5F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: WaiterColors.text,
    borderWidth: 1,
    borderColor: "#C7F1EB",
  },
  tabsScroll: { maxHeight: 48 },
  tabsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tabActive: { backgroundColor: WaiterColors.primary, borderColor: WaiterColors.primary },
  tabText: { color: "#64748B", fontWeight: "600", textTransform: "capitalize" },
  tabTextActive: { color: "#FFFFFF", fontWeight: "700" },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: WaiterColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
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
  loadingBox: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 10, color: "#6b7280", fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyStateText: { color: "#6b7280", fontWeight: "600", textAlign: "center" },
});

export default function WaiterMenu() {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.subtitle}>Available items only</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search items..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor="#64748B"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
      >
        {categoryTabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveCategory(tab)}
            style={[
              styles.tab,
              activeCategory === tab ? styles.tabActive : null,
            ]}
          >
            <Text
              style={
                activeCategory === tab ? styles.tabTextActive : styles.tabText
              }
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
          renderItem={({ item }) => (
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
                  <Text style={styles.price}>Rs {item.price.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
