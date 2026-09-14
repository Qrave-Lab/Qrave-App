import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CookiePolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Cookie Policy', headerTitleAlign: 'center' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Cookie Policy</Text>
          <Text 
            style={styles.backButtonText} 
            onPress={() => router.back()}
          >
            Go Back
          </Text>
        </View>
        <Text style={styles.date}>Last Updated: September 13, 2026</Text>
        
        <Text style={styles.sectionTitle}>1. What Are Cookies</Text>
        <Text style={styles.text}>
          Cookies are small data files stored on your device that help websites and apps remember information about you. In the context of our mobile application, we use similar tracking technologies like device identifiers, local storage, and caching to improve your experience.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Cookies</Text>
        <Text style={styles.text}>
          We use strictly necessary cookies to keep you logged in and ensure the app functions properly. We may also use functional cookies to remember your preferences (such as your chosen location or theme) and analytical cookies to understand how users interact with our app.
        </Text>

        <Text style={styles.sectionTitle}>3. Managing Cookies</Text>
        <Text style={styles.text}>
          Most mobile operating systems allow you to control cookies or device identifiers through your device settings. You can reset your device identifiers or opt out of personalized tracking. However, disabling certain tracking features may affect the functionality of our application.
        </Text>

        <Text style={styles.sectionTitle}>4. Web Application</Text>
        <Text style={styles.text}>
          If you access our services via a web browser, we may use standard browser cookies. Upon your first visit to our web platform, you will be presented with a cookie consent banner where you can customize your cookie preferences in compliance with GDPR and CCPA.
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
