import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient, { api as namedApi } from "../../lib/apiClient";

// Placeholder images
import iconPng from "../../assets/images/icon.png";

export default function AdminProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [tax, setTax] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    password: "",
    role: "waiter",
  });
  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(false);
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  const [editStaff, setEditStaff] = useState({
    name: "",
    email: "",
    password: "",
    role: "waiter",
  });
  const [refreshing, setRefreshing] = useState(false);

  const resolveTableLabel = (t: any) =>
    t?.table_number || t?.number || t?.name || t?.id || t?.tableID || "Table";

  const resolveTableId = (t: any) => t?.id || t?.tableID || t?.table_id;

  const resolveEnabled = (t: any) =>
    t?.is_enabled !== undefined ? t.is_enabled : t?.enabled ?? t?.active ?? true;
  const isArchived = (t: any) =>
    t?.is_archived === true ||
    t?.archived === true ||
    t?.is_deleted === true ||
    t?.deleted === true ||
    t?.status === "archived" ||
    t?.status === "deleted";

  const resolveStaffId = (s: any) => s?.ID || s?.id || s?.user_id;
  const resolveStaffEmail = (s: any) => s?.Email || s?.email || "";
  const resolveStaffRole = (s: any) => s?.Role || s?.role || "staff";
  const getStaffAvatar = (email: string) =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
      email || "user",
    )}`;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      // Always try to fetch from backend first
      const profile = await apiClient.get("/api/admin/me");
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
        } catch {
          setLogoUrl(null);
        }
      } else {
        setLogoUrl(null);
      }
    } catch {
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
          } catch {
            setLogoUrl(null);
          }
        } else {
          setLogoUrl(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesError(null);
    try {
      const res = await apiClient.get("/api/admin/tables");
      const list = Array.isArray(res) ? res : [];
      setTables(list.filter((t) => !isArchived(t)));
    } catch (e: any) {
      setTablesError(e?.message || "Failed to load tables");
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      const res = await apiClient.get("/api/admin/staffs");
      setStaff(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setStaffError(e?.message || "Failed to load team members");
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleAddTable = async () => {
    const existing = new Set(
      tables
        .map((t) => Number(t?.table_number ?? t?.number))
        .filter((n) => !isNaN(n) && n > 0)
    );
    let nextNumber = 1;
    while (existing.has(nextNumber)) nextNumber += 1;
    try {
      const payload = { number: nextNumber, table_number: nextNumber };
      const created = await apiClient.post("/api/admin/tables", payload);
      if (created) {
        setTables((prev) => [created, ...prev]);
      } else {
        const temp = {
          id: `temp-${Date.now()}`,
          number: nextNumber,
          is_enabled: true,
        };
        setTables((prev) => [temp, ...prev]);
      }
    } catch (e: any) {
      alert(e?.message || "Failed to add table");
    }
  };

  const handleToggleTable = async (table: any) => {
    const tableId = resolveTableId(table);
    if (!tableId) return;
    const nextEnabled = !resolveEnabled(table);
    try {
      await apiClient.patch(`/api/admin/tables/${tableId}`, {
        id: tableId,
        is_enabled: nextEnabled,
      });
      setTables((prev) =>
        prev.map((t) =>
          resolveTableId(t) === tableId
            ? { ...t, is_enabled: nextEnabled, enabled: nextEnabled }
            : t
        )
      );
    } catch (e: any) {
      alert(e?.message || "Failed to update table");
    }
  };

  const handleDeleteTable = async (table: any) => {
    const tableId = resolveTableId(table);
    if (!tableId) return;
    try {
      await apiClient.delete(`/api/admin/tables/${tableId}`);
      setTables((prev) => prev.filter((t) => resolveTableId(t) !== tableId));
    } catch (e: any) {
      alert(e?.message || "Failed to remove table");
    }
  };

  const handleRemoveStaff = async (member: any) => {
    const staffId = resolveStaffId(member);
    if (!staffId) return;
    try {
      await apiClient.delete(`/api/admin/delete/${staffId}`);
      setStaff((prev) => prev.filter((s) => resolveStaffId(s) !== staffId));
    } catch (e: any) {
      alert(e?.message || "Failed to remove member");
    }
  };

  const handleOpenEditStaff = async (member: any) => {
    const staffId = resolveStaffId(member);
    if (!staffId) return;
    setEditStaffOpen(true);
    setEditStaffId(staffId);
    setEditingStaff(true);
    try {
      const details = await apiClient.get(`/api/admin/staffDetails/${staffId}`);
      setEditStaff({
        name: details?.name || "",
        email: details?.email || resolveStaffEmail(member) || "",
        password: "",
        role: details?.role || resolveStaffRole(member) || "waiter",
      });
    } catch {
      setEditStaff({
        name: resolveStaffEmail(member)
          ? resolveStaffEmail(member).split("@")[0]
          : "",
        email: resolveStaffEmail(member),
        password: "",
        role: resolveStaffRole(member) || "waiter",
      });
    } finally {
      setEditingStaff(false);
    }
  };

  const handleUpdateStaff = async () => {
    const restaurantId = user?.restaurant_id || user?.id;
    if (!restaurantId || !editStaffId) {
      alert("Restaurant not found yet.");
      return;
    }
    setEditingStaff(true);
    try {
      const payload: Record<string, any> = {
        name: editStaff.name?.trim() || undefined,
        email: editStaff.email?.trim() || undefined,
        role: editStaff.role || undefined,
      };
      if (editStaff.password?.trim()) {
        payload.password = editStaff.password.trim();
      }
      Object.keys(payload).forEach(
        (k) => payload[k] === undefined && delete payload[k],
      );
      await apiClient.put(
        `/api/admin/restaurants/${restaurantId}/staff/${editStaffId}`,
        payload,
      );
      const res = await apiClient.get("/api/admin/staffs");
      setStaff(Array.isArray(res) ? res : []);
      setEditStaffOpen(false);
    } catch (e: any) {
      const status = e?.status ? ` (status ${e.status})` : "";
      const detail = e?.body?.message || e?.body?.error;
      alert(
        detail
          ? `Update failed${status}: ${detail}`
          : `Update failed${status}`,
      );
    } finally {
      setEditingStaff(false);
    }
  };

  const handleAddStaff = async () => {
    const restaurantId = user?.restaurant_id || user?.id;
    if (!restaurantId) {
      alert("Restaurant not found yet.");
      return;
    }
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      alert("Please fill all fields.");
      return;
    }
    setAddingStaff(true);
    try {
      await apiClient.post(`/api/admin/restaurants/${restaurantId}/staff`, newStaff);
      const res = await apiClient.get("/api/admin/staffs");
      setStaff(Array.isArray(res) ? res : []);
      setAddStaffOpen(false);
      setNewStaff({ name: "", email: "", password: "", role: "waiter" });
    } catch (e: any) {
      alert(e?.message || "Failed to create staff member");
    } finally {
      setAddingStaff(false);
    }
  };

  const handleSave = async () => {
    const client = apiClient || namedApi;
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
      const response = await client.patch(
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadTables(), loadStaff()]);
    setRefreshing(false);
  }, [loadProfile, loadTables, loadStaff]);

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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#0a84ff"
        />
      }
    >
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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Team Members</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setAddStaffOpen(true)}
          >
            <Text style={styles.secondaryBtnText}>+ Add New</Text>
          </TouchableOpacity>
        </View>
        {staffLoading ? (
          <Text style={styles.mutedText}>Loading team members...</Text>
        ) : staffError ? (
          <Text style={styles.errorText}>{staffError}</Text>
        ) : staff.length === 0 ? (
          <Text style={styles.mutedText}>No team members onboarded yet.</Text>
        ) : (
          staff.map((member) => (
            <View key={resolveStaffId(member)} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Image
                  source={{ uri: getStaffAvatar(resolveStaffEmail(member)) }}
                  style={styles.avatar}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {resolveStaffEmail(member)
                    ? resolveStaffEmail(member).split("@")[0]
                    : "Member"}
                </Text>
                <Text style={styles.email}>{resolveStaffEmail(member)}</Text>
              </View>
              <View style={styles.memberActions}>
                <Text style={styles.role}>
                  {String(resolveStaffRole(member)).toUpperCase()}
                </Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleOpenEditStaff(member)}
                >
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleRemoveStaff(member)}
                >
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <Modal
        visible={addStaffOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStaffOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Team Member</Text>
              <TouchableOpacity onPress={() => setAddStaffOpen(false)}>
                <Text style={{ fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={newStaff.name}
              onChangeText={(v) => setNewStaff((s) => ({ ...s, name: v }))}
              placeholder="Full Name"
            />
            <TextInput
              style={styles.input}
              value={newStaff.email}
              onChangeText={(v) => setNewStaff((s) => ({ ...s, email: v }))}
              placeholder="Work Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={newStaff.password}
              onChangeText={(v) => setNewStaff((s) => ({ ...s, password: v }))}
              placeholder="Access Password"
              secureTextEntry
            />
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleRow}>
              {[
                { id: "owner", label: "Owner" },
                { id: "manager", label: "Manager" },
                { id: "kitchen", label: "Chef" },
                { id: "waiter", label: "Waiter" },
                { id: "cashier", label: "Cashier" },
              ].map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.rolePill,
                    newStaff.role === role.id && styles.rolePillActive,
                  ]}
                  onPress={() =>
                    setNewStaff((s) => ({ ...s, role: role.id }))
                  }
                >
                  <Text
                    style={
                      newStaff.role === role.id
                        ? styles.rolePillTextActive
                        : styles.rolePillText
                    }
                  >
                    {role.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleAddStaff}
              disabled={addingStaff}
            >
              <Text style={styles.saveBtnText}>
                {addingStaff ? "Saving..." : "Save Member"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editStaffOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditStaffOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Team Member</Text>
              <TouchableOpacity onPress={() => setEditStaffOpen(false)}>
                <Text style={{ fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={editStaff.name}
              onChangeText={(v) => setEditStaff((s) => ({ ...s, name: v }))}
              placeholder="Full Name"
            />
            <TextInput
              style={styles.input}
              value={editStaff.email}
              onChangeText={(v) => setEditStaff((s) => ({ ...s, email: v }))}
              placeholder="Work Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={editStaff.password}
              onChangeText={(v) => setEditStaff((s) => ({ ...s, password: v }))}
              placeholder="New Password (optional)"
              secureTextEntry
            />
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleRow}>
              {[
                { id: "owner", label: "Owner" },
                { id: "manager", label: "Manager" },
                { id: "kitchen", label: "Chef" },
                { id: "waiter", label: "Waiter" },
                { id: "cashier", label: "Cashier" },
              ].map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.rolePill,
                    editStaff.role === role.id && styles.rolePillActive,
                  ]}
                  onPress={() =>
                    setEditStaff((s) => ({ ...s, role: role.id }))
                  }
                >
                  <Text
                    style={
                      editStaff.role === role.id
                        ? styles.rolePillTextActive
                        : styles.rolePillText
                    }
                  >
                    {role.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleUpdateStaff}
              disabled={editingStaff}
            >
              <Text style={styles.saveBtnText}>
                {editingStaff ? "Updating..." : "Update Member"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Floor Plan</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddTable}>
            <Text style={styles.secondaryBtnText}>+ Add Table</Text>
          </TouchableOpacity>
        </View>
        {tablesLoading ? (
          <Text style={styles.mutedText}>Loading tables...</Text>
        ) : tablesError ? (
          <Text style={styles.errorText}>{tablesError}</Text>
        ) : (
          tables.map((t) => (
            <View key={resolveTableId(t) || resolveTableLabel(t)} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{resolveTableLabel(t)}</Text>
              <View style={styles.tableActions}>
                <Switch
                  value={!!resolveEnabled(t)}
                  onValueChange={() => handleToggleTable(t)}
                />
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteTable(t)}
                >
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Devices & Printing</Text>
        <View style={styles.deviceCard}>
          <Text style={styles.deviceName}>Kitchen Printer</Text>
          <Text style={styles.deviceStatus}>Connected</Text>
        </View>
        <TouchableOpacity
          style={styles.deviceCard}
          onPress={() => router.push("/admin/qr-codes")}
        >
          <Text style={styles.deviceName}>QR Codes</Text>
          <Text style={styles.deviceStatus}>Manage table QR generation</Text>
        </TouchableOpacity>
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  secondaryBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  memberActions: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  editBtn: {
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    alignItems: "center",
  },
  editBtnText: { fontSize: 12 },
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
  tableRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
  },
  tableLabel: { fontWeight: "700", fontSize: 15 },
  tableActions: { flexDirection: "row", alignItems: "center" },
  deleteBtn: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  deleteBtnText: { color: "#991b1b", fontWeight: "700", fontSize: 12 },
  mutedText: { color: "#6b7280" },
  errorText: { color: "#b91c1c" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  inputLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  rolePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  rolePillActive: { backgroundColor: "#111827", borderColor: "#111827" },
  rolePillText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  rolePillTextActive: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
