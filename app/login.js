// app/login.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { login as apiLogin } from "../lib/apiClient";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#F4B400";
const THEME_DARK = "#E5A800";
const BASE_URL = "https://qrave-backend.onrender.com";

const EmailIcon = ({ color = "#999" }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M22 6l-10 7L2 6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardTranslateY]);

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

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

  const doLogin = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await apiLogin(email, password);
      const user = data.user || data;

      if (!user) throw new Error("Invalid credentials");

      try {
        await AsyncStorage.setItem("user", JSON.stringify(user));
      } catch (e) {
        console.warn("Failed to save user to AsyncStorage", e);
      }

      const role = user?.role;
      const isAdmin = role === "owner" || role === "manager";
      const isWaiter = role === "waiter";
      const isKitchen = role === "kitchen" || role === "chef";
      const target = isAdmin
        ? "/admin"
        : isWaiter
          ? "/waiter"
          : isKitchen
            ? "/kitchen"
            : "/dashboard";
      router.replace(target);
    } catch (err) {
      const msg = err?.body?.message || err.message || "Login failed";
      setError(String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const doSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const restaurantName = email.includes("@")
        ? email.split("@")[0]
        : "Qrave Restaurant";

      const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          restaurant_name: restaurantName,
          restaurant_currency: "INR",
        }),
      });

      if (!signupRes.ok) {
        const errBody = await signupRes.json().catch(() => ({}));
        throw new Error(errBody.message || "Signup failed");
      }

      const signupData = await signupRes.json().catch(() => ({}));
      const accessToken = signupData.access_token || signupData.accessToken;
      const refreshToken = signupData.refresh_token || signupData.refreshToken;

      if (accessToken) {
        await AsyncStorage.setItem("qrave_jwt", accessToken);
      }
      if (refreshToken) {
        await AsyncStorage.setItem("qrave_refresh", refreshToken);
      }

      const otpRes = await fetch(`${BASE_URL}/public/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!otpRes.ok) {
        const body = await otpRes.text().catch(() => "");
        throw new Error(body || "Failed to send verification code");
      }

      router.push({ pathname: "/verify", params: { email } });
    } catch (err) {
      const msg = err?.message || "Signup failed";
      setError(String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (activeTab === "login") {
      doLogin();
      return;
    }
    doSignup();
  };

  const welcomeTitle =
    activeTab === "login" ? "Welcome Back!" : "Create Account";
  const welcomeSubtitle =
    activeTab === "login"
      ? "Sign in to continue ordering"
      : "Join us for exclusive deals";

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <Svg
          height={height * 0.35}
          width={width}
          viewBox={`0 0 ${width} ${height * 0.35}`}
          style={styles.headerSvg}
        >
          <Defs>
            <LinearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={THEME_COLOR} />
              <Stop offset="100%" stopColor={THEME_DARK} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M0 0 L${width} 0 L${width} ${height * 0.28} Q${width / 2} ${height * 0.38} 0 ${height * 0.28} Z`}
            fill="url(#headerGradient)"
          />
        </Svg>

        <SafeAreaView style={styles.logoContainer}>
          <Text style={styles.logoText}>QRAVE</Text>
          <Text style={styles.tagline}>Delicious food, delivered fast</Text>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            <View style={styles.tabContainer}>
              <Pressable
                style={[styles.tab, activeTab === "login" && styles.activeTab]}
                onPress={() => handleTabPress("login")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "login" && styles.activeTabText,
                  ]}
                >
                  Log In
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === "signup" && styles.activeTab]}
                onPress={() => handleTabPress("signup")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "signup" && styles.activeTabText,
                  ]}
                >
                  Sign Up
                </Text>
              </Pressable>
            </View>

            <Text style={styles.welcomeTitle}>{welcomeTitle}</Text>
            <Text style={styles.welcomeSubtitle}>{welcomeSubtitle}</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.formContainer}>
              <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
                <View style={styles.inputIcon}>
                  <EmailIcon color={emailFocused ? THEME_COLOR : "#999"} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
                <View style={styles.inputIcon}>
                  <LockIcon color={passwordFocused ? THEME_COLOR : "#999"} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  editable={!isLoading}
                />
                <Pressable
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  <EyeIcon open={showPassword} color={passwordFocused ? THEME_COLOR : "#999"} />
                </Pressable>
              </View>

              {activeTab === "signup" ? (
                <View style={[styles.inputContainer, confirmPasswordFocused && styles.inputContainerFocused]}>
                  <View style={styles.inputIcon}>
                    <LockIcon color={confirmPasswordFocused ? THEME_COLOR : "#999"} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
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
              ) : (
                <Pressable
                  style={styles.forgotPassword}
                  onPress={() => router.push("/forgot-password")}
                  disabled={isLoading}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </Pressable>
              )}

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <Pressable
                  style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#1f2937" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {activeTab === "login" ? "Log In" : "Create Account"}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              <View style={styles.socialContainer}>
                <Pressable style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </Svg>
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonApple, pressed && styles.socialButtonPressed]}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path
                      d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                      fill="#FFFFFF"
                    />
                  </Svg>
                  <Text style={[styles.socialButtonText, styles.socialButtonTextWhite]}>Apple</Text>
                </Pressable>
              </View>

              <Text style={styles.termsText}>
                By continuing, you agree to our <Text style={styles.termsLink}>Terms</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>

              {/* No extra tab switch text; user switches via tabs */}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 40,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 12,
    color: "#1F2937",
    opacity: 0.8,
    marginTop: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: height * 0.2,
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderRadius: 28,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 24,
  },
  activeTab: {
    backgroundColor: THEME_COLOR,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#111827",
    fontWeight: "700",
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  formContainer: {
    gap: 14,
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -6,
  },
  forgotPasswordText: {
    fontSize: 12,
    color: THEME_COLOR,
    fontWeight: "600",
  },
  submitButton: {
    height: 54,
    backgroundColor: THEME_COLOR,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  socialContainer: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F5F6F8",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  socialButtonApple: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  socialButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  socialButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  socialButtonTextWhite: {
    color: "#FFF",
  },
  termsText: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
  termsLink: {
    color: THEME_COLOR,
    fontWeight: "600",
  },
  registerLink: {
    marginTop: 8,
    alignItems: "center",
  },
  registerLinkText: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },
  registerLinkBold: {
    color: THEME_COLOR,
    fontWeight: "700",
  },
  switchTabLink: {
    marginTop: 6,
    alignItems: "center",
  },
  switchTabText: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },
});
