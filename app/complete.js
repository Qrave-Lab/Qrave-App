import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#F4B400";
const THEME_DARK = "#E5A800";

export default function CompleteScreen() {
  const router = useRouter();
  const buttonScale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [checkScale, textOpacity]);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const handleLaunch = () => {
    router.replace("/admin");
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <Svg
          height={height * 0.42}
          width={width}
          viewBox={`0 0 ${width} ${height * 0.42}`}
          style={styles.headerSvg}
        >
          <Defs>
            <LinearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={THEME_COLOR} />
              <Stop offset="100%" stopColor={THEME_DARK} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M0 0 L${width} 0 L${width} ${height * 0.28}
              C${width * 0.85} ${height * 0.38}, ${width * 0.6} ${height * 0.30}, ${width * 0.35} ${height * 0.36}
              C${width * 0.15} ${height * 0.40}, 0 ${height * 0.34}, 0 ${height * 0.28} Z`}
            fill="url(#headerGradient)"
          />
          <Circle cx={width * 0.85} cy={height * 0.08} r={height * 0.06} fill="rgba(255,255,255,0.1)" />
          <Circle cx={width * 0.9} cy={height * 0.12} r={height * 0.03} fill="rgba(255,255,255,0.15)" />
          <Circle cx={width * 0.1} cy={height * 0.18} r={height * 0.04} fill="rgba(255,255,255,0.08)" />
        </Svg>

        <SafeAreaView style={styles.logoContainer}>
          <Text style={styles.logoText}>QRAVE</Text>
        </SafeAreaView>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.successIconContainer,
              { transform: [{ scale: checkScale }] },
            ]}
          >
            <View style={styles.successIconInner}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6L9 17l-5-5"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: textOpacity }}>
            <Text style={styles.title}>You{"'"}re all set!</Text>
            <Text style={styles.subtitle}>
              Your restaurant is ready to accept orders.{"\n"}
              Start managing your tables and menu.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.featuresContainer, { opacity: textOpacity }]}>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>QR codes for each table</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Real-time order tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Easy menu management</Text>
            </View>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: buttonScale }], width: "100%" }}>
            <Pressable
              style={styles.launchButton}
              onPress={handleLaunch}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Text style={styles.launchButtonText}>Launch Dashboard</Text>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8 }}>
                <Path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="#111827"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  headerSvg: {
    position: "absolute",
    top: 0,
  },
  logoContainer: {
    position: "absolute",
    top: 0,
    width: "100%",
    alignItems: "center",
    paddingTop: 44,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 3,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  featuresContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 28,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME_COLOR,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  launchButton: {
    height: 56,
    backgroundColor: THEME_COLOR,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  launchButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
});
