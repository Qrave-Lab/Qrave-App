import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "./apiClient";

import type { GoogleAuthPayload, GoogleSyncOptions, GoogleSyncResult } from "@/types/auth";

interface GoogleUser {
  email?: string;
  id?: string;
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text || "Request failed" };
  }
}

async function saveBackendTokens(data: Record<string, unknown>): Promise<boolean> {
  const accessToken = (data?.access_token || data?.token || data?.accessToken) as string | undefined;
  const refreshToken = (data?.refresh_token || data?.refreshToken) as string | undefined;
  const csrfToken = (data?.csrf_token || data?.csrfToken) as string | undefined;
  if (accessToken) await AsyncStorage.setItem("qrave_jwt", accessToken);
  if (refreshToken) await AsyncStorage.setItem("qrave_refresh", refreshToken);
  if (csrfToken) await AsyncStorage.setItem("qrave_csrf", csrfToken);
  return Boolean(accessToken);
}

async function postBackendGoogle(path: string, body: GoogleAuthPayload | Record<string, unknown>): Promise<GoogleSyncResult> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    return { ok: false, status: res.status, message: (data?.message as string) || "Google auth failed" };
  }

  const saved = await saveBackendTokens(data);
  return { ok: saved, status: res.status, message: saved ? "ok" : "Token missing" };
}

async function loginBackendWithGoogle(authPayload: GoogleAuthPayload): Promise<GoogleSyncResult> {
  return postBackendGoogle("/auth/google/login", authPayload);
}

async function signupBackendWithGoogle(authPayload: GoogleAuthPayload, email: string, restaurantName?: string): Promise<GoogleSyncResult> {
  return postBackendGoogle("/auth/google/signup", {
    ...authPayload,
    restaurant_name:
      restaurantName || (email.includes("@") ? email.split("@")[0] : "Qrave Restaurant"),
    currency: "INR",
    table_count: 10,
    subscription_plan: "monthly_499",
  });
}

export async function syncBackendSessionForGoogleUser(
  googleUser: GoogleUser,
  { ensureSignup = false, restaurantName, idToken, supabaseAccessToken }: GoogleSyncOptions = {}
): Promise<GoogleSyncResult> {
  const email = googleUser?.email;
  const authPayload: GoogleAuthPayload = {};
  if (idToken) authPayload.id_token = idToken;
  if (supabaseAccessToken) authPayload.supabase_access_token = supabaseAccessToken;
  if (!email || (!authPayload.id_token && !authPayload.supabase_access_token)) {
    return { ok: false, message: "Missing Google account identity" };
  }

  if (!ensureSignup) {
    return loginBackendWithGoogle(authPayload);
  }

  const signup = await signupBackendWithGoogle(authPayload, email, restaurantName);
  if (signup.ok || signup.status !== 409) {
    return signup;
  }

  return loginBackendWithGoogle(authPayload);
}
