import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';

export default function AdminButton({ style }) {
  const router = useRouter();
  return (
    <TouchableOpacity style={[styles.button, style || {}]} onPress={() => router.push("/admin/profile")}> 
      <Ionicons name="shield-checkmark" size={20} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.text}>Admin</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a84ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
