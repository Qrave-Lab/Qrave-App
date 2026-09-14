import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as WebBrowser from "expo-web-browser";
import { useRouter } from 'expo-router';

export default function TermsOfService() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Terms of Service', headerTitleAlign: 'center' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Terms of Service</Text>
        </View>
        <Text style={styles.date}>Last Updated: September 13, 2026</Text>
        
        <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
        <Text style={styles.text}>
          These Terms of Service constitute a legally binding agreement made between you and QRAVE, concerning your access to and use of our application and services. By accessing the app, you agree that you have read, understood, and agree to be bound by all of these Terms.
        </Text>

        <Text style={styles.sectionTitle}>2. User Accounts</Text>
        <Text style={styles.text}>
          To access certain features of the app, you may be required to register for an account. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine that such username is inappropriate.
        </Text>

        <Text style={styles.sectionTitle}>3. Prohibited Activities</Text>
        <Text style={styles.text}>
          You may not access or use the app for any purpose other than that for which we make the app available. Prohibited activities include attempting to bypass any measures of the app designed to prevent or restrict access, deciphering or reverse engineering the software, and using the app to violate any local or international laws.
        </Text>

        <Text style={styles.sectionTitle}>4. Purchases and Payment</Text>
        <Text style={styles.text}>
          We accept various forms of payment for food orders and services. You agree to provide current, complete, and accurate purchase and account information for all purchases made via the app. Prices for all products are subject to change.
        </Text>

        <Text style={styles.sectionTitle}>5. Disclaimer of Warranties</Text>
        <Text style={styles.text}>
          The app is provided on an as-is and as-available basis. You agree that your use of the app and our services will be at your sole risk. To the fullest extent permitted by law, we disclaim all warranties, express or implied, in connection with the app and your use thereof.
        </Text>

        <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
        <Text style={styles.text}>
          In no event will we or our directors, employees, or agents be liable to you or any third party for any direct, indirect, consequential, exemplary, incidental, special, or punitive damages, including lost profit, lost revenue, loss of data, or other damages arising from your use of the app.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
    padding: 8,
  },
  date: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 20,
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
});
