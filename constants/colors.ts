/**
 * App-wide color palette constants.
 * Import from '@/constants/colors' for consistent coloring throughout the app.
 */

export const SplashColors = {
  primary: '#FFC220',
  black: '#000000',
  white: '#FFFFFF',
  backgroundSplash: '#FFC220',
  textPrimary: '#000000',
  textMuted: '#BDBDBD',
  buttonPrimary: '#000000',
} as const;

export const AdminColors = {
  accent: '#F59E0B',
  headerBg: '#FFC220',
  headerDark: '#FFAB00',
  tableFocused: '#F59E0B',
  tabInactive: '#9CA3AF',
  tabLabelActive: '#1F2937',
} as const;

export const WaiterColorsMap = {
  primary: '#0F766E',
  primaryLight: '#14B8A6',
  headerFrom: '#0F766E',
  headerTo: '#115E59',
} as const;

export const KitchenColors = {
  bg: '#FAFAF9',
  headerFrom: '#F59E0B',
  headerTo: '#D97706',
  accent: '#F59E0B',
  text: '#1C1917',
  muted: '#78716C',
  cardBg: '#FFFFFF',
} as const;

export const CompleteScreenColors = {
  themeColor: '#F4B400',
  themeDark: '#E5A800',
} as const;
