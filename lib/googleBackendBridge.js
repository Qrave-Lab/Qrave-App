import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "https://qrave-backend.onrender.com";

function buildGoogleBackendPassword(userId) {
  const normalized = String(userId || "").replace(/[^a-zA-Z0-9]/g, "");
  if (!normalized) return null;
  return `QraveG_${normalized.slice(0, 24)}_A9!`;
}

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

async function loginBackend(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    return { ok: false, status: res.status, message: data?.message || "Login failed" };
  }

  const saved = await saveBackendTokens(data);
  return { ok: saved, status: res.status, message: saved ? "ok" : "Token missing" };
}

async function isEmailAvailable(email) {
  const res = await fetch(`${BASE_URL}/auth/email_available`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) return { ok: false, available: false };
  return { ok: true, available: Boolean(data?.available) };
}

async function signupBackend(email, password, restaurantName) {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      email,
      password,
      restaurant_name: restaurantName || (email.includes("@") ? email.split("@")[0] : "Qrave Restaurant"),
      restaurant_currency: "INR",
    }),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    return { ok: false, status: res.status, message: data?.message || "Signup failed" };
  }

  const saved = await saveBackendTokens(data);
  return { ok: saved, status: res.status, message: saved ? "ok" : "Token missing" };
}

export async function syncBackendSessionForGoogleUser(
  googleUser,
  { ensureSignup = false, restaurantName } = {}
) {
  const email = googleUser?.email;
  const password = buildGoogleBackendPassword(googleUser?.id);
  if (!email || !password) {
    return { ok: false, message: "Missing Google account identity" };
  }

  if (!ensureSignup) {
    return loginBackend(email, password);
  }

  const availability = await isEmailAvailable(email);
  if (availability.ok && availability.available) {
    return signupBackend(email, password, restaurantName);
  }

  return loginBackend(email, password);
}

