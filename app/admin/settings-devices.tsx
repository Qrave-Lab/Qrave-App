import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
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

type PrinterChannel = "kitchen" | "billing" | "bar";
type PrinterMode = "system" | "serial";

type PrinterProfile = {
  id: string;
  name: string;
  channel: PrinterChannel;
  mode: PrinterMode;
  baudRate: number;
  enabled: boolean;
  updatedAt: number;
};

const STORAGE_KEY = "admin_pos_printer_profiles_v1";
const CHANNELS: PrinterChannel[] = ["kitchen", "billing", "bar"];
const MODES: PrinterMode[] = ["system", "serial"];

const channelLabel = (ch: PrinterChannel) =>
  ch === "kitchen" ? "Kitchen" : ch === "billing" ? "Billing" : "Bar";
const modeLabel = (mode: PrinterMode) =>
  mode === "system" ? "System" : "Serial ESC/POS";

const makeDefaultProfiles = (): PrinterProfile[] => [
  {
    id: "printer-kitchen",
    name: "Kitchen Printer",
    channel: "kitchen",
    mode: "system",
    baudRate: 9600,
    enabled: true,
    updatedAt: Date.now(),
  },
  {
    id: "printer-billing",
    name: "Billing Printer",
    channel: "billing",
    mode: "system",
    baudRate: 9600,
    enabled: true,
    updatedAt: Date.now(),
  },
];

async function loadProfiles(): Promise<PrinterProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = makeDefaultProfiles();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return makeDefaultProfiles();
    return parsed as PrinterProfile[];
  } catch {
    return makeDefaultProfiles();
  }
}

async function saveProfiles(next: PrinterProfile[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export default function SettingsDevices() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerItems, setPickerItems] = useState<
    { id: string; label: string }[]
  >([]);
  const [pickerSelect, setPickerSelect] = useState<
    ((id: string) => void) | null
  >(null);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.updatedAt - a.updatedAt),
    [profiles],
  );

  const hydrate = useCallback(async () => {
    const loaded = await loadProfiles();
    setProfiles(loaded);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const persist = useCallback(async (next: PrinterProfile[]) => {
    setProfiles(next);
    await saveProfiles(next);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await hydrate();
    } finally {
      setRefreshing(false);
    }
  }, [hydrate]);

  const openPicker = useCallback(
    (
      title: string,
      items: { id: string; label: string }[],
      onSelect: (id: string) => void,
    ) => {
      setPickerTitle(title);
      setPickerItems(items);
      setPickerSelect(() => onSelect);
      setPickerOpen(true);
    },
    [],
  );

  const patchProfile = useCallback(
    async (id: string, patch: Partial<PrinterProfile>) => {
      const current = profiles.find((p) => p.id === id);
      if (!current) return;
      const nextChannel = (patch.channel ?? current.channel) as PrinterChannel;
      const nextEnabled = patch.enabled ?? current.enabled;

      const next = profiles.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            ...patch,
            channel: nextChannel,
            enabled: nextEnabled,
            updatedAt: Date.now(),
          };
        }
        if (nextEnabled && p.channel === nextChannel) {
          return { ...p, enabled: false, updatedAt: p.updatedAt };
        }
        return p;
      });
      await persist(next);
    },
    [persist, profiles],
  );

  const addProfile = useCallback(async () => {
    const id = `printer-${Date.now()}`;
    const next: PrinterProfile[] = [
      {
        id,
        name: "New Printer",
        channel: "kitchen",
        mode: "system",
        baudRate: 9600,
        enabled: true,
        updatedAt: Date.now(),
      },
      ...profiles.map((p) =>
        p.channel === "kitchen" ? { ...p, enabled: false } : p,
      ),
    ];
    await persist(next);
  }, [persist, profiles]);

  const removeProfile = useCallback(
    async (id: string) => {
      const next = profiles.filter((p) => p.id !== id);
      await persist(next.length ? next : makeDefaultProfiles());
    },
    [persist, profiles],
  );

  const testProfile = useCallback(
    async (profile: PrinterProfile) => {
      setTestingId(profile.id);
      try {
        const reassigned = profiles.map((p) =>
          p.id === profile.id
            ? { ...p, enabled: true, updatedAt: Date.now() }
            : p.channel === profile.channel
              ? { ...p, enabled: false }
              : p,
        );
        await persist(reassigned);
        Alert.alert(
          "Test queued",
          `Printer: ${profile.name}\nChannel: ${channelLabel(profile.channel)}\nMode: ${modeLabel(profile.mode)}`,
        );
      } finally {
        setTestingId("");
      }
    },
    [persist, profiles],
  );

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Devices & QR"
        subtitle="POS printers and table QR tools"
        actionButton={
          <Pressable style={styles.addBtn} onPress={addProfile}>
            <MaterialIcons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add Printer</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <MaterialIcons name="print" size={20} color="#64748B" />
            <Text style={styles.sectionTitle}>POS Printers</Text>
          </View>

          <View style={styles.rowsWrap}>
            {sortedProfiles.map((p) => (
              <View key={p.id} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Printer Name</Text>
                    <TextInput
                      value={p.name}
                      onChangeText={(v) => void patchProfile(p.id, { name: v })}
                      style={[styles.input, styles.nameInput]}
                      placeholder="Printer name"
                    />
                  </View>
                  <Pressable
                    style={[
                      styles.stateBtn,
                      p.enabled ? styles.stateEnabled : styles.stateDisabled,
                    ]}
                    onPress={() =>
                      void patchProfile(p.id, { enabled: !p.enabled })
                    }
                  >
                    <Text
                      style={[
                        styles.stateText,
                        p.enabled
                          ? styles.stateTextEnabled
                          : styles.stateTextDisabled,
                      ]}
                    >
                      {p.enabled ? "Enabled" : "Disabled"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.controlGrid}>
                  <View style={styles.controlItem}>
                    <Text style={styles.fieldLabel}>Channel</Text>
                    <Pressable
                      style={styles.selectBtn}
                      onPress={() =>
                        openPicker(
                          "Channel",
                          CHANNELS.map((ch) => ({
                            id: ch,
                            label: channelLabel(ch),
                          })),
                          (id) =>
                            void patchProfile(p.id, {
                              channel: id as PrinterChannel,
                            }),
                        )
                      }
                    >
                      <Text style={styles.selectText}>
                        {channelLabel(p.channel)}
                      </Text>
                      <MaterialIcons
                        name="expand-more"
                        size={18}
                        color="#64748B"
                      />
                    </Pressable>
                  </View>

                  <View style={styles.controlItem}>
                    <Text style={styles.fieldLabel}>Mode</Text>
                    <Pressable
                      style={styles.selectBtn}
                      onPress={() =>
                        openPicker(
                          "Mode",
                          MODES.map((m) => ({ id: m, label: modeLabel(m) })),
                          (id) =>
                            void patchProfile(p.id, {
                              mode: id as PrinterMode,
                            }),
                        )
                      }
                    >
                      <Text style={styles.selectText}>{modeLabel(p.mode)}</Text>
                      <MaterialIcons
                        name="expand-more"
                        size={18}
                        color="#64748B"
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.controlGrid}>
                  <View style={styles.controlItem}>
                    <Text style={styles.fieldLabel}>Baud Rate</Text>
                    <TextInput
                      value={String(p.baudRate)}
                      onChangeText={(v) =>
                        void patchProfile(p.id, { baudRate: Number(v) || 9600 })
                      }
                      editable={p.mode === "serial"}
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        p.mode !== "serial" && styles.inputDisabled,
                      ]}
                    />
                  </View>

                  <View style={[styles.controlItem, styles.actionCell]}>
                    <Pressable
                      style={styles.testBtn}
                      onPress={() => void testProfile(p)}
                      disabled={testingId === p.id}
                    >
                      <MaterialIcons name="science" size={15} color="#0F172A" />
                      <Text style={styles.testText}>
                        {testingId === p.id ? "Testing..." : "Test"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => void removeProfile(p.id)}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={20}
                        color="#E11D48"
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.rowFoot}>
                  <Text style={styles.rowHint}>
                    Assign one active printer per channel (Kitchen/Billing/Bar).
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.qrCard}
            onPress={() => router.push("/admin/qr-codes")}
          >
            <View style={styles.qrLeft}>
              <View style={styles.qrIconWrap}>
                <MaterialIcons name="qr-code-2" size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.qrTitle}>QR Codes</Text>
                <Text style={styles.qrSub}>Manage table QR generation</Text>
              </View>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#94A3B8" />
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            {pickerItems.map((item) => (
              <Pressable
                key={item.id}
                style={styles.modalItem}
                onPress={() => {
                  pickerSelect?.(item.id);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  addBtn: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  content: { padding: 12, paddingBottom: 26 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 12,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: "#0F172A", fontSize: 26, fontWeight: "800" },
  rowsWrap: { gap: 10 },
  rowCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  fieldLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  controlGrid: {
    flexDirection: "row",
    gap: 8,
  },
  controlItem: {
    flex: 1,
  },
  actionCell: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  nameInput: { minWidth: 0 },
  inputDisabled: { backgroundColor: "#F1F5F9", color: "#94A3B8" },
  selectBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { color: "#0F172A", fontSize: 14, fontWeight: "600" },
  stateBtn: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stateEnabled: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  stateDisabled: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" },
  stateText: { fontSize: 13, fontWeight: "800" },
  stateTextEnabled: { color: "#047857" },
  stateTextDisabled: { color: "#64748B" },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
  },
  rowFoot: {
    marginTop: 2,
  },
  rowHint: { color: "#64748B", fontSize: 11, fontWeight: "600" },
  testBtn: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  testText: { color: "#0F172A", fontSize: 12, fontWeight: "800" },
  qrCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qrLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  qrIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  qrTitle: { color: "#0F172A", fontSize: 17, fontWeight: "800" },
  qrSub: { color: "#64748B", fontSize: 12, fontWeight: "600", marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  modalItem: {
    minHeight: 44,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  modalItemText: { color: "#0F172A", fontSize: 15, fontWeight: "600" },
});
