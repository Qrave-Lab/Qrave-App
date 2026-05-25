import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import { useRouter } from "expo-router";

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
  phone?: string;
};

type WaitlistEntry = {
  id: string;
  guest_name: string;
  party_size: number;
  quoted_minutes?: number;
  created_at?: string;
  phone?: string;
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

const formatDateTime = (value?: string) => {
  if (!value) return "";
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
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  return Math.max(0, Number.isFinite(mins) ? mins : 0);
};

const getTableNumber = (table: TableOption) =>
  table.table_number || table.number || Number(String(table.id).replace(/\D/g, ""));

const isBestFit = (table: TableOption, partySize: number) => {
  const capacity = table.capacity ?? 4;
  return capacity >= partySize && capacity <= partySize + 2;
};

export default function WaiterWaitlistScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [reservations, setReservations] = useState<ReservationEntry[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [seatTableMap, setSeatTableMap] = useState<Record<string, string>>({});
  const [autoSessionMap, setAutoSessionMap] = useState<Record<string, boolean>>({});
  
  // Modals
  const [showResModal, setShowResModal] = useState(false);
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [saving, setSaving] = useState(false);

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
    () => [...tables].sort((a, b) => (a?.table_number || 0) - (b?.table_number || 0)),
    [tables],
  );

  const loadData = useCallback(async () => {
    try {
      const [tablesRes, resRes, waitRes] = await Promise.all([
        apiClient.get("/api/admin/tables"),
        apiClient.get("/api/admin/reservations?status=booked"),
        apiClient.get("/api/admin/waitlist?status=waiting"),
      ]);
      setTables(Array.isArray(tablesRes) ? tablesRes : []);
      setReservations(Array.isArray(resRes?.reservations) ? resRes.reservations : []);
      setWaitlist(Array.isArray(waitRes?.waitlist) ? waitRes.waitlist : []);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData().catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

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
      setShowResModal(false);
      setReservationForm({
        name: "",
        partySize: "2",
        date: todayInput(),
        time: defaultTimeInput(),
        tableId: "any",
        phone: "",
        notes: "",
      });
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
      setShowWaitModal(false);
      setWaitlistForm({ name: "", partySize: "2", phone: "", quotedMins: "20" });
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const seatWaitlistEntry = async (entry: WaitlistEntry) => {
    const autoSession = autoSessionMap[entry.id] !== false;
    const tableId = seatTableMap[entry.id] || "auto";
    try {
      await apiClient.post(`/api/admin/waitlist/${entry.id}/seat`, {
        table_id: tableId,
        auto_session: autoSession,
      });
      await loadData();
    } catch (e) {
      console.warn("Failed to seat guest", e);
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

  const updateWaitlistStatus = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/api/admin/waitlist/${id}`, { status });
      await loadData();
    } catch (e) {
      console.warn("Failed to update waitlist", e);
    }
  };

  const reorderWaitlist = async (newList: WaitlistEntry[]) => {
    try {
      setWaitlist(newList);
      await apiClient.put("/api/admin/waitlist/reorder", {
        ordered_ids: newList.map((i) => i.id),
      });
      await loadData();
    } catch (e) {
      console.warn("Waitlist reorder failed", e);
      loadData();
    }
  };

  const bumpUp = (index: number) => {
    if (index === 0) return;
    const nextList = [...waitlist];
    [nextList[index - 1], nextList[index]] = [nextList[index], nextList[index - 1]];
    reorderWaitlist(nextList);
  };

  return (
    <View style={s.screen}>
      <WaiterWavyHeader title="Queue & Waitlist" height={140} />

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.grid}>
          {/* Card 1: Upcoming Reservations */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialIcons name="event-available" size={20} color={WaiterColors.primary} style={s.cardIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Upcoming Reservations</Text>
                <Text style={s.cardSubtitle}>Bookings scheduled for today.</Text>
              </View>
              <Pressable style={s.headerAddBtn} onPress={() => setShowResModal(true)}>
                <MaterialIcons name="add" size={18} color="#FFF" />
              </Pressable>
            </View>
            
            <View style={s.cardBody}>
              {reservations.length === 0 ? (
                <View style={s.emptyBox}>
                  <View style={s.emptyIconWrap}>
                    <MaterialIcons name="calendar-month" size={32} color={WaiterColors.primary} />
                  </View>
                  <Text style={s.emptyTitle}>No reservations scheduled</Text>
                  <Text style={s.emptyHint}>Tap the + icon to schedule a reservation.</Text>
                </View>
              ) : (
                <View style={s.entryList}>
                  {reservations.map((entry) => (
                    <View key={entry.id} style={s.entryCard}>
                      <View style={s.entryTopRow}>
                        <Text style={s.entryName}>{entry.guest_name}</Text>
                        <Text style={s.resBadge}>{entry.party_size} guests</Text>
                      </View>
                      <Text style={s.entryMeta}>
                        {formatDateTime(entry.reserved_at)} · {entry.table_number ? `Table ${entry.table_number}` : "Any table"}
                      </Text>
                      <View style={s.actionRow}>
                        <Pressable style={s.seatBtn} onPress={() => updateReservationStatus(entry.id, "seated")}>
                          <MaterialIcons name="check-circle-outline" size={16} color="#FFFFFF" />
                          <Text style={s.seatBtnText}>Seat</Text>
                        </Pressable>
                        <Pressable style={s.noShowBtn} onPress={() => updateReservationStatus(entry.id, "no_show")}>
                          <Text style={s.noShowBtnText}>No-show</Text>
                        </Pressable>
                        <Pressable style={s.cancelBtn} onPress={() => updateReservationStatus(entry.id, "cancelled")}>
                          <MaterialIcons name="cancel" size={16} color="#475569" />
                          <Text style={s.cancelBtnText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Card 2: Live Waitlist Queue */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialIcons name="people-outline" size={20} color="#10B981" style={s.cardIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Live Waitlist Queue</Text>
                <Text style={s.cardSubtitle}>Live guest wait times & best-fit availability.</Text>
              </View>
              <Pressable style={s.headerAddBtn} onPress={() => setShowWaitModal(true)}>
                <MaterialIcons name="add" size={18} color="#FFF" />
              </Pressable>
            </View>
            
            <View style={s.cardBody}>
              {waitlist.length === 0 ? (
                <View style={s.emptyBox}>
                  <View style={[s.emptyIconWrap, { backgroundColor: "#ECFDF5" }]}>
                    <MaterialIcons name="auto-awesome" size={32} color="#10B981" />
                  </View>
                  <Text style={s.emptyTitle}>All guests seated!</Text>
                  <Text style={s.emptyHint}>Waitlist is currently empty.</Text>
                </View>
              ) : (
                <View style={s.entryList}>
                  {waitlist.map((entry, index) => {
                    const partySize = Number(entry.party_size) || 1;
                    const selectedTable = seatTableMap[entry.id] || "auto";
                    const isAutoSession = autoSessionMap[entry.id] !== false;
                    return (
                    <View key={entry.id} style={s.entryCard}>
                      <View style={s.entryTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                          <View style={s.rankBadge}>
                            <Text style={s.rankBadgeText}>#{index + 1}</Text>
                          </View>
                          <Text style={[s.entryName, { marginLeft: 12 }]} numberOfLines={1}>{entry.guest_name}</Text>
                        </View>
                        <View style={[s.waitBadge, { flexDirection: 'row', alignItems: 'center', marginLeft: 8 }]}>
                          <MaterialIcons name="schedule" size={14} color="#047857" style={{ marginRight: 4 }} />
                          <Text style={s.waitBadgeText}>Waiting {waitedMinutes(entry.created_at)}m</Text>
                        </View>
                      </View>
                      <Text style={s.entryMeta}>
                        {entry.party_size} guests · quoted {entry.quoted_minutes || 20}m
                      </Text>
                      <View style={s.seatingBox}>
                        <Text style={s.selectLabel}>Select seating table</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tableStrip}>
                          <Pressable
                            style={[s.tableChip, selectedTable === "auto" && s.tableChipActive]}
                            onPress={() => setSeatTableMap((prev) => ({ ...prev, [entry.id]: "auto" }))}
                          >
                            <Text style={[s.tableChipText, selectedTable === "auto" && s.tableChipTextActive]}>
                              Auto-assign
                            </Text>
                          </Pressable>
                          {tables.map((table) => {
                            const tableId = String(table.id);
                            const best = isBestFit(table, partySize);
                            const isSelected = selectedTable === tableId;
                            return (
                              <Pressable
                                key={tableId}
                                style={[s.tableChip, best && s.tableChipBestFit, isSelected && s.tableChipActive]}
                                onPress={() => setSeatTableMap((prev) => ({ ...prev, [entry.id]: tableId }))}
                              >
                                <Text style={[s.tableChipText, best && s.tableChipTextBestFit, isSelected && s.tableChipTextActive]}>
                                  T{getTableNumber(table)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                        <Pressable
                          style={s.sessionToggle}
                          onPress={() => setAutoSessionMap((prev) => ({ ...prev, [entry.id]: !isAutoSession }))}
                        >
                          <Text style={s.sessionToggleText}>Auto-start dining session</Text>
                          <View style={[s.switchTrack, isAutoSession && s.switchTrackActive]}>
                            <View style={[s.switchKnob, isAutoSession && s.switchKnobActive]} />
                          </View>
                        </Pressable>
                      </View>
                      <View style={s.actionRow}>
                        <Pressable style={s.seatBtn} onPress={() => seatWaitlistEntry(entry)}>
                          <MaterialIcons name="check-circle-outline" size={16} color="#FFFFFF" />
                          <Text style={s.seatBtnText}>Seat Guest</Text>
                        </Pressable>
                        <Pressable style={s.bumpBtnLight} onPress={() => bumpUp(index)}>
                          <MaterialIcons name="arrow-upward" size={16} color="#475569" style={{ marginRight: 6 }} />
                          <Text style={s.bumpBtnTextLight}>Bump</Text>
                        </Pressable>
                        <Pressable style={s.removeBtn} onPress={() => updateWaitlistStatus(entry.id, "removed")}>
                          <MaterialIcons name="cancel" size={16} color="#E11D48" style={{ marginRight: 6 }} />
                          <Text style={s.removeBtnText}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CREATE RESERVATION MODAL */}
      <Modal visible={showResModal} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Reservation</Text>
              <Pressable onPress={() => setShowResModal(false)}>
                <MaterialIcons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={s.inputLabel}>Guest Name</Text>
              <TextInput style={s.input} value={reservationForm.name} onChangeText={(t) => setReservationForm(p => ({...p, name: t}))} placeholder="John Doe" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Party Size</Text>
                  <TextInput style={s.input} value={reservationForm.partySize} onChangeText={(t) => setReservationForm(p => ({...p, partySize: t}))} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Date</Text>
                  <TextInput style={s.input} value={reservationForm.date} onChangeText={(t) => setReservationForm(p => ({...p, date: t}))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Time</Text>
                  <TextInput style={s.input} value={reservationForm.time} onChangeText={(t) => setReservationForm(p => ({...p, time: t}))} />
                </View>
              </View>
              <Text style={[s.inputLabel, { marginTop: 12 }]}>Table</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <Pressable style={[s.tableChip, reservationForm.tableId === "any" && s.tableChipActive]} onPress={() => setReservationForm(p => ({...p, tableId: "any"}))}>
                  <Text style={[s.tableChipText, reservationForm.tableId === "any" && s.tableChipTextActive]}>Any</Text>
                </Pressable>
                {tableOptions.map(t => {
                  const isBest = isBestFit(t, Number(reservationForm.partySize) || 1);
                  return (
                    <Pressable key={t.id} style={[s.tableChip, isBest && s.tableChipBestFit, reservationForm.tableId === t.id && s.tableChipActive]} onPress={() => setReservationForm(p => ({...p, tableId: t.id}))}>
                      <Text style={[s.tableChipText, isBest && s.tableChipTextBestFit, reservationForm.tableId === t.id && s.tableChipTextActive]}>T{getTableNumber(t)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={s.inputLabel}>Phone (Optional)</Text>
              <TextInput style={s.input} value={reservationForm.phone} onChangeText={(t) => setReservationForm(p => ({...p, phone: t}))} placeholder="+1 234..." />
              <Text style={[s.inputLabel, { marginTop: 12 }]}>Notes</Text>
              <TextInput style={s.input} value={reservationForm.notes} onChangeText={(t) => setReservationForm(p => ({...p, notes: t}))} placeholder="Window seat" />
            </ScrollView>
            <View style={s.modalFooter}>
              <Pressable style={s.primaryBtn} onPress={createReservation} disabled={saving}>
                <Text style={s.primaryBtnText}>{saving ? "Saving..." : "Create Reservation"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD TO WAITLIST MODAL */}
      <Modal visible={showWaitModal} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Walk-in Waitlist</Text>
              <Pressable onPress={() => setShowWaitModal(false)}>
                <MaterialIcons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={s.inputLabel}>Guest Name</Text>
              <TextInput style={s.input} value={waitlistForm.name} onChangeText={(t) => setWaitlistForm(p => ({...p, name: t}))} placeholder="Jane Doe" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Party Size</Text>
                  <TextInput style={s.input} value={waitlistForm.partySize} onChangeText={(t) => setWaitlistForm(p => ({...p, partySize: t}))} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Quoted Mins</Text>
                  <TextInput style={s.input} value={waitlistForm.quotedMins} onChangeText={(t) => setWaitlistForm(p => ({...p, quotedMins: t}))} keyboardType="number-pad" />
                </View>
              </View>
              <Text style={[s.inputLabel, { marginTop: 12 }]}>Phone (Optional)</Text>
              <TextInput style={s.input} value={waitlistForm.phone} onChangeText={(t) => setWaitlistForm(p => ({...p, phone: t}))} placeholder="+1 234..." />
            </ScrollView>
            <View style={s.modalFooter}>
              <Pressable style={s.primaryBtn} onPress={createWaitlist} disabled={saving}>
                <Text style={s.primaryBtnText}>{saving ? "Adding..." : "Add to Waitlist"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WaiterColors.background },
  content: { padding: 16, paddingBottom: 40 },
  grid: {
    flexDirection: Platform.select({ web: "row", default: "column" }),
    gap: 16,
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WaiterColors.border,
    flex: Platform.select({ web: 1, default: 0 }),
    minWidth: Platform.OS === "web" ? 300 : undefined,
    width: Platform.OS === "web" ? undefined : "100%",
    shadowColor: WaiterColors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "flex-start",
  },
  cardIcon: { marginRight: 10, marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  headerAddBtn: {
    backgroundColor: WaiterColors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 16 },
  emptyBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  emptyIconWrap: {
    marginBottom: 12,
    backgroundColor: "#F0FDF4",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 6, textAlign: "center" },
  emptyHint: { fontSize: 13, color: "#64748B", textAlign: "center", fontWeight: "500" },
  entryList: { gap: 10 },
  entryCard: {
    borderWidth: 1,
    borderColor: WaiterColors.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  entryTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  entryName: { flex: 1, color: "#0F172A", fontSize: 15, fontWeight: "800" },
  resBadge: {
    color: WaiterColors.primaryDark,
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  waitBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  waitBadgeText: { fontSize: 12, fontWeight: "800", color: "#047857" },
  entryMeta: { color: "#64748B", fontSize: 12, fontWeight: "600", marginTop: 2, marginBottom: 6 },
  rankBadge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F8FAFC",
  },
  rankBadgeText: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  seatingBox: {
    borderWidth: 1,
    borderColor: WaiterColors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  selectLabel: { color: "#64748B", fontSize: 12, fontWeight: "900", textTransform: "uppercase", marginBottom: 10 },
  tableStrip: { flexGrow: 0, marginBottom: 10 },
  tableChip: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#F8FAFC",
  },
  tableChipActive: { backgroundColor: WaiterColors.primary, borderColor: WaiterColors.primary },
  tableChipBestFit: { backgroundColor: "#DCFCE7", borderColor: "#10B981" },
  tableChipText: { color: "#475569", fontSize: 12, fontWeight: "800" },
  tableChipTextActive: { color: "#FFFFFF" },
  tableChipTextBestFit: { color: "#047857" },
  sessionToggle: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
  },
  sessionToggleText: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  switchTrack: { width: 42, height: 24, borderRadius: 999, backgroundColor: "#CBD5E1", padding: 3 },
  switchTrackActive: { backgroundColor: WaiterColors.primary },
  switchKnob: { width: 18, height: 18, borderRadius: 999, backgroundColor: "#FFFFFF" },
  switchKnobActive: { transform: [{ translateX: 18 }] },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  seatBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: WaiterColors.primaryDark,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seatBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginLeft: 4 },
  noShowBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  noShowBtnText: { color: "#D97706", fontSize: 13, fontWeight: "700" },
  cancelBtn: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { color: "#475569", fontSize: 13, fontWeight: "700", marginLeft: 4 },
  bumpBtnLight: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  bumpBtnTextLight: { color: "#475569", fontSize: 13, fontWeight: "700" },
  removeBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FFE4E6",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#E11D48", fontSize: 13, fontWeight: "700" },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  modalBox: { backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, padding: 12, fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC" },
  primaryBtn: { backgroundColor: WaiterColors.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
