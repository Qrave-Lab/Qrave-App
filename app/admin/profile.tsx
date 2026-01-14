import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { api as namedApi } from "../../lib/apiClient";

// Placeholder images
import iconPng from "../../assets/images/icon.png";
import reactLogo from "../../assets/images/react-logo.png";
import splashIcon from "../../assets/images/splash-icon.png";

export default function AdminProfile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [tax, setTax] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Always try to fetch from backend first
        const profile = await api.get("/api/admin/me");
        setUser(profile);
        setRestaurant(profile.restaurant || "");
        setAddress(profile.address || "");
        setPhone(profile.phone || "");
        setTax(profile.tax_percent ? String(profile.tax_percent) : "");
        setServiceCharge(
          profile.service_charge ? String(profile.service_charge) : ""
        );
        // Fetch logo URL if restaurant_id exists
        if (profile.restaurant_id) {
          try {
            const res = await fetch(
              `https://qrave-backend.onrender.com/public/restaurants/${profile.restaurant_id}/logo`
            );
            const data = await res.json();
            if (data.logo_url) setLogoUrl(data.logo_url);
          } catch (e) {
            setLogoUrl(null);
          }
        } else {
          setLogoUrl(null);
        }
      } catch (e) {
        // fallback to AsyncStorage if backend fails
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          const fallback = JSON.parse(userStr);
          setUser(fallback);
          setRestaurant(fallback.restaurant || "");
          setAddress(fallback.address || "");
          setPhone(fallback.phone || "");
          setTax(fallback.tax_percent ? String(fallback.tax_percent) : "");
          setServiceCharge(
            fallback.service_charge ? String(fallback.service_charge) : ""
          );
          if (fallback.restaurant_id) {
            try {
              const res = await fetch(
                `https://qrave-backend.onrender.com/public/restaurants/${fallback.restaurant_id}/logo`
              );
              const data = await res.json();
              if (data.logo_url) setLogoUrl(data.logo_url);
            } catch (e) {
              setLogoUrl(null);
            }
          } else {
            setLogoUrl(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    const apiClient = api || namedApi;
    if (!user) return;

    try {
      // Prepare payload
      const payload: Record<string, any> = {
        name: restaurant?.trim() || undefined,
        address: address?.trim() || undefined,
        phone: phone?.trim() || undefined,
        tax_percent: tax ? parseInt(tax) : undefined,
        service_charge: serviceCharge ? parseInt(serviceCharge) : undefined,
      };

      // Remove fields that are undefined
      Object.keys(payload).forEach(
        (key) => payload[key] === undefined && delete payload[key]
      );

      console.log("Updating restaurant with:", payload);

      // Debug: log the full request and response
      console.log(
        "Sending PATCH request to /api/admin/update-details with payload:",
        payload
      );
      const response = await apiClient.patch(
        "/api/admin/update-details",
        payload
      );
      console.log("Update response:", response);

      alert("Profile updated successfully!");
    } catch (e: any) {
      console.error("Update failed:", e.response || e);
      alert(
        "Failed to update profile. " +
          (e.response?.data?.message || "Please try again.")
      );
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.avatar} />
          ) : (
            <Image source={iconPng} style={styles.avatar} />
          )}
          <View style={{ flex: 1, marginLeft: 16 }}>
            <TextInput
              style={styles.input}
              value={restaurant}
              onChangeText={setRestaurant}
              placeholder="Restaurant Name"
              editable
            />
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Business Address"
          editable
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone Number"
          keyboardType="phone-pad"
          editable
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            value={tax}
            onChangeText={setTax}
            placeholder="Tax Rate (%)"
            keyboardType="numeric"
            editable
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={serviceCharge}
            onChangeText={setServiceCharge}
            placeholder="Service Charge (%)"
            keyboardType="numeric"
            editable
          />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        <View style={styles.memberCard}>
          <View style={styles.memberAvatar}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.avatar} />
            ) : (
              <Image source={iconPng} style={styles.avatar} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || "User"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <Text style={styles.role}>OWNER</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Devices & Printing</Text>
        <View style={styles.deviceCard}>
          <Text style={styles.deviceName}>Kitchen Printer</Text>
          <Text style={styles.deviceStatus}>Connected</Text>
        </View>
        <View style={styles.deviceCard}>
          <Text style={styles.deviceName}>QR Codes</Text>
          <Text style={styles.deviceStatus}>Manage table QR generation</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: "#f6f8fa" },
  container: { padding: 16, alignItems: "stretch" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#eee" },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "700", fontSize: 28, color: "#666" },
  input: {
    backgroundColor: "#f6f8fa",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  row: { flexDirection: "row", marginBottom: 10 },
  saveBtn: {
    backgroundColor: "#0a84ff",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  name: { fontSize: 16, fontWeight: "700" },
  email: { fontSize: 14, color: "#888" },
  role: {
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    fontWeight: "700",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  deviceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
  },
  deviceName: { fontWeight: "700", fontSize: 15 },
  deviceStatus: { color: "#22c55e", fontWeight: "600", fontSize: 13 },
});
