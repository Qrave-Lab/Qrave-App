import React from "react";
import {
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

const { width } = Dimensions.get("window");

interface AdminWavyHeaderProps {
  title?: string;
  subtitle?: string;
  height?: number;
  children?: React.ReactNode;
  backgroundColor?: string;
}

export default function AdminWavyHeader({
  title,
  subtitle,
  height = 220,
  children,
  backgroundColor = "#FFC220",
}: AdminWavyHeaderProps) {
  const curveHeight = height * 0.85;

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
    L${width},${height * 0.85} 
    C${width * 0.75},${height} ${width * 0.25},${height * 0.75} 0,${height} 
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
            <LinearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFECB3" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#FFD54F" stopOpacity="0.3" />
            </LinearGradient>
            <LinearGradient id="grad2" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFC107" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#FFB300" stopOpacity="0.4" />
            </LinearGradient>
            <LinearGradient id="grad3" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFD600" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFAB00" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path d={path1} fill="url(#grad1)" />
          <Path d={path2} fill="url(#grad2)" />
          <Path d={path3} fill="url(#grad3)" />
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
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 10 : 50,
    paddingHorizontal: 20,
    justifyContent: "flex-start",
  },
  defaultContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -1,
    textShadowColor: "rgba(0, 0, 0, 0.05)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 15,
    color: "#1a1a1a",
    marginTop: 6,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
