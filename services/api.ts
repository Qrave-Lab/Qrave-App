/**
 * Re-exports the core API client for use by screens and components.
 * Import from '@/services/api' instead of '@/lib/apiClient' for cleaner separation.
 */
export { api, BASE_URL, persistAuthFromResponse, getDebug } from '@/lib/apiClient';
export { login, logout, refreshAuth, createSession } from '@/lib/apiClient';
export type { ApiClient, ApiError } from '@/types/api';
