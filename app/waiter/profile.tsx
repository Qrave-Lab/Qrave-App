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
import { MaterialIcons } from "@expo/vector-icons";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WaiterWavyHeader from "../../components/WaiterWavyHeader";
import LogoutButton from "../../components/LogoutButton";

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

const FieldRow = ({ icon, label, value, isLast = false }: { icon: any, label: string, value: string, isLast?: boolean }) => (
  <View style={[s.fieldRow, !isLast && s.fieldRowBorder]}>
    <View style={s.fieldIconBox}>
      <MaterialIcons name={icon} size={18} color="#94A3B8" />
    </View>
    <View style={s.fieldContent}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value || "—"}</Text>
    </View>
  </View>
);

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
        restaurant_phone: me?.restaurant_phone || me?.restaurantPhone || me?.phone_number || "",
        restaurant_address: me?.restaurant_address || me?.restaurantAddress || me?.address || "",
        restaurant_city: me?.restaurant_city || me?.restaurantCity || me?.city || "",
        restaurant_state: me?.restaurant_state || me?.restaurantState || me?.state || "",
        restaurant_country: me?.restaurant_country || me?.restaurantCountry || me?.country || "",
      };
      setProfile(next);
      setEditable({ name: next.name || "", phone: next.phone || "" });
    } catch (e: any) {
      try {
        const stored = await AsyncStorage.getItem("user");
        if (stored) {
          const user = JSON.parse(stored);
          const next = {
            name: user?.name || user?.full_name || "",
            email: user?.email || "",
            role: user?.role || "",
            restaurant_name: user?.restaurant_name || user?.restaurantName || "",
            restaurant_id: user?.restaurant_id || user?.restaurantId || "",
            phone: user?.phone || user?.mobile || "",
            username: user?.username || user?.handle || "",
            staff_id: user?.staff_id || user?.staffId || user?.id || "",
            joined_at: user?.joined_at || user?.created_at || "",
            last_login: user?.last_login || user?.lastLogin || "",
            restaurant_phone: user?.restaurant_phone || user?.restaurantPhone || user?.phone_number || "",
            restaurant_address: user?.restaurant_address || user?.restaurantAddress || user?.address || "",
            restaurant_city: user?.restaurant_city || user?.restaurantCity || user?.city || "",
            restaurant_state: user?.restaurant_state || user?.restaurantState || user?.state || "",
            restaurant_country: user?.restaurant_country || user?.restaurantCountry || user?.country || "",
          };
          setProfile(next);
          setEditable({ name: next.name || "", phone: next.phone || "" });
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
      setProfile((prev) => prev ? { ...prev, name: editable.name?.trim() || prev.name, phone: editable.phone?.trim() || prev.phone } : prev);
      Alert.alert("Saved", "Profile updated on this device.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [editable.name, editable.phone, profile]);

  const getInitials = (name: string) => {
    return name?.substring(0, 2).toUpperCase() || "WP";
  };

  return (
    <View style={s.container}>
      <WaiterWavyHeader height={140}>
        <View style={s.headerContent}>
          <Text style={s.headerTitle}>My Profile</Text>
          <LogoutButton />
        </View>
      </WaiterWavyHeader>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={WaiterColors.primary} />
          <Text style={s.loadingText}>Loading profile...</Text>
        </View>
      ) : error ? (
        <View style={s.card}>
          <Text style={s.emptyText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Avatar & Hero Info */}
          <View style={s.heroCard}>
            <View style={s.avatarContainer}>
              <Text style={s.avatarText}>{getInitials(profile?.name || "")}</Text>
            </View>
            <Text style={s.heroName}>{profile?.name || "Waiter Name"}</Text>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>{profile?.role?.toUpperCase() || "STAFF"}</Text>
            </View>
          </View>

          {/* Quick Edit */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialIcons name="edit" size={18} color={WaiterColors.primary} style={{ marginRight: 8 }} />
              <Text style={s.cardTitle}>Quick Edit</Text>
            </View>
            <View style={s.cardBody}>
              <Text style={s.inputLabel}>Name</Text>
              <TextInput
                value={editable.name}
                onChangeText={(v) => setEditable((prev) => ({ ...prev, name: v }))}
                style={s.input}
                placeholder="Your name"
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.inputLabel}>Phone Number</Text>
              <TextInput
                value={editable.phone}
                onChangeText={(v) => setEditable((prev) => ({ ...prev, phone: v }))}
                style={s.input}
                placeholder="Phone number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={s.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Personal Info */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialIcons name="person" size={18} color={WaiterColors.primary} style={{ marginRight: 8 }} />
              <Text style={s.cardTitle}>Personal Details</Text>
            </View>
            <View style={s.cardBodyDense}>
              <FieldRow icon="email" label="Email Address" value={profile?.email || ""} />
              <FieldRow icon="badge" label="Role" value={profile?.role || ""} isLast />
            </View>
          </View>

          {/* Restaurant Info */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialIcons name="storefront" size={18} color={WaiterColors.primary} style={{ marginRight: 8 }} />
              <Text style={s.cardTitle}>Restaurant Details</Text>
            </View>
            <View style={s.cardBodyDense}>
              <FieldRow icon="restaurant" label="Restaurant Name" value={profile?.restaurant_name || ""} />
              <FieldRow icon="phone" label="Restaurant Phone" value={profile?.restaurant_phone || ""} isLast />
            </View>
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: WaiterColors.background },
  headerContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 4 },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: -0.5 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  loadingText: { marginTop: 12, color: "#6b7280", fontWeight: "700", fontSize: 15 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 15, padding: 20 },
  
  scrollContent: { padding: 16, paddingBottom: 40, gap: 16 },
  
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: -40,
    borderWidth: 1,
    borderColor: WaiterColors.border,
    shadowColor: WaiterColors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarText: { fontSize: 28, fontWeight: "900", color: WaiterColors.primaryDark, letterSpacing: 1 },
  heroName: { fontSize: 20, fontWeight: "900", color: "#0F172A", marginBottom: 6 },
  heroBadge: {
    backgroundColor: WaiterColors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WaiterColors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FAFAF9",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  cardBody: { padding: 16 },
  cardBodyDense: { paddingVertical: 8 },
  
  inputLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: WaiterColors.primary,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: WaiterColors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  
  fieldRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  fieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: 2 },
  fieldValue: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
});
