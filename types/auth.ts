export interface User {
  id?: string;
  user_id?: string | number;
  email: string;
  role?: string;
  restaurant_id?: string | number;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AuthSession {
  access_token?: string;
  refresh_token?: string;
  csrf_token?: string;
  user?: User;
}

export interface LoginResponse {
  access_token?: string;
  token?: string;
  accessToken?: string;
  jwt?: string;
  refresh_token?: string;
  refreshToken?: string;
  csrf_token?: string;
  csrfToken?: string;
  user?: User;
  user_id?: string | number;
  restaurant_id?: string | number;
  role?: string;
  auth?: {
    access_token?: string;
    refresh_token?: string;
    csrf_token?: string;
  };
  [key: string]: unknown;
}

export interface SignupPayload {
  email: string;
  password: string;
  restaurant_name?: string;
  restaurant_currency?: string;
}

export interface GoogleAuthPayload {
  id_token?: string;
  supabase_access_token?: string;
  restaurant_name?: string;
  currency?: string;
  table_count?: number;
  subscription_plan?: string;
}

export interface GoogleSyncOptions {
  ensureSignup?: boolean;
  restaurantName?: string;
  idToken?: string;
  supabaseAccessToken?: string;
}

export interface GoogleSyncResult {
  ok: boolean;
  status?: number;
  message?: string;
}

export interface AuthError {
  status?: number;
  body?: unknown;
  message?: string;
}

export type UserRole = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'chef';
