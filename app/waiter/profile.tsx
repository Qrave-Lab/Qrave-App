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
import WaiterWavyHeader from "../../components/waiter/WaiterWavyHeader";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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

const AccordionItem = ({
  icon,
  title,
  isExpanded,
  onToggle,
  children,
}: {
  icon: any;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <View style={[styles.accordionCard, isExpanded && styles.accordionCardActive]}>
    <TouchableOpacity
      style={styles.accordionHeader}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.accordionHeaderLeft}>
        <MaterialIcons
          name={icon}
          size={24}
          color={isExpanded ? WaiterColors.primary : "#475569"}
          style={styles.accordionIcon}
        />
        <Text style={[styles.accordionTitle, isExpanded && styles.accordionTitleActive]}>
          {title}
        </Text>
      </View>
      <MaterialIcons
        name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
        size={24}
        color="#94A3B8"
      />
    </TouchableOpacity>
    {isExpanded && <View style={styles.accordionBody}>{children}</View>}
  </View>
);

export default function WaiterProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editable, setEditable] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Accordion state
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
      setExpandedSection(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [editable.name, editable.phone, profile]);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "user",
            "token",
            "qrave_jwt",
            "qrave_refresh",
            "qrave_csrf",
          ]);
          router.replace("/");
        },
      },
    ]);
  };

  const toggleSection = (sec: string) => {
    setExpandedSection((prev) => (prev === sec ? null : sec));
  };

  const renderInfoRow = (label: string, value?: string) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <WaiterWavyHeader height={140}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
      </WaiterWavyHeader>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={WaiterColors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={WaiterColors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.emptyText}>{error}</Text>
        ) : (
          <View style={styles.listContainer}>
            
            {/* Edit Profile Accordion */}
            <AccordionItem
              icon="person-outline"
              title="Edit Profile"
              isExpanded={expandedSection === "edit"}
              onToggle={() => toggleSection("edit")}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  value={editable.name}
                  onChangeText={(v) => setEditable((s) => ({ ...s, name: v }))}
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor="#94A3B8"
                />
                
                <Text style={styles.inputLabel}>Phone Number</Text>
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
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
              </TouchableOpacity>
            </AccordionItem>

            {/* Account Details Accordion */}
            <AccordionItem
              icon="mail-outline"
              title="Account Details"
              isExpanded={expandedSection === "account"}
              onToggle={() => toggleSection("account")}
            >
              {renderInfoRow("Email", profile?.email)}
              {renderInfoRow("Username", profile?.username)}
              {renderInfoRow("Role", profile?.role)}
              {renderInfoRow("Staff ID", profile?.staff_id)}
              {renderInfoRow("Joined", formatDate(profile?.joined_at))}
              {renderInfoRow("Last Login", formatDate(profile?.last_login))}
            </AccordionItem>

            {/* Restaurant Info Accordion */}
            <AccordionItem
              icon="storefront"
              title="Restaurant Information"
              isExpanded={expandedSection === "restaurant"}
              onToggle={() => toggleSection("restaurant")}
            >
              {renderInfoRow("Restaurant Name", profile?.restaurant_name)}
              {renderInfoRow("Restaurant ID", profile?.restaurant_id)}
              {renderInfoRow("Phone", profile?.restaurant_phone)}
              {renderInfoRow("Address", profile?.restaurant_address)}
              {renderInfoRow("City", profile?.restaurant_city)}
              {renderInfoRow("State", profile?.restaurant_state)}
              {renderInfoRow("Country", profile?.restaurant_country)}
            </AccordionItem>

            {/* Spacer */}
            <View style={styles.divider} />

            {/* Logout Button (Outlined Style) */}
            <TouchableOpacity style={styles.logoutCard} onPress={handleLogout} activeOpacity={0.7}>
              <MaterialIcons name="logout" size={24} color="#EF4444" style={styles.accordionIcon} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111",
    letterSpacing: -0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  listContainer: {
    gap: 12,
  },
  accordionCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  accordionCardActive: {
    borderColor: WaiterColors.primary,
    borderWidth: 1.5,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  accordionIcon: {
    marginRight: 14,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  accordionTitleActive: {
    color: WaiterColors.primary,
  },
  accordionBody: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "500",
  },
  saveBtn: {
    backgroundColor: WaiterColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  divider: {
    height: 24,
  },
  logoutCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    padding: 18,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
  loadingBox: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    color: "#64748B",
    textAlign: "center",
    margin: 24,
  },
});
