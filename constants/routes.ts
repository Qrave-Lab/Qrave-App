/**
 * Route path constants for type-safe navigation.
 */

export const Routes = {
  // Auth routes
  LOGIN: '/login' as const,
  VERIFY: '/verify' as const,
  FORGOT_PASSWORD: '/forgot-password' as const,
  FORGOT_OTP: '/forgot-otp' as const,
  RESET_PASSWORD: '/reset-password' as const,
  SETUP: '/setup' as const,
  COMPLETE: '/complete' as const,

  // Customer routes
  DASHBOARD: '/dashboard' as const,
  NOTIFICATIONS: '/notifications' as const,
  ORDER_DETAIL: '/order-detail' as const,

  // Admin
  ADMIN: '/admin' as const,
  ADMIN_PROFILE: '/admin/profile' as const,
  ADMIN_CUSTOMIZE_TABLES: '/admin/customize-tables' as const,
  ADMIN_INVENTORY: '/admin/inventory' as const,
  ADMIN_TAKEAWAY: '/admin/takeaway' as const,
  ADMIN_SALES: '/admin/sales' as const,

  // Waiter
  WAITER: '/waiter' as const,
  WAITER_CUSTOMIZE_TABLES: '/waiter/customize-tables' as const,

  // Kitchen
  KITCHEN: '/kitchen' as const,

  // Root
  ROOT: '/' as const,
} as const;

export type RouteKeys = keyof typeof Routes;
export type RoutePaths = typeof Routes[RouteKeys];
