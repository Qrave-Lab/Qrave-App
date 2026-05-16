import { MaterialIcons as MaterialIcons_ } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import iconPng from "../../assets/images/icon.png";
import AdminWavyHeader from "../../components/AdminWavyHeader";
import { AdminColors } from "../../constants/theme";
import apiClient from "../../lib/apiClient";
import { getStoredLogoVersion, withLogoVersion } from "../../lib/logoVersion";

const MaterialIcons = MaterialIcons_ as any;

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

// ── Analytics API ──────────────────────────────────────────────────────
async function analyticsRequest<T>(path: string): Promise<T> {
  try {
    return (await apiClient.get(path)) as T;
  } catch {
    return {} as T;
  }
}

const BUCKET_MAP: Record<TimeRange, Bucket> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  custom: "day",
};

const PAY_ICONS: Record<string, { icon: string; bg: string }> = {
  UPI: { icon: "qr-code-2", bg: "#EFF6FF" },
  CARD: { icon: "credit-card", bg: "#F5F3FF" },
  CASH: { icon: "attach-money", bg: "#ECFDF5" },
};

export default function SalesReports() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");

  // ── Live data state ────────────────────────────────────────────────
  const [salesPoints, setSalesPoints] = useState<SalesPoint[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMix[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<Insight | null>(null);
  const [todaySales, setTodaySales] = useState<number>(0);

  // ── Logo fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        if (raw) {
          const u = JSON.parse(raw);
          const rId = u?.restaurantId || u?.restaurant_id || u?.restaurant?.id;
          if (rId) {
            try {
              const version = await getStoredLogoVersion();
              const res = await fetch(
                `https://qrave-backend.onrender.com/public/restaurants/${rId}/logo`,
              );
              const data = await res.json();
              if (data?.logo_url) {
                setLogoUrl(withLogoVersion(data.logo_url, version) || "");
              }
            } catch {}
          }
        }
      } catch {}
    })();
  }, []);

  // ── Computed stats ─────────────────────────────────────────────────
  const computedStats = useMemo(() => {
    const totalRevenue = salesPoints.length
      ? salesPoints.reduce((sum, p) => sum + (p.sales || 0), 0)
      : todaySales;
    const totalOrders = transactions.length;
    const avgValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

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
      : ["\u2014"];

    let peakLabel = "\u2014";
    if (salesPoints.length) {
      const maxIdx = chartData.indexOf(Math.max(...chartData));
      peakLabel = labels[maxIdx] || "\u2014";
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

  // ── Underperforming items ──────────────────────────────────────────
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

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8CB46" />

      {/* ── WAVY HEADER ── */}
      <AdminWavyHeader height={160}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={() => router.replace("/admin/profile")}
            activeOpacity={0.8}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.profileImage} />
            ) : (
              <Image source={iconPng} style={styles.profileImage} />
            )}
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Sales</Text>
            <Text style={styles.headerSubtitle}>Financial Reports</Text>
          </View>

          <TouchableOpacity
            style={styles.exportBtnHeader}
            onPress={handleExportCSV}
          >
            <MaterialIcons name="file-download" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </AdminWavyHeader>

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
        showsVerticalScrollIndicator={false}
      >
        {/* ── TIME RANGE FILTERS ── */}
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
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── DATE PICKER ── */}
        {showDatePicker && timeRange === "custom" ? (
          <View style={styles.datePickerCard}>
            <Text
              style={[styles.dateLabel, { fontSize: 14, marginBottom: 10 }]}
            >
              Select Range
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={customDates.start}
                  onChangeText={(v) =>
                    setCustomDates((p) => ({ ...p, start: v }))
                  }
                  style={styles.dateInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>End Date</Text>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={customDates.end}
                  onChangeText={(v) =>
                    setCustomDates((p) => ({ ...p, end: v }))
                  }
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
              <Text style={styles.applyBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── LOADING / ERROR ── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AdminColors.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : error ? (
          <View
            style={[
              styles.card,
              { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
            ]}
          >
            <Text style={[styles.cardTitle, { color: "#B91C1C" }]}>Error</Text>
            <Text style={{ color: "#DC2626", fontSize: 13 }}>{error}</Text>
            <TouchableOpacity
              style={[styles.applyBtn, { marginTop: 12 }]}
              onPress={() => fetchData()}
            >
              <Text style={styles.applyBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── ANOMALY ALERT ── */}
        {computedStats.anomaly ? (
          <View
            style={[
              styles.card,
              { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                { color: "#92400E", fontSize: 15, marginBottom: 6 },
              ]}
            >
              Revenue Alert
            </Text>
            <Text style={{ color: "#B45309", fontSize: 13 }}>
              Revenue is {Math.abs(Math.round(computedStats.growth * 10) / 10)}%
              lower than the previous period. Check table turnover or
              operational delays.
            </Text>
          </View>
        ) : null}

        {!loading && (
          <>
            {/* ── KPI CARDS ── */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={styles.kpiLabel}>Total Revenue</Text>
                  <View
                    style={[
                      styles.growthBadge,
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
            </View>

            <View style={styles.kpiCardFull}>
              <Text style={styles.kpiLabel}>Avg Order Value</Text>
              <Text style={styles.kpiValue}>Rs {computedStats.avgValue}</Text>
              <Text style={styles.kpiSub}>Per order average</Text>
            </View>

            {/* ── REVENUE TREND CHART ── */}
            <View style={styles.card}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                  Revenue Trend
                </Text>
                <View style={styles.peakRow}>
                  <Text style={styles.peakText}>
                    Peak: {computedStats.peakHour}
                  </Text>
                </View>
              </View>

              <View style={styles.chartContainer}>
                {computedStats.chartData.map((v, i) => {
                  const height = (v / maxChart) * 120 + 12;
                  return (
                    <View
                      key={`${computedStats.labels[i]}-${i}`}
                      style={styles.chartCol}
                    >
                      <View style={[styles.chartBar, { height }]} />
                      <Text style={styles.chartLabel}>
                        {computedStats.labels.length <= 12
                          ? computedStats.labels[i]
                          : ""}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {insights?.forecast?.length ? (
                <Text style={styles.forecastText}>
                  Forecast:{" "}
                  {insights.forecast
                    .map(
                      (p: any) => `Rs ${Math.round(p.sales).toLocaleString()}`,
                    )
                    .join(" \u00B7 ")}
                </Text>
              ) : null}
            </View>

            {/* ── PAYMENT METHODS ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment Methods</Text>
              {paymentMethods.length > 0 ? (
                paymentMethods.map((pm) => {
                  const meta = PAY_ICONS[pm.method] || {
                    icon: "payments",
                    bg: "#F3F4F6",
                  };
                  return (
                    <View key={pm.method} style={styles.payCard}>
                      <View
                        style={[
                          styles.payIconBox,
                          { backgroundColor: meta.bg },
                        ]}
                      >
                        <MaterialIcons
                          name={meta.icon}
                          size={22}
                          color={pm.color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <Text style={styles.payMethodName}>{pm.method}</Text>
                          <Text style={styles.payMethodAmount}>
                            Rs {pm.amount.toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.payProgressBarBg}>
                          <View
                            style={[
                              styles.payProgressBarFill,
                              {
                                width: `${pm.percent}%`,
                                backgroundColor: pm.color,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.payMethodPercent}>
                          {Math.round(pm.percent)}% of total transaction volume
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No payment data available</Text>
              )}
            </View>

            {/* ── TOP PERFORMING ITEMS ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top Performing Items</Text>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderCell}>Item</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>
                  Sold
                </Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>
                  Revenue
                </Text>
              </View>
              {topItems.length > 0 ? (
                topItems.slice(0, 8).map((item) => (
                  <View key={item.name} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSold}>{item.quantity}</Text>
                    <Text style={styles.itemRevenue}>
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

            {/* ── NEEDS ATTENTION ── */}
            {underperformingItems.length > 0 && (
              <View style={styles.card}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                    Needs Attention
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#FEE2E2",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: "#DC2626",
                        fontSize: 10,
                        fontWeight: "700",
                      }}
                    >
                      Low Margin
                    </Text>
                  </View>
                </View>

                {underperformingItems.map((item) => (
                  <View key={item.name} style={styles.underRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.underName}>{item.name}</Text>
                      <Text style={styles.underReason}>{item.reason}</Text>
                    </View>
                    <TouchableOpacity style={styles.reviewBtn}>
                      <Text style={styles.reviewBtnText}>{item.action}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <Text
                  style={{
                    color: "#9CA3AF",
                    fontSize: 11,
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  Regularly prune these items to improve food costs.
                </Text>
              </View>
            )}

            {/* ── RECENT TRANSACTIONS ── */}
            <View style={styles.card}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                  Recent Transactions
                </Text>
                <Text
                  style={{ color: "#F59E0B", fontWeight: "700", fontSize: 12 }}
                >
                  View All
                </Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderCell}>ID</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>
                  Time
                </Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>
                  Table
                </Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>
                  Total
                </Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>
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
                    <Text
                      style={[styles.tableCellBold, { textAlign: "right" }]}
                    >
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
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  /* HEADER */
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: "hidden",
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(0,0,0,0.55)",
    fontWeight: "600",
    marginTop: 2,
  },
  exportBtnHeader: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* SCROLL BODY */
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  /* TIME RANGE */
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  rangeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rangeBtnActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  rangeText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 13,
    textTransform: "capitalize",
  },
  rangeTextActive: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },

  /* DATE PICKER */
  datePickerCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  dateLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 10,
    backgroundColor: "#F9FAFB",
  },
  applyBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  applyBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },

  /* METRICS */
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiCardFull: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  kpiLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  kpiSub: {
    color: "#9CA3AF",
    marginTop: 4,
    fontSize: 11,
  },
  growthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  growthText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* CARD */
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 14,
  },

  /* CHART */
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    height: 140,
    gap: 6,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
  },
  chartBar: {
    width: "70%",
    backgroundColor: "#FCD34D",
    borderRadius: 6,
    minHeight: 4,
  },
  chartLabel: {
    marginTop: 8,
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  peakRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  peakText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
  },
  forecastText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 11,
    fontStyle: "italic",
  },

  /* PAYMENT METHODS */
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 4,
  },
  payIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  payMethodName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  payMethodAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  payProgressBarBg: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    marginBottom: 6,
    overflow: "hidden",
  },
  payProgressBarFill: {
    height: "100%" as any,
    borderRadius: 3,
  },
  payMethodPercent: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  /* TOP ITEMS */
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemName: {
    fontWeight: "700",
    color: "#1F2937",
    fontSize: 14,
    flex: 1,
  },
  itemSold: {
    fontSize: 12,
    color: "#6B7280",
    marginRight: 12,
    fontWeight: "500",
  },
  itemRevenue: {
    fontWeight: "800",
    color: "#16A34A",
    fontSize: 14,
  },

  /* UNDERPERFORMING */
  underRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  underName: {
    fontWeight: "700",
    color: "#1F2937",
    fontSize: 14,
  },
  underReason: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
  },
  reviewBtn: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reviewBtnText: {
    color: "#92400E",
    fontWeight: "700",
    fontSize: 12,
  },

  /* TRANSACTIONS TABLE */
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#E5E7EB",
  },
  tableHeaderCell: {
    flex: 1,
    fontWeight: "800",
    color: "#6B7280",
    fontSize: 11,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  tableCellBold: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },

  /* LOADING / EMPTY */
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
});
