import React from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { KitchenColors } from "../../constants/theme";

interface KitchenWavyHeaderProps {
  title?: string;
  subtitle?: string;
  height?: number;
  children?: React.ReactNode;
}

export default function KitchenWavyHeader({
  title,
  subtitle,
  height = 180,
  children,
}: KitchenWavyHeaderProps) {
  const statusBarH =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44;

  return (
    <View style={[styles.container, { height }]}>
      {/* Light fading amber gradient - rectangle style */}
      <LinearGradient
        colors={["rgba(245, 158, 11, 0.15)", "rgba(245, 158, 11, 0.05)", "rgba(245, 158, 11, 0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Content sits on top */}
      <View style={[styles.content, { paddingTop: statusBarH + 12 }]}>
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
    overflow: "visible",
    marginBottom: 0,
    zIndex: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  defaultContent: {},
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginTop: 4,
  },
});
