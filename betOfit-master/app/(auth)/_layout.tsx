// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="google-signin" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="splash" />
      <Stack.Screen name="index" />
    </Stack>
  );
}