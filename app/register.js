// app/register.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // Step 1: Basic Info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Restaurant Info
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantType, setRestaurantType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Step 3: Business Details
  const [numberOfTables, setNumberOfTables] = useState("");
  const [averageOrderValue, setAverageOrderValue] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [cuisineTypes, setCuisineTypes] = useState("");

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [step]);

  const validateStep1 = () => {
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in all fields");
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!restaurantName || !restaurantType || !address || !city) {
      Alert.alert("Missing Fields", "Please fill in all restaurant details");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!numberOfTables || !averageOrderValue || !operatingHours) {
      Alert.alert("Missing Fields", "Please fill in all business details");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      fadeAnim.setValue(0);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
      fadeAnim.setValue(0);
    } else if (step === 3 && validateStep3()) {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      fadeAnim.setValue(0);
    }
  };

  const handleRegister = async () => {
    setLoading(true);

    const userData = {
      fullName,
      email,
      phone,
      restaurantName,
      restaurantType,
      address,
      city,
      postalCode,
      numberOfTables,
      averageOrderValue,
      operatingHours,
      cuisineTypes,
      registeredAt: new Date().toISOString(),
    };

    // Simulate API call
    setTimeout(async () => {
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      Alert.alert(
        "Success!",
        "Your account has been created successfully",
        [
          {
            text: "OK",
            onPress: () => router.replace("/dashboard"),
          },
        ]
      );
      setLoading(false);
    }, 1500);
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]}>
        <Text style={styles.progressText}>1</Text>
      </View>
      <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
      <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]}>
        <Text style={styles.progressText}>2</Text>
      </View>
      <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
      <View style={[styles.progressDot, step >= 3 && styles.progressDotActive]}>
        <Text style={styles.progressText}>3</Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepSubtitle}>Let's start with your details</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          placeholder="John Doe"
          placeholderTextColor="#64748b"
          value={fullName}
          onChangeText={setFullName}
          onFocus={() => setFocusedInput("fullName")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "fullName" && styles.inputFocused,
          ]}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          placeholder="admin@restaurant.com"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocusedInput("email")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "email" && styles.inputFocused,
          ]}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Phone Number</Text>
        <TextInput
          placeholder="+1 (555) 123-4567"
          placeholderTextColor="#64748b"
          value={phone}
          onChangeText={setPhone}
          onFocus={() => setFocusedInput("phone")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "phone" && styles.inputFocused,
          ]}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          placeholder="Minimum 6 characters"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocusedInput("password")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "password" && styles.inputFocused,
          ]}
          secureTextEntry
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <TextInput
          placeholder="Re-enter your password"
          placeholderTextColor="#64748b"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onFocus={() => setFocusedInput("confirmPassword")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "confirmPassword" && styles.inputFocused,
          ]}
          secureTextEntry
        />
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <Text style={styles.stepTitle}>Restaurant Details</Text>
      <Text style={styles.stepSubtitle}>Tell us about your restaurant</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Restaurant Name</Text>
        <TextInput
          placeholder="The Golden Fork"
          placeholderTextColor="#64748b"
          value={restaurantName}
          onChangeText={setRestaurantName}
          onFocus={() => setFocusedInput("restaurantName")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "restaurantName" && styles.inputFocused,
          ]}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Restaurant Type</Text>
        <TextInput
          placeholder="Fine Dining, Cafe, Fast Food, etc."
          placeholderTextColor="#64748b"
          value={restaurantType}
          onChangeText={setRestaurantType}
          onFocus={() => setFocusedInput("restaurantType")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "restaurantType" && styles.inputFocused,
          ]}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Street Address</Text>
        <TextInput
          placeholder="123 Main Street"
          placeholderTextColor="#64748b"
          value={address}
          onChangeText={setAddress}
          onFocus={() => setFocusedInput("address")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "address" && styles.inputFocused,
          ]}
        />
      </View>

      <View style={styles.rowInputs}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            placeholder="New York"
            placeholderTextColor="#64748b"
            value={city}
            onChangeText={setCity}
            onFocus={() => setFocusedInput("city")}
            onBlur={() => setFocusedInput(null)}
            style={[
              styles.input,
              focusedInput === "city" && styles.inputFocused,
            ]}
          />
        </View>

        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>Postal Code</Text>
          <TextInput
            placeholder="10001"
            placeholderTextColor="#64748b"
            value={postalCode}
            onChangeText={setPostalCode}
            onFocus={() => setFocusedInput("postalCode")}
            onBlur={() => setFocusedInput(null)}
            style={[
              styles.input,
              focusedInput === "postalCode" && styles.inputFocused,
            ]}
            keyboardType="numeric"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <Text style={styles.stepTitle}>Business Information</Text>
      <Text style={styles.stepSubtitle}>Help us understand your operations</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Number of Tables</Text>
        <TextInput
          placeholder="e.g., 20"
          placeholderTextColor="#64748b"
          value={numberOfTables}
          onChangeText={setNumberOfTables}
          onFocus={() => setFocusedInput("numberOfTables")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "numberOfTables" && styles.inputFocused,
          ]}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Average Order Value</Text>
        <TextInput
          placeholder="e.g., $25"
          placeholderTextColor="#64748b"
          value={averageOrderValue}
          onChangeText={setAverageOrderValue}
          onFocus={() => setFocusedInput("averageOrderValue")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "averageOrderValue" && styles.inputFocused,
          ]}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Operating Hours</Text>
        <TextInput
          placeholder="e.g., 9 AM - 11 PM"
          placeholderTextColor="#64748b"
          value={operatingHours}
          onChangeText={setOperatingHours}
          onFocus={() => setFocusedInput("operatingHours")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "operatingHours" && styles.inputFocused,
          ]}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Cuisine Types (Optional)</Text>
        <TextInput
          placeholder="e.g., Italian, Mediterranean"
          placeholderTextColor="#64748b"
          value={cuisineTypes}
          onChangeText={setCuisineTypes}
          onFocus={() => setFocusedInput("cuisineTypes")}
          onBlur={() => setFocusedInput(null)}
          style={[
            styles.input,
            focusedInput === "cuisineTypes" && styles.inputFocused,
          ]}
        />
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>Q</Text>
          </View>
          <Text style={styles.appName}>Join Qrave</Text>
          <Text style={styles.tagline}>Start Your Digital Menu Journey</Text>
        </View>

        {renderProgressBar()}

        <View style={styles.card}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <View style={styles.buttonContainer}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                loading && styles.buttonDisabled,
                step === 1 && { flex: 1 },
              ]}
              onPress={handleNext}
              disabled={loading}
            >
              <Text style={styles.nextButtonText}>
                {loading
                  ? "Creating Account..."
                  : step === 3
                  ? "Complete Registration"
                  : "Next →"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.back()}
        >
          <Text style={styles.loginLinkText}>
            Already have an account?{" "}
            <Text style={styles.loginLinkBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
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

  scrollContainer: {
    padding: 20,
    paddingTop: 60,
  },

  header: {
    alignItems: "center",
    marginBottom: 32,
  },

  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },

  logoText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
  },

  appName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 4,
  },

  tagline: {
    fontSize: 13,
    color: "#94a3b8",
    letterSpacing: 1,
  },

  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  progressDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#334155",
  },

  progressDotActive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },

  progressText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: "#334155",
    marginHorizontal: 4,
  },

  progressLineActive: {
    backgroundColor: "#ef4444",
  },

  card: {
    backgroundColor: "#1e293b",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },

  stepContainer: {
    marginBottom: 8,
  },

  stepTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },

  stepSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 24,
  },

  inputContainer: {
    marginBottom: 16,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  input: {
    backgroundColor: "#0f172a",
    borderWidth: 2,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#ffffff",
  },

  inputFocused: {
    borderColor: "#ef4444",
    backgroundColor: "#1a1f2e",
  },

  rowInputs: {
    flexDirection: "row",
  },

  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },

  backButton: {
    flex: 1,
    backgroundColor: "#334155",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  backButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  nextButton: {
    flex: 2,
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  nextButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  buttonDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
  },

  loginLink: {
    marginTop: 24,
    alignItems: "center",
  },

  loginLinkText: {
    color: "#94a3b8",
    fontSize: 14,
  },

  loginLinkBold: {
    color: "#ef4444",
    fontWeight: "700",
  },
});