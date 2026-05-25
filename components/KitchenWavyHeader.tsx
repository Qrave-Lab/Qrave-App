import React, { useMemo } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface KitchenWavyHeaderProps {
  title?: string;
  subtitle?: string;
  height?: number;
  children?: React.ReactNode;
}

export default function KitchenWavyHeader({
  title,
  subtitle,
  height = 160,
  children,
}: KitchenWavyHeaderProps) {
  const { width } = useWindowDimensions();
  const curveHeight = height * 0.85;

  const gradientIds = useMemo(
    () => ({
      g1: `khdr_g1_${Math.random().toString(36).slice(2, 9)}`,
      g2: `khdr_g2_${Math.random().toString(36).slice(2, 9)}`,
      g3: `khdr_g3_${Math.random().toString(36).slice(2, 9)}`,
    }),
    [],
  );

  const path1 = `
    M0,0 
    L${width},0 
    L${width},${curveHeight * 0.7} 
    C${width * 0.6},${curveHeight * 0.9} ${width * 0.3},${curveHeight * 0.5} 0,${curveHeight * 0.8} 
    Z
  `;

  const path2 = `
    M0,0 
    L${width},0 
    L${width},${curveHeight * 0.55} 
    C${width * 0.7},${curveHeight * 0.75} ${width * 0.4},${curveHeight * 0.4} 0,${curveHeight * 0.65} 
    Z
  `;

  const path3 = `
    M0,0 
    L${width},0 
    L${width},${height * 0.851} 
    C${width * 0.751},${height} ${width * 0.251},${height * 0.751} 0,${height} 
    Z
  `;

  return (
    <View style={[styles.container, { height }]}>
      <View style={StyleSheet.absoluteFill}>
        <Svg
          height="100%"
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <Defs>
            {/* Lightest layer — warm amber shimmer */}
            <LinearGradient id={gradientIds.g1} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FED7AA" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#FDBA74" stopOpacity="0.35" />
            </LinearGradient>
            {/* Mid layer — orange glow */}
            <LinearGradient id={gradientIds.g2} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FB923C" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#F97316" stopOpacity="0.45" />
            </LinearGradient>
            {/* Base layer — deep burnt-orange gradient */}
            <LinearGradient id={gradientIds.g3} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#EA580C" stopOpacity="1" />
              <Stop offset="1" stopColor="#C2410C" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path d={path1} fill={`url(#${gradientIds.g1})`} />
          <Path d={path2} fill={`url(#${gradientIds.g2})`} />
          <Path d={path3} fill={`url(#${gradientIds.g3})`} />
        </Svg>
      </View>

      <View style={styles.content}>
        {children ? (
          children
        ) : (
          <View style={styles.defaultContent}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    paddingTop:
      Platform.OS === "android" || Platform.OS === "ios"
        ? (StatusBar.currentHeight ?? 24)
        : 0,
    marginBottom: -2,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  defaultContent: {},
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    fontWeight: "600",
    marginTop: 4,
  },
});
