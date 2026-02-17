import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import iconPng from "../../assets/images/icon.png";
import AdminWavyHeader from "../../components/AdminWavyHeader";
import { AdminColors } from "../../constants/theme";
import apiClient, { api as namedApi } from "../../lib/apiClient";

export default function AdminProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [tax, setTax] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
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

  /* ───── helpers ───── */

  const resolveTableLabel = (t: any) =>
    t?.table_number || t?.number || t?.name || t?.id || t?.tableID || "Table";

  const resolveTableId = (t: any) => t?.id || t?.tableID || t?.table_id;

  const resolveEnabled = (t: any) =>
    t?.is_enabled !== undefined
      ? t.is_enabled
      : (t?.enabled ?? t?.active ?? true);

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

  const normalizeTimeValue = (value: string) => {
    const raw = value.trim();
    if (!raw) return "";

    const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    const twelveHour = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i;

    const twentyFourMatch = raw.match(twentyFourHour);
    if (twentyFourMatch) {
      return `${twentyFourMatch[1].padStart(2, "0")}:${twentyFourMatch[2]}`;
    }

    const twelveHourMatch = raw.match(twelveHour);
    if (!twelveHourMatch) return null;

    let hours = parseInt(twelveHourMatch[1], 10);
    const minutes = twelveHourMatch[2];
    const meridiem = twelveHourMatch[3].toUpperCase();

    if (meridiem === "AM") {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  };

  /* ───── data loading ───── */

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await apiClient.get("/api/admin/me");
      setUser(profile);
      setRestaurant(profile.restaurant || "");
      setAddress(profile.address || "");
      setPhone(profile.phone || "");
      setTax(profile.tax_percent ? String(profile.tax_percent) : "");
      setServiceCharge(
        profile.service_charge ? String(profile.service_charge) : "",
      );
      setOpenTime(profile.open_time || "");
      setCloseTime(profile.close_time || "");
      if (profile.restaurant_id) {
        try {
          const res = await fetch(
            `https://qrave-backend.onrender.com/public/restaurants/${profile.restaurant_id}/logo`,
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
      const userStr = await AsyncStorage.getItem("user");
      if (userStr) {
        const fallback = JSON.parse(userStr);
        setUser(fallback);
        setRestaurant(fallback.restaurant || "");
        setAddress(fallback.address || "");
        setPhone(fallback.phone || "");
        setTax(fallback.tax_percent ? String(fallback.tax_percent) : "");
        setServiceCharge(
          fallback.service_charge ? String(fallback.service_charge) : "",
        );
        setOpenTime(fallback.open_time || "");
        setCloseTime(fallback.close_time || "");
        if (fallback.restaurant_id) {
          try {
            const res = await fetch(
              `https://qrave-backend.onrender.com/public/restaurants/${fallback.restaurant_id}/logo`,
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

  /* ───── table handlers ───── */

  const handleAddTable = async () => {
    const existing = new Set(
      tables
        .map((t) => Number(t?.table_number ?? t?.number))
        .filter((n) => !isNaN(n) && n > 0),
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
            : t,
        ),
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

  /* ───── staff handlers ───── */

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
        detail ? `Update failed${status}: ${detail}` : `Update failed${status}`,
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
      await apiClient.post(
        `/api/admin/restaurants/${restaurantId}/staff`,
        newStaff,
      );
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

  /* ───── save handler (preserves openTime / closeTime) ───── */

  const handleSave = async () => {
    const client = apiClient || namedApi;
    if (!user) return;

    try {
      const normalizedOpenTime = normalizeTimeValue(openTime);
      if (normalizedOpenTime === null) {
        alert("Invalid opening time. Use HH:MM or HH:MM AM/PM.");
        return;
      }

      const normalizedCloseTime = normalizeTimeValue(closeTime);
      if (normalizedCloseTime === null) {
        alert("Invalid closing time. Use HH:MM or HH:MM AM/PM.");
        return;
      }

      const payload: Record<string, any> = {
        name: restaurant?.trim() || undefined,
        address: address?.trim() || undefined,
        phone: phone?.trim() || undefined,
        tax_percent: tax ? parseInt(tax) : undefined,
        service_charge: serviceCharge ? parseInt(serviceCharge) : undefined,
        open_time: normalizedOpenTime || undefined,
        close_time: normalizedCloseTime || undefined,
      };

      Object.keys(payload).forEach(
        (key) => payload[key] === undefined && delete payload[key],
      );

      console.log("Updating restaurant with:", payload);
      const response = await client.patch("/api/admin/update-details", payload);
      console.log("Update response:", response);

      alert("Profile updated successfully!");
    } catch (e: any) {
      console.error("Update failed:", e.response || e);
      alert(
        "Failed to update profile. " +
          (e.response?.data?.message || "Please try again."),
      );
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadTables(), loadStaff()]);
    setRefreshing(false);
  }, [loadProfile, loadTables, loadStaff]);

  /* ───── loading state ───── */

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

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <AdminWavyHeader height={160}>
        <View style={styles.headerTopRow}>
          <View style={styles.profileAvatar}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.profileImage} />
            ) : (
              <Image source={iconPng} style={styles.profileImage} />
            )}
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {restaurant || "My Restaurant"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {user?.email || "Manage your business"}
            </Text>
          </View>
        </View>
      </AdminWavyHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AdminColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── RESTAURANT DETAILS ── */}
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View style={styles.sectionIconBg}>
              <MaterialIcons name="store" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.cardTitle}>Restaurant Details</Text>
          </View>

          <Text style={styles.inputLabel}>Restaurant Name</Text>
          <TextInput
            style={styles.input}
            value={restaurant}
            onChangeText={setRestaurant}
            placeholder="Restaurant Name"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Business Address"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.inputLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone Number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.inputLabel}>Tax %</Text>
              <TextInput
                style={styles.input}
                value={tax}
                onChangeText={setTax}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Svc Charge %</Text>
              <TextInput
                style={styles.input}
                value={serviceCharge}
                onChangeText={setServiceCharge}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.inputLabel}>Opens At</Text>
              <TextInput
                style={styles.input}
                value={openTime}
                onChangeText={setOpenTime}
                placeholder="HH:MM"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Closes At</Text>
              <TextInput
                style={styles.input}
                value={closeTime}
                onChangeText={setCloseTime}
                placeholder="HH:MM"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>

        {/* ── TEAM MEMBERS ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={styles.sectionIconBg}>
                <MaterialIcons name="people" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.cardTitle}>Team Members</Text>
            </View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setAddStaffOpen(true)}
            >
              <Text style={styles.secondaryBtnText}>+ Add New</Text>
            </TouchableOpacity>
          </View>

          {staffLoading ? (
            <Text style={styles.mutedText}>Loading team...</Text>
          ) : staffError ? (
            <Text style={styles.errorText}>{staffError}</Text>
          ) : staff.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No team members found</Text>
            </View>
          ) : (
            staff.map((member) => (
              <View key={resolveStaffId(member)} style={styles.memberCard}>
                <Image
                  source={{ uri: getStaffAvatar(resolveStaffEmail(member)) }}
                  style={styles.avatarSmall}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberName}>
                    {resolveStaffEmail(member)
                      ? resolveStaffEmail(member).split("@")[0]
                      : "Member"}
                  </Text>
                  <Text style={styles.memberRole}>
                    {String(resolveStaffRole(member)).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleOpenEditStaff(member)}
                  >
                    <MaterialIcons name="edit" size={18} color="#4B5563" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FEF2F2" }]}
                    onPress={() => handleRemoveStaff(member)}
                  >
                    <MaterialIcons name="delete" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── TABLES ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={styles.sectionIconBg}>
                <MaterialIcons
                  name="table-restaurant"
                  size={20}
                  color="#10B981"
                />
              </View>
              <Text style={styles.cardTitle}>Tables</Text>
            </View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleAddTable}
            >
              <Text style={styles.secondaryBtnText}>+ Add Table</Text>
            </TouchableOpacity>
          </View>

          {tablesLoading ? (
            <Text style={styles.mutedText}>Loading tables...</Text>
          ) : tablesError ? (
            <Text style={styles.errorText}>{tablesError}</Text>
          ) : (
            tables.map((t) => (
              <View
                key={resolveTableId(t) || resolveTableLabel(t)}
                style={styles.tableRow}
              >
                <Text style={styles.tableLabel}>{resolveTableLabel(t)}</Text>
                <View style={styles.tableActions}>
                  <Switch
                    trackColor={{ false: "#E5E7EB", true: "#FCD34D" }}
                    thumbColor={resolveEnabled(t) ? "#F59E0B" : "#F3F4F6"}
                    value={!!resolveEnabled(t)}
                    onValueChange={() => handleToggleTable(t)}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                  <TouchableOpacity
                    style={styles.deleteTableBtn}
                    onPress={() => handleDeleteTable(t)}
                  >
                    <Text style={styles.deleteTableText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── DEVICES ── */}
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View style={styles.sectionIconBg}>
              <MaterialIcons name="devices" size={20} color="#6366F1" />
            </View>
            <Text style={styles.cardTitle}>Devices & Setup</Text>
          </View>

          <View style={styles.deviceRow}>
            <View style={[styles.deviceCard, { marginRight: 12 }]}>
              <Text style={styles.deviceIcon}>&#x1F5A8;&#xFE0F;</Text>
              <Text style={styles.deviceName}>Printer</Text>
              <Text style={styles.deviceStatus}>Connected</Text>
            </View>
            <TouchableOpacity
              style={styles.deviceCard}
              onPress={() => router.push("/admin/qr-codes")}
            >
              <Text style={styles.deviceIcon}>&#x1F4F1;</Text>
              <Text style={styles.deviceName}>QR Codes</Text>
              <Text style={styles.deviceStatus}>Generate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── LOGOUT ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await AsyncStorage.removeItem("user");
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("qrave_jwt");
            router.replace("/");
          }}
        >
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ════════════  ADD STAFF MODAL  ════════════ */}
      <Modal
        visible={addStaffOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddStaffOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Team Member</Text>
              <TouchableOpacity onPress={() => setAddStaffOpen(false)}>
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newStaff.name}
              onChangeText={(v) => setNewStaff((s) => ({ ...s, name: v }))}
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={newStaff.email}
              onChangeText={(v) => setNewStaff((s) => ({ ...s, email: v }))}
              placeholder="Work Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newStaff.password}
              onChangeText={(v) => setNewStaff((s) => ({ ...s, password: v }))}
              placeholder="Access Password"
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Role</Text>
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
                  onPress={() => setNewStaff((s) => ({ ...s, role: role.id }))}
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
              style={styles.modalBtnPrimary}
              onPress={handleAddStaff}
              disabled={addingStaff}
            >
              <Text style={styles.modalBtnTextPrimary}>
                {addingStaff ? "Saving..." : "Save Member"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════════  EDIT STAFF MODAL  ════════════ */}
      <Modal
        visible={editStaffOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditStaffOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Member</Text>
              <TouchableOpacity onPress={() => setEditStaffOpen(false)}>
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editStaff.name}
              onChangeText={(v) => setEditStaff((s) => ({ ...s, name: v }))}
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={editStaff.email}
              onChangeText={(v) => setEditStaff((s) => ({ ...s, email: v }))}
              placeholder="Work Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>New Password (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={editStaff.password}
              onChangeText={(v) => setEditStaff((s) => ({ ...s, password: v }))}
              placeholder="New Password"
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Role</Text>
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
                  onPress={() => setEditStaff((s) => ({ ...s, role: role.id }))}
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
              style={styles.modalBtnPrimary}
              onPress={handleUpdateStaff}
              disabled={editingStaff}
            >
              <Text style={styles.modalBtnTextPrimary}>
                {editingStaff ? "Updating..." : "Update Member"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scroll: {
    flex: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginRight: 12,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#FEF3C7",
  },
  headerCenter: {
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
    marginTop: 2,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 24,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardTitle: {
    fontSize: 18,
    color: "#111827",
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  secondaryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
  },
  secondaryBtnText: {
    color: "#D97706",
    fontWeight: "700",
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  row: {
    flexDirection: "row",
    marginTop: 8,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },

  /* TEAM MEMBERS */
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
  },
  memberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  memberRole: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 2,
  },
  memberActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  emptyStateText: {
    color: "#9CA3AF",
    fontWeight: "500",
  },
  mutedText: {
    color: "#9CA3AF",
    fontStyle: "italic",
    fontSize: 13,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
  },

  /* TABLES */
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tableLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  tableActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteTableBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
  },
  deleteTableText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
  },

  /* DEVICES */
  deviceRow: {
    flexDirection: "row",
  },
  deviceCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  deviceIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  deviceStatus: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginTop: 4,
  },

  /* LOGOUT */
  logoutBtn: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  logoutBtnText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 15,
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rolePillActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  rolePillTextActive: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  modalBtnPrimary: {
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  modalBtnTextPrimary: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
