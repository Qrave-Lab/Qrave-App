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
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TopWaveArt, BottomWaveArt } from "../../components/auth/FluidWaves";
import { BASE_URL } from "../../lib/apiClient";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#FF6300";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current;

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

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setError("Enter a valid email");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const endpoints = ["/auth/forgot-password/request", "/public/otp/request"];
      let sent = false;
      for (const endpoint of endpoints) {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail }),
        });
        if (res.status === 404 || res.status === 405) continue;
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Failed to send code");
        }
        sent = true;
        break;
      }
      if (!sent) throw new Error("Reset endpoint not available");
      router.push({ pathname: "/forgot-otp", params: { email: trimmedEmail } });
    } catch (err) {
      setError(err?.message || "Failed to send code");
    } finally {
      setIsLoading(false);
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
              <Text style={styles.welcomeTitle}>Enter your email</Text>
              <Text style={styles.subtitle}>
                We'll send a 4-digit code to reset your password.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  editable={!isLoading}
                />
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }], width: "100%" }}>
                <Pressable
                  style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Code</Text>
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
  inputContainer: {
    width: "100%",
    backgroundColor: "#EEEEEE",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 18,
    justifyContent: "center",
  },
  inputContainerFocused: {
    borderColor: THEME_COLOR,
    backgroundColor: "#FFF",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#222",
    height: "100%",
  },
  primaryButton: {
    height: 52,
    backgroundColor: THEME_COLOR,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
