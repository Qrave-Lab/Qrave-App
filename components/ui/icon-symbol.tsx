// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  // custom mappings used in admin UI
  "fork.knife": "restaurant",
  "doc.text": "receipt",
  "bell.fill": "notifications",
  clock: "access-time",
  bag: "shopping-bag",
  "arrow.right.arrow.left": "swap-horiz",
  "arrow.triangle.branch": "merge-type",
  "checkmark.circle": "check-circle",
  "square.and.arrow.up": "exit-to-app",
} as Record<string, string>;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const iconName = (MAPPING as any)[name] ?? name;
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={iconName as any}
      style={style}
    />
  );
}
