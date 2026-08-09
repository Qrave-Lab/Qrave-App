import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AdminSettingsHeader from "../../components/admin/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type Branch = {
  restaurant_id: string;
  name: string;
  currency: string;
  address?: string | null;
  phone?: string | null;
  role: string;
  is_archived?: boolean;
};

type BranchStaff = {
  ID: string;
  Email: string;
  Role: string;
};

export default function SettingsBranches() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isNewBranchLocked, setIsNewBranchLocked] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [branchStaff, setBranchStaff] = useState<BranchStaff[]>([]);

  const [editForm, setEditForm] = useState({
    currency: "INR",
    address: "",
    phone: "",
  });

  const [assignForm, setAssignForm] = useState({
    email: "",
    password: "",
    role: "cashier",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({
    currency: "INR",
    address: "",
    phone: "",
    table_count: "12",
    open_time: "09:00",
    close_time: "23:00",
    phone_country_code: "+91",
  });

  const selectedBranch = useMemo(
    () => branches.find((b) => b.restaurant_id === selectedBranchId) || null,
    [branches, selectedBranchId],
  );

  const normalizePhoneForSubmit = (countryCode: string, rawPhone: string) => {
    const cleaned = String(rawPhone || "").trim();
    if (!cleaned) return "";
    let digits = cleaned.replace(/\D/g, "");
    const ccDigits = countryCode.replace("+", "");
    if (digits.startsWith(ccDigits)) digits = digits.slice(ccDigits.length);
    return digits;
  };

  const loadBranches = useCallback(async () => {
    const [res, billing, me] = await Promise.all([
      apiClient.get("/api/admin/branches?include_archived=0"),
      apiClient.get("/api/admin/billing/status"),
      apiClient.get("/api/admin/me"),
    ]);

    const listRaw = Array.isArray(res?.branches)
      ? (res.branches as Branch[])
      : [];
    const list = listRaw.map((b: any) => ({
      ...b,
      restaurant_id: String(b?.restaurant_id ?? ""),
    })) as Branch[];
    const normalizedPlan = String(billing?.plan || "").toLowerCase();
    const isPremiumPlan =
      normalizedPlan === "monthly_999" ||
      normalizedPlan === "monthly_1499" ||
      normalizedPlan === "yearly_10999" ||
      normalizedPlan === "yearly_14999";

    setIsNewBranchLocked(!isPremiumPlan && list.length >= 1);
    setBranches(list);
    setBrandName(String(me?.restaurant || ""));
    setSelectedBranchId((prev) => {
      const prevId = String(prev || "");
      if (prevId && list.some((b) => b.restaurant_id === prevId)) return prevId;
      return String(list[0]?.restaurant_id || "");
    });
  }, []);

  const loadBranchStaff = useCallback(async (branchId: string) => {
    if (!branchId) {
      setBranchStaff([]);
      return;
    }
    const staff = await apiClient.get(`/api/admin/branches/${branchId}/staff`);
    setBranchStaff(Array.isArray(staff) ? staff : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadBranches();
      } catch {
        Alert.alert("Load failed", "Could not load branch settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadBranches]);

  useEffect(() => {
    if (!selectedBranchId) return;
    const branch = branches.find((b) => b.restaurant_id === selectedBranchId);
    if (branch) {
      setEditForm({
        currency: branch.currency || "INR",
        address: branch.address || "",
        phone: branch.phone || "",
      });
    }
    loadBranchStaff(selectedBranchId).catch(() => undefined);
  }, [branches, loadBranchStaff, selectedBranchId]);

  const saveBranch = useCallback(async () => {
    if (!selectedBranchId) return;
    setBusy(true);
    try {
      await apiClient.patch(`/api/admin/branches/${selectedBranchId}`, {
        currency: editForm.currency,
        address: editForm.address,
        phone: editForm.phone,
      });
      await loadBranches();
      Alert.alert("Saved", "Branch updated.");
    } catch {
      Alert.alert("Save failed", "Could not update branch.");
    } finally {
      setBusy(false);
    }
  }, [editForm, loadBranches, selectedBranchId]);

  const archiveBranch = useCallback(async () => {
    if (!selectedBranchId || !selectedBranch) return;
    Alert.alert("Archive branch?", `Archive "${selectedBranch.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await apiClient.post(
              `/api/admin/branches/${selectedBranchId}/archive`,
              {},
            );
            await loadBranches();
          } catch {
            Alert.alert("Archive failed", "Could not archive branch.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [loadBranches, selectedBranch, selectedBranchId]);

  const assignStaff = useCallback(async () => {
    if (!selectedBranchId) return;
    if (!assignForm.email.trim()) {
      Alert.alert("Missing email", "Email is required.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(
        `/api/admin/branches/${selectedBranchId}/staff`,
        assignForm,
      );
      setAssignForm((p) => ({ ...p, email: "", password: "" }));
      await loadBranchStaff(selectedBranchId);
      Alert.alert("Assigned", "Staff assigned to branch.");
    } catch {
      Alert.alert("Assign failed", "Could not assign staff.");
    } finally {
      setBusy(false);
    }
  }, [assignForm, loadBranchStaff, selectedBranchId]);

  const createBranch = useCallback(async () => {
    if (!brandName.trim()) {
      Alert.alert("Missing brand", "Brand name is required.");
      return;
    }
    if (!newBranch.address.trim()) {
      Alert.alert("Missing address", "Location/address is required.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/api/admin/branches", {
        name: brandName.trim(),
        currency: newBranch.currency,
        address: newBranch.address,
        phone: normalizePhoneForSubmit(
          newBranch.phone_country_code,
          newBranch.phone,
        ),
        table_count: Number(newBranch.table_count || 1),
        open_time: newBranch.open_time,
        close_time: newBranch.close_time,
        phone_country_code: newBranch.phone_country_code,
        copy_current_logo: true,
        purchase_extra_branch: false,
      });
      setCreateOpen(false);
      await loadBranches();
      Alert.alert("Created", "Branch created.");
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("requires add-on")) {
        Alert.alert(
          "Plan limit reached",
          "Upgrade or add branch add-on in subscription.",
        );
      } else {
        Alert.alert("Create failed", "Could not create branch.");
      }
    } finally {
      setBusy(false);
    }
  }, [brandName, loadBranches, newBranch]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0F172A" />
        <Text style={styles.helper}>Loading branches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Branches & Locations"
        subtitle="Create another branch/location and manage branch staff"
        actionButton={
          <Pressable
            style={[
              styles.addBtn,
              (isNewBranchLocked || busy) && styles.btnDisabled,
            ]}
            onPress={() =>
              isNewBranchLocked
                ? router.push("/admin/subscription" as any)
                : setCreateOpen(true)
            }
            disabled={busy}
          >
            <Text style={styles.addBtnText}>
              {isNewBranchLocked ? "Upgrade Plan" : "New Branch"}
            </Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {isNewBranchLocked ? (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>
              Current plan has reached branch limit.
            </Text>
            <Text style={styles.warningText}>
              Upgrade your plan to add more branches.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Branch Selector</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {branches.map((b) => (
              <Pressable
                key={b.restaurant_id}
                style={[
                  styles.branchChip,
                  selectedBranchId === b.restaurant_id &&
                    styles.branchChipActive,
                ]}
                onPress={() => setSelectedBranchId(String(b.restaurant_id))}
              >
                <Text
                  style={[
                    styles.branchChipText,
                    selectedBranchId === b.restaurant_id &&
                      styles.branchChipTextActive,
                  ]}
                >
                  {b.address ? `${b.name} - ${b.address}` : b.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {selectedBranch ? (
            <>
              <Text style={styles.sectionTitle}>Edit Branch</Text>
              <Text style={styles.label}>Currency</Text>
              <TextInput
                value={editForm.currency}
                onChangeText={(v) =>
                  setEditForm((p) => ({ ...p, currency: v }))
                }
                style={styles.input}
              />
              <Text style={styles.label}>Address</Text>
              <TextInput
                value={editForm.address}
                onChangeText={(v) => setEditForm((p) => ({ ...p, address: v }))}
                style={styles.input}
              />
              <Text style={styles.label}>Phone</Text>
              <TextInput
                value={editForm.phone}
                onChangeText={(v) => setEditForm((p) => ({ ...p, phone: v }))}
                style={styles.input}
              />

              <View style={styles.rowGap}>
                <Pressable
                  style={[styles.primaryBtn, busy && styles.btnDisabled]}
                  onPress={saveBranch}
                  disabled={busy}
                >
                  <Text style={styles.primaryText}>Save Branch</Text>
                </Pressable>
                <Pressable
                  style={[styles.dangerBtn, busy && styles.btnDisabled]}
                  onPress={archiveBranch}
                  disabled={busy}
                >
                  <Text style={styles.dangerText}>Archive</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>Assign Staff To Branch</Text>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={assignForm.email}
                onChangeText={(v) => setAssignForm((p) => ({ ...p, email: v }))}
                style={styles.input}
                autoCapitalize="none"
              />
              <Text style={styles.label}>Password (for new users)</Text>
              <TextInput
                value={assignForm.password}
                onChangeText={(v) =>
                  setAssignForm((p) => ({ ...p, password: v }))
                }
                style={styles.input}
                secureTextEntry
              />
              <Text style={styles.label}>Role</Text>
              <View style={styles.rowGap}>
                {["manager", "kitchen", "waiter", "cashier"].map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.roleChip,
                      assignForm.role === r && styles.roleChipActive,
                    ]}
                    onPress={() => setAssignForm((p) => ({ ...p, role: r }))}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        assignForm.role === r && styles.roleChipTextActive,
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={assignStaff}
                disabled={busy}
              >
                <Text style={styles.primaryText}>Assign Staff</Text>
              </Pressable>

              <Text style={styles.sectionTitle}>Branch Staff</Text>
              {branchStaff.length === 0 ? (
                <Text style={styles.empty}>No staff assigned.</Text>
              ) : (
                branchStaff.map((s) => (
                  <View key={s.ID} style={styles.staffRow}>
                    <View style={styles.staffLeft}>
                      <Image
                        source={{
                          uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(s.Email || s.ID)}`,
                        }}
                        style={styles.avatar}
                      />
                      <Text style={styles.staffEmail}>{s.Email}</Text>
                    </View>
                    <Text style={styles.staffRole}>{s.Role}</Text>
                  </View>
                ))
              )}
            </>
          ) : (
            <Text style={styles.empty}>
              No branches yet. Create your first branch.
            </Text>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCreateOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Create Branch</Text>
            <Text style={styles.label}>Brand name (shared)</Text>
            <TextInput
              value={brandName}
              editable={false}
              style={[styles.input, styles.inputDisabled]}
            />
            <Text style={styles.label}>Currency</Text>
            <TextInput
              value={newBranch.currency}
              onChangeText={(v) => setNewBranch((p) => ({ ...p, currency: v }))}
              style={styles.input}
            />
            <Text style={styles.label}>Location / Address</Text>
            <TextInput
              value={newBranch.address}
              onChangeText={(v) => setNewBranch((p) => ({ ...p, address: v }))}
              style={styles.input}
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={newBranch.phone}
              onChangeText={(v) => setNewBranch((p) => ({ ...p, phone: v }))}
              style={styles.input}
            />
            <Text style={styles.label}>Country code</Text>
            <TextInput
              value={newBranch.phone_country_code}
              onChangeText={(v) =>
                setNewBranch((p) => ({ ...p, phone_country_code: v }))
              }
              style={styles.input}
            />
            <Text style={styles.label}>Initial tables</Text>
            <TextInput
              value={newBranch.table_count}
              onChangeText={(v) =>
                setNewBranch((p) => ({ ...p, table_count: v }))
              }
              style={styles.input}
              keyboardType="number-pad"
            />
            <Text style={styles.label}>Open time</Text>
            <TextInput
              value={newBranch.open_time}
              onChangeText={(v) =>
                setNewBranch((p) => ({ ...p, open_time: v }))
              }
              style={styles.input}
            />
            <Text style={styles.label}>Close time</Text>
            <TextInput
              value={newBranch.close_time}
              onChangeText={(v) =>
                setNewBranch((p) => ({ ...p, close_time: v }))
              }
              style={styles.input}
            />

            <View style={styles.rowGap}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setCreateOpen(false)}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={createBranch}
                disabled={busy}
              >
                <Text style={styles.primaryText}>
                  {busy ? "Creating..." : "Create Branch"}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  helper: { marginTop: 8, color: "#64748B", fontWeight: "600" },
  addBtn: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
  content: { padding: 12, paddingBottom: 24, gap: 10 },
  warning: {
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 10,
  },
  warningTitle: { color: "#92400E", fontWeight: "800", fontSize: 13 },
  warningText: {
    marginTop: 4,
    color: "#A16207",
    fontWeight: "600",
    fontSize: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 6,
  },
  branchChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  branchChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  branchChipText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  branchChipTextActive: { color: "#FFFFFF" },
  label: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 5,
    marginTop: 4,
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    color: "#0F172A",
    fontWeight: "600",
    backgroundColor: "#FFFFFF",
    marginBottom: 7,
  },
  inputDisabled: { backgroundColor: "#F1F5F9", color: "#94A3B8" },
  rowGap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  primaryBtn: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  dangerBtn: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dangerText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  secondaryBtn: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  secondaryText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  roleChip: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  roleChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  roleChipText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "capitalize",
  },
  roleChipTextActive: { color: "#FFFFFF" },
  empty: { color: "#64748B", fontWeight: "600", marginTop: 4 },
  staffRow: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  staffLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  staffEmail: { color: "#334155", fontWeight: "700", fontSize: 12, flex: 1 },
  staffRole: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
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
    padding: 12,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
});
