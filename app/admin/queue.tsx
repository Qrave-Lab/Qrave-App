import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import iconPng from "../../assets/images/icon.png";
import AdminWavyHeader from "../../components/admin/AdminWavyHeader";
import apiClient from "../../lib/apiClient";
import { getStoredLogoVersion, withLogoVersion } from "../../lib/logoVersion";

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

type TableOption = {
  id: string;
  table_number?: number;
  number?: number;
  capacity?: number;
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

export default function QueueScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [reservations, setReservations] = useState<ReservationEntry[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [seatTableMap, setSeatTableMap] = useState<Record<string, string>>({});
  const [autoSessionMap, setAutoSessionMap] = useState<Record<string, boolean>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tablesRes, resRes, waitRes] = await Promise.all([
        apiClient.get("/api/admin/tables"),
        apiClient.get("/api/admin/reservations?status=booked"),
        apiClient.get("/api/admin/waitlist?status=waiting"),
      ]);
      setTables(Array.isArray(tablesRes) ? tablesRes : []);
      setReservations(
        Array.isArray(resRes?.reservations) ? resRes.reservations : [],
      );
      setWaitlist(Array.isArray(waitRes?.waitlist) ? waitRes.waitlist : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

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
      console.warn("Failed to seat waitlist guest", e);
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

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData().catch(() => undefined);
    }, 5000);
    (async () => {
      try {
        const me = await apiClient.get("/api/admin/me");
        const rId = me?.restaurant_id || me?.id;
        if (rId) {
          const version = await getStoredLogoVersion();
          const res = await fetch(
            `https://qrave-backend.onrender.com/public/restaurants/${rId}/logo`,
          );
          const data = await res.json();
          setLogoUrl(withLogoVersion(data?.logo_url, version));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => clearInterval(timer);
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={s.screen}>
      <AdminWavyHeader height={160}>
        <View style={s.headerTopRow}>
          <Pressable
            style={s.profileAvatar}
            onPress={() => router.replace("/admin/profile")}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={s.profileImage} />
            ) : (
              <Image source={iconPng} style={s.profileImage} />
            )}
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Queue & Waitlist</Text>
          </View>
          <View style={s.headerActions}>
            <Pressable
              style={s.backBtn}
              onPress={() => router.push("/admin/takeaway" as any)}
            >
               <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
          </View>
        </View>
      </AdminWavyHeader>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={s.grid}>
          {/* Card 1: Upcoming Reservations */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialIcons name="event-available" size={20} color="#6366F1" style={s.cardIcon} />
              <View>
                <Text style={s.cardTitle}>Upcoming Reservations</Text>
                <Text style={s.cardSubtitle}>Bookings scheduled for today.</Text>
              </View>
            </View>
            
            <View style={s.cardBody}>
              {reservations.length === 0 ? (
                <View style={s.emptyBox}>
                  <View style={s.emptyIconWrap}>
                    <MaterialIcons name="calendar-month" size={32} color="#93C5FD" />
                  </View>
                  <Text style={s.emptyTitle}>No reservations scheduled</Text>
                  <Text style={s.emptyHint}>
                    Use Book Reservation at the top to schedule.
                  </Text>
                </View>
              ) : (
                <View style={s.entryList}>
                  {reservations.map((entry) => (
                    <View key={entry.id} style={s.entryCard}>
                      <View style={s.entryTopRow}>
                        <Text style={s.entryName}>{entry.guest_name}</Text>
                        <Text style={s.entryBadge}>{entry.party_size} guests</Text>
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
              <View>
                <Text style={s.cardTitle}>Live Waitlist Queue</Text>
                <Text style={s.cardSubtitle}>Live guest wait times and best-fit availability.</Text>
              </View>
            </View>
            
            <View style={s.cardBody}>
              {waitlist.length === 0 ? (
                <View style={s.emptyBox}>
                  <View style={s.emptyIconWrap}>
                    <MaterialIcons name="auto-awesome" size={32} color="#FDBA74" />
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
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={s.rankBadge}>
                            <Text style={s.rankBadgeText}>#{index + 1}</Text>
                          </View>
                          <Text style={[s.entryName, { marginLeft: 12 }]}>{entry.guest_name}</Text>
                        </View>
                        <View style={[s.entryBadge, s.waitBadge, { flexDirection: 'row', alignItems: 'center' }]}>
                          <MaterialIcons name="schedule" size={14} color="#047857" style={{ marginRight: 4 }} />
                          <Text style={s.waitBadgeText}>Waiting {waitedMinutes(entry.created_at)}m</Text>
                        </View>
                      </View>
                      <Text style={s.entryMeta}>
                        {entry.party_size} guests · quoted {entry.quoted_minutes || 20}m
                      </Text>
                      <View style={s.seatingBox}>
                        <Text style={s.selectLabel}>Select seating table</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={s.tableStrip}
                        >
                          <Pressable
                            style={[
                              s.tableChip,
                              selectedTable === "auto" && s.tableChipActive,
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
                                s.tableChipText,
                                selectedTable === "auto" &&
                                  s.tableChipTextActive,
                              ]}
                            >
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
                                style={[
                                  s.tableChip,
                                  best && s.tableChipBestFit,
                                  isSelected && s.tableChipActive,
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
                                    s.tableChipText,
                                    best && s.tableChipTextBestFit,
                                    isSelected && s.tableChipTextActive,
                                  ]}
                                >
                                  T{getTableNumber(table)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                        <Pressable
                          style={s.sessionToggle}
                          onPress={() =>
                            setAutoSessionMap((prev) => ({
                              ...prev,
                              [entry.id]: !isAutoSession,
                            }))
                          }
                        >
                          <Text style={s.sessionToggleText}>
                            Auto-start dining session
                          </Text>
                          <View
                            style={[
                              s.switchTrack,
                              isAutoSession && s.switchTrackActive,
                            ]}
                          >
                            <View
                              style={[
                                s.switchKnob,
                                isAutoSession && s.switchKnobActive,
                              ]}
                            />
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
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: "hidden",
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 21,
  },
  content: { padding: 16, paddingBottom: 40 },
  grid: {
    flexDirection: Platform.select({ web: "row", default: "column" }),
    gap: 16,
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flex: Platform.select({ web: 1, default: 0 }),
    minWidth: Platform.OS === "web" ? 300 : undefined,
    width: Platform.OS === "web" ? undefined : "100%",
  },
  cardHeader: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "flex-start",
  },
  cardIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  cardBody: {
    padding: 16,
  },
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
    backgroundColor: "#F8FAFC",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
    textAlign: "center"
  },
  emptyHint: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    fontWeight: "500"
  },
  entryList: {
    gap: 10,
  },
  entryCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  entryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  entryName: {
    flex: 1,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  entryBadge: {
    color: "#4338CA",
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  waitBadge: {
    color: "#047857",
    backgroundColor: "#ECFDF5",
  },
  entryMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 6,
  },
  rankBadge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F8FAFC",
  },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  waitBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#047857",
  },
  readyWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  readyText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  seatingBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  selectLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  tableStrip: {
    flexGrow: 0,
    marginBottom: 10,
  },
  tableChip: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#F8FAFC",
  },
  tableChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  tableChipBestFit: {
    backgroundColor: "#DCFCE7",
    borderColor: "#10B981",
  },
  tableChipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  tableChipTextActive: {
    color: "#FFFFFF",
  },
  tableChipTextBestFit: {
    color: "#047857",
  },
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
  sessionToggleText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  switchTrack: {
    width: 42,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    padding: 3,
  },
  switchTrackActive: {
    backgroundColor: "#10B981",
  },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  switchKnobActive: {
    transform: [{ translateX: 18 }],
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  seatBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#047857",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seatBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 4,
  },
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
  noShowBtnText: {
    color: "#D97706",
    fontSize: 13,
    fontWeight: "700",
  },
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
  cancelBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 4,
  },
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
  bumpBtnTextLight: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
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
  removeBtnText: {
    color: "#E11D48",
    fontSize: 13,
    fontWeight: "700",
  },
});
