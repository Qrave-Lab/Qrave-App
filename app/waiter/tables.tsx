import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { WaiterColors } from "../../constants/theme";

type TableStatus = "free" | "occupied" | "needs_reset";

type Table = {
  id: string;
  seats: number;
  status: TableStatus;
  note?: string;
};

const SAMPLE_TABLES: Table[] = [
  { id: "T1", seats: 4, status: "occupied", note: "Waiting for drinks" },
  { id: "T2", seats: 2, status: "free" },
  { id: "T3", seats: 6, status: "occupied", note: "Main course" },
  { id: "T4", seats: 4, status: "needs_reset", note: "Clean and reset" },
  { id: "T5", seats: 2, status: "free" },
  { id: "T6", seats: 4, status: "occupied" },
  { id: "T7", seats: 6, status: "free" },
  { id: "T8", seats: 4, status: "needs_reset" },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WaiterColors.background },
  header: { padding: 12 },
  title: { fontSize: 22, fontWeight: "800", color: WaiterColors.text },
  subtitle: { color: "#475569", marginTop: 4 },
  filterRow: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 8 },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: WaiterColors.card,
  },
  filterBtnActive: { backgroundColor: WaiterColors.primary },
  filterText: { color: WaiterColors.text },
  filterTextActive: { color: WaiterColors.card, fontWeight: "700" },
  card: {
    width: "48%",
    backgroundColor: WaiterColors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardOccupied: { borderColor: "#F59E0B", backgroundColor: "#FFFBEB" },
  cardFree: { borderColor: "#E2E8F0" },
  cardReset: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  tableId: { fontSize: 16, fontWeight: "800", color: WaiterColors.text },
  status: { marginTop: 6, fontWeight: "700" },
  note: { marginTop: 6, color: "#475569" },
  actionBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WaiterColors.primary,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700" },
});

export default function WaiterTables() {
  const [tables, setTables] = useState<Table[]>(SAMPLE_TABLES);
  const [filter, setFilter] = useState<"all" | TableStatus>("all");
  const [refreshing, setRefreshing] = useState(false);

  const visibleTables = useMemo(() => {
    if (filter === "all") return tables;
    return tables.filter((t) => t.status === filter);
  }, [tables, filter]);

  const markReady = (id: string) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "free", note: undefined } : t)),
    );
  };

  const cardStyleFor = (status: TableStatus) => {
    if (status === "occupied") return styles.cardOccupied;
    if (status === "needs_reset") return styles.cardReset;
    return styles.cardFree;
  };

  const statusLabel = (status: TableStatus) => {
    if (status === "needs_reset") return "Needs reset";
    return status === "occupied" ? "Occupied" : "Free";
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tables</Text>
        <Text style={styles.subtitle}>Quick view of floor status</Text>
      </View>

      <View style={styles.filterRow}>
        {[
          { key: "all", label: "All" },
          { key: "occupied", label: "Occupied" },
          { key: "needs_reset", label: "Needs Reset" },
          { key: "free", label: "Free" },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key as any)}
            style={[
              styles.filterBtn,
              filter === f.key ? styles.filterBtnActive : null,
            ]}
          >
            <Text
              style={filter === f.key ? styles.filterTextActive : styles.filterText}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleTables}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={WaiterColors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, cardStyleFor(item.status)]}>
            <Text style={styles.tableId}>{item.id}</Text>
            <Text style={styles.status}>{statusLabel(item.status)}</Text>
            <Text style={styles.note}>
              Seats: {item.seats}
              {item.note ? ` - ${item.note}` : ""}
            </Text>
            {item.status === "needs_reset" ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => markReady(item.id)}>
                <Text style={styles.actionText}>Mark Ready</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
