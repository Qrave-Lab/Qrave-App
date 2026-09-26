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
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ThemedText, type ThemedTextProps } from "../../components/common/ThemedText";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { WaiterColors } from "../../constants/theme";
import { api } from "../../lib/apiClient";
import WaiterWavyHeader from "../../components/waiter/WaiterWavyHeader";

type Table = {
  isPaid?: boolean;
  floorName?: string;
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
  menu_item_id?: string;
  variant_id?: string;
  quantity?: number;
  price?: number;
  menu_item_name?: string;
  variant_label?: string | null;
  notes?: string;
  description?: string;
  special_instructions?: string;
  instructions?: string;
};

type ActiveOrder = {
  id?: string;
  order_id?: string;
  status: string;
  created_at: string;
  session_id: string;
  table_id?: string;
  table_number: number;
  notes?: string;
  description?: string;
  special_instructions?: string;
  instructions?: string;
  customer_notes?: string;
  customer_name?: string;
  remarks?: string;
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [freeLoading, setFreeLoading] = useState<string | null>(null);

  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionTableId, setActionTableId] = useState<string | null>(null);
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [paidSessions, setPaidSessions] = useState<Set<string>>(new Set());
  const [selectedFloor, setSelectedFloor] = useState<string>("All Floors");
  const [floorModalOpen, setFloorModalOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);

  const [restaurantId, setRestaurantId] = useState<string>("");
  const [billGroups, setBillGroups] = useState<Map<number, BillGroupInfo>>(
    new Map(),
  );
  const [tablesData, setTablesData] = useState<Table[]>(SAMPLE_TABLES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Search input ref to clear focus
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const keyboardSub = Keyboard.addListener("keyboardDidHide", () => {
      searchInputRef.current?.blur();
    });
    return () => keyboardSub.remove();
  }, []);

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
          const isActive = t.is_active !== false && t.is_enabled !== false && t.status !== "disabled";
          return {
            id: String(tableId || tableNumber || t.name || t.id),
            tableId: tableId ? String(tableId) : undefined,
            number: tableNumber,
            isActive,
            items: t.items ?? 0,
            total: "-",
            status: (t.status === "disabled" || t.is_active === false || t.is_enabled === false) ? "disabled" : "free",
            time: t.time,
            flag: t.flag,
            floorName: t.floor_name ? String(t.floor_name) : "Main Floor",
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

  useFocusEffect(
    useCallback(() => {
      loadTables();
    }, [loadTables])
  );
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

  const getClientDescription = (order: ActiveOrder): string | null => {
    const note =
      order.special_instructions ||
      order.notes ||
      order.description ||
      order.instructions ||
      order.customer_notes ||
      order.remarks ||
      "";
    if (typeof note === "string" && note.trim().length > 0) {
      return note.trim();
    }
    return null;
  };

  const resolveTargetTableId = async (rawId: string) => {
    if (!rawId) return "";
    if (isUuid(rawId)) return rawId;

    // Check direct match in tablesData
    const directMatch = tablesData.find(
      (t) => t.id === rawId || t.tableId === rawId
    );
    if (directMatch?.tableId && isUuid(directMatch.tableId)) {
      return String(directMatch.tableId);
    }
    if (directMatch?.id && isUuid(directMatch.id)) {
      return String(directMatch.id);
    }

    const cleaned = String(rawId).replace(/\D/g, "");
    const asNumber = Number(cleaned);

    const localMatch = tablesData.find(
      (t) =>
        (t.id === rawId ||
          t.tableId === rawId ||
          (asNumber > 0 && getTableNumber(t) === asNumber)) &&
        (t.tableId || t.id),
    );
    if (localMatch?.tableId && isUuid(localMatch.tableId)) return String(localMatch.tableId);
    if (localMatch?.id && isUuid(localMatch.id)) return String(localMatch.id);
    if (localMatch?.tableId) return String(localMatch.tableId);
    if (localMatch?.id) return String(localMatch.id);

    try {
      const res = await api.get("/api/admin/tables");
      const normalized = normalizeTables(res);
      const match = normalized.find(
        (t: any) =>
          t.id === rawId ||
          t.tableId === rawId ||
          (asNumber > 0 && getTableNumber(t) === asNumber),
      );
      if (match?.tableId) return String(match.tableId);
      if (match?.id) return String(match.id);
      return rawId;
    } catch {
      return rawId;
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
        if (selectedFloor && selectedFloor !== "All Floors") {
          return t.floorName === selectedFloor;
        }
        return true;
      })
      .filter((t) => {
        if (filter === "occupied") return t.status === "occupied";
        if (filter === "free") return t.status === "free";
        if (filter === "bill") return t.flag === "bill";
        return true;
      })
      .filter((t) => {
        if (!search.trim()) return true;
        const searchStr = search.toLowerCase().trim();
        const tNum = getTableNumber(t);
        const displayedNum = padNumber(tNum);
        const rawNumStr = String(tNum);
        
        // Prefer exact matches or starting matches for numbers
        return (
          rawNumStr === searchStr ||
          displayedNum === searchStr ||
          rawNumStr.startsWith(searchStr) ||
          displayedNum.startsWith(searchStr) ||
          (t.name && t.name.toLowerCase().includes(searchStr))
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
  }, [filter, selectedFloor, search, sortBy, tablesWithOrders]);

  const floors = useMemo(() => {
    const floorSet = new Set(tablesData.map(t => t.floorName || "Main Floor"));
    return ["All Floors", ...Array.from(floorSet).sort()];
  }, [tablesData]);

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
      if (sessionsRes.status === "rejected") {
        errors.push(
          formatApiError(sessionsRes.reason, "Active sessions request failed"),
        );
      }

      setActiveOrders(ordersList);
      setActiveSessions(sessionsList);
      setServiceCalls(serviceCallsList);
      setTodaySales(salesTotal);
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

    // Look for active session in activeOrders or in activeSessions
    const sourceOrder = activeOrders.find(
      (o) => sourceNumber !== undefined && o.table_number === sourceNumber,
    );
    const sessionFromList = activeSessions.find(
      (s) => Number(s.table_number) === sourceNumber,
    );
    const sessionId =
      sourceOrder?.session_id ||
      sessionFromList?.session_id ||
      sessionFromList?.id;

    if (!sessionId) {
      setMoveError("No active session found for this table to move.");
      return;
    }

    const targetTable = tablesWithOrders.find(
      (t) => t.id === targetTableId || t.tableId === targetTableId,
    );
    const targetNumber = targetTable ? getTableNumber(targetTable) : undefined;
    const resolvedTargetId = await resolveTargetTableId(targetTableId);

    setMoveLoading(true);
    setMoveError(null);
    try {
      const payload: any = {
        session_id: sessionId,
      };
      if (resolvedTargetId) payload.target_table_id = resolvedTargetId;
      if (targetNumber !== undefined) payload.target_table_number = targetNumber;

      console.log("Move table payload", payload);
      await api.post("/api/admin/table-move", payload);
      await Promise.all([loadTables(), refreshActivities()]);
      setMoveModalOpen(false);
      setMoveSource(null);
      Alert.alert(
        "Table Moved",
        `Successfully moved Table ${sourceNumber ?? "?"} to Table ${targetNumber ?? "?"}.`,
      );
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
    
    const sourceSessionFromList = activeSessions.find((s) => Number(s.table_number) === sourceNumber);
    const targetSessionFromList = activeSessions.find((s) => Number(s.table_number) === targetNumber);

    const sourceSessionId = sourceOrder?.session_id || sourceSessionFromList?.session_id || sourceSessionFromList?.id;
    const targetSessionId = targetOrder?.session_id || targetSessionFromList?.session_id || targetSessionFromList?.id;

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

  const handleAskBill = async (targetTableId: string) => {
    if (!targetTableId) return;
    const table = tablesWithOrders.find((t) => t.id === targetTableId);
    if (!table) return;
    const tableNumber = getTableNumber(table);

    const session = activeSessions.find(
      (s) => Number(s.table_number) === tableNumber
    );
    const sessionId = session?.session_id || session?.id;

    if (!sessionId) {
      Alert.alert("Error", "No active session found for this table.");
      return;
    }

    try {
      await api.post(`/api/customer/orders/bill-request`, { session_id: sessionId });
      Alert.alert("Success", "Bill requested for table.");
      await refreshActivities();
    } catch (e: any) {
      Alert.alert("Error", e?.body?.message || e?.message || "Could not request bill.");
    }
  };

  const handleMarkPaid = async (targetTableId: string, mode: "cash" | "card" | "upi" = "cash") => {
    if (!targetTableId) return;
    const table = tablesWithOrders.find((t) => t.id === targetTableId);
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

            const session = activeSessions.find(
              (s) => Number(s.table_number) === tableNumber
            );
            const sessionId = session?.session_id || session?.id;
            const bg = tableNumber !== undefined ? billGroups.get(tableNumber) : undefined;

            try {
              let tablesToClear = tableNumber !== undefined ? [tableNumber] : [];
              if (bg) {
                tablesToClear = bg.linkedTableNumbers;
              }
              const ordersToCancel = activeOrders.filter(
                (o) => o.table_number !== undefined && tablesToClear.includes(o.table_number)
              );
              await Promise.all(
                ordersToCancel.map(async (o) => {
                  const id = o.id || o.order_id;
                  if (!id) return Promise.resolve();
                  try {
                    await api.patch(`/api/admin/orders/${id}/status`, { status: "cancelled" });
                  } catch (e) {
                    console.log("Failed to cancel order, it may already be completed:", id);
                  }
                })
              );

              if (sessionId || bg) {
                const sessionsToEnd = new Set<string>();
                if (bg) {
                  bg.linkedTableNumbers.forEach((tNum) => {
                    const s = activeSessions.find((s) => Number(s.table_number) === tNum);
                    if (s?.session_id || s?.id) sessionsToEnd.add(s.session_id || s.id);
                  });
                } else if (sessionId) {
                  sessionsToEnd.add(sessionId);
                }

                await Promise.all(
                  Array.from(sessionsToEnd).map((id) =>
                    api.post(`/api/admin/sessions/${id}/end`)
                  )
                );
              }
            } catch (e: any) {
              Alert.alert("Error", e?.body?.message || e?.message || "Failed to free table.");
              setFreeLoading(null);
              return; // Stop here, do not update UI if backend rejected
            }

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

            // Aggressively update session state locally to prevent UI reversion
            setActiveSessionTableNumbers((prev) => {
              const next = new Set(prev);
              if (tableNumber !== undefined) next.delete(tableNumber);
              if (bg) {
                bg.linkedTableNumbers.forEach(n => next.delete(n));
              }
              return next;
            });
            
            setActiveSessions((prev) => {
              return prev.filter((s) => {
                const num = Number(s.table_number);
                if (num === tableNumber) return false;
                if (bg && bg.linkedTableNumbers.includes(num)) return false;
                return true;
              });
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

  useFocusEffect(
    useCallback(() => {
      refreshActivities();
      // Fetch restaurant_id for payment
      (async () => {
        try {
          const me: any = await api.get("/api/admin/me");
          setRestaurantId(me?.restaurant_id || "");
        } catch {}
      })();
    }, [refreshActivities])
  );

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

  const uniqueFloors = useMemo(() => {
    const floors = Array.from(new Set(tablesData.map((t) => t.floorName))).filter(Boolean) as string[];
    return floors;
  }, [tablesData]);

  /* ── Computed values ── */
  const pendingOrders = activeOrders.filter((o) => o.status === "pending").length;
  const activeServiceCalls = serviceCalls.filter((c) => c.status !== "done").length;
  const kitchenCount = activities.filter(isKitchenVisible).length;
  const serviceCount = activities.filter(isServiceVisible).length;
  const totalActivityCount = kitchenCount + serviceCount;
  const occupiedTableCount = tablesWithOrders.filter((t) => t.status === "occupied").length;
  const freeTableCount = tablesWithOrders.filter((t) => t.status === "free").length;
  const billReqCount = tablesWithOrders.filter((t) => t.flag === "bill").length;
  const filterBadgeCount = occupiedTableCount + billReqCount;

  // Selected table for action sheet
  const actionTable = actionTableId ? tablesWithOrders.find((t) => t.id === actionTableId) : null;
  const actionTableNumber = actionTable ? getTableNumber(actionTable) : undefined;
  const actionTableBg = actionTableNumber !== undefined ? billGroups.get(actionTableNumber) : undefined;

  const actionTableOrders = useMemo(() => {
    if (actionTableNumber === undefined) return [];
    return activeOrders.filter((o) => {
      if (actionTableBg && actionTableBg.linkedTableNumbers.includes(o.table_number)) return true;
      return o.table_number === actionTableNumber;
    });
  }, [actionTableNumber, actionTableBg, activeOrders]);

  const isActionTablePending = useMemo(() => {
    return (
      actionTableOrders.some((o) => {
        const st = (o.status || "").toLowerCase();
        return st === "pending" || st === "new" || st === "accepted" || st === "preparing";
      }) ||
      ((actionTable?.items || 0) > 0 && actionTableOrders.length === 0 && !actionTable?.isPaid)
    );
  }, [actionTableOrders, actionTable]);

  const isActionTableDelivered = useMemo(() => {
    return (
      (actionTableOrders.length > 0 &&
        actionTableOrders.every((o) => {
          const st = (o.status || "").toLowerCase();
          return st === "delivered" || st === "ready" || st === "served" || st === "completed";
        })) ||
      Boolean(actionTable?.isPaid)
    );
  }, [actionTableOrders, actionTable]);

  const actionTableSessionId = useMemo(() => {
    const fromOrder = actionTableOrders.find((o) => o.session_id)?.session_id;
    if (fromOrder) return fromOrder;
    const session = activeSessions.find(
      (s) => Number(s.table_number) === actionTableNumber,
    );
    return session?.session_id || session?.id || "";
  }, [actionTableOrders, activeSessions, actionTableNumber]);

  const handleToggleSingleOrderStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus =
      currentStatus === "delivered" || currentStatus === "ready"
        ? "preparing"
        : "delivered";
    try {
      await api.patch(`/api/admin/orders/${orderId}/status`, { status: nextStatus });
      setActiveOrders((prev) =>
        prev.map((o) =>
          (o.id || o.order_id) === orderId ? { ...o, status: nextStatus } : o,
        ),
      );
      await refreshActivities();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update order status.");
    }
  };

  const handleMarkOrdersDelivered = async () => {
    if (actionTableOrders.length === 0) {
      Alert.alert("No Orders", "There are no active orders to mark as delivered.");
      return;
    }
    try {
      for (const o of actionTableOrders) {
        const id = o.id || o.order_id;
        if (id) {
          await api.patch(`/api/admin/orders/${id}/status`, { status: "delivered" });
        }
      }
      await refreshActivities();
      Alert.alert("Delivered", `All orders for Table ${actionTableNumber} marked as delivered.`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to mark orders as delivered.");
    }
  };

  const handleAddItemsToTable = () => {
    setActionSheetOpen(false);
    router.push({
      pathname: "/waiter/take-order",
      params: {
        table_id: actionTable?.tableId || actionTableId || "",
        table_number: actionTableNumber !== undefined ? String(actionTableNumber) : "",
        session_id: actionTableSessionId,
      },
    } as any);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";


  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.mainContainer}>
      {/* ── Light Fading Orange Header ── */}
      <WaiterWavyHeader height={sortMenuOpen ? 285 : 235}>
        <View style={{ paddingHorizontal: 18, marginBottom: 8, marginTop: 0 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: "#111", letterSpacing: -1 }}>
            {greeting}
          </Text>
        </View>
        {/* Row 1: Search bar (Airbnb style) */}
        <View style={styles.searchBarWrapHeader}>
          <View style={styles.searchBarHeader}>
            <MaterialIcons name="search" size={24} color="#111" style={{ marginRight: 12 }} />
            <View style={styles.searchBarTextCol}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInputHeaderTall}
                placeholder="Search tables..."
                placeholderTextColor="#111"
                value={search}
                onChangeText={setSearch}
              />
              <Text style={styles.searchBarSubtitle}>Any floor • Any status</Text>
            </View>
            <TouchableOpacity
              style={styles.searchFilterBtn}
              activeOpacity={0.6}
              onPress={() => setSortMenuOpen(!sortMenuOpen)}
            >
              <MaterialIcons name="tune" size={18} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sort Menu (Toggled directly below search bar) */}
        {sortMenuOpen && (
          <View style={styles.sortMenuHeader}>
            <Text style={styles.sortMenuLabelHeader}>Sort By:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(["number", "value", "time"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.7}
                  style={[
                    styles.sortOptionHeader,
                    sortBy === opt && styles.sortOptionHeaderActive,
                  ]}
                  onPress={() => setSortBy(opt)}
                >
                  <Text
                    style={[
                      styles.sortOptionTextHeader,
                      sortBy === opt && styles.sortOptionTextHeaderActive,
                    ]}
                  >
                    {opt === "number" ? "Number" : opt === "value" ? "Value" : "Time"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row 2: 3 Action Tabs (Airbnb Style) */}
        <View style={styles.headerTabsRow}>
          {/* 1. Floors */}
          <TouchableOpacity 
            style={styles.headerTabItem} 
            activeOpacity={0.5}
            onPress={() => setFloorModalOpen(true)}
          >
            <View style={styles.tabIconWrapHeader}>
              <MaterialIcons name="storefront" size={24} color="#717171" />
            </View>
            <Text style={styles.headerTabText}>Floors</Text>
          </TouchableOpacity>

          {/* 2. Filters */}
          <TouchableOpacity 
            style={styles.headerTabItem} 
            activeOpacity={0.5}
            onPress={() => setFilterModalOpen(true)}
          >
            <View style={styles.tabIconWrapHeader}>
              <MaterialIcons name="filter-list" size={24} color="#717171" />
              {filterBadgeCount > 0 && (
                <View style={styles.redBadgeCircle}>
                  <Text style={styles.redBadgeCircleText}>
                    {filterBadgeCount > 9 ? "9+" : filterBadgeCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.headerTabText}>Filters</Text>
          </TouchableOpacity>

          {/* 3. Services */}
          <TouchableOpacity
            style={styles.headerTabItem}
            activeOpacity={0.5}
            onPress={() => {
              setActivitySheetOpen(true);
              refreshActivities();
            }}
          >
            <View style={styles.tabIconWrapHeader}>
              <MaterialIcons name="room-service" size={24} color="#717171" />
              {totalActivityCount > 0 && (
                <View style={styles.redBadgeCircle}>
                  <Text style={styles.redBadgeCircleText}>
                    {totalActivityCount > 9 ? "9+" : totalActivityCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.headerTabText}>Services</Text>
          </TouchableOpacity>
        </View>
      </WaiterWavyHeader>

      {/* ── Main Scroll Body ── */}
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
          />
        }
      >
        {loading && (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color="#F97316" />
            <Text style={{ marginTop: 6, color: "#9CA3AF", fontSize: 13 }}>
              Loading tables...
            </Text>
          </View>
        )}
        {error && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#EF4444" }}>{error}</Text>
          </View>
        )}

        {/* ── Metrics Row (Spotify Style Grid) ── */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => setFilter("all")}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: "#FFF7ED" }]}>
              <MaterialIcons name="pending-actions" size={22} color="#F97316" />
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricNum}>{pendingOrders}</Text>
              <Text style={styles.metricLabel}>Pending</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: "#FEF2F2" }]}>
              <MaterialIcons name="receipt-long" size={22} color="#EF4444" />
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricNum}>0</Text>
              <Text style={styles.metricLabel}>Bills</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
              <MaterialIcons name="room-service" size={22} color="#3B82F6" />
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricNum}>{activeServiceCalls}</Text>
              <Text style={styles.metricLabel}>Services</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: "#F5F3FF" }]}>
              <MaterialIcons name="timer" size={22} color="#8B5CF6" />
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricNum}>0</Text>
              <Text style={styles.metricLabel}>Long Sit</Text>
            </View>
          </TouchableOpacity>
        </View>




        {/* ── Table Grid ── */}
        <View style={styles.tablesGrid}>
          {(() => {
            const totalTablesCount = tables.length;
            const columns = totalTablesCount <= 6 ? 2 : totalTablesCount <= 12 ? 3 : 4;
            const is2Col = columns === 2;
            const is3Col = columns === 3;
            const is4Col = columns === 4;

            const dynWidth = is2Col ? "48%" : is3Col ? "31.5%" : "23.5%";
            const dynRatio = is2Col ? 1.05 : is3Col ? 0.95 : 1;
            const dynPad = is2Col ? 16 : is3Col ? 12 : 8;
            const dynNumSize = is2Col ? 32 : is3Col ? 24 : 18;
            const dynTotalSize = is2Col ? 20 : is3Col ? 16 : 14;
            const dynInfoSize = is2Col ? 14 : is3Col ? 12 : 10;
            const dynDotSize = is2Col ? 16 : is3Col ? 12 : 10;

            return tables.map((item) => {
              const tNum = getTableNumber(item);
              const isDisabled = item.isActive === false || item.status === "disabled";
              const isFree = item.status === "free" && !isDisabled;
              const isBillReq = item.flag === "bill";
              const bg = tNum !== undefined ? billGroups.get(tNum) : undefined;

              const tableOrders = activeOrders.filter((o) => {
                if (tNum === undefined) return false;
                if (bg && bg.linkedTableNumbers.includes(o.table_number)) return true;
                return o.table_number === tNum;
              });

              const isPending = !isFree && !isDisabled && (
                tableOrders.some((o) => {
                  const s = (o.status || "").toLowerCase();
                  return s === "pending" || s === "new" || s === "accepted" || s === "preparing";
                }) ||
                (item.items > 0 && tableOrders.length === 0 && !item.isPaid)
              );

              const isDelivered = !isFree && !isDisabled && !isPending && (
                (tableOrders.length > 0 && tableOrders.every((o) => {
                  const s = (o.status || "").toLowerCase();
                  return s === "delivered" || s === "ready" || s === "served" || s === "completed";
                })) ||
                Boolean(item.isPaid)
              );

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.tableCard,
                    { width: dynWidth as any, aspectRatio: dynRatio, padding: dynPad },
                    isDisabled && { backgroundColor: "#F3F4F6", opacity: 0.5 },
                    isFree && styles.tableCardFree,
                    !isFree && !isDisabled && isPending && styles.tableCardPending,
                    !isFree && !isDisabled && isDelivered && styles.tableCardDelivered,
                    !isFree && !isDisabled && !isPending && !isDelivered && !isBillReq && styles.tableCardOccupied,
                    isBillReq && styles.tableCardBill,
                    item.isPaid ? styles.tablePaid : null,
                  ]}
                  activeOpacity={isDisabled ? 1 : 0.7}
                  onPress={() => {
                    if (isFree && !isDisabled) {
                      router.push({
                        pathname: "/waiter/take-order",
                        params: { table_id: item.tableId || item.id, table_number: tNum },
                      });
                    } else if (!isDisabled) {
                      setActionTableId(item.id);
                      setActionSheetOpen(true);
                    }
                  }}
                >
                  {/* Header: Table Number & Status Dot */}
                  <View style={styles.tableCardHeader}>
                    <Text style={[styles.tableNumber, { fontSize: dynNumSize }]}>{padNumber(tNum)}</Text>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          width: dynDotSize,
                          height: dynDotSize,
                          borderRadius: dynDotSize / 2,
                          backgroundColor: isDisabled
                            ? "#9CA3AF"
                            : isFree
                              ? "#D1D5DB"
                              : item.isPaid
                                ? "#10B981"
                                : isPending
                                  ? "#EF4444"
                                  : isDelivered
                                    ? "#10B981"
                                    : isBillReq
                                      ? "#EF4444"
                                      : "#F97316",
                        },
                      ]}
                    />
                  </View>

                  {/* Merged badge */}
                  {bg && bg.linkedTableNumbers.length > 1 && (
                    <View style={styles.mergedBadgeSmall}>
                      <Text style={[styles.mergedBadgeTextSmall, { fontSize: is4Col ? 8 : 9 }]}>
                        🔗 T{bg.linkedTableNumbers.filter((n) => n !== tNum).join(",T")}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    {isDisabled ? (
                      <Text style={[styles.emptyStateText, { fontSize: dynInfoSize + 2 }]}>Disabled</Text>
                    ) : isFree ? (
                      <Text style={[styles.emptyStateText, { fontSize: dynInfoSize + 2 }]}>Available</Text>
                    ) : (
                      <>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={[styles.infoTextSm, { fontSize: dynInfoSize }]}>{item.items} Items</Text>
                          {isPending ? (
                            <View style={styles.statusBadgePendingSmall}>
                              <Text style={[styles.statusBadgePendingSmallText, { fontSize: is4Col ? 7 : 8 }]}>Pending</Text>
                            </View>
                          ) : isDelivered ? (
                            <View style={styles.statusBadgeDeliveredSmall}>
                              <Text style={[styles.statusBadgeDeliveredSmallText, { fontSize: is4Col ? 7 : 8 }]}>Delivered</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.totalAmountSm, { fontSize: dynTotalSize }]} numberOfLines={1} adjustsFontSizeToFit>{item.total}</Text>
                        <Text style={[styles.timeTextSm, { fontSize: dynInfoSize - 1 }]}>{item.time || "0m"}</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            });
          })()}
        </View>
      </ScrollView>
      {/* ═════════════════════════════════════════════════════════════════════ 
         TABLE ACTION / ORDER DETAILS BOTTOM SHEET
         ═════════════════════════════════════════════════════════════════════ */}
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
          <View style={styles.orderWindowContainer}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.sheetTitle}>
                    Table {actionTableNumber !== undefined ? padNumber(actionTableNumber) : "?"}
                  </Text>
                  {actionTable?.isPaid ? (
                    <View style={styles.paidHeaderBadge}>
                      <MaterialIcons name="check-circle" size={13} color="#059669" />
                      <Text style={styles.paidHeaderBadgeText}>PAID</Text>
                    </View>
                  ) : isActionTableDelivered ? (
                    <View style={styles.deliveredHeaderBadge}>
                      <MaterialIcons name="check-circle" size={13} color="#059669" />
                      <Text style={styles.deliveredHeaderBadgeText}>DELIVERED</Text>
                    </View>
                  ) : isActionTablePending ? (
                    <View style={styles.pendingHeaderBadge}>
                      <MaterialIcons name="hourglass-top" size={13} color="#DC2626" />
                      <Text style={styles.pendingHeaderBadgeText}>PENDING</Text>
                    </View>
                  ) : null}
                </View>
                {actionTableBg && actionTableBg.linkedTableNumbers.length > 1 && (
                  <Text style={styles.sheetSubtitle}>
                    🔗 Merged with T
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
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Status Banner (Red for Pending, Green for Delivered) ── */}
              {isActionTablePending ? (
                <View style={styles.statusBannerPending}>
                  <View style={styles.statusBannerLeft}>
                    <MaterialIcons name="hourglass-top" size={22} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusBannerTitlePending}>ORDER PENDING PREPARATION</Text>
                      <Text style={styles.statusBannerSubPending}>Kitchen is cooking items for this table</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.bannerDeliveredBtn}
                    onPress={handleMarkOrdersDelivered}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="done-all" size={16} color="#FFF" />
                    <Text style={styles.bannerDeliveredBtnText}>Mark Delivered</Text>
                  </TouchableOpacity>
                </View>
              ) : isActionTableDelivered ? (
                <View style={styles.statusBannerDelivered}>
                  <View style={styles.statusBannerLeft}>
                    <MaterialIcons name="check-circle" size={22} color="#059669" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusBannerTitleDelivered}>ALL ORDERS DELIVERED</Text>
                      <Text style={styles.statusBannerSubDelivered}>All items have been served to guests</Text>
                    </View>
                  </View>
                  <View style={styles.servedBadge}>
                    <Text style={styles.servedBadgeText}>SERVED ✓</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.statusBannerSeated}>
                  <MaterialIcons name="table-restaurant" size={20} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusBannerTitleSeated}>TABLE OCCUPIED</Text>
                    <Text style={styles.statusBannerSubSeated}>Guests seated • Tap 'Add Items / Take Order' below</Text>
                  </View>
                </View>
              )}

              {/* Summary Bar */}
              <View style={styles.statusCard}>
                <View style={styles.statusMain}>
                  <Text style={styles.statusLabel}>Current Bill</Text>
                  <Text style={styles.statusValue}>{actionTable?.total || "-"}</Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.statusDetails}>
                  <View style={styles.statusDetailRow}>
                    <MaterialIcons name="restaurant" size={16} color="#6B7280" />
                    <Text style={styles.statusDetailText}>
                      {actionTable?.items || 0} Total Items
                    </Text>
                  </View>
                  <View style={styles.statusDetailRow}>
                    <MaterialIcons name="schedule" size={16} color="#6B7280" />
                    <Text style={styles.statusDetailText}>{actionTable?.time || "0m"}</Text>
                  </View>
                </View>
              </View>

              {/* ── Order Details & Client Special Instructions ── */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                  Active Orders ({actionTableOrders.length})
                </Text>
                {actionTableOrders.length > 0 && (
                  <TouchableOpacity
                    onPress={handleMarkOrdersDelivered}
                    style={styles.markAllSmallBtn}
                  >
                    <MaterialIcons name="done-all" size={14} color="#059669" />
                    <Text style={styles.markAllSmallBtnText}>Mark All Delivered</Text>
                  </TouchableOpacity>
                )}
              </View>

              {actionTableOrders.length > 0 ? (
                <View style={styles.ordersListContainer}>
                  {actionTableOrders.map((ord, oIdx) => {
                    const clientNote = getClientDescription(ord);
                    const ordId = ord.id || ord.order_id || `order-${oIdx}`;
                    const shortId = ordId.length > 8 ? ordId.slice(-6) : ordId;
                    const isDelivered =
                      ord.status === "delivered" ||
                      ord.status === "ready" ||
                      ord.status === "completed" ||
                      ord.status === "served";

                    return (
                      <View key={ordId} style={styles.orderCardBox}>
                        <View style={styles.orderCardHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.orderCardId}>Order #{shortId}</Text>
                            <View
                              style={[
                                styles.orderStatusPill,
                                isDelivered ? styles.orderStatusPillDelivered : styles.orderStatusPillPending,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.orderStatusPillText,
                                  isDelivered ? styles.orderStatusPillDeliveredText : styles.orderStatusPillPendingText,
                                ]}
                              >
                                {isDelivered ? "DELIVERED" : "PENDING"}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.orderStatusToggleBtn,
                              isDelivered ? styles.orderStatusToggleBtnGreen : styles.orderStatusToggleBtnOrange,
                            ]}
                            onPress={() => handleToggleSingleOrderStatus(ordId, ord.status)}
                          >
                            <MaterialIcons
                              name={isDelivered ? "undo" : "check"}
                              size={14}
                              color={isDelivered ? "#059669" : "#C2410C"}
                            />
                            <Text
                              style={[
                                styles.orderStatusToggleBtnText,
                                isDelivered ? { color: "#059669" } : { color: "#C2410C" },
                              ]}
                            >
                              {isDelivered ? "Reset" : "Deliver"}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Client Instructions Callout */}
                        {clientNote ? (
                          <View style={styles.orderClientNoteCallout}>
                            <View style={styles.orderClientNoteHeader}>
                              <MaterialIcons name="speaker-notes" size={14} color="#B45309" />
                              <Text style={styles.orderClientNoteTitle}>CLIENT INSTRUCTIONS</Text>
                            </View>
                            <Text style={styles.orderClientNoteBody}>{clientNote}</Text>
                          </View>
                        ) : null}

                        {/* Items in this order */}
                        <View style={styles.orderItemsList}>
                          {(ord.items || []).map((it, iIdx) => {
                            const itemNote =
                              it.notes || it.description || it.special_instructions || it.instructions;
                            return (
                              <View key={`${ordId}-item-${iIdx}`} style={styles.orderItemRow}>
                                <View style={styles.orderItemQtyBadge}>
                                  <Text style={styles.orderItemQtyText}>x{it.quantity || 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.orderItemName}>
                                    {it.menu_item_name || "Item"}
                                  </Text>
                                  {it.variant_label ? (
                                    <Text style={styles.orderItemVariant}>
                                      Option: {it.variant_label}
                                    </Text>
                                  ) : null}
                                  {itemNote ? (
                                    <Text style={styles.orderItemNote}>Note: {itemNote}</Text>
                                  ) : null}
                                </View>
                                {it.price ? (
                                  <Text style={styles.orderItemPrice}>
                                    Rs {(Number(it.price) * (Number(it.quantity) || 1)).toLocaleString()}
                                  </Text>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyOrdersCard}>
                  <MaterialIcons name="restaurant-menu" size={28} color="#D1D5DB" />
                  <Text style={styles.emptyOrdersCardTitle}>No order items found</Text>
                  <Text style={styles.emptyOrdersCardSubtitle}>
                    Tap 'Take Order / Add Items' below to record food orders.
                  </Text>
                </View>
              )}

              {/* Primary Action Button */}
              <TouchableOpacity
                style={styles.primaryAddItemsBtn}
                onPress={handleAddItemsToTable}
                activeOpacity={0.8}
              >
                <MaterialIcons name="post-add" size={22} color="#FFF" />
                <Text style={styles.primaryAddItemsBtnText}>Take Order / Add Items</Text>
              </TouchableOpacity>

              {/* Quick Actions Grid */}
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Quick Table Actions</Text>
              <View style={styles.actionGrid}>
                <TouchableOpacity
                  style={[styles.actionBtnStyle, styles.actionBtnPrimary]}
                  onPress={() => {
                    setActionSheetOpen(false);
                    if (actionTableId) {
                      handleMarkPaid(actionTableId, "cash");
                    }
                  }}
                >
                  <MaterialIcons name="payments" size={22} color="#047857" />
                  <Text style={styles.actionBtnPrimaryText}>Mark Paid</Text>
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
                  <MaterialIcons name="swap-horiz" size={22} color="#6B7280" />
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
                  <MaterialIcons name="merge-type" size={22} color="#6B7280" />
                  <Text style={styles.actionBtnStyleText}>Merge</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnStyle}
                  onPress={() => {
                    setActionSheetOpen(false);
                    setPrintSource(actionTableId);
                    setPrintModalOpen(true);
                  }}
                >
                  <MaterialIcons name="print" size={22} color="#6B7280" />
                  <Text style={styles.actionBtnStyleText}>Print</Text>
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ACTIVITY FEED MODAL (OKX Style) ── */}
      <Modal
        visible={activitySheetOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setActivitySheetOpen(false)}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActivitySheetOpen(false)}
          />
          <View style={[styles.okxDialogBox, { paddingVertical: 20 }]}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 16 }}>
              Activity Feed
            </Text>

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
                <ActivityIndicator size="large" color="#F97316" />
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

      {/* ═════════════════════════════════════════════════════════════════════ 
         MERGE MODAL (Redesigned)
         ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={mergeModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!mergeLoading) {
            setMergeModalOpen(false);
            setMergeError(null);
          }
        }}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (!mergeLoading) {
                setMergeModalOpen(false);
                setMergeError(null);
              }
            }}
          />
          <View style={styles.modernMoveDialog}>
            <View style={styles.moveDialogHeader}>
              <View style={[styles.moveIconBadge, { backgroundColor: "#EEF2FF" }]}>
                <MaterialIcons name="merge-type" size={24} color="#4338CA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moveDialogTitle}>Merge Table</Text>
                <Text style={styles.moveDialogSubtitle}>
                  {(() => {
                    const src = tablesWithOrders.find((t) => t.id === mergeSource);
                    const label = src
                      ? `Table ${src.number ?? getTableNumber(src) ?? src.id}`
                      : mergeSource;
                    return `Combine ${label} bill with another table`;
                  })()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!mergeLoading) {
                    setMergeModalOpen(false);
                    setMergeError(null);
                  }
                }}
                style={styles.closeBtnSmall}
              >
                <MaterialIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {mergeError ? (
              <View style={styles.moveErrorBox}>
                <MaterialIcons name="error-outline" size={16} color="#DC2626" />
                <Text style={styles.moveErrorText}>{mergeError}</Text>
              </View>
            ) : null}

            {mergeLoading ? (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={{ marginTop: 10, color: "#6B7280", fontWeight: "600" }}>
                  Merging bills...
                </Text>
              </View>
            ) : (
              <FlatList
                data={tablesWithOrders.filter(
                  (t) => t.id !== mergeSource && t.status === "occupied",
                )}
                keyExtractor={(t) => t.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const targetNum = item.number ?? getTableNumber(item) ?? item.id;
                  return (
                    <TouchableOpacity
                      style={styles.moveDestinationCard}
                      onPress={() => handleMergeTable(item.id)}
                      activeOpacity={0.7}
                      disabled={mergeLoading}
                    >
                      <View style={styles.moveDestLeft}>
                        <View style={[styles.moveTablePill, { backgroundColor: "#E0E7FF" }]}>
                          <Text style={[styles.moveTablePillText, { color: "#4338CA" }]}>T{targetNum}</Text>
                        </View>
                        <View>
                          <Text style={styles.moveTableTitle}>Table {targetNum}</Text>
                          <Text style={styles.moveTableFloor}>
                            {item.total} • {item.items} items
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.moveActionPill, { backgroundColor: "#4338CA" }]}>
                        <Text style={styles.moveActionPillText}>Merge</Text>
                        <MaterialIcons name="merge-type" size={16} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <MaterialIcons name="merge-type" size={36} color="#9CA3AF" />
                    <Text style={{ color: "#6B7280", fontWeight: "700", marginTop: 8 }}>
                      No Occupied Tables
                    </Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 2, textAlign: "center" }}>
                      Other tables need active orders to merge with.
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
              style={styles.moveCancelBtn}
            >
              <Text style={styles.moveCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════ 
         MOVE MODAL (Redesigned)
         ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={moveModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!moveLoading) {
            setMoveModalOpen(false);
            setMoveError(null);
          }
        }}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (!moveLoading) {
                setMoveModalOpen(false);
                setMoveError(null);
              }
            }}
          />
          <View style={styles.modernMoveDialog}>
            <View style={styles.moveDialogHeader}>
              <View style={styles.moveIconBadge}>
                <MaterialIcons name="swap-horiz" size={24} color="#C2410C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moveDialogTitle}>Move Table</Text>
                <Text style={styles.moveDialogSubtitle}>
                  {(() => {
                    const src = tablesData.find((t) => t.id === moveSource);
                    const label = src
                      ? `Table ${src.number ?? getTableNumber(src) ?? src.id}`
                      : moveSource;
                    return `Move ${label} to an available table`;
                  })()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!moveLoading) {
                    setMoveModalOpen(false);
                    setMoveError(null);
                  }
                }}
                style={styles.closeBtnSmall}
              >
                <MaterialIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {moveError ? (
              <View style={styles.moveErrorBox}>
                <MaterialIcons name="error-outline" size={16} color="#DC2626" />
                <Text style={styles.moveErrorText}>{moveError}</Text>
              </View>
            ) : null}

            {moveLoading ? (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={{ marginTop: 10, color: "#6B7280", fontWeight: "600" }}>
                  Moving table session...
                </Text>
              </View>
            ) : (
              <FlatList
                data={tablesWithOrders.filter(
                  (t) => t.id !== moveSource && t.status === "free",
                )}
                keyExtractor={(t) => t.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const targetNum = item.number ?? getTableNumber(item) ?? item.id;
                  return (
                    <TouchableOpacity
                      style={styles.moveDestinationCard}
                      onPress={() => {
                        const targetId = item.tableId || item.id;
                        if (!targetId) {
                          setMoveError("Target table ID missing. Please refresh.");
                          return;
                        }
                        handleMoveTable(targetId);
                      }}
                      activeOpacity={0.7}
                      disabled={moveLoading}
                    >
                      <View style={styles.moveDestLeft}>
                        <View style={styles.moveTablePill}>
                          <Text style={styles.moveTablePillText}>T{targetNum}</Text>
                        </View>
                        <View>
                          <Text style={styles.moveTableTitle}>Table {targetNum}</Text>
                          <Text style={styles.moveTableFloor}>
                            {item.floorName || "Available Floor"} • Ready for guests
                          </Text>
                        </View>
                      </View>
                      <View style={styles.moveActionPill}>
                        <Text style={styles.moveActionPillText}>Move Here</Text>
                        <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <MaterialIcons name="event-busy" size={36} color="#9CA3AF" />
                    <Text style={{ color: "#6B7280", fontWeight: "700", marginTop: 8 }}>
                      No Available Tables
                    </Text>
                    <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 2, textAlign: "center" }}>
                      All tables are occupied or disabled. Free up a table to move.
                    </Text>
                  </View>
                }
              />
            )}

            <TouchableOpacity
              onPress={() => {
                if (!moveLoading) {
                  setMoveModalOpen(false);
                  setMoveError(null);
                }
              }}
              style={styles.moveCancelBtn}
            >
              <Text style={styles.moveCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════ 
         PRINT MODAL (Redesigned)
         ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={printModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPrintModalOpen(false)}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPrintModalOpen(false)}
          />
          <View style={styles.modernMoveDialog}>
            <View style={styles.moveDialogHeader}>
              <View style={[styles.moveIconBadge, { backgroundColor: "#F0F9FF" }]}>
                <MaterialIcons name="print" size={24} color="#0369A1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moveDialogTitle}>Print Bill</Text>
                <Text style={styles.moveDialogSubtitle}>
                  Export or share the bill
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPrintModalOpen(false)}
                style={styles.closeBtnSmall}
              >
                <MaterialIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.moveDestinationCard, { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }]}
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
              activeOpacity={0.7}
            >
              <View style={styles.moveDestLeft}>
                <View style={[styles.moveTablePill, { backgroundColor: "#E0F2FE" }]}>
                  <MaterialIcons name="description" size={18} color="#0369A1" />
                </View>
                <View>
                  <Text style={styles.moveTableTitle}>Export as CSV</Text>
                  <Text style={styles.moveTableFloor}>Share bill data via system share</Text>
                </View>
              </View>
              <View style={[styles.moveActionPill, { backgroundColor: "#0369A1" }]}>
                <Text style={styles.moveActionPillText}>Export</Text>
                <MaterialIcons name="share" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPrintModalOpen(false)}
              style={styles.moveCancelBtn}
            >
              <Text style={styles.moveCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════ 
         MARK AS PAID MODAL
         ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={paidModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!paidLoading) {
            setPaidModalOpen(false);
            setPaidSource(null);
          }
        }}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (!paidLoading) {
                setPaidModalOpen(false);
                setPaidSource(null);
              }
            }}
          />
          <View style={styles.modernMoveDialog}>
            <View style={styles.moveDialogHeader}>
              <View style={[styles.moveIconBadge, { backgroundColor: "#DCFCE7" }]}>
                <MaterialIcons name="payments" size={24} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moveDialogTitle}>Mark as Paid</Text>
                {(() => {
                  const tbl = tablesWithOrders.find((t) => t.id === paidSource);
                  const tblNumber = tbl ? getTableNumber(tbl) : undefined;
                  const bg = tblNumber !== undefined ? billGroups.get(tblNumber) : undefined;
                  if (bg) {
                    return (
                      <Text style={styles.moveDialogSubtitle}>
                        Paying will settle & free all {bg.linkedTableNumbers.length} tables (Combined bill)
                      </Text>
                    );
                  }
                  return (
                    <Text style={styles.moveDialogSubtitle}>
                      Table {tblNumber ? `T${tblNumber}` : paidSource}
                    </Text>
                  );
                })()}
              </View>
              <TouchableOpacity
                style={styles.closeBtnSmall}
                onPress={() => {
                  if (!paidLoading) {
                    setPaidModalOpen(false);
                    setPaidSource(null);
                  }
                }}
              >
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {paidLoading ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#16A34A" />
                <Text style={{ marginTop: 10, color: "#6B7280", fontWeight: "600" }}>
                  Processing payment...
                </Text>
              </View>
            ) : (
              <View>
                <Text style={{ marginBottom: 12, fontWeight: "700", color: "#111827", fontSize: 13 }}>
                  Select Payment Mode
                </Text>
                {(["cash", "card", "upi"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={styles.moveDestinationCard}
                    onPress={() => handleMarkPaid(paidSource || "", mode)}
                  >
                    <View style={styles.moveDestLeft}>
                      <View style={[styles.moveTablePill, { backgroundColor: "#F3F4F6" }]}>
                        <MaterialIcons
                          name={
                            mode === "cash"
                              ? "payments"
                              : mode === "card"
                                ? "credit-card"
                                : "phone-android"
                          }
                          size={22}
                          color="#4B5563"
                        />
                      </View>
                      <View>
                        <Text style={styles.moveTableTitle}>
                          {mode === "cash"
                            ? "Cash"
                            : mode === "card"
                              ? "Card"
                              : "UPI"}
                        </Text>
                        <Text style={styles.moveTableFloor}>
                          {mode === "cash"
                            ? "Pay with cash"
                            : mode === "card"
                              ? "Debit/Credit card"
                              : "Google Pay, PhonePe, etc."}
                        </Text>
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            <TouchableOpacity
              style={styles.moveCancelBtn}
              onPress={() => {
                if (!paidLoading) {
                  setPaidModalOpen(false);
                  setPaidSource(null);
                }
              }}
            >
              <Text style={styles.moveCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── FILTER SELECTOR MODAL (OKX Style) ── */}
      <Modal visible={filterModalOpen} transparent animationType="fade" onRequestClose={() => setFilterModalOpen(false)}>
        <View style={styles.centeredOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFilterModalOpen(false)} />
          <View style={styles.okxDialogBox}>
            <TouchableOpacity
              style={styles.okxDialogItem}
              onPress={() => {
                setFilter("all");
                setFilterModalOpen(false);
              }}
            >
              <View style={styles.okxDialogLeft}>
                <MaterialIcons name="view-list" size={22} color="#4B5563" />
                <Text style={styles.okxDialogItemText}>All Tables</Text>
              </View>
              {filter === "all" && <MaterialIcons name="check-circle" size={22} color="#111" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.okxDialogItem}
              onPress={() => {
                setFilter("occupied");
                setFilterModalOpen(false);
              }}
            >
              <View style={styles.okxDialogLeft}>
                <MaterialIcons name="people-outline" size={22} color="#4B5563" />
                <Text style={styles.okxDialogItemText}>Occupied ({occupiedTableCount})</Text>
              </View>
              {filter === "occupied" && <MaterialIcons name="check-circle" size={22} color="#111" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.okxDialogItem}
              onPress={() => {
                setFilter("free");
                setFilterModalOpen(false);
              }}
            >
              <View style={styles.okxDialogLeft}>
                <MaterialIcons name="event-seat" size={22} color="#4B5563" />
                <Text style={styles.okxDialogItemText}>Available ({freeTableCount})</Text>
              </View>
              {filter === "free" && <MaterialIcons name="check-circle" size={22} color="#111" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.okxDialogItem}
              onPress={() => {
                setFilter("bill");
                setFilterModalOpen(false);
              }}
            >
              <View style={styles.okxDialogLeft}>
                <MaterialIcons name="receipt-long" size={22} color="#4B5563" />
                <Text style={styles.okxDialogItemText}>Bill Requested</Text>
              </View>
              {filter === "bill" && <MaterialIcons name="check-circle" size={22} color="#111" />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── FLOOR SELECTOR MODAL (OKX Style) ── */}
      <Modal visible={floorModalOpen} transparent animationType="fade" onRequestClose={() => setFloorModalOpen(false)}>
        <View style={styles.centeredOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFloorModalOpen(false)} />
          <View style={styles.okxDialogBox}>
            <TouchableOpacity
              style={styles.okxDialogItem}
              onPress={() => {
                setSelectedFloor("All Floors");
                setFloorModalOpen(false);
              }}
            >
              <View style={styles.okxDialogLeft}>
                <MaterialIcons name="layers" size={22} color="#4B5563" />
                <Text style={styles.okxDialogItemText}>All Floors</Text>
              </View>
              {selectedFloor === "All Floors" && <MaterialIcons name="check-circle" size={22} color="#111" />}
            </TouchableOpacity>

            {uniqueFloors.map((floor) => (
              <TouchableOpacity
                key={floor}
                style={styles.okxDialogItem}
                onPress={() => {
                  setSelectedFloor(floor);
                  setFloorModalOpen(false);
                }}
              >
                <View style={styles.okxDialogLeft}>
                  <MaterialIcons name="layers-clear" size={22} color="#4B5563" />
                  <Text style={styles.okxDialogItemText}>{floor}</Text>
                </View>
                {selectedFloor === floor && <MaterialIcons name="check-circle" size={22} color="#111" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
    </TouchableWithoutFeedback>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   STYLES
   ═════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  /* ── HEADER ── */
  headerTabsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 36,
  },
  headerTabItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTabItemActive: {
    borderBottomColor: "#222222",
  },
  tabIconWrapHeader: {
    marginBottom: 2,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTabText: {
    fontSize: 12,
    color: "#717171",
    fontWeight: "600",
  },
  headerTabTextActive: {
    color: "#222222",
    fontWeight: "700",
  },
  redBadgeCircle: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  redBadgeCircleText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "bold",
  },

  /* ── SEARCH BAR (inside header) ── */
  searchBarWrapHeader: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  searchBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingHorizontal: 20,
    height: 60,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchBarTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  searchInputHeaderTall: {
    fontSize: 15,
    color: "#111",
    fontWeight: "700",
    padding: 0,
    marginBottom: 0,
  },
  searchBarSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: -2,
  },
  searchFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sortMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 36, // Shifted more right
    marginTop: 8,
    paddingBottom: 4,
  },
  sortMenuLabelHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    marginRight: 12,
  },
  sortOptionHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    backgroundColor: "rgba(255, 255, 255, 0.25)", // Glassmorphism base
  },
  sortOptionHeaderActive: {
    borderColor: "rgba(255, 255, 255, 0.8)",
    backgroundColor: "rgba(255, 255, 255, 0.65)", // Glassmorphism active
  },
  sortOptionTextHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(0, 0, 0, 0.5)",
  },
  sortOptionTextHeaderActive: {
    color: "#111",
    fontWeight: "800",
  },

  /* ── SCROLL BODY ── */
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 80,
  },

  /* ── METRICS ── */
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  metricContent: {
    paddingLeft: 12,
    paddingRight: 8,
    flex: 1,
    justifyContent: "center",
  },
  metricNum: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },

  /* ── SORT ── */
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
    backgroundColor: "#FFF7ED",
    borderColor: "#F97316",
    borderWidth: 1,
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  sortOptionTextActive: {
    color: "#F97316",
    fontWeight: "800",
  },

  /* ── FILTERS ── */
  filtersScroll: {
    marginBottom: 14,
    paddingHorizontal: 16,
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
    backgroundColor: "#F97316",
    borderColor: "#F97316",
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

  /* ── TABLE GRID ── */
  tablesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  tableCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.04)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  /* ── TABLE LEGEND ── */
  tableLegendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
  },
  tableCardFree: {
    backgroundColor: "#F9FAFB",
    borderStyle: "dashed" as any,
    borderColor: "#E5E7EB",
    shadowOpacity: 0.02,
    elevation: 0,
  },
  tableCardPending: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
    shadowColor: "#EF4444",
    shadowOpacity: 0.16,
    borderWidth: 2,
  },
  tableCardDelivered: {
    borderColor: "#10B981",
    backgroundColor: "#ECFDF5",
    shadowColor: "#10B981",
    shadowOpacity: 0.16,
    borderWidth: 2,
  },
  tableCardOccupied: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    shadowColor: "#F97316",
    shadowOpacity: 0.12,
  },
  tableCardBill: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    shadowColor: "#EF4444",
    shadowOpacity: 0.12,
  },
  tablePaid: {
    borderColor: "#6EE7B7",
    backgroundColor: "#ECFDF5",
    shadowColor: "#10B981",
    shadowOpacity: 0.12,
  },
  statusBadgePendingSmall: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#FCA5A5",
  },
  statusBadgePendingSmallText: {
    color: "#DC2626",
    fontWeight: "800",
    fontSize: 8,
    textTransform: "uppercase",
  },
  statusBadgeDeliveredSmall: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#A7F3D0",
  },
  statusBadgeDeliveredSmallText: {
    color: "#059669",
    fontWeight: "800",
    fontSize: 8,
    textTransform: "uppercase",
  },
  tableCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tableNumber: {
    fontWeight: "900",
    color: "#111",
    letterSpacing: -1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  mergedBadgeSmall: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  mergedBadgeTextSmall: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4338CA",
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  infoTextSm: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 2,
  },
  totalAmountSm: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },
  timeTextSm: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
    marginTop: 2,
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
  orderWindowContainer: {
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  paidHeaderBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paidHeaderBadgeText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
  },
  deliveredHeaderBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deliveredHeaderBadgeText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
  },
  pendingHeaderBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pendingHeaderBadgeText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "800",
  },
  statusBannerPending: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
  },
  statusBannerDelivered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
  },
  statusBannerSeated: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#FDBA74",
    gap: 10,
  },
  statusBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  statusBannerTitlePending: {
    fontSize: 12,
    fontWeight: "900",
    color: "#DC2626",
  },
  statusBannerSubPending: {
    fontSize: 11,
    fontWeight: "600",
    color: "#991B1B",
    marginTop: 2,
  },
  statusBannerTitleDelivered: {
    fontSize: 12,
    fontWeight: "900",
    color: "#059669",
  },
  statusBannerSubDelivered: {
    fontSize: 11,
    fontWeight: "600",
    color: "#065F46",
    marginTop: 2,
  },
  statusBannerTitleSeated: {
    fontSize: 12,
    fontWeight: "900",
    color: "#C2410C",
  },
  statusBannerSubSeated: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9A3412",
    marginTop: 2,
  },
  bannerDeliveredBtn: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  bannerDeliveredBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 11,
  },
  servedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  servedBadgeText: {
    color: "#059669",
    fontWeight: "800",
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 6,
  },
  markAllSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  markAllSmallBtnText: {
    color: "#059669",
    fontWeight: "700",
    fontSize: 11,
  },
  ordersListContainer: {
    gap: 10,
    marginBottom: 14,
  },
  orderCardBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderCardId: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  orderStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderStatusPillPending: {
    backgroundColor: "#FEE2E2",
  },
  orderStatusPillDelivered: {
    backgroundColor: "#D1FAE5",
  },
  orderStatusPillText: {
    fontSize: 9,
    fontWeight: "900",
  },
  orderStatusPillPendingText: {
    color: "#DC2626",
  },
  orderStatusPillDeliveredText: {
    color: "#059669",
  },
  orderStatusToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  orderStatusToggleBtnGreen: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  orderStatusToggleBtnOrange: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  orderStatusToggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  orderClientNoteCallout: {
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  orderClientNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  orderClientNoteTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  orderClientNoteBody: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78350F",
    lineHeight: 16,
  },
  orderItemsList: {
    gap: 6,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  orderItemQtyBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  orderItemQtyText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1F2937",
  },
  orderItemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  orderItemVariant: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  orderItemNote: {
    fontSize: 11,
    color: "#D97706",
    fontStyle: "italic",
  },
  orderItemPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },
  emptyOrdersCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  emptyOrdersCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4B5563",
    marginTop: 6,
  },
  emptyOrdersCardSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 2,
  },
  primaryAddItemsBtn: {
    backgroundColor: "#F97316",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
    marginBottom: 8,
    shadowColor: "#F97316",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryAddItemsBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
  modernMoveDialog: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  moveDialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  moveIconBadge: {
    backgroundColor: "#FFF7ED",
    padding: 8,
    borderRadius: 12,
  },
  moveDialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  moveDialogSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  closeBtnSmall: {
    padding: 4,
  },
  moveErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  moveErrorText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  moveDestinationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  moveDestLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  moveTablePill: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  moveTablePillText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 12,
  },
  moveTableTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  moveTableFloor: {
    fontSize: 11,
    color: "#6B7280",
  },
  moveActionPill: {
    backgroundColor: "#F97316",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  moveActionPillText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 12,
  },
  moveCancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  moveCancelBtnText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 14,
  },
  dialogBox: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    width: "88%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  dialogItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dialogItemText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  mergedBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  mergedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4338CA",
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
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    shadowColor: "#F97316",
    shadowOpacity: 0.15,
    elevation: 4,
  },
  actionBtnPrimaryText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#C2410C",
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
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  activityBadgeText: {
    fontWeight: "800",
    color: "#EA580C",
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
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EA580C",
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
    backgroundColor: "#FFF7ED",
  },
  actBtnAcceptText: {
    color: "#EA580C",
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
    backgroundColor: "transparent", // Removed grayish overlay for performance
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  okxDialogBox: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  okxDialogItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  okxDialogLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  okxDialogItemText: {
    fontSize: 16,
    color: "#111",
    fontWeight: "500",
    marginLeft: 16,
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
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#FED7AA",
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
