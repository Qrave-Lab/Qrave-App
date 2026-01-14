// app/reset-password.js
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { resetPasswordWithOtp } from "../lib/apiClient";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email, otp } = useLocalSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPasswordWithOtp(email, otp, password);
      Alert.alert("Success", "Password updated! Please sign in.", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* gradients, card, etc. */}
      <View style={styles.card}>
        <Text style={styles.welcomeText}>Set New Password</Text>
        <Text style={styles.subtitle}>Choose a strong password</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TextInput
          placeholder="New Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          editable={!loading}
        />

        <TextInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={[styles.input, { marginTop: 16 }]}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#94a3b8", marginTop: 24, textAlign: "center" }}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}