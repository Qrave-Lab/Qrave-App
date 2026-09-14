import { Stack } from 'expo-router';

export default function LegalLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="terms" 
        options={{ 
          title: 'Terms of Service',
          headerTitleAlign: 'center',
          headerBackTitle: 'Back',
          headerBackVisible: true
        }} 
      />
      <Stack.Screen 
        name="privacy" 
        options={{ 
          title: 'Privacy Policy',
          headerTitleAlign: 'center',
          headerBackTitle: 'Back',
          headerBackVisible: true
        }} 
      />
      <Stack.Screen 
        name="cookies" 
        options={{ 
          title: 'Cookie Policy',
          headerTitleAlign: 'center',
          headerBackTitle: 'Back',
          headerBackVisible: true
        }} 
      />
      <Stack.Screen 
        name="refunds" 
        options={{ 
          title: 'Refund Policy',
          headerTitleAlign: 'center',
          headerBackTitle: 'Back',
          headerBackVisible: true
        }} 
      />
    </Stack>
  );
}
