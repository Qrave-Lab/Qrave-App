import AsyncStorage from "@react-native-async-storage/async-storage";

const LOGO_VERSION_KEY = "qrave_logo_updated_at";

export function withLogoVersion(url, version) {
  const raw = String(url || "").trim();
  if (!raw) return null;

  const ver = String(version || "").trim();
  if (!ver) return raw;

  const hasQuery = raw.includes("?");
  const cleaned = raw.replace(/([?&])v=[^&]*/g, "").replace(/[?&]$/, "");
  return `${cleaned}${hasQuery ? "&" : "?"}v=${encodeURIComponent(ver)}`;
}

export async function getStoredLogoVersion() {
  try {
    return (await AsyncStorage.getItem(LOGO_VERSION_KEY)) || "";
  } catch {
    return "";
  }
}

export async function bumpLogoVersion() {
  const next = String(Date.now());
  try {
    await AsyncStorage.setItem(LOGO_VERSION_KEY, next);
  } catch {
    // ignore cache marker write failures
  }
  return next;
}
