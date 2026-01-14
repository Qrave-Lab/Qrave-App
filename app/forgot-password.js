// app/forgot-password.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { sendResetOtp } from "../lib/apiClient";

const { width } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address");
      return;
    }

    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await sendResetOtp(trimmedEmail);

      setSuccess("OTP has been sent to your email");

      // Wait a moment to show success message, then navigate
      setTimeout(() => {
        router.push({
          pathname: "/verify-otp",
          params: { email: trimmedEmail },
        });
      }, 1800);
    } catch (err) {
      const errorMessage =
        err.message ||
        "Failed to send OTP. Please check your email and try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Background gradient blobs */}
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />

      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Logo / Branding */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>Q</Text>
          </View>
          <Text style={styles.appName}>Qrave</Text>
          <Text style={styles.tagline}>Scan. Order. Savor.</Text>
        </View>

        {/* Main card */}
        <View style={styles.card}>
          <Text style={styles.welcomeText}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email to receive a one-time password (OTP)
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputIcon}>
              <Text style={styles.iconText}>✉</Text>
            </View>
            <TextInput
              placeholder="Your email address"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(""); // clear error on typing
              }}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
            />
          </View>

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          {/* Back to login */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Powered by Qrave • QR Food Ordering System
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  gradientTop: {
    position: "absolute",
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#ef4444",
    opacity: 0.15,
  },

  gradientBottom: {
    position: "absolute",
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "#f59e0b",
    opacity: 0.1,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },

  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },

  logoText: {
    fontSize: 42,
    fontWeight: "900",
    color: "#ffffff",
  },

  appName: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1,
    marginBottom: 4,
  },

  tagline: {
    fontSize: 14,
    color: "#94a3b8",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1e293b",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },

  welcomeText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: "#94a3b8",
    marginBottom: 24,
    textAlign: "center",
  },

  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },

  successText: {
    color: "#6ee7b7",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },

  inputIcon: {
    position: "absolute",
    left: 16,
    zIndex: 1,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  iconText: {
    fontSize: 18,
  },

  input: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderWidth: 2,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 16,
    paddingLeft: 52,
    fontSize: 16,
    color: "#ffffff",
  },

  button: {
    backgroundColor: "#ef4444",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },

  buttonDisabled: {
    backgroundColor: "#475569",
    shadowOpacity: 0,
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  backLink: {
    marginTop: 24,
    alignItems: "center",
  },

  backLinkText: {
    color: "#94a3b8",
    fontSize: 14,
  },

  footer: {
    marginTop: 32,
    color: "#475569",
    fontSize: 13,
    textAlign: "center",
  },
});