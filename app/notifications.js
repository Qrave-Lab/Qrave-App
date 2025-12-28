// app/notifications.js
import React, { useContext } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { NotificationContext } from "../contexts/NotificationContext";

export default function NotificationsScreen() {
  const { notifications, markRead, clearAll } = useContext(NotificationContext);

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f8fa" }}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={clearAll}>
          <Text style={styles.clear}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, item.read ? styles.read : styles.unread]}
            onPress={() => markRead(item.id)}
          >
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemBody}>{item.body}</Text>
            <Text style={styles.itemTime}>{new Date(item.time).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 40, color: "#666" }}>No notifications</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  clear: { color: "#ff3b30", fontWeight: "700" },
  item: { padding: 12, borderRadius: 8, marginBottom: 8 },
  unread: { backgroundColor: "#e9f2ff" },
  read: { backgroundColor: "#fff" },
  itemTitle: { fontWeight: "700" },
  itemBody: { marginTop: 6, color: "#333" },
  itemTime: { marginTop: 6, color: "#666", fontSize: 12 },
});
