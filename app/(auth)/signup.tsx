// @ts-nocheck
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Defs } from "react-native-svg";
import { TopWaveArt, BottomWaveArt } from "../../components/auth/FluidWaves";
import { BASE_URL } from "../../lib/apiClient";

const { width, height } = Dimensions.get("window");
const THEME_COLOR = "#FF6300";

const EyeIcon = ({ open = false, color = "#999" }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    {open ? (
      <>
        <Path
          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12 9a3 3 0 100 6 3 3 0 000-6z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ) : (
      <>
        <Path
          d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M1 1l22 22"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
  </Svg>
);

export default function SignupScreen() {
  const router = useRouter();
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [firstNameFocused, setFirstNameFocused] = useState(false);
  const [lastNameFocused, setLastNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const doSignup = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!firstName.trim() || !lastName.trim() || !normalizedEmail || !password) {
      setError("Please fill all fields");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!termsAccepted) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const restaurantName = `${firstName.trim()} ${lastName.trim()}` || "Qrave Restaurant";

      const emailCheckRes = await fetch(`${BASE_URL}/auth/email_available`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!emailCheckRes.ok) {
        const body = await emailCheckRes.text().catch(() => "");
        throw new Error(body || "Unable to validate email");
      }

      const emailCheck = await emailCheckRes.json().catch(() => ({}));
      if (emailCheck?.available === false) {
        throw new Error("This email is already registered");
      }

      const otpRes = await fetch(`${BASE_URL}/public/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      
      if (!otpRes.ok) {
        const body = await otpRes.text().catch(() => "");
        throw new Error(body || "Failed to send verification code");
      }

      await AsyncStorage.setItem(
        "pending_signup",
        JSON.stringify({
          email: normalizedEmail,
          password,
          restaurant_name: restaurantName,
          restaurant_currency: "INR",
        }),
      );

      router.push({ pathname: "/verify", params: { email: normalizedEmail } });
    } catch (err) {
      const msg = err?.message || "Signup failed";
      setError(String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopWaveArt />
      <BottomWaveArt />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} hitSlop={15} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={24} color="#000" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.pageTitle}>Continue with email</Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={[styles.inputWrap, firstNameFocused && styles.inputWrapFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor="#9CA3AF"
                  value={firstName}
                  onChangeText={setFirstName}
                  onFocus={() => setFirstNameFocused(true)}
                  onBlur={() => setFirstNameFocused(false)}
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputWrap, lastNameFocused && styles.inputWrapFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Last name"
                  placeholderTextColor="#9CA3AF"
                  value={lastName}
                  onChangeText={setLastName}
                  onFocus={() => setLastNameFocused(true)}
                  onBlur={() => setLastNameFocused(false)}
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
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

              <View style={[styles.inputWrap, passwordFocused && styles.inputWrapFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Choose password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  editable={!isLoading}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  <EyeIcon open={showPassword} color="#999" />
                </Pressable>
              </View>
              
              <View style={styles.passwordRulesContainer}>
                  <Text style={styles.passwordRulesTitle}>Password must be at least 8 characters and should include:</Text>
                  <Text style={styles.passwordRuleText}>• 1 uppercase letter (A-Z)</Text>
                  <Text style={styles.passwordRuleText}>• 1 lowercase letter (a-z)</Text>
                  <Text style={styles.passwordRuleText}>• 1 number (0-9)</Text>
                  <Text style={styles.passwordRuleText}>• 1 special character (~@#\\$%^&*_+-=,./?)</Text>
              </View>
            </ScrollView>

            <View style={styles.bottomSection}>
              <Pressable 
                style={styles.checkboxContainer} 
                onPress={() => setTermsAccepted(!termsAccepted)}
                disabled={isLoading}
              >
                <MaterialIcons 
                  name={termsAccepted ? "check-box" : "check-box-outline-blank"} 
                  size={24} 
                  color={termsAccepted ? THEME_COLOR : "#9CA3AF"} 
                />
                <Text style={styles.checkboxText}>
                  I agree to the <Text style={styles.termsLink} onPress={() => router.push("/(legal)/terms")}>Terms of Service</Text> and <Text style={styles.termsLink} onPress={() => router.push("/(legal)/privacy")}>Privacy Policy</Text>
                </Text>
              </Pressable>
              
              <Pressable
                style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
                onPress={doSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create account</Text>
                )}
              </Pressable>
              
            </View>
          </View>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
    alignSelf: "flex-start",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 24,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
  },
  inputWrapFocused: {
    borderColor: THEME_COLOR,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    height: "100%",
  },
  eyeBtn: {
    padding: 4,
  },
  errorText: {
    color: "#C13515",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 14,
  },
  passwordRulesContainer: {
      marginTop: 8,
      marginBottom: 24,
  },
  passwordRulesTitle: {
      fontSize: 12,
      color: "#6B7280",
      marginBottom: 8,
  },
  passwordRuleText: {
      fontSize: 12,
      color: "#9CA3AF",
      marginBottom: 4,
      paddingLeft: 4,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  checkboxContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
  },
  checkboxText: {
      fontSize: 14,
      color: "#000",
      marginLeft: 8,
      fontWeight: "500",
  },
  primaryBtn: {
    height: 52,
    backgroundColor: THEME_COLOR,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  termsText: {
      fontSize: 12,
      color: "#6B7280",
      textAlign: "center",
      lineHeight: 18,
  },
  termsLink: {
      color: "#000",
      fontWeight: "600",
      textDecorationLine: "underline",
  }
});
