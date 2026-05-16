import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import apiClient from "../../lib/apiClient";

const asMessage = (err: any, fallback: string) => {
  if (typeof err?.body === "string" && err.body.trim()) return err.body.trim();
  if (typeof err?.body?.message === "string") return err.body.message;
  if (typeof err?.message === "string") return err.message;
  return fallback;
};

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    (async () => {
      try {
        const me: any = await apiClient.get("/api/admin/me");
        setRole(String(me?.role || "").toLowerCase());
        setEmail(String(me?.email || ""));
      } catch (err: any) {
        setMessageType("error");
        setMessage(asMessage(err, "Failed to load account."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestOtp = async () => {
    if (cooldown > 0) return;
    setRequestingOtp(true);
    setMessage("");
    try {
      await apiClient.post("/api/admin/account/delete/request-otp", {});
      setCooldown(60);
      setMessageType("success");
      setMessage("OTP sent to your email.");
    } catch (err: any) {
      setMessageType("error");
      setMessage(asMessage(err, "Failed to send OTP."));
    } finally {
      setRequestingOtp(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setMessageType("error");
      setMessage('Type "DELETE" to confirm.');
      return;
    }
    if (otp.trim().length < 4) {
      setMessageType("error");
      setMessage("Enter a valid OTP.");
      return;
    }

    setDeleting(true);
    setMessage("");
    try {
      await apiClient.post("/api/admin/account/delete", {
        otp: otp.trim(),
        confirm_text: confirmText.trim(),
      });
      await AsyncStorage.multiRemove([
        "user",
        "token",
        "qrave_jwt",
        "qrave_refresh",
        "qrave_csrf",
      ]);
      router.replace("/");
    } catch (err: any) {
      setMessageType("error");
      setMessage(asMessage(err, "Failed to delete account."));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#DC2626" />
          <Text style={styles.helperText}>Loading account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (role !== "owner") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace("/admin/profile")}
          >
            <MaterialIcons name="arrow-back" size={18} color="#374151" />
            <Text style={styles.backText}>Back to Settings</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
        </View>
        <View style={styles.centerCard}>
          <Text style={styles.blockTitle}>Access Restricted</Text>
          <Text style={styles.blockText}>
            Only owner can delete this account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/admin/profile")}
        >
          <MaterialIcons name="arrow-back" size={18} color="#374151" />
          <Text style={styles.backText}>Back to Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Permanent Action</Text>
          <Text style={styles.warningText}>
            This will remove restaurant, menu, tables, staff, and history.
          </Text>
          <Text style={styles.warningText}>
            OTP will be sent to {email || "your email"}.
          </Text>
        </View>

        <Text style={styles.label}>Enter OTP</Text>
        <TextInput
          style={styles.input}
          placeholder="4 digit OTP"
          placeholderTextColor="#9CA3AF"
          value={otp}
          keyboardType="number-pad"
          onChangeText={setOtp}
          maxLength={8}
        />

        <Text style={styles.label}>Type DELETE to confirm</Text>
        <TextInput
          style={styles.input}
          placeholder='Type "DELETE"'
          placeholderTextColor="#9CA3AF"
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
        />

        {message ? (
          <View
            style={[
              styles.messageBox,
              messageType === "error"
                ? styles.messageError
                : styles.messageSuccess,
            ]}
          >
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            (requestingOtp || cooldown > 0) && styles.disabledBtn,
          ]}
          onPress={requestOtp}
          disabled={requestingOtp || cooldown > 0}
        >
          {requestingOtp ? (
            <ActivityIndicator color="#4B5563" />
          ) : (
            <Text style={styles.secondaryBtnText}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Send OTP"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dangerBtn, deleting && styles.disabledBtn]}
          onPress={deleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerBtnText}>Delete Permanently</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backText: {
    color: "#374151",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  content: {
    padding: 16,
  },
  warningCard: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  warningTitle: {
    color: "#B91C1C",
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 6,
  },
  warningText: {
    color: "#7F1D1D",
    fontSize: 12,
    marginTop: 2,
  },
  label: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    color: "#111827",
    fontSize: 14,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  secondaryBtnText: {
    color: "#4B5563",
    fontWeight: "700",
    fontSize: 14,
  },
  dangerBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  dangerBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  helperText: {
    marginTop: 8,
    color: "#6B7280",
  },
  centerCard: {
    margin: 16,
    borderRadius: 16,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    backgroundColor: "#fff",
    padding: 18,
  },
  blockTitle: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 6,
  },
  blockText: {
    color: "#6B7280",
    fontSize: 13,
  },
  messageBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  messageError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  messageSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  messageText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
});
