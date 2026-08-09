import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AdminSettingsHeader from "../../components/admin/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type StaffRow = {
  id: string;
  email: string;
  role: string;
  name?: string;
};

type StaffDetail = {
  email?: string;
  role?: string;
  name?: string;
};

const ROLE_OPTIONS = [
  { id: "manager", label: "Manager" },
  { id: "kitchen", label: "Chef" },
  { id: "waiter", label: "Waiter" },
  { id: "cashier", label: "Cashier" },
];

const roleLabel = (role: string) => {
  const found = ROLE_OPTIONS.find((r) => r.id === role);
  return found ? found.label : role || "Staff";
};

const ROLE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  manager: { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  kitchen: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  delivery_rider: { bg: "#EEF2FF", text: "#4F46E5", border: "#C7D2FE" },
  waiter: { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
  cashier: { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
};

const getRolePillStyle = (role: string) => {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.waiter;
  return {
    color: colors.text,
    backgroundColor: colors.bg,
    borderColor: colors.border,
  };
};

const normalizeStaff = (raw: any): StaffRow => {
  const id = String(raw?.ID || raw?.id || raw?.user_id || "");
  const email = String(raw?.Email || raw?.email || "");
  const role = String(raw?.Role || raw?.role || "waiter").toLowerCase();
  const fallbackName = email.includes("@") ? email.split("@")[0] : "team";
  const name = String(raw?.name || raw?.Name || fallbackName);
  return { id, email, role, name };
};

export default function SettingsTeamMembers() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [restaurantId, setRestaurantId] = useState<string>("");
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("waiter");
  const [editPassword, setEditPassword] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("waiter");
  const [addPassword, setAddPassword] = useState("");

  const loadMetaAndStaff = useCallback(async () => {
    const [meRes, staffRes] = await Promise.allSettled([
      apiClient.get("/api/admin/me"),
      apiClient.get("/api/admin/staffs"),
    ]);

    if (meRes.status === "fulfilled") {
      const id = String(meRes.value?.restaurant_id || meRes.value?.id || "");
      setRestaurantId(id);
    }

    if (staffRes.status === "fulfilled") {
      const list = Array.isArray(staffRes.value) ? staffRes.value : [];
      setStaff(list.map(normalizeStaff).filter((s) => s.id));
    } else {
      throw new Error("staff_load_failed");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadMetaAndStaff();
      } catch {
        Alert.alert("Load failed", "Could not load team members.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMetaAndStaff]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMetaAndStaff();
    } finally {
      setRefreshing(false);
    }
  }, [loadMetaAndStaff]);

  const sortedStaff = useMemo(
    () =>
      [...staff].sort((a, b) => {
        const ra = roleLabel(a.role).localeCompare(roleLabel(b.role));
        if (ra !== 0) return ra;
        return a.email.localeCompare(b.email);
      }),
    [staff],
  );

  const openDelete = useCallback((row: StaffRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/api/admin/delete/${deleteTarget.id}`);
      setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch {
      Alert.alert("Delete failed", "Could not remove this team member.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

  const openEdit = useCallback(async (row: StaffRow) => {
    setEditTarget(row);
    setEditName(row.name || "");
    setEditEmail(row.email);
    setEditRole(row.role || "waiter");
    setEditPassword("");
    setEditOpen(true);
    try {
      const detail: StaffDetail = await apiClient.get(
        `/api/admin/staffDetails/${row.id}`,
      );
      if (detail) {
        setEditName(String(detail.name || row.name || ""));
        setEditEmail(String(detail.email || row.email));
        setEditRole(String(detail.role || row.role || "waiter").toLowerCase());
      }
    } catch {
      Alert.alert("Partial load", "Opened editor with basic member details.");
    }
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editTarget) return;
    const email = editEmail.trim();
    if (!email) {
      Alert.alert("Missing email", "Email is required.");
      return;
    }

    const payload: Record<string, string> = {
      email,
      role: editRole || "waiter",
    };
    if (editName.trim()) payload.name = editName.trim();
    if (editPassword.trim()) payload.password = editPassword.trim();

    try {
      setSaving(true);
      await apiClient.put(`/api/admin/staffDetails/${editTarget.id}`, payload);
      setStaff((prev) =>
        prev.map((s) =>
          s.id === editTarget.id
            ? {
                ...s,
                email,
                role: payload.role,
                name: payload.name || s.name,
              }
            : s,
        ),
      );
      setEditOpen(false);
      setEditTarget(null);
    } catch {
      Alert.alert("Update failed", "Could not update team member.");
    } finally {
      setSaving(false);
    }
  }, [editEmail, editName, editPassword, editRole, editTarget]);

  const createMember = useCallback(async () => {
    const email = addEmail.trim();
    const password = addPassword.trim();
    if (!restaurantId) {
      Alert.alert("Please wait", "Restaurant context is still loading.");
      return;
    }
    if (!email || !password) {
      Alert.alert("Missing fields", "Email and password are required.");
      return;
    }

    const payload: Record<string, string> = {
      email,
      password,
      role: addRole || "waiter",
    };
    if (addName.trim()) payload.name = addName.trim();

    try {
      setSaving(true);
      await apiClient.post(
        `/api/admin/restaurants/${restaurantId}/staff`,
        payload,
      );
      await loadMetaAndStaff();
      setAddOpen(false);
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddRole("waiter");
    } catch {
      Alert.alert("Create failed", "Could not add team member.");
    } finally {
      setSaving(false);
    }
  }, [addEmail, addName, addPassword, addRole, loadMetaAndStaff, restaurantId]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#111827" />
        <Text style={styles.loadingText}>Loading team members...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Team Members"
        subtitle="Add, edit, and remove staff access"
        actionButton={
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <MaterialIcons name="person-add-alt-1" size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add New</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.card}>
          {sortedStaff.map((row) => (
            <View key={row.id} style={styles.row}>
              <Image
                source={{
                  uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(row.email || row.id)}`,
                }}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.nameText}>
                  {row.name || row.email.split("@")[0]}
                </Text>
                <Text style={styles.emailText}>{row.email}</Text>
              </View>
              <Text style={[styles.rolePill, getRolePillStyle(row.role)]}>
                {roleLabel(row.role)}
              </Text>
              <Pressable style={styles.iconBtn} onPress={() => openEdit(row)}>
                <MaterialIcons name="edit" size={18} color="#0F172A" />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => openDelete(row)}>
                <MaterialIcons
                  name="delete-outline"
                  size={19}
                  color="#DC2626"
                />
              </Pressable>
            </View>
          ))}

          {sortedStaff.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                No team members onboarded yet.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDeleteOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Remove Team Member?</Text>
            <Text style={styles.modalNote}>
              This will revoke access for {deleteTarget?.email || "this member"}
              .
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setDeleteOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.dangerBtn, deleting && styles.btnDisabled]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                <Text style={styles.dangerBtnText}>
                  {deleting ? "Removing..." : "Remove"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Edit Team Member</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={styles.input}
              placeholder="Member name"
            />
            <Text style={styles.modalLabel}>Email</Text>
            <TextInput
              value={editEmail}
              onChangeText={setEditEmail}
              style={styles.input}
              placeholder="member@work.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.modalLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((role) => (
                <Pressable
                  key={role.id}
                  style={[
                    styles.roleSelect,
                    editRole === role.id && styles.roleSelectActive,
                  ]}
                  onPress={() => setEditRole(role.id)}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      editRole === role.id && styles.roleSelectTextActive,
                    ]}
                  >
                    {role.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalLabel}>New Password (optional)</Text>
            <TextInput
              value={editPassword}
              onChangeText={setEditPassword}
              style={styles.input}
              placeholder="Leave blank to keep current"
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setEditOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, saving && styles.btnDisabled]}
                onPress={saveEdit}
                disabled={saving}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Team Member</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              value={addName}
              onChangeText={setAddName}
              style={styles.input}
              placeholder="John Doe"
            />
            <Text style={styles.modalLabel}>Email</Text>
            <TextInput
              value={addEmail}
              onChangeText={setAddEmail}
              style={styles.input}
              placeholder="member@work.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.modalLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((role) => (
                <Pressable
                  key={role.id}
                  style={[
                    styles.roleSelect,
                    addRole === role.id && styles.roleSelectActive,
                  ]}
                  onPress={() => setAddRole(role.id)}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      addRole === role.id && styles.roleSelectTextActive,
                    ]}
                  >
                    {role.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalLabel}>Password</Text>
            <TextInput
              value={addPassword}
              onChangeText={setAddPassword}
              style={styles.input}
              placeholder="Set a password"
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setAddOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, saving && styles.btnDisabled]}
                onPress={createMember}
                disabled={saving}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? "Adding..." : "Add Member"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: { marginTop: 8, color: "#64748B", fontWeight: "600" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
  },
  addBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  content: { padding: 12, paddingBottom: 26 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  nameText: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
  emailText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  rolePill: {
    color: "#475569",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  emptyWrap: { paddingVertical: 24, alignItems: "center" },
  emptyText: { color: "#64748B", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalNote: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  roleSelect: {
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  roleSelectActive: { backgroundColor: "#111827", borderColor: "#111827" },
  roleSelectText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  roleSelectTextActive: { color: "#FFFFFF" },
  modalActions: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  primaryBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  dangerBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },
  dangerBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  btnDisabled: { opacity: 0.65 },
});
