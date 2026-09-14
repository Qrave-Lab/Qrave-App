import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Privacy Policy', headerTitleAlign: 'center' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Privacy Policy</Text>
        </View>
        <Text style={styles.date}>Last Updated: September 13, 2026</Text>
        
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.text}>
          Welcome to QRAVE. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice or our practices with regard to your personal information, please contact us at support@qrave.app.
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.text}>
          We only collect information that is necessary for the provision of our services. This includes personal information you voluntarily provide to us when you register on the App, such as name, email address, and order history. 
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.text}>
          We process your information for purposes based on legitimate business interests, the fulfillment of our contract with you, compliance with our legal obligations, and/or your consent. This includes processing payments, managing your account, and facilitating food orders.
        </Text>

        <Text style={styles.sectionTitle}>4. Data Sharing and Disclosure</Text>
        <Text style={styles.text}>
          We only share information with your consent, to comply with laws, to provide you with services (e.g., third-party payment processors), to protect your rights, or to fulfill business obligations. We do not sell your personal data.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Retention</Text>
        <Text style={styles.text}>
          We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements).
        </Text>

        <Text style={styles.sectionTitle}>6. Your Privacy Rights (GDPR & CCPA)</Text>
        <Text style={styles.text}>
          Depending on your location, you may have rights under applicable data protection laws (such as GDPR or CCPA). These may include the right to request access to and obtain a copy of your personal information, to request rectification or erasure, and to restrict the processing of your personal information.
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
