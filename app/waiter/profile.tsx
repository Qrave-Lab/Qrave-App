import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Profile = {
  name?: string;
  email?: string;
  role?: string;
  restaurant_name?: string;
  restaurant_id?: string;
  phone?: string;
  username?: string;
  staff_id?: string;
  joined_at?: string;
  last_login?: string;
  restaurant_phone?: string;
  restaurant_address?: string;
  restaurant_city?: string;
  restaurant_state?: string;
  restaurant_country?: string;
};

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WaiterColors.background },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: WaiterColors.text },
  subtitle: { color: "#475569", marginTop: 4 },
  card: {
    backgroundColor: WaiterColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  label: { fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase" },
  value: { fontSize: 15, fontWeight: "700", color: WaiterColors.text, marginTop: 6 },
  row: { marginBottom: 12 },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    color: WaiterColors.text,
    marginTop: 6,
  },
  saveBtn: {
    backgroundColor: WaiterColors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "800" },
  loadingBox: { alignItems: "center", paddingTop: 40 },
  loadingText: { marginTop: 8, color: "#64748B" },
  emptyText: { color: "#64748B", textAlign: "center" },
});

export default function WaiterProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editable, setEditable] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setError(null);
    try {
      const me: any = await api.get("/api/admin/me");
      const next = {
        name: me?.name || me?.full_name || "",
        email: me?.email || "",
        role: me?.role || "",
        restaurant_name: me?.restaurant_name || me?.restaurantName || "",
        restaurant_id: me?.restaurant_id || me?.restaurantId || "",
        phone: me?.phone || me?.mobile || "",
        username: me?.username || me?.handle || "",
        staff_id: me?.staff_id || me?.staffId || me?.id || "",
        joined_at: me?.joined_at || me?.created_at || "",
        last_login: me?.last_login || me?.lastLogin || "",
        restaurant_phone:
          me?.restaurant_phone || me?.restaurantPhone || me?.phone_number || "",
        restaurant_address:
          me?.restaurant_address || me?.restaurantAddress || me?.address || "",
        restaurant_city:
          me?.restaurant_city || me?.restaurantCity || me?.city || "",
        restaurant_state:
          me?.restaurant_state || me?.restaurantState || me?.state || "",
        restaurant_country:
          me?.restaurant_country || me?.restaurantCountry || me?.country || "",
      };
      setProfile(next);
      setEditable({
        name: next.name || "",
        phone: next.phone || "",
      });
    } catch (e: any) {
      try {
        const stored = await AsyncStorage.getItem("user");
        if (stored) {
          const user = JSON.parse(stored);
          const next = {
            name: user?.name || user?.full_name || "",
            email: user?.email || "",
            role: user?.role || "",
            restaurant_name:
              user?.restaurant_name || user?.restaurantName || "",
            restaurant_id: user?.restaurant_id || user?.restaurantId || "",
            phone: user?.phone || user?.mobile || "",
            username: user?.username || user?.handle || "",
            staff_id: user?.staff_id || user?.staffId || user?.id || "",
            joined_at: user?.joined_at || user?.created_at || "",
            last_login: user?.last_login || user?.lastLogin || "",
            restaurant_phone:
              user?.restaurant_phone ||
              user?.restaurantPhone ||
              user?.phone_number ||
              "",
            restaurant_address:
              user?.restaurant_address ||
              user?.restaurantAddress ||
              user?.address ||
              "",
            restaurant_city:
              user?.restaurant_city || user?.restaurantCity || user?.city || "",
            restaurant_state:
              user?.restaurant_state || user?.restaurantState || user?.state || "",
            restaurant_country:
              user?.restaurant_country ||
              user?.restaurantCountry ||
              user?.country ||
              "",
          };
          setProfile(next);
          setEditable({
            name: next.name || "",
            phone: next.phone || "",
          });
          return;
        }
      } catch {}
      setError(e?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const stored = await AsyncStorage.getItem("user");
      const current = stored ? JSON.parse(stored) : {};
      const nextUser = {
        ...current,
        name: editable.name?.trim() || current?.name,
        phone: editable.phone?.trim() || current?.phone,
      };
      await AsyncStorage.setItem("user", JSON.stringify(nextUser));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: editable.name?.trim() || prev.name,
              phone: editable.phone?.trim() || prev.phone,
            }
          : prev,
      );
      Alert.alert("Saved", "Profile updated on this device.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [editable.name, editable.phone, profile]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Edit name/phone only</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={WaiterColors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={WaiterColors.primary}
            />
          }
        >
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Name (Editable)</Text>
              <TextInput
                value={editable.name}
                onChangeText={(v) => setEditable((s) => ({ ...s, name: v }))}
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Phone (Editable)</Text>
              <TextInput
                value={editable.phone}
                onChangeText={(v) => setEditable((s) => ({ ...s, phone: v }))}
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {[
              { label: "Email", value: profile?.email },
              { label: "Role", value: profile?.role },
              { label: "Username", value: profile?.username },
              { label: "Staff ID", value: profile?.staff_id },
              { label: "Joined", value: formatDate(profile?.joined_at) },
              { label: "Last Login", value: formatDate(profile?.last_login) },
            ]
              .filter((f) => f.value)
              .map((field) => (
                <View key={field.label} style={styles.row}>
                  <Text style={styles.label}>{field.label}</Text>
                  <Text style={styles.value}>{field.value}</Text>
                </View>
              ))}
          </View>

          <View style={styles.card}>
            {[
              { label: "Restaurant", value: profile?.restaurant_name },
              { label: "Restaurant ID", value: profile?.restaurant_id },
              { label: "Restaurant Phone", value: profile?.restaurant_phone },
              { label: "Address", value: profile?.restaurant_address },
              { label: "City", value: profile?.restaurant_city },
              { label: "State", value: profile?.restaurant_state },
              { label: "Country", value: profile?.restaurant_country },
            ]
              .filter((f) => f.value)
              .map((field) => (
                <View key={field.label} style={styles.row}>
                  <Text style={styles.label}>{field.label}</Text>
                  <Text style={styles.value}>{field.value}</Text>
                </View>
              ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
