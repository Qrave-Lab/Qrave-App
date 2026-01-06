import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { AdminColors } from "../../constants/theme";

const billing = [
  { id: "1", item: "Soda Cans", qtySold: 30, price: 1.5 },
  { id: "2", item: "Burger", qtySold: 45, price: 5.0 },
  { id: "3", item: "Cheese Slices", qtySold: 100, price: 0.2 },
];

export default function Billing() {
  const total = billing.reduce((s, i) => s + i.qtySold * i.price, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Billing Overview</Text>
      <FlatList
        data={billing}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.item}>{item.item}</Text>
              <Text style={styles.sub}>
                Qty: {item.qtySold} • ${item.price.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.total}>
              ${(item.qtySold * item.price).toFixed(2)}
            </Text>
          </View>
        )}
      />
      <View style={styles.summary}>
        <Text style={{ fontWeight: "700" }}>Grand Total</Text>
        <Text style={{ fontWeight: "700" }}>${total.toFixed(2)}</Text>
      </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: AdminColors.card,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: AdminColors.accent,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  item: { fontWeight: "700", color: AdminColors.text },
  sub: { color: "#6b7280" },
  total: { fontWeight: "700" },
  summary: {
    marginTop: 12,
    padding: 12,
    backgroundColor: AdminColors.card,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
