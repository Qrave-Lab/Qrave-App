import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { AdminColors } from "../../constants/theme";

export default function Staff() {
  const [refreshing, setRefreshing] = useState(false);
  const [staff] = useState<any[]>([]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff Management</Text>
      <FlatList
        data={staff}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No staff members yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AdminColors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.role}>{item.role}</Text>
            </View>
            <View
              style={[
                styles.status,
                { backgroundColor: item.online ? "#34D399" : "#E5E7EB" },
              ]}
            >
              <Text style={{ color: item.online ? "#fff" : "#6b7280" }}>
                {item.online ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: AdminColors.background },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    color: AdminColors.text,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: AdminColors.card,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: AdminColors.accent,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  name: { fontWeight: "700", color: AdminColors.text },
  role: { color: "#6b7280" },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
