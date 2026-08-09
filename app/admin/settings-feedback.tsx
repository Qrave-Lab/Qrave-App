import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type FeedbackType =
  | "bug"
  | "feature_request"
  | "general"
  | "performance"
  | "ux";
type Priority = "low" | "medium" | "high" | "critical";
type FeedbackStatus = "open" | "acknowledged" | "resolved" | "wont_fix";

type FeedbackEntry = {
  id: string;
  user_role: string;
  type: FeedbackType;
  priority: Priority;
  title: string;
  description: string;
  status: FeedbackStatus;
  created_at: string;
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug Report",
  feature_request: "Feature Request",
  general: "General Feedback",
  performance: "Performance Issue",
  ux: "UX / Design",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  wont_fix: "Won't Fix",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsFeedback() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<FeedbackEntry[]>([]);

  const [type, setType] = useState<FeedbackType>("general");
  const [priority, setPriority] = useState<Priority>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 && description.trim().length > 0 && !submitting,
    [description, submitting, title],
  );

  const loadHistory = useCallback(async () => {
    const res = await apiClient.get("/api/admin/feedback");
    setHistory(Array.isArray(res?.feedback) ? res.feedback : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadHistory();
      } catch {
        Alert.alert("Load failed", "Could not load feedback history.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory]);

  const submit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Missing fields", "Please fill both title and description.");
      return;
    }
    setSubmitting(true);
    try {
      const newEntry = await apiClient.post("/api/admin/feedback", {
        type,
        priority,
        title: title.trim(),
        description: description.trim(),
      });
      setHistory((prev) => [newEntry, ...prev]);
      setType("general");
      setPriority("medium");
      setTitle("");
      setDescription("");
      Alert.alert("Submitted", "Thanks for your feedback.");
    } catch {
      Alert.alert("Submit failed", "Could not submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }, [description, priority, title, type]);

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Feedback & Issues"
        subtitle="Report bugs, request features, or share thoughts"
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0F172A" />
          <Text style={styles.helper}>Loading feedback...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Submit New Feedback</Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {(Object.keys(TYPE_LABELS) as FeedbackType[]).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, type === t && styles.chipActive]}
                  onPress={() => setType(t)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      type === t && styles.chipTextActive,
                    ]}
                  >
                    {TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Priority</Text>
            <View style={styles.chipRow}>
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <Pressable
                  key={p}
                  style={[styles.chip, priority === p && styles.chipActive]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      priority === p && styles.chipTextActive,
                    ]}
                  >
                    {PRIORITY_LABELS[p]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              placeholder="Brief summary of issue or request"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <Text style={styles.counter}>{title.length}/200</Text>

            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={5000}
              multiline
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue, request, or feedback details..."
              placeholderTextColor="#94A3B8"
              textAlignVertical="top"
            />
            <Text style={styles.counter}>{description.length}/5000</Text>

            <Pressable
              style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
              onPress={submit}
              disabled={!canSubmit}
            >
              <Text style={styles.submitText}>
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Previous Submissions</Text>
            {history.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  No feedback submitted yet from this branch.
                </Text>
              </View>
            ) : (
              history.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.badge}>{TYPE_LABELS[item.type]}</Text>
                    <Text style={styles.badge}>
                      {PRIORITY_LABELS[item.priority]}
                    </Text>
                    <Text style={styles.badge}>
                      {STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historyDesc}>{item.description}</Text>
                  <Text style={styles.historyDate}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
              ))
            )}
          </View>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  label: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  chipActive: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  chipText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#0F172A" },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    color: "#0F172A",
    fontWeight: "600",
    backgroundColor: "#FFFFFF",
  },
  textArea: { minHeight: 120, paddingTop: 10, marginBottom: 2 },
  counter: {
    alignSelf: "flex-end",
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
  },
  submitBtn: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  submitText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
  emptyWrap: { paddingVertical: 14, alignItems: "center" },
  emptyText: { color: "#64748B", fontWeight: "600", textAlign: "center" },
  historyCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginBottom: 8,
  },
  historyTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  historyTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  historyDesc: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  historyDate: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },
});
