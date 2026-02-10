// app/order-detail.js
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useSearchParams, useRouter } from "expo-router";

export default function OrderDetailScreen() {
  const { order: orderParam } = useSearchParams();
  const router = useRouter();

  let parsed = {};
  try {
    parsed = orderParam ? JSON.parse(decodeURIComponent(orderParam)) : {};
  } catch (_e) {
    parsed = {};
  }

  const [order, setOrder] = useState(parsed || { items: [], status: "new" });

  const changeStatus = (newStatus) => {
    const updated = { ...order, status: newStatus };
    setOrder(updated);
    // not persisting back to dashboard automatically — user will return
  };

  const acceptOrder = () => changeStatus("accepted");
  const prepareOrder = () => changeStatus("preparing");
  const completeOrder = () => {
    changeStatus("completed");
    Alert.alert("Order completed", "You marked the order as completed.");
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order #{order.id || "—"}</Text>
      <Text style={styles.meta}>{order.customer || "Unknown"} • {order.time ? new Date(order.time).toLocaleString() : "—"}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items && order.items.length ? (
          order.items.map((it, idx) => (
            <Text key={idx} style={styles.itemRow}>{it.qty} × {it.name}</Text>
          ))
        ) : (
          <Text style={{ color: "#666" }}>No items listed</Text>
        )}
      </View>

      <Text style={styles.total}>Total: ₹ {order.total || "0.00"}</Text>
      <Text style={styles.status}>Status: {order.status}</Text>

      <View style={styles.actions}>
        {order.status === "new" && (
          <TouchableOpacity style={styles.btn} onPress={acceptOrder}>
            <Text style={styles.btnText}>Accept</Text>
          </TouchableOpacity>
        )}
        {order.status !== "completed" && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#f5a623" }]} onPress={prepareOrder}>
            <Text style={styles.btnText}>Prepare</Text>
          </TouchableOpacity>
        )}
        {order.status !== "completed" && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#34c759" }]} onPress={completeOrder}>
            <Text style={styles.btnText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16, backgroundColor: "#f6f8fa" },
  title: { fontSize:20, fontWeight:"700" },
  meta: { color:"#666", marginTop:4 },
  section: { marginTop:16 },
  sectionTitle: { fontWeight:"700", marginBottom:8 },
  itemRow: { marginBottom:6 },
  total: { marginTop:12, fontWeight:"700" },
  status: { marginTop:8, color:"#0a84ff" },
  actions: { flexDirection:"row", marginTop:20 },
  btn: { backgroundColor:"#0a84ff", padding:12, borderRadius:8, marginRight:8 },
  btnText: { color:"#fff", fontWeight:"700" }
});
