import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to login or your main screen
  console.log("Redirecting to login...");
  return <Redirect href="/(auth)/login" />;
}