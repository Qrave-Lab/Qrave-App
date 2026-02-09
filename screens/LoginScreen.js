import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login as apiLogin, getDebug } from "../lib/apiClient";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const doLogin = async () => {
    if (!email || !password) return Alert.alert("Enter email and password");
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      const user = data.user || data;
      if (!user) {
        throw new Error('Invalid credentials');
      }
      try {
        await AsyncStorage.setItem("user", JSON.stringify(user));
      } catch (e) {
        console.warn("Failed to save user", e);
      }

      const role = user?.role;
      const isAdmin = role === "owner" || role === "manager";
      const isWaiter = role === "waiter";
      navigation.replace(isAdmin ? "Admin" : isWaiter ? "Waiter" : "Dashboard", { user });
    } catch (err) {
      const msg = err?.body?.message || err.message || 'Login failed';
      Alert.alert('Login failed', String(msg));
    } finally {
      setLoading(false);
    }
  };

  const [loading, setLoading] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Login</Text>

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

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={doLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>

      <Text style={styles.note}>Sign in with your registered admin credentials.</Text>
      <TouchableOpacity style={[styles.debugButton]} onPress={async () => {
        try {
          const loginError = await getDebug('login_error');
          const loginSuccess = await getDebug('login_success');
          const profile = await getDebug('profile');
          console.log('debug_login_error', loginError);
          console.log('debug_login_success', loginSuccess);
          console.log('debug_profile', profile);
          Alert.alert('Debug dumped to console');
        } catch (e) {
          console.warn('Failed to read debug', e);
          Alert.alert('Failed to read debug');
        }
      }}>
        <Text style={styles.debugText}>Show Debug</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#f6f8fa" },
  title: { fontSize: 24, marginBottom: 20, fontWeight: "700" },
  input: { width: "100%", padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 12, backgroundColor: "#fff" },
  button: { backgroundColor: "#0a84ff", padding: 12, borderRadius: 8, width: "100%", alignItems: "center" },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "600" },
  note: { marginTop: 12, color: "#666" },
  debugButton: { marginTop: 12, padding: 8 },
  debugText: { color: '#666' },
});
