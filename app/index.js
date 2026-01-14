// app/index.js
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { login as apiLogin } from "../lib/apiClient";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doLogin = async () => {
    if (!email || !password) {
      setError("Enter email and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiLogin(email, password);
      const user = data.user || data;
      if (!user) throw new Error('Invalid credentials');
      try {
        await AsyncStorage.setItem("user", JSON.stringify(user));
      } catch (e) {
        console.warn("Failed to save user", e);
      }
      // navigate to admin if admin, else dashboard
      const isAdmin = user && (user.role === 'owner' || user.role === 'manager');
      router.replace(isAdmin ? '/admin' : '/dashboard');
    } catch (err) {
      const msg = err?.body?.message || err.message || 'Login failed';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
     <View style={styles.container}>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={doLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.note}>Sign in with your registered admin credentials.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#f6f8fa" },
  title: { fontSize: 24, marginBottom: 20, fontWeight: "700" },
  input: { width: "100%", padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 12, backgroundColor: "#fff" },
  button: { backgroundColor: "#0a84ff", padding: 12, borderRadius: 8, width: "100%", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  note: { marginTop: 12, color: "#666" },
  error: { color: '#c00', marginTop: 10, marginBottom: 0, fontWeight: '600' },
});
