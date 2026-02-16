import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { AdminColors } from "../../constants/theme";
import apiClient from "../../lib/apiClient";

// ── Types ──────────────────────────────────────────────────────────────
type TimeRange = "daily" | "weekly" | "monthly" | "custom";
type Bucket = "day" | "week" | "month";

type SalesPoint = { t: string; sales: number };
type PaymentMix = {
  mode: string;
  method: string;
  amount: number;
  percent: number;
  color: string;
};
type TopItem = { name: string; quantity: number; revenue: number };
type Transaction = {
  payment_id: string;
  captured_at: string;
  table_number: number;
  items_count: number;
  amount: number;
  mode: string;
};
type Insight = { anomalies: any[]; forecast: any[] };

// ── Analytics API (same endpoints as the website dashboard) ────────────
async function analyticsRequest<T>(path: string): Promise<T> {
  // Try the analytics service first, fall back to main backend
  try {
    return (await apiClient.get(path)) as T;
  } catch {
    // If the main API doesn't have the route, return empty
    return {} as T;
  }
}

// Maps the UI time-range selector to the analytics API bucket param
const BUCKET_MAP: Record<TimeRange, Bucket> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  custom: "day",
};

export default function SalesReports() {
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Live data state ────────────────────────────────────────────────
  const [salesPoints, setSalesPoints] = useState<SalesPoint[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMix[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<Insight | null>(null);
  const [todaySales, setTodaySales] = useState<number>(0);

  // ── Computed stats ─────────────────────────────────────────────────
  const computedStats = useMemo(() => {
    const totalRevenue = salesPoints.length
      ? salesPoints.reduce((sum, p) => sum + (p.sales || 0), 0)
      : todaySales;
    const totalOrders = transactions.length;
    const avgValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Compute growth: compare first half vs second half of data
    let growth = 0;
    if (salesPoints.length >= 2) {
      const mid = Math.floor(salesPoints.length / 2);
      const firstHalf = salesPoints
        .slice(0, mid)
        .reduce((s, p) => s + p.sales, 0);
      const secondHalf = salesPoints
        .slice(mid)
        .reduce((s, p) => s + p.sales, 0);
      growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    }

    const chartData = salesPoints.length
      ? salesPoints.map((p) => p.sales)
      : [0];
    const labels = salesPoints.length
      ? salesPoints.map((p) => {
          const d = p.t || "";
          if (timeRange === "daily") return d.slice(11, 16) || d.slice(0, 10);
          if (timeRange === "weekly") {
            const day = new Date(d).toLocaleDateString("en-US", {
              weekday: "short",
            });
            return day || d.slice(0, 10);
          }
          return d.slice(0, 10);
        })
      : ["—"];

    // Find peak
    let peakLabel = "—";
    if (salesPoints.length) {
      const maxIdx = chartData.indexOf(Math.max(...chartData));
      peakLabel = labels[maxIdx] || "—";
    }

    const anomaly = (insights?.anomalies?.length ?? 0) > 0;

    return {
      revenue: totalRevenue,
      orders: totalOrders,
      avgValue,
      growth,
      chartData,
      labels,
      peakHour: peakLabel,
      anomaly,
    };
  }, [salesPoints, transactions, insights, todaySales, timeRange]);

  const maxChart = Math.max(...computedStats.chartData, 1);

  // ── Underperforming items (bottom sellers from topItems list) ───────
  const underperformingItems = useMemo(() => {
    if (topItems.length < 3) return [];
    const sorted = [...topItems].sort((a, b) => a.revenue - b.revenue);
    return sorted.slice(0, 2).map((it) => ({
      name: it.name,
      reason: "Low Sales",
      action: "Review",
    }));
  }, [topItems]);

  // ── Data fetching ──────────────────────────────────────────────────
  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      const bucket = BUCKET_MAP[timeRange];
      const dateQs =
        customDates.start && customDates.end
          ? `&start=${customDates.start}&end=${customDates.end}`
          : "";
      const dateSuffix =
        customDates.start && customDates.end
          ? `?start=${customDates.start}&end=${customDates.end}`
          : "";

      try {
        // Fetch from all endpoints in parallel
        const [salesRes, mixRes, topRes, txRes, insRes, todayRes] =
          await Promise.allSettled([
            analyticsRequest<any>(
              `/v1/sales/timeseries?bucket=${bucket}${dateQs}`,
            ),
            analyticsRequest<any>(`/v1/payment-mix${dateSuffix}`),
            analyticsRequest<any>(`/v1/top-items${dateSuffix}`),
            analyticsRequest<any>(`/v1/transactions${dateSuffix}`),
            analyticsRequest<any>(`/v1/insights?bucket=day${dateQs}`),
            apiClient.get("/api/admin/sales/today").catch(() => ({ total: 0 })),
          ]);

        // Extract fulfilled values, fallback to empty
        const salesData = salesRes.status === "fulfilled" ? salesRes.value : {};
        const mixData = mixRes.status === "fulfilled" ? mixRes.value : {};
        const topData = topRes.status === "fulfilled" ? topRes.value : {};
        const txData = txRes.status === "fulfilled" ? txRes.value : {};
        const insData = insRes.status === "fulfilled" ? insRes.value : {};
        const todayData =
          todayRes.status === "fulfilled" ? todayRes.value : { total: 0 };

        setSalesPoints(salesData?.points || []);
        setPaymentMethods(
          (mixData?.mix || []).map((m: any, i: number) => ({
            ...m,
            method: (m.mode || "Unknown").toUpperCase(),
            color: ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"][
              i % 5
            ],
          })),
        );
        setTopItems(topData?.items || []);
        setTransactions(txData?.transactions || []);
        setInsights({
          anomalies: insData?.anomalies || [],
          forecast: insData?.forecast || [],
        });
        setTodaySales((todayData as any)?.total || 0);
      } catch (e: any) {
        setError(e?.message || "Failed to load sales data");
      } finally {
        setLoading(false);
      }
    },
    [timeRange, customDates],
  );

  // Reload when bucket changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Export CSV ─────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    const meta = [
      `Report Generated: ${new Date().toLocaleString()}`,
      `Time Range: ${timeRange.toUpperCase()}`,
      customDates.start && customDates.end
        ? `Custom Range: ${customDates.start} to ${customDates.end}`
        : "",
      "",
    ].filter(Boolean);

    const headers = "Time,Table,Items,Amount,Payment Method";
    const rows = transactions.map(
      (t) =>
        `${String(t.captured_at || "")
          .replace("T", " ")
          .slice(
            0,
            16,
          )},T${t.table_number},${t.items_count},${t.amount},${(t.mode || "").toUpperCase()}`,
    );
    const csv = [...meta, headers, ...rows].join("\n");

    await Share.share({
      title: "sales_report.csv",
      message: csv,
    });
  };

  const growthPill = useMemo(() => {
    const positive = computedStats.growth >= 0;
    return {
      text: `${Math.abs(Math.round(computedStats.growth * 10) / 10)}%`,
      bg: positive ? "#ECFDF5" : "#FFF1F2",
      color: positive ? "#16A34A" : "#E11D48",
    };
  }, [computedStats.growth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  }, [fetchData]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={AdminColors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Financial Reports</Text>
          <Text style={styles.subtitle}>
            Sales performance - Verified Owner Access
          </Text>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.rangeRow}>
            {(["daily", "weekly", "monthly"] as const).map((range) => (
              <TouchableOpacity
                key={range}
                onPress={() => {
                  setTimeRange(range);
                  setShowDatePicker(false);
                }}
                style={[
                  styles.rangeBtn,
                  timeRange === range ? styles.rangeBtnActive : null,
                ]}
              >
                <Text
                  style={
                    timeRange === range
                      ? styles.rangeTextActive
                      : styles.rangeText
                  }
                >
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                setTimeRange("custom");
                setShowDatePicker((s) => !s);
              }}
              style={[
                styles.rangeBtn,
                timeRange === "custom" ? styles.rangeBtnActive : null,
              ]}
            >
              <Text
                style={
                  timeRange === "custom"
                    ? styles.rangeTextActive
                    : styles.rangeText
                }
              >
                custom
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && timeRange === "custom" ? (
        <View style={styles.datePickerCard}>
          <Text style={styles.datePickerTitle}>Select Range</Text>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TextInput
                placeholder="YYYY-MM-DD"
                value={customDates.start}
                onChangeText={(v) =>
                  setCustomDates((p) => ({ ...p, start: v }))
                }
                style={styles.dateInput}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TextInput
                placeholder="YYYY-MM-DD"
                value={customDates.end}
                onChangeText={(v) => setCustomDates((p) => ({ ...p, end: v }))}
                style={styles.dateInput}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              setShowDatePicker(false);
              fetchData();
            }}
          >
            <Text style={styles.applyText}>Apply Filter</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AdminColors.primary} />
          <Text style={styles.loadingText}>Loading analytics…</Text>
        </View>
      ) : error ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Error</Text>
          <Text style={styles.alertText}>{error}</Text>
          <TouchableOpacity style={styles.applyBtn} onPress={() => fetchData()}>
            <Text style={styles.applyText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {computedStats.anomaly ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Revenue Alert</Text>
          <Text style={styles.alertText}>
            Revenue is {Math.abs(Math.round(computedStats.growth * 10) / 10)}%
            lower than the previous period. Check table turnover or operational
            delays.
          </Text>
        </View>
      ) : null}

      {!loading && (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>Total Revenue</Text>
                <View
                  style={[
                    styles.growthPill,
                    { backgroundColor: growthPill.bg },
                  ]}
                >
                  <Text
                    style={[styles.growthText, { color: growthPill.color }]}
                  >
                    {growthPill.text}
                  </Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>
                Rs {computedStats.revenue.toLocaleString()}
              </Text>
              <Text style={styles.kpiSub}>vs. previous period</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Orders</Text>
              <Text style={styles.kpiValue}>{computedStats.orders}</Text>
              <Text style={styles.kpiSub}>
                {transactions.length} transactions
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Avg Order Value</Text>
              <Text style={styles.kpiValue}>Rs {computedStats.avgValue}</Text>
              <Text style={styles.kpiSub}>Per order average</Text>
            </View>
          </View>

          <View style={styles.chartRow}>
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Revenue Trend</Text>
                <View style={styles.peakBadge}>
                  <Text style={styles.peakText}>
                    Peak: {computedStats.peakHour}
                  </Text>
                </View>
              </View>
              <View style={styles.chartBars}>
                {computedStats.chartData.map((v, i) => {
                  const height = (v / maxChart) * 120 + 12;
                  return (
                    <View
                      key={`${computedStats.labels[i]}-${i}`}
                      style={styles.barWrap}
                    >
                      <View style={[styles.bar, { height }]} />
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartLabels}>
                {computedStats.chartData.length <= 12 ? (
                  computedStats.labels.map((label) => (
                    <Text key={label} style={styles.chartLabel}>
                      {label}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.chartLabel}>
                    {computedStats.labels.length} data points
                  </Text>
                )}
              </View>
              {insights?.forecast?.length ? (
                <Text style={styles.forecastText}>
                  Forecast:{" "}
                  {insights.forecast
                    .map(
                      (p: any) => `Rs ${Math.round(p.sales).toLocaleString()}`,
                    )
                    .join(" · ")}
                </Text>
              ) : null}
            </View>

            <View style={styles.paymentCard}>
              <Text style={styles.chartTitle}>Payment Methods</Text>
              {paymentMethods.length > 0 ? (
                paymentMethods.map((pm) => (
                  <View key={pm.method} style={{ marginBottom: 14 }}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>{pm.method}</Text>
                      <Text style={styles.paymentAmount}>
                        Rs {pm.amount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${pm.percent}%`,
                            backgroundColor: pm.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.paymentHint}>
                      {Math.round(pm.percent)}% of total
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No payment data available</Text>
              )}
            </View>
          </View>

          <View style={styles.tablesRow}>
            <View style={styles.tableCard}>
              <Text style={styles.tableTitle}>Top Performing Items</Text>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderText}>Item</Text>
                <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
                  Sold
                </Text>
                <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
                  Revenue
                </Text>
              </View>
              {topItems.length > 0 ? (
                topItems.slice(0, 8).map((item) => (
                  <View key={item.name} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{item.name}</Text>
                    <Text style={[styles.tableCell, { textAlign: "right" }]}>
                      {item.quantity}
                    </Text>
                    <Text
                      style={[styles.tableCellBold, { textAlign: "right" }]}
                    >
                      Rs {item.revenue.toLocaleString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  No sales data in this range
                </Text>
              )}
            </View>

            <View style={styles.attentionCard}>
              <View style={styles.attentionHeader}>
                <Text style={styles.tableTitle}>Needs Attention</Text>
                <Text style={styles.attentionTag}>Low Margin / Vol</Text>
              </View>
              {underperformingItems.map((item) => (
                <View key={item.name} style={styles.attentionRow}>
                  <View>
                    <Text style={styles.attentionItem}>{item.name}</Text>
                    <Text style={styles.attentionReason}>{item.reason}</Text>
                  </View>
                  <TouchableOpacity style={styles.attentionBtn}>
                    <Text style={styles.attentionBtnText}>{item.action}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={styles.attentionHint}>
                Regularly prune these items to improve food costs.
              </Text>
            </View>
          </View>

          <View style={styles.transactionsCard}>
            <View style={styles.transactionsHeader}>
              <Text style={styles.tableTitle}>Recent Transactions</Text>
              <Text style={styles.viewAll}>{transactions.length} total</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Time</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
                Table
              </Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
                Items
              </Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
                Total
              </Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
                Method
              </Text>
            </View>
            {transactions.length > 0 ? (
              transactions.slice(0, 12).map((trx) => (
                <View key={trx.payment_id} style={styles.tableRow}>
                  <Text style={styles.tableCell}>
                    {String(trx.captured_at || "")
                      .replace("T", " ")
                      .slice(0, 16)}
                  </Text>
                  <Text style={[styles.tableCell, { textAlign: "right" }]}>
                    T{trx.table_number}
                  </Text>
                  <Text style={[styles.tableCell, { textAlign: "right" }]}>
                    {trx.items_count}
                  </Text>
                  <Text style={[styles.tableCellBold, { textAlign: "right" }]}>
                    Rs {trx.amount?.toLocaleString()}
                  </Text>
                  <Text style={[styles.tableCell, { textAlign: "right" }]}>
                    {(trx.mode || "").toUpperCase()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No transactions found</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AdminColors.background },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  title: { fontSize: 20, fontWeight: "800", color: AdminColors.text },
  subtitle: { color: "#6B7280", marginTop: 4 },
  headerActions: { alignItems: "flex-end", marginTop: 12 },
  rangeRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    padding: 4,
    borderRadius: 10,
  },
  rangeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rangeBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  rangeText: {
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
    fontSize: 11,
  },
  rangeTextActive: {
    color: "#111827",
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 11,
  },
  exportBtn: {
    marginTop: 10,
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  exportText: { color: "#FFFFFF", fontWeight: "700" },
  datePickerCard: {
    backgroundColor: AdminColors.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  datePickerTitle: {
    fontWeight: "700",
    marginBottom: 10,
    color: AdminColors.text,
  },
  dateRow: { flexDirection: "row", alignItems: "center" },
  dateLabel: { color: "#6B7280", marginBottom: 6, fontSize: 12 },
  dateInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  applyBtn: {
    marginTop: 12,
    backgroundColor: "#059669",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  applyText: { color: "#FFFFFF", fontWeight: "700" },
  alertCard: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  alertTitle: { fontWeight: "800", color: "#92400E" },
  alertText: { color: "#B45309", marginTop: 4 },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  kpiCard: {
    flexGrow: 1,
    minWidth: 200,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  kpiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabel: { color: "#6B7280", fontWeight: "700" },
  kpiValue: {
    fontSize: 20,
    fontWeight: "800",
    color: AdminColors.text,
    marginTop: 6,
  },
  kpiSub: { color: "#9CA3AF", marginTop: 4, fontSize: 12 },
  growthPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  growthText: { fontWeight: "800", fontSize: 11 },
  chartRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  chartCard: {
    flexGrow: 1,
    minWidth: 260,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chartTitle: { fontWeight: "800", color: AdminColors.text },
  peakBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  peakText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 140,
  },
  barWrap: { flex: 1, justifyContent: "flex-end" },
  bar: { backgroundColor: "#111827", borderRadius: 6, opacity: 0.85 },
  chartLabels: { flexDirection: "row", marginTop: 8 },
  chartLabel: { flex: 1, textAlign: "center", fontSize: 10, color: "#9CA3AF" },
  paymentCard: {
    width: 280,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  paymentLabel: { fontWeight: "700", color: "#374151" },
  paymentAmount: { fontWeight: "700", color: AdminColors.text },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
  },
  progressFill: { height: 8, borderRadius: 999 },
  paymentHint: {
    textAlign: "right",
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 4,
  },
  tablesRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  tableCard: {
    flexGrow: 1,
    minWidth: 260,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  attentionCard: {
    width: 280,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  attentionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  attentionTag: {
    fontSize: 10,
    color: "#DC2626",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "700",
  },
  attentionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 8,
  },
  attentionItem: { fontWeight: "700", color: AdminColors.text },
  attentionReason: { color: "#EF4444", fontSize: 12, marginTop: 2 },
  attentionBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  attentionBtnText: { fontSize: 12, color: "#4B5563", fontWeight: "700" },
  attentionHint: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 6,
  },
  tableTitle: { fontWeight: "800", color: AdminColors.text, marginBottom: 8 },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableHeaderText: {
    flex: 1,
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableCell: { flex: 1, color: "#374151" },
  tableCellBold: { flex: 1, color: "#059669", fontWeight: "800" },
  transactionsCard: {
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  transactionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  viewAll: { color: "#2563EB", fontWeight: "700", fontSize: 12 },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  emptyText: {
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 16,
    fontSize: 13,
  },
  forecastText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 11,
    fontStyle: "italic",
  },
});
