// @ts-nocheck
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
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TopWaveArt, BottomWaveArt } from "../../components/auth/FluidWaves";
import { BASE_URL } from "../../lib/apiClient";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#FF6300";

export default function ForgotOtpScreen() {
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
        const msg = await res.text();
        throw new Error(msg || "Invalid code");
      }
      router.push({
        pathname: "/reset-password",
        params: { email, code: code.join("") },
      });
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
      <TopWaveArt />
      <BottomWaveArt />

      <Pressable onPress={() => router.back()} style={styles.backBtnOverlay}>
        <MaterialIcons name="arrow-back-ios" size={24} color="#000000" />
      </Pressable>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>

            <View style={styles.contentContainer}>
              <Text style={styles.welcomeTitle}>Enter Reset Code</Text>
              <Text style={styles.subtitle}>
                We've sent a 4-digit code to reset your password.
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
                <Text style={styles.resendText}>Didn't receive code? </Text>
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
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Continue</Text>
                  )}
                </Pressable>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: Dimensions.get('window').height * 0.28,
    marginTop: 20,
  },
  logo: {
    width: 160,
    height: 160,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backBtnOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#717171",
    marginBottom: 24,
    lineHeight: 20,
  },
  errorText: {
    color: "#C13515",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 16,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  otpBox: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#EEEEEE",
    borderWidth: 1.5,
    borderColor: "transparent",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  otpBoxFocused: {
    borderColor: THEME_COLOR,
    backgroundColor: "#FFF",
  },
  otpBoxFilled: {
    backgroundColor: "#EEEEEE",
  },
  resendContainer: {
    flexDirection: "row",
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: "#717171",
  },
  resendLink: {
    fontSize: 14,
    color: "#000000",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  verifyButton: {
    height: 52,
    backgroundColor: THEME_COLOR,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
