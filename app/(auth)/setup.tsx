// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  Animated,
  ActivityIndicator,
  ScrollView,
  Linking,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#FF6300";
const THEME_DARK = "#E5A800";
import { BASE_URL } from "../../lib/apiClient";

let supabaseCached = undefined;
const getSupabaseClient = async () => {
  if (supabaseCached !== undefined) return supabaseCached;
  try {
    const mod = await import("../../lib/supabaseClient");
    supabaseCached = mod?.supabase || null;
  } catch {
    supabaseCached = null;
  }
  return supabaseCached;
};

const PLAN_OPTIONS = [
  { id: "monthly_499", title: "Monthly", amount: "Rs 499 / month", hint: "Flexible monthly billing" },
  { id: "yearly_5500", title: "Yearly", amount: "Rs 5,500 / year", hint: "Lower effective monthly cost" },
];

const StoreIcon = ({ size = 24, color = "#999" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9 22V12h6v10"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const GridIcon = ({ size = 24, color = "#999" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 3h7v7H3V3zM14 3h7v7h-7V3zM14 14h7v7h-7v-7zM3 14h7v7H3v-7z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ClockIcon = ({ size = 24, color = "#999" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
    <Path
      d="M12 6v6l4 2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CheckIcon = ({ size = 16, color = "#fff" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 6L9 17l-5-5"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ArrowRightIcon = ({ color = "#000" }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12h14M12 5l7 7-7 7"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ProgressStep = ({ step, currentStep, label }) => {
  const isCompleted = currentStep > step;
  const isCurrent = currentStep === step;
  return (
    <View style={progressStyles.stepContainer}>
      <View
        style={[
          progressStyles.circle,
          isCompleted && progressStyles.circleCompleted,
          isCurrent && progressStyles.circleCurrent,
        ]}
      >
        {isCompleted ? (
          <CheckIcon size={14} />
        ) : (
          <Text
            style={[
              progressStyles.stepNumber,
              isCurrent && progressStyles.stepNumberCurrent,
            ]}
          >
            {step}
          </Text>
        )}
      </View>
      <Text
        style={[
          progressStyles.label,
          (isCompleted || isCurrent) && progressStyles.labelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const progressStyles = StyleSheet.create({
  stepContainer: { alignItems: "center", flex: 1 },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  circleCompleted: { backgroundColor: "#4CAF50" },
  circleCurrent: {
    backgroundColor: THEME_COLOR,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stepNumber: { fontSize: 14, fontWeight: "700", color: "#999" },
  stepNumberCurrent: { color: "#111827" },
  label: { fontSize: 10, color: "#999" },
  labelActive: { color: "#111827", fontWeight: "600" },
});

const TableSelector = ({ value, onChange }) => {
  const presets = [5, 10, 15, 20, 30, 40];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {presets.map((preset) => (
          <Pressable
            key={preset}
            style={[
              styles.preset,
              value === preset && styles.presetActive,
            ]}
            onPress={() => onChange(preset)}
          >
            <Text style={[styles.presetText, value === preset && styles.presetTextActive]}>{preset}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 13, color: "#6B7280" }}>Custom:</Text>
        <TextInput
          style={styles.customInput}
          value={String(value)}
          onChangeText={(text) => {
            const num = parseInt(text, 10);
            if (!Number.isNaN(num) && num >= 0 && num <= 40) onChange(num);
          }}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={{ fontSize: 13, color: "#9CA3AF" }}>tables</Text>
      </View>
    </View>
  );
};

export default function SetupScreen() {
  const router = useRouter();
  const [setupStep, setSetupStep] = useState(1);
  const [brandName, setBrandName] = useState("");
  const [tables, setTables] = useState(10);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [selectedPlan, setSelectedPlan] = useState("monthly_499");
  const [isLoading, setIsLoading] = useState(false);
  const [brandFocused, setBrandFocused] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const buttonScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardTranslateY]);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const fetchMandateLink = async (plan) => {
    const token = await AsyncStorage.getItem("qrave_jwt");
    const res = await fetch(`${BASE_URL}/api/admin/billing/mandate-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Failed to create mandate link");
    }
    return await res.json().catch(() => ({}));
  };

  const syncBilling = async () => {
    const token = await AsyncStorage.getItem("qrave_jwt");
    await fetch(`${BASE_URL}/api/admin/billing/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({}),
    });
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setStatusMessage("");
    try {
      const rawUser = await AsyncStorage.getItem("user");
      let parsedUser = null;
      if (rawUser) {
        parsedUser = JSON.parse(rawUser);
        const nextRole = parsedUser?.role || "owner";
        const nextUser = {
          ...parsedUser,
          role: nextRole,
          user_metadata: {
            ...(parsedUser?.user_metadata || {}),
            role: nextRole,
            restaurant_name: brandName?.trim() || parsedUser?.user_metadata?.restaurant_name,
            tables,
            open_time: openTime,
            close_time: closeTime,
          },
        };
        await AsyncStorage.setItem("user", JSON.stringify(nextUser));
        parsedUser = nextUser;
      }

      const supabase = await getSupabaseClient();
      const { data: existingSession } = supabase
        ? await supabase.auth.getSession()
        : { data: null };

      if (parsedUser?.email && parsedUser?.id) {
        const backendSession = await syncBackendSessionForGoogleUser(parsedUser, {
          ensureSignup: true,
          restaurantName: brandName?.trim(),
          supabaseAccessToken: existingSession?.session?.access_token,
        });
        if (!backendSession.ok) {
          throw new Error(backendSession.message || "Failed to link backend account");
        }
      }

      if (supabase) {
        await supabase.auth.updateUser({
          data: {
            role: "owner",
            restaurant_name: brandName?.trim() || undefined,
            tables,
            open_time: openTime,
            close_time: closeTime,
          },
        });
      }

      try {
        const mandate = await fetchMandateLink(selectedPlan);
        if (mandate?.short_url) {
          await Linking.openURL(mandate.short_url);
          setStatusMessage("Payment page opened. Complete payment and return to app.");
        }
      } catch (_err) {
        setStatusMessage("Payment link unavailable right now. Continue and complete billing later.");
      }

      await syncBilling().catch(() => undefined);
      router.push("/complete");
    } catch (e) {
      console.warn("Failed to complete setup profile sync", e);
      router.push("/complete");
    } finally {
      setIsLoading(false);
    }
  };

  const moveToPlanStep = () => {
    if (!brandName?.trim()) {
      Alert.alert("Restaurant Name Required", "Please enter your restaurant name before continuing.");
      return;
    }
    setSetupStep(2);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
      <Image 
        source={require('../../assets/images/board3.jpg')} 
        style={{ width: '100%', height: height * 0.45, position: 'absolute', top: 0 }} 
        resizeMode="cover" 
      />
      
      <Pressable onPress={() => router.back()} style={styles.backBtnOverlay}>
        <MaterialIcons name="arrow-back-ios" size={20} color="#FFF" />
      </Pressable>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={{ height: height * 0.35 }} />
            
            <View style={styles.bottomSheet}>
              <View style={styles.progressContainer}>
                <ProgressStep step={1} currentStep={setupStep === 1 ? 3 : 4} label="Verify" />
                <View style={styles.progressLine} />
                <ProgressStep step={2} currentStep={setupStep === 1 ? 3 : 4} label="Details" />
                <View style={styles.progressLine} />
                <ProgressStep step={3} currentStep={setupStep === 1 ? 3 : 4} label="Plan" />
                <View style={styles.progressLine} />
                <ProgressStep step={4} currentStep={setupStep === 1 ? 3 : 4} label="Setup" />
              </View>

              <Animated.View style={[styles.content, { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}>
          <Text style={styles.welcomeTitle}>Tell us about your business</Text>
          <Text style={styles.subtitle}>This helps us customize your experience</Text>

          {setupStep === 1 ? (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}><StoreIcon size={18} color={THEME_COLOR} /></View>
                  <Text style={styles.sectionTitle}>What is your brand?</Text>
                </View>
                <View style={[styles.inputContainer, brandFocused && styles.inputContainerFocused]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your restaurant name"
                    placeholderTextColor="#9CA3AF"
                    value={brandName}
                    onChangeText={setBrandName}
                    onFocus={() => setBrandFocused(true)}
                    onBlur={() => setBrandFocused(false)}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}><GridIcon size={18} color={THEME_COLOR} /></View>
                  <Text style={styles.sectionTitle}>Seating layout</Text>
                </View>
                <Text style={styles.sectionHint}>How many tables need QR codes?</Text>
                <TableSelector value={tables} onChange={setTables} />
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}><ClockIcon size={18} color={THEME_COLOR} /></View>
                  <Text style={styles.sectionTitle}>Working hours</Text>
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>Opens at</Text>
                    <TextInput style={styles.timeInput} value={openTime} onChangeText={setOpenTime} placeholder="09:00" placeholderTextColor="#9CA3AF" />
                  </View>
                  <View style={styles.timeDivider}><Text style={styles.timeDividerText}>-</Text></View>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>Closes at</Text>
                    <TextInput style={styles.timeInput} value={closeTime} onChangeText={setCloseTime} placeholder="22:00" placeholderTextColor="#9CA3AF" />
                  </View>
                </View>
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 8 }}>
                <Pressable
                  style={[styles.completeButton, (!brandName || isLoading) && styles.buttonDisabled]}
                  onPress={moveToPlanStep}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={!brandName || isLoading}
                >
                  <Text style={styles.completeButtonText}>Continue to Plan</Text>
                  <ArrowRightIcon />
                </Pressable>
              </Animated.View>
            </>
          ) : (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}><StoreIcon size={18} color={THEME_COLOR} /></View>
                  <Text style={styles.sectionTitle}>Select subscription plan</Text>
                </View>
                <Text style={styles.sectionHint}>You get a 7-day free trial before billing starts.</Text>

                {PLAN_OPTIONS.map((plan) => {
                  const active = selectedPlan === plan.id;
                  return (
                    <Pressable key={plan.id} onPress={() => setSelectedPlan(plan.id)} style={[styles.planCard, active && styles.planCardActive]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planTitle}>{plan.title}</Text>
                        <Text style={styles.planAmount}>{plan.amount}</Text>
                        <Text style={styles.planHint}>{plan.hint}</Text>
                      </View>
                      {active ? (
                        <View style={styles.planCheck}><CheckIcon size={12} /></View>
                      ) : (
                        <View style={styles.planDot} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

              <View style={styles.actionsRow}>
                <Pressable style={styles.backBtn} onPress={() => setSetupStep(1)} disabled={isLoading}>
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
                <Animated.View style={{ transform: [{ scale: buttonScale }], flex: 1 }}>
                  <Pressable
                    style={[styles.completeButton, isLoading && styles.buttonDisabled]}
                    onPress={handleComplete}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#111827" />
                    ) : (
                      <>
                        <Text style={styles.completeButtonText}>Start Free Trial</Text>
                        <ArrowRightIcon />
                      </>
                    )}
                  </Pressable>
                </Animated.View>
              </View>
            </>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    minHeight: height * 0.65,
  },
  backBtnOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 4,
    paddingLeft: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  dividerFull: {
    height: 1,
    backgroundColor: "#EBEBEB",
    width: "100%",
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40, paddingTop: 16 },
  progressContainer: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginBottom: 20, paddingHorizontal: 12 },
  progressLine: { flex: 0.5, height: 2, backgroundColor: "#4CAF50", marginTop: 15 },
  content: {
    paddingHorizontal: 24,
  },
  welcomeTitle: { fontSize: 26, fontWeight: "600", color: "#222", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#717171", marginBottom: 24, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#222" },
  sectionHint: { fontSize: 13, color: "#717171", marginBottom: 12, marginLeft: 42 },
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B0B0B0",
    paddingHorizontal: 14,
    height: 52,
  },
  inputContainerFocused: { borderColor: "#222", borderWidth: 2 },
  input: { flex: 1, fontSize: 15, color: "#222", height: "100%" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeBlock: { flex: 1 },
  timeLabel: { fontSize: 12, color: "#717171", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  timeInput: {
    height: 52,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#B0B0B0",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  timeDivider: { paddingTop: 20 },
  timeDividerText: { fontSize: 20, color: "#9CA3AF" },
  completeButton: {
    height: 52,
    backgroundColor: THEME_COLOR,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  completeButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  preset: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#B0B0B0",
  },
  presetActive: { backgroundColor: "#222", borderColor: "#222" },
  presetText: { fontSize: 14, fontWeight: "600", color: "#222" },
  presetTextActive: { color: "#FFFFFF" },
  customInput: {
    width: 60,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#B0B0B0",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  planCard: {
    borderWidth: 1,
    borderColor: "#B0B0B0",
    borderRadius: 8,
    padding: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  planCardActive: { borderColor: "#222", backgroundColor: "#F7F7F7", borderWidth: 2 },
  planTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  planAmount: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 2 },
  planHint: { fontSize: 11, color: "#6B7280", marginTop: 3 },
  planDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#D1D5DB" },
  planCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  statusMessage: { color: "#6B7280", fontSize: 12, marginBottom: 10 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 6, alignItems: "center" },
  backBtnBackBtn: {
    height: 52,
    width: 90,
    borderWidth: 1,
    borderColor: "#B0B0B0",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  backBtnText: { color: "#222", fontWeight: "700", fontSize: 16 },
});
