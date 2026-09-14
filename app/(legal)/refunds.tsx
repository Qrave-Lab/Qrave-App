import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RefundPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Refund Policy', headerTitleAlign: 'center' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Refund Policy</Text>
          <Text 
            style={styles.backButtonText} 
            onPress={() => router.back()}
          >
            Go Back
          </Text>
        </View>
        <Text style={styles.date}>Last Updated: September 13, 2026</Text>
        
        <Text style={styles.sectionTitle}>1. General Conditions</Text>
        <Text style={styles.text}>
          Because our app facilitates the ordering of fresh food and perishable items, all sales are generally considered final. However, we strive for 100% customer satisfaction. If you are unsatisfied with your order, please review the conditions below.
        </Text>

        <Text style={styles.sectionTitle}>2. Cancellation of Orders</Text>
        <Text style={styles.text}>
          You may cancel your order without charge at any time before the kitchen has started preparing your food. Once preparation has begun, the order cannot be canceled or refunded through the app. Please contact the restaurant staff directly for special circumstances.
        </Text>

        <Text style={styles.sectionTitle}>3. Incorrect or Missing Items</Text>
        <Text style={styles.text}>
          If you receive an incorrect item or if an item is missing from your order, please notify the staff immediately or contact us via the app within 24 hours. We will issue a refund or provide a replacement for the affected items.
        </Text>

        <Text style={styles.sectionTitle}>4. Quality Issues</Text>
        <Text style={styles.text}>
          If the food provided does not meet reasonable quality standards (e.g., undercooked, spoiled), please return the item to the staff immediately. Upon verification, we will issue a full or partial refund to your original payment method.
        </Text>

        <Text style={styles.sectionTitle}>5. Processing Refunds</Text>
        <Text style={styles.text}>
          Approved refunds will be processed within 5-7 business days, depending on your bank or payment provider. Refunds will only be issued to the original payment method used for the purchase.
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
