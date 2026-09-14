// @ts-nocheck
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
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#FF6300";
const THEME_DARK = "#E5A800";
import { BASE_URL } from "../../lib/apiClient";

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
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
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

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backBtnOverlay}>
        <MaterialIcons name="arrow-back-ios" size={24} color="#000000" />
      </Pressable>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            
            <View style={styles.contentContainer}>
              {isSuccess ? (
                <Animated.View
                  style={[
                    styles.successContainer,
                    { transform: [{ scale: successScale }] },
                  ]}
                >
                  <MaterialIcons name="check-circle" size={80} color="#34A853" />
                  <Text style={styles.successTitle}>Password Reset!</Text>
                  <Text style={styles.successSubtitle}>
                    You can now log in with your new password.
                  </Text>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => router.replace("/(auth)/login")}
                  >
                    <Text style={styles.primaryButtonText}>Back to Log In</Text>
                  </Pressable>
                </Animated.View>
              ) : (
                <>
                  <Text style={styles.welcomeTitle}>Create New Password</Text>
                  <Text style={styles.subtitle}>
                    Enter a new password for your account.
                  </Text>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <View
                    style={[
                      styles.inputContainer,
                      newPasswordFocused && styles.inputContainerFocused,
                    ]}
                  >
                    <View style={styles.inputIcon}>
                      <LockIcon
                        color={newPasswordFocused ? THEME_COLOR : "#999"}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="New password"
                      placeholderTextColor="#9CA3AF"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                      onFocus={() => setNewPasswordFocused(true)}
                      onBlur={() => setNewPasswordFocused(false)}
                      editable={!isLoading}
                    />
                    <Pressable
                      style={styles.eyeIcon}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      hitSlop={8}
                    >
                      <EyeIcon
                        open={showNewPassword}
                        color={newPasswordFocused ? THEME_COLOR : "#999"}
                      />
                    </Pressable>
                  </View>

                  <View
                    style={[
                      styles.inputContainer,
                      confirmPasswordFocused && styles.inputContainerFocused,
                      newPassword && confirmPassword && newPassword !== confirmPassword && styles.inputContainerError,
                    ]}
                  >
                    <View style={styles.inputIcon}>
                      <LockIcon
                        color={confirmPasswordFocused ? THEME_COLOR : "#999"}
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
                      editable={!isLoading}
                    />
                    <Pressable
                      style={styles.eyeIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      hitSlop={8}
                    >
                      <EyeIcon
                        open={showConfirmPassword}
                        color={confirmPasswordFocused ? THEME_COLOR : "#999"}
                      />
                    </Pressable>
                  </View>

                  <Animated.View
                    style={{ transform: [{ scale: buttonScale }], width: "100%" }}
                  >
                    <Pressable
                      style={[
                        styles.primaryButton,
                        (isLoading ||
                          !newPassword ||
                          !confirmPassword ||
                          newPassword !== confirmPassword) &&
                          styles.buttonDisabled,
                      ]}
                      onPress={handleReset}
                      onPressIn={handlePressIn}
                      onPressOut={handlePressOut}
                      disabled={
                        isLoading ||
                        !newPassword ||
                        !confirmPassword ||
                        newPassword !== confirmPassword
                      }
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Reset Password
                        </Text>
                      )}
                    </Pressable>
                  </Animated.View>
                </>
              )}
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
  scrollContent: {
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: height * 0.25,
    marginTop: 20,
  },
  logo: {
    width: 160,
    height: 160,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backBtnOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#717171",
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEEEEE",
    borderRadius: 8,
    borderWidth: 0,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  inputContainerFocused: {
    backgroundColor: "#E2E2E2",
  },
  inputContainerError: {
    borderWidth: 1,
    borderColor: "#C13515",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#222",
    height: "100%",
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    color: "#C13515",
    fontWeight: "500",
    marginTop: 6,
  },
  resetButton: {
    height: 52,
    backgroundColor: THEME_COLOR,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
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
