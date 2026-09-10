/**
 * Waiter screen for managing the restaurant floor.
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
 * @returns {JSX.Element} The waiter floor screen.
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
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ThemedText, type ThemedTextProps } from "../../components/themed-text";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";
import WaiterWavyHeader from "../../components/WaiterWavyHeader";

type Table = {
  id: string;
  tableId?: string;
  number?: number | string;
  name?: string;
  isActive?: boolean;
  isEnabled?: boolean;
  items: number;
  total: string;
  status: string;
  time?: string;
  flag?: "bill" | "long" | string;
  mergedWith?: number[]; // table numbers this table is grouped with
  billGroupId?: string; // bill group UUID from backend
};

/** Maps a table number → its bill-group info (combined orders from all grouped tables). */
type BillGroupInfo = {
  groupId: string;
  linkedTableNumbers: number[]; // all table numbers in the group
  combinedItems: number;
  combinedTotal: number;
  allOrderIds: string[]; // every order id in the group
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

type ActiveSessionAPI = {
  session_id: string;
  table_id: string;
  table_number: number;
  started_at?: string;
  last_active_at?: string;
};

type ActiveSessionsResponse = {
  sessions: ActiveSessionAPI[];
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

const WaiterText = ({
  lightColor = WaiterColors.text,
  darkColor = WaiterColors.text,
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
  const router = useRouter();
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
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printSource, setPrintSource] = useState<string | null>(null);
  const [paidModalOpen, setPaidModalOpen] = useState(false);
  const [paidSource, setPaidSource] = useState<string | null>(null);
  const [paidLoading, setPaidLoading] = useState(false);
  const [freeLoading, setFreeLoading] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [billGroups, setBillGroups] = useState<Map<number, BillGroupInfo>>(
    new Map(),
  );
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
          const tableId = t.id || t.table_id || t.tableID;
          const isEnabled =
            t?.is_enabled !== false &&
            t?.is_enabled !== "false" &&
            t?.enabled !== false &&
            t?.enabled !== "false" &&
            t?.isDisabled !== true &&
            t?.disabled !== true &&
            t?.status !== "disabled";

          return {
            id: String(tableId || tableNumber || t.name || t.id),
            tableId: tableId ? String(tableId) : undefined,
            number: tableNumber,
            isEnabled,
            isActive: false,
            items: t.items ?? 0,
            total: "-",
            status: isEnabled ? "free" : "disabled",
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
  const [activeSessionTableNumbers, setActiveSessionTableNumbers] = useState<
    Set<number>
  >(new Set());
  const [serviceCalls, setServiceCalls] = useState<ServiceCallAPI[]>([]);
  const [todaySales, setTodaySales] = useState<number>(0);
  const [occupiedCount, setOccupiedCount] = useState<number>(0);
  const [totalTables, setTotalTables] = useState<number>(0);

  const parseTotal = (total: string) => {
    if (!total) return 0;
    const num = total.replace(/[^0-9]/g, "");
    return parseInt(num || "0", 10);
  };

  const formatRupees = (value: number) => {
    const safe = Number.isFinite(value) ? value : 0;
    return `₹${safe.toLocaleString()}`;
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

  const formatDuration = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return undefined;
    const diffMin = Math.max(0, Math.floor((Date.now() - created) / 60000));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
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

  const disabledTableNumbers = useMemo(() => {
    const numbers = new Set<number>();
    for (const table of tablesData) {
      if (table.status === "disabled" || table.isEnabled === false) {
        const tableNumber = getTableNumber(table);
        if (tableNumber !== undefined) {
          numbers.add(tableNumber);
        }
      }
    }
    return numbers;
  }, [tablesData]);

  const tableOrderStats = useMemo(() => {
    const stats = new Map<
      number,
      { items: number; total: number; time?: string }
    >();
    for (const order of activeOrders) {
      const tableNumber = order.table_number;
      if (typeof tableNumber !== "number") continue;
      if (disabledTableNumbers.has(tableNumber)) continue;
      const prev = stats.get(tableNumber) || { items: 0, total: 0 };
      const itemsCount = (order.items || []).reduce(
        (sum, i) => sum + (Number(i.quantity) || 0),
        0,
      );
      const totalValue = (order.items || []).reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0,
      );
      const time = order.created_at
        ? formatDuration(order.created_at)
        : prev.time;
      stats.set(tableNumber, {
        items: prev.items + itemsCount,
        total: prev.total + totalValue,
        time: prev.time || time,
      });
    }
    return stats;
  }, [activeOrders, disabledTableNumbers]);

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );

  const resolveTargetTableId = async (rawId: string) => {
    if (!rawId) return "";
    if (isUuid(rawId)) return rawId;

    const asNumber = Number(rawId);
    if (!Number.isFinite(asNumber)) return "";

    const localMatch = tablesData.find(
      (t) => getTableNumber(t) === asNumber && t.tableId,
    );
    if (localMatch?.tableId) return String(localMatch.tableId);

    try {
      const res = await api.get("/api/admin/tables");
      const normalized = normalizeTables(res);
      const match = normalized.find(
        (t: any) => getTableNumber(t) === asNumber && t.tableId,
      );
      return match?.tableId ? String(match.tableId) : "";
    } catch {
      return "";
    }
  };

  const tablesWithOrders = useMemo(() => {
    return tablesData.map((t) => {
      const tableNumber = getTableNumber(t);
      if (t.status === "disabled" || t.isEnabled === false) {
        return {
          ...t,
          status: "disabled",
          isActive: false,
        };
      }

      if (tableNumber !== undefined && disabledTableNumbers.has(tableNumber)) {
        return {
          ...t,
          status: "disabled",
          isActive: false,
        };
      }

      if (tableNumber === undefined) return t;
      const stat = tableOrderStats.get(tableNumber);
      const bg = billGroups.get(tableNumber);
      const hasActiveSession = activeSessionTableNumbers.has(tableNumber);

      // If this table is in a bill group, show combined totals
      if (bg) {
        const otherTables = bg.linkedTableNumbers.filter(
          (n) => n !== tableNumber,
        );
        return {
          ...t,
          items: bg.combinedItems,
          total: bg.combinedTotal
            ? `Rs ${bg.combinedTotal}`
            : stat?.total
              ? `Rs ${stat.total}`
              : "-",
          status: "occupied",
          isActive: true,
          time: stat?.time || t.time,
          mergedWith: otherTables,
          billGroupId: bg.groupId,
        };
      }

      if (!stat && !hasActiveSession) return t;
      if (!stat && hasActiveSession) {
        return {
          ...t,
          items: t.items ?? 0,
          total: t.total || "-",
          status: "occupied",
          isActive: true,
          time: t.time || "Just now",
        };
      }
      if (!stat) return t;
      return {
        ...t,
        items: stat.items,
        total: stat.total ? `Rs ${stat.total}` : "-",
        status: "occupied",
        isActive: true,
        time: stat.time || t.time,
      };
    });
  }, [
    tablesData,
    tableOrderStats,
    billGroups,
    activeSessionTableNumbers,
    disabledTableNumbers,
  ]);

  const tables = useMemo(() => {
    const filtered = tablesWithOrders
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
  }, [filter, search, sortBy, tablesWithOrders]);

  const buildKitchenActivities = useCallback((ordersList: ActiveOrder[]) => {
    const next: Activity[] = [];
    for (const order of ordersList) {
      for (const item of order.items || []) {
        const variantSuffix = item.variant_label
          ? ` (${item.variant_label})`
          : "";
        // Use canonical order UUID for status updates to avoid touching multiple orders.
        const orderId = order.id;
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
    },
    [],
  );

  const formatApiError = useCallback((e: any, fallback: string) => {
    const status = e?.status ? ` (status ${e.status})` : "";
    const detail = e?.body?.message || e?.body?.error || e?.message;
    return detail ? `${fallback}${status}: ${detail}` : `${fallback}${status}`;
  }, []);

  /** Fetch bill-group info for a session and update billGroups state for all tables in the group. */
  const fetchBillGroup = useCallback(async (sessionId: string) => {
    try {
      const bill: any = await api.get(`/api/admin/bills/session/${sessionId}`);
      if (!bill?.group_id) return;

      const sessions: {
        session_id: string;
        table_id: string;
        table_number: number;
      }[] = bill.sessions || [];
      const orders: any[] = bill.orders || [];
      const tableNumbers = sessions.map((s) => s.table_number);

      const combinedItems = orders.reduce((sum: number, o: any) => {
        return (
          sum +
          (o.items || []).reduce(
            (s2: number, i: any) => s2 + (Number(i.quantity) || 0),
            0,
          )
        );
      }, 0);
      const combinedTotal = orders.reduce((sum: number, o: any) => {
        return (
          sum +
          (o.items || []).reduce(
            (s2: number, i: any) =>
              s2 + (Number(i.price) || 0) * (Number(i.quantity) || 0),
            0,
          )
        );
      }, 0);
      const allOrderIds = orders
        .map((o: any) => String(o.id || o.order_id))
        .filter(Boolean);

      const info: BillGroupInfo = {
        groupId: bill.group_id,
        linkedTableNumbers: tableNumbers,
        combinedItems,
        combinedTotal,
        allOrderIds,
      };

      setBillGroups((prev) => {
        const next = new Map(prev);
        for (const tn of tableNumbers) {
          next.set(tn, info);
        }
        return next;
      });
    } catch {
      // bill group fetch failed, non-critical
    }
  }, []);

  const refreshActivities = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const [ordersRes, serviceRes, salesRes, sessionsRes] =
        await Promise.allSettled([
          api.get("/api/admin/orders/active"),
          api.get("/api/admin/service-calls"),
          api.get("/api/admin/sales/today"),
          api.get("/api/admin/sessions/active"),
        ]);

      const errors: string[] = [];

      const ordersList =
        ordersRes.status === "fulfilled"
          ? ((ordersRes.value as ActiveOrdersResponse)?.orders || []).filter(
              (order) =>
                !disabledTableNumbers.has(Number(order?.table_number)) ||
                Number.isNaN(Number(order?.table_number)),
            )
          : [];
      if (ordersRes.status === "rejected") {
        errors.push(formatApiError(ordersRes.reason, "Orders request failed"));
      }

      const serviceCallsList =
        serviceRes.status === "fulfilled"
          ? ((serviceRes.value as ServiceCallAPI[]) || []).filter(
              (call) => !disabledTableNumbers.has(Number(call?.table_number)),
            )
          : [];
      if (serviceRes.status === "rejected") {
        errors.push(
          formatApiError(serviceRes.reason, "Service calls request failed"),
        );
      }

      const salesTotalRaw =
        salesRes.status === "fulfilled"
          ? ((salesRes.value as { total?: number; totalv?: number })?.total ??
            (salesRes.value as { total?: number; totalv?: number })?.totalv)
          : 0;
      const salesTotal = Number(salesTotalRaw) || 0;
      if (salesRes.status === "rejected") {
        errors.push(formatApiError(salesRes.reason, "Sales request failed"));
      }

      const sessionsPayload =
        sessionsRes.status === "fulfilled"
          ? (sessionsRes.value as ActiveSessionsResponse | ActiveSessionAPI[])
          : null;
      const sessionsList: ActiveSessionAPI[] = Array.isArray(sessionsPayload)
        ? (sessionsPayload as ActiveSessionAPI[])
        : Array.isArray((sessionsPayload as ActiveSessionsResponse)?.sessions)
          ? (sessionsPayload as ActiveSessionsResponse).sessions
          : [];
      const validSessions = sessionsList.filter(
        (session) =>
          !disabledTableNumbers.has(Number(session?.table_number)) &&
          Number.isFinite(Number(session?.table_number)) &&
          Number(session?.table_number) > 0,
      );
      if (sessionsRes.status === "rejected") {
        errors.push(
          formatApiError(sessionsRes.reason, "Active sessions request failed"),
        );
      }

      setActiveOrders(ordersList);
      setServiceCalls(serviceCallsList);
      setTodaySales(salesTotal);
      setActiveSessionTableNumbers(
        new Set(
          validSessions
            .map((s) => Number(s?.table_number))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      );

      const kitchen = buildKitchenActivities(ordersList);
      const service = buildServiceActivities(serviceCallsList);
      setActivities([...kitchen, ...service]);

      // Re-fetch bill groups for tables with active orders
      const uniqueSessions = new Set<string>();
      for (const order of ordersList) {
        if (order.session_id) uniqueSessions.add(order.session_id);
      }
      // Fire-and-forget bill group lookups
      for (const sid of uniqueSessions) {
        fetchBillGroup(sid).catch(() => {});
      }

      if (errors.length > 0) {
        setActivityError(errors.join(" | "));
      } else {
        setActivityError(null);
      }
    } finally {
      setActivityLoading(false);
    }
  }, [
    buildKitchenActivities,
    buildServiceActivities,
    formatApiError,
    fetchBillGroup,
    disabledTableNumbers,
  ]);

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
      console.error("Failed to update order status", e);
      if (detail) {
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
      console.error("Failed to update service status", e);
      if (detail) {
        alert(`Update failed${status}: ${detail}`);
      }
    }
  };

  const handleMoveTable = async (targetTableId: string) => {
    if (!moveSource) return;
    const sourceTable = tablesWithOrders.find((t) => t.id === moveSource);
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
    const resolvedTargetId = await resolveTargetTableId(targetTableId);
    if (!resolvedTargetId) {
      setMoveError(
        "Target table id is missing or invalid. Please refresh and try again.",
      );
      return;
    }

    setMoveLoading(true);
    setMoveError(null);
    try {
      console.log("Move table payload", {
        session_id: sessionId,
        target_table_id: resolvedTargetId,
      });
      await api.post("/api/admin/table-move", {
        session_id: sessionId,
        target_table_id: resolvedTargetId,
      });
      const res = await api.get("/api/admin/tables");
      setTablesData(normalizeTables(res));
      await refreshActivities();
      setMoveModalOpen(false);
      setMoveSource(null);
    } catch (e: any) {
      const status = e?.status ? ` (status ${e.status})` : "";
      const detail = e?.body?.message || e?.body?.error || e?.message;
      console.error("Move table failed", {
        status: e?.status,
        body: e?.body,
        error: e,
      });
      setMoveError(
        detail ? `Move failed${status}: ${detail}` : `Move failed${status}`,
      );
    } finally {
      setMoveLoading(false);
    }
  };

  const handleMergeTable = async (targetTableId: string) => {
    if (!mergeSource) return;
    const sourceTable = tablesWithOrders.find((t) => t.id === mergeSource);
    const targetTable = tablesWithOrders.find((t) => t.id === targetTableId);
    if (!sourceTable || !targetTable) return;

    const sourceNumber = getTableNumber(sourceTable);
    const targetNumber = getTableNumber(targetTable);

    // Find session IDs for both tables
    const sourceOrder = activeOrders.find(
      (o) => sourceNumber !== undefined && o.table_number === sourceNumber,
    );
    const targetOrder = activeOrders.find(
      (o) => targetNumber !== undefined && o.table_number === targetNumber,
    );
    const sourceSessionId = sourceOrder?.session_id;
    const targetSessionId = targetOrder?.session_id;

    if (!sourceSessionId || !targetSessionId) {
      setMergeError("Both tables must have active sessions to merge.");
      return;
    }

    setMergeLoading(true);
    setMergeError(null);
    try {
      await api.post("/api/admin/bills/merge", {
        session_id: sourceSessionId,
        target_session_id: targetSessionId,
      });

      // Fetch combined bill group data so we can show merged totals
      await fetchBillGroup(targetSessionId);

      await Promise.all([loadTables(), refreshActivities()]);
      setMergeModalOpen(false);
      setMergeSource(null);
      Alert.alert(
        "Bills Merged",
        `T${sourceNumber} and T${targetNumber} now share a combined bill.\n` +
          `Pay on either table to settle both.`,
      );
    } catch (e: any) {
      setMergeError(e?.message || "Failed to merge tables");
    } finally {
      setMergeLoading(false);
    }
  };

  const handleMarkPaid = async (mode: "cash" | "card" | "upi") => {
    if (!paidSource) return;
    const table = tablesWithOrders.find((t) => t.id === paidSource);
    if (!table) return;
    const tableNumber = getTableNumber(table);

    if (!restaurantId) {
      Alert.alert("Error", "Restaurant ID not available. Try again.");
      return;
    }

    // If table is in a bill group, pay ALL orders from the group
    const bg =
      tableNumber !== undefined ? billGroups.get(tableNumber) : undefined;
    let ordersToPay: { orderId: string; items: ActiveOrderItem[] }[] = [];

    if (bg && bg.allOrderIds.length > 0) {
      // Bill group: pay every order across all merged tables
      for (const oid of bg.allOrderIds) {
        const matchOrder = activeOrders.find(
          (o) => (o.id || o.order_id) === oid,
        );
        ordersToPay.push({ orderId: oid, items: matchOrder?.items || [] });
      }
    } else {
      // No bill group: pay only this table's orders
      const tableOrders =
        tableNumber !== undefined
          ? activeOrders.filter((o) => o.table_number === tableNumber)
          : [];
      ordersToPay = tableOrders
        .map((o) => ({
          orderId: String(o.id || o.order_id || ""),
          items: o.items || [],
        }))
        .filter((o) => o.orderId);
    }

    if (ordersToPay.length === 0) {
      Alert.alert("No Orders", "No active orders found for this table.");
      return;
    }

    setPaidLoading(true);
    try {
      for (const { orderId, items } of ordersToPay) {
        // Get order breakdown for accurate total
        let amount = 0;
        try {
          const breakdown: any = await api.get(
            `/api/admin/orders/${orderId}/breakdown`,
          );
          amount = breakdown?.Total ?? breakdown?.total ?? 0;
        } catch {
          // Fallback: calculate from items
          amount = items.reduce(
            (sum, i) =>
              sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
            0,
          );
        }

        await api.post("/api/payments/pay", {
          order_id: orderId,
          restaurant_id: restaurantId,
          amount,
          mode,
        });
      }

      // Clear bill group tracking for all linked tables
      if (bg) {
        setBillGroups((prev) => {
          const next = new Map(prev);
          for (const tn of bg.linkedTableNumbers) {
            next.delete(tn);
          }
          return next;
        });
      }

      await Promise.all([loadTables(), refreshActivities()]);
      setPaidModalOpen(false);
      setPaidSource(null);

      const paidLabel = bg
        ? `Tables T${bg.linkedTableNumbers.join(", T")} are now paid and cleared (${mode}).`
        : `Table T${tableNumber} marked as paid (${mode}).`;
      Alert.alert("Success", paidLabel);
    } catch (e: any) {
      Alert.alert("Payment Failed", e?.message || "Could not process payment.");
    } finally {
      setPaidLoading(false);
    }
  };

  const handleFreeTable = async (tableId: string) => {
    const tableToFree = tablesWithOrders.find((t) => t.id === tableId);
    const tableNumber = getTableNumber(tableToFree);

    // Confirm
    Alert.alert(
      "Free Table",
      `Free Table ${tableNumber ?? tableId}? Any unpaid orders will remain in the system.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Free Table",
          style: "destructive",
          onPress: async () => {
            setFreeLoading(tableId);
            // Update local state immediately
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

            // Refresh from server
            try {
              await Promise.all([loadTables(), refreshActivities()]);
            } catch {
              // local state is already updated
            }
            setFreeLoading(null);
          },
        },
      ],
    );
  };

  useEffect(() => {
    refreshActivities();
    // Fetch restaurant_id for payment
    (async () => {
      try {
        const me: any = await api.get("/api/admin/me");
        setRestaurantId(me?.restaurant_id || "");
      } catch {}
    })();
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

  const handleOpenTakeOrder = useCallback(
    (table: Table) => {
      const tableId = String(table.tableId || table.id || "");
      const tableNumber = getTableNumber(table);
      const params: Record<string, string> = {};
      const existingSession = activeOrders.find(
        (o) => tableNumber !== undefined && o.table_number === tableNumber,
      )?.session_id;
      if (tableId) params.table_id = tableId;
      if (tableNumber !== undefined) params.table_number = String(tableNumber);
      if (restaurantId) params.restaurant_id = restaurantId;
      if (existingSession) params.session_id = String(existingSession);

      router.push({
        pathname: "/waiter/take-order",
        params,
      } as any);
    },
    [activeOrders, router, restaurantId],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F8FAFB" }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={WaiterColors.primary}
        />
      }
    >
      <WaiterWavyHeader title="Floor Overview" height={140}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: "#fff",
                letterSpacing: -0.5,
              }}
            >
              Floor Overview
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
              {formatRupees(todaySales)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                fontWeight: "600",
              }}
            >
              {occupiedCount} / {totalTables} tables
            </Text>
          </View>
        </View>
      </WaiterWavyHeader>
      {loading && (
        <View style={{ padding: 16 }}>
          <WaiterText>Loading tables...</WaiterText>
        </View>
      )}
      {error && (
        <View style={{ padding: 16 }}>
          <WaiterText style={{ color: "red" }}>{error}</WaiterText>
        </View>
      )}

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricPendingBg]}>
            <IconSymbol name="fork.knife" size={18} color="#374151" />
          </View>
          <WaiterText type="defaultSemiBold">Pending</WaiterText>
          <WaiterText type="defaultSemiBold">Orders</WaiterText>
          <WaiterText type="title">
            {activeOrders.filter((o) => o.status === "pending").length}
          </WaiterText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricBillBg]}>
            <IconSymbol name="doc.text" size={18} color="#1E3A8A" />
          </View>
          <WaiterText type="defaultSemiBold">Bill Request</WaiterText>
          <WaiterText type="title">0</WaiterText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricServiceBg]}>
            <IconSymbol name="bell.fill" size={18} color="#075985" />
          </View>
          <WaiterText type="defaultSemiBold">Service Calls</WaiterText>
          <WaiterText type="title">
            {serviceCalls.filter((c) => c.status !== "done").length}
          </WaiterText>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, styles.metricLongBg]}>
            <IconSymbol name="clock" size={18} color="#7F1D1D" />
          </View>
          <WaiterText type="defaultSemiBold">Long Sitting</WaiterText>
          <WaiterText type="title">0</WaiterText>
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
                  : { backgroundColor: WaiterColors.card },
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
        renderItem={({ item }) => {
          const isDisabled =
            item.status === "disabled" || item.isEnabled === false;
          const isFree = !isDisabled && !item.isActive;
          const isBillRequested = item.flag === "bill";

          return (
            <TouchableOpacity
              style={[
                styles.tableCard,
                isDisabled && styles.tableCardDisabled,
                isFree && styles.tableCardFree,
                item.isActive && !isBillRequested && styles.tableCardOccupied,
                isBillRequested && styles.tableCardBill,
                freeLoading === item.id ? { opacity: 0.5 } : null,
              ]}
              activeOpacity={1}
            >
              <TouchableOpacity
                style={styles.optionsBtn}
                onPress={() =>
                  setOpenMenuId(openMenuId === item.id ? null : item.id)
                }
              >
                <Text style={{ fontSize: 18 }}>...</Text>
              </TouchableOpacity>
              {openMenuId === item.id ? (
                <View style={styles.optionsMenu}>
                  {[
                    {
                      key: "order",
                      label: "Place Order",
                      icon: "cart",
                    },
                    ...(item.isActive
                      ? [
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
                          {
                            key: "print",
                            label: "Print Bill",
                            icon: "doc.text",
                          },
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
                        ]
                      : []),
                  ].map((op: any) => (
                    <TouchableOpacity
                      key={op.key}
                      onPress={() => {
                        setOpenMenuId(null);
                        if (op.key === "order") {
                          handleOpenTakeOrder(item);
                          return;
                        }
                        if (op.key === "move") {
                          setMoveError(null);
                          setMoveSource(item.id);
                          setMoveModalOpen(true);
                          return;
                        }
                        if (op.key === "merge") {
                          setMergeError(null);
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
                          setPaidSource(item.id);
                          setPaidModalOpen(true);
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
                            op.tone === "success"
                              ? "#16a34a"
                              : WaiterColors.text
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
              <View style={styles.tableCardHeader}>
                <WaiterText style={styles.tableNumber}>
                  {item.number || item.id}
                </WaiterText>
                <View
                  style={[
                    styles.statusBadge,
                    isDisabled
                      ? styles.statusBadgeDisabled
                      : isFree
                        ? styles.statusBadgeFree
                        : styles.statusBadgeOccupied,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {isDisabled ? "NOT IN USE" : isFree ? "FREE" : "SEATED"}
                  </Text>
                </View>
              </View>
              <View>
                {item.mergedWith && item.mergedWith.length > 0 ? (
                  <View style={styles.mergedBadge}>
                    <Text style={styles.mergedBadgeText}>
                      🔗 Merged with T{item.mergedWith.join(", T")}
                    </Text>
                  </View>
                ) : null}
                <WaiterText
                  style={{
                    color: isDisabled
                      ? "#9CA3AF"
                      : item.isActive
                        ? WaiterColors.primary
                        : "#94a3b8",
                    fontWeight: "bold",
                  }}
                >
                  {isDisabled
                    ? "Not in use"
                    : item.isActive
                      ? "Seated"
                      : "Available"}
                </WaiterText>
                <View style={styles.tableMetaRow}>
                  <IconSymbol
                    name={
                      isDisabled
                        ? "xmark.circle"
                        : item.isActive
                          ? "clock"
                          : "fork.knife"
                    }
                    size={14}
                    color={
                      isDisabled
                        ? "#CBD5E1"
                        : item.isActive
                          ? "#94a3b8"
                          : "#cbd5e1"
                    }
                  />
                  <WaiterText
                    style={
                      item.isActive && !isDisabled
                        ? styles.tableMetaText
                        : styles.tableMetaTextMuted
                    }
                  >
                    {isDisabled
                      ? "Not in use"
                      : item.isActive
                        ? item.time || "Just now"
                        : "Available"}
                  </WaiterText>
                </View>
              </View>
              {item.isActive && !isDisabled ? (
                <View style={styles.tableStats}>
                  <View style={styles.itemsBox}>
                    <WaiterText>ITEMS</WaiterText>
                    <WaiterText type="defaultSemiBold">{item.items}</WaiterText>
                  </View>
                  <WaiterText type="defaultSemiBold">{item.total}</WaiterText>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={<View style={{ height: 8 }} />}
      />

      {/* Merge modal */}
      <Modal
        visible={mergeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!mergeLoading) {
            setMergeModalOpen(false);
            setMergeError(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <WaiterText type="title">Merge Bill</WaiterText>
              <TouchableOpacity
                onPress={() => {
                  if (!mergeLoading) {
                    setMergeModalOpen(false);
                    setMergeError(null);
                  }
                }}
              >
                <Text style={{ fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <WaiterText style={{ marginBottom: 12 }}>
              {(() => {
                const src = tablesWithOrders.find((t) => t.id === mergeSource);
                const label = src
                  ? `T${src.number ?? getTableNumber(src) ?? src.id}`
                  : mergeSource;
                return `Merging ${label} into another occupied table`;
              })()}
            </WaiterText>
            {mergeError ? (
              <WaiterText style={{ color: "red", marginBottom: 8 }}>
                {mergeError}
              </WaiterText>
            ) : null}
            {mergeLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator size="large" color={WaiterColors.primary} />
                <WaiterText style={{ marginTop: 10 }}>
                  Merging bills...
                </WaiterText>
              </View>
            ) : (
              <FlatList
                data={tablesWithOrders.filter(
                  (t) => t.id !== mergeSource && t.status === "occupied",
                )}
                keyExtractor={(t) => t.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.mergeRow}
                    onPress={() => handleMergeTable(item.id)}
                    disabled={mergeLoading}
                  >
                    <View style={styles.tableThumbnail}>
                      <Text>{`T${item.number ?? getTableNumber(item) ?? item.id}`}</Text>
                    </View>
                    <View style={styles.tableInfo}>
                      <Text style={styles.amountText}>{item.total} Bill</Text>
                      <Text style={styles.guestsText}>Items: {item.items}</Text>
                    </View>
                    <Text style={{ fontSize: 18 }}>→</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyMoveState}>
                    <WaiterText>
                      No other occupied tables to merge with.
                    </WaiterText>
                  </View>
                }
              />
            )}
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
              <WaiterText type="title">Move Table</WaiterText>
              <TouchableOpacity onPress={() => setMoveModalOpen(false)}>
                <Text style={{ fontSize: 18 }}>x</Text>
              </TouchableOpacity>
            </View>
            <WaiterText style={{ marginBottom: 12 }}>
              {(() => {
                const src = tablesData.find((t) => t.id === moveSource);
                const label = src
                  ? `T${src.number ?? getTableNumber(src) ?? src.id}`
                  : moveSource;
                return `Moving ${label} to another table`;
              })()}
            </WaiterText>
            {moveError ? (
              <WaiterText style={{ color: "red", marginBottom: 8 }}>
                {moveError}
              </WaiterText>
            ) : null}

            <FlatList
              data={tablesWithOrders.filter(
                (t) => t.id !== moveSource && t.status === "free",
              )}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mergeRow}
                  onPress={() => {
                    if (!item.tableId) {
                      setMoveError(
                        "Target table id missing. Please refresh table data.",
                      );
                      return;
                    }
                    handleMoveTable(item.tableId);
                  }}
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
                  <WaiterText>No empty tables available.</WaiterText>
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
              <WaiterText type="title">Print Bill</WaiterText>
              <TouchableOpacity onPress={() => setPrintModalOpen(false)}>
                <Text style={{ fontSize: 18 }}>x</Text>
              </TouchableOpacity>
            </View>
            {printSource
              ? (() => {
                  const table = tablesData.find((t) => t.id === printSource);
                  return (
                    <>
                      <WaiterText style={{ marginBottom: 12 }}>
                        {(() => {
                          const label = table
                            ? `T${table.number ?? getTableNumber(table) ?? table.id}`
                            : printSource;
                          return `Bill for ${label}`;
                        })()}
                      </WaiterText>
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

      {/* Mark as Paid modal */}
      <Modal
        visible={paidModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!paidLoading) {
            setPaidModalOpen(false);
            setPaidSource(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <WaiterText type="title">Mark as Paid</WaiterText>
              <TouchableOpacity
                onPress={() => {
                  if (!paidLoading) {
                    setPaidModalOpen(false);
                    setPaidSource(null);
                  }
                }}
              >
                <Text style={{ fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {(() => {
              const tbl = tablesWithOrders.find((t) => t.id === paidSource);
              const tblNumber = tbl ? getTableNumber(tbl) : undefined;
              const bg =
                tblNumber !== undefined ? billGroups.get(tblNumber) : undefined;
              return (
                <>
                  <WaiterText style={{ marginBottom: 6 }}>
                    Table {tblNumber ? `T${tblNumber}` : paidSource}
                  </WaiterText>
                  {bg ? (
                    <View style={[styles.mergedBadge, { marginBottom: 8 }]}>
                      <Text style={styles.mergedBadgeText}>
                        🔗 Combined bill with T
                        {bg.linkedTableNumbers
                          .filter((n) => n !== tblNumber)
                          .join(", T")}
                      </Text>
                    </View>
                  ) : null}
                  <WaiterText style={{ marginBottom: 4, color: "#6B7280" }}>
                    {tbl ? `${tbl.items} items • ${tbl.total}` : ""}
                  </WaiterText>
                  {bg ? (
                    <WaiterText
                      style={{
                        marginBottom: 16,
                        color: "#4338CA",
                        fontWeight: "600",
                        fontSize: 12,
                      }}
                    >
                      Paying will settle & free all{" "}
                      {bg.linkedTableNumbers.length} tables
                    </WaiterText>
                  ) : (
                    <View style={{ marginBottom: 16 }} />
                  )}
                </>
              );
            })()}
            {paidLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator size="large" color={WaiterColors.primary} />
                <WaiterText style={{ marginTop: 10 }}>
                  Processing payment...
                </WaiterText>
              </View>
            ) : (
              <View>
                <WaiterText style={{ marginBottom: 12, fontWeight: "700" }}>
                  Select Payment Mode
                </WaiterText>
                {(["cash", "card", "upi"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={styles.paymentModeBtn}
                    onPress={() => handleMarkPaid(mode)}
                  >
                    <View style={styles.paymentModeIcon}>
                      <Text style={{ fontSize: 20 }}>
                        {mode === "cash" ? "💵" : mode === "card" ? "💳" : "📱"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paymentModeLabel}>
                        {mode === "cash"
                          ? "Cash"
                          : mode === "card"
                            ? "Card"
                            : "UPI"}
                      </Text>
                      <Text style={styles.paymentModeSub}>
                        {mode === "cash"
                          ? "Pay with cash"
                          : mode === "card"
                            ? "Debit/Credit card"
                            : "Google Pay, PhonePe, etc."}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, color: "#9CA3AF" }}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.section}>
        <WaiterText type="subtitle">Activity Feed</WaiterText>

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
          <WaiterText>Loading activity...</WaiterText>
        ) : activityError ? (
          <WaiterText style={{ color: "red" }}>{activityError}</WaiterText>
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
                    <WaiterText>{a.table}</WaiterText>
                  </View>
                  <View style={{ marginLeft: 8 }}>
                    <WaiterText type="defaultSemiBold">{a.title}</WaiterText>
                    <WaiterText>{a.note}</WaiterText>
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
    paddingHorizontal: 12,
    paddingBottom: 32,
    backgroundColor: "#F8FAFB",
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
    marginTop: 10,
  },
  metricCard: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterActive: {
    backgroundColor: WaiterColors.primary,
    borderColor: WaiterColors.primary,
  },
  filterText: { color: "#64748B", fontWeight: "600" },
  filterTextActive: { color: "#FFFFFF", fontWeight: "700" },
  searchInput: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  tableCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.2,
    borderColor: "#D1FAE5",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tableCardFree: {
    opacity: 0.55,
    backgroundColor: "#FAFAFA",
    borderStyle: "dashed" as any,
    borderColor: "#A7F3D0",
  },
  tableCardDisabled: {
    opacity: 0.6,
    backgroundColor: "#F9FAFB",
    borderStyle: "dashed" as any,
    borderColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  tableCardOccupied: {
    borderColor: "#99F6E4",
    backgroundColor: "#F0FDFA",
    shadowColor: "#0F766E",
    shadowOpacity: 0.12,
    elevation: 4,
  },
  tableCardBill: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  tableCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tableNumber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeFree: { backgroundColor: "#F3F4F6" },
  statusBadgeDisabled: { backgroundColor: "#F3F4F6" },
  statusBadgeOccupied: { backgroundColor: "#CCFBF1" },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0F766E",
  },
  tableStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  tableMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  tableMetaText: { color: "#64748B", fontWeight: "600" },
  tableMetaTextMuted: { color: "#cbd5e1", fontWeight: "600" },
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
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 6,
    zIndex: 30,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
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
    color: WaiterColors.text,
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
    backgroundColor: "#FFFFFF",
    marginLeft: 8,
  },
  sortMenu: {
    position: "absolute",
    top: 44,
    right: 0,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
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
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFB",
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
    backgroundColor: WaiterColors.primary,
  },
  activityTabsRow: { flexDirection: "row", marginVertical: 12 },
  activityTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  activityTabActive: { backgroundColor: "#FFFFFF" },
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
  paymentModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  paymentModeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paymentModeLabel: {
    fontWeight: "700",
    fontSize: 15,
    color: "#111827",
  },
  paymentModeSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  mergedBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 2,
    alignSelf: "flex-start",
  },
  mergedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4338CA",
  },
});
