import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AdminWavyHeader from "../../components/AdminWavyHeader";
import { AdminColors } from "../../constants/theme";
import apiClient, { persistAuthFromResponse, BASE_URL } from "../../lib/apiClient";
import iconPng from "../../assets/images/icon.png";
import { getStoredLogoVersion, withLogoVersion } from "../../lib/logoVersion";

type BranchOption = { id: string; label: string };

type SettingsCard = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  route?: string;
  danger?: boolean;
  muted?: boolean;
};

export default function AdminProfile() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 420;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingBranch, setSwitchingBranch] = useState(false);

  const [restaurant, setRestaurant] = useState("Settings Hub");
  const [currency, setCurrency] = useState("INR");
  const [activeBranchId, setActiveBranchId] = useState("");

  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [isNewBranchLocked, setIsNewBranchLocked] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const columns = width >= 1200 ? 3 : width >= 760 ? 2 : 1;

  const cards = useMemo<SettingsCard[]>(
    () => [
      {
        key: "profile",
        title: "Restaurant Profile",
        subtitle: "Brand details, logo, hours, phone, taxes",
        icon: "storefront",
        route: "/admin/profile-details",
      },
      {
        key: "floor",
        title: "Floor Plan",
        subtitle: "Manage tables, floors, and counters",
        icon: "table-restaurant",
        route: "/admin/settings-floor-plan",
      },
      {
        key: "team",
        title: "Team Members",
        subtitle: "Add, edit, and remove staff access",
        icon: "groups",
        route: "/admin/settings-team-members",
      },
      {
        key: "devices",
        title: "Devices & QR",
        subtitle: "POS printers and table QR tools",
        icon: "qr-code-2",
        route: "/admin/settings-devices",
      },
      {
        key: "takeaway",
        title: "Takeaway & Delivery",
        subtitle: "Take walk-in and delivery orders",
        icon: "delivery-dining",
        route: "/admin/settings-takeaway",
      },
      {
        key: "delivery-zones",
        title: "Delivery Zones",
        subtitle: "Configure delivery areas and fees by distance",
        icon: "place",
        route: "/admin/settings-delivery-zones",
      },
      {
        key: "theme",
        title: "Theme Studio",
        subtitle: "Customize customer menu visuals",
        icon: "palette",
        muted: true,
      },
      {
        key: "offers",
        title: "Offers & Coupons",
        subtitle: "Create deals, promo codes, and discounts",
        icon: "local-offer",
        route: "/admin/settings-offers",
      },
      {
        key: "kitchen",
        title: "Kitchen Capacity",
        subtitle: "Auto-throttle, ETA, and load limits",
        icon: "soup-kitchen",
        route: "/admin/settings-kitchen",
      },
      {
        key: "audit",
        title: "Audit Logs",
        subtitle: "Track critical actions across staff and system",
        icon: "fact-check",
        route: "/admin/settings-audit",
      },
      {
        key: "branch",
        title: "Add New Branch",
        subtitle: "Create another branch/location",
        icon: "add-business",
        route: "/admin/settings-branches",
      },
      {
        key: "access",
        title: "Role Access Control",
        subtitle: "Set feature access per staff role",
        icon: "admin-panel-settings",
        route: "/admin/settings-access-control",
      },
      {
        key: "subscription",
        title: "Subscription",
        subtitle: "Manage plan and billing status",
        icon: "credit-card",
        route: "/admin/subscription",
      },
      {
        key: "feedback",
        title: "Feedback & Issues",
        subtitle: "Report bugs, request features, or share thoughts",
        icon: "feedback",
        route: "/admin/settings-feedback",
      },
      {
        key: "delete",
        title: "Delete Account",
        subtitle: "Permanent account deletion",
        icon: "warning-amber",
        route: "/admin/delete-account",
        danger: true,
      },
    ],
    [],
  );

  const loadSettingsMeta = useCallback(async () => {
    const [meRes, locRes, branchRes, billingRes] = await Promise.allSettled([
      apiClient.get("/api/admin/me"),
      apiClient.get("/api/admin/locations"),
      apiClient.get("/api/admin/branches?include_archived=0"),
      apiClient.get("/api/admin/billing/status"),
    ]);

    if (meRes.status === "fulfilled") {
      setRestaurant(String(meRes.value?.restaurant || "Settings Hub"));
      setCurrency(String(meRes.value?.currency || "INR"));
    }

    if (locRes.status === "fulfilled") {
      const locations = Array.isArray(locRes.value?.locations)
        ? locRes.value.locations
        : [];
      const addressByRestaurant: Record<string, string> = {};
      const branchList =
        branchRes.status === "fulfilled"
          ? Array.isArray(branchRes.value?.branches)
            ? branchRes.value.branches
            : []
          : [];
      for (const branch of branchList) {
        const address = String(branch?.address || "").trim();
        if (address)
          addressByRestaurant[String(branch.restaurant_id)] = address;
      }

      const options = locations.map((loc: any) => {
        const rid = String(loc?.restaurant_id || "");
        const name = String(loc?.restaurant || "Branch");
        const addr = addressByRestaurant[rid];
        return {
          id: rid,
          label: addr ? `${name} - ${addr}` : name,
        };
      });
      setBranchOptions(options);
      const active = String(
        locRes.value?.active_restaurant_id || options[0]?.id || "",
      );
      setActiveBranchId(active);
      setSelectedBranchId(active);

      // Lock "Add New Branch" for base-plan users who already have 1+ branches
      const normalizedPlan = String(
        billingRes.status === "fulfilled" ? billingRes.value?.plan || "" : "",
      ).toLowerCase();
      const isPremiumPlan =
        normalizedPlan === "monthly_999" ||
        normalizedPlan === "monthly_1499" ||
        normalizedPlan === "yearly_10999" ||
        normalizedPlan === "yearly_14999";
      setIsNewBranchLocked(!isPremiumPlan && branchList.length >= 1);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadSettingsMeta();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSettingsMeta]);

  // Fetch logo for header avatar
  useEffect(() => {
    (async () => {
      try {
        const me: any = await apiClient.get("/api/admin/me");
        const rid = me?.restaurant_id || me?.data?.restaurant_id;
        if (!rid) return;
        const res = await fetch(
          `${BASE_URL}/public/restaurants/${rid}/logo`,
        );
        const data = await res.json();
        if (data.logo_url) {
          const version = await getStoredLogoVersion();
          setLogoUrl(withLogoVersion(data.logo_url, version) || "");
        }
      } catch {
        /* ignore – fallback icon shown */
      }
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadSettingsMeta();
    } finally {
      setRefreshing(false);
    }
  }, [loadSettingsMeta]);

  const switchBranch = useCallback(async () => {
    if (!selectedBranchId || switchingBranch) return;
    setSwitchingBranch(true);
    try {
      const switchRes = await apiClient.post("/api/admin/locations/switch", {
        restaurant_id: selectedBranchId,
      });
      await persistAuthFromResponse(switchRes);
      try {
        const userRaw = await AsyncStorage.getItem("user");
        if (userRaw) {
          const user = JSON.parse(userRaw);
          await AsyncStorage.setItem(
            "user",
            JSON.stringify({
              ...user,
              restaurant_id: Number(selectedBranchId) || selectedBranchId,
            }),
          );
        }
      } catch {}
      setActiveBranchId(selectedBranchId);
      setBranchPickerOpen(false);
      Alert.alert("Branch updated", "Dashboard context switched successfully.");
    } catch {
      Alert.alert("Switch failed", "Unable to switch branch right now.");
    } finally {
      setSwitchingBranch(false);
    }
  }, [selectedBranchId, switchingBranch]);

  const handleCardPress = useCallback(
    (card: SettingsCard) => {
      if (card.key === "branch" && isNewBranchLocked) {
        Alert.alert(
          "Plan Limit Reached",
          "Your current plan allows only one branch. Upgrade to add more.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "View Plans",
              onPress: () => router.push("/admin/subscription" as any),
            },
          ],
        );
        return;
      }
      if (card.route) {
        router.push(card.route as any);
        return;
      }
      Alert.alert(
        "Coming soon",
        `${card.title} will be available in app soon.`,
      );
    },
    [router, isNewBranchLocked],
  );

  const handleLogout = useCallback(() => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              "user",
              "qrave_jwt",
              "qrave_refresh",
              "qrave_csrf",
              "token",
            ]);
          } catch {}
          router.replace("/");
        },
      },
    ]);
  }, [router]);

  const activeBranchLabel =
    branchOptions.find((b) => b.id === activeBranchId)?.label ||
    "Select branch";

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={AdminColors.primary} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8CB46" />

      <AdminWavyHeader height={160}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.profileAvatar}
            activeOpacity={0.8}
            onPress={() => router.replace("/admin/profile")}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.profileImage} />
            ) : (
              <Image source={iconPng} style={styles.profileImage} />
            )}
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>
              {`${String(restaurant || "BRANCH").toUpperCase()} \u2022 ${currency}`}
            </Text>
          </View>
          <Pressable
            style={[
              styles.branchSelector,
              isCompact && styles.branchSelectorCompact,
            ]}
            onPress={() =>
              branchOptions.length > 0 && setBranchPickerOpen(true)
            }
          >
            <Text
              style={[
                styles.branchSelectorText,
                isCompact && styles.branchSelectorTextCompact,
              ]}
              numberOfLines={1}
            >
              {activeBranchLabel}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={isCompact ? 14 : 16}
              color="#6B7280"
            />
          </Pressable>
        </View>
      </AdminWavyHeader>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isCompact && styles.scrollContentCompact,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AdminColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.surfaceCard}>
          <Text
            style={[
              styles.sectionTitle,
              isCompact && styles.sectionTitleCompact,
            ]}
          >
            Manage Settings
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              isCompact && styles.sectionSubtitleCompact,
            ]}
          >
            Open a section to manage it in its own page.
          </Text>

          <View style={styles.gridWrap}>
            {cards.map((card) => {
              const locked = card.key === "branch" && isNewBranchLocked;
              return (
                <Pressable
                  key={card.key}
                  style={[
                    styles.settingCard,
                    isCompact && styles.settingCardCompact,
                    columns === 3
                      ? { width: "31.5%" }
                      : columns === 2
                        ? { width: "48.5%" }
                        : { width: "100%" },
                    card.danger && styles.settingCardDanger,
                    locked && { opacity: 0.45 },
                  ]}
                  onPress={() => handleCardPress(card)}
                >
                  <View
                    style={[
                      styles.settingIconWrap,
                      isCompact && styles.settingIconWrapCompact,
                    ]}
                  >
                    <MaterialIcons
                      name={card.icon as any}
                      size={isCompact ? 20 : 22}
                      color={card.danger ? "#B91C1C" : "#64748B"}
                    />
                  </View>
                  <View style={styles.settingBody}>
                    <Text
                      style={[
                        styles.settingTitle,
                        isCompact && styles.settingTitleCompact,
                        card.danger && styles.settingTitleDanger,
                      ]}
                    >
                      {card.title}
                    </Text>
                    <Text
                      style={[
                        styles.settingSubtitle,
                        isCompact && styles.settingSubtitleCompact,
                        card.muted && styles.settingSubtitleMuted,
                      ]}
                      numberOfLines={2}
                    >
                      {card.subtitle}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={locked ? "lock" : "arrow-forward"}
                    size={isCompact ? 20 : 22}
                    color="#94A3B8"
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[styles.logoutBtn, isCompact && styles.logoutBtnCompact]}
          onPress={handleLogout}
        >
          <View
            style={[
              styles.logoutIconWrap,
              isCompact && styles.logoutIconWrapCompact,
            ]}
          >
            <MaterialIcons
              name="logout"
              size={isCompact ? 20 : 22}
              color="#B91C1C"
            />
          </View>
          <Text
            style={[styles.logoutText, isCompact && styles.logoutTextCompact]}
          >
            Log Out
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={branchPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchPickerOpen(false)}
      >
        <View style={styles.branchOverlay}>
          <View style={styles.branchCard}>
            <Text style={styles.branchTitle}>Choose Branch</Text>
            <Text style={styles.branchSubtitleModal}>
              Select which location dashboard to open.
            </Text>

            <ScrollView
              style={styles.branchList}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {branchOptions.map((branch) => (
                <Pressable
                  key={branch.id}
                  onPress={() => setSelectedBranchId(branch.id)}
                  style={[
                    styles.branchOption,
                    selectedBranchId === branch.id && styles.branchOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.branchOptionText,
                      selectedBranchId === branch.id &&
                        styles.branchOptionTextActive,
                    ]}
                  >
                    {branch.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.branchActions}>
              <Pressable
                style={styles.branchCancelBtn}
                onPress={() => setBranchPickerOpen(false)}
                disabled={switchingBranch}
              >
                <Text style={styles.branchCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.branchConfirmBtn,
                  (!selectedBranchId || switchingBranch) &&
                    styles.branchConfirmBtnDisabled,
                ]}
                onPress={switchBranch}
                disabled={!selectedBranchId || switchingBranch}
              >
                {switchingBranch ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text style={styles.branchConfirmText}>Open Dashboard</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F5F9",
  },
  /* Header */
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
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
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F5F9",
  },
  loadingText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  branchSelector: {
    minWidth: 100,
    maxWidth: "38%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  branchSelectorCompact: {
    minWidth: 0,
    maxWidth: "42%",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  branchSelectorText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
    flex: 1,
  },
  branchSelectorTextCompact: {
    fontSize: 11,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 28,
  },
  scrollContentCompact: {
    padding: 10,
    paddingBottom: 20,
  },
  surfaceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  sectionTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionTitleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 20,
    color: "#64748B",
    marginBottom: 14,
  },
  sectionSubtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  settingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 104,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  settingCardCompact: {
    minHeight: 86,
    padding: 12,
    borderRadius: 14,
  },
  settingCardDanger: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFBFB",
  },
  settingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingIconWrapCompact: {
    width: 38,
    height: 38,
    borderRadius: 12,
    marginRight: 10,
  },
  settingBody: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 29,
    fontWeight: "800",
    color: "#0F172A",
  },
  settingTitleCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  settingTitleDanger: {
    color: "#7F1D1D",
  },
  settingSubtitle: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500",
  },
  settingSubtitleCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  settingSubtitleMuted: {
    color: "#94A3B8",
  },
  branchOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  branchCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  branchTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
  },
  branchSubtitleModal: {
    marginTop: 4,
    fontSize: 14,
    color: "#64748B",
  },
  branchList: {
    marginTop: 14,
    maxHeight: 260,
  },
  branchOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  branchOptionActive: {
    borderColor: "#F4B400",
    backgroundColor: "#FFFBEB",
  },
  branchOptionText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "700",
  },
  branchOptionTextActive: {
    color: "#92400E",
  },
  branchActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  branchCancelBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  branchCancelText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  branchConfirmBtn: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4B400",
  },
  branchConfirmBtnDisabled: {
    opacity: 0.55,
  },
  branchConfirmText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  logoutBtnCompact: {
    paddingVertical: 14,
    borderRadius: 14,
  },
  logoutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutIconWrapCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#B91C1C",
  },
  logoutTextCompact: {
    fontSize: 14,
  },
});
