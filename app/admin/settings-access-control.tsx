import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import AdminSettingsHeader from "../../components/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type RoleKey = "manager" | "kitchen" | "waiter" | "cashier";
type FeatureKey = "floor" | "menu" | "analytics" | "settings";
type RoleAccess = Record<RoleKey, Record<FeatureKey, boolean>>;

const ROLES: { key: RoleKey; label: string }[] = [
  { key: "manager", label: "Manager" },
  { key: "kitchen", label: "Kitchen/Chef" },
  { key: "waiter", label: "Waiter" },
  { key: "cashier", label: "Cashier" },
];

const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "floor", label: "Floor" },
  { key: "menu", label: "Menu" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
];

const defaultRoleAccess = (): RoleAccess => ({
  manager: {
    floor: true,
    menu: true,
    analytics: true,
    settings: true,
  },
  kitchen: {
    floor: true,
    menu: false,
    analytics: false,
    settings: false,
  },
  waiter: {
    floor: true,
    menu: false,
    analytics: false,
    settings: false,
  },
  cashier: {
    floor: true,
    menu: false,
    analytics: true,
    settings: false,
  },
});

function normalizeRoleAccess(raw: any): RoleAccess {
  const base = defaultRoleAccess();
  if (!raw || typeof raw !== "object") return base;
  for (const role of ROLES) {
    const roleObj = raw?.[role.key];
    if (!roleObj || typeof roleObj !== "object") continue;
    for (const feature of FEATURES) {
      if (typeof roleObj?.[feature.key] === "boolean") {
        base[role.key][feature.key] = roleObj[feature.key];
      }
    }
  }
  return base;
}

export default function SettingsAccessControl() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [themeConfig, setThemeConfig] = useState<Record<string, any>>({});
  const [roleAccess, setRoleAccess] = useState<RoleAccess>(defaultRoleAccess());

  useEffect(() => {
    (async () => {
      try {
        const me = await apiClient.get("/api/admin/me");
        setRole(String(me?.role || "").toLowerCase());
        const cfg =
          me?.theme_config && typeof me.theme_config === "object"
            ? me.theme_config
            : {};
        setThemeConfig(cfg);
        setRoleAccess(normalizeRoleAccess(cfg?.role_access));
      } catch {
        Alert.alert("Load failed", "Could not load access settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(roleAccess) !==
      JSON.stringify(normalizeRoleAccess(themeConfig?.role_access))
    );
  }, [roleAccess, themeConfig]);

  const toggle = useCallback((r: RoleKey, f: FeatureKey) => {
    setRoleAccess((prev) => ({
      ...prev,
      [r]: {
        ...prev[r],
        [f]: !prev[r][f],
      },
    }));
  }, []);

  const save = useCallback(async () => {
    if (role !== "owner") {
      Alert.alert("Restricted", "Only owner can edit role access.");
      return;
    }
    setSaving(true);
    try {
      const next = { ...themeConfig, role_access: roleAccess };
      await apiClient.patch("/api/admin/update-details", {
        theme_config: next,
      });
      setThemeConfig(next);
      Alert.alert("Saved", "Access controls updated.");
    } catch {
      Alert.alert("Save failed", "Could not save access controls.");
    } finally {
      setSaving(false);
    }
  }, [role, roleAccess, themeConfig]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0F172A" />
        <Text style={styles.helper}>Loading access control...</Text>
      </View>
    );
  }

  if (role !== "owner") {
    return (
      <View style={styles.screen}>
        <AdminSettingsHeader title="Role Access Control" />
        <View style={styles.restricted}>
          <Text style={styles.restrictedTitle}>Restricted</Text>
          <Text style={styles.restrictedText}>
            Only owner can edit role access controls.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Role Access Control"
        actionButton={
          <Pressable
            style={[
              styles.saveBtn,
              (!hasChanges || saving) && styles.btnDisabled,
            ]}
            onPress={save}
            disabled={!hasChanges || saving}
          >
            <Text style={styles.saveText}>
              {saving ? "Saving..." : "Save Access"}
            </Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {ROLES.map((r) => (
          <View key={r.key} style={styles.card}>
            <Text style={styles.roleTitle}>{r.label}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featureRow}
            >
              {FEATURES.map((f) => (
                <Pressable
                  key={f.key}
                  style={styles.toggleWrap}
                  onPress={() => toggle(r.key, f.key)}
                >
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <View
                    style={[
                      styles.toggleTrack,
                      roleAccess[r.key][f.key] && styles.toggleTrackOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleDot,
                        roleAccess[r.key][f.key] && styles.toggleDotOn,
                      ]}
                    />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}
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
  saveBtn: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  saveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  btnDisabled: { opacity: 0.55 },
  restricted: {
    margin: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
  },
  restrictedTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  restrictedText: { marginTop: 4, color: "#64748B", fontWeight: "600" },
  content: { padding: 12, paddingBottom: 24, gap: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  roleTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  featureRow: { flexDirection: "row", gap: 8, paddingRight: 6 },
  toggleWrap: {
    minWidth: 92,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  featureLabel: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  toggleTrack: {
    width: 46,
    height: 24,
    borderRadius: 14,
    backgroundColor: "#CBD5E1",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: "#10B981" },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  toggleDotOn: { alignSelf: "flex-end" },
});
