import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { AdminColors } from "../../constants/theme";
import iconPng from "../../assets/images/icon.png";
import { api } from "../../lib/apiClient";

type InventoryItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string | number;
  selected: boolean;
  allergens?: string[];
  variants?: string[];
  ingredients?: string;
  availability?: string;
  media?: string[];
};

type NewProduct = {
  name: string;
  description: string;
  price: string;
  category: string;
  subcategory: string;
  allergens: string[];
  variants: string[];
  media: string[];
  ingredients: string;
  availability: string;
};

export default function Inventory() {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const categories = [
    "All",
    "Beverages",
    "Cakes",
    "Chinese",
    "Cold Beverages",
    "Desserts",
    "Food",
    "Hot Beverages",
    "Ice Creams",
    "Soups",
    "Starters",
  ];
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState("General Info");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const modalTabs = [
    "General Info",
    "Variants & Price",
    "Media & 3D",
    "Ingredients",
    "Availability",
  ];
  const allergenMatrix = [
    "Dairy",
    "Gluten",
    "Peanuts",
    "Tree Nuts",
    "Eggs",
    "Soy",
    "Fish",
    "Shellfish",
  ];
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: "",
    description: "",
    price: "",
    category: categories[1],
    subcategory: categories[1],
    allergens: [],
    variants: [],
    media: [],
    ingredients: "",
    availability: "",
  });

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get("/api/admin/menu");
      const list = Array.isArray(data) ? data : [];
      const normalized = list.map((item: any) => {
        const name =
          typeof item.name === "object" ? item.name?.String ?? "" : item.name ?? "";
        const description =
          typeof item.description === "object"
            ? item.description?.String ?? ""
            : item.description ?? "";
        const category =
          typeof item.parentCategoryName === "object"
            ? item.parentCategoryName?.String ?? ""
            : item.parentCategoryName ??
              (typeof item.categoryName === "object"
                ? item.categoryName?.String ?? ""
                : item.categoryName ?? "Uncategorized");
        const priceRaw =
          typeof item.price === "object" ? item.price?.Float ?? item.price?.Int : item.price;
        const imageUrl =
          item.imageUrl?.String ??
          item.imageUrl ??
          item.image_url?.String ??
          item.image_url ??
          "";

        return {
          id: String(item.id ?? item.menu_item_id ?? item.item_id ?? name),
          name,
          description: description || "No description provided.",
          price: Number(priceRaw) || 0,
          category: category || "Uncategorized",
          image: imageUrl,
          selected: false,
        } as InventoryItem;
      });
      setItems(normalized);
    } catch (e: any) {
      setLoadError(e?.message || "Failed to load menu items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const archiveSelected = () => {
    const selectedIds = items.filter((i) => i.selected).map((i) => i.id);
    setArchivedIds((prev) => [...prev, ...selectedIds]);
    setItems((prev) =>
      prev.map((i) => (i.selected ? { ...i, selected: false } : i)),
    );
  };

  const toggleSelect = (id: string) => {
    setItems((s) =>
      s.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const visibleItems = filteredItems.filter((item) =>
    isArchiveMode ? archivedIds.includes(item.id) : !archivedIds.includes(item.id),
  );
  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((i) => i.selected);
  const selectedCount = visibleItems.filter((i) => i.selected).length;
  const toggleSelectAll = () => {
    setItems((prev) =>
      prev.map((i) =>
        visibleItems.find((v) => v.id === i.id)
          ? { ...i, selected: !allVisibleSelected }
          : i,
      ),
    );
  };
  const restoreSelected = () => {
    const selectedIds = items.filter((i) => i.selected).map((i) => i.id);
    setArchivedIds((prev) => prev.filter((id) => !selectedIds.includes(id)));
    setItems((prev) =>
      prev.map((i) => (i.selected ? { ...i, selected: false } : i)),
    );
  };

  const imageSourceFor = useMemo(
    () => (item: InventoryItem) => {
      if (!item.image || imageErrors[item.id]) return iconPng;
      if (typeof item.image === "number") return item.image;
      return { uri: item.image };
    },
    [imageErrors],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMenu();
    setRefreshing(false);
  }, [loadMenu]);

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, isCompact && styles.headerRowCompact]}>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>
            Menu
          </Text>
          <Text style={styles.subtitle}>{visibleItems.length} Products</Text>
        </View>
        <View style={[styles.headerActions, isCompact && styles.headerActionsCompact]}>
          <TouchableOpacity
            style={[
              styles.archiveBtn,
              isArchiveMode && styles.archiveBtnExit,
            ]}
            onPress={() => setIsArchiveMode((s) => !s)}
          >
            <Text
              style={[
                styles.archiveBtnText,
                isArchiveMode && styles.archiveBtnTextExit,
              ]}
            >
              {isArchiveMode ? "Exit Archive" : "Archive"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newProductBtn}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.newProductBtnText}>+ New Product</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.tab, activeCategory === cat && styles.tabActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.tabText,
                activeCategory === cat && styles.tabTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.searchRow}>
        <TouchableOpacity style={styles.selectAll} onPress={toggleSelectAll}>
          <View
            style={[
              styles.checkboxBox,
              allVisibleSelected && styles.checkboxChecked,
            ]}
          />
          <Text style={styles.selectAllText}>Select All</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.searchBar}
          placeholder="Search menu..."
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {selectedCount > 0 && !isArchiveMode ? (
        <View style={styles.archiveBanner}>
          <Text style={styles.archiveBannerText}>
            {selectedCount} products selected
          </Text>
          <View style={styles.archiveBannerActions}>
            <TouchableOpacity
              style={styles.archiveItemsBtn}
              onPress={archiveSelected}
            >
              <Text style={styles.archiveItemsBtnText}>Archive Items</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bannerClose}
              onPress={() =>
                setItems((prev) =>
                  prev.map((i) => (i.selected ? { ...i, selected: false } : i)),
                )
              }
            >
              <Text style={styles.bannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {selectedCount > 0 && isArchiveMode ? (
        <View style={[styles.archiveBanner, styles.restoreBanner]}>
          <Text style={styles.archiveBannerText}>
            {selectedCount} archived items selected
          </Text>
          <View style={styles.archiveBannerActions}>
            <TouchableOpacity
              style={[styles.archiveItemsBtn, styles.restoreBtn]}
              onPress={restoreSelected}
            >
              <Text style={styles.archiveItemsBtnText}>Restore Items</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bannerClose}
              onPress={() =>
                setItems((prev) =>
                  prev.map((i) => (i.selected ? { ...i, selected: false } : i)),
                )
              }
            >
              <Text style={styles.bannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {loading ? (
        <Text style={{ color: "#6b7280", marginBottom: 8 }}>
          Loading menu items...
        </Text>
      ) : null}
      {loadError ? (
        <Text style={{ color: "#dc2626", marginBottom: 8 }}>{loadError}</Text>
      ) : null}
      <FlatList
        data={visibleItems}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AdminColors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => toggleSelect(item.id)}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        item.selected && styles.checkboxChecked,
                      ]}
                    />
                  </TouchableOpacity>
                  <View style={styles.imageBox}>
                    <Image
                      source={imageSourceFor(item)}
                      style={styles.image}
                      onError={() =>
                        setImageErrors((prev) => ({ ...prev, [item.id]: true }))
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.sub}>{item.description}</Text>
                    <Text style={styles.price}>₹{item.price}</Text>
                    <Text style={styles.category}>
                      {item.category || "Uncategorized"}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.editBtn}>
                    <Text style={styles.editIcon}>✏️</Text>
                  </TouchableOpacity>
                </View>
              )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {isArchiveMode
                ? "No archived items."
                : search
                ? "No matching items."
                : "No inventory items."}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

            {/* New Product Modal with Tabs */}
            {modalVisible && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Create Product</Text>
                  <View style={styles.modalTabs}>
                    {modalTabs.map((tab) => (
                      <TouchableOpacity
                        key={tab}
                        style={[styles.modalTab, modalTab === tab && styles.modalTabActive]}
                        onPress={() => setModalTab(tab)}
                      >
                        <Text style={modalTab === tab ? styles.modalTabTextActive : styles.modalTabText}>{tab}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {modalTab === 'General Info' && (
                    <>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Product Name"
                        value={newProduct.name}
                        onChangeText={(v) => setNewProduct((p) => ({ ...p, name: v }))}
                      />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Description"
                        value={newProduct.description}
                        onChangeText={(v) => setNewProduct((p) => ({ ...p, description: v }))}
                      />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Base Price (₹)"
                        keyboardType="numeric"
                        value={newProduct.price}
                        onChangeText={(v) => setNewProduct((p) => ({ ...p, price: v }))}
                      />
                      <Text style={styles.modalLabel}>Category Group</Text>
                      <View style={styles.modalDropdown}>
                        {categories.slice(1).map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.modalDropdownItem,
                              newProduct.category === cat && styles.modalDropdownItemActive,
                            ]}
                            onPress={() => setNewProduct((p) => ({ ...p, category: cat }))}
                          >
                            <Text style={newProduct.category === cat ? styles.modalDropdownTextActive : styles.modalDropdownText}>{cat}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  {modalTab === 'Variants & Price' && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.modalLabel}>Variants (e.g. Small, Large)</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Add variants separated by comma"
                        value={newProduct.variants.join(', ')}
                        onChangeText={(v) => setNewProduct((p) => ({ ...p, variants: v.split(',').map(s => s.trim()) }))}
                      />
                    </View>
                  )}
                  {modalTab === 'Media & 3D' && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.modalLabel}>Media URLs</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Add image URLs separated by comma"
                        value={newProduct.media.join(', ')}
                        onChangeText={(v) => setNewProduct((p) => ({ ...p, media: v.split(',').map(s => s.trim()) }))}
                      />
                    </View>
                  )}
                  {modalTab === 'Ingredients' && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.modalLabel}>Ingredients</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="List ingredients"
                        value={newProduct.ingredients}
                        onChangeText={(v) => setNewProduct((p) => ({ ...p, ingredients: v }))}
                      />
                    </View>
                  )}
                  {modalTab === 'Availability' && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.modalLabel}>Availability</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g. Available, Out of Stock"
                        value={newProduct.availability}
                        onChangeText={(v) => setNewProduct((p) => ({ ...p, availability: v }))}
                      />
                      <Text style={styles.modalLabel}>Allergen Matrix</Text>
                      <View style={styles.allergenMatrix}>
                        {allergenMatrix.map((allergen) => (
                          <TouchableOpacity
                            key={allergen}
                            style={[
                              styles.allergenBtn,
                              newProduct.allergens.includes(allergen) && styles.allergenBtnActive,
                            ]}
                            onPress={() => {
                              setNewProduct((p) => ({
                                ...p,
                                allergens: p.allergens.includes(allergen)
                                  ? p.allergens.filter((a) => a !== allergen)
                                  : [...p.allergens, allergen],
                              }));
                            }}
                          >
                            <Text style={newProduct.allergens.includes(allergen) ? styles.allergenTextActive : styles.allergenText}>{allergen}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                      <Text style={styles.modalBtnText}>Discard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnPrimary]}
                      onPress={() => {
                        setItems((prev) => [
                          ...prev,
                          {
                            id: (prev.length + 1).toString(),
                            name: newProduct.name,
                            description: newProduct.description,
                            price: Number(newProduct.price),
                            category: newProduct.category,
                            image: newProduct.media[0] || iconPng,
                            selected: false,
                            allergens: newProduct.allergens,
                            variants: newProduct.variants,
                            ingredients: newProduct.ingredients,
                            availability: newProduct.availability,
                          },
                        ]);
                        setModalVisible(false);
                        setNewProduct({
                          name: '', description: '', price: '', category: categories[1], subcategory: categories[1], allergens: [], variants: [], media: [], ingredients: '', availability: ''
                        });
                        setModalTab('General Info');
                      }}
                    >
                      <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Save Changes</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AdminColors.background,
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  headerRowCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  headerTextBlock: {
    alignItems: "flex-start",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    color: AdminColors.text,
  },
  titleCompact: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    marginTop: -6,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerActionsCompact: {
    width: "100%",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  selectAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectAllText: { color: "#6b7280", fontWeight: "600" },
  archiveBanner: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  archiveBannerText: { color: "#e2e8f0", fontWeight: "700" },
  archiveBannerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  archiveItemsBtn: {
    backgroundColor: "#1f2937",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  archiveItemsBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  restoreBanner: {
    backgroundColor: "#0b132b",
  },
  restoreBtn: {
    backgroundColor: "#2563eb",
  },
  bannerClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerCloseText: { color: "#fff", fontWeight: "700" },
  tabsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tabsScroll: {
    maxHeight: 52,
  },
  tabActive: {
    backgroundColor: AdminColors.primary,
  },
  tabText: {
    color: "#888",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#fff",
  },
  searchBar: {
    backgroundColor: "#f2f2f2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: AdminColors.text,
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  archiveBtn: {
    backgroundColor: "#f2f2f2",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  archiveBtnText: {
    color: AdminColors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  archiveBtnExit: {
    backgroundColor: "#fff7ed",
    borderColor: "#f59e0b",
  },
  archiveBtnTextExit: {
    color: "#b45309",
  },
  newProductBtn: {
    backgroundColor: AdminColors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newProductBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: AdminColors.text,
  },
  modalInput: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: AdminColors.text,
    marginBottom: 12,
  },
  modalLabel: {
    fontWeight: '600',
    marginBottom: 6,
    color: AdminColors.text,
  },
  modalDropdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modalDropdownItem: {
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  modalDropdownItemActive: {
    backgroundColor: AdminColors.primary,
  },
  modalDropdownText: {
    color: '#888',
    fontWeight: '600',
  },
  modalDropdownTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  modalTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  modalTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
    marginRight: 8,
  },
  modalTabActive: {
    backgroundColor: AdminColors.primary,
  },
  modalTabText: {
    color: '#888',
    fontWeight: '600',
  },
  modalTabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  allergenMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  allergenBtn: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  allergenBtnActive: {
    backgroundColor: AdminColors.primary,
  },
  allergenText: {
    color: '#888',
    fontWeight: '600',
  },
  allergenTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  modalBtnPrimary: {
    backgroundColor: AdminColors.primary,
  },
  modalBtnText: {
    color: AdminColors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  modalBtnTextPrimary: {
    color: '#fff',
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: AdminColors.accent,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  checkbox: {
    marginRight: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: AdminColors.secondary,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: AdminColors.primary,
    borderColor: AdminColors.primary,
  },
  imageBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  imagePlaceholder: {
    fontSize: 24,
    color: "#bbb",
  },
  name: { fontSize: 16, fontWeight: "600", color: AdminColors.text },
  sub: { color: "#666", marginTop: 4 },
  price: { fontWeight: "700", color: AdminColors.text, marginTop: 2 },
  category: { fontSize: 12, color: "#888", marginTop: 2 },
  editBtn: {
    marginLeft: 8,
    padding: 6,
  },
  editIcon: {
    fontSize: 18,
    color: AdminColors.primary,
  },
  listContent: {
    paddingBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 12,
  },
  emptyStateText: {
    color: "#6b7280",
    fontWeight: "600",
  },
});
