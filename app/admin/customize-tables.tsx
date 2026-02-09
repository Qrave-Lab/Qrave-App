/**
 * Admin screen for customizing and managing restaurant tables.
 *
 * Displays a floor overview, table metrics, and allows filtering, searching, and sorting of tables.
 * Supports actions such as moving, merging, printing bills, and marking tables as paid or free.
 * Includes modals for merging and printing bills, and an activity feed for kitchen and service requests.
 *
 * Features:
 * - Fetches table data from the API and fills in missing tables with placeholders.
 * - Allows filtering tables by status (all, occupied, free, bill requested).
 * - Supports searching tables by number or ID.
 * - Provides sorting options: by table number, bill value, or time occupied.
 * - Table actions menu for each occupied table (move, merge, print, mark paid, free).
 * - Merge modal to combine bills and guests from two tables.
 * - Print modal to export a table's bill as CSV via the device's share dialog.
 * - Activity feed with tabs for kitchen and service requests, including accept/reject actions.
 *
 * @component
 * @returns {JSX.Element} The admin customize tables screen.
 */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  Share,
  RefreshControl,
} from "react-native";
import { ThemedText, type ThemedTextProps } from "../../components/themed-text";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { AdminColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";

type Table = {
  id: string;
  number?: number | string;
  name?: string;
  isActive?: boolean;
  items: number;
  total: string;
  status: string;
  time?: string;
  flag?: "bill" | "long" | string;
};
type Activity = {
  id: string;
  table: string;
  title: string;
  note: string;
  status: string;
  channel: "kitchen" | "service";
  orderId?: string;
  serviceId?: string;
};

type ActiveOrderItem = {
  menu_item_id: string;
  variant_id: string;
  quantity: number;
  price: number;
  menu_item_name: string;
  variant_label: string | null;
};

type ActiveOrder = {
  id?: string;
  order_id?: string;
  status: string;
  created_at: string;
  session_id: string;
  table_id: string;
  table_number: number;
  items: ActiveOrderItem[];
};

type ActiveOrdersResponse = {
  orders: ActiveOrder[];
};

type ServiceCallType = "waiter" | "water" | "help";
type ServiceCallStatus = "open" | "attending" | "done";

type ServiceCallAPI = {
  id: string;
  table_id: string;
  table_number: number;
  session_id: string;
  type: ServiceCallType;
  status: ServiceCallStatus;
  created_at: string;
};

const AdminText = ({
  lightColor = AdminColors.text,
  darkColor = AdminColors.text,
  ...rest
}: ThemedTextProps) => (
  <ThemedText lightColor={lightColor} darkColor={darkColor} {...rest} />
);

const SAMPLE_TABLES: Table[] = [
  { id: "T1", items: 5, total: "Rs 1420", status: "occupied", time: "38m" },
  { id: "T2", items: 0, total: "-", status: "free" },
  {
    id: "T3",
    items: 3,
    total: "Rs 760",
    status: "occupied",
    time: "1h 23m",
    flag: "bill",
  },
  {
    id: "T4",
    items: 8,
    total: "Rs 2100",
    status: "occupied",
    time: "2h 3m",
    flag: "long",
  },
  { id: "T5", items: 0, total: "-", status: "free" },
  { id: "T6", items: 0, total: "-", status: "free" },
];

export default function CustomizeTables() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"number" | "value" | "time">("number");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveSource, setMoveSource] = useState<string | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printSource, setPrintSource] = useState<string | null>(null);
  const [tablesData, setTablesData] = useState<Table[]>(SAMPLE_TABLES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const normalizeTables = useCallback(
    (res: any[]) =>
      (res || [])
        .filter(
          (t: any) =>
            !(
              t?.is_archived === true ||
              t?.archived === true ||
              t?.is_deleted === true ||
              t?.deleted === true ||
              t?.status === "archived" ||
              t?.status === "deleted"
            ),
        )
        .map((t: any) => {
          const tableNumber =
            t.table_number ||
            t.number ||
            t.tableNumber ||
            t.name ||
            t.id ||
            t.tableID;
          const isActive =
            t.is_enabled !== undefined
              ? t.is_enabled
              : t.status === "occupied" ||
                t.occupied === true ||
                t.active === true;
          return {
            id: t.id || t.tableID || t.number || t.name,
            number: tableNumber,
            isActive,
            items: t.items ?? 0,
            total: t.total ? `Rs ${t.total}` : "-",
            status: t.status || (t.occupied ? "occupied" : "free"),
            time: t.time,
            flag: t.flag,
          };
        }),
    [],
  );

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/admin/tables");
      const tableObjs = normalizeTables(res);
      setTablesData(tableObjs);
    } catch (e: any) {
      setError(e?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, [normalizeTables]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityTab, setActivityTab] = useState<"kitchen" | "service">(
    "kitchen",
  );
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCallAPI[]>([]);
  const [todaySales, setTodaySales] = useState<number>(0);
  const [occupiedCount, setOccupiedCount] = useState<number>(0);
  const [totalTables, setTotalTables] = useState<number>(0);

  const parseTotal = (total: string) => {
    if (!total) return 0;
    const num = total.replace(/[^0-9]/g, "");
    return parseInt(num || "0", 10);
  };

  const parseTimeMinutes = (timev: string | undefined) => {
    if (!timev) return 0;
    // examples: "1h 23m", "38m", "2h 3m"
    const hMatch = timev.match(/(\d+)h/);
    const mMatch = timev.match(/(\d+)m/);
    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    const m = mMatch ? parseInt(mMatch[1], 10) : 0;
    return h * 60 + m;
  };

  const tables = useMemo(() => {
    const filtered = tablesData
      .filter((t) => {
        if (filter === "occupied") return t.status === "occupied";
        if (filter === "free") return t.status === "free";
        return true;
      })
      .filter((t) => {
        // Search by table number or id
        const searchStr = search.toLowerCase();
        return (
          (t.number && String(t.number).toLowerCase().includes(searchStr)) ||
          t.id.toLowerCase().includes(searchStr)
        );
      });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "number") {
        // Sort by table number (numeric)
        const na = Number(a.number) || 0;
        const nb = Number(b.number) || 0;
        return na - nb;
      }
      if (sortBy === "value") {
        return parseTotal(b.total) - parseTotal(a.total);
      }
      // time
      return parseTimeMinutes(b.time) - parseTimeMinutes(a.time);
    });

    return sorted;
  }, [filter, search, sortBy, tablesData]);

  const buildKitchenActivities = useCallback((ordersList: ActiveOrder[]) => {
    const next: Activity[] = [];
    for (const order of ordersList) {
      for (const item of order.items || []) {
        const variantSuffix = item.variant_label
          ? ` (${item.variant_label})`
          : "";
        const orderId = order.id || order.order_id;
        if (!orderId) continue;
        next.push({
          id: `${orderId}-${item.menu_item_id}-${item.variant_id}`,
          table: `T${order.table_number}`,
          title: `${item.menu_item_name}${variantSuffix}`,
          note: `Qty: ${item.quantity}`,
          status: order.status || "pending",
          channel: "kitchen",
          orderId: String(orderId),
        });
      }
    }
    return next;
  }, []);

  const buildServiceActivities = useCallback(
    (calls: ServiceCallAPI[]): Activity[] => {
    return (calls || []).map((call) => ({
      id: call.id,
      table: `T${call.table_number}`,
      title: `${call.type} request`,
      note:
        call.status === "attending"
          ? "Staff attending..."
          : "Waiting for staff",
      status: call.status,
      channel: "service",
      serviceId: call.id,
    }));
  }, []);

  const formatApiError = useCallback((e: any, fallback: string) => {
    const status = e?.status ? ` (status ${e.status})` : "";
    const detail = e?.body?.message || e?.body?.error || e?.message;
    return detail ? `${fallback}${status}: ${detail}` : `${fallback}${status}`;
  }, []);

  const refreshActivities = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const [ordersRes, serviceRes, salesRes] = await Promise.allSettled([
        api.get("/api/admin/orders/active"),
        api.get("/api/admin/service-calls"),
        api.get("/api/admin/sales/today"),
      ]);

      const errors: string[] = [];

      const ordersList =
        ordersRes.status === "fulfilled"
          ? (ordersRes.value as ActiveOrdersResponse)?.orders || []
          : [];
      if (ordersRes.status === "rejected") {
        errors.push(formatApiError(ordersRes.reason, "Orders request failed"));
      }

      const serviceCallsList =
        serviceRes.status === "fulfilled"
          ? ((serviceRes.value as ServiceCallAPI[]) || [])
          : [];
      if (serviceRes.status === "rejected") {
        errors.push(
          formatApiError(serviceRes.reason, "Service calls request failed"),
        );
      }

      const salesTotal =
        salesRes.status === "fulfilled"
          ? (salesRes.value as { total?: number; totalv?: number })?.total ??
            (salesRes.value as { total?: number; totalv?: number })?.totalv
          : 0;
      if (salesRes.status === "rejected") {
        errors.push(formatApiError(salesRes.reason, "Sales request failed"));
      }

      setActiveOrders(ordersList);
      setServiceCalls(serviceCallsList);
      setTodaySales(typeof salesTotal === "number" ? salesTotal : 0);

      const kitchen = buildKitchenActivities(ordersList);
      const service = buildServiceActivities(serviceCallsList);
      setActivities([...kitchen, ...service]);

      if (errors.length > 0) {
        setActivityError(errors.join(" | "));
      } else {
        setActivityError(null);
      }
    } finally {
      setActivityLoading(false);
    }
  }, [buildKitchenActivities, buildServiceActivities, formatApiError]);

  const handleKitchenStatus = async (
    orderIdv: string | undefined,
    statusv: string,
  ) => {
    if (!orderIdv || !statusv) return;
    try {
      await api.patch(`/api/admin/orders/${orderIdv}/status`, {
        status: statusv,
      });
      await refreshActivities();
    } catch (e: any) {
      const status = e?.status ? ` (status ${e.status})` : "";
      const detail = e?.body?.message || e?.body?.error || e?.message;
      // eslint-disable-next-line no-console
      console.error("Failed to update order status", e);
      if (detail) {
        // eslint-disable-next-line no-alert
        alert(`Update failed${status}: ${detail}`);
      }
    }
  };

  const handleServiceStatus = async (
    serviceIdv: string | undefined,
    statusv: ServiceCallStatus,
  ) => {
    if (!serviceIdv || !statusv) return;
    try {
      await api.patch(`/api/admin/service-calls/${serviceIdv}`, {
        status: statusv,
      });
      await refreshActivities();
    } catch (e: any) {
      const status = e?.status ? ` (status ${e.status})` : "";
      const detail = e?.body?.message || e?.body?.error || e?.message;
      // eslint-disable-next-line no-console
      console.error("Failed to update service status", e);
      if (detail) {
        // eslint-disable-next-line no-alert
        alert(`Update failed${status}: ${detail}`);
      }
    }
  };

  const getTableNumber = (t: Table | undefined | null) => {
    if (!t) return undefined;
    const raw =
      (t as any).number ||
      (t as any).table_number ||
      (t as any).tableNumber ||
      (t as any).name ||
      (t as any).id;
    const num = Number(raw);
    if (!isNaN(num) && num > 0) return num;
    const fromId = String(raw || "").replace(/\\D/g, "");
    return fromId ? Number(fromId) : undefined;
  };

  const handleMoveTable = async (targetTableId: string) => {
    if (!moveSource) return;
    const sourceTable = tablesData.find((t) => t.id === moveSource);
    if (!sourceTable) return;
    const sourceNumber = getTableNumber(sourceTable);
    const sourceOrder = activeOrders.find(
      (o) => sourceNumber !== undefined && o.table_number === sourceNumber,
    );
    const sessionId = sourceOrder?.session_id;
    if (!sessionId) {
      setMoveError("No active session to move.");
      return;
    }

    setMoveLoading(true);
    setMoveError(null);
    try {
      await api.post("/api/admin/tables/move", {
        session_id: sessionId,
        target_table_id: targetTableId,
      });
      const res = await api.get("/api/admin/tables");
      setTablesData(normalizeTables(res));
      await refreshActivities();
      setMoveModalOpen(false);
      setMoveSource(null);
    } catch (e: any) {
      setMoveError(e?.message || "Failed to move table");
    } finally {
      setMoveLoading(false);
    }
  };

  const handleMergeTable = (targetTableId: string) => {
    if (!mergeSource) return;
    const sourceTable = tablesData.find((t) => t.id === mergeSource);
    const targetTable = tablesData.find((t) => t.id === targetTableId);
    if (!sourceTable || !targetTable) return;

    const sourceNumber = getTableNumber(sourceTable);
    const targetNumber = getTableNumber(targetTable);

    setTablesData((prev) =>
      prev.map((t) => {
        if (t.id === targetTableId) {
          const newTotal = parseTotal(t.total) + parseTotal(sourceTable.total);
          const newItems = (t.items || 0) + (sourceTable.items || 0);
          return {
            ...t,
            total: `Rs ${newTotal}`,
            items: newItems,
            status: "occupied",
            isActive: true,
            time: t.time || sourceTable.time,
            flag: t.flag ?? sourceTable.flag,
          };
        }
        if (t.id === mergeSource) {
          return {
            ...t,
            status: "free",
            isActive: false,
            total: "-",
            items: 0,
            time: undefined,
            flag: undefined,
          };
        }
        return t;
      }),
    );

    setActiveOrders((prevOrders) => {
      const nextOrders =
        sourceNumber !== undefined && targetNumber !== undefined
          ? prevOrders.map((o) =>
              o.table_number === sourceNumber
                ? { ...o, table_number: targetNumber, table_id: targetTableId }
                : o,
            )
          : prevOrders;
      setServiceCalls((prevCalls) => {
        const nextCalls =
          sourceNumber !== undefined && targetNumber !== undefined
            ? prevCalls.map((c) =>
                c.table_number === sourceNumber
                  ? {
                      ...c,
                      table_number: targetNumber,
                      table_id: targetTableId,
                    }
                  : c,
              )
            : prevCalls;
        setActivities([
          ...buildKitchenActivities(nextOrders),
          ...buildServiceActivities(nextCalls),
        ]);
        return nextCalls;
      });
      return nextOrders;
    });

    setMergeModalOpen(false);
    setMergeSource(null);
  };

  const handleMarkPaid = (tableId: string) => {
    setTablesData((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, flag: undefined } : t)),
    );
  };

  const handleFreeTable = (tableId: string) => {
    const tableToFree = tablesData.find((t) => t.id === tableId);
    const tableNumber = getTableNumber(tableToFree);
    setTablesData((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: "free",
              isActive: false,
              items: 0,
              total: "-",
              time: undefined,
              flag: undefined,
            }
          : t,
      ),
    );

    setActiveOrders((prevOrders) => {
      const nextOrders =
        tableNumber !== undefined
          ? prevOrders.filter((o) => o.table_number !== tableNumber)
          : prevOrders;
      setServiceCalls((prevCalls) => {
        const nextCalls =
          tableNumber !== undefined
            ? prevCalls.filter((c) => c.table_number !== tableNumber)
            : prevCalls;
        setActivities([
          ...buildKitchenActivities(nextOrders),
          ...buildServiceActivities(nextCalls),
        ]);
        return nextCalls;
      });
      return nextOrders;
    });
  };

  useEffect(() => {
    refreshActivities();
  }, [refreshActivities]);

  useEffect(() => {
    const uniqueTables = new Set(
      activeOrders
        .map((o) => o.table_number)
        .filter((n) => typeof n === "number"),
    );
    setOccupiedCount(uniqueTables.size);
    setTotalTables(tablesData.length);
  }, [activeOrders, tablesData]);

  const isKitchenVisible = (a: Activity) =>
    a.channel === "kitchen" &&
    a.status !== "served" &&
    a.status !== "cancelled";
  const isServiceVisible = (a: Activity) =>
    a.channel === "service" && a.status !== "done";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadTables(), refreshActivities()]);
    setRefreshing(false);
  }, [loadTables, refreshActivities]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: AdminColors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={AdminColors.primary}
        />
      }
    >
      {loading && (
        <View style={{ padding: 16 }}>
          <AdminText>Loading tables...</AdminText>
        </View>
      )}
      {error && (
        <View style={{ padding: 16 }}>
          <AdminText style={{ color: "red" }}>{error}</AdminText>
        </View>
      )}
      <View style={styles.headerRow}>
        <AdminText type="title">Floor Overview</AdminText>
        <View style={styles.headerRight}>
          <AdminText type="defaultSemiBold">
            Rs {todaySales.toLocaleString()}
          </AdminText>
          <AdminText>
            {occupiedCount} / {totalTables}
          </AdminText>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricPendingBg]}>
            <IconSymbol name="fork.knife" size={18} color="#374151" />
          </View>
          <AdminText type="defaultSemiBold">Pending</AdminText>
          <AdminText type="defaultSemiBold">Orders</AdminText>
          <AdminText type="title">
            {activeOrders.filter((o) => o.status === "pending").length}
          </AdminText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricBillBg]}>
            <IconSymbol name="doc.text" size={18} color="#1E3A8A" />
          </View>
          <AdminText type="defaultSemiBold">Bill Request</AdminText>
          <AdminText type="title">0</AdminText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricServiceBg]}>
            <IconSymbol name="bell.fill" size={18} color="#075985" />
          </View>
          <AdminText type="defaultSemiBold">Service Calls</AdminText>
          <AdminText type="title">
            {serviceCalls.filter((c) => c.status !== "done").length}
          </AdminText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricLongBg]}>
            <IconSymbol name="clock" size={18} color="#7F1D1D" />
          </View>
          <AdminText type="defaultSemiBold">Long Sitting</AdminText>
          <AdminText type="title">0</AdminText>
        </View>
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.filtersRow}>
          {[
            { key: "all", label: "All" },
            { key: "occupied", label: "Occupied" },
            { key: "free", label: "Free" },
            { key: "bill", label: "Bill Requested" },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterBtn,
                filter === f.key
                  ? styles.filterActive
                  : { backgroundColor: AdminColors.card },
              ]}
            >
              <Text
                style={
                  filter === f.key ? styles.filterTextActive : styles.filterText
                }
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            placeholder="Search table..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          <View style={{ position: "relative" }}>
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setSortMenuOpen((s) => !s)}
            >
              <Text>Sort by</Text>
            </TouchableOpacity>
            {sortMenuOpen ? (
              <View style={styles.sortMenu}>
                {[
                  { key: "number", label: "Sort by Number" },
                  { key: "value", label: "Sort by Value" },
                  { key: "time", label: "Sort by Time" },
                ].map((op) => (
                  <TouchableOpacity
                    key={op.key}
                    onPress={() => {
                      setSortBy(op.key as any);
                      setSortMenuOpen(false);
                    }}
                    style={styles.sortItem}
                  >
                    <Text
                      style={
                        sortBy === op.key ? { fontWeight: "700" } : undefined
                      }
                    >
                      {op.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <FlatList
        data={tables}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.tableCard,
              !item.isActive ? styles.tableFree : null,
              item.flag === "bill" ? styles.tableBill : null,
              item.flag === "long" ? styles.tableLong : null,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.optionsBtn,
                !item.isActive ? { opacity: 0.45 } : undefined,
              ]}
              onPress={() =>
                item.isActive &&
                setOpenMenuId(openMenuId === item.id ? null : item.id)
              }
              disabled={!item.isActive}
            >
              <Text style={{ fontSize: 18 }}>...</Text>
            </TouchableOpacity>
            {openMenuId === item.id && item.isActive ? (
              <View style={styles.optionsMenu}>
                {[
                  {
                    key: "move",
                    label: "Move Table",
                    icon: "arrow.right.arrow.left",
                  },
                  {
                    key: "merge",
                    label: "Merge Bill",
                    icon: "arrow.triangle.branch",
                  },
                  { key: "print", label: "Print Bill", icon: "doc.text" },
                  {
                    key: "paid",
                    label: "Mark Paid",
                    icon: "checkmark.circle",
                    tone: "success",
                  },
                  {
                    key: "free",
                    label: "Free Table",
                    icon: "square.and.arrow.up",
                  },
                ].map((op) => (
                  <TouchableOpacity
                    key={op.key}
                    onPress={() => {
                      setOpenMenuId(null);
                      if (op.key === "move") {
                        setMoveError(null);
                        setMoveSource(item.id);
                        setMoveModalOpen(true);
                        return;
                      }
                      if (op.key === "merge") {
                        setMergeSource(item.id);
                        setMergeModalOpen(true);
                        return;
                      }
                      if (op.key === "print") {
                        setPrintSource(item.id);
                        setPrintModalOpen(true);
                        return;
                      }
                      if (op.key === "paid") {
                        handleMarkPaid(item.id);
                        return;
                      }
                      if (op.key === "free") {
                        handleFreeTable(item.id);
                        return;
                      }
                    }}
                    style={styles.optionsItem}
                  >
                    <View style={styles.optionsItemRow}>
                      <IconSymbol
                        name={op.icon as any}
                        size={16}
                        color={
                          op.tone === "success" ? "#16a34a" : AdminColors.text
                        }
                      />
                      <Text
                        style={
                          op.tone === "success"
                            ? styles.optionsItemTextSuccess
                            : styles.optionsItemText
                        }
                      >
                        {op.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <View>
              <AdminText type="title">Table {item.number || item.id}</AdminText>
              <AdminText
                style={{
                  color: item.isActive ? "green" : "gray",
                  fontWeight: "bold",
                }}
              >
                {item.isActive ? "Active" : "Inactive"}
              </AdminText>
              {item.time ? <AdminText>{item.time}</AdminText> : null}
            </View>
            <View style={styles.tableStats}>
              <View style={styles.itemsBox}>
                <AdminText>ITEMS</AdminText>
                <AdminText type="defaultSemiBold">{item.items}</AdminText>
              </View>
              <AdminText type="defaultSemiBold">{item.total}</AdminText>
            </View>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 8 }} />}
      />

      {/* Merge modal */}
      <Modal
        visible={mergeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMergeModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AdminText type="title">Merge Bill</AdminText>
              <TouchableOpacity onPress={() => setMergeModalOpen(false)}>
                <Text style={{ fontSize: 18 }}>x</Text>
              </TouchableOpacity>
            </View>
            <AdminText style={{ marginBottom: 12 }}>
              {(() => {
                const src = tablesData.find((t) => t.id === mergeSource);
                const label = src
                  ? `T${src.number ?? getTableNumber(src) ?? src.id}`
                  : mergeSource;
                return `Merging ${label} into another session`;
              })()}
            </AdminText>

            <FlatList
              data={tablesData.filter(
                (t) => t.id !== mergeSource && t.status !== "free",
              )}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mergeRow}
                  onPress={() => handleMergeTable(item.id)}
                >
                  <View style={styles.tableThumbnail}>
                    <Text>{item.id}</Text>
                  </View>
                  <View style={styles.tableInfo}>
                    <Text style={styles.amountText}>{item.total} Bill</Text>
                    <Text style={styles.guestsText}>Guests: {item.items}</Text>
                  </View>
                  <Text style={{ fontSize: 18 }}></Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Move modal */}
      <Modal
        visible={moveModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMoveModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AdminText type="title">Move Table</AdminText>
              <TouchableOpacity onPress={() => setMoveModalOpen(false)}>
                <Text style={{ fontSize: 18 }}>x</Text>
              </TouchableOpacity>
            </View>
            <AdminText style={{ marginBottom: 12 }}>
              {(() => {
                const src = tablesData.find((t) => t.id === moveSource);
                const label = src
                  ? `T${src.number ?? getTableNumber(src) ?? src.id}`
                  : moveSource;
                return `Moving ${label} to another table`;
              })()}
            </AdminText>
            {moveError ? (
              <AdminText style={{ color: "red", marginBottom: 8 }}>
                {moveError}
              </AdminText>
            ) : null}

            <FlatList
              data={tablesData.filter(
                (t) => t.id !== moveSource && t.status === "free",
              )}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mergeRow}
                  onPress={() => handleMoveTable(item.id)}
                  disabled={moveLoading}
                >
                  <View style={styles.tableThumbnail}>
                    <Text>{`T${item.number ?? getTableNumber(item) ?? item.id}`}</Text>
                  </View>
                  <View style={styles.tableInfo}>
                    <Text style={styles.amountText}>
                      {`T${item.number ?? getTableNumber(item) ?? item.id}`}
                    </Text>
                    <Text style={styles.guestsText}>Free</Text>
                  </View>
                  <Text style={{ fontSize: 18 }}></Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyMoveState}>
                  <AdminText>No empty tables available.</AdminText>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Print modal */}
      <Modal
        visible={printModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPrintModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AdminText type="title">Print Bill</AdminText>
              <TouchableOpacity onPress={() => setPrintModalOpen(false)}>
                <Text style={{ fontSize: 18 }}>x</Text>
              </TouchableOpacity>
            </View>
            {printSource
              ? (() => {
                  const table = tablesData.find((t) => t.id === printSource);
                  return (
                    <>
                      <AdminText style={{ marginBottom: 12 }}>
                        {(() => {
                          const label = table
                            ? `T${table.number ?? getTableNumber(table) ?? table.id}`
                            : printSource;
                          return `Bill for ${label}`;
                        })()}
                      </AdminText>
                      <View style={{ marginBottom: 12 }}>
                        <Text>Items: {table?.items ?? 0}</Text>
                        <Text>Total: {table?.total ?? "-"}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={async () => {
                          const t = tablesData.find(
                            (x) => x.id === printSource,
                          );
                          if (!t) return;
                          const csv = `Table,Items,Total\n${t.id},${t.items},${t.total}\n`;
                          try {
                            await Share.share({
                              title: `Bill_${t.id}.csv`,
                              message: csv,
                            });
                          } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error(e);
                          }
                          setPrintModalOpen(false);
                          setPrintSource(null);
                        }}
                      >
                        <Text style={{ fontWeight: "700" }}>Export Bill</Text>
                      </TouchableOpacity>
                    </>
                  );
                })()
              : null}
          </View>
        </View>
      </Modal>

      <View style={styles.section}>
        <AdminText type="subtitle">Activity Feed</AdminText>

        <View style={styles.activityTabsRow}>
          <TouchableOpacity
            style={[
              styles.activityTab,
              activityTab === "kitchen" ? styles.activityTabActive : null,
            ]}
            onPress={() => setActivityTab("kitchen")}
          >
            <Text
              style={
                activityTab === "kitchen"
                  ? styles.activityTabTextActive
                  : styles.activityTabText
              }
            >
              Kitchen
            </Text>
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>
                {activities.filter(isKitchenVisible).length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.activityTab,
              activityTab === "service" ? styles.activityTabActive : null,
            ]}
            onPress={() => setActivityTab("service")}
          >
            <Text
              style={
                activityTab === "service"
                  ? styles.activityTabTextActive
                  : styles.activityTabText
              }
            >
              Service
            </Text>
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>
                {activities.filter(isServiceVisible).length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {activityLoading ? (
          <AdminText>Loading activity...</AdminText>
        ) : activityError ? (
          <AdminText style={{ color: "red" }}>{activityError}</AdminText>
        ) : (
          activities
            .filter((a) =>
              activityTab === "kitchen"
                ? isKitchenVisible(a)
                : isServiceVisible(a),
            )
            .map((a) => (
              <View key={a.id} style={styles.activityCard}>
                <View style={styles.activityLeft}>
                  <View style={styles.tableBadge}>
                    <AdminText>{a.table}</AdminText>
                  </View>
                  <View style={{ marginLeft: 8 }}>
                    <AdminText type="defaultSemiBold">{a.title}</AdminText>
                    <AdminText>{a.note}</AdminText>
                  </View>
                </View>
                <View style={styles.activityActions}>
                  {a.channel === "kitchen" ? (
                    <>
                      {a.status === "pending" ? (
                        <>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() =>
                              handleKitchenStatus(a.orderId, "accepted")
                            }
                          >
                            <Text style={{ color: "#0F766E" }}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() =>
                              handleKitchenStatus(a.orderId, "cancelled")
                            }
                          >
                            <Text style={{ color: "#991B1B" }}>Reject</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() =>
                            handleKitchenStatus(a.orderId, "served")
                          }
                        >
                          <Text style={{ color: "#0F766E" }}>Mark Served</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      {a.status === "open" ? (
                        <>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() =>
                              handleServiceStatus(a.serviceId, "attending")
                            }
                          >
                            <Text style={{ color: "#0F766E" }}>Attend</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() =>
                              handleServiceStatus(a.serviceId, "done")
                            }
                          >
                            <Text style={{ color: "#991B1B" }}>Done</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() =>
                            handleServiceStatus(a.serviceId, "done")
                          }
                        >
                          <Text style={{ color: "#0F766E" }}>
                            Mark Resolved
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    paddingBottom: 32,
    backgroundColor: AdminColors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerRight: { alignItems: "flex-end" },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: AdminColors.card,
    alignItems: "center",
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  metricPendingBg: { backgroundColor: "#F8FAFC" },
  metricBillBg: { backgroundColor: "#EEF6FF" },
  metricServiceBg: { backgroundColor: "#EFF6FF" },
  metricLongBg: { backgroundColor: "#FFF5F6" },
  controlsRow: { marginBottom: 12 },
  filtersRow: { flexDirection: "row", marginBottom: 8 },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: AdminColors.secondary,
  },
  filterActive: { backgroundColor: AdminColors.primary },
  filterText: { color: AdminColors.text },
  filterTextActive: { color: AdminColors.card, fontWeight: "700" },
  searchInput: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: AdminColors.card,
    borderWidth: 1,
    borderColor: "#eee",
  },
  tableCard: {
    width: "48%",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
    position: "relative",
  },
  tableFree: {
    opacity: 0.45,
    backgroundColor: "#FBFBFD",
    borderColor: "#F1F5F9",
  },
  tableBill: {
    borderColor: "#C7E9FF",
    backgroundColor: "#F0FAFF",
  },
  tableLong: {
    borderColor: "#FECACA",
    backgroundColor: "#FFF5F5",
  },

  tableStats: { marginTop: 8, alignItems: "flex-end" },
  itemsBox: {
    backgroundColor: "#F3F4F6",
    padding: 6,
    borderRadius: 8,
    marginBottom: 6,
    alignItems: "center",
  },
  section: { marginTop: 12 },
  activityCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: AdminColors.card,
    marginTop: 8,
  },
  activityLeft: { flexDirection: "row", alignItems: "center" },
  tableBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  activityActions: { flexDirection: "row" },
  acceptBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    marginRight: 8,
  },
  rejectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
  },
  optionsBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 20,
    padding: 6,
    borderRadius: 8,
  },
  optionsMenu: {
    position: "absolute",
    top: 40,
    right: 8,
    width: 160,
    backgroundColor: AdminColors.card,
    borderRadius: 10,
    paddingVertical: 6,
    zIndex: 30,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  optionsItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionsItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionsItemText: {
    color: AdminColors.text,
    fontWeight: "600",
  },
  optionsItemTextSuccess: {
    color: "#16a34a",
    fontWeight: "700",
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: AdminColors.card,
    marginLeft: 8,
  },
  sortMenu: {
    position: "absolute",
    top: 44,
    right: 0,
    backgroundColor: AdminColors.card,
    borderRadius: 8,
    paddingVertical: 6,
    width: 160,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 16,
  },
  sortItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: AdminColors.card,
    borderRadius: 12,
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  mergeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: AdminColors.background,
    marginBottom: 8,
  },
  emptyMoveState: {
    paddingVertical: 16,
    alignItems: "center",
  },
  tableThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tableInfo: { flex: 1 },
  amountText: { fontWeight: "700" },
  guestsText: { color: "#6B7280", marginTop: 2 },
  exportBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: AdminColors.primary,
  },
  activityTabsRow: { flexDirection: "row", marginVertical: 12 },
  activityTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: AdminColors.background,
    marginRight: 8,
  },
  activityTabActive: { backgroundColor: AdminColors.card },
  activityTabText: { color: "#6B7280", marginRight: 8 },
  activityTabTextActive: {
    color: "#111827",
    marginRight: 8,
    fontWeight: "700",
  },
  activityBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityBadgeText: { fontSize: 12, color: "#374151" },
});
