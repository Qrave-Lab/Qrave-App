// app/verify-otp.js
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { verifyResetOtp, sendResetOtp } from "../lib/apiClient";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams(); // passed from previous screen

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60); // seconds
  const [canResend, setCanResend] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    startResendTimer();
    return () => clearInterval(timerRef.current);
  }, []);

  const startResendTimer = () => {
    setResendTimer(60);
    setCanResend(false);

    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Please enter 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await verifyResetOtp(email, otp);
      // Success → go to reset password screen
      router.push({ pathname: "/reset-password", params: { email, otp } });
    } catch (err) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setLoading(true);
    try {
      await sendResetOtp(email);
      Alert.alert("Success", "New OTP sent!");
      startResendTimer();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* gradients, logo, card – reuse from forgot-password */}
      <View style={styles.card}>
        <Text style={styles.welcomeText}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to {email}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Simple OTP input – you can style better or use library */}
        <TextInput
          style={{
            ...styles.input,
            textAlign: "center",
            fontSize: 24,
            letterSpacing: 12,
            marginVertical: 24,
          }}
          value={otp}
          onChangeText={(text) => {
            const numeric = text.replace(/[^0-9]/g, "");
            setOtp(numeric.slice(0, 6));
            setError("");
          }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="------"
          placeholderTextColor="#94a3b8"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || otp.length !== 6}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
        </TouchableOpacity>

        <View style={{ marginTop: 24, alignItems: "center" }}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={{ color: "#ef4444", fontWeight: "600" }}>Resend OTP</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: "#94a3b8" }}>
              Resend OTP in {resendTimer < 10 ? `0${resendTimer}` : resendTimer}s
            </Text>
          )}
        </View>

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 32 }}>
          <Text style={{ color: "#94a3b8", textAlign: "center" }}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}