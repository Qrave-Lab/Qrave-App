import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { AdminColors } from "../../constants/theme";
import iconPng from "../../assets/images/icon.png";
import { api } from "../../lib/apiClient";

// ── Types ────────────────────────────────────────────────────────────
type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type Allergen =
  | "Dairy"
  | "Gluten"
  | "Peanuts"
  | "Tree Nuts"
  | "Eggs"
  | "Soy"
  | "Fish"
  | "Shellfish";
type AllergenConfidence = "contains" | "may_contain" | "trace";
const ALLERGEN_LIST: Allergen[] = [
  "Dairy",
  "Gluten",
  "Peanuts",
  "Tree Nuts",
  "Eggs",
  "Soy",
  "Fish",
  "Shellfish",
];

type Variant = {
  id: string;
  label: string;
  price: number;
  stockCount: number | null;
};

type StructuredIngredient = {
  id: string;
  name: string;
  quantity: number;
  unit: "g" | "ml" | "pcs" | "oz";
};

type MenuItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  parentCategoryName: string;
  price: number;
  isAvailable: boolean;
  isArchived: boolean;
  isOutOfStock: boolean;
  stockCount: number | null;
  variants: Variant[];
  imageUrl: string;
  modelGlb: string;
  modelUsdz: string;
  description: string;
  ingredientsStructured: StructuredIngredient[];
  allergens: { type: Allergen; confidence: AllergenConfidence }[];
  availableDays: DayOfWeek[];
  selected: boolean;
};

type CategoryOption = {
  id: string;
  name: string;
  parent_id?: string | null;
  parent_name?: string | null;
};

type ModalTab =
  | "general"
  | "variants"
  | "media"
  | "ingredients"
  | "availability";
const MODAL_TABS: { id: ModalTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "variants", label: "Variants" },
  { id: "media", label: "Media" },
  { id: "ingredients", label: "Ingredients" },
  { id: "availability", label: "Availability" },
];

// ── Component ────────────────────────────────────────────────────────
export default function Inventory() {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;

  // Data
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [role, setRole] = useState("");

  // UI state
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);

  // Modal
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingParentId, setEditingParentId] = useState("");
  const [activeModalTab, setActiveModalTab] = useState<ModalTab>("general");

  // Subcategory creation
  const [newSubName, setNewSubName] = useState("");
  const [newSubParentId, setNewSubParentId] = useState("");
  const [creatingSub, setCreatingSub] = useState(false);
  const tabsRef = useRef<ScrollView>(null);
  const scrollTabsToStart = useCallback(() => {
    requestAnimationFrame(() => {
      tabsRef.current?.scrollTo({ x: 0, animated: true });
    });
  }, []);

  // ── Derived ──────────────────────────────────────────────────────
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );
  const getSubcategories = useCallback(
    (parentId: string) => categories.filter((c) => c.parent_id === parentId),
    [categories],
  );
  const canManageCategories = role === "owner" || role === "manager";

  const getDefaultCategoryId = useCallback(() => {
    const parent = parentCategories[0];
    if (!parent) return "";
    const subs = getSubcategories(parent.id);
    return subs[0]?.id || parent.id;
  }, [parentCategories, getSubcategories]);

  const categoryTabs = useMemo(
    () => ["all", ...parentCategories.map((c) => c.name)],
    [parentCategories],
  );

  const resolveParentName = (item: MenuItem) =>
    item.parentCategoryName || item.categoryName || "Uncategorized";

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesTab =
        activeCategory === "all" || resolveParentName(item) === activeCategory;
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesArchive = showArchived ? item.isArchived : !item.isArchived;
      return matchesTab && matchesSearch && matchesArchive;
    });
  }, [items, activeCategory, search, showArchived]);

  const selectedCount = filteredItems.filter((i) => i.selected).length;
  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((i) => i.selected);

  const selectedParentId = useMemo(() => {
    if (editingParentId) return editingParentId;
    const cat = categories.find((c) => c.id === editingItem?.categoryId);
    return cat?.parent_id || cat?.id || parentCategories[0]?.id || "";
  }, [editingParentId, editingItem?.categoryId, categories, parentCategories]);

  const subcategoryOptions = useMemo(
    () => (selectedParentId ? getSubcategories(selectedParentId) : []),
    [selectedParentId, getSubcategories],
  );

  // ── Data loading ────────────────────────────────────────────────
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
        const modelGlb = item.modelGlb?.String ?? item.modelGlb ?? "";
        const modelUsdz = item.modelUsdz?.String ?? item.modelUsdz ?? "";
        const priceRaw =
          typeof item.price === "object"
            ? (item.price?.Float ?? item.price?.Int)
            : item.price;

        return {
          id: String(item.id ?? item.menu_item_id ?? item.item_id ?? name),
          name,
          categoryId: item.categoryId ?? item.category_id ?? "",
          categoryName,
          parentCategoryName,
          price: Number(priceRaw) || 0,
          isAvailable: item.isAvailable ?? true,
          isArchived: item.isArchived ?? item.is_archived ?? false,
          isOutOfStock: item.isOutOfStock ?? item.is_out_of_stock ?? false,
          stockCount: item.stockCount ?? null,
          variants: item.variants || [],
          imageUrl,
          modelGlb,
          modelUsdz,
          description: description || "",
          ingredientsStructured: item.ingredientsStructured || [],
          allergens: item.allergens || [],
          availableDays: item.availableDays || [],
          selected: false,
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
      // categories fallback
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me: any = await api.get("/api/admin/me");
      setRole(me?.role || "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshMenu();
    refreshCategories();
    refreshMe();
  }, [refreshMenu, refreshCategories, refreshMe]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshMenu(true), refreshCategories()]);
    setRefreshing(false);
  }, [refreshMenu, refreshCategories]);

  useEffect(() => {
    if (activeCategory === "all") {
      scrollTabsToStart();
    }
  }, [activeCategory, scrollTabsToStart]);

  // ── Selection ───────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setItems((s) =>
      s.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const toggleSelectAll = () => {
    const ids = new Set(filteredItems.map((i) => i.id));
    setItems((prev) =>
      prev.map((i) =>
        ids.has(i.id) ? { ...i, selected: !allVisibleSelected } : i,
      ),
    );
  };

  const clearSelection = () => {
    setItems((prev) =>
      prev.map((i) => (i.selected ? { ...i, selected: false } : i)),
    );
  };

  // ── Bulk actions (API-backed) ──────────────────────────────────
  const buildUpdateBody = (
    item: MenuItem,
    overrides: Record<string, any> = {},
  ) => ({
    category_id: item.categoryId || undefined,
    name: item.name,
    price: item.price,
    description: item.description || "",
    image_url: item.imageUrl || "",
    model_glb: item.modelGlb || "",
    model_usdz: item.modelUsdz || "",
    available_days: item.availableDays || [],
    is_archived: item.isArchived,
    is_out_of_stock: item.isOutOfStock,
    ...overrides,
  });

  const handleBulkArchive = async (archive: boolean) => {
    const selected = items.filter((i) => i.selected);
    try {
      for (const item of selected) {
        await api.put(
          `/api/admin/menu/item?item_id=${item.id}`,
          buildUpdateBody(item, { is_archived: archive }),
        );
      }
      clearSelection();
      await refreshMenu(true);
      Alert.alert("Success", archive ? "Items archived" : "Items restored");
    } catch {
      Alert.alert("Error", "Bulk action failed");
    }
  };

  const handleBulkStock = async (isOutOfStock: boolean) => {
    const selected = items.filter((i) => i.selected);
    const snapshot = [...items];
    const ids = new Set(selected.map((i) => i.id));
    setItems((prev) =>
      prev.map((i) => (ids.has(i.id) ? { ...i, isOutOfStock } : i)),
    );

    try {
      await Promise.all(
        selected.map((item) =>
          api.put(
            `/api/admin/menu/item?item_id=${item.id}`,
            buildUpdateBody(item, { is_out_of_stock: isOutOfStock }),
          ),
        ),
      );
      clearSelection();
      await refreshMenu(true);
    } catch {
      setItems(snapshot);
      Alert.alert("Error", "Bulk stock update failed");
    }
  };

  // ── Single item out-of-stock toggle ────────────────────────────
  const toggleOutOfStock = async (item: MenuItem) => {
    const newVal = !item.isOutOfStock;
    const snapshot = [...items];
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isOutOfStock: newVal } : i)),
    );

    try {
      await api.put(
        `/api/admin/menu/item?item_id=${item.id}`,
        buildUpdateBody(item, { is_out_of_stock: newVal }),
      );
    } catch {
      setItems(snapshot);
      Alert.alert("Error", "Update failed");
    }
  };

  // ── Create subcategory ─────────────────────────────────────────
  const createSubcategory = async () => {
    const trimmed = newSubName.trim();
    if (!trimmed) return;
    const parentId = newSubParentId || parentCategories[0]?.id || "";
    if (!parentId) return Alert.alert("Error", "Select a parent category");

    const exists = categories.some(
      (c) =>
        c.name.toLowerCase() === trimmed.toLowerCase() &&
        c.parent_id === parentId,
    );
    if (exists) return Alert.alert("Error", "Subcategory already exists");

    setCreatingSub(true);
    try {
      await api.post("/api/admin/menu/category", {
        name: trimmed,
        parent_id: parentId,
      });
      setNewSubName("");
      await refreshCategories();
      Alert.alert("Success", "Subcategory added");
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.status === 403
          ? "Insufficient permissions"
          : "Failed to add subcategory",
      );
    } finally {
      setCreatingSub(false);
    }
  };

  // ── Open modal ─────────────────────────────────────────────────
  const openAddModal = () => {
    const defaultCategoryId = getDefaultCategoryId();
    const defaultParentId =
      categories.find((c) => c.id === defaultCategoryId)?.parent_id ||
      categories.find((c) => c.id === defaultCategoryId)?.id ||
      "";
    setEditingItem({
      id: "",
      name: "",
      categoryId: defaultCategoryId,
      categoryName: "",
      parentCategoryName: "",
      price: 0,
      isAvailable: true,
      isArchived: false,
      isOutOfStock: false,
      stockCount: null,
      variants: [],
      imageUrl: "",
      modelGlb: "",
      modelUsdz: "",
      description: "",
      ingredientsStructured: [],
      allergens: [],
      availableDays: [...DAYS],
      selected: false,
    });
    setEditingParentId(defaultParentId);
    setModalMode("add");
    setActiveModalTab("general");
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem({ ...item });
    const category = categories.find((c) => c.id === item.categoryId);
    setEditingParentId(category?.parent_id || category?.id || "");
    setModalMode("edit");
    setActiveModalTab("general");
  };

  // ── Save (create + update) ────────────────────────────────────
  const handleSave = async () => {
    if (!editingItem) return;
    if (!editingItem.name.trim())
      return Alert.alert("Error", "Product name is required");

    setSaving(true);
    try {
      let itemId = editingItem.id;

      if (modalMode === "add") {
        const res: any = await api.post("/api/admin/menu/item", {
          category_id: editingItem.categoryId || getDefaultCategoryId(),
          name: editingItem.name,
          price: editingItem.price,
        });
        itemId = res.id;
      }

      // Update main item details
      await api.put(`/api/admin/menu/item?item_id=${itemId}`, {
        category_id: editingItem.categoryId || undefined,
        name: editingItem.name,
        price: editingItem.price,
        description: editingItem.description,
        image_url: editingItem.imageUrl,
        model_glb: editingItem.modelGlb,
        model_usdz: editingItem.modelUsdz,
        available_days: editingItem.availableDays,
        is_archived: editingItem.isArchived,
        is_out_of_stock: editingItem.isOutOfStock,
      });

      // Update ingredients
      await api.put(
        `/api/admin/menu/item/ingredients?item_id=${itemId}`,
        editingItem.ingredientsStructured.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
        })),
      );

      // Manage variants: add new, delete removed
      const existing = items.find((i) => i.id === itemId)?.variants ?? [];
      const existingIds = new Set(existing.map((v) => v.id));
      const currentIds = new Set(editingItem.variants.map((v) => v.id));

      for (const v of editingItem.variants) {
        if (!existingIds.has(v.id)) {
          await api.post(`/api/admin/menu/item/variant?item_id=${itemId}`, {
            label: v.label,
            price: v.price,
            ...(v.stockCount != null ? { stock: v.stockCount } : {}),
          });
        }
      }
      for (const v of existing) {
        if (!currentIds.has(v.id)) {
          await api.del(`/api/admin/menu/item/variant?variant_id=${v.id}`);
        }
      }

      setModalMode(null);
      setEditingItem(null);
      Alert.alert("Success", "Changes saved");
      await refreshMenu(true);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const pickAndUploadModel = useCallback(async () => {
    if (!editingItem) return;
    if (!editingItem.id) {
      Alert.alert(
        "Save First",
        "Please save this product first, then upload GLB/USDZ.",
      );
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ["model/gltf-binary", "model/vnd.usdz+zip", ".glb", ".usdz"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fileName = (asset.name || "").toLowerCase();
    const mimeType = (asset.mimeType || "").toLowerCase();
    const ext = fileName.endsWith(".usdz") || mimeType.includes("usdz")
      ? "usdz"
      : fileName.endsWith(".glb") || mimeType.includes("gltf")
        ? "glb"
        : "";
    if (!ext) {
      Alert.alert("Invalid File", "Please select a .glb or .usdz file.");
      return;
    }
    const contentType =
      mimeType || (ext === "usdz" ? "model/vnd.usdz+zip" : "model/gltf-binary");

    setUploadingModel(true);
    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name || `model.${ext}`,
        type: contentType,
      } as any);

      const uploadRes: any = await api.postForm(
        `/api/admin/menu/item/model?item_id=${editingItem.id}`,
        form,
      );

      setEditingItem((prev) =>
        prev
          ? {
              ...prev,
              modelGlb: uploadRes?.model_glb || prev.modelGlb,
              modelUsdz: uploadRes?.model_usdz || prev.modelUsdz,
            }
          : prev,
      );
      Alert.alert("Success", "3D model uploaded");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to upload 3D model");
    } finally {
      setUploadingModel(false);
    }
  }, [editingItem]);

  // ── Image source helper ────────────────────────────────────────
  const imageSourceFor = useMemo(
    () => (item: MenuItem) => {
      if (!item.imageUrl || imageErrors[item.id]) return iconPng;
      return { uri: item.imageUrl };
    },
    [imageErrors],
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerRow, isCompact && styles.headerRowCompact]}>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>
            Menu
          </Text>
          <Text style={styles.subtitle}>{filteredItems.length} Products</Text>
        </View>
        <View
          style={[
            styles.headerActions,
            isCompact && styles.headerActionsCompact,
          ]}
        >
          <TouchableOpacity
            style={[
              styles.archiveToggle,
              showArchived && styles.archiveToggleActive,
            ]}
            onPress={() => {
              setShowArchived((s) => !s);
              clearSelection();
            }}
          >
            <Text
              style={[
                styles.archiveToggleText,
                showArchived && styles.archiveToggleTextActive,
              ]}
            >
              {showArchived ? "Exit Archive" : "Archive"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newProductBtn} onPress={openAddModal}>
            <Text style={styles.newProductBtnText}>+ New Product</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Subcategory creation (owners/managers only) */}
      {canManageCategories && (
        <View style={styles.subCatRow}>
          <Text style={styles.subCatLabel}>Add Subcategory</Text>
          <View style={styles.subCatForm}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 36 }}
            >
              {parentCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.subCatParentBtn,
                    (newSubParentId || parentCategories[0]?.id) === cat.id &&
                      styles.subCatParentBtnActive,
                  ]}
                  onPress={() => setNewSubParentId(cat.id)}
                >
                  <Text
                    style={[
                      styles.subCatParentText,
                      (newSubParentId || parentCategories[0]?.id) === cat.id &&
                        styles.subCatParentTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.subCatInputRow}>
              <TextInput
                style={styles.subCatInput}
                placeholder="e.g. Pizzas, Burgers"
                value={newSubName}
                onChangeText={setNewSubName}
              />
              <TouchableOpacity
                style={styles.subCatAddBtn}
                onPress={createSubcategory}
                disabled={creatingSub}
              >
                <Text style={styles.subCatAddBtnText}>
                  {creatingSub ? "..." : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Category tabs */}
      <ScrollView
        ref={tabsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
        onContentSizeChange={() => {
          if (activeCategory === "all") scrollTabsToStart();
        }}
      >
        {categoryTabs.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.tab, activeCategory === cat && styles.tabActive]}
            onPress={() => {
              setActiveCategory(cat);
              if (cat === "all") {
                scrollTabsToStart();
              }
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeCategory === cat && styles.tabTextActive,
              ]}
            >
              {cat === "all" ? "All" : cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search + Select All */}
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

      {/* Bulk action banner */}
      {selectedCount > 0 && (
        <View
          style={[styles.bulkBanner, showArchived && styles.bulkBannerRestore]}
        >
          <Text style={styles.bulkBannerText}>{selectedCount} selected</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.bulkActions}>
              <TouchableOpacity
                style={styles.bulkBtnRed}
                onPress={() => handleBulkStock(true)}
              >
                <Text style={styles.bulkBtnText}>Out of Stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bulkBtnGreen}
                onPress={() => handleBulkStock(false)}
              >
                <Text style={styles.bulkBtnText}>In Stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bulkBtnDefault}
                onPress={() => handleBulkArchive(!showArchived)}
              >
                <Text style={styles.bulkBtnText}>
                  {showArchived ? "Restore" : "Archive"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bulkClose}
                onPress={clearSelection}
              >
                <Text style={styles.bulkCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Loading / Error */}
      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={AdminColors.primary} />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      )}
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      {/* Items list */}
      <FlatList
        data={filteredItems}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AdminColors.primary}
          />
        }
        renderItem={({ item }) => (
          <View
            style={[styles.card, item.isOutOfStock && styles.cardOutOfStock]}
          >
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
              {item.modelGlb ? (
                <View style={styles.modelBadge}>
                  <Text style={styles.modelBadgeText}>3D</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.desc} numberOfLines={1}>
                {item.description || "No description"}
              </Text>
              <Text style={styles.price}>₹{item.price}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.categoryText}>
                  {resolveParentName(item)}
                </Text>
                {item.categoryName && item.parentCategoryName ? (
                  <Text style={styles.subCategoryText}>
                    {" "}
                    • {item.categoryName}
                  </Text>
                ) : null}
              </View>
              {item.allergens?.length > 0 && (
                <View style={styles.allergenChips}>
                  {item.allergens.slice(0, 3).map((a) => (
                    <View key={a.type} style={styles.allergenChip}>
                      <Text style={styles.allergenChipText}>{a.type[0]}</Text>
                    </View>
                  ))}
                  {item.allergens.length > 3 && (
                    <Text style={styles.allergenMore}>
                      +{item.allergens.length - 3}
                    </Text>
                  )}
                </View>
              )}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[
                  styles.stockBadge,
                  item.isOutOfStock
                    ? styles.stockBadgeOOS
                    : styles.stockBadgeIn,
                ]}
                onPress={() => toggleOutOfStock(item)}
              >
                <Text
                  style={[
                    styles.stockBadgeText,
                    item.isOutOfStock
                      ? styles.stockTextOOS
                      : styles.stockTextIn,
                  ]}
                >
                  {item.isOutOfStock ? "OOS" : "In Stock"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => openEditModal(item)}
              >
                <Text style={styles.editIcon}>✏️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {showArchived
                  ? "No archived items."
                  : search
                    ? "No matching items."
                    : "No menu items. Tap + New Product to add."}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      {/* ── Edit / Add Modal ─────────────────────────────────────── */}
      <Modal visible={!!modalMode} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {modalMode === "add" ? "Create Product" : "Edit Product"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Configure details, pricing, and assets.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setModalMode(null);
                  setEditingItem(null);
                }}
              >
                <Text style={styles.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.modalTabScroll}
            >
              <View style={styles.modalTabs}>
                {MODAL_TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.modalTab,
                      activeModalTab === tab.id && styles.modalTabActive,
                    ]}
                    onPress={() => setActiveModalTab(tab.id)}
                  >
                    <Text
                      style={
                        activeModalTab === tab.id
                          ? styles.modalTabTextActive
                          : styles.modalTabText
                      }
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Modal Body */}
            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              {editingItem && (
                <>
                  {/* ── General Info ─────────────────────────── */}
                  {activeModalTab === "general" && (
                    <View>
                      <Text style={styles.fieldLabel}>Product Name</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="e.g. Signature Truffle Burger"
                        value={editingItem.name}
                        onChangeText={(v) =>
                          setEditingItem({ ...editingItem, name: v })
                        }
                      />
                      <Text style={styles.fieldLabel}>Description</Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          { minHeight: 80, textAlignVertical: "top" },
                        ]}
                        placeholder="Describe taste, texture, and presentation..."
                        value={editingItem.description}
                        onChangeText={(v) =>
                          setEditingItem({ ...editingItem, description: v })
                        }
                        multiline
                      />
                      <Text style={styles.fieldLabel}>Base Price (₹)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="0"
                        keyboardType="numeric"
                        value={
                          editingItem.price ? String(editingItem.price) : ""
                        }
                        onChangeText={(v) =>
                          setEditingItem({
                            ...editingItem,
                            price: v === "" ? 0 : parseFloat(v) || 0,
                          })
                        }
                      />
                      <Text style={styles.fieldLabel}>Category Group</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginBottom: 12 }}
                      >
                        <View style={styles.chipRow}>
                          {parentCategories.map((cat) => (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.chip,
                                selectedParentId === cat.id &&
                                  styles.chipActive,
                              ]}
                              onPress={() => {
                                const subs = getSubcategories(cat.id);
                                setEditingParentId(cat.id);
                                setEditingItem({
                                  ...editingItem,
                                  categoryId: subs[0]?.id || cat.id,
                                });
                              }}
                            >
                              <Text
                                style={
                                  selectedParentId === cat.id
                                    ? styles.chipTextActive
                                    : styles.chipText
                                }
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      {subcategoryOptions.length > 0 && (
                        <>
                          <Text style={styles.fieldLabel}>Subcategory</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ marginBottom: 12 }}
                          >
                            <View style={styles.chipRow}>
                              {subcategoryOptions.map((cat) => (
                                <TouchableOpacity
                                  key={cat.id}
                                  style={[
                                    styles.chip,
                                    editingItem.categoryId === cat.id &&
                                      styles.chipActive,
                                  ]}
                                  onPress={() =>
                                    setEditingItem({
                                      ...editingItem,
                                      categoryId: cat.id,
                                    })
                                  }
                                >
                                  <Text
                                    style={
                                      editingItem.categoryId === cat.id
                                        ? styles.chipTextActive
                                        : styles.chipText
                                    }
                                  >
                                    {cat.name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                        </>
                      )}
                      <Text style={styles.fieldLabel}>Allergen Matrix</Text>
                      <View style={styles.allergenGrid}>
                        {ALLERGEN_LIST.map((alg) => {
                          const active = editingItem.allergens.some(
                            (a) => a.type === alg,
                          );
                          return (
                            <TouchableOpacity
                              key={alg}
                              style={[
                                styles.allergenBtn,
                                active && styles.allergenBtnActive,
                              ]}
                              onPress={() => {
                                const next = active
                                  ? editingItem.allergens.filter(
                                      (a) => a.type !== alg,
                                    )
                                  : [
                                      ...editingItem.allergens,
                                      {
                                        type: alg,
                                        confidence:
                                          "contains" as AllergenConfidence,
                                      },
                                    ];
                                setEditingItem({
                                  ...editingItem,
                                  allergens: next,
                                });
                              }}
                            >
                              <Text
                                style={
                                  active
                                    ? styles.allergenTextActive
                                    : styles.allergenText
                                }
                              >
                                {alg}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* ── Variants & Price ─────────────────────── */}
                  {activeModalTab === "variants" && (
                    <View>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Serving Tiers</Text>
                        <TouchableOpacity
                          style={styles.addVariantBtn}
                          onPress={() =>
                            setEditingItem({
                              ...editingItem,
                              variants: [
                                ...editingItem.variants,
                                {
                                  id: `new_${Date.now()}`,
                                  label: "",
                                  price: editingItem.price,
                                  stockCount: null,
                                },
                              ],
                            })
                          }
                        >
                          <Text style={styles.addVariantBtnText}>
                            + Add Variant
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {editingItem.variants.length === 0 ? (
                        <Text style={styles.emptyHint}>
                          No variants. Tap + Add Variant above.
                        </Text>
                      ) : (
                        editingItem.variants.map((v, i) => (
                          <View key={v.id} style={styles.variantCard}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.fieldLabelSm}>Label</Text>
                              <TextInput
                                style={styles.fieldInputSm}
                                placeholder="e.g. Regular, Large"
                                value={v.label}
                                onChangeText={(val) => {
                                  const list = [...editingItem.variants];
                                  list[i] = { ...list[i], label: val };
                                  setEditingItem({
                                    ...editingItem,
                                    variants: list,
                                  });
                                }}
                              />
                              <View style={styles.variantPriceRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.fieldLabelSm}>
                                    Price (₹)
                                  </Text>
                                  <TextInput
                                    style={styles.fieldInputSm}
                                    keyboardType="numeric"
                                    value={v.price ? String(v.price) : ""}
                                    onChangeText={(val) => {
                                      const list = [...editingItem.variants];
                                      list[i] = {
                                        ...list[i],
                                        price:
                                          val === "" ? 0 : parseFloat(val) || 0,
                                      };
                                      setEditingItem({
                                        ...editingItem,
                                        variants: list,
                                      });
                                    }}
                                  />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                  <Text style={styles.fieldLabelSm}>Stock</Text>
                                  <TextInput
                                    style={styles.fieldInputSm}
                                    keyboardType="numeric"
                                    placeholder="Unlimited"
                                    value={
                                      v.stockCount != null
                                        ? String(v.stockCount)
                                        : ""
                                    }
                                    onChangeText={(val) => {
                                      const list = [...editingItem.variants];
                                      list[i] = {
                                        ...list[i],
                                        stockCount:
                                          val === ""
                                            ? null
                                            : parseInt(val) || 0,
                                      };
                                      setEditingItem({
                                        ...editingItem,
                                        variants: list,
                                      });
                                    }}
                                  />
                                </View>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.deleteVariantBtn}
                              onPress={() =>
                                setEditingItem({
                                  ...editingItem,
                                  variants: editingItem.variants.filter(
                                    (x) => x.id !== v.id,
                                  ),
                                })
                              }
                            >
                              <Text style={styles.deleteVariantText}>🗑</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>
                  )}

                  {/* ── Media ────────────────────────────────── */}
                  {activeModalTab === "media" && (
                    <View>
                      <Text style={styles.fieldLabel}>Image URL</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="https://example.com/image.jpg"
                        value={editingItem.imageUrl}
                        onChangeText={(v) =>
                          setEditingItem({ ...editingItem, imageUrl: v })
                        }
                        autoCapitalize="none"
                      />
                      {editingItem.imageUrl ? (
                        <Image
                          source={{ uri: editingItem.imageUrl }}
                          style={styles.previewImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.previewPlaceholder}>
                          <Text style={styles.previewPlaceholderText}>
                            No image
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                        3D Asset (.glb/.usdz)
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.modelUploadCard,
                          editingItem.modelGlb && styles.modelUploadCardReady,
                        ]}
                        onPress={pickAndUploadModel}
                        disabled={uploadingModel}
                      >
                        <Text style={styles.modelUploadTitle}>
                          {uploadingModel
                            ? "Uploading..."
                            : editingItem.modelGlb
                              ? "3D Model Ready"
                              : "Upload GLB/USDZ for AR"}
                        </Text>
                        <Text style={styles.modelUploadSubtitle}>
                          {editingItem.id
                            ? "Tap to choose a file"
                            : "Save product first to enable upload"}
                        </Text>
                      </TouchableOpacity>
                      {editingItem.modelGlb ? (
                        <Text
                          style={[styles.previewPlaceholderText, { marginTop: 8 }]}
                          numberOfLines={1}
                        >
                          {editingItem.modelGlb}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* ── Ingredients ───────────────────────────── */}
                  {activeModalTab === "ingredients" && (
                    <View>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                          Structured Ingredients
                        </Text>
                        <TouchableOpacity
                          style={styles.addVariantBtn}
                          onPress={() =>
                            setEditingItem({
                              ...editingItem,
                              ingredientsStructured: [
                                ...editingItem.ingredientsStructured,
                                {
                                  id: `new_${Date.now()}`,
                                  name: "",
                                  quantity: 0,
                                  unit: "g",
                                },
                              ],
                            })
                          }
                        >
                          <Text style={styles.addVariantBtnText}>
                            + Add Ingredient
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {editingItem.ingredientsStructured.length === 0 ? (
                        <Text style={styles.emptyHint}>
                          No ingredients listed yet.
                        </Text>
                      ) : (
                        editingItem.ingredientsStructured.map((ing, idx) => (
                          <View key={ing.id} style={styles.variantCard}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.fieldLabelSm}>Name</Text>
                              <TextInput
                                style={styles.fieldInputSm}
                                placeholder="e.g. Olive Oil"
                                value={ing.name}
                                onChangeText={(val) => {
                                  const list = [
                                    ...editingItem.ingredientsStructured,
                                  ];
                                  list[idx] = { ...list[idx], name: val };
                                  setEditingItem({
                                    ...editingItem,
                                    ingredientsStructured: list,
                                  });
                                }}
                              />
                              <View style={styles.variantPriceRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.fieldLabelSm}>Qty</Text>
                                  <TextInput
                                    style={styles.fieldInputSm}
                                    keyboardType="numeric"
                                    value={
                                      ing.quantity ? String(ing.quantity) : ""
                                    }
                                    onChangeText={(val) => {
                                      const list = [
                                        ...editingItem.ingredientsStructured,
                                      ];
                                      list[idx] = {
                                        ...list[idx],
                                        quantity:
                                          val === "" ? 0 : parseFloat(val) || 0,
                                      };
                                      setEditingItem({
                                        ...editingItem,
                                        ingredientsStructured: list,
                                      });
                                    }}
                                  />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                  <Text style={styles.fieldLabelSm}>Unit</Text>
                                  <View style={styles.unitRow}>
                                    {(["g", "ml", "pcs", "oz"] as const).map(
                                      (u) => (
                                        <TouchableOpacity
                                          key={u}
                                          style={[
                                            styles.unitBtn,
                                            ing.unit === u &&
                                              styles.unitBtnActive,
                                          ]}
                                          onPress={() => {
                                            const list = [
                                              ...editingItem.ingredientsStructured,
                                            ];
                                            list[idx] = {
                                              ...list[idx],
                                              unit: u,
                                            };
                                            setEditingItem({
                                              ...editingItem,
                                              ingredientsStructured: list,
                                            });
                                          }}
                                        >
                                          <Text
                                            style={
                                              ing.unit === u
                                                ? styles.unitTextActive
                                                : styles.unitText
                                            }
                                          >
                                            {u}
                                          </Text>
                                        </TouchableOpacity>
                                      ),
                                    )}
                                  </View>
                                </View>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.deleteVariantBtn}
                              onPress={() =>
                                setEditingItem({
                                  ...editingItem,
                                  ingredientsStructured:
                                    editingItem.ingredientsStructured.filter(
                                      (x) => x.id !== ing.id,
                                    ),
                                })
                              }
                            >
                              <Text style={styles.deleteVariantText}>🗑</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>
                  )}

                  {/* ── Availability ──────────────────────────── */}
                  {activeModalTab === "availability" && (
                    <View>
                      <View style={styles.stockToggleCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stockToggleTitle}>
                            {editingItem.isOutOfStock
                              ? "Marked Out of Stock"
                              : "Available to Order"}
                          </Text>
                          <Text style={styles.stockToggleSub}>
                            Disable ordering without archiving the item.
                          </Text>
                        </View>
                        <Switch
                          value={!editingItem.isOutOfStock}
                          onValueChange={(val) =>
                            setEditingItem({
                              ...editingItem,
                              isOutOfStock: !val,
                            })
                          }
                          trackColor={{ false: "#FCA5A5", true: "#6EE7B7" }}
                          thumbColor={
                            editingItem.isOutOfStock ? "#DC2626" : "#059669"
                          }
                        />
                      </View>

                      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                        Weekly Availability
                      </Text>
                      <View style={styles.daysRow}>
                        {DAYS.map((day) => {
                          const active =
                            editingItem.availableDays.includes(day);
                          return (
                            <TouchableOpacity
                              key={day}
                              style={[
                                styles.dayBtn,
                                active && styles.dayBtnActive,
                              ]}
                              onPress={() => {
                                const next = active
                                  ? editingItem.availableDays.filter(
                                      (d) => d !== day,
                                    )
                                  : [...editingItem.availableDays, day];
                                setEditingItem({
                                  ...editingItem,
                                  availableDays: next,
                                });
                              }}
                            >
                              <Text
                                style={
                                  active ? styles.dayTextActive : styles.dayText
                                }
                              >
                                {day.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={[styles.stockToggleCard, { marginTop: 16 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stockToggleTitle}>
                            {editingItem.isArchived
                              ? "Archived"
                              : "Active in Menu"}
                          </Text>
                          <Text style={styles.stockToggleSub}>
                            {editingItem.isArchived
                              ? "Tap to restore to menu"
                              : "Tap to archive this product"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.archiveActionBtn,
                            editingItem.isArchived && styles.restoreActionBtn,
                          ]}
                          onPress={() =>
                            setEditingItem({
                              ...editingItem,
                              isArchived: !editingItem.isArchived,
                            })
                          }
                        >
                          <Text style={styles.archiveActionText}>
                            {editingItem.isArchived ? "Restore" : "Archive"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.discardBtn}
                onPress={() => {
                  setModalMode(null);
                  setEditingItem(null);
                }}
              >
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
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
  headerRowCompact: { flexDirection: "column", alignItems: "flex-start" },
  headerTextBlock: { alignItems: "flex-start" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
    color: AdminColors.text,
  },
  titleCompact: { marginBottom: 2 },
  subtitle: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerActionsCompact: {
    width: "100%",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  archiveToggle: {
    backgroundColor: "#f2f2f2",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  archiveToggleActive: { backgroundColor: "#fff7ed", borderColor: "#f59e0b" },
  archiveToggleText: {
    color: AdminColors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  archiveToggleTextActive: { color: "#b45309" },
  newProductBtn: {
    backgroundColor: AdminColors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newProductBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Subcategory creation
  subCatRow: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 12,
  },
  subCatLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#9ca3af",
    marginBottom: 8,
  },
  subCatForm: { gap: 8 },
  subCatParentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    marginRight: 6,
  },
  subCatParentBtnActive: { backgroundColor: AdminColors.primary },
  subCatParentText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  subCatParentTextActive: { color: "#fff" },
  subCatInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  subCatInput: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  subCatAddBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  subCatAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  // Tabs
  tabsScroll: { maxHeight: 52 },
  tabsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minWidth: 48,
    alignItems: "center",
  },
  tabActive: { backgroundColor: AdminColors.primary },
  tabText: {
    color: "#888",
    fontWeight: "600",
    textTransform: "capitalize",
    textAlign: "center",
  },
  tabTextActive: { color: "#fff" },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  selectAll: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectAllText: { color: "#6b7280", fontWeight: "600" },
  searchBar: {
    backgroundColor: "#f2f2f2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: AdminColors.text,
    flex: 1,
  },

  // Bulk
  bulkBanner: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  bulkBannerRestore: { backgroundColor: "#0b132b" },
  bulkBannerText: {
    color: "#e2e8f0",
    fontWeight: "700",
    marginRight: 8,
  },
  bulkActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  bulkBtnRed: {
    backgroundColor: "#dc2626",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  bulkBtnGreen: {
    backgroundColor: "#059669",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  bulkBtnDefault: {
    backgroundColor: "#1f2937",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  bulkBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  bulkClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  bulkCloseText: { color: "#fff", fontWeight: "700" },

  // Loading / error
  loadingBox: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 10, color: "#6b7280", fontWeight: "600" },
  errorText: { color: "#dc2626", marginBottom: 8 },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardOutOfStock: { opacity: 0.6 },
  checkbox: { marginRight: 8 },
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
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  image: { width: 52, height: 52, borderRadius: 10 },
  modelBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    backgroundColor: "#4f46e5",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  modelBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  name: { fontSize: 15, fontWeight: "700", color: AdminColors.text },
  desc: { color: "#666", fontSize: 12, marginTop: 2 },
  price: { fontWeight: "800", color: AdminColors.text, marginTop: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  categoryText: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  subCategoryText: { fontSize: 11, color: "#9ca3af" },
  allergenChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  allergenChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  allergenChipText: { fontSize: 9, fontWeight: "800", color: "#92400e" },
  allergenMore: {
    fontSize: 10,
    color: "#92400e",
    fontWeight: "700",
    marginLeft: 2,
  },
  cardActions: { alignItems: "flex-end", gap: 6 },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  stockBadgeOOS: { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
  stockBadgeIn: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  stockTextOOS: { color: "#be123c" },
  stockTextIn: { color: "#059669" },
  editBtn: { padding: 6 },
  editIcon: { fontSize: 18 },
  listContent: { paddingBottom: 12 },
  emptyState: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 40,
  },
  emptyStateText: {
    color: "#6b7280",
    fontWeight: "600",
    textAlign: "center",
  },

  // ── Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: "90%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: AdminColors.text,
  },
  modalSubtitle: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  modalCloseBtn: { fontSize: 20, color: "#9ca3af", padding: 6 },
  modalTabScroll: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTabs: { flexDirection: "row", paddingHorizontal: 16, gap: 4 },
  modalTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  modalTabActive: { borderBottomColor: AdminColors.primary },
  modalTabText: { color: "#9ca3af", fontWeight: "700", fontSize: 12 },
  modalTabTextActive: {
    color: AdminColors.primary,
    fontWeight: "800",
    fontSize: 12,
  },
  modalBody: { paddingHorizontal: 20, paddingVertical: 16 },

  // Fields
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#9ca3af",
    marginBottom: 6,
    marginTop: 12,
  },
  fieldInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: AdminColors.text,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 4,
  },
  fieldLabelSm: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#9ca3af",
    marginBottom: 4,
  },
  fieldInputSm: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: AdminColors.text,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipRow: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: {
    backgroundColor: AdminColors.primary,
    borderColor: AdminColors.primary,
  },
  chipText: { color: "#6b7280", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "700", fontSize: 12 },
  allergenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  allergenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  allergenBtnActive: {
    backgroundColor: AdminColors.primary,
    borderColor: AdminColors.primary,
  },
  allergenText: { color: "#6b7280", fontWeight: "700", fontSize: 11 },
  allergenTextActive: { color: "#fff", fontWeight: "700", fontSize: 11 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: "800", color: AdminColors.text },
  addVariantBtn: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addVariantBtnText: { color: "#4f46e5", fontWeight: "700", fontSize: 12 },
  emptyHint: {
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 13,
  },
  variantCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f8f9fa",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 10,
  },
  variantPriceRow: { flexDirection: "row", marginTop: 8 },
  deleteVariantBtn: { padding: 8, marginLeft: 8 },
  deleteVariantText: { fontSize: 18 },
  unitRow: { flexDirection: "row", gap: 4 },
  unitBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
  },
  unitBtnActive: { backgroundColor: AdminColors.primary },
  unitText: { fontSize: 11, fontWeight: "700", color: "#6b7280" },
  unitTextActive: { fontSize: 11, fontWeight: "700", color: "#fff" },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#f3f4f6",
  },
  previewPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#f8f9fa",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholderText: { color: "#d1d5db", fontWeight: "600" },
  modelUploadCard: {
    marginTop: 10,
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#c7d2fe",
    backgroundColor: "#f8faff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modelUploadCardReady: {
    backgroundColor: "#eef2ff",
    borderColor: "#a5b4fc",
  },
  modelUploadTitle: {
    color: "#4f46e5",
    fontWeight: "800",
    fontSize: 14,
  },
  modelUploadSubtitle: {
    marginTop: 4,
    color: "#818cf8",
    fontWeight: "600",
    fontSize: 12,
  },
  modelReadyBox: {
    marginTop: 10,
    backgroundColor: "#eef2ff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modelReadyText: {
    color: "#4f46e5",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
  },
  stockToggleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  stockToggleTitle: { fontWeight: "700", color: AdminColors.text },
  stockToggleSub: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  dayBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  dayBtnActive: {
    backgroundColor: AdminColors.primary,
    borderColor: AdminColors.primary,
  },
  dayText: { fontSize: 10, fontWeight: "800", color: "#d1d5db" },
  dayTextActive: { fontSize: 10, fontWeight: "800", color: "#fff" },
  archiveActionBtn: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  restoreActionBtn: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe" },
  archiveActionText: { fontWeight: "700", fontSize: 12, color: "#4b5563" },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 10,
  },
  discardBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  discardBtnText: { color: "#6b7280", fontWeight: "700" },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#111827",
    minWidth: 120,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700" },
});
