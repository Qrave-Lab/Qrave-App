import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  RefreshControl,
} from "react-native";
import { AdminColors } from "../../constants/theme";

type TimeRange = "daily" | "weekly" | "monthly" | "custom";

const stats = {
  daily: {
    revenue: 24500,
    orders: 42,
    avgValue: 583,
    growth: -12.5,
    chartData: [15, 30, 45, 80, 55, 60, 90],
    labels: ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"],
    peakHour: "8:00 PM",
    anomaly: true,
  },
  weekly: {
    revenue: 184500,
    orders: 310,
    avgValue: 595,
    growth: 4.2,
    chartData: [60, 55, 70, 80, 95, 85, 60],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    peakHour: "Friday 7:00 PM",
    anomaly: false,
  },
  monthly: {
    revenue: 845000,
    orders: 1250,
    avgValue: 676,
    growth: 8.1,
    chartData: [40, 45, 60, 75],
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    peakHour: "Week 3",
    anomaly: false,
  },
};

const paymentMethods = [
  { method: "UPI", percent: 65, amount: 15925, color: "#3B82F6" },
  { method: "Card", percent: 25, amount: 6125, color: "#8B5CF6" },
  { method: "Cash", percent: 10, amount: 2450, color: "#10B981" },
];

const topItems = [
  { name: "Chicken Biryani", sold: 45, revenue: 11250 },
  { name: "Butter Naan", sold: 120, revenue: 6000 },
];

const underperformingItems = [
  { name: "Lamb Stew", reason: "Low Sales", action: "Review" },
];

const recentTransactions = [
  { id: "TRX-998", time: "10:42 AM", table: "T4", total: 2100, method: "UPI" },
];

export default function SalesReports() {
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [refreshing, setRefreshing] = useState(false);

  const currentStats = stats[timeRange === "custom" ? "daily" : timeRange];
  const maxChart = Math.max(...currentStats.chartData, 1);

  const handleExportCSV = async () => {
    const meta = [
      `Report Generated: ${new Date().toLocaleString()}`,
      `Time Range: ${timeRange.toUpperCase()}`,
      customDates.start && customDates.end
        ? `Custom Range: ${customDates.start} to ${customDates.end}`
        : "",
      "",
    ].filter(Boolean);

    const headers = "Transaction ID,Time,Table,Total,Payment Method";
    const rows = recentTransactions.map(
      (t) => `${t.id},${t.time},${t.table},${t.total},${t.method}`,
    );
    const csv = [...meta, headers, ...rows].join("\n");

    await Share.share({
      title: "sales_report.csv",
      message: csv,
    });
  };

  const growthPill = useMemo(() => {
    const positive = currentStats.growth >= 0;
    return {
      text: `${Math.abs(currentStats.growth)}%`,
      bg: positive ? "#ECFDF5" : "#FFF1F2",
      color: positive ? "#16A34A" : "#E11D48",
    };
  }, [currentStats.growth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  }, []);

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
                    timeRange === range ? styles.rangeTextActive : styles.rangeText
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
                onChangeText={(v) => setCustomDates((p) => ({ ...p, start: v }))}
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
            onPress={() => setShowDatePicker(false)}
          >
            <Text style={styles.applyText}>Apply Filter</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {currentStats.anomaly ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Revenue Alert</Text>
          <Text style={styles.alertText}>
            Revenue is {Math.abs(currentStats.growth)}% lower than the previous
            period. Check table turnover or operational delays.
          </Text>
        </View>
      ) : null}

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Total Revenue</Text>
            <View style={[styles.growthPill, { backgroundColor: growthPill.bg }]}>
              <Text style={[styles.growthText, { color: growthPill.color }]}>
                {growthPill.text}
              </Text>
            </View>
          </View>
          <Text style={styles.kpiValue}>
            Rs {currentStats.revenue.toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>vs. previous period</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Orders</Text>
          <Text style={styles.kpiValue}>{currentStats.orders}</Text>
          <Text style={styles.kpiSub}>Volume trend stable</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Avg Order Value</Text>
          <Text style={styles.kpiValue}>Rs {currentStats.avgValue}</Text>
          <Text style={styles.kpiSub}>+ Rs 12 vs last week</Text>
        </View>
      </View>

      <View style={styles.chartRow}>
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Revenue Trend</Text>
            <View style={styles.peakBadge}>
              <Text style={styles.peakText}>Peak: {currentStats.peakHour}</Text>
            </View>
          </View>
          <View style={styles.chartBars}>
            {currentStats.chartData.map((v, i) => {
              const height = (v / maxChart) * 120 + 12;
              return (
                <View key={`${currentStats.labels[i]}-${i}`} style={styles.barWrap}>
                  <View style={[styles.bar, { height }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.chartLabels}>
            {currentStats.labels.map((label) => (
              <Text key={label} style={styles.chartLabel}>
                {label}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.chartTitle}>Payment Methods</Text>
          {paymentMethods.map((pm) => (
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
                    { width: `${pm.percent}%`, backgroundColor: pm.color },
                  ]}
                />
              </View>
              <Text style={styles.paymentHint}>{pm.percent}% of total</Text>
            </View>
          ))}
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
          {topItems.map((item) => (
            <View key={item.name} style={styles.tableRow}>
              <Text style={styles.tableCell}>{item.name}</Text>
              <Text style={[styles.tableCell, { textAlign: "right" }]}>
                {item.sold}
              </Text>
              <Text style={[styles.tableCellBold, { textAlign: "right" }]}>
                Rs {item.revenue.toLocaleString()}
              </Text>
            </View>
          ))}
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
          <Text style={styles.viewAll}>View All</Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>ID</Text>
          <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
            Time
          </Text>
          <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
            Table
          </Text>
          <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
            Total
          </Text>
          <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>
            Method
          </Text>
        </View>
        {recentTransactions.map((trx) => (
          <View key={trx.id} style={styles.tableRow}>
            <Text style={styles.tableCell}>{trx.id}</Text>
            <Text style={[styles.tableCell, { textAlign: "right" }]}>
              {trx.time}
            </Text>
            <Text style={[styles.tableCell, { textAlign: "right" }]}>
              {trx.table}
            </Text>
            <Text style={[styles.tableCellBold, { textAlign: "right" }]}>
              Rs {trx.total}
            </Text>
            <Text style={[styles.tableCell, { textAlign: "right" }]}>
              {trx.method}
            </Text>
          </View>
        ))}
      </View>
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
  rangeBtnActive: { backgroundColor: "#FFFFFF", shadowOpacity: 0.1, shadowRadius: 4 },
  rangeText: { color: "#6B7280", fontWeight: "700", textTransform: "uppercase", fontSize: 11 },
  rangeTextActive: { color: "#111827", fontWeight: "800", textTransform: "uppercase", fontSize: 11 },
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
  datePickerTitle: { fontWeight: "700", marginBottom: 10, color: AdminColors.text },
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
  kpiHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kpiLabel: { color: "#6B7280", fontWeight: "700" },
  kpiValue: { fontSize: 20, fontWeight: "800", color: AdminColors.text, marginTop: 6 },
  kpiSub: { color: "#9CA3AF", marginTop: 4, fontSize: 12 },
  growthPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  growthText: { fontWeight: "800", fontSize: 11 },
  chartRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  chartCard: {
    flexGrow: 1,
    minWidth: 260,
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chartTitle: { fontWeight: "800", color: AdminColors.text },
  peakBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  peakText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 140 },
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
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  paymentLabel: { fontWeight: "700", color: "#374151" },
  paymentAmount: { fontWeight: "700", color: AdminColors.text },
  progressTrack: { width: "100%", height: 8, backgroundColor: "#E5E7EB", borderRadius: 999 },
  progressFill: { height: 8, borderRadius: 999 },
  paymentHint: { textAlign: "right", fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  tablesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 16 },
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
  attentionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
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
  attentionHint: { textAlign: "center", color: "#9CA3AF", fontSize: 11, marginTop: 6 },
  tableTitle: { fontWeight: "800", color: AdminColors.text, marginBottom: 8 },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  tableHeaderText: { flex: 1, color: "#9CA3AF", fontSize: 11, fontWeight: "700" },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  tableCell: { flex: 1, color: "#374151" },
  tableCellBold: { flex: 1, color: "#059669", fontWeight: "800" },
  transactionsCard: {
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  transactionsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  viewAll: { color: "#2563EB", fontWeight: "700", fontSize: 12 },
});
