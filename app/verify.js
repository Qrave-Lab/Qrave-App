import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#F4B400";
const THEME_DARK = "#E5A800";
const BASE_URL = "https://qrave-backend.onrender.com";

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const [code, setCode] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [error, setError] = useState("");
  const inputRefs = useRef([]);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text.replace(/[^0-9]/g, "").slice(0, 1);
    setCode(newCode);
    setError("");
    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

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

  const handleVerify = async () => {
    if (!email) {
      setError("Missing email");
      return;
    }
    if (code.some((d) => !d)) {
      setError("Enter the 4-digit code");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/public/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.join("") }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Invalid code");
      }

      const pendingSignupRaw = await AsyncStorage.getItem("pending_signup");
      if (pendingSignupRaw) {
        const pendingSignup = JSON.parse(pendingSignupRaw);
        if (pendingSignup?.email && pendingSignup?.password) {
          const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingSignup),
          });

          if (!signupRes.ok) {
            const signupBody = await signupRes.text().catch(() => "");
            throw new Error(signupBody || "Signup failed");
          }

          const signupData = await signupRes.json().catch(() => ({}));
          const accessToken = signupData.access_token || signupData.accessToken;
          const refreshToken = signupData.refresh_token || signupData.refreshToken;

          if (accessToken) {
            await AsyncStorage.setItem("qrave_jwt", accessToken);
          }
          if (refreshToken) {
            await AsyncStorage.setItem("qrave_refresh", refreshToken);
          }
        }

        await AsyncStorage.removeItem("pending_signup");
      }

      router.push("/setup");
    } catch (err) {
      setError(err?.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    try {
      await fetch(`${BASE_URL}/public/otp/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      setError(err?.message || "Failed to resend");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <Svg
          height={height * 0.38}
          width={width}
          viewBox={`0 0 ${width} ${height * 0.38}`}
          style={styles.headerSvg}
        >
          <Defs>
            <LinearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={THEME_COLOR} />
              <Stop offset="100%" stopColor={THEME_DARK} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M0 0 L${width} 0 L${width} ${height * 0.25}
              C${width * 0.75} ${height * 0.32}, ${width * 0.5} ${height * 0.22}, ${width * 0.25} ${height * 0.30}
              C0 ${height * 0.36}, 0 ${height * 0.28}, 0 ${height * 0.25} Z`}
            fill="url(#headerGradient)"
          />
          <Path
            d={`M0 ${height * 0.20}
              Q${width * 0.25} ${height * 0.15}, ${width * 0.5} ${height * 0.22}
              Q${width * 0.75} ${height * 0.28}, ${width} ${height * 0.18}`}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={2}
            fill="none"
          />
        </Svg>

        <SafeAreaView style={styles.logoContainer}>
          <Text style={styles.logoText}>QRAVE</Text>
          <Text style={styles.tagline}>Verify your email</Text>
        </SafeAreaView>
      </View>

      <View style={styles.cardContainer}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                stroke={THEME_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M22 6l-10 7L2 6"
                stroke={THEME_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We{"'"}ve sent a 4-digit code to your email address
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.otpContainer}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  inputRefs.current[i] = ref;
                }}
                style={[
                  styles.otpBox,
                  focusedIndex === i && styles.otpBoxFocused,
                  digit && styles.otpBoxFilled,
                ]}
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() => setFocusedIndex(null)}
              />
            ))}
          </View>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn{"'"}t receive code? </Text>
            <Pressable onPress={handleResend}>
              <Text style={styles.resendLink}>Resend</Text>
            </Pressable>
          </View>

          <Animated.View style={{ transform: [{ scale: buttonScale }], width: "100%" }}>
            <Pressable
              style={[styles.verifyButton, isLoading && styles.buttonDisabled]}
              onPress={handleVerify}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isLoading || code.some((d) => !d)}
            >
              {isLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Email</Text>
              )}
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
  tagline: {
    fontSize: 12,
    color: "#111827",
    opacity: 0.8,
    marginTop: 4,
  },
  cardContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: height * 0.1,
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF9E6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  otpBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F5F6F8",
    borderWidth: 2,
    borderColor: "transparent",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  otpBoxFocused: {
    borderColor: THEME_COLOR,
    backgroundColor: "#FFFEF8",
  },
  otpBoxFilled: {
    backgroundColor: "#FFF9E6",
    borderColor: THEME_COLOR,
  },
  resendContainer: {
    flexDirection: "row",
    marginBottom: 24,
  },
  resendText: {
    fontSize: 13,
    color: "#6B7280",
  },
  resendLink: {
    fontSize: 13,
    color: THEME_COLOR,
    fontWeight: "600",
  },
  verifyButton: {
    height: 54,
    backgroundColor: THEME_COLOR,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
});
