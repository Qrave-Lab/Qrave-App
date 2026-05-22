import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "https://qrave-backend.onrender.com";

async function parseJsonSafe(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text || "Request failed" };
  }
}

async function saveBackendTokens(data) {
  const accessToken = data?.access_token || data?.token || data?.accessToken;
  const refreshToken = data?.refresh_token || data?.refreshToken;
  const csrfToken = data?.csrf_token || data?.csrfToken;
  if (accessToken) await AsyncStorage.setItem("qrave_jwt", accessToken);
  if (refreshToken) await AsyncStorage.setItem("qrave_refresh", refreshToken);
  if (csrfToken) await AsyncStorage.setItem("qrave_csrf", csrfToken);
  return Boolean(accessToken);
}

async function postBackendGoogle(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    return { ok: false, status: res.status, message: data?.message || "Google auth failed" };
  }

  const saved = await saveBackendTokens(data);
  return { ok: saved, status: res.status, message: saved ? "ok" : "Token missing" };
}

async function loginBackendWithGoogle(authPayload) {
  return postBackendGoogle("/auth/google/login", authPayload);
}

async function signupBackendWithGoogle(authPayload, email, restaurantName) {
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
  googleUser,
  { ensureSignup = false, restaurantName, idToken, supabaseAccessToken } = {}
) {
  const email = googleUser?.email;
  const authPayload = {};
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
