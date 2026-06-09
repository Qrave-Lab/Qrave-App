/**
 * Admin screen for customizing and managing restaurant tables.
 *
 * Displays a floor overview with wavy header, table metrics, and allows filtering,
 * searching, and sorting of tables. Supports actions such as moving, merging,
 * printing bills, and marking tables as paid or free.
 * Includes bottom-sheet modals for table actions and an activity feed.
 *
 * Features:
 * - Fetches table data from the API and fills in missing tables with placeholders.
 * - Allows filtering tables by status (all, occupied, free, bill requested).
 * - Supports searching tables by number or ID.
 * - Provides sorting options: by table number, bill value, or time occupied.
 * - Table actions bottom sheet for each occupied table (move, merge, print, mark paid, free).
 * - Merge modal to combine bills and guests from two tables.
 * - Print modal to export a table's bill as CSV via the device's share dialog.
 * - Activity feed bottom sheet with tabs for kitchen and service requests.
 *
 * @component
 * @returns {JSX.Element} The admin customize tables screen.
 */
import { MaterialIcons } from "@expo/vector-icons";
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
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import AdminWavyHeader from "../../components/AdminWavyHeader";
import { api, BASE_URL } from "../../lib/apiClient";
import { getStoredLogoVersion, withLogoVersion } from "../../lib/logoVersion";

type Table = {
  id: string;
  tableId?: string;
  number?: number | string;
  name?: string;
  isActive?: boolean;
  items: number;
  total: string;
  status: string;
  time?: string;
  flag?: "bill" | "long" | string;
  mergedWith?: number[]; // table numbers this table is grouped with
  billGroupId?: string; // bill group UUID from backend
};

/** Maps a table number â†’ its bill-group info (combined orders from all grouped tables). */
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HELPERS
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const padNumber = (n: number | string | undefined) => {
  if (n === undefined || n === null) return "??";
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num < 10 ? `0${num}` : String(num);
};

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
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [billGroups, setBillGroups] = useState<Map<number, BillGroupInfo>>(
    new Map(),
  );
  const [tablesData, setTablesData] = useState<Table[]>(SAMPLE_TABLES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Table action bottom sheet
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionTableId, setActionTableId] = useState<string | null>(null);

  // Activity bottom sheet
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);

  // Restaurant logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
          const isActive = false;
          return {
            id: String(tableId || tableNumber || t.name || t.id),
            tableId: tableId ? String(tableId) : undefined,
            number: tableNumber,
            isActive,
            items: t.items ?? 0,
            total: "-",
            status: "free",
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

  const formatDuration = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return undefined;
    const diffMin = Math.max(0, Math.floor((Date.now() - created) / 60000));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const tableOrderStats = useMemo(() => {
    const stats = new Map<
      number,
      { items: number; total: number; time?: string }
    >();
    for (const order of activeOrders) {
      const tableNumber = order.table_number;
      if (typeof tableNumber !== "number") continue;
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
  }, [activeOrders]);

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
  }, [tablesData, tableOrderStats, billGroups, activeSessionTableNumbers]);

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
          ? (ordersRes.value as ActiveOrdersResponse)?.orders || []
          : [];
      if (ordersRes.status === "rejected") {
        errors.push(formatApiError(ordersRes.reason, "Orders request failed"));
      }

      const serviceCallsList =
        serviceRes.status === "fulfilled"
          ? (serviceRes.value as ServiceCallAPI[]) || []
          : [];
      if (serviceRes.status === "rejected") {
        errors.push(
          formatApiError(serviceRes.reason, "Service calls request failed"),
        );
      }

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
      if (sessionsRes.status === "rejected") {
        errors.push(
          formatApiError(sessionsRes.reason, "Active sessions request failed"),
        );
      }

      setActiveOrders(ordersList);
      setServiceCalls(serviceCallsList);
      setActiveSessionTableNumbers(
        new Set(
          sessionsList
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
        if (me?.restaurant_id) {
          try {
            const res = await fetch(
              `${BASE_URL}/public/restaurants/${me.restaurant_id}/logo`,
            );
            const data = await res.json();
            if (data.logo_url) {
              const version = await getStoredLogoVersion();
              setLogoUrl(withLogoVersion(data.logo_url, version) || "");
            }
          } catch {}
        }
      } catch {}
    })();
  }, [refreshActivities]);

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

  /* â”€â”€ Computed values â”€â”€ */
  const pendingOrders = activeOrders.filter(
    (o) => o.status === "pending",
  ).length;
  const activeServiceCalls = serviceCalls.filter(
    (c) => c.status !== "done",
  ).length;
  const kitchenCount = activities.filter(isKitchenVisible).length;
  const serviceCount = activities.filter(isServiceVisible).length;
  const totalActivityCount = kitchenCount + serviceCount;
  const occupiedTableCount = tablesWithOrders.filter(
    (t) => t.status === "occupied",
  ).length;
  const freeTableCount = tablesWithOrders.filter(
    (t) => t.status === "free",
  ).length;

  // Selected table for action sheet
  const actionTable = actionTableId
    ? tablesWithOrders.find((t) => t.id === actionTableId)
    : null;
  const actionTableNumber = actionTable
    ? getTableNumber(actionTable)
    : undefined;
  const actionTableBg =
    actionTableNumber !== undefined
      ? billGroups.get(actionTableNumber)
      : undefined;

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RENDER
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

  return (
    <View style={styles.mainContainer}>
      {/* â”€â”€ Wavy Header â”€â”€ */}
      <AdminWavyHeader height={160}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.profileAvatar}
            activeOpacity={0.8}
            onPress={() => router.replace("/admin/profile")}
          >
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.profileAvatarImage}
              />
            ) : (
              <MaterialIcons name="person" size={28} color="#F59E0B" />
            )}
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Floor Manager</Text>
            <View style={styles.headerLocationRow}>
              <MaterialIcons
                name="location-on"
                size={14}
                color="rgba(0,0,0,0.55)"
              />
              <Text style={styles.headerLocation}>Main Dining Hall</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => {
              setActivitySheetOpen(true);
              refreshActivities();
            }}
          >
            <MaterialIcons
              name="notifications-none"
              size={24}
              color="#1F2937"
            />
            {totalActivityCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {totalActivityCount > 9 ? "9+" : totalActivityCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </AdminWavyHeader>

      {/* â”€â”€ Main Scroll Body â”€â”€ */}
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
          />
        }
      >
        {loading && (
          <View style={{ padding: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text style={{ marginTop: 6, color: "#9CA3AF" }}>
              Loading tables...
            </Text>
          </View>
        )}
        {error && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#EF4444" }}>{error}</Text>
          </View>
        )}

        {/* â”€â”€ Metrics Row â”€â”€ */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => setFilter("all")}
          >
            <View style={[styles.metricIcon, { backgroundColor: "#FEF2F2" }]}>
              <MaterialIcons name="pending-actions" size={18} color="#EF4444" />
            </View>
            <Text style={styles.metricNum}>{pendingOrders}</Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: "#FFFBEB" }]}>
              <MaterialIcons name="receipt-long" size={18} color="#F59E0B" />
            </View>
            <Text style={styles.metricNum}>0</Text>
            <Text style={styles.metricLabel}>Bills</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: "#EFF6FF" }]}>
              <MaterialIcons name="room-service" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.metricNum}>{activeServiceCalls}</Text>
            <Text style={styles.metricLabel}>Service</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: "#F5F3FF" }]}>
              <MaterialIcons name="timer" size={18} color="#8B5CF6" />
            </View>
            <Text style={styles.metricNum}>0</Text>
            <Text style={styles.metricLabel}>Long Sit</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tables..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity
              style={styles.searchTuneBtn}
              onPress={() => setSortMenuOpen(!sortMenuOpen)}
            >
              <MaterialIcons name="tune" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* â”€â”€ Sort Pills (toggle) â”€â”€ */}
        {sortMenuOpen && (
          <View style={styles.sortMenu}>
            <Text style={styles.sortMenuLabel}>SORT BY</Text>
            <View style={styles.sortOptions}>
              {(["number", "value", "time"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.sortOption,
                    sortBy === opt && styles.sortOptionActive,
                  ]}
                  onPress={() => setSortBy(opt)}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortBy === opt && styles.sortOptionTextActive,
                    ]}
                  >
                    {opt === "number"
                      ? "Number"
                      : opt === "value"
                        ? "Value"
                        : "Time"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* â”€â”€ Filter Tabs â”€â”€ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === "all" && styles.filterChipActive,
            ]}
            onPress={() => setFilter("all")}
          >
            <MaterialIcons
              name="grid-view"
              size={14}
              color={filter === "all" ? "#FFF" : "#6B7280"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                filter === "all" && styles.filterChipTextActive,
              ]}
            >
              All Tables
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === "occupied" && styles.filterChipActive,
            ]}
            onPress={() => setFilter("occupied")}
          >
            <MaterialIcons
              name="people"
              size={14}
              color={filter === "occupied" ? "#FFF" : "#6B7280"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                filter === "occupied" && styles.filterChipTextActive,
              ]}
            >
              Occupied({occupiedTableCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === "free" && styles.filterChipActive,
            ]}
            onPress={() => setFilter("free")}
          >
            <MaterialIcons
              name="event-available"
              size={14}
              color={filter === "free" ? "#FFF" : "#6B7280"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                filter === "free" && styles.filterChipTextActive,
              ]}
            >
              Available({freeTableCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* â”€â”€ Table Grid â”€â”€ */}
        <View style={styles.tablesGrid}>
          {tables.map((item) => {
            const tNum = getTableNumber(item);
            const isFree = item.status === "free" || !item.isActive;
            const isBillReq = item.flag === "bill";
            const bg = tNum !== undefined ? billGroups.get(tNum) : undefined;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.tableCard,
                  isFree && styles.tableCardFree,
                  !isFree && !isBillReq && styles.tableCardOccupied,
                  isBillReq && styles.tableCardBill,
                ]}
                activeOpacity={isFree ? 1 : 0.7}
                onPress={() => {
                  if (!isFree) {
                    setActionTableId(item.id);
                    setActionSheetOpen(true);
                  }
                }}
              >
                {/* Card Header */}
                <View style={styles.tableCardHeader}>
                  <Text style={styles.tableNumber}>{padNumber(tNum)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isFree
                          ? "#F3F4F6"
                          : isBillReq
                            ? "#FEF2F2"
                            : "#ECFDF5",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: isFree
                            ? "#9CA3AF"
                            : isBillReq
                              ? "#EF4444"
                              : "#059669",
                        },
                      ]}
                    >
                      {isFree ? "FREE" : isBillReq ? "Bill Req" : "SEATED"}
                    </Text>
                  </View>
                </View>

                {/* Merged badge */}
                {bg && bg.linkedTableNumbers.length > 1 && (
                  <View style={styles.mergedBadge}>
                    <Text style={styles.mergedBadgeText}>
                      ðŸ”— T
                      {bg.linkedTableNumbers
                        .filter((n) => n !== tNum)
                        .join(", T")}
                    </Text>
                  </View>
                )}

                {isFree ? (
                  /* Free table empty state */
                  <View style={styles.emptyStateContainer}>
                    <MaterialIcons
                      name="table-restaurant"
                      size={32}
                      color="#D1D5DB"
                    />
                    <Text style={styles.availableText}>Available</Text>
                  </View>
                ) : (
                  /* Occupied table info */
                  <View style={styles.tableInfoSection}>
                    <View style={styles.infoRow}>
                      <MaterialIcons
                        name="restaurant"
                        size={14}
                        color="#6B7280"
                      />
                      <Text style={styles.infoText}>{item.items} Items</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons
                        name="schedule"
                        size={14}
                        color="#6B7280"
                      />
                      <Text style={styles.infoText}>{item.time || "0m"}</Text>
                    </View>
                    <View style={styles.cardDivider} />
                    <Text style={styles.totalAmount}>{item.total}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
         TABLE ACTION BOTTOM SHEET
         â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal
        visible={actionSheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setActionSheetOpen(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setActionSheetOpen(false)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  Table{" "}
                  {actionTableNumber !== undefined
                    ? padNumber(actionTableNumber)
                    : "?"}{" "}
                  - Manage Order
                </Text>
                {actionTableBg &&
                  actionTableBg.linkedTableNumbers.length > 1 && (
                    <Text style={styles.sheetSubtitle}>
                      ðŸ”— Merged with T
                      {actionTableBg.linkedTableNumbers
                        .filter((n) => n !== actionTableNumber)
                        .join(", T")}
                    </Text>
                  )}
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setActionSheetOpen(false)}
              >
                <MaterialIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Summary bar */}
            <View style={styles.statusCard}>
              <View style={styles.statusMain}>
                <Text style={styles.statusLabel}>Current Bill</Text>
                <Text style={styles.statusValue}>
                  {actionTable?.total || "-"}
                </Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.statusDetails}>
                <View style={styles.statusDetailRow}>
                  <MaterialIcons name="restaurant" size={14} color="#6B7280" />
                  <Text style={styles.statusDetailText}>
                    {actionTable?.items || 0} Items
                  </Text>
                </View>
                <View style={styles.statusDetailRow}>
                  <MaterialIcons name="schedule" size={14} color="#6B7280" />
                  <Text style={styles.statusDetailText}>
                    {actionTable?.time || "0m"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={[styles.actionBtnStyle, styles.actionBtnPrimary]}
                onPress={() => {
                  setActionSheetOpen(false);
                  setPaidSource(actionTableId);
                  setPaidModalOpen(true);
                }}
              >
                <MaterialIcons name="payments" size={24} color="#047857" />
                <Text style={styles.actionBtnPrimaryText}>Mark Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnStyle}
                onPress={() => {
                  setActionSheetOpen(false);
                  setPrintSource(actionTableId);
                  setPrintModalOpen(true);
                }}
              >
                <MaterialIcons name="print" size={24} color="#6B7280" />
                <Text style={styles.actionBtnStyleText}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnStyle}
                onPress={() => {
                  setActionSheetOpen(false);
                  setMoveSource(actionTableId);
                  setMoveError(null);
                  setMoveModalOpen(true);
                }}
              >
                <MaterialIcons name="swap-horiz" size={24} color="#6B7280" />
                <Text style={styles.actionBtnStyleText}>Move</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnStyle}
                onPress={() => {
                  setActionSheetOpen(false);
                  setMergeSource(actionTableId);
                  setMergeError(null);
                  setMergeModalOpen(true);
                }}
              >
                <MaterialIcons name="merge-type" size={24} color="#6B7280" />
                <Text style={styles.actionBtnStyleText}>Merge</Text>
              </TouchableOpacity>
            </View>

            {/* Clear & Free */}
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => {
                setActionSheetOpen(false);
                if (actionTableId) handleFreeTable(actionTableId);
              }}
            >
              <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
              <Text style={styles.dangerBtnText}>Clear & Free Table</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
         ACTIVITY BOTTOM SHEET
         â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal
        visible={activitySheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setActivitySheetOpen(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setActivitySheetOpen(false)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Activity Feed</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setActivitySheetOpen(false)}
              >
                <MaterialIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  activityTab === "kitchen" && styles.modalTabBtnActive,
                ]}
                onPress={() => setActivityTab("kitchen")}
              >
                <Text
                  style={[
                    styles.modalTabLabel,
                    activityTab === "kitchen" && styles.modalTabLabelActive,
                  ]}
                >
                  Kitchen({kitchenCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  activityTab === "service" && styles.modalTabBtnActive,
                ]}
                onPress={() => setActivityTab("service")}
              >
                <Text
                  style={[
                    styles.modalTabLabel,
                    activityTab === "service" && styles.modalTabLabelActive,
                  ]}
                >
                  Service({serviceCount})
                </Text>
              </TouchableOpacity>
            </View>

            {activityLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#F59E0B" />
              </View>
            ) : activityError ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#EF4444" }}>{activityError}</Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
              >
                {activities.filter((a) =>
                  activityTab === "kitchen"
                    ? isKitchenVisible(a)
                    : isServiceVisible(a),
                ).length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons
                      name="check-circle"
                      size={48}
                      color="#D1D5DB"
                    />
                    <Text
                      style={{
                        marginTop: 12,
                        color: "#9CA3AF",
                        fontWeight: "600",
                      }}
                    >
                      No new activities
                    </Text>
                  </View>
                ) : (
                  activities
                    .filter((a) =>
                      activityTab === "kitchen"
                        ? isKitchenVisible(a)
                        : isServiceVisible(a),
                    )
                    .map((a) => (
                      <View key={a.id} style={styles.activityCard}>
                        <View style={styles.activityCardHeader}>
                          <View style={styles.activityBadge}>
                            <Text style={styles.activityBadgeText}>
                              {a.table}
                            </Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.activityTitle}>{a.title}</Text>
                            <Text style={styles.activityNote}>{a.note}</Text>
                          </View>
                          <View style={styles.statusChip}>
                            <Text style={styles.statusChipText}>
                              {a.status}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.activityActions}>
                          {a.channel === "kitchen" ? (
                            <>
                              {a.status === "pending" ? (
                                <>
                                  <TouchableOpacity
                                    style={[styles.actBtn, styles.actBtnReject]}
                                    onPress={() =>
                                      handleKitchenStatus(
                                        a.orderId,
                                        "cancelled",
                                      )
                                    }
                                  >
                                    <Text style={styles.actBtnRejectText}>
                                      Reject
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.actBtn, styles.actBtnAccept]}
                                    onPress={() =>
                                      handleKitchenStatus(a.orderId, "accepted")
                                    }
                                  >
                                    <Text style={styles.actBtnAcceptText}>
                                      Accept
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.actBtn, styles.actBtnServe]}
                                  onPress={() =>
                                    handleKitchenStatus(a.orderId, "served")
                                  }
                                >
                                  <Text style={styles.actBtnServeText}>
                                    Mark Served
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </>
                          ) : (
                            <>
                              {a.status === "open" ? (
                                <>
                                  <TouchableOpacity
                                    style={[styles.actBtn, styles.actBtnReject]}
                                    onPress={() =>
                                      handleServiceStatus(a.serviceId, "done")
                                    }
                                  >
                                    <Text style={styles.actBtnRejectText}>
                                      Done
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.actBtn, styles.actBtnAccept]}
                                    onPress={() =>
                                      handleServiceStatus(
                                        a.serviceId,
                                        "attending",
                                      )
                                    }
                                  >
                                    <Text style={styles.actBtnAcceptText}>
                                      Attend
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.actBtn, styles.actBtnServe]}
                                  onPress={() =>
                                    handleServiceStatus(a.serviceId, "done")
                                  }
                                >
                                  <Text style={styles.actBtnServeText}>
                                    Resolve
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                    ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
         MERGE MODAL
         â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal
        visible={mergeModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMergeModalOpen(false)}
      >
        <View style={styles.centeredOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Merge Table</Text>
            <Text style={{ marginBottom: 8, color: "#666" }}>
              {(() => {
                const src = tablesWithOrders.find((t) => t.id === mergeSource);
                const label = src
                  ? `T${src.number ?? getTableNumber(src) ?? src.id}`
                  : mergeSource;
                return `Merging ${label} into another occupied table`;
              })()}
            </Text>
            {mergeError ? (
              <Text style={{ color: "red", marginBottom: 10 }}>
                {mergeError}
              </Text>
            ) : null}
            {mergeLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={{ marginTop: 10, color: "#6B7280" }}>
                  Merging bills...
                </Text>
              </View>
            ) : (
              <FlatList
                data={tablesWithOrders.filter(
                  (t) => t.id !== mergeSource && t.status === "occupied",
                )}
                keyExtractor={(t) => t.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dialogItem}
                    onPress={() => handleMergeTable(item.id)}
                  >
                    <Text style={styles.dialogItemText}>
                      T{item.number ?? getTableNumber(item) ?? item.id} -{" "}
                      {item.total}
                    </Text>
                    <MaterialIcons
                      name="arrow-forward"
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <Text style={{ color: "#9CA3AF" }}>
                      No other occupied tables to merge with.
                    </Text>
                  </View>
                }
              />
            )}
            <TouchableOpacity
              onPress={() => {
                if (!mergeLoading) {
                  setMergeModalOpen(false);
                  setMergeError(null);
                }
              }}
              style={styles.dialogCloseBtn}
            >
              <Text style={{ color: "#FFF", fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
         MOVE MODAL
         â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal
        visible={moveModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMoveModalOpen(false)}
      >
        <View style={styles.centeredOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Move Table</Text>
            <Text style={{ marginBottom: 8, color: "#666" }}>
              {(() => {
                const src = tablesData.find((t) => t.id === moveSource);
                const label = src
                  ? `T${src.number ?? getTableNumber(src) ?? src.id}`
                  : moveSource;
                return `Moving ${label} to another table`;
              })()}
            </Text>
            {moveError ? (
              <Text style={{ color: "red", marginBottom: 10 }}>
                {moveError}
              </Text>
            ) : null}
            <FlatList
              data={tablesWithOrders.filter(
                (t) => t.id !== moveSource && t.status === "free",
              )}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dialogItem}
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
                  <Text style={styles.dialogItemText}>
                    T{item.number ?? getTableNumber(item) ?? item.id} (Free)
                  </Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#666" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                  <Text style={{ color: "#9CA3AF" }}>
                    No empty tables available.
                  </Text>
                </View>
              }
            />
            <TouchableOpacity
              onPress={() => setMoveModalOpen(false)}
              style={styles.dialogCloseBtn}
            >
              <Text style={{ color: "#FFF", fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
         PRINT MODAL
         â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal
        visible={printModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPrintModalOpen(false)}
      >
        <View style={styles.centeredOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Print Bill</Text>
            <Text style={{ marginBottom: 20, color: "#666" }}>
              Export bill for table?
            </Text>
            <TouchableOpacity
              style={[styles.dialogCloseBtn, { backgroundColor: "#F59E0B" }]}
              onPress={async () => {
                const t = tablesData.find((x) => x.id === printSource);
                if (t) {
                  const csv = `Table,Items,Total\n${t.id},${t.items},${t.total}\n`;
                  try {
                    await Share.share({
                      title: `Bill_${t.id}.csv`,
                      message: csv,
                    });
                  } catch (e) {
                    console.error(e);
                  }
                }
                setPrintModalOpen(false);
              }}
            >
              <Text style={{ color: "#000", fontWeight: "700" }}>
                Export CSV
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPrintModalOpen(false)}
              style={[
                styles.dialogCloseBtn,
                { marginTop: 10, backgroundColor: "#9CA3AF" },
              ]}
            >
              <Text style={{ color: "#FFF", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
         MARK AS PAID MODAL
         â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal
        visible={paidModalOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!paidLoading) {
            setPaidModalOpen(false);
            setPaidSource(null);
          }
        }}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => {
              if (!paidLoading) {
                setPaidModalOpen(false);
                setPaidSource(null);
              }
            }}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Mark as Paid</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  if (!paidLoading) {
                    setPaidModalOpen(false);
                    setPaidSource(null);
                  }
                }}
              >
                <MaterialIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {(() => {
              const tbl = tablesWithOrders.find((t) => t.id === paidSource);
              const tblNumber = tbl ? getTableNumber(tbl) : undefined;
              const bg =
                tblNumber !== undefined ? billGroups.get(tblNumber) : undefined;
              return (
                <>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: "#374151",
                      marginBottom: 4,
                    }}
                  >
                    Table {tblNumber ? `T${tblNumber}` : paidSource}
                  </Text>
                  {bg && (
                    <View style={[styles.mergedBadge, { marginBottom: 8 }]}>
                      <Text style={styles.mergedBadgeText}>
                        ðŸ”— Combined bill with T
                        {bg.linkedTableNumbers
                          .filter((n) => n !== tblNumber)
                          .join(", T")}
                      </Text>
                    </View>
                  )}
                  <Text style={{ marginBottom: 4, color: "#6B7280" }}>
                    {tbl ? `${tbl.items} items â€¢ ${tbl.total}` : ""}
                  </Text>
                  {bg ? (
                    <Text
                      style={{
                        marginBottom: 16,
                        color: "#4338CA",
                        fontWeight: "600",
                        fontSize: 12,
                      }}
                    >
                      Paying will settle & free all{" "}
                      {bg.linkedTableNumbers.length} tables
                    </Text>
                  ) : (
                    <View style={{ marginBottom: 16 }} />
                  )}
                </>
              );
            })()}

            {paidLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={{ marginTop: 10, color: "#6B7280" }}>
                  Processing payment...
                </Text>
              </View>
            ) : (
              <View>
                <Text
                  style={{ marginBottom: 12, fontWeight: "700", color: "#111" }}
                >
                  Select Payment Mode
                </Text>
                {(["cash", "card", "upi"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={styles.paymentModeBtn}
                    onPress={() => handleMarkPaid(mode)}
                  >
                    <View style={styles.paymentModeIcon}>
                      <MaterialIcons
                        name={
                          mode === "cash"
                            ? "payments"
                            : mode === "card"
                              ? "credit-card"
                              : "phone-android"
                        }
                        size={22}
                        color="#F59E0B"
                      />
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
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STYLES
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  /* â”€â”€ HEADER â”€â”€ */
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
  profileAvatarImage: {
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
  headerLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  headerLocation: {
    fontSize: 13,
    color: "rgba(0,0,0,0.55)",
    fontWeight: "600",
    marginLeft: 2,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FFF8E1",
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFF",
  },

  /* â”€â”€ SEARCH â”€â”€ */
  searchBarWrap: {
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: -10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "500",
  },
  searchTuneBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  /* â”€â”€ SCROLL BODY â”€â”€ */
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 80,
  },

  /* â”€â”€ METRICS â”€â”€ */
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricCard: {
    width: "23%",
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricNum: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  /* â”€â”€ SORT â”€â”€ */
  sortMenu: {
    marginHorizontal: 16,
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sortMenuLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  sortOptions: {
    flexDirection: "row",
    gap: 8,
  },
  sortOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  sortOptionActive: {
    backgroundColor: "#FEF3C7",
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  sortOptionTextActive: {
    color: "#92400E",
    fontWeight: "800",
  },

  /* â”€â”€ FILTERS â”€â”€ */
  filtersScroll: {
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterChipTextActive: {
    color: "#FFF",
    fontWeight: "700",
  },

  /* â”€â”€ TABLE GRID â”€â”€ */
  tablesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  tableCard: {
    width: "48%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.2,
    borderColor: "#F0F0F0",
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
    borderColor: "#D5D5D5",
  },
  tableCardOccupied: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFDF5",
    shadowColor: "#F59E0B",
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
    color: "#1F2937",
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase" as any,
  },
  mergedBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  mergedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4338CA",
  },
  tableInfoSection: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
    marginLeft: 6,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 10,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    marginTop: 4,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    opacity: 0.6,
  },
  availableText: {
    marginTop: 8,
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  /* â”€â”€ BOTTOM SHEET â”€â”€ */
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 34,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
  },
  sheetSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  /* â”€â”€ TABLE ACTION SUMMARY â”€â”€ */
  statusCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  statusMain: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    letterSpacing: -0.5,
  },
  verticalDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },
  statusDetails: {
    justifyContent: "center",
    gap: 8,
  },
  statusDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDetailText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 10,
    textTransform: "uppercase" as any,
    letterSpacing: 0.5,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  actionBtnStyle: {
    width: "48%",
    backgroundColor: "#FFF",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtnPrimary: {
    backgroundColor: "#ECFDF5",
    borderColor: "#D1FAE5",
    shadowColor: "#10B981",
    shadowOpacity: 0.15,
    elevation: 4,
  },
  actionBtnPrimaryText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#047857",
  },
  actionBtnStyleText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  dangerBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
    marginLeft: 8,
  },

  /* â”€â”€ ACTIVITY MODAL â”€â”€ */
  modalTabsRow: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  modalTabBtnActive: {
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modalTabLabel: {
    fontWeight: "600",
    color: "#6B7280",
    fontSize: 14,
  },
  modalTabLabelActive: {
    color: "#111",
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  activityCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  activityCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  activityBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  activityBadgeText: {
    fontWeight: "800",
    color: "#D97706",
    fontSize: 14,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  activityNote: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
  },
  statusChip: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
    textTransform: "capitalize" as any,
  },
  activityActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  actBtnReject: {
    backgroundColor: "#FEF2F2",
  },
  actBtnRejectText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
  actBtnAccept: {
    backgroundColor: "#ECFDF5",
  },
  actBtnAcceptText: {
    color: "#059669",
    fontWeight: "700",
    fontSize: 13,
  },
  actBtnServe: {
    backgroundColor: "#EFF6FF",
  },
  actBtnServeText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 13,
  },

  /* â”€â”€ CENTERED DIALOGS â”€â”€ */
  centeredOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogBox: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
  },
  dialogItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dialogItemText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  dialogCloseBtn: {
    marginTop: 20,
    backgroundColor: "#1F2937",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  /* â”€â”€ PAYMENT MODE â”€â”€ */
  paymentModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  paymentModeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
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
});
