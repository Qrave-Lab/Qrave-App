/**
 * Auth service — re-exports auth functions from the API client
 * and Google backend bridge for unified access.
 */
export { login, logout, refreshAuth, createSession } from '@/lib/apiClient';
export { syncBackendSessionForGoogleUser } from '@/lib/googleBackendBridge';
export { clearSupabasePkceState, supabase } from '@/lib/supabaseClient';
