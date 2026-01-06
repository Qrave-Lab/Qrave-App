import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { AdminColors } from "../../constants/theme";

const staff = [
  { id: "1", name: "Alice", role: "Manager", online: true },
  { id: "2", name: "Bob", role: "Chef", online: false },
  { id: "3", name: "Clara", role: "Waiter", online: true },
];

export default function Staff() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff Management</Text>
      <FlatList
        data={staff}
        keyExtractor={(i) => i.id}
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
  status: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
