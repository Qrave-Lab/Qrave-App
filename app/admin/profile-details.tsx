import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AdminSettingsHeader from "../../components/admin/AdminSettingsHeader";
import iconPng from "../../assets/images/icon.png";
import apiClient, { BASE_URL } from "../../lib/apiClient";
import {
  bumpLogoVersion,
  getStoredLogoVersion,
  withLogoVersion,
} from "../../lib/logoVersion";

const BRAND = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  label: "#94A3B8",
  primary: "#F4B400",
  primaryDark: "#B45309",
};

type TaxMode = "cgst_sgst" | "igst";
type TaxConfig = {
  mode?: TaxMode;
  inclusive?: boolean;
  cess_enabled?: boolean;
  cess_percent?: number;
};

const COUNTRY_CODES = [
  { code: "+91", label: "IN (+91)" },
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+61", label: "AU (+61)" },
  { code: "+65", label: "SG (+65)" },
  { code: "+971", label: "UAE (+971)" },
];

const PHONE_RULES: Record<
  string,
  { max: number; example: string; pattern: RegExp }
> = {
  "+91": { max: 10, example: "8012345678", pattern: /^[2-9][0-9]{9}$/ },
  "+1": {
    max: 10,
    example: "4155552671",
    pattern: /^[2-9][0-9]{2}[2-9][0-9]{6}$/,
  },
  "+44": { max: 10, example: "7123456789", pattern: /^7[0-9]{9}$/ },
  "+61": { max: 9, example: "412345678", pattern: /^4[0-9]{8}$/ },
  "+65": { max: 8, example: "91234567", pattern: /^[689][0-9]{7}$/ },
  "+971": { max: 9, example: "501234567", pattern: /^5[0-9]{8}$/ },
};

const GST_SLABS = [0, 5, 12, 18, 28] as const;

function splitE164Phone(value?: string): {
  countryCode: string;
  phone: string;
} {
  const raw = String(value || "").trim();
  if (!raw.startsWith("+"))
    return { countryCode: "+91", phone: raw.replace(/\D/g, "") };
  const digits = raw.slice(1).replace(/\D/g, "");
  if (!digits) return { countryCode: "+91", phone: "" };
  for (const code of [...COUNTRY_CODES].sort(
    (a, b) => b.code.length - a.code.length,
  )) {
    const cc = code.code.slice(1);
    if (digits.startsWith(cc)) {
      return { countryCode: code.code, phone: digits.slice(cc.length) };
    }
  }
  return { countryCode: "+91", phone: digits };
}

export default function ProfileDetails() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 400;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [currency, setCurrency] = useState("INR");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [restaurantName, setRestaurantName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [customTax, setCustomTax] = useState(false);
  const [serviceCharge, setServiceCharge] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [taxMode, setTaxMode] = useState<TaxMode>("cgst_sgst");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [cessEnabled, setCessEnabled] = useState(false);
  const [cessPercent, setCessPercent] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [orderingEnabled, setOrderingEnabled] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const pickLogo = useCallback(async () => {
    if (uploadingLogo) return;
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo access to update your logo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const { uri, mimeType: assetMime } = asset;
    const mimeType = assetMime || "image/jpeg";

    setUploadingLogo(true);
    try {
      const ct = encodeURIComponent(mimeType);
      const presign = await apiClient.post(
        `/api/admin/logo-pic/upload-url?content_type=${ct}`,
      );
      const uploadUrl = presign?.upload_url;
      const publicUrl = presign?.public_url;
      if (!uploadUrl || !publicUrl) throw new Error("presign failed");

      const blob = await (await fetch(uri)).blob();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": mimeType },
      });
      if (!putRes.ok) throw new Error("upload failed");

      await apiClient.post("/api/admin/logo-pic/commit", {
        logo_url: publicUrl,
      });
      const version = await bumpLogoVersion();
      setLogoUrl(withLogoVersion(publicUrl, version));
      Alert.alert("Done", "Logo updated successfully.");
    } catch {
      Alert.alert("Upload failed", "Could not upload logo right now.");
    } finally {
      setUploadingLogo(false);
    }
  }, [uploadingLogo]);

  const normalizeTimeValue = useCallback((value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    const twelveHour = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i;

    const twentyFourMatch = raw.match(twentyFourHour);
    if (twentyFourMatch) {
      return `${twentyFourMatch[1].padStart(2, "0")}:${twentyFourMatch[2]}`;
    }

    const twelveHourMatch = raw.match(twelveHour);
    if (!twelveHourMatch) return null;

    let hours = parseInt(twelveHourMatch[1], 10);
    const minutes = twelveHourMatch[2];
    const meridiem = twelveHourMatch[3].toUpperCase();

    if (meridiem === "AM") {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }, []);

  const headerMeta = useMemo(
    () =>
      `${String(restaurantName || "Brand Profile").toUpperCase()} - ${currency}`,
    [restaurantName, currency],
  );

  const loadProfile = useCallback(async () => {
    try {
      const profile = await apiClient.get("/api/admin/me");
      setCurrency(String(profile?.currency || "INR"));
      setRestaurantName(String(profile?.restaurant || ""));
      setBusinessAddress(String(profile?.address || ""));
      setWebsite(String(profile?.website || ""));
      setTaxRate(
        profile?.tax_percent != null ? String(profile.tax_percent) : "",
      );
      setCustomTax(
        !GST_SLABS.includes(Number(profile?.tax_percent || 0) as any),
      );
      setServiceCharge(
        profile?.service_charge != null ? String(profile.service_charge) : "",
      );
      setGstNumber(String(profile?.gst_number || ""));
      const taxConfig: TaxConfig = (profile?.tax_config || {}) as TaxConfig;
      setTaxMode(taxConfig.mode === "igst" ? "igst" : "cgst_sgst");
      setTaxInclusive(Boolean(taxConfig.inclusive));
      setCessEnabled(Boolean(taxConfig.cess_enabled));
      setCessPercent(
        taxConfig.cess_percent != null ? String(taxConfig.cess_percent) : "",
      );
      setOpenTime(String(profile?.open_time || ""));
      setCloseTime(String(profile?.close_time || ""));

      const ordering = profile?.ordering_enabled;
      setOrderingEnabled(typeof ordering === "boolean" ? ordering : true);

      const fromServerCC = String(profile?.phone_country_code || "").trim();
      const parsed = splitE164Phone(String(profile?.phone || ""));
      const finalCC = COUNTRY_CODES.some((v) => v.code === fromServerCC)
        ? fromServerCC
        : parsed.countryCode;
      setPhoneCountryCode(finalCC);
      setPhoneNumber(parsed.phone);

      if (profile?.restaurant_id) {
        try {
          const version = await getStoredLogoVersion();
          const res = await fetch(
            `${BASE_URL}/public/restaurants/${profile.restaurant_id}/logo`,
          );
          const data = await res.json();
          setLogoUrl(withLogoVersion(data?.logo_url, version));
        } catch {
          setLogoUrl(null);
        }
      } else {
        setLogoUrl(null);
      }
    } catch {
      const local = await AsyncStorage.getItem("user");
      if (local) {
        const fallback = JSON.parse(local);
        setCurrency(String(fallback?.currency || "INR"));
        setRestaurantName(String(fallback?.restaurant || ""));
        setBusinessAddress(String(fallback?.address || ""));
        setWebsite(String(fallback?.website || ""));
        setPhoneCountryCode("+91");
        setPhoneNumber(String(fallback?.phone || "").replace(/[^0-9]/g, ""));
        setTaxRate(
          fallback?.tax_percent != null ? String(fallback.tax_percent) : "",
        );
        setCustomTax(
          !GST_SLABS.includes(Number(fallback?.tax_percent || 0) as any),
        );
        setServiceCharge(
          fallback?.service_charge != null
            ? String(fallback.service_charge)
            : "",
        );
        setGstNumber(String(fallback?.gst_number || ""));
        setOpenTime(String(fallback?.open_time || ""));
        setCloseTime(String(fallback?.close_time || ""));
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadProfile();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProfile();
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  const onSave = useCallback(async () => {
    if (saving) return;

    const cc = phoneCountryCode;
    const cleanedPhone = phoneNumber.replace(/[^0-9]/g, "");
    const phoneRule = PHONE_RULES[cc];
    if (cleanedPhone && phoneRule && !phoneRule.pattern.test(cleanedPhone)) {
      Alert.alert(
        "Invalid phone",
        `Number format is invalid for ${cc}. Example: ${phoneRule.example}`,
      );
      return;
    }

    const normalizedGst = gstNumber.trim().toUpperCase();
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    if (normalizedGst && !GSTIN_REGEX.test(normalizedGst)) {
      Alert.alert("Invalid GSTIN", "Use format like 22AAAAA0000A1Z5.");
      return;
    }

    const normalizedOpenTime = normalizeTimeValue(openTime);
    if (normalizedOpenTime === null) {
      Alert.alert("Invalid time", "Opening time must be HH:MM or HH:MM AM/PM.");
      return;
    }

    const normalizedCloseTime = normalizeTimeValue(closeTime);
    if (normalizedCloseTime === null) {
      Alert.alert("Invalid time", "Closing time must be HH:MM or HH:MM AM/PM.");
      return;
    }

    const taxPercentNumber = taxRate.trim() ? Number(taxRate) : undefined;
    const cessNumber = cessPercent.trim() ? Number(cessPercent) : 0;
    const payload: Record<string, any> = {
      name: restaurantName.trim() || undefined,
      address: businessAddress.trim() || undefined,
      website: website.trim() || undefined,
      phone: cleanedPhone || undefined,
      phone_country_code: cleanedPhone ? cc : undefined,
      tax_percent: taxPercentNumber,
      service_charge: serviceCharge.trim() ? Number(serviceCharge) : undefined,
      open_time: normalizedOpenTime || undefined,
      close_time: normalizedCloseTime || undefined,
      ordering_enabled: orderingEnabled,
      gst_number: normalizedGst || undefined,
      tax_config: {
        mode: taxMode,
        inclusive: taxInclusive,
        cess_enabled: cessEnabled,
        cess_percent: cessEnabled ? cessNumber : 0,
      },
    };

    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k],
    );

    setSaving(true);
    try {
      await apiClient.patch("/api/admin/update-details", payload);
      Alert.alert("Saved", "Restaurant profile updated.");
      await loadProfile();
    } catch {
      Alert.alert("Save failed", "Could not update profile right now.");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    phoneCountryCode,
    phoneNumber,
    restaurantName,
    businessAddress,
    website,
    taxRate,
    serviceCharge,
    gstNumber,
    taxMode,
    taxInclusive,
    cessEnabled,
    cessPercent,
    openTime,
    closeTime,
    orderingEnabled,
    loadProfile,
    normalizeTimeValue,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={BRAND.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminSettingsHeader
        title="Restaurant Profile"
        subtitle={headerMeta}
        actionButton={
          <Pressable
            style={[
              styles.saveTopBtn,
              isCompact && styles.saveTopBtnCompact,
              saving && styles.saveTopBtnDisabled,
            ]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={BRAND.primaryDark} /> : null}
            <MaterialIcons name="save" size={16} color={BRAND.primaryDark} />
            <Text
              style={[
                styles.saveTopBtnText,
                isCompact && styles.saveTopBtnTextCompact,
              ]}
            >
              Save Changes
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isCompact && styles.contentCompact,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text
            style={[styles.cardTitle, isCompact && styles.cardTitleCompact]}
          >
            Restaurant Profile
          </Text>

          <View style={styles.logoRow}>
            <Pressable
              onPress={pickLogo}
              disabled={uploadingLogo}
              style={styles.logoWrap}
            >
              {uploadingLogo ? (
                <View
                  style={[
                    styles.logoImage,
                    {
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#F1F5F9",
                    },
                  ]}
                >
                  <ActivityIndicator color={BRAND.primary} />
                </View>
              ) : (
                <Image
                  source={logoUrl ? { uri: logoUrl } : iconPng}
                  style={styles.logoImage}
                />
              )}
              <View style={styles.logoBadge}>
                <MaterialIcons name="photo-camera" size={13} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={styles.logoFormRight}>
              <Text style={styles.label}>Restaurant Name</Text>
              <TextInput
                style={styles.input}
                value={restaurantName}
                onChangeText={setRestaurantName}
                placeholder="Restaurant Name"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Text style={styles.label}>Business Address</Text>
          <TextInput
            style={styles.input}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            placeholder="Business Address"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Website URL</Text>
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://yourrestaurant.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <Pressable
              onPress={() => {
                const idx = COUNTRY_CODES.findIndex(
                  (v) => v.code === phoneCountryCode,
                );
                const next = COUNTRY_CODES[(idx + 1) % COUNTRY_CODES.length];
                setPhoneCountryCode(next.code);
              }}
              style={styles.countryCodeBtn}
            >
              <Text style={styles.countryCodeText}>
                {COUNTRY_CODES.find((v) => v.code === phoneCountryCode)
                  ?.label || "IN (+91)"}
              </Text>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={16}
                color={BRAND.muted}
              />
            </Pressable>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              value={phoneNumber}
              onChangeText={(t) => {
                const digits = t.replace(/[^0-9]/g, "");
                const max = PHONE_RULES[phoneCountryCode]?.max || 14;
                setPhoneNumber(digits.slice(0, max));
              }}
              keyboardType="phone-pad"
              placeholder={
                PHONE_RULES[phoneCountryCode]?.example ||
                "Business contact number"
              }
              placeholderTextColor="#94A3B8"
            />
          </View>
          {phoneNumber.trim() &&
          !PHONE_RULES[phoneCountryCode]?.pattern.test(phoneNumber.trim()) ? (
            <Text style={styles.errorHint}>
              Invalid number for {phoneCountryCode}. Example:{" "}
              {PHONE_RULES[phoneCountryCode]?.example}
            </Text>
          ) : null}

          <View style={styles.doubleRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.label}>Tax Rate (%)</Text>
              <TextInput
                style={styles.input}
                value={taxRate}
                onChangeText={(t) => setTaxRate(t.replace(/[^0-9.]/g, ""))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.label}>Service Charge (%)</Text>
              <TextInput
                style={styles.input}
                value={serviceCharge}
                onChangeText={(t) =>
                  setServiceCharge(t.replace(/[^0-9.]/g, ""))
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
          <View style={styles.slabRow}>
            {GST_SLABS.map((slab) => (
              <Pressable
                key={String(slab)}
                onPress={() => {
                  setCustomTax(false);
                  setTaxRate(String(slab));
                }}
                style={[
                  styles.slabChip,
                  !customTax &&
                    Number(taxRate || 0) === slab &&
                    styles.slabChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.slabChipText,
                    !customTax &&
                      Number(taxRate || 0) === slab &&
                      styles.slabChipTextActive,
                  ]}
                >
                  {slab}%
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setCustomTax(true)}
              style={[styles.slabChip, customTax && styles.slabChipActive]}
            >
              <Text
                style={[
                  styles.slabChipText,
                  customTax && styles.slabChipTextActive,
                ]}
              >
                Custom
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>GSTIN (optional)</Text>
          <TextInput
            style={styles.input}
            value={gstNumber}
            onChangeText={(t) =>
              setGstNumber(
                t
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 15),
              )
            }
            placeholder="22AAAAA0000A1Z5"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Tax Breakup on Bill</Text>
          <View style={styles.doubleRow}>
            <Pressable
              style={[
                styles.modeCard,
                taxMode === "cgst_sgst" && styles.modeCardActive,
              ]}
              onPress={() => setTaxMode("cgst_sgst")}
            >
              <Text
                style={[
                  styles.modeTitle,
                  taxMode === "cgst_sgst" && styles.modeTitleActive,
                ]}
              >
                CGST + SGST
              </Text>
              <Text
                style={[
                  styles.modeSub,
                  taxMode === "cgst_sgst" && styles.modeSubActive,
                ]}
              >
                Intra-state
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeCard,
                taxMode === "igst" && styles.modeCardActive,
              ]}
              onPress={() => setTaxMode("igst")}
            >
              <Text
                style={[
                  styles.modeTitle,
                  taxMode === "igst" && styles.modeTitleActive,
                ]}
              >
                IGST
              </Text>
              <Text
                style={[
                  styles.modeSub,
                  taxMode === "igst" && styles.modeSubActive,
                ]}
              >
                Inter-state
              </Text>
            </Pressable>
          </View>

          <View style={styles.orderingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderingTitle}>Tax Inclusive Prices</Text>
              <Text style={styles.orderingHint}>
                {taxInclusive
                  ? "Menu prices already include tax."
                  : "Tax is added on top of menu prices."}
              </Text>
            </View>
            <Switch
              value={taxInclusive}
              onValueChange={setTaxInclusive}
              trackColor={{ false: "#E2E8F0", true: "#86EFAC" }}
              thumbColor={taxInclusive ? "#16A34A" : "#F8FAFC"}
            />
          </View>

          <View style={styles.orderingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderingTitle}>Cess</Text>
              <Text style={styles.orderingHint}>
                Additional cess on top of GST.
              </Text>
            </View>
            <Switch
              value={cessEnabled}
              onValueChange={setCessEnabled}
              trackColor={{ false: "#E2E8F0", true: "#FCD34D" }}
              thumbColor={cessEnabled ? BRAND.primaryDark : "#F8FAFC"}
            />
          </View>
          {cessEnabled ? (
            <View style={styles.fieldCol}>
              <Text style={styles.label}>Cess Percent (%)</Text>
              <TextInput
                style={styles.input}
                value={cessPercent}
                onChangeText={(t) => setCessPercent(t.replace(/[^0-9.]/g, ""))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>
          ) : null}

          <View
            style={[styles.doubleRow, isCompact && styles.doubleRowCompact]}
          >
            <View style={styles.fieldCol}>
              <Text style={styles.label}>Opens At</Text>
              <TextInput
                style={styles.input}
                value={openTime}
                onChangeText={setOpenTime}
                placeholder="HH:MM or HH:MM AM/PM"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldCol}>
              <Text style={styles.label}>Closes At</Text>
              <TextInput
                style={styles.input}
                value={closeTime}
                onChangeText={setCloseTime}
                placeholder="HH:MM or HH:MM AM/PM"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.orderingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderingTitle}>Ordering</Text>
              <Text style={styles.orderingHint}>
                When off, guests can view menu only.
              </Text>
            </View>
            <Switch
              value={orderingEnabled}
              onValueChange={setOrderingEnabled}
              trackColor={{ false: "#E2E8F0", true: "#FCD34D" }}
              thumbColor={orderingEnabled ? BRAND.primaryDark : "#F8FAFC"}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.bg,
  },
  loadingText: {
    marginTop: 8,
    color: BRAND.muted,
    fontWeight: "600",
  },
  saveTopBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveTopBtnCompact: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  saveTopBtnDisabled: {
    opacity: 0.65,
  },
  saveTopBtnText: {
    color: BRAND.primaryDark,
    fontWeight: "800",
    fontSize: 13,
  },
  saveTopBtnTextCompact: {
    fontSize: 12,
  },
  content: {
    padding: 12,
    paddingBottom: 28,
  },
  contentCompact: {
    padding: 10,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: BRAND.text,
    marginBottom: 12,
  },
  cardTitleCompact: {
    fontSize: 18,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    position: "relative",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  logoBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  logoFormRight: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: BRAND.label,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 17,
    color: BRAND.text,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countryCodeBtn: {
    height: 46,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  countryCodeText: {
    color: BRAND.text,
    fontWeight: "700",
    fontSize: 13,
  },
  phoneInput: {
    flex: 1,
  },
  errorHint: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "600",
    marginTop: -8,
    marginBottom: 10,
  },
  doubleRow: {
    flexDirection: "row",
    gap: 10,
  },
  doubleRowCompact: {
    flexDirection: "column",
    gap: 0,
  },
  fieldCol: {
    flex: 1,
  },
  slabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    marginTop: -4,
  },
  slabChip: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  slabChipActive: {
    borderColor: "#111827",
    backgroundColor: "#111827",
  },
  slabChipText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
  slabChipTextActive: {
    color: "#FFFFFF",
  },
  modeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginBottom: 12,
  },
  modeCardActive: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A",
  },
  modeTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 12,
  },
  modeTitleActive: {
    color: "#FFFFFF",
  },
  modeSub: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  modeSubActive: {
    color: "#E2E8F0",
  },
  orderingRow: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFCF2",
  },
  orderingTitle: {
    color: BRAND.text,
    fontWeight: "800",
    fontSize: 16,
  },
  orderingHint: {
    marginTop: 2,
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "500",
  },
});
