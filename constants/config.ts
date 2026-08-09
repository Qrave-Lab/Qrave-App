/**
 * App-wide configuration constants.
 */

export const AppConfig = {
  APP_NAME: 'QRAVE',
  DEFAULT_CURRENCY: 'INR',
  DEFAULT_TABLE_COUNT: 10,
  DEFAULT_SUBSCRIPTION_PLAN: 'monthly_499',
} as const;

export const StorageKeys = {
  USER: 'user',
  TOKEN: 'qrave_jwt',
  REFRESH_TOKEN: 'qrave_refresh',
  CSRF_TOKEN: 'qrave_csrf',
  ORDERS: 'orders',
  NOTIFICATIONS: 'notifications',
  LOGO_VERSION: 'qrave_logo_updated_at',
} as const;

export const UserRoles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  WAITER: 'waiter',
  KITCHEN: 'kitchen',
  CHEF: 'chef',
} as const;

export const isAdminRole = (role?: string): boolean =>
  role === UserRoles.OWNER || role === UserRoles.MANAGER;

export const isWaiterRole = (role?: string): boolean =>
  role === UserRoles.WAITER;

export const isKitchenRole = (role?: string): boolean =>
  role === UserRoles.KITCHEN || role === UserRoles.CHEF;
