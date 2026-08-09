import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import type { Order } from "@/types/order";

interface OrderCardProps {
  order: Order;
  onPress?: () => void;
}

export default function OrderCard({ order, onPress }: OrderCardProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.id}>#{order.id}</Text>
        <Text style={styles.status}>{(order.status || '').toUpperCase()}</Text>
      </View>

      <Text style={styles.customer}>
        {order.customer} • {new Date(order.time || '').toLocaleTimeString()}
      </Text>

      <Text numberOfLines={1} style={styles.items}>
        {(order.items || []).map(it => `${it.qty || it.quantity}× ${it.name || it.menu_item_name}`).join(", ")}
      </Text>

      <View style={styles.row}>
        <Text style={styles.total}>₹ {order.total}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    elevation: 2,
  },
  id: { fontWeight: "700" },
  status: { fontWeight: "700", color: "#0a84ff" },
  customer: { color: "#555", marginTop: 4 },
  items: { color: "#333", marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  total: { fontWeight: "700" },
});
