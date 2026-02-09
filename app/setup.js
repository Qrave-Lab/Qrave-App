import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  Animated,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#F4B400";
const THEME_DARK = "#E5A800";

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
  stepContainer: {
    alignItems: "center",
    flex: 1,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  circleCompleted: {
    backgroundColor: "#4CAF50",
  },
  circleCurrent: {
    backgroundColor: THEME_COLOR,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#999",
  },
  stepNumberCurrent: {
    color: "#111827",
  },
  label: {
    fontSize: 10,
    color: "#999",
  },
  labelActive: {
    color: "#111827",
    fontWeight: "600",
  },
});

const TableSelector = ({ value, onChange }) => {
  const presets = [5, 10, 15, 20, 30, 40];
  return (
    <View style={tableSelectorStyles.container}>
      <View style={tableSelectorStyles.presetRow}>
        {presets.map((preset) => (
          <Pressable
            key={preset}
            style={[
              tableSelectorStyles.preset,
              value === preset && tableSelectorStyles.presetActive,
            ]}
            onPress={() => onChange(preset)}
          >
            <Text
              style={[
                tableSelectorStyles.presetText,
                value === preset && tableSelectorStyles.presetTextActive,
              ]}
            >
              {preset}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={tableSelectorStyles.customRow}>
        <Text style={tableSelectorStyles.customLabel}>Custom:</Text>
        <TextInput
          style={tableSelectorStyles.customInput}
          value={String(value)}
          onChangeText={(text) => {
            const num = parseInt(text, 10);
            if (!isNaN(num) && num >= 0 && num <= 40) onChange(num);
          }}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={tableSelectorStyles.customSuffix}>tables</Text>
      </View>
    </View>
  );
};

const tableSelectorStyles = StyleSheet.create({
  container: {
    gap: 12,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  preset: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F6F8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  presetActive: {
    backgroundColor: "#FFF9E6",
    borderColor: THEME_COLOR,
  },
  presetText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  presetTextActive: {
    color: "#111827",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  customInput: {
    width: 60,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F5F6F8",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  customSuffix: {
    fontSize: 13,
    color: "#9CA3AF",
  },
});

export default function SetupScreen() {
  const router = useRouter();
  const [brandName, setBrandName] = useState("");
  const [tables, setTables] = useState(10);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [isLoading, setIsLoading] = useState(false);
  const [brandFocused, setBrandFocused] = useState(false);

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
  }, []);

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

  const handleComplete = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push("/complete");
    }, 600);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <Svg
          height={height * 0.28}
          width={width}
          viewBox={`0 0 ${width} ${height * 0.28}`}
          style={styles.headerSvg}
        >
          <Defs>
            <LinearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={THEME_COLOR} />
              <Stop offset="100%" stopColor={THEME_DARK} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M0 0 L${width} 0 L${width} ${height * 0.21} Q${width / 2} ${height * 0.30} 0 ${height * 0.21} Z`}
            fill="url(#headerGradient)"
          />
        </Svg>

        <SafeAreaView style={styles.logoContainer}>
          <Text style={styles.logoText}>QRAVE</Text>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressContainer}>
          <ProgressStep step={1} currentStep={3} label="Verify" />
          <View style={styles.progressLine} />
          <ProgressStep step={2} currentStep={3} label="Details" />
          <View style={styles.progressLine} />
          <ProgressStep step={3} currentStep={3} label="Setup" />
        </View>

        <Animated.View
          style={[
            styles.card,
            { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
          ]}
        >
          <View style={styles.iconContainer}>
            <StoreIcon size={32} color={THEME_COLOR} />
          </View>

          <Text style={styles.title}>Tell us about your business</Text>
          <Text style={styles.subtitle}>This helps us customize your experience</Text>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <StoreIcon size={18} color={THEME_COLOR} />
              </View>
              <Text style={styles.sectionTitle}>What's your brand?</Text>
            </View>
            <View
              style={[
                styles.inputContainer,
                brandFocused && styles.inputContainerFocused,
              ]}
            >
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
              <View style={styles.sectionIcon}>
                <GridIcon size={18} color={THEME_COLOR} />
              </View>
              <Text style={styles.sectionTitle}>Seating layout</Text>
            </View>
            <Text style={styles.sectionHint}>How many tables need QR codes?</Text>
            <TableSelector value={tables} onChange={setTables} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <ClockIcon size={18} color={THEME_COLOR} />
              </View>
              <Text style={styles.sectionTitle}>Working hours</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Opens at</Text>
                <TextInput
                  style={styles.timeInput}
                  value={openTime}
                  onChangeText={setOpenTime}
                  placeholder="09:00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.timeDivider}>
                <Text style={styles.timeDividerText}>—</Text>
              </View>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Closes at</Text>
                <TextInput
                  style={styles.timeInput}
                  value={closeTime}
                  onChangeText={setCloseTime}
                  placeholder="22:00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 8 }}>
            <Pressable
              style={[styles.completeButton, (isLoading || !brandName) && styles.buttonDisabled]}
              onPress={handleComplete}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isLoading || !brandName}
            >
              {isLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <>
                  <Text style={styles.completeButtonText}>Complete Setup</Text>
                  <ArrowRightIcon />
                </>
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  headerSvg: {
    position: "absolute",
    top: 0,
  },
  logoContainer: {
    position: "absolute",
    top: 0,
    width: "100%",
    alignItems: "center",
    paddingTop: 28,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: height * 0.13,
    paddingBottom: 40,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  progressLine: {
    flex: 0.5,
    height: 2,
    backgroundColor: "#4CAF50",
    marginTop: 15,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 25,
    elevation: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF9E6",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFF9E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  sectionHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
    marginLeft: 42,
  },
  inputContainer: {
    backgroundColor: "#F5F6F8",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 16,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: THEME_COLOR,
    backgroundColor: "#FFFEF8",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    height: "100%",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeInput: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F5F6F8",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  timeDivider: {
    paddingTop: 20,
  },
  timeDividerText: {
    fontSize: 20,
    color: "#9CA3AF",
  },
  completeButton: {
    height: 56,
    backgroundColor: THEME_COLOR,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
});
