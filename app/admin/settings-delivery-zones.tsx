import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
  View,
} from "react-native";

import iconPng from "../../assets/images/icon.png";
import AdminWavyHeader from "../../components/admin/AdminWavyHeader";
import apiClient, { BASE_URL } from "../../lib/apiClient";
import { getStoredLogoVersion, withLogoVersion } from "../../lib/logoVersion";

/* ── Types ─────────────────────────────────────────────────── */
type DeliveryZone = {
  id: string;
  name: string;
  distance_km?: number | null;
  fee: number;
  estimated_minutes?: number | null;
  sort_order: number;
};

type ZoneForm = {
  name: string;
  distance_km: string;
  fee: string;
  estimated_minutes: string;
};

const EMPTY_FORM: ZoneForm = {
  name: "",
  distance_km: "",
  fee: "",
  estimated_minutes: "",
};

/* ── Component ─────────────────────────────────────────────── */
export default function SettingsDeliveryZones() {
  const router = useRouter();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM);

  /* ── Data ────────────────────────────────────────────────── */
  const loadZones = useCallback(async () => {
    const [zonesRes, me] = await Promise.all([
      apiClient.get("/api/admin/delivery/zones"),
      apiClient.get("/api/admin/me"),
    ]);
    setZones(Array.isArray(zonesRes?.zones) ? zonesRes.zones : []);
    const rId = me?.restaurant_id || me?.id;
    if (rId) {
      try {
        const version = await getStoredLogoVersion();
        const res = await fetch(
          `${BASE_URL}/public/restaurants/${rId}/logo`,
        );
        const data = await res.json();
        setLogoUrl(withLogoVersion(data?.logo_url, version));
      } catch {
        setLogoUrl(null);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadZones();
      } catch {
        Alert.alert("Error", "Could not load delivery zones.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadZones]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadZones();
    } finally {
      setRefreshing(false);
    }
  }, [loadZones]);

  /* ── Form Helpers ────────────────────────────────────────── */
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditingId(zone.id);
    setForm({
      name: zone.name,
      distance_km: zone.distance_km != null ? String(zone.distance_km) : "",
      fee: String(zone.fee),
      estimated_minutes:
        zone.estimated_minutes != null ? String(zone.estimated_minutes) : "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const saveZone = async () => {
    if (!form.name.trim()) {
      Alert.alert("Validation", "Zone name is required.");
      return;
    }
    const fee = parseFloat(form.fee);
    if (isNaN(fee) || fee < 0) {
      Alert.alert("Validation", "Enter a valid delivery fee.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        fee,
        sort_order: editingId
          ? (zones.find((z) => z.id === editingId)?.sort_order ?? 0)
          : zones.length,
      };
      if (form.distance_km.trim()) {
        const d = parseFloat(form.distance_km);
        if (!isNaN(d)) payload.distance_km = d;
      }
      if (form.estimated_minutes.trim()) {
        const m = parseInt(form.estimated_minutes, 10);
        if (!isNaN(m)) payload.estimated_minutes = m;
      }

      const saved = await apiClient.post("/api/admin/delivery/zones", payload);
      if (editingId) {
        setZones((prev) => prev.map((z) => (z.id === saved.id ? saved : z)));
      } else {
        setZones((prev) => [...prev.filter((z) => z.id !== saved.id), saved]);
      }
      closeModal();
      Alert.alert("Saved", editingId ? "Zone updated." : "Zone added.");
    } catch {
      Alert.alert("Error", "Could not save zone.");
    } finally {
      setSaving(false);
    }
  };

  const deleteZone = (zone: DeliveryZone) => {
    Alert.alert(
      "Remove Zone?",
      `Delete "${zone.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete(`/api/admin/delivery/zones/${zone.id}`);
              setZones((prev) => prev.filter((z) => z.id !== zone.id));
            } catch {
              Alert.alert("Error", "Could not delete zone.");
            }
          },
        },
      ],
    );
  };

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8CB46" />
        <ActivityIndicator color="#F59E0B" size="large" />
        <Text style={s.loadingText}>Loading zones...</Text>
      </View>
    );
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8CB46" />

      <AdminWavyHeader height={160}>
        <View style={s.headerRow}>
          <Pressable
            style={s.avatarBtn}
            onPress={() => router.replace("/admin/profile")}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={s.avatarImg} />
            ) : (
              <Image source={iconPng} style={s.avatarImg} />
            )}
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Delivery Zones</Text>
            <Text style={s.headerSub}>Configure areas and fees</Text>
          </View>
          <Pressable style={s.addZoneBtn} onPress={openAdd}>
            <MaterialIcons name="add" size={16} color="#FFFFFF" />
            <Text style={s.addZoneBtnText}>Add Zone</Text>
          </Pressable>
        </View>
      </AdminWavyHeader>

      <Pressable style={s.backRow} onPress={() => router.back()}>
        <MaterialIcons name="arrow-back" size={16} color="#64748B" />
        <Text style={s.backText}>Back</Text>
      </Pressable>

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
        {zones.length === 0 ? (
          <View style={s.emptyCard}>
            <MaterialIcons name="delivery-dining" size={44} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No delivery zones yet</Text>
            <Text style={s.emptySub}>
              Add zones with different fees for each delivery area.
            </Text>
            <Pressable style={s.emptyBtn} onPress={openAdd}>
              <MaterialIcons name="add" size={16} color="#FFFFFF" />
              <Text style={s.emptyBtnText}>Add First Zone</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.zoneList}>
            {zones.map((zone) => (
              <View key={zone.id} style={s.zoneCard}>
                <View style={s.zoneTop}>
                  <View style={s.zoneIconWrap}>
                    <MaterialIcons name="place" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.zoneName}>{zone.name}</Text>
                    <View style={s.zoneMetaRow}>
                      {zone.distance_km != null && (
                        <View style={s.chip}>
                          <MaterialIcons
                            name="straighten"
                            size={11}
                            color="#64748B"
                          />
                          <Text style={s.chipText}>{zone.distance_km} km</Text>
                        </View>
                      )}
                      {zone.estimated_minutes != null && (
                        <View style={s.chip}>
                          <MaterialIcons
                            name="schedule"
                            size={11}
                            color="#64748B"
                          />
                          <Text style={s.chipText}>
                            {zone.estimated_minutes} min
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={s.zoneFee}>₹{zone.fee}</Text>
                </View>
                <View style={s.zoneActions}>
                  <Pressable style={s.editBtn} onPress={() => openEdit(zone)}>
                    <MaterialIcons name="edit" size={14} color="#0F172A" />
                    <Text style={s.editBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={s.deleteBtn}
                    onPress={() => deleteZone(zone)}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={14}
                      color="#DC2626"
                    />
                    <Text style={s.deleteBtnText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Info Card ── */}
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <MaterialIcons name="lightbulb-outline" size={16} color="#F59E0B" />
            <Text style={s.infoTitle}>How distance-based pricing works</Text>
          </View>
          <Text style={s.infoBody}>
            Create zones for different delivery areas. Staff select the
            applicable zone when placing a delivery order — the fee is
            automatically added to the order total.
          </Text>
        </View>
      </ScrollView>

      {/* ── Add/Edit Modal ── */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>
                {editingId ? "Edit Zone" : "Add New Zone"}
              </Text>
              <Pressable onPress={closeModal}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>Zone Name *</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="e.g. City Centre, Zone A, 0–3 km"
                placeholderTextColor="#94A3B8"
              />

              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Distance (km)</Text>
                  <TextInput
                    style={s.input}
                    value={form.distance_km}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, distance_km: t }))
                    }
                    placeholder="e.g. 3.5"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Delivery Fee (₹) *</Text>
                  <TextInput
                    style={s.input}
                    value={form.fee}
                    onChangeText={(t) => setForm((f) => ({ ...f, fee: t }))}
                    placeholder="e.g. 50"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={s.fieldLabel}>
                Estimated Delivery Time (minutes)
              </Text>
              <TextInput
                style={s.input}
                value={form.estimated_minutes}
                onChangeText={(t) =>
                  setForm((f) => ({ ...f, estimated_minutes: t }))
                }
                placeholder="e.g. 30"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />

              <View style={s.modalActions}>
                <Pressable style={s.cancelBtnModal} onPress={closeModal}>
                  <Text style={s.cancelBtnModalText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.saveBtn, saving && s.btnDisabled]}
                  onPress={saveZone}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="save" size={16} color="#FFFFFF" />
                      <Text style={s.saveBtnText}>Save Zone</Text>
                    </>
                  )}
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
  screen: { flex: 1, backgroundColor: "#F8F9FB" },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FB",
    gap: 12,
  },
  loadingText: { color: "#64748B", fontWeight: "700", fontSize: 14 },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 20 },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: "#1a1a1a",
    fontWeight: "600",
    marginTop: 2,
  },
  addZoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0F172A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addZoneBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },

  /* Back */
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backText: { color: "#64748B", fontSize: 13, fontWeight: "700" },

  /* Scroll */
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 30 },

  /* Empty */
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
    marginTop: 10,
  },
  emptyTitle: { color: "#334155", fontSize: 16, fontWeight: "800" },
  emptySub: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0F172A",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },

  /* Zone List */
  zoneList: { gap: 10, marginTop: 10 },
  zoneCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  zoneTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  zoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  zoneName: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
  zoneMetaRow: { flexDirection: "row", gap: 8, marginTop: 3 },
  chip: { flexDirection: "row", alignItems: "center", gap: 3 },
  chipText: { color: "#64748B", fontSize: 11, fontWeight: "600" },
  zoneFee: { color: "#0F172A", fontSize: 18, fontWeight: "900" },

  zoneActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  editBtnText: { color: "#0F172A", fontSize: 12, fontWeight: "700" },
  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  deleteBtnText: { color: "#DC2626", fontSize: 12, fontWeight: "700" },

  /* Info */
  infoCard: {
    marginTop: 16,
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    gap: 6,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoTitle: { color: "#92400E", fontSize: 13, fontWeight: "800" },
  infoBody: {
    color: "#78716C",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "85%",
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
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#0F172A",
    fontWeight: "600",
    backgroundColor: "#FFFFFF",
    marginBottom: 4,
    fontSize: 14,
  },
  formRow: { flexDirection: "row", gap: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtnModal: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnModalText: { color: "#475569", fontSize: 14, fontWeight: "700" },
  saveBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
});
