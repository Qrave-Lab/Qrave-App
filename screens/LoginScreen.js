import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const doLogin = async () => {
    if (!email || !password) return Alert.alert("Enter email and password");
    const mockUser = { name: "Hotel Admin", email };
    try {
      await AsyncStorage.setItem("user", JSON.stringify(mockUser));
    } catch (e) {
      console.warn("Failed to save user", e);
    }
    navigation.replace("Dashboard", { user: mockUser });
  };

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

      <TouchableOpacity style={styles.button} onPress={doLogin}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      <Text style={styles.note}>This is a mocked login for frontend demo.</Text>
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
});
