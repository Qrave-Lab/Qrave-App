import React, { useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#F4B400";
const THEME_DARK = "#E5A800";
const BASE_URL = "https://qrave-backend.onrender.com";

const LockIcon = ({ color = "#999" }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7 11V7a5 5 0 0110 0v4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const EyeIcon = ({ open, color = "#999" }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    {open ? (
      <>
        <Path
          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
      </>
    ) : (
      <>
        <Path
          d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M1 1l22 22" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </Svg>
);

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email, code } = useLocalSearchParams();
  const normalizedEmail = Array.isArray(email) ? email[0] : email;
  const normalizedCode = Array.isArray(code) ? code[0] : code;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;

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

  const attemptReset = async (payloads, endpoints) => {
    for (const endpoint of endpoints) {
      for (const payload of payloads) {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 404 || res.status === 405) {
          continue;
        }

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Reset failed");
        }

        return true;
      }
    }
    throw new Error("Reset endpoint not available");
  };

  const handleReset = async () => {
    setError("");
    if (!normalizedEmail) {
      setError("Missing email. Please restart the reset flow.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) return;

    setIsLoading(true);
    try {
      const payloads = [
        { email: normalizedEmail, password: newPassword, code: normalizedCode },
        { email: normalizedEmail, new_password: newPassword, code: normalizedCode },
        { email: normalizedEmail, newPassword, code: normalizedCode },
      ];
      const endpoints = [
        "/auth/forgot-password/reset",
        "/auth/reset-password",
        "/auth/password/reset",
        "/public/reset-password",
        "/public/password/reset",
      ];
      await attemptReset(payloads, endpoints);

      setIsSuccess(true);
      Animated.spring(successScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (err) {
      setError(err?.message || "Reset failed");
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch =
    newPassword && confirmPassword && newPassword === confirmPassword;

  if (isSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Animated.View
            style={[
              styles.successIconContainer,
              { transform: [{ scale: successScale }] },
            ]}
          >
            <View style={styles.successIconInner}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6L9 17l-5-5"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </Animated.View>
          <Text style={styles.successTitle}>Password Reset!</Text>
          <Text style={styles.successSubtitle}>Redirecting to login...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <Svg
          height={height * 0.34}
          width={width}
          viewBox={`0 0 ${width} ${height * 0.34}`}
          style={styles.headerSvg}
        >
          <Defs>
            <LinearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={THEME_COLOR} />
              <Stop offset="100%" stopColor={THEME_DARK} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M0 0 L${width} 0 L${width} ${height * 0.18}
              Q${width * 0.8} ${height * 0.28}, ${width * 0.4} ${height * 0.24}
              Q0 ${height * 0.20}, 0 ${height * 0.26} Z`}
            fill="url(#headerGradient)"
          />
          <Path
            d={`M${width + 50} ${height * 0.05}
              A ${height * 0.15} ${height * 0.15} 0 0 1 ${width - height * 0.15} ${height * 0.20}`}
            fill="rgba(255,255,255,0.08)"
          />
        </Svg>

        <SafeAreaView style={styles.logoContainer}>
          <Text style={styles.logoText}>QRAVE</Text>
          <Text style={styles.tagline}>Create new password</Text>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Create a strong password for your account
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={[styles.inputContainer, newPasswordFocused && styles.inputContainerFocused]}>
              <View style={styles.inputIcon}>
                <LockIcon color={newPasswordFocused ? THEME_COLOR : "#999"} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                onFocus={() => setNewPasswordFocused(true)}
                onBlur={() => setNewPasswordFocused(false)}
              />
              <Pressable
                style={styles.eyeIcon}
                onPress={() => setShowNewPassword(!showNewPassword)}
                hitSlop={8}
              >
                <EyeIcon open={showNewPassword} color={newPasswordFocused ? THEME_COLOR : "#999"} />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View
              style={[
                styles.inputContainer,
                confirmPasswordFocused && styles.inputContainerFocused,
                confirmPassword && !passwordsMatch && styles.inputContainerError,
              ]}
            >
              <View style={styles.inputIcon}>
                <LockIcon
                  color={
                    confirmPasswordFocused
                      ? THEME_COLOR
                      : confirmPassword && !passwordsMatch
                      ? "#FF5252"
                      : "#999"
                  }
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                onFocus={() => setConfirmPasswordFocused(true)}
                onBlur={() => setConfirmPasswordFocused(false)}
              />
              <Pressable
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={8}
              >
                <EyeIcon open={showConfirmPassword} color={confirmPasswordFocused ? THEME_COLOR : "#999"} />
              </Pressable>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {confirmPassword && !passwordsMatch ? (
              <Text style={styles.errorText}>Passwords do not match</Text>
            ) : null}
          </View>

          <Animated.View style={{ transform: [{ scale: buttonScale }], width: "100%", marginTop: 8 }}>
            <Pressable
              style={[styles.resetButton, (isLoading || !passwordsMatch) && styles.buttonDisabled]}
              onPress={handleReset}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isLoading || !passwordsMatch}
            >
              {isLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.resetButtonText}>Reset Password</Text>
              )}
            </Pressable>
          </Animated.View>
        </View>
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
    paddingTop: 44,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 12,
    color: "#111827",
    opacity: 0.8,
    marginTop: 4,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: height * 0.15,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
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
  inputContainerError: {
    borderColor: "#FF5252",
    backgroundColor: "#FFF5F5",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    height: "100%",
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    fontSize: 11,
    color: "#FF5252",
    fontWeight: "600",
    marginTop: 6,
  },
  resetButton: {
    height: 54,
    backgroundColor: THEME_COLOR,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
});
