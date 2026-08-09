import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AdminSettingsHeader from "../../components/admin/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type KitchenCapacitySettings = {
  is_paused: boolean;
  max_active_orders: number;
  default_prep_minutes: number;
  category_limits: Record<string, number>;
};

const DEFAULT_LIMITS = { food: 25, beverages: 18, desserts: 12 };

export default function SettingsKitchen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<KitchenCapacitySettings>({
    is_paused: false,
    max_active_orders: 40,
    default_prep_minutes: 15,
    category_limits: { ...DEFAULT_LIMITS },
  });

  const load = useCallback(async () => {
    const data = await apiClient.get("/api/admin/kitchen/capacity");
    setForm({
      is_paused: Boolean(data?.is_paused),
      max_active_orders: Number(data?.max_active_orders || 40),
      default_prep_minutes: Number(data?.default_prep_minutes || 15),
      category_limits: {
        ...DEFAULT_LIMITS,
        ...(data?.category_limits || {}),
      },
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        Alert.alert("Load failed", "Could not load kitchen settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.patch("/api/admin/kitchen/capacity", form);
      Alert.alert("Saved", "Kitchen settings updated.");
    } catch {
      Alert.alert("Save failed", "Could not update kitchen settings.");
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0F172A" />
        <Text style={styles.helper}>Loading kitchen settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Kitchen Capacity"
        subtitle="Auto-throttle, ETA, and load limits"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Global Pause</Text>
              <Text style={styles.hint}>
                Block new order finalization while kitchen is overloaded.
              </Text>
            </View>
            <Switch
              value={!form.is_paused}
              onValueChange={(v) => setForm((p) => ({ ...p, is_paused: !v }))}
              trackColor={{ false: "#EF4444", true: "#10B981" }}
            />
          </View>

          <Text style={styles.label}>Max Active Orders</Text>
          <TextInput
            keyboardType="number-pad"
            value={String(form.max_active_orders)}
            onChangeText={(v) =>
              setForm((p) => ({
                ...p,
                max_active_orders: Math.max(1, Number(v) || 1),
              }))
            }
            style={styles.input}
          />

          <Text style={styles.label}>Base Prep ETA (minutes)</Text>
          <TextInput
            keyboardType="number-pad"
            value={String(form.default_prep_minutes)}
            onChangeText={(v) =>
              setForm((p) => ({
                ...p,
                default_prep_minutes: Math.max(1, Number(v) || 1),
              }))
            }
            style={styles.input}
          />

          <Text style={styles.label}>Per-Category Active Limits</Text>
          {Object.keys(DEFAULT_LIMITS).map((key) => (
            <View key={key} style={styles.limitRow}>
              <Text style={styles.limitName}>{key}</Text>
              <TextInput
                keyboardType="number-pad"
                value={String(form.category_limits[key] ?? 1)}
                onChangeText={(v) =>
                  setForm((p) => ({
                    ...p,
                    category_limits: {
                      ...p.category_limits,
                      [key]: Math.max(1, Number(v) || 1),
                    },
                  }))
                }
                style={styles.limitInput}
              />
            </View>
          ))}

          <Pressable
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveText}>
              {saving ? "Saving..." : "Save Kitchen Settings"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  helper: { marginTop: 8, color: "#64748B", fontWeight: "600" },

  content: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  label: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 13,
    textTransform: "uppercase",
  },
  hint: { color: "#64748B", fontSize: 12, marginTop: 3, fontWeight: "600" },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  limitName: {
    color: "#0F172A",
    textTransform: "capitalize",
    fontWeight: "700",
    fontSize: 14,
  },
  limitInput: {
    width: 100,
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    textAlign: "center",
    color: "#0F172A",
    fontWeight: "700",
  },
  saveBtn: {
    marginTop: 6,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
});
