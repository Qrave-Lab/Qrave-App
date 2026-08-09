import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { ApiClient, ApiError } from '@/types/api';
import type { LoginResponse } from '@/types/auth';

export const BASE_URL: string = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.100:3000";
const TOKEN_KEY = 'qrave_jwt';
const REFRESH_KEY = 'qrave_refresh';
const CSRF_KEY = 'qrave_csrf';

async function saveToken(token: string): Promise<void> {
  if (!token) return;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function saveRefreshToken(refresh: string): Promise<void> {
  if (!refresh) return;
  await AsyncStorage.setItem(REFRESH_KEY, refresh);
}

async function saveCsrfToken(token: string): Promise<void> {
  if (!token) return;
  await AsyncStorage.setItem(CSRF_KEY, token);
}

async function removeCsrfToken(): Promise<void> {
  await AsyncStorage.removeItem(CSRF_KEY);
}

export async function persistAuthFromResponse(data: LoginResponse | null | undefined): Promise<void> {
  if (!data || typeof data !== 'object') return;
  const token =
    data.access_token ||
    data.token ||
    data.accessToken ||
    data.jwt ||
    data?.auth?.access_token;
  const refresh =
    data.refresh_token ||
    data.refreshToken ||
    data?.auth?.refresh_token;
  const csrf =
    data.csrf_token ||
    data.csrfToken ||
    data?.auth?.csrf_token;

  if (token) await saveToken(token);
  if (refresh) await saveRefreshToken(refresh);
  if (csrf) await saveCsrfToken(csrf);
}
async function saveDebug(key: string, obj: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(`debug_${key}`, JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save debug', e);
  }
}

export async function getDebug(key: string): Promise<unknown> {
  try {
    const v = await AsyncStorage.getItem(`debug_${key}`);
    return v ? JSON.parse(v) : null;
  } catch (_e) {
    return null;
  }
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function removeToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function removeRefreshToken(): Promise<void> {
  await AsyncStorage.removeItem(REFRESH_KEY);
}

async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_e) {
    return text;
  }
}

function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    if (typeof atob === 'function') {
      return JSON.parse(atob(normalized));
    }
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch (_e) {
    return null;
  }
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function getStoredCsrfToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CSRF_KEY);
  } catch (_e) {
    return null;
  }
}

function extractCookieValue(setCookie: string | null | undefined, name: string): string | null {
  if (!setCookie) return null;
  const pattern = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`);
  const match = String(setCookie).match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData;
}

async function request(path: string, opts: RequestOptions = {}): Promise<unknown> {
  const token = await getToken();
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const isFormData =
    typeof FormData !== 'undefined' && opts.body instanceof FormData;

  if (opts.body && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const method = (opts.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf =
      Platform.OS === 'web'
        ? (getCsrfToken() || (await getStoredCsrfToken()))
        : await getStoredCsrfToken();
    if (csrf && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...opts,
    headers,
  });

  // On 401, try a single refresh attempt then retry the original request once.
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = await getToken();
      const retryHeaders: Record<string, string> = { ...(opts.headers || {}), ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}) };
      res = await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',
        ...opts,
        headers: retryHeaders,
      });
    } else {
      const err: ApiError = new Error('Unauthorized') as ApiError;
      err.status = 401;
      throw err;
    }
  }

  if (!res.ok) {
    const body = await parseResponse(res);
    const err: ApiError = new Error('Request failed') as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return parseResponse(res);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const refreshToken = await getRefreshToken();
    const body = refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined;
    const headers: Record<string, string> = body ? { 'Content-Type': 'application/json' } : {};
    const csrf = Platform.OS === 'web' ? getCsrfToken() : await getStoredCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body,
    });

    if (!res.ok) {
      // refresh failed; clear tokens
      await removeToken();
      await removeRefreshToken();
      return false;
    }

    const setCookie =
      res.headers.get('set-cookie') ||
      ((res.headers as unknown as { map?: Record<string, string> }).map?.['set-cookie'] ?? null);
    const csrfToken = extractCookieValue(setCookie, 'csrf_token');
    if (csrfToken) await saveCsrfToken(csrfToken);

    const data = await parseResponse(res) as Record<string, unknown>;
    const token = (data.token || data.accessToken || data.access_token) as string | undefined;
    const refresh = (data.refreshToken || data.refresh_token) as string | undefined;
    const csrfBody = (data.csrf_token || data.csrfToken) as string | undefined;
    if (token) await saveToken(token);
    if (refresh) await saveRefreshToken(refresh);
    if (csrfBody) await saveCsrfToken(csrfBody);
    return !!token;
  } catch (_e) {
    await removeToken();
    await removeRefreshToken();
    return false;
  }
}

export async function login(email: string, password: string): Promise<LoginResponse & { token?: string; refresh?: string; user: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await parseResponse(res);
    await saveDebug('login_error', { status: res.status, body });
    try {
      console.warn('API login failed', { status: res.status, body });
    } catch (_e) { /* noop */ }
    const err: ApiError = new Error('Login failed') as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const setCookie =
    res.headers.get('set-cookie') ||
    ((res.headers as unknown as { map?: Record<string, string> }).map?.['set-cookie'] ?? null);
  const csrfToken = extractCookieValue(setCookie, 'csrf_token');
  if (csrfToken) await saveCsrfToken(csrfToken);

  const data = await parseResponse(res) as LoginResponse;
  await saveDebug('login_success', { status: res.status, body: data });
  // Use access_token and refresh_token from backend
  const token = data.access_token || data.token || data.accessToken;
  const refresh = data.refresh_token || data.refreshToken;
  const csrf = data.csrf_token || data.csrfToken;
  if (token) {
    await saveToken(token);
  }
  if (refresh) {
    await saveRefreshToken(refresh);
  }
  if (csrf) {
    await saveCsrfToken(csrf);
  }

  // Always fetch user profile after login
  let user: Record<string, unknown> | null = null;
  try {
    const profileRes = await fetch(`${BASE_URL}/api/admin/me`, {
      method: 'GET',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined as unknown as HeadersInit,
    });
    if (profileRes.ok) {
      const profile = await parseResponse(profileRes);
      user = profile as Record<string, unknown>;
      await saveDebug('profile', { status: profileRes.status, body: profile });
    } else {
      const body = await parseResponse(profileRes);
      await saveDebug('profile_error', { status: profileRes.status, body });
    }
  } catch (e) {
    console.warn('Failed to fetch profile after login', e);
    await saveDebug('profile_error', { message: String((e as Error)?.message || e) });
  }

  // Fallback: keep login successful even if /api/admin/me is temporarily failing.
  if (!user && token) {
    const payload = decodeJwtPayload(token) || {};
    user = {
      user_id: data.user_id || payload.user_id || payload.sub,
      restaurant_id: data.restaurant_id || payload.restaurant_id,
      role: data.role || payload.role || 'owner',
      email: email,
    };
  }

  if (!token || !user) {
    const err: ApiError = new Error('Invalid credentials') as ApiError;
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return { ...data, token, refresh, user } as LoginResponse & { token?: string; refresh?: string; user: Record<string, unknown> };
}

export async function logout(): Promise<void> {
  const token = await getToken();
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined as unknown as HeadersInit,
      credentials: 'include',
    });
  } finally {
    await removeToken();
    await removeRefreshToken();
    await removeCsrfToken();
  }
}

export async function refreshAuth(): Promise<string | null> {
  const ok = await tryRefresh();
  if (!ok) throw new Error('Refresh failed');
  return await getToken();
}

export async function createSession(email: string, password: string): Promise<unknown> {
  await login(email, password);
  return await api.get('/api/admin/me');
}


export const api: ApiClient = {
  get: (path: string) => request(path, { method: 'GET' }),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: (path: string, body: FormData) => request(path, { method: 'POST', body }),
  put: (path: string, body?: unknown) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path: string, body?: unknown) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path: string, body?: unknown) => request(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string, body?: unknown) => request(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};



export default api;
