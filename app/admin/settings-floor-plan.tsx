import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AdminSettingsHeader from "../../components/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type TableRow = {
  id: string;
  table_number: number;
  floor_name?: string;
  counter_name?: string;
  is_enabled: boolean;
  is_archived?: boolean;
};

const DEFAULT_FLOOR = "Main Floor";
const DEFAULT_COUNTER = "Counter A";

function sanitizeTable(raw: any): TableRow {
  return {
    id: String(raw?.id || ""),
    table_number: Number(raw?.table_number || 0),
    floor_name: String(raw?.floor_name || DEFAULT_FLOOR),
    counter_name: String(raw?.counter_name || DEFAULT_COUNTER),
    is_enabled: Boolean(raw?.is_enabled),
    is_archived: Boolean(raw?.is_archived),
  };
}

export default function SettingsFloorPlan() {
  const router = useRouter();

  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [floorFilter, setFloorFilter] = useState("all");

  const [editOpen, setEditOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);
  const [editFloor, setEditFloor] = useState(DEFAULT_FLOOR);
  const [editCounter, setEditCounter] = useState(DEFAULT_COUNTER);

  const [addOpen, setAddOpen] = useState(false);
  const [addCount, setAddCount] = useState("1");
  const [addFloor, setAddFloor] = useState(DEFAULT_FLOOR);
  const [addCounter, setAddCounter] = useState(DEFAULT_COUNTER);

  const addPreviewCount = useMemo(() => {
    const parsed = Number.parseInt(addCount, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(parsed, 200);
  }, [addCount]);

  const loadTables = useCallback(async () => {
    const res = await apiClient.get("/api/admin/tables");
    const rows = (Array.isArray(res) ? res : [])
      .map(sanitizeTable)
      .filter((t: TableRow) => t.id && !t.is_archived)
      .sort((a: TableRow, b: TableRow) => a.table_number - b.table_number);
    setTables(rows);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadTables();
      } catch {
        Alert.alert("Load failed", "Could not load floor plan.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTables]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTables();
    } finally {
      setRefreshing(false);
    }
  }, [loadTables]);

  const floors = useMemo(() => {
    const list = Array.from(
      new Set(tables.map((t) => (t.floor_name || DEFAULT_FLOOR).trim())),
    ).filter(Boolean);
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [tables]);

  const counters = useMemo(() => {
    const list = Array.from(
      new Set(tables.map((t) => (t.counter_name || DEFAULT_COUNTER).trim())),
    ).filter(Boolean);
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (floorFilter === "all") return tables;
    return tables.filter(
      (t) => (t.floor_name || DEFAULT_FLOOR).trim() === floorFilter,
    );
  }, [tables, floorFilter]);

  const toggleEnabled = useCallback(async (table: TableRow) => {
    const next = !table.is_enabled;
    setTables((prev) =>
      prev.map((t) => (t.id === table.id ? { ...t, is_enabled: next } : t)),
    );

    try {
      await apiClient.patch(`/api/admin/tables/${table.id}`, {
        is_enabled: next,
      });
    } catch {
      setTables((prev) =>
        prev.map((t) =>
          t.id === table.id ? { ...t, is_enabled: table.is_enabled } : t,
        ),
      );
      Alert.alert("Update failed", "Could not change table status.");
    }
  }, []);

  const removeTable = useCallback((table: TableRow) => {
    Alert.alert("Archive table?", `Archive table ${table.table_number}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          try {
            await apiClient.delete(`/api/admin/tables/${table.id}`);
            setTables((prev) => prev.filter((t) => t.id !== table.id));
          } catch {
            Alert.alert("Archive failed", "Could not archive table.");
          }
        },
      },
    ]);
  }, []);

  const openEdit = useCallback((table: TableRow) => {
    setEditingTable(table);
    setEditFloor((table.floor_name || DEFAULT_FLOOR).trim());
    setEditCounter((table.counter_name || DEFAULT_COUNTER).trim());
    setEditOpen(true);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingTable) return;
    const nextFloor = editFloor.trim() || DEFAULT_FLOOR;
    const nextCounter = editCounter.trim() || DEFAULT_COUNTER;
    try {
      setSaving(true);
      await apiClient.patch(`/api/admin/tables/${editingTable.id}/meta`, {
        floor_name: nextFloor,
        counter_name: nextCounter,
      });
      setTables((prev) =>
        prev.map((t) =>
          t.id === editingTable.id
            ? { ...t, floor_name: nextFloor, counter_name: nextCounter }
            : t,
        ),
      );
      setEditOpen(false);
      setEditingTable(null);
    } catch {
      Alert.alert("Update failed", "Could not update floor/counter.");
    } finally {
      setSaving(false);
    }
  }, [editCounter, editFloor, editingTable]);

  const createTables = useCallback(async () => {
    const count = Number(addCount);
    if (!Number.isFinite(count) || count < 1 || count > 200) {
      Alert.alert("Invalid count", "Table count must be between 1 and 200.");
      return;
    }

    const nextFloor = addFloor.trim() || DEFAULT_FLOOR;
    const nextCounter = addCounter.trim() || DEFAULT_COUNTER;

    try {
      setSaving(true);
      for (let i = 0; i < count; i += 1) {
        const created = await apiClient.post("/api/admin/tables", {});
        await apiClient.patch(`/api/admin/tables/${created.id}/meta`, {
          floor_name: nextFloor,
          counter_name: nextCounter,
        });
      }
      await loadTables();
      setAddOpen(false);
      setAddCount("1");
      Alert.alert(
        "Tables added",
        `${count} table${count > 1 ? "s" : ""} added.`,
      );
    } catch {
      Alert.alert("Add failed", "Could not create tables.");
    } finally {
      setSaving(false);
    }
  }, [addCount, addCounter, addFloor, loadTables]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#111827" />
        <Text style={styles.loadingText}>Loading floor plan...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Floor Plan"
        subtitle="Manage tables, floors, and counters"
        actionButton={
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <MaterialIcons name="add" size={16} color="#111827" />
            <Text style={styles.addBtnText}>Add Table</Text>
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
          <Text style={styles.label}>Show Floor</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.floorChips}
          >
            <Pressable
              style={[
                styles.floorChip,
                floorFilter === "all" && styles.floorChipActive,
              ]}
              onPress={() => setFloorFilter("all")}
            >
              <Text
                style={[
                  styles.floorChipText,
                  floorFilter === "all" && styles.floorChipTextActive,
                ]}
              >
                All Floors
              </Text>
            </Pressable>
            {floors.map((floor) => (
              <Pressable
                key={floor}
                style={[
                  styles.floorChip,
                  floorFilter === floor && styles.floorChipActive,
                ]}
                onPress={() => setFloorFilter(floor)}
              >
                <Text
                  style={[
                    styles.floorChipText,
                    floorFilter === floor && styles.floorChipTextActive,
                  ]}
                >
                  {floor}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.rowsWrap}>
            {filteredTables.map((table) => (
              <View key={table.id} style={styles.rowCard}>
                <View style={styles.rowLeft}>
                  <Text style={styles.tableNumber}>{table.table_number}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaPill}>
                      {table.floor_name || DEFAULT_FLOOR}
                    </Text>
                    <Text style={styles.metaPill}>
                      {table.counter_name || DEFAULT_COUNTER}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowRight}>
                  <Switch
                    value={table.is_enabled}
                    onValueChange={() => toggleEnabled(table)}
                    trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                    thumbColor="#FFFFFF"
                  />
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => openEdit(table)}
                  >
                    <MaterialIcons name="edit" size={18} color="#0F172A" />
                  </Pressable>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => removeTable(table)}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={19}
                      color="#DC2626"
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          {filteredTables.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                No tables configured for this floor.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              Edit Table {editingTable?.table_number || ""}
            </Text>
            <Text style={styles.modalLabel}>Floor</Text>
            <TextInput
              value={editFloor}
              onChangeText={setEditFloor}
              placeholder={DEFAULT_FLOOR}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>Counter</Text>
            <TextInput
              value={editCounter}
              onChangeText={setEditCounter}
              placeholder={DEFAULT_COUNTER}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setEditOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                onPress={saveEdit}
                disabled={saving}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Tables</Text>
            <Text style={styles.modalLabel}>Number of tables</Text>
            <TextInput
              value={addCount}
              onChangeText={setAddCount}
              keyboardType="number-pad"
              placeholder="1"
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>Floor</Text>
            <TextInput
              value={addFloor}
              onChangeText={setAddFloor}
              placeholder={DEFAULT_FLOOR}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>Counter</Text>
            <TextInput
              value={addCounter}
              onChangeText={setAddCounter}
              placeholder={DEFAULT_COUNTER}
              style={styles.modalInput}
            />
            <View style={styles.hintWrap}>
              {!!floors.length && (
                <Text style={styles.hintText}>Floors: {floors.join(", ")}</Text>
              )}
              {!!counters.length && (
                <Text style={styles.hintText}>
                  Counters: {counters.join(", ")}
                </Text>
              )}
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Preview</Text>
              <Text style={styles.previewText}>
                {addPreviewCount} table{addPreviewCount > 1 ? "s" : ""} on{" "}
                <Text style={styles.previewStrong}>
                  {addFloor.trim() || DEFAULT_FLOOR}
                </Text>
                {" \u00b7 "}
                <Text style={styles.previewStrong}>
                  {addCounter.trim() || DEFAULT_COUNTER}
                </Text>
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setAddOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                onPress={createTables}
                disabled={saving}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? "Adding..." : "Add Tables"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 8,
    color: "#64748B",
    fontWeight: "600",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
  },
  addBtnText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 13,
  },
  content: {
    padding: 12,
    paddingBottom: 26,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
  },
  label: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  floorChips: {
    gap: 8,
    paddingRight: 8,
    marginBottom: 12,
  },
  floorChip: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  floorChipActive: {
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  floorChipText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
  floorChipTextActive: {
    color: "#0F172A",
  },
  rowsWrap: {
    gap: 10,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowLeft: {
    flex: 1,
    gap: 6,
  },
  tableNumber: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaPill: {
    overflow: "hidden",
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748B",
    fontWeight: "600",
  },
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
    padding: 16,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  hintWrap: {
    marginBottom: 8,
  },
  hintText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  previewCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  previewText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  previewStrong: {
    color: "#0F172A",
    fontWeight: "800",
  },
  modalActions: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
