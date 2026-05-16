import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminColors } from "../../constants/theme";
import apiClient from "../../lib/apiClient";

type BillingStatus = {
  provider?: string;
  plan?: string;
  status?: string;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  last_payment_at?: string | null;
  is_access_allowed?: boolean;
  access_reason?: string;
  days_left?: number;
};

const PLAN_OPTIONS = [
  { id: "monthly_499", label: "Monthly", amount: "Rs 499" },
  { id: "yearly_5500", label: "Yearly", amount: "Rs 5,500" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const asMessage = (err: any, fallback: string) => {
  if (typeof err?.body === "string" && err.body.trim()) return err.body.trim();
  if (typeof err?.body?.message === "string") return err.body.message;
  if (typeof err?.message === "string") return err.message;
  return fallback;
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 390;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [role, setRole] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("monthly_499");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error" | "">("");

  const setError = (message: string) => {
    setNoticeType("error");
    setNotice(message);
  };

  const setSuccess = (message: string) => {
    setNoticeType("success");
    setNotice(message);
  };

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statusRes, meRes] = await Promise.allSettled([
        apiClient.get("/api/admin/billing/status"),
        apiClient.get("/api/admin/me"),
      ]);

      if (statusRes.status === "fulfilled") {
        const status = (statusRes.value || {}) as BillingStatus;
        setBilling(status);
        setSelectedPlan(
          status?.plan === "yearly_5500" ? "yearly_5500" : "monthly_499",
        );
      } else {
        setBilling(null);
        setError(asMessage(statusRes.reason, "Unable to load billing status."));
      }

      if (meRes.status === "fulfilled") {
        setRole(String(meRes.value?.role || "").toLowerCase());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const statusText = useMemo(() => {
    const raw = String(billing?.status || "trialing").toLowerCase();
    const hasPaidCycle =
      Boolean(billing?.last_payment_at) || Boolean(billing?.current_period_end);
    const normalized = raw === "trialing" && hasPaidCycle ? "active" : raw;
    const days = billing?.days_left ?? 0;
    if (normalized === "trialing")
      return `Trial (${days} day${days === 1 ? "" : "s"} left)`;
    if (normalized === "active") return "Active";
    if (normalized === "past_due")
      return `Past Due (${days} day${days === 1 ? "" : "s"} grace)`;
    if (normalized === "cancelled" || normalized === "canceled")
      return "Cancelled";
    if (normalized === "expired") return "Expired";
    return normalized.toUpperCase();
  }, [billing]);

  const isInactive = useMemo(() => {
    const raw = String(billing?.status || "").toLowerCase();
    const hasPaidCycle =
      Boolean(billing?.last_payment_at) || Boolean(billing?.current_period_end);
    const normalized = raw === "trialing" && hasPaidCycle ? "active" : raw;
    return (
      normalized === "cancelled" ||
      normalized === "canceled" ||
      normalized === "expired"
    );
  }, [billing]);

  const startPayment = useCallback(
    async (mode: "subscribe" | "reactivate") => {
      const label = mode === "reactivate" ? "reactivate" : "subscribe";
      setBusyAction(label);
      setNotice("");
      try {
        const body = { plan: selectedPlan };
        const res: any = await apiClient.post(
          "/api/admin/billing/mandate-link",
          body,
        );
        const url = String(res?.short_url || "").trim();
        if (!url) {
          setError("Mandate link was not returned by backend.");
          return;
        }
        await Linking.openURL(url);
        setSuccess(
          "Payment page opened. Complete payment and tap Sync Status.",
        );
      } catch (err: any) {
        setError(asMessage(err, "Failed to start payment flow."));
      } finally {
        setBusyAction("");
      }
    },
    [selectedPlan],
  );

  const syncStatus = useCallback(async () => {
    setBusyAction("sync");
    setNotice("");
    try {
      await apiClient.post("/api/admin/billing/sync", {});
      await loadData(true);
      setSuccess("Billing status synced.");
    } catch (err: any) {
      setError(asMessage(err, "Sync failed. Try again in a few seconds."));
    } finally {
      setBusyAction("");
    }
  }, [loadData]);

  const cancelSubscription = useCallback(async () => {
    if (role !== "owner") {
      setError("Only owner can cancel subscription.");
      return;
    }
    setBusyAction("cancel");
    setNotice("");
    const attempts: { method: "delete" | "post"; path: string }[] = [
      { method: "delete", path: "/api/admin/billing/subscription" },
      { method: "delete", path: "/api/admin/billing/subscription/cancel" },
      { method: "delete", path: "/api/admin/billing/cancel" },
      { method: "post", path: "/api/admin/billing/subscription/cancel" },
      { method: "post", path: "/api/admin/billing/cancel" },
    ];

    try {
      for (const attempt of attempts) {
        try {
          if (attempt.method === "delete") {
            await apiClient.delete(attempt.path);
          } else {
            await apiClient.post(attempt.path, {});
          }
          setSuccess("Subscription cancelled.");
          await loadData(true);
          return;
        } catch (err: any) {
          if (err?.status === 404) continue;
          throw err;
        }
      }
      setError("Cancel route not available on this backend build.");
    } catch (err: any) {
      setError(asMessage(err, "Could not cancel subscription."));
    } finally {
      setBusyAction("");
    }
  }, [loadData, role]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const currentPlanText = useMemo(() => {
    const plan = String(
      billing?.plan || selectedPlan || "monthly_499",
    ).toLowerCase();
    if (plan === "yearly_5500") return "Yearly \u20B95,500";
    if (plan === "monthly_499") return "Monthly \u20B9499";
    return plan.replace(/_/g, " ").toUpperCase();
  }, [billing?.plan, selectedPlan]);

  const statusHeadline = useMemo(() => {
    const s = statusText.toLowerCase();
    const periodicity = currentPlanText.toLowerCase().includes("yearly")
      ? "YEARLY"
      : "MONTHLY";
    if (s.includes("active")) return `ACTIVE \u2022 ${periodicity}`;
    if (s.includes("trial")) return `TRIAL \u2022 ${periodicity}`;
    if (s.includes("past due")) return `PAST DUE \u2022 ${periodicity}`;
    if (s.includes("cancel")) return `CANCELLED \u2022 ${periodicity}`;
    if (s.includes("expired")) return `EXPIRED \u2022 ${periodicity}`;
    return `${statusText.toUpperCase()} \u2022 ${periodicity}`;
  }, [currentPlanText, statusText]);

  return (
    <SafeAreaView style={styles.safe}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={AdminColors.primary} />
          <Text style={styles.loadingText}>Loading billing...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={AdminColors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.replace("/admin/profile")}
            style={styles.backRow}
          >
            <MaterialIcons name="arrow-back" size={20} color="#475569" />
            <Text style={styles.backRowText}>Back to Settings</Text>
          </Pressable>

          <View style={styles.shell}>
            <View style={styles.shellHead}>
              <View style={styles.shellHeadRow}>
                <MaterialIcons name="credit-card" size={22} color="#0F172A" />
                <Text style={styles.shellTitle}>Manage Subscription</Text>
              </View>
              <Text style={styles.shellSub}>
                Includes a 7-day free trial. Menu access is blocked when
                trial/subscription expires.
              </Text>
            </View>

            <View style={styles.statGrid}>
              <View
                style={[styles.statCard, isNarrow && styles.statCardNarrow]}
              >
                <Text style={styles.statLabel}>Status</Text>
                <Text style={styles.statValue}>{statusHeadline}</Text>
              </View>
              <View
                style={[styles.statCard, isNarrow && styles.statCardNarrow]}
              >
                <Text style={styles.statLabel}>Current Plan</Text>
                <Text style={styles.statValue}>{currentPlanText}</Text>
              </View>
              <View
                style={[styles.statCard, isNarrow && styles.statCardNarrow]}
              >
                <Text style={styles.statLabel}>Last Payment</Text>
                <Text style={styles.statValue}>
                  {formatDate(billing?.last_payment_at)}
                </Text>
              </View>
              <View
                style={[styles.statCard, isNarrow && styles.statCardNarrow]}
              >
                <Text style={styles.statLabel}>Next Due Date</Text>
                <Text style={styles.statValue}>
                  {formatDate(
                    billing?.current_period_end || billing?.trial_ends_at,
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.billingBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.billingLabel}>Manage Billing</Text>
                <Text style={styles.billingHint}>
                  Cancel anytime. If payment fails without cancellation, a 3-day
                  grace period is applied.
                </Text>
              </View>
              <Pressable
                style={[
                  styles.cancelBtn,
                  isNarrow && styles.cancelBtnNarrow,
                  (busyAction === "cancel" || role !== "owner") &&
                    styles.disabledBtn,
                ]}
                onPress={cancelSubscription}
                disabled={busyAction === "cancel" || role !== "owner"}
              >
                {busyAction === "cancel" ? (
                  <ActivityIndicator color="#DC2626" />
                ) : (
                  <Text style={styles.cancelText}>Cancel Subscription</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.planRow}>
              {PLAN_OPTIONS.map((plan) => {
                const active = selectedPlan === plan.id;
                return (
                  <Pressable
                    key={plan.id}
                    style={[styles.planPill, active && styles.planPillActive]}
                    onPress={() => setSelectedPlan(plan.id)}
                  >
                    <Text
                      style={[
                        styles.planPillText,
                        active && styles.planPillTextActive,
                      ]}
                    >
                      {plan.label} ({plan.amount})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={[styles.actionRow, isNarrow && styles.actionRowNarrow]}
            >
              <Pressable
                style={[styles.manageBtn, isNarrow && styles.fullWidthBtn]}
                onPress={() =>
                  startPayment(isInactive ? "reactivate" : "subscribe")
                }
                disabled={
                  busyAction === "subscribe" || busyAction === "reactivate"
                }
              >
                {busyAction === "subscribe" || busyAction === "reactivate" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.manageBtnText}>
                    {isInactive ? "Reactivate Subscription" : "Manage Billing"}
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.syncBtn, isNarrow && styles.fullWidthBtn]}
                onPress={syncStatus}
                disabled={busyAction === "sync"}
              >
                {busyAction === "sync" ? (
                  <ActivityIndicator color="#334155" />
                ) : (
                  <Text style={styles.syncBtnText}>Sync Status</Text>
                )}
              </Pressable>
            </View>

            {notice ? (
              <View
                style={[
                  styles.notice,
                  noticeType === "error"
                    ? styles.noticeError
                    : styles.noticeSuccess,
                ]}
              >
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#6B7280",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 12,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  backRowText: {
    color: "#334155",
    fontSize: 18,
    fontWeight: "700",
  },
  shell: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    overflow: "hidden",
  },
  shellHead: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#D6DEFF",
    backgroundColor: "#F8FAFF",
  },
  shellHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shellTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  shellSub: {
    marginTop: 8,
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "500",
  },
  statGrid: {
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5DEE9",
    backgroundColor: "#FFFFFF",
    padding: 12,
    justifyContent: "center",
  },
  statCardNarrow: {
    minHeight: 88,
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  statValue: {
    color: "#0B1B3B",
    fontSize: 16,
    fontWeight: "900",
  },
  billingBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D5DEE9",
    backgroundColor: "#F8FAFC",
    padding: 12,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  billingLabel: {
    color: "#57708E",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.8,
  },
  billingHint: {
    color: "#5F738A",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 17,
  },
  cancelBtn: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    alignSelf: "flex-start",
  },
  cancelBtnNarrow: {
    alignSelf: "stretch",
  },
  cancelText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "800",
  },
  planRow: {
    paddingHorizontal: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  planPill: {
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#D5DEE9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  planPillActive: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  planPillText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  planPillTextActive: {
    color: "#0F172A",
  },
  actionRow: {
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  actionRowNarrow: {
    flexDirection: "column",
  },
  fullWidthBtn: {
    width: "100%",
  },
  manageBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  manageBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  syncBtn: {
    minWidth: 112,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D5DEE9",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },
  notice: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
  },
  noticeError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
  },
  noticeSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
  },
  noticeText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 12,
  },
  disabledBtn: {
    opacity: 0.55,
  },
});
