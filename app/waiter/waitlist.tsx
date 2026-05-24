import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import WaiterWavyHeader from "../../components/WaiterWavyHeader";
import { WaiterColors } from "../../constants/theme";
import apiClient from "../../lib/apiClient";

type TableOption = {
  id: string;
  table_number?: number;
  number?: number;
  capacity?: number;
};

type ReservationEntry = {
  id: string;
  guest_name: string;
  party_size: number;
  reserved_at: string;
  table_number?: number;
};

type WaitlistEntry = {
  id: string;
  guest_name: string;
  party_size: number;
  quoted_minutes?: number;
  created_at?: string;
};

const toIsoFromInputs = (date: string, time: string) => {
  const iso = new Date(`${date}T${time}`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
};

const todayInput = () => new Date().toISOString().slice(0, 10);
const defaultTimeInput = () => {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  return `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
};
const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};
const waitedMinutes = (value?: string) => {
  if (!value) return 0;
  const n = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  return Math.max(0, Number.isFinite(n) ? n : 0);
};

// Returns true when a table is the tightest fit for a given party size.
const getTableNumber = (table: TableOption) =>
  table.table_number || table.number || Number(String(table.id).replace(/\D/g, ""));

const isBestFit = (table: TableOption, partySize: number) => {
  const cap = table.capacity ?? 4;
  return cap >= partySize && cap <= partySize + 2;
};

const availableTableSummary = (tables: TableOption[], partySize: number) => {
  const best = tables.filter((table) => isBestFit(table, partySize));
  const list = (best.length ? best : tables)
    .slice(0, 8)
    .map((table) => `T${getTableNumber(table)}`)
    .join(", ");
  return list || "Auto-assign available";
};

export default function WaiterWaitlistScreen() {
  const [tables, setTables] = useState<TableOption[]>([]);
  const [reservations, setReservations] = useState<ReservationEntry[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Per-entry auto-session toggle (defaults to true)
  const [autoSessionMap, setAutoSessionMap] = useState<Record<string, boolean>>({});
  const [seatTableMap, setSeatTableMap] = useState<Record<string, string>>({});

  const [reservationForm, setReservationForm] = useState({
    name: "",
    partySize: "2",
    date: todayInput(),
    time: defaultTimeInput(),
    tableId: "any",
    phone: "",
    notes: "",
  });

  const [waitlistForm, setWaitlistForm] = useState({
    name: "",
    partySize: "2",
    phone: "",
    quotedMins: "20",
  });

  const tableOptions = useMemo(
    () =>
      [...tables].sort(
        (a, b) => (a?.table_number || 0) - (b?.table_number || 0),
      ),
    [tables],
  );

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tablesRes, reservationsRes, waitlistRes] = await Promise.all([
        apiClient.get("/api/admin/tables"),
        apiClient.get("/api/admin/reservations?status=booked"),
        apiClient.get("/api/admin/waitlist?status=waiting"),
      ]);
      setTables(Array.isArray(tablesRes) ? tablesRes : []);
      setReservations(reservationsRes?.reservations || []);
      setWaitlist(waitlistRes?.waitlist || []);
    } catch (e) {
      console.warn("Failed to load waitlist data", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData(true).catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  const createReservation = async () => {
    if (!reservationForm.name.trim()) {
      Alert.alert("Guest required", "Enter a guest name for the reservation.");
      return;
    }
    const iso = toIsoFromInputs(reservationForm.date, reservationForm.time);
    if (!iso) {
      Alert.alert("Invalid time", "Use a valid date and time.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("/api/admin/reservations", {
        guest_name: reservationForm.name.trim(),
        party_size: Math.max(1, Number(reservationForm.partySize) || 1),
        reserved_at: iso,
        table_id: reservationForm.tableId || "any",
        phone: reservationForm.phone.trim() || undefined,
        notes: reservationForm.notes.trim() || undefined,
      });
      setReservationForm((prev) => ({
        ...prev,
        name: "",
        partySize: "2",
        date: todayInput(),
        time: defaultTimeInput(),
        phone: "",
        notes: "",
      }));
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const createWaitlist = async () => {
    if (!waitlistForm.name.trim()) {
      Alert.alert("Guest required", "Enter a guest name for the waitlist.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/api/admin/waitlist", {
        guest_name: waitlistForm.name.trim(),
        party_size: Math.max(1, Number(waitlistForm.partySize) || 1),
        phone: waitlistForm.phone.trim() || undefined,
        quoted_minutes: Math.max(5, Number(waitlistForm.quotedMins) || 5),
      });
      setWaitlistForm((prev) => ({
        ...prev,
        name: "",
        partySize: "2",
        phone: "",
        quotedMins: "20",
      }));
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const seatWaitlistEntry = async (entry: WaitlistEntry) => {
    const autoSession = autoSessionMap[entry.id] !== false; // default true
    const tableId = seatTableMap[entry.id] || "auto";
    try {
      const res = await apiClient.post(`/api/admin/waitlist/${entry.id}/seat`, {
        table_id: tableId,
        auto_session: autoSession,
      });
      if (res?.session_id) {
        Alert.alert("Seated", `${entry.guest_name} seated — dining session started ✓`);
      }
      await loadData();
    } catch (e) {
      console.warn("Failed to seat waitlist", e);
    }
  };

  const bumpWaitlistEntry = async (id: string) => {
    try {
      await apiClient.post(`/api/admin/waitlist/${id}/bump`, {});
      await loadData();
    } catch (e) {
      console.warn("Failed to bump waitlist", e);
    }
  };

  const reorderWaitlist = async (nextQueue: WaitlistEntry[]) => {
    setSaving(true);
    try {
      const total = nextQueue.length;
      await Promise.all(
        nextQueue.map((entry, index) =>
          apiClient.patch(`/api/admin/waitlist/${entry.id}`, {
            priority: total - index,
          }),
        ),
      );
      await loadData();
    } catch (e) {
      console.warn("Failed to reorder waitlist", e);
      Alert.alert("Reorder failed", "Could not update the waitlist order.");
    } finally {
      setSaving(false);
    }
  };

  const moveWaitlistEntry = (index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= waitlist.length) return;
    const nextQueue = [...waitlist];
    [nextQueue[index], nextQueue[nextIndex]] = [
      nextQueue[nextIndex],
      nextQueue[index],
    ];
    reorderWaitlist(nextQueue);
  };

  const removeWaitlistEntry = async (id: string) => {
    try {
      await apiClient.patch(`/api/admin/waitlist/${id}`, { status: "removed" });
      await loadData();
    } catch (e) {
      console.warn("Failed to remove waitlist", e);
    }
  };

  const updateReservationStatus = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/api/admin/reservations/${id}`, { status });
      await loadData();
    } catch (e) {
      console.warn("Failed to update reservation", e);
    }
  };

  return (
    <View style={styles.container}>
      <WaiterWavyHeader title="Reservations & Waitlist" height={140} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create Reservation</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Guest Name</Text>
            <TextInput
              style={styles.input}
              value={reservationForm.name}
              onChangeText={(text) =>
                setReservationForm((prev) => ({ ...prev, name: text }))
              }
              placeholder="Guest name"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.label}>Party Size</Text>
            <TextInput
              style={styles.input}
              value={reservationForm.partySize}
              onChangeText={(text) =>
                setReservationForm((prev) => ({ ...prev, partySize: text }))
              }
              keyboardType="number-pad"
              placeholder="2"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={reservationForm.date}
                  onChangeText={(text) =>
                    setReservationForm((prev) => ({ ...prev, date: text }))
                  }
                  placeholder="2026-05-23"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Time (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={reservationForm.time}
                  onChangeText={(text) =>
                    setReservationForm((prev) => ({ ...prev, time: text }))
                  }
                  placeholder="19:30"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
            <Text style={styles.label}>Table</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tableStrip}
            >
              <TouchableOpacity
                style={[
                  styles.tableChip,
                  reservationForm.tableId === "any" && styles.tableChipActive,
                ]}
                onPress={() =>
                  setReservationForm((prev) => ({ ...prev, tableId: "any" }))
                }
              >
                <Text
                  style={[
                    styles.tableChipText,
                    reservationForm.tableId === "any" &&
                      styles.tableChipTextActive,
                  ]}
                >
                  Any
                </Text>
              </TouchableOpacity>
              {tableOptions.map((table) => {
                const partySize = Number(reservationForm.partySize) || 1;
                const best = isBestFit(table, partySize);
                return (
                  <TouchableOpacity
                    key={table.id}
                    style={[
                      styles.tableChip,
                      best && styles.tableChipBestFit,
                      reservationForm.tableId === table.id && styles.tableChipActive,
                    ]}
                    onPress={() =>
                      setReservationForm((prev) => ({ ...prev, tableId: table.id }))
                    }
                  >
                    <Text
                      style={[
                        styles.tableChipText,
                        best && styles.tableChipTextBestFit,
                        reservationForm.tableId === table.id && styles.tableChipTextActive,
                      ]}
                    >
                      {best ? "★ " : ""}T{table.table_number}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={reservationForm.phone}
                  onChangeText={(text) =>
                    setReservationForm((prev) => ({ ...prev, phone: text }))
                  }
                  placeholder="+91 98xxxxxx"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={styles.input}
                  value={reservationForm.notes}
                  onChangeText={(text) =>
                    setReservationForm((prev) => ({ ...prev, notes: text }))
                  }
                  placeholder="Window seat"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={createReservation}
              disabled={saving}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? "Saving..." : "Add Reservation"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Reservations</Text>
          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator color={WaiterColors.primary} />
            ) : reservations.length === 0 ? (
              <Text style={styles.emptyText}>No reservations yet.</Text>
            ) : (
              reservations.map((entry) => (
                <View key={entry.id} style={styles.listItem}>
                  <View style={styles.listRow}>
                    <Text style={styles.listTitle}>{entry.guest_name}</Text>
                    <Text style={styles.listBadge}>
                      {entry.party_size} guests
                    </Text>
                  </View>
                  <Text style={styles.listMeta}>
                    {formatDateTime(entry.reserved_at)}
                    {entry.table_number ? ` • T${entry.table_number}` : ""}
                  </Text>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() =>
                        updateReservationStatus(entry.id, "seated")
                      }
                    >
                      <Text style={styles.secondaryBtnText}>Seat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() =>
                        updateReservationStatus(entry.id, "cancelled")
                      }
                    >
                      <Text style={styles.ghostBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Walk-in Waitlist</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Guest Name</Text>
            <TextInput
              style={styles.input}
              value={waitlistForm.name}
              onChangeText={(text) =>
                setWaitlistForm((prev) => ({ ...prev, name: text }))
              }
              placeholder="Guest name"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Party Size</Text>
                <TextInput
                  style={styles.input}
                  value={waitlistForm.partySize}
                  onChangeText={(text) =>
                    setWaitlistForm((prev) => ({ ...prev, partySize: text }))
                  }
                  keyboardType="number-pad"
                  placeholder="2"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Quoted Wait (mins)</Text>
                <TextInput
                  style={styles.input}
                  value={waitlistForm.quotedMins}
                  onChangeText={(text) =>
                    setWaitlistForm((prev) => ({ ...prev, quotedMins: text }))
                  }
                  keyboardType="number-pad"
                  placeholder="20"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={waitlistForm.phone}
              onChangeText={(text) =>
                setWaitlistForm((prev) => ({ ...prev, phone: text }))
              }
              placeholder="+91 98xxxxxx"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={createWaitlist}
              disabled={saving}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? "Saving..." : "Add to Waitlist"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator color={WaiterColors.primary} />
            ) : waitlist.length === 0 ? (
              <Text style={styles.emptyText}>No one waiting right now.</Text>
            ) : (
              waitlist.map((entry, index) => {
                const isAutoSession = autoSessionMap[entry.id] !== false;
                const partySize = Number(entry.party_size) || 1;
                return (
                  <View key={entry.id} style={styles.listItem}>
                    <View style={styles.listRow}>
                      <Text style={styles.listTitle}>
                        #{index + 1} {entry.guest_name}
                      </Text>
                      <Text style={styles.listBadge}>{entry.party_size} guests</Text>
                    </View>
                    <Text style={styles.listMeta}>
                      Waited {waitedMinutes(entry.created_at)}m / quoted {entry.quoted_minutes}m
                    </Text>

                    <View style={styles.readyWrap}>
                      <MaterialIcons name="circle" size={8} color="#10B981" />
                      <Text style={styles.readyText}>
                        Table ready: {availableTableSummary(tableOptions, partySize)}
                      </Text>
                    </View>

                    <View style={styles.seatingBox}>
                      <Text style={styles.selectionLabel}>
                        Select seating table
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.tableStrip}
                      >
                        <TouchableOpacity
                          style={[
                            styles.tableChip,
                            (seatTableMap[entry.id] || "auto") === "auto" &&
                              styles.tableChipActive,
                          ]}
                          onPress={() =>
                            setSeatTableMap((prev) => ({
                              ...prev,
                              [entry.id]: "auto",
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.tableChipText,
                              (seatTableMap[entry.id] || "auto") === "auto" &&
                                styles.tableChipTextActive,
                            ]}
                          >
                            Auto-assign
                          </Text>
                        </TouchableOpacity>
                        {tableOptions.map((table) => {
                          const tableId = String(table.id);
                          const best = isBestFit(table, partySize);
                          const isSelected = seatTableMap[entry.id] === tableId;
                          return (
                            <TouchableOpacity
                              key={tableId}
                              style={[
                                styles.tableChip,
                                best && styles.tableChipBestFit,
                                isSelected && styles.tableChipActive,
                              ]}
                              onPress={() =>
                                setSeatTableMap((prev) => ({
                                  ...prev,
                                  [entry.id]: tableId,
                                }))
                              }
                            >
                              <Text
                                style={[
                                  styles.tableChipText,
                                  best && styles.tableChipTextBestFit,
                                  isSelected && styles.tableChipTextActive,
                                ]}
                              >
                                T{getTableNumber(table)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Auto-session toggle */}
                    <TouchableOpacity
                      style={[
                        styles.toggleRow,
                        isAutoSession && styles.toggleRowActive,
                      ]}
                      onPress={() =>
                        setAutoSessionMap((prev) => ({
                          ...prev,
                          [entry.id]: !isAutoSession,
                        }))
                      }
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          isAutoSession && styles.toggleThumbActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.toggleLabel,
                          isAutoSession && styles.toggleLabelActive,
                        ]}
                      >
                        ⚡ Auto-start session
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.seatGuestBtn}
                        onPress={() => seatWaitlistEntry(entry)}
                      >
                        <MaterialIcons
                          name="check-circle-outline"
                          size={17}
                          color="#FFFFFF"
                        />
                        <Text style={styles.seatGuestText}>Seat Guest</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconBtn,
                          index === 0 && styles.disabledBtn,
                        ]}
                        disabled={index === 0 || saving}
                        onPress={() => moveWaitlistEntry(index, -1)}
                      >
                        <Text style={styles.iconBtnText}>↑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconBtn,
                          index === waitlist.length - 1 && styles.disabledBtn,
                        ]}
                        disabled={index === waitlist.length - 1 || saving}
                        onPress={() => moveWaitlistEntry(index, 1)}
                      >
                        <Text style={styles.iconBtnText}>↓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => bumpWaitlistEntry(entry.id)}
                      >
                        <Text style={styles.secondaryBtnText}>Bump</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ghostBtn}
                        onPress={() => removeWaitlistEntry(entry.id)}
                      >
                        <Text style={styles.ghostBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  section: { gap: 10 },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  label: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A",
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  flex: { flex: 1, minWidth: 140 },
  primaryBtn: {
    backgroundColor: WaiterColors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "800" },
  secondaryBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  iconBtn: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconBtnText: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
  disabledBtn: { opacity: 0.45 },
  ghostBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
  },
  ghostBtnText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  listItem: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 10,
    marginTop: 10,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  listBadge: {
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  listMeta: { fontSize: 12, color: "#64748B" },
  readyWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  readyText: {
    flex: 1,
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
  },
  seatingBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  selectionLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  emptyText: { fontSize: 12, color: "#94A3B8" },
  tableStrip: { flexGrow: 0 },
  tableChip: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: "#F8FAFC",
  },
  tableChipActive: {
    backgroundColor: WaiterColors.primary,
    borderColor: WaiterColors.primary,
  },
  tableChipBestFit: {
    backgroundColor: "#DCFCE7",
    borderColor: "#16A34A",
  },
  tableChipText: { color: "#64748B", fontWeight: "700", fontSize: 12 },
  tableChipTextActive: { color: "#FFFFFF" },
  tableChipTextBestFit: { color: "#15803D", fontWeight: "800" },
  seatGuestBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: WaiterColors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  seatGuestText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#F8FAFC",
  },
  toggleRowActive: {
    borderColor: "#16A34A",
    backgroundColor: "#F0FDF4",
  },
  toggleThumb: {
    width: 28,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
  },
  toggleThumbActive: {
    backgroundColor: "#16A34A",
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  toggleLabelActive: {
    color: "#15803D",
  },
});
