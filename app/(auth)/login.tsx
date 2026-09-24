// @ts-nocheck
// app/(auth)/login.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
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
import Svg, { Path, Circle, Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";

// Welcome screen: Elegant top and bottom semi-circles
const WelcomeTopArt = () => (
  <View style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="none">
    <Svg width={width} height={180} viewBox={`0 0 ${width} 180`}>
      <Path
        d={`M0 0 L${width} 0 L${width} 100 Q${width / 2} 190 0 100 Z`}
        fill="#FF6300"
        fillOpacity={0.12}
      />
      <Path
        d={`M0 0 L${width} 0 L${width} 80 Q${width / 2} 160 0 80 Z`}
        fill="#FF6300"
        fillOpacity={0.08}
      />
    </Svg>
  </View>
);

const WelcomeBottomArt = () => (
  <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} pointerEvents="none">
    <Svg width={width} height={150} viewBox={`0 0 ${width} 150`}>
      <Path
        d={`M0 150 L${width} 150 L${width} 50 Q${width / 2} -30 0 50 Z`}
        fill="#FF6300"
        fillOpacity={0.12}
      />
      <Path
        d={`M0 150 L${width} 150 L${width} 70 Q${width / 2} -10 0 70 Z`}
        fill="#FF6300"
        fillOpacity={0.08}
      />
    </Svg>
  </View>
);

// Email screen: Modern, sleek fluid waves top and bottom
const EmailTopArt = () => (
  <View style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="none">
    <Svg width={width} height={180} viewBox={`0 0 ${width} 180`}>
      <Path
        d={`M0 0 L${width} 0 L${width} 60 C${width * 0.75} 160, ${width * 0.25} 0, 0 100 Z`}
        fill="#FF6300"
        fillOpacity={0.12}
      />
      <Path
        d={`M0 0 L${width} 0 L${width} 40 C${width * 0.75} 130, ${width * 0.25} 10, 0 80 Z`}
        fill="#FF6300"
        fillOpacity={0.08}
      />
    </Svg>
  </View>
);

const EmailBottomArt = () => (
  <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} pointerEvents="none">
    <Svg width={width} height={130} viewBox={`0 0 ${width} 130`}>
      <Path
        d={`M0 130 L${width} 130 L${width} 100 C${width * 0.7} -20, ${width * 0.3} 100, 0 50 Z`}
        fill="#FF6300"
        fillOpacity={0.1}
      />
    </Svg>
  </View>
);
import {
  api,
  login as apiLogin,
  persistAuthFromResponse,
  BASE_URL,
  formatError,
} from "../../lib/apiClient";
import { syncBackendSessionForGoogleUser } from "../../lib/googleBackendBridge";
import { clearSupabasePkceState, supabase } from "../../lib/supabaseClient";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#FF6300";

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {}

const SUPABASE_REDIRECT = "adminorderapp://login";
console.log("SUPABASE_REDIRECT:", SUPABASE_REDIRECT);

const GOOGLE_AUTH_INTENT_KEY = "google_auth_intent";
const GOOGLE_AUTH_STARTED_AT_KEY = "google_auth_started_at";
const GOOGLE_AUTH_TIMEOUT_MS = 10 * 60 * 1000;

const parseAuthParamsFromUrl = (url: string) => {
  const value = String(url || "");
  const queryStart = value.indexOf("?");
  const hashStart = value.indexOf("#");
  const queryEnd = hashStart >= 0 ? hashStart : value.length;
  const query = queryStart >= 0 ? value.slice(queryStart + 1, queryEnd) : "";
  const hash = hashStart >= 0 ? value.slice(hashStart + 1) : "";
  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  const get = (key: string) => queryParams.get(key) || hashParams.get(key);

  return {
    code: get("code"),
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    error: get("error") || get("error_code"),
    errorDescription: get("error_description"),
  };
};

const friendlyGoogleAuthError = (error: any) => {
  const message = String(error?.message || error || "");
  if (/pkce|code verifier|auth code and code verifier/i.test(message)) {
    return "Google sign-in session expired. Please try again.";
  }
  return message || "Could not complete Google sign-in.";
};

const isGoogleAuthCallbackUrl = (url: string) => {
  if (!url) return false;
  const { code, accessToken, error } = parseAuthParamsFromUrl(url);
  return Boolean(code || accessToken || error);
};

const EyeIcon = ({ open = false, color = "#999" }) => (
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
        <Path
          d="M12 9a3 3 0 100 6 3 3 0 000-6z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [branchOptions, setBranchOptions] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [pendingRoute, setPendingRoute] = useState("/admin");
  const [isSelectingBranch, setIsSelectingBranch] = useState(false);
  const [viewMode, setViewMode] = useState<"welcome" | "email">("welcome");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const authSessionInProgressRef = useRef(false);
  const oauthExchangePromisesRef = useRef(new Map());
  const oauthExchangeResultsRef = useRef(new Map());
  const handledGoogleUsersRef = useRef(new Set());

  const getStoredGoogleIntent = async () => {
    try {
      const stored = await AsyncStorage.getItem(GOOGLE_AUTH_INTENT_KEY);
      if (stored === "signup" || stored === "login") return stored;
      return "login";
    } catch {
      return "login";
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

  const completeSupabaseSessionFromUrl = async (url: string) => {
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
  }, []);

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
      const locations = Array.isArray(locRes?.locations) ? locRes.locations : [];
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
    const normalizedEmail = String(email || "").trim().toLowerCase();
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
      } else {
        setError(formatError(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

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
        setError(result.message || "Google sign-in failed. Please try again.");
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
      const intent = "login";
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

      await new Promise((r) => setTimeout(r, 600));
      linkSub?.remove();

      const authUrl =
        result?.type === "success" && result?.url ? result.url : fallbackUrl;

      if (!authUrl) {
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

  return (
    <View style={styles.container}>
      {viewMode === "welcome" ? <WelcomeTopArt /> : <EmailTopArt />}
      {viewMode === "welcome" ? <WelcomeBottomArt /> : <EmailBottomArt />}
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {viewMode === "welcome" ? (
            /* ── Welcome / social-login screen ── */
            <ScrollView
              contentContainerStyle={styles.scrollWelcome}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.logoWrap}>
                <Image
                  source={require("../../assets/images/logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.welcomeTextWrap}>
                <Text style={styles.welcomeTitle}>Hey there!</Text>
                <Text style={styles.welcomeSubtitle}>
                  Log in or sign up for a more personalized ordering experience.
                </Text>
              </View>

              <View style={styles.socialCol}>
                {/* Google */}
                <Pressable
                  style={({ pressed }) => [
                    styles.socialBtn,
                    pressed && styles.socialBtnPressed,
                  ]}
                  onPress={signInWithGoogle}
                  disabled={isLoading}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" style={styles.socialIcon}>
                    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </Svg>
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </Pressable>

                {/* Apple */}
                <Pressable
                  style={({ pressed }) => [
                    styles.socialBtn,
                    pressed && styles.socialBtnPressed,
                  ]}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" style={styles.socialIcon}>
                    <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#000000" />
                  </Svg>
                  <Text style={styles.socialBtnText}>Continue with Apple</Text>
                </Pressable>

                {/* Email */}
                <Pressable
                  style={({ pressed }) => [
                    styles.socialBtn,
                    pressed && styles.socialBtnPressed,
                  ]}
                  onPress={() => setViewMode("email")}
                >
                  <MaterialIcons name="email" size={20} color="#000" style={styles.socialIcon} />
                  <Text style={styles.socialBtnText}>Continue with email</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            /* ── Email / password screen ── */
            <View style={{ flex: 1 }}>
              <View style={styles.emailHeader}>
                <Pressable
                  onPress={() => setViewMode("welcome")}
                  hitSlop={15}
                  style={styles.backBtn}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#000" />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.scrollEmail}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={styles.emailPageTitle}>Continue with email</Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* Email input */}
                <View
                  style={[
                    styles.inputWrap,
                    emailFocused && styles.inputWrapFocused,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
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

                {/* Password input */}
                <View
                  style={[
                    styles.inputWrap,
                    passwordFocused && styles.inputWrapFocused,
                  ]}
                >
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
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={8}
                  >
                    <EyeIcon open={showPassword} color="#999" />
                  </Pressable>
                </View>

                <View style={styles.linkRow}>
                  <Pressable onPress={() => router.push("/forgot-password")}>
                    <Text style={styles.linkText}>Forgot password</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push("/(auth)/signup")}>
                    <Text style={styles.linkText}>Create an account</Text>
                  </Pressable>
                </View>
              </ScrollView>

              <View style={styles.bottomBtnWrap}>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    isLoading && styles.primaryBtnDisabled,
                  ]}
                  onPress={doLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Log in</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Branch picker modal */}
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
                  <ActivityIndicator color="#FFF" />
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
    backgroundColor: "#FFFFFF",
  },

  /* ── Welcome screen ── */
  scrollWelcome: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 20,
  },
  logo: {
    width: 200,
    height: 200,
  },
  welcomeTextWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#717171",
    textAlign: "center",
    lineHeight: 20,
  },
  socialCol: {
    gap: 12,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 30,
    paddingVertical: 13,
    paddingHorizontal: 20,
    backgroundColor: "#FFF",
  },
  socialBtnPressed: {
    backgroundColor: "#F5F5F5",
  },
  socialIcon: {
    marginRight: 12,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
  },

  /* ── Email screen ── */
  emailHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
    alignSelf: "flex-start",
  },
  scrollEmail: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  emailPageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 24,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEEEEE",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
  },
  inputWrapFocused: {
    borderColor: THEME_COLOR,
    backgroundColor: "#FFF",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    height: "100%",
  },
  eyeBtn: {
    padding: 4,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  linkText: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
    paddingVertical: 8,
  },
  errorText: {
    color: "#C13515",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 14,
  },
  bottomBtnWrap: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  primaryBtn: {
    height: 52,
    backgroundColor: THEME_COLOR,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },

  /* ── Branch picker ── */
  branchOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  branchCard: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  branchTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
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
    borderColor: THEME_COLOR,
    backgroundColor: "#FFF5F0",
  },
  branchOptionText: {
    fontSize: 22,
    color: "#334155",
    fontWeight: "700",
  },
  branchOptionTextActive: {
    color: "#C2410C",
  },
  branchActionRow: {
    marginTop: 18,
  },
  branchActionBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME_COLOR,
    elevation: 4,
  },
  branchActionBtnDisabled: {
    opacity: 0.55,
  },
  branchActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
