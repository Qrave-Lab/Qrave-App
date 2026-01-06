import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { AdminColors } from "../../constants/theme";

const initialInventory = [
  { id: "1", name: "Soda Cans", qty: 120, price: 1.5 },
  { id: "2", name: "Burger Buns", qty: 60, price: 0.75 },
  { id: "3", name: "Cheese Slices", qty: 200, price: 0.2 },
];

export default function Inventory() {
  const [items, setItems] = useState(initialInventory);

  const changeQty = (id: string, delta: number) => {
    setItems((s) =>
      s.map((it) =>
        it.id === id ? { ...it, qty: Math.max(0, it.qty + delta) } : it
      )
    );
  };

  const editPrice = (id: string, newPrice: number) => {
    setItems((s) =>
      s.map((it) => (it.id === id ? { ...it, price: newPrice } : it))
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>Price: ${item.price.toFixed(2)}</Text>
            </View>
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={() => changeQty(item.id, -1)}
                style={styles.controlBtn}
              >
                <Text style={styles.controlText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qty}>{item.qty}</Text>
              <TouchableOpacity
                onPress={() => changeQty(item.id, 1)}
                style={[
                  styles.controlBtn,
                  { backgroundColor: AdminColors.primary },
                ]}
              >
                <Text style={[styles.controlText, { color: "#fff" }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: "#666" }}>No inventory items.</Text>
        }
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
    alignItems: "center",
    padding: 12,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: AdminColors.accent,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  name: { fontSize: 16, fontWeight: "600", color: AdminColors.text },
  sub: { color: "#666", marginTop: 4 },
  controls: { flexDirection: "row", alignItems: "center" },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: AdminColors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: { fontSize: 20, fontWeight: "700", color: AdminColors.text },
  qty: {
    marginHorizontal: 8,
    minWidth: 30,
    textAlign: "center",
    fontWeight: "700",
  },
});
