import React, { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  Share,
} from "react-native";
import { ThemedView } from "../../components/themed-view";
import { ThemedText } from "../../components/themed-text";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { AdminColors } from "../../constants/theme";

type Table = {
  id: string;
  items: number;
  total: string;
  status: string;
  time?: string;
  flag?: "bill" | "long" | string;
};
type Activity = {
  id: string;
  table: string;
  title: string;
  note: string;
  status: string;
  channel?: "kitchen" | "service";
};

const SAMPLE_TABLES: Table[] = [
  { id: "T1", items: 5, total: "₹1420", status: "occupied", time: "38m" },
  { id: "T2", items: 0, total: "—", status: "free" },
  {
    id: "T3",
    items: 3,
    total: "₹760",
    status: "occupied",
    time: "1h 23m",
    flag: "bill",
  },
  {
    id: "T4",
    items: 8,
    total: "₹2100",
    status: "occupied",
    time: "2h 3m",
    flag: "long",
  },
  { id: "T5", items: 0, total: "—", status: "free" },
  { id: "T6", items: 0, total: "—", status: "free" },
];

const SAMPLE_ACTIVITIES: Activity[] = [
  {
    id: "a1",
    table: "T1",
    title: "Smash Burger",
    note: "Qty: 2",
    status: "delayed",
    channel: "kitchen",
  },
  { id: "a2", table: "T3", title: "Mojito", note: "Qty: 1", status: "delayed" },
  {
    id: "a3",
    table: "T4",
    title: "Pasta Alfredo",
    note: "Qty: 3",
    status: "pending",
    channel: "kitchen",
  },
  {
    id: "a4",
    table: "T1",
    title: "Fries",
    note: "Qty: 1",
    status: "delayed",
    channel: "kitchen",
  },
];

export default function CustomizeTables() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"number" | "value" | "time">("number");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printSource, setPrintSource] = useState<string | null>(null);
  const [tablesData, setTablesData] = useState<Table[]>(SAMPLE_TABLES);
  const [activities, setActivities] = useState<Activity[]>(SAMPLE_ACTIVITIES);
  const [activityTab, setActivityTab] = useState<"kitchen" | "service">(
    "kitchen"
  );

  const parseTotal = (total: string) => {
    if (!total) return 0;
    const num = total.replace(/[^0-9]/g, "");
    return parseInt(num || "0", 10);
  };

  const parseTimeMinutes = (time?: string) => {
    if (!time) return 0;
    // examples: "1h 23m", "38m", "2h 3m"
    const hMatch = time.match(/(\d+)h/);
    const mMatch = time.match(/(\d+)m/);
    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    const m = mMatch ? parseInt(mMatch[1], 10) : 0;
    return h * 60 + m;
  };

  const tables = useMemo(() => {
    const filtered = tablesData
      .filter((t) => {
        if (filter === "occupied") return t.status === "occupied";
        if (filter === "free") return t.status === "free";
        return true;
      })
      .filter((t) => t.id.toLowerCase().includes(search.toLowerCase()));

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "number") {
        const na = parseInt(a.id.replace(/[^0-9]/g, ""), 10) || 0;
        const nb = parseInt(b.id.replace(/[^0-9]/g, ""), 10) || 0;
        return na - nb;
      }
      if (sortBy === "value") {
        return parseTotal(b.total) - parseTotal(a.total);
      }
      // time
      return parseTimeMinutes(b.time) - parseTimeMinutes(a.time);
    });

    return sorted;
  }, [filter, search, sortBy, tablesData]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Floor Overview</ThemedText>
        <View style={styles.headerRight}>
          <ThemedText type="defaultSemiBold">₹4,280</ThemedText>
          <ThemedText>3 / 8</ThemedText>
        </View>
      </ThemedView>

      <ThemedView style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricPendingBg]}>
            <IconSymbol name="fork.knife" size={18} color="#374151" />
          </View>
          <ThemedText type="defaultSemiBold">Pending</ThemedText>
          <ThemedText type="defaultSemiBold">Orders</ThemedText>
          <ThemedText type="title">4</ThemedText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricBillBg]}>
            <IconSymbol name="doc.text" size={18} color="#1E3A8A" />
          </View>
          <ThemedText type="defaultSemiBold">Bill Requests</ThemedText>
          <ThemedText type="title">1</ThemedText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricServiceBg]}>
            <IconSymbol name="bell.fill" size={18} color="#075985" />
          </View>
          <ThemedText type="defaultSemiBold">Service Calls</ThemedText>
          <ThemedText type="title">3</ThemedText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricLongBg]}>
            <IconSymbol name="clock" size={18} color="#7F1D1D" />
          </View>
          <ThemedText type="defaultSemiBold">Long Sitting</ThemedText>
          <ThemedText type="title">2</ThemedText>
        </View>
      </ThemedView>

      <View style={styles.controlsRow}>
        <View style={styles.filtersRow}>
          {[
            { key: "all", label: "All" },
            { key: "occupied", label: "Occupied" },
            { key: "free", label: "Free" },
            { key: "bill", label: "Bill Requested" },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterBtn,
                filter === f.key
                  ? styles.filterActive
                  : { backgroundColor: AdminColors.card },
              ]}
            >
              <Text
                style={
                  filter === f.key ? styles.filterTextActive : styles.filterText
                }
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            placeholder="Search table..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          <View style={{ position: "relative" }}>
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setSortMenuOpen((s) => !s)}
            >
              <Text>Sort by ▾</Text>
            </TouchableOpacity>
            {sortMenuOpen ? (
              <View style={styles.sortMenu}>
                {[
                  { key: "number", label: "Sort by Number" },
                  { key: "value", label: "Sort by Value" },
                  { key: "time", label: "Sort by Time" },
                ].map((op) => (
                  <TouchableOpacity
                    key={op.key}
                    onPress={() => {
                      setSortBy(op.key as any);
                      setSortMenuOpen(false);
                    }}
                    style={styles.sortItem}
                  >
                    <Text
                      style={
                        sortBy === op.key ? { fontWeight: "700" } : undefined
                      }
                    >
                      {op.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <FlatList
        data={tables}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.tableCard,
              item.status === "free" ? styles.tableFree : null,
              item.flag === "bill" ? styles.tableBill : null,
              item.flag === "long" ? styles.tableLong : null,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.optionsBtn,
                item.status === "free" ? { opacity: 0.45 } : undefined,
              ]}
              onPress={() =>
                item.status !== "free" &&
                setOpenMenuId(openMenuId === item.id ? null : item.id)
              }
              disabled={item.status === "free"}
            >
              <Text style={{ fontSize: 18 }}>⋮</Text>
            </TouchableOpacity>
            {openMenuId === item.id && item.status !== "free" ? (
              <View style={styles.optionsMenu}>
                {[
                  { key: "move", label: "Move Table" },
                  { key: "merge", label: "Merge Bill" },
                  { key: "print", label: "Print Bill" },
                  { key: "paid", label: "Mark Paid" },
                  { key: "free", label: "Free Table" },
                ].map((op) => (
                  <TouchableOpacity
                    key={op.key}
                    onPress={() => {
                      // close options menu first
                      setOpenMenuId(null);
                      if (op.key === "merge") {
                        setMergeSource(item.id);
                        setMergeModalOpen(true);
                        return;
                      }
                      if (op.key === "print") {
                        setPrintSource(item.id);
                        setPrintModalOpen(true);
                        return;
                      }
                      // TODO: wire other handlers
                      // eslint-disable-next-line no-console
                      console.log(op.key, item.id);
                    }}
                    style={styles.optionsItem}
                  >
                    <Text>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <View>
              <ThemedText type="title">{item.id}</ThemedText>
              {item.time ? <ThemedText>{item.time}</ThemedText> : null}
            </View>
            <View style={styles.tableStats}>
              <View style={styles.itemsBox}>
                <ThemedText>ITEMS</ThemedText>
                <ThemedText type="defaultSemiBold">{item.items}</ThemedText>
              </View>
              <ThemedText type="defaultSemiBold">{item.total}</ThemedText>
            </View>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 8 }} />}
      />

      {/* Merge modal */}
      <Modal
        visible={mergeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMergeModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="title">Merge Bill</ThemedText>
              <TouchableOpacity onPress={() => setMergeModalOpen(false)}>
                <Text style={{ fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ThemedText style={{ marginBottom: 12 }}>
              Merging {mergeSource} into another session
            </ThemedText>

            <FlatList
              data={tables.filter(
                (t) => t.id !== mergeSource && t.status !== "free"
              )}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mergeRow}
                  onPress={() => {
                    // perform merge: add source totals/items into target, free the source
                    const srcId = mergeSource;
                    const tgtId = item.id;
                    if (!srcId) return;
                    setTablesData((prev) => {
                      const src = prev.find((p) => p.id === srcId);
                      const tgt = prev.find((p) => p.id === tgtId);
                      if (!src || !tgt) return prev;
                      const newTotal =
                        parseTotal(src.total) + parseTotal(tgt.total);
                      const newItems = (src.items || 0) + (tgt.items || 0);
                      return prev.map((p) => {
                        if (p.id === tgtId) {
                          return {
                            ...p,
                            total: `₹${newTotal}`,
                            items: newItems,
                            // merged table becomes occupied
                            status: "occupied",
                            // clear any special flag
                            flag: undefined,
                          };
                        }
                        if (p.id === srcId) {
                          return {
                            ...p,
                            total: "—",
                            items: 0,
                            status: "free",
                            time: undefined,
                            flag: undefined,
                          };
                        }
                        return p;
                      });
                    });
                    setMergeModalOpen(false);
                    setMergeSource(null);
                  }}
                >
                  <View style={styles.tableThumbnail}>
                    <Text>{item.id}</Text>
                  </View>
                  <View style={styles.tableInfo}>
                    <Text style={styles.amountText}>{item.total} Bill</Text>
                    <Text style={styles.guestsText}>
                      👥 {item.items} Guests
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18 }}>➜</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Print modal */}
      <Modal
        visible={printModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPrintModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="title">Print Bill</ThemedText>
              <TouchableOpacity onPress={() => setPrintModalOpen(false)}>
                <Text style={{ fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {printSource
              ? (() => {
                  const table = tablesData.find((t) => t.id === printSource);
                  return (
                    <>
                      <ThemedText style={{ marginBottom: 12 }}>
                        Bill for {printSource}
                      </ThemedText>
                      <View style={{ marginBottom: 12 }}>
                        <Text>Items: {table?.items ?? 0}</Text>
                        <Text>Total: {table?.total ?? "—"}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={async () => {
                          const t = tablesData.find(
                            (x) => x.id === printSource
                          );
                          if (!t) return;
                          const csv = `Table,Items,Total\n${t.id},${t.items},${t.total}\n`;
                          try {
                            await Share.share({
                              title: `Bill_${t.id}.csv`,
                              message: csv,
                            });
                          } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error(e);
                          }
                          setPrintModalOpen(false);
                          setPrintSource(null);
                        }}
                      >
                        <Text style={{ fontWeight: "700" }}>Export Bill</Text>
                      </TouchableOpacity>
                    </>
                  );
                })()
              : null}
          </View>
        </View>
      </Modal>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Activity Feed</ThemedText>

        <View style={styles.activityTabsRow}>
          <TouchableOpacity
            style={[
              styles.activityTab,
              activityTab === "kitchen" ? styles.activityTabActive : null,
            ]}
            onPress={() => setActivityTab("kitchen")}
          >
            <Text
              style={
                activityTab === "kitchen"
                  ? styles.activityTabTextActive
                  : styles.activityTabText
              }
            >
              Kitchen
            </Text>
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>
                {
                  activities.filter(
                    (x) =>
                      x.channel === "kitchen" &&
                      x.status !== "accepted" &&
                      x.status !== "rejected"
                  ).length
                }
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.activityTab,
              activityTab === "service" ? styles.activityTabActive : null,
            ]}
            onPress={() => setActivityTab("service")}
          >
            <Text
              style={
                activityTab === "service"
                  ? styles.activityTabTextActive
                  : styles.activityTabText
              }
            >
              Service
            </Text>
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>
                {
                  activities.filter(
                    (x) =>
                      x.channel === "service" &&
                      x.status !== "accepted" &&
                      x.status !== "rejected"
                  ).length
                }
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {activities
          .filter((a) => a.channel === activityTab)
          .filter((a) => a.status !== "accepted" && a.status !== "rejected")
          .map((a) => (
            <View key={a.id} style={styles.activityCard}>
              <View style={styles.activityLeft}>
                <View style={styles.tableBadge}>
                  <ThemedText>{a.table}</ThemedText>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <ThemedText type="defaultSemiBold">{a.title}</ThemedText>
                  <ThemedText>{a.note}</ThemedText>
                </View>
              </View>
              <View style={styles.activityActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => {
                    setActivities((prev) =>
                      prev.map((p) =>
                        p.id === a.id ? { ...p, status: "accepted" } : p
                      )
                    );
                  }}
                >
                  <Text style={{ color: "#0F766E" }}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => {
                    setActivities((prev) =>
                      prev.map((p) =>
                        p.id === a.id ? { ...p, status: "rejected" } : p
                      )
                    );
                  }}
                >
                  <Text style={{ color: "#991B1B" }}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    paddingBottom: 32,
    backgroundColor: AdminColors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerRight: { alignItems: "flex-end" },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: AdminColors.card,
    alignItems: "center",
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  metricPendingBg: { backgroundColor: "#F8FAFC" },
  metricBillBg: { backgroundColor: "#EEF6FF" },
  metricServiceBg: { backgroundColor: "#EFF6FF" },
  metricLongBg: { backgroundColor: "#FFF5F6" },
  controlsRow: { marginBottom: 12 },
  filtersRow: { flexDirection: "row", marginBottom: 8 },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: AdminColors.secondary,
  },
  filterActive: { backgroundColor: AdminColors.primary },
  filterText: { color: AdminColors.text },
  filterTextActive: { color: AdminColors.card, fontWeight: "700" },
  searchInput: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: AdminColors.card,
    borderWidth: 1,
    borderColor: "#eee",
  },
  tableCard: {
    width: "48%",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
    position: "relative",
  },
  tableFree: {
    opacity: 0.45,
    backgroundColor: "#FBFBFD",
    borderColor: "#F1F5F9",
  },
  tableBill: {
    borderColor: "#C7E9FF",
    backgroundColor: "#F0FAFF",
  },
  tableLong: {
    borderColor: "#FECACA",
    backgroundColor: "#FFF5F5",
  },

  tableStats: { marginTop: 8, alignItems: "flex-end" },
  itemsBox: {
    backgroundColor: "#F3F4F6",
    padding: 6,
    borderRadius: 8,
    marginBottom: 6,
    alignItems: "center",
  },
  section: { marginTop: 12 },
  activityCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: AdminColors.card,
    marginTop: 8,
  },
  activityLeft: { flexDirection: "row", alignItems: "center" },
  tableBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  activityActions: { flexDirection: "row" },
  acceptBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    marginRight: 8,
  },
  rejectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
  },
  optionsBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 20,
    padding: 6,
    borderRadius: 8,
  },
  optionsMenu: {
    position: "absolute",
    top: 40,
    right: 8,
    width: 160,
    backgroundColor: AdminColors.card,
    borderRadius: 10,
    paddingVertical: 6,
    zIndex: 30,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  optionsItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: AdminColors.card,
    marginLeft: 8,
  },
  sortMenu: {
    position: "absolute",
    top: 44,
    right: 0,
    backgroundColor: AdminColors.card,
    borderRadius: 8,
    paddingVertical: 6,
    width: 160,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 16,
  },
  sortItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  mergeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: AdminColors.background,
    marginBottom: 8,
  },
  tableThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tableInfo: { flex: 1 },
  amountText: { fontWeight: "700" },
  guestsText: { color: "#6B7280", marginTop: 2 },
  exportBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: AdminColors.primary,
  },
  activityTabsRow: { flexDirection: "row", marginVertical: 12 },
  activityTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: AdminColors.background,
    marginRight: 8,
  },
  activityTabActive: { backgroundColor: AdminColors.card },
  activityTabText: { color: "#6B7280", marginRight: 8 },
  activityTabTextActive: {
    color: "#111827",
    marginRight: 8,
    fontWeight: "700",
  },
  activityBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityBadgeText: { fontSize: 12, color: "#374151" },
});
