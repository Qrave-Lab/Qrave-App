import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AdminSettingsHeader from "../../components/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type MenuItem = {
  id: string;
  name: string;
  categoryName?: string;
};

type OfferItem = {
  menu_item_id: string;
  menu_item_name?: string;
  item_discount_kind?: "percent" | "fixed" | "fixed_price";
  item_discount_value?: number;
};

type OfferCampaign = {
  id: string;
  name: string;
  scope: "full_menu" | "selected_items";
  discount_kind: "percent" | "fixed" | "fixed_price";
  discount_value: number;
  requires_coupon: boolean;
  coupon_code?: string;
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  max_redemptions?: number;
  items?: OfferItem[];
};

const prettyKind = (kind: OfferCampaign["discount_kind"]) => {
  if (kind === "percent") return "Percent";
  if (kind === "fixed") return "Flat Amount";
  return "Fixed Price";
};

export default function SettingsOffers() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offers, setOffers] = useState<OfferCampaign[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [name, setName] = useState("");
  const [scope, setScope] = useState<"full_menu" | "selected_items">(
    "full_menu",
  );
  const [discountKind, setDiscountKind] = useState<
    "percent" | "fixed" | "fixed_price"
  >("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [requiresCoupon, setRequiresCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [query, setQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [offerRes, menuRes] = await Promise.all([
      apiClient.get("/api/admin/offers?include_inactive=1"),
      apiClient.get("/api/admin/menu"),
    ]);
    setOffers(Array.isArray(offerRes?.offers) ? offerRes.offers : []);
    const list = Array.isArray(menuRes) ? menuRes : [];
    setMenuItems(
      list.map((m: any) => ({
        id: String(m?.id || ""),
        name: String(m?.name || ""),
        categoryName: String(m?.categoryName || ""),
      })),
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        Alert.alert("Load failed", "Could not load offers.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.categoryName || "").toLowerCase().includes(q),
    );
  }, [menuItems, query]);

  const resetForm = () => {
    setName("");
    setScope("full_menu");
    setDiscountKind("percent");
    setDiscountValue("10");
    setRequiresCoupon(false);
    setCouponCode("");
    setStartsAt("");
    setEndsAt("");
    setMaxRedemptions("");
    setSelectedItems([]);
  };

  const createOffer = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Offer name is required.");
      return;
    }
    if (scope === "selected_items" && selectedItems.length === 0) {
      Alert.alert(
        "Select dishes",
        "Choose at least one dish for selected-items offer.",
      );
      return;
    }
    setSaving(true);
    try {
      const items =
        scope === "selected_items"
          ? selectedItems.map((id) => ({ menu_item_id: id }))
          : [];

      await apiClient.post("/api/admin/offers", {
        name: name.trim(),
        scope,
        discount_kind: discountKind,
        discount_value: Number(discountValue || 0),
        requires_coupon: requiresCoupon,
        coupon_code: requiresCoupon ? couponCode.trim().toUpperCase() : "",
        is_active: true,
        starts_at: startsAt ? new Date(startsAt).toISOString() : "",
        ends_at: endsAt ? new Date(endsAt).toISOString() : "",
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        items,
      });
      await load();
      resetForm();
      Alert.alert("Created", "Offer created.");
    } catch {
      Alert.alert("Create failed", "Could not create offer.");
    } finally {
      setSaving(false);
    }
  }, [
    couponCode,
    discountKind,
    discountValue,
    endsAt,
    load,
    maxRedemptions,
    name,
    requiresCoupon,
    scope,
    selectedItems,
    startsAt,
  ]);

  const toggleOffer = useCallback(async (offer: OfferCampaign) => {
    try {
      const payload = {
        name: offer.name,
        scope: offer.scope,
        discount_kind: offer.discount_kind,
        discount_value: offer.discount_value,
        requires_coupon: offer.requires_coupon,
        coupon_code: offer.coupon_code || "",
        is_active: !offer.is_active,
        starts_at: offer.starts_at || "",
        ends_at: offer.ends_at || "",
        max_redemptions:
          typeof offer.max_redemptions === "number"
            ? offer.max_redemptions
            : null,
        items: (offer.items || []).map((i) => ({
          menu_item_id: i.menu_item_id,
          item_discount_kind: i.item_discount_kind,
          item_discount_value: i.item_discount_value,
        })),
      };
      await apiClient.put(`/api/admin/offers/${offer.id}`, payload);
      setOffers((prev) =>
        prev.map((o) =>
          o.id === offer.id ? { ...o, is_active: !o.is_active } : o,
        ),
      );
    } catch {
      Alert.alert("Update failed", "Could not update offer.");
    }
  }, []);

  const removeOffer = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/api/admin/offers/${id}`);
      setOffers((prev) => prev.filter((o) => o.id !== id));
    } catch {
      Alert.alert("Delete failed", "Could not delete offer.");
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0F172A" />
        <Text style={styles.helper}>Loading offers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Offers & Coupons"
        subtitle="Create deals, promo codes, and discounts"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Offer</Text>

          <Text style={styles.label}>Offer Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Lunch Combo Deal"
          />

          <View style={styles.rowGap}>
            <Pressable
              style={[styles.chip, scope === "full_menu" && styles.chipActive]}
              onPress={() => setScope("full_menu")}
            >
              <Text
                style={[
                  styles.chipText,
                  scope === "full_menu" && styles.chipTextActive,
                ]}
              >
                Full Menu
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                scope === "selected_items" && styles.chipActive,
              ]}
              onPress={() => setScope("selected_items")}
            >
              <Text
                style={[
                  styles.chipText,
                  scope === "selected_items" && styles.chipTextActive,
                ]}
              >
                Selected Dishes
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Discount Type</Text>
          <View style={styles.rowGap}>
            {(["percent", "fixed", "fixed_price"] as const).map((k) => (
              <Pressable
                key={k}
                style={[styles.chip, discountKind === k && styles.chipActive]}
                onPress={() => setDiscountKind(k)}
              >
                <Text
                  style={[
                    styles.chipText,
                    discountKind === k && styles.chipTextActive,
                  ]}
                >
                  {prettyKind(k)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Discount Value</Text>
          <TextInput
            value={discountValue}
            onChangeText={setDiscountValue}
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Require coupon code</Text>
            <Switch value={requiresCoupon} onValueChange={setRequiresCoupon} />
          </View>
          {requiresCoupon ? (
            <TextInput
              value={couponCode}
              onChangeText={(v) => setCouponCode(v.toUpperCase())}
              style={styles.input}
              placeholder="SAVE20"
            />
          ) : null}

          <Text style={styles.label}>Start ISO datetime (optional)</Text>
          <TextInput
            value={startsAt}
            onChangeText={setStartsAt}
            style={styles.input}
            placeholder="2026-02-24T18:30:00.000Z"
          />
          <Text style={styles.label}>End ISO datetime (optional)</Text>
          <TextInput
            value={endsAt}
            onChangeText={setEndsAt}
            style={styles.input}
            placeholder="2026-02-25T18:30:00.000Z"
          />
          <Text style={styles.label}>Max redemptions (optional)</Text>
          <TextInput
            value={maxRedemptions}
            onChangeText={setMaxRedemptions}
            keyboardType="number-pad"
            style={styles.input}
          />

          {scope === "selected_items" ? (
            <View style={styles.menuWrap}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                style={styles.input}
                placeholder="Search dishes..."
              />
              {filteredMenu.map((m) => {
                const checked = selectedItems.includes(m.id);
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.menuItem, checked && styles.menuItemChecked]}
                    onPress={() =>
                      setSelectedItems((prev) =>
                        checked
                          ? prev.filter((id) => id !== m.id)
                          : [...prev, m.id],
                      )
                    }
                  >
                    <Text style={styles.menuText}>
                      {m.name} {m.categoryName ? `(${m.categoryName})` : ""}
                    </Text>
                    <MaterialIcons
                      name={checked ? "check-circle" : "radio-button-unchecked"}
                      size={18}
                      color={checked ? "#059669" : "#94A3B8"}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Pressable
            style={[styles.createBtn, saving && styles.btnDisabled]}
            onPress={createOffer}
            disabled={saving}
          >
            <Text style={styles.createText}>
              {saving ? "Creating..." : "Add Offer"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Existing Offers</Text>
          {offers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No offers configured yet.</Text>
            </View>
          ) : (
            offers.map((offer) => (
              <View key={offer.id} style={styles.offerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerName}>{offer.name}</Text>
                  <Text style={styles.offerMeta}>
                    {offer.scope === "full_menu"
                      ? "Full Menu"
                      : `${offer.items?.length || 0} Selected`}
                    {" - "}
                    {prettyKind(offer.discount_kind)}: {offer.discount_value}
                    {offer.requires_coupon && offer.coupon_code
                      ? ` - ${offer.coupon_code}`
                      : ""}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.stateBtn,
                    offer.is_active ? styles.stateOn : styles.stateOff,
                  ]}
                  onPress={() => toggleOffer(offer)}
                >
                  <Text
                    style={[
                      styles.stateText,
                      offer.is_active
                        ? styles.stateTextOn
                        : styles.stateTextOff,
                    ]}
                  >
                    {offer.is_active ? "Active" : "Inactive"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => removeOffer(offer.id)}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={18}
                    color="#DC2626"
                  />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  helper: { marginTop: 8, color: "#64748B", fontWeight: "600" },
  content: { padding: 12, paddingBottom: 24, gap: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 10,
  },
  label: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 5,
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
    marginBottom: 8,
  },
  rowGap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  chipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#FFFFFF" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  switchLabel: { color: "#334155", fontWeight: "700" },
  menuWrap: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    maxHeight: 220,
  },
  menuItem: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuItemChecked: { borderColor: "#A7F3D0", backgroundColor: "#ECFDF5" },
  menuText: {
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 12,
    flex: 1,
    paddingRight: 8,
  },
  createBtn: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  createText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
  empty: { paddingVertical: 14, alignItems: "center" },
  emptyText: { color: "#64748B", fontWeight: "600" },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  offerName: { color: "#0F172A", fontWeight: "800", fontSize: 14 },
  offerMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  stateBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  stateOn: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  stateOff: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" },
  stateText: { fontSize: 12, fontWeight: "800" },
  stateTextOn: { color: "#047857" },
  stateTextOff: { color: "#64748B" },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },
});
