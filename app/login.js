// app/login.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
    Circle,
    Defs,
    LinearGradient,
    Path,
    Stop,
} from "react-native-svg";
import {
    api,
    login as apiLogin,
    persistAuthFromResponse,
} from "../lib/apiClient";
import { syncBackendSessionForGoogleUser } from "../lib/googleBackendBridge";
import { clearSupabasePkceState, supabase } from "../lib/supabaseClient";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#F4B400";
const THEME_DARK = "#E5A800";
const BASE_URL = "https://qrave-backend.onrender.com";

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {}

// By targeting "login", Expo Router stays on this screen and doesn't unmount it.
const SUPABASE_REDIRECT = "adminorderapp://login";
console.log("SUPABASE_REDIRECT:", SUPABASE_REDIRECT);

const GOOGLE_AUTH_INTENT_KEY = "google_auth_intent";
const GOOGLE_AUTH_STARTED_AT_KEY = "google_auth_started_at";
const GOOGLE_AUTH_TIMEOUT_MS = 10 * 60 * 1000;

const parseAuthParamsFromUrl = (url) => {
  const value = String(url || "");
  const queryStart = value.indexOf("?");
  const hashStart = value.indexOf("#");
  const queryEnd = hashStart >= 0 ? hashStart : value.length;
  const query = queryStart >= 0 ? value.slice(queryStart + 1, queryEnd) : "";
  const hash = hashStart >= 0 ? value.slice(hashStart + 1) : "";
  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  const get = (key) => queryParams.get(key) || hashParams.get(key);

  return {
    code: get("code"),
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    error: get("error") || get("error_code"),
    errorDescription: get("error_description"),
  };
};

const friendlyGoogleAuthError = (error) => {
  const message = String(error?.message || error || "");
  if (/pkce|code verifier|auth code and code verifier/i.test(message)) {
    return "Google sign-in session expired. Please try again.";
  }
  return message || "Could not complete Google sign-in.";
};

const isGoogleAuthCallbackUrl = (url) => {
  if (!url) return false;
  const { code, accessToken, error } = parseAuthParamsFromUrl(url);
  return Boolean(code || accessToken || error);
};

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
        <Path
          d="M1 1l22 22"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [branchOptions, setBranchOptions] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [pendingRoute, setPendingRoute] = useState("/admin");
  const [isSelectingBranch, setIsSelectingBranch] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const authSessionInProgressRef = useRef(false);
  const oauthExchangePromisesRef = useRef(new Map());
  const oauthExchangeResultsRef = useRef(new Map());
  const handledGoogleUsersRef = useRef(new Set());

  const getStoredGoogleIntent = async () => {
    try {
      const stored = await AsyncStorage.getItem(GOOGLE_AUTH_INTENT_KEY);
      if (stored === "signup" || stored === "login") return stored;
      return activeTab === "signup" ? "signup" : "login";
    } catch {
      return activeTab === "signup" ? "signup" : "login";
    }
  };

  const hasRecentGoogleAuthAttempt = async () => {
    try {
      const startedAt = Number(
        await AsyncStorage.getItem(GOOGLE_AUTH_STARTED_AT_KEY),
      );
      if (!startedAt || Date.now() - startedAt > GOOGLE_AUTH_TIMEOUT_MS) {
        await AsyncStorage.multiRemove([
          GOOGLE_AUTH_INTENT_KEY,
          GOOGLE_AUTH_STARTED_AT_KEY,
        ]);
        return false;
      }
      return true;
    } catch {
      return authSessionInProgressRef.current;
    }
  };

  const completeSupabaseSessionFromUrl = async (url) => {
    if (!supabase) return null;

    const { code, accessToken, refreshToken, error, errorDescription } =
      parseAuthParamsFromUrl(url);

    if (error) {
      throw new Error(errorDescription || error);
    }

    if (code && Platform.OS !== "web") {
      await clearSupabasePkceState();
      throw new Error("Google sign-in session expired. Please try again.");
    }

    if (code) {
      const exchangeKey = `code:${code}`;
      const cachedAuthResult = oauthExchangeResultsRef.current.get(exchangeKey);
      if (cachedAuthResult) return cachedAuthResult;

      const pendingExchange = oauthExchangePromisesRef.current.get(exchangeKey);
      if (pendingExchange) return pendingExchange;

      const exchangePromise = supabase.auth
        .exchangeCodeForSession(code)
        .then(async ({ data: sessionData, error: exchangeError }) => {
          if (exchangeError) {
            if (/pkce|code verifier/i.test(String(exchangeError?.message || ""))) {
              await clearSupabasePkceState();
            }
            throw exchangeError;
          }
          const user = sessionData?.session?.user;
          if (!user?.email || !user?.id) {
            throw new Error("Could not get user info from Google sign-in.");
          }
          const authResult = {
            user,
            supabaseAccessToken: sessionData?.session?.access_token,
          };
          oauthExchangeResultsRef.current.set(exchangeKey, authResult);
          return authResult;
        })
        .finally(() => {
          oauthExchangePromisesRef.current.delete(exchangeKey);
        });

      oauthExchangePromisesRef.current.set(exchangeKey, exchangePromise);
      return exchangePromise;
    }

    if (accessToken) {
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
      });
      if (sessionError) throw sessionError;
      const user = data?.session?.user;
      if (!user?.email || !user?.id) {
        throw new Error("Could not get user info from Google sign-in.");
      }
      return {
        user,
        supabaseAccessToken: data?.session?.access_token || accessToken,
      };
    }

    return null;
  };

  useEffect(() => {
    const loadGoogleAuthError = async () => {
      try {
        const stored = await AsyncStorage.getItem("google_auth_error");
        if (stored) {
          setError(friendlyGoogleAuthError(stored));
          await AsyncStorage.removeItem("google_auth_error");
        }
      } catch {}
    };
    loadGoogleAuthError();
  }, []);

  // Listen for OAuth callbacks that arrive through native deep linking.
  useEffect(() => {
    const handleDeepLink = async ({ url }) => {
      if (!supabase || !isGoogleAuthCallbackUrl(url)) return;
      const shouldHandle =
        authSessionInProgressRef.current ||
        (await hasRecentGoogleAuthAttempt());
      if (!shouldHandle) return;

      try {
        const authResult = await completeSupabaseSessionFromUrl(url);
        if (authResult?.user?.email && authResult?.user?.id) {
          await handleSupabaseGoogleUser(
            authResult.user,
            undefined,
            authResult.supabaseAccessToken,
          );
        }
      } catch (e) {
        console.error("[DeepLink] Google OAuth callback error:", e);
        await AsyncStorage.multiRemove([
          GOOGLE_AUTH_INTENT_KEY,
          GOOGLE_AUTH_STARTED_AT_KEY,
        ]);
        setError(friendlyGoogleAuthError(e));
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => sub.remove();
  }, [activeTab]);

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

  const roleToRoute = (role) => {
    const normalized = String(role || "").toLowerCase();
    if (normalized === "waiter") return "/waiter";
    if (normalized === "kitchen" || normalized === "chef") return "/kitchen";
    return "/admin";
  };

  const routeAfterLogin = async (role) => {
    const target = roleToRoute(role);
    if (target !== "/admin") {
      router.replace(target);
      return;
    }

    try {
      const [locRes, branchRes] = await Promise.all([
        api.get("/api/admin/locations"),
        api.get("/api/admin/branches?include_archived=0"),
      ]);
      const locations = Array.isArray(locRes?.locations)
        ? locRes.locations
        : [];
      if (locations.length <= 1) {
        router.replace(target);
        return;
      }

      const addressByRestaurant = {};
      for (const branch of branchRes?.branches || []) {
        const address = String(branch?.address || "").trim();
        if (address) addressByRestaurant[branch.restaurant_id] = address;
      }

      const options = locations.map((loc) => {
        const rid = String(loc?.restaurant_id || "");
        const restaurantName = String(loc?.restaurant || "Branch");
        const addr = addressByRestaurant[rid];
        return {
          id: rid,
          label: addr ? `${restaurantName} - ${addr}` : restaurantName,
        };
      });

      setBranchOptions(options);
      setSelectedBranchId(String(options[0]?.id || ""));
      setPendingRoute(target);
      setShowBranchPicker(true);
    } catch {
      router.replace(target);
    }
  };

  const handleConfirmBranchSelection = async () => {
    if (!selectedBranchId || isSelectingBranch) return;
    setIsSelectingBranch(true);
    setError("");
    try {
      const switchRes = await api.post("/api/admin/locations/switch", {
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
      setShowBranchPicker(false);
      router.replace(pendingRoute || "/admin");
    } catch {
      setError("Failed to switch branch. Try again.");
    } finally {
      setIsSelectingBranch(false);
    }
  };

  const doLogin = async () => {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Please enter email and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await apiLogin(normalizedEmail, password);
      const user = data.user || data;

      if (!user) throw new Error("Invalid credentials");

      try {
        await AsyncStorage.setItem("user", JSON.stringify(user));
      } catch (e) {
        console.warn("Failed to save user to AsyncStorage", e);
      }

      const role = user?.role;
      await routeAfterLogin(role);
    } catch (err) {
      const status = Number(err?.status || 0);
      const rawBody =
        typeof err?.body === "string"
          ? err.body
          : typeof err?.body?.message === "string"
            ? err.body.message
            : "";
      const normalized = String(rawBody || err?.message || "")
        .trim()
        .toLowerCase();

      if (status === 401 || normalized.includes("invalid credentials")) {
        setError("Wrong email or password.");
      } else if (normalized.includes("network request failed")) {
        setError("Network error. Please check your internet and try again.");
      } else {
        const msg = rawBody || err?.message || "Login failed";
        setError(String(msg).trim());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const doSignup = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || !confirmPassword) {
      setError("Please fill all fields");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email");
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
      const restaurantName = normalizedEmail.includes("@")
        ? normalizedEmail.split("@")[0]
        : "Qrave Restaurant";

      const emailCheckRes = await fetch(`${BASE_URL}/auth/email_available`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!emailCheckRes.ok) {
        const body = await emailCheckRes.text().catch(() => "");
        throw new Error(body || "Unable to validate email");
      }

      const emailCheck = await emailCheckRes.json().catch(() => ({}));
      if (emailCheck?.available === false) {
        throw new Error("This email is already registered");
      }

      const otpRes = await fetch(`${BASE_URL}/public/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!otpRes.ok) {
        const body = await otpRes.text().catch(() => "");
        throw new Error(body || "Failed to send verification code");
      }

      await AsyncStorage.setItem(
        "pending_signup",
        JSON.stringify({
          email: normalizedEmail,
          password,
          restaurant_name: restaurantName,
          restaurant_currency: "INR",
        }),
      );

      router.push({ pathname: "/verify", params: { email: normalizedEmail } });
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

  // Handle Google auth using Supabase session user data
  const handleSupabaseGoogleUser = async (
    user,
    intentOverride,
    supabaseAccessTokenOverride,
  ) => {
    const intent = intentOverride || (await getStoredGoogleIntent());
    const handledKey = `${intent}:${user?.id || user?.email || "unknown"}`;
    if (handledGoogleUsersRef.current.has(handledKey)) return;
    handledGoogleUsersRef.current.add(handledKey);

    try {
      setIsLoading(true);
      // Clear any previous auth tokens
      await AsyncStorage.multiRemove([
        "qrave_jwt",
        "qrave_refresh",
        "qrave_csrf",
        "token",
      ]);

      const googleUser = { email: user.email, id: user.id };
      const restaurantName = user.email.includes("@")
        ? user.email.split("@")[0]
        : "My Restaurant";
      let supabaseAccessToken = supabaseAccessTokenOverride;
      if (!supabaseAccessToken && supabase) {
        const { data: existingSession } = await supabase.auth.getSession();
        supabaseAccessToken = existingSession?.session?.access_token;
      }

      const result = await syncBackendSessionForGoogleUser(googleUser, {
        ensureSignup: intent === "signup",
        restaurantName,
        supabaseAccessToken,
      });

      if (!result.ok) {
        handledGoogleUsersRef.current.delete(handledKey);
        if (intent === "login") {
          setError(
            "No account found with this Google account. Please sign up first.",
          );
        } else {
          setError(result.message || "Google sign-up failed");
        }
        return;
      }

      const me = await api.get("/api/admin/me").catch(() => null);
      const role = me?.role || null;
      const appUser = {
        ...(me || {}),
        ...user.user_metadata,
        email: user.email,
        id: user.id,
        role,
      };
      await AsyncStorage.setItem("user", JSON.stringify(appUser));
      await AsyncStorage.multiRemove([
        GOOGLE_AUTH_INTENT_KEY,
        GOOGLE_AUTH_STARTED_AT_KEY,
      ]);

      if (!role) {
        router.replace("/setup");
        return;
      }
      await routeAfterLogin(role);
    } catch (err) {
      handledGoogleUsersRef.current.delete(handledKey);
      console.error("[GoogleAuth] Error:", err);
      setError(friendlyGoogleAuthError(err) || "Google auth failed");
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      setError("Supabase is not configured. Check your environment variables.");
      return;
    }
    setIsLoading(true);
    setError("");
    authSessionInProgressRef.current = true;
    try {
      await clearSupabasePkceState();
      const intent = activeTab === "login" ? "login" : "signup";
      await AsyncStorage.multiSet([
        [GOOGLE_AUTH_INTENT_KEY, intent],
        [GOOGLE_AUTH_STARTED_AT_KEY, String(Date.now())],
      ]);
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: SUPABASE_REDIRECT,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (oauthError) throw oauthError;
      if (!data?.url) {
        await AsyncStorage.multiRemove([
          GOOGLE_AUTH_INTENT_KEY,
          GOOGLE_AUTH_STARTED_AT_KEY,
        ]);
        return;
      }

      // Capture the callback even when Android reports a cancelled auth session.
      let fallbackUrl = null;
      const linkSub = Linking.addEventListener("url", ({ url }) => {
        if (isGoogleAuthCallbackUrl(url)) {
          fallbackUrl = url;
        }
      });

      let result;
      try {
        result = await WebBrowser.openAuthSessionAsync(
          data.url,
          SUPABASE_REDIRECT,
        );
      } catch (e) {
        console.error("[GoogleAuth] Browser error:", e);
        linkSub?.remove();
        throw e;
      }

      // Brief delay so the deep-link event can arrive if it hasn't yet
      await new Promise((r) => setTimeout(r, 600));
      linkSub?.remove();

      const authUrl =
        result?.type === "success" && result?.url ? result.url : fallbackUrl;
      console.log(
        "[GoogleAuth] result.type:",
        result?.type,
        "| authUrl captured:",
        !!authUrl,
      );

      if (!authUrl) {
        // No URL: the Linking listener may have already completed the session.
        const { data: existing } = await supabase.auth.getSession();
        if (existing?.session?.user?.email) {
          await handleSupabaseGoogleUser(
            existing.session.user,
            intent,
            existing.session.access_token,
          );
          return;
        }
        if (result?.type === "cancel") {
          await AsyncStorage.multiRemove([
            GOOGLE_AUTH_INTENT_KEY,
            GOOGLE_AUTH_STARTED_AT_KEY,
          ]);
          setError("");
        }
        return;
      }

      const authResult = await completeSupabaseSessionFromUrl(authUrl);
      if (authResult?.user?.email && authResult?.user?.id) {
        await handleSupabaseGoogleUser(
          authResult.user,
          intent,
          authResult.supabaseAccessToken,
        );
        return;
      }

      setError("Could not complete Google sign-in. Please try again.");
    } catch (err) {
      await AsyncStorage.multiRemove([
        GOOGLE_AUTH_INTENT_KEY,
        GOOGLE_AUTH_STARTED_AT_KEY,
      ]);
      console.error("[GoogleAuth] Supabase OAuth error:", err);
      setError(friendlyGoogleAuthError(err) || "Could not start Google sign-in");
    } finally {
      authSessionInProgressRef.current = false;
      setIsLoading(false);
    }
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
            <LinearGradient
              id="headerGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
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
              <View
                style={[
                  styles.inputContainer,
                  emailFocused && styles.inputContainerFocused,
                ]}
              >
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

              <View
                style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputContainerFocused,
                ]}
              >
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
                  <EyeIcon
                    open={showPassword}
                    color={passwordFocused ? THEME_COLOR : "#999"}
                  />
                </Pressable>
              </View>

              {activeTab === "signup" ? (
                <View
                  style={[
                    styles.inputContainer,
                    confirmPasswordFocused && styles.inputContainerFocused,
                  ]}
                >
                  <View style={styles.inputIcon}>
                    <LockIcon
                      color={confirmPasswordFocused ? THEME_COLOR : "#999"}
                    />
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
                  <Text style={styles.forgotPasswordText}>
                    Forgot Password?
                  </Text>
                </Pressable>
              )}

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <Pressable
                  style={[
                    styles.submitButton,
                    isLoading && styles.submitButtonDisabled,
                  ]}
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
                <Pressable
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.socialButtonPressed,
                  ]}
                  onPress={signInWithGoogle}
                  disabled={isLoading}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <Path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <Path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <Path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </Svg>
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.socialButton,
                    styles.socialButtonApple,
                    pressed && styles.socialButtonPressed,
                  ]}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path
                      d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                      fill="#FFFFFF"
                    />
                  </Svg>
                  <Text
                    style={[
                      styles.socialButtonText,
                      styles.socialButtonTextWhite,
                    ]}
                  >
                    Apple
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.termsText}>
                By continuing, you agree to our{" "}
                <Text style={styles.termsLink}>Terms</Text> and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>

              {/* No extra tab switch text; user switches via tabs */}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showBranchPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBranchPicker(false)}
      >
        <View style={styles.branchOverlay}>
          <View style={styles.branchCard}>
            <Text style={styles.branchTitle}>Choose Branch</Text>
            <Text style={styles.branchSubtitle}>
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

            <View style={styles.branchActionRow}>
              <Pressable
                onPress={handleConfirmBranchSelection}
                disabled={!selectedBranchId || isSelectingBranch}
                style={[
                  styles.branchActionBtn,
                  (!selectedBranchId || isSelectingBranch) &&
                    styles.branchActionBtnDisabled,
                ]}
              >
                {isSelectingBranch ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text style={styles.branchActionText}>Open Dashboard</Text>
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
  branchOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  branchCard: {
    width: "100%",
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
    fontSize: 34,
    fontWeight: "800",
    color: "#0F172A",
  },
  branchSubtitle: {
    marginTop: 6,
    fontSize: 16,
    color: "#64748B",
    fontWeight: "500",
  },
  branchList: {
    marginTop: 16,
    maxHeight: 260,
  },
  branchOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  branchOptionActive: {
    borderColor: "#F4B400",
    backgroundColor: "#FFFBEB",
  },
  branchOptionText: {
    fontSize: 22,
    color: "#334155",
    fontWeight: "700",
  },
  branchOptionTextActive: {
    color: "#92400E",
  },
  branchActionRow: {
    marginTop: 18,
  },
  branchActionBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4B400",
    shadowColor: "#F4B400",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  branchActionBtnDisabled: {
    opacity: 0.55,
  },
  branchActionText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
});
