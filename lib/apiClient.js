import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = 'https://qrave-backend.onrender.com';
const TOKEN_KEY = 'qrave_jwt';
const REFRESH_KEY = 'qrave_refresh';
const CSRF_KEY = 'qrave_csrf';

async function saveToken(token) {
  if (!token) return;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function saveRefreshToken(refresh) {
  if (!refresh) return;
  await AsyncStorage.setItem(REFRESH_KEY, refresh);
}

async function saveCsrfToken(token) {
  if (!token) return;
  await AsyncStorage.setItem(CSRF_KEY, token);
}

async function removeCsrfToken() {
  await AsyncStorage.removeItem(CSRF_KEY);
}
async function saveDebug(key, obj) {
  try {
    await AsyncStorage.setItem(`debug_${key}`, JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save debug', e);
  }
}

export async function getDebug(key) {
  try {
    const v = await AsyncStorage.getItem(`debug_${key}`);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function removeToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function removeRefreshToken() {
  await AsyncStorage.removeItem(REFRESH_KEY);
}

async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_KEY);
}

async function parseResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

function getCsrfToken() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function getStoredCsrfToken() {
  try {
    return await AsyncStorage.getItem(CSRF_KEY);
  } catch (e) {
    return null;
  }
}

function extractCookieValue(setCookie, name) {
  if (!setCookie) return null;
  const pattern = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`);
  const match = String(setCookie).match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request(path, opts = {}) {
  const token = await getToken();
  const headers = { ...(opts.headers || {}) };
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
      const retryHeaders = { ...(opts.headers || {}), ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}) };
      res = await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',
        ...opts,
        headers: retryHeaders,
      });
    } else {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
  }

  if (!res.ok) {
    const body = await parseResponse(res);
    const err = new Error('Request failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return parseResponse(res);
}

async function tryRefresh() {
  try {
    const refreshToken = await getRefreshToken();
    const body = refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined;
    const headers = body ? { 'Content-Type': 'application/json' } : undefined;
    const csrf = Platform.OS === 'web' ? getCsrfToken() : await getStoredCsrfToken();
    if (csrf) {
      if (headers) {
        headers['X-CSRF-Token'] = csrf;
      }
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
      (res.headers.map && res.headers.map['set-cookie']);
    const csrfToken = extractCookieValue(setCookie, 'csrf_token');
    if (csrfToken) await saveCsrfToken(csrfToken);

    const data = await parseResponse(res);
    const token = data.token || data.accessToken || data.access_token;
    const refresh = data.refreshToken || data.refresh_token;
    const csrfBody = data.csrf_token || data.csrfToken;
    if (token) await saveToken(token);
    if (refresh) await saveRefreshToken(refresh);
    if (csrfBody) await saveCsrfToken(csrfBody);
    return !!token;
  } catch (e) {
    await removeToken();
    await removeRefreshToken();
    return false;
  }
}

export async function login(email, password) {
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
      console.error('API login failed', { status: res.status, body });
    } catch (e) {}
    const err = new Error('Login failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const setCookie =
    res.headers.get('set-cookie') ||
    (res.headers.map && res.headers.map['set-cookie']);
  const csrfToken = extractCookieValue(setCookie, 'csrf_token');
  if (csrfToken) await saveCsrfToken(csrfToken);

  const data = await parseResponse(res);
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
  let user = null;
  try {
    const profileRes = await fetch(`${BASE_URL}/api/admin/me`, {
      method: 'GET',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (profileRes.ok) {
      const profile = await parseResponse(profileRes);
      user = profile;
      await saveDebug('profile', { status: profileRes.status, body: profile });
    }
  } catch (e) {
    console.warn('Failed to fetch profile after login', e);
  }

  if (!token || !user) {
    const err = new Error('Invalid credentials');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return { ...data, token, refresh, user };
}

export async function logout() {
  const token = await getToken();
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    });
  } finally {
    await removeToken();
    await removeRefreshToken();
    await removeCsrfToken();
  }
}

export async function refreshAuth() {
  const ok = await tryRefresh();
  if (!ok) throw new Error('Refresh failed');
  return await getToken();
}

export async function createSession(email, password) {
  await login(email, password);
  return await api.get('/api/admin/me');
}


export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path, body) => request(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  delete: (path, body) => request(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};



export default api;
//janathak@gmail.com 12345678
