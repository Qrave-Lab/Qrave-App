import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import Constants from "expo-constants";
import "expo-crypto";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !String(supabaseAnonKey).startsWith("REPLACE_WITH_");

const isExpoGo = Constants?.appOwnership === "expo";

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Expo Go lacks WebCrypto, so avoid PKCE in dev to prevent OAuth failures.
        flowType: isExpoGo ? "implicit" : "pkce",
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
