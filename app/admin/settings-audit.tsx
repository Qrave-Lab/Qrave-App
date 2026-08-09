import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AdminSettingsHeader from "../../components/admin/AdminSettingsHeader";
import apiClient from "../../lib/apiClient";

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  user_role?: string;
  user_name?: string;
  meta?: Record<string, any>;
  created_at: string;
};

function formatLabel(value: string) {
  return String(value || "")
    .replace(/[_.]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/* ── Color helpers matching the website palette ─────────── */
type ChipColor = {
  bg: string;
  border: string;
  text: string;
};

function actionColor(action: string): ChipColor {
  if (action.includes("cancelled") || action.includes("deleted"))
    return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" };
  if (action.includes("created") || action.includes("added"))
    return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" };
  if (action.includes("updated") || action.includes("changed"))
    return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" };
  if (action.includes("status"))
    return { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" };
  return { bg: "#F8FAFC", border: "#E2E8F0", text: "#475569" };
}

function roleColor(role: string): ChipColor {
  const r = (role || "").toLowerCase();
  if (r === "owner")
    return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
  if (r === "manager")
    return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" };
  if (r === "waiter")
    return { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" };
  if (r === "kitchen" || r === "chef")
    return { bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" };
  return { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
}

function entityColor(entity: string): ChipColor {
  const e = (entity || "").toLowerCase();
  if (e.includes("menu") || e.includes("item"))
    return { bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" };
  if (e.includes("order"))
    return { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" };
  if (e.includes("table") || e.includes("floor"))
    return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" };
  if (e.includes("user") || e.includes("team"))
    return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" };
  return { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
}

function detailChipColor(chip: string): ChipColor {
  const c = chip.toLowerCase();
  if (c.includes("price") || c.includes("rs ") || c.includes("₹"))
    return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
  if (
    c.includes("archived") ||
    c.includes("out of stock") ||
    c.includes("cancelled")
  )
    return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" };
  if (
    c.includes("unarchived") ||
    c.includes("in stock") ||
    c.includes("active")
  )
    return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" };
  if (c.includes("special"))
    return { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" };
  return { bg: "#F8FAFC", border: "#E2E8F0", text: "#475569" };
}

/* ── Build structured detail chips ──────────────────────── */
type DetailChip = { label: string; color: ChipColor };

function renderAuditDetails(log: AuditLog): DetailChip[] {
  const meta = log.meta || {};
  if (!meta || Object.keys(meta).length === 0) return [];

  const chips: DetailChip[] = [];

  // Order status change — special from/to rendering
  if (log.action === "order.status.updated") {
    const from = fmt(meta.from_status);
    const to = fmt(meta.to_status);
    chips.push({
      label: `${formatLabel(from)} → ${formatLabel(to)}`,
      color: { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
    });
    return chips;
  }

  // Order cancelled
  if (log.action === "order.cancelled") {
    chips.push({
      label: "Order cancelled",
      color: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
    });
    return chips;
  }

  // Menu item changes
  if (log.action.startsWith("menu.item")) {
    if (meta.name) {
      chips.push({
        label: String(meta.name),
        color: { bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" },
      });
    }
    if (meta.price_changed) {
      chips.push({
        label: `Price: ₹${meta.previous_price} → ₹${meta.new_price}`,
        color: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
      });
    }
    if (meta.archive_state_change) {
      chips.push({
        label: meta.is_archived ? "Archived" : "Unarchived",
        color: meta.is_archived
          ? { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" }
          : { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
      });
    }
    if (
      "is_out_of_stock" in meta &&
      meta.is_out_of_stock !== meta.previous_out_of_stock
    ) {
      const oos = meta.is_out_of_stock;
      chips.push({
        label: oos ? "Marked Out of Stock" : "Marked In Stock",
        color: oos
          ? { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" }
          : { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
      });
    }
    // Boolean toggles
    const boolPairs: [string, string, string][] = [
      ["is_todays_special", "Today's Special ON", "Today's Special OFF"],
      ["is_chef_special", "Chef Special ON", "Chef Special OFF"],
    ];
    for (const [key, onLabel, offLabel] of boolPairs) {
      if (key in meta) {
        chips.push({
          label: meta[key] ? onLabel : offLabel,
          color: meta[key]
            ? { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" }
            : { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" },
        });
      }
    }
  }

  // Generic fallback for remaining meta keys
  const ignoreKeys = new Set([
    "name",
    "price_changed",
    "previous_price",
    "new_price",
    "archive_state_change",
    "is_archived",
    "previous_archived",
    "previous_out_of_stock",
    "previous_chef",
    "previous_special",
    "from_status",
    "to_status",
    "is_out_of_stock",
    "is_todays_special",
    "is_chef_special",
  ]);

  for (const [k, v] of Object.entries(meta)) {
    if (ignoreKeys.has(k)) continue;
    if (v == null || v === "") continue;
    if (typeof v === "boolean" && k.endsWith("_change") && !v) continue;
    if (v === false && ["dietary_manual_override"].includes(k)) {
      continue;
    }
    const text = `${formatLabel(k)}: ${fmt(v)}`;
    chips.push({ label: text, color: detailChipColor(text) });
  }

  return chips;
}

export default function SettingsAudit() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/api/admin/audit/logs?limit=200");
        setLogs(Array.isArray(res?.logs) ? res.logs : []);
      } catch {
        Alert.alert("Load failed", "Could not load audit logs.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const txt =
        `${l.action} ${l.entity_type} ${l.entity_id || ""} ${l.user_role || ""} ${JSON.stringify(l.meta || {})}`.toLowerCase();
      return txt.includes(q);
    });
  }, [logs, query]);

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Audit Logs"
        subtitle="Track critical actions across staff and system."
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0F172A" />
          <Text style={styles.helper}>Loading audit logs...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by action, role, metadata..."
            placeholderTextColor="#94A3B8"
            style={styles.search}
          />

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No logs found.</Text>
            </View>
          ) : (
            filtered.map((log) => {
              const details = renderAuditDetails(log);
              const ac = actionColor(log.action);
              const rc = roleColor(log.user_role || "");
              const ec = entityColor(log.entity_type);

              return (
                <View key={log.id} style={styles.logCard}>
                  <Text style={styles.time}>
                    {new Date(log.created_at).toLocaleString()}
                  </Text>

                  {/* ── Badge row: Action · Entity · Role ───── */}
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: ac.bg, borderColor: ac.border },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: ac.text }]}>
                        {formatLabel(log.action)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: ec.bg, borderColor: ec.border },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: ec.text }]}>
                        {formatLabel(log.entity_type)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: rc.bg, borderColor: rc.border },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: rc.text }]}>
                        {log.user_name
                          ? `${log.user_name} (${(log.user_role || "unknown").toLowerCase()})`
                          : (log.user_role || "unknown").toLowerCase()}
                      </Text>
                    </View>
                  </View>

                  {/* ── Detail chips ────────────────────────── */}
                  {details.length === 0 ? (
                    <Text style={styles.emptyDetails}>
                      No significant changes
                    </Text>
                  ) : (
                    <View style={styles.chipsWrap}>
                      {details.map((chip) => (
                        <View
                          key={`${log.id}-${chip.label}`}
                          style={[
                            styles.detailChip,
                            {
                              backgroundColor: chip.color.bg,
                              borderColor: chip.color.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.detailChipText,
                              { color: chip.color.text },
                            ]}
                          >
                            {chip.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  helper: { marginTop: 8, color: "#64748B", fontWeight: "600" },
  content: { padding: 12, paddingBottom: 24, gap: 10 },
  search: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontWeight: "600",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: { color: "#64748B", fontWeight: "600" },
  logCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  time: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyDetails: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
  },
  chipsWrap: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  detailChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detailChipText: { fontSize: 11, fontWeight: "700" },
});
