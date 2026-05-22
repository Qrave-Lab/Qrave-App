import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import "expo-crypto";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !String(supabaseAnonKey).startsWith("REPLACE_WITH_");

// Native OAuth returns through a custom deep link after the system/browser tab
// closes. PKCE verifier storage is fragile across that boundary on physical
// devices, while Expo Go was already using the implicit token callback. Keep
// native builds on the same callback shape the login screen already handles.
const authFlowType = Platform.OS === "web" ? "pkce" : "implicit";
const getSupabaseStorageKey = () => {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "supabase.auth.token";
  }
};
const supabaseStorageKey = getSupabaseStorageKey();

export const clearSupabasePkceState = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pkceKeys = keys.filter(
      (key) =>
        key === `${supabaseStorageKey}-code-verifier` ||
        /supabase.*code-verifier/i.test(key) ||
        /auth-token-code-verifier/i.test(key),
    );
    if (pkceKeys.length) {
      await AsyncStorage.multiRemove(pkceKeys);
    }
  } catch (error) {
    console.warn("Failed to clear Supabase PKCE state", error);
  }
};

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        storageKey: supabaseStorageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: authFlowType,
        lock: processLock,
        lockAcquireTimeout: 20000,
      },
    })
  : null;

if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
      return;
    }
    supabase.auth.stopAutoRefresh();
  });
}
