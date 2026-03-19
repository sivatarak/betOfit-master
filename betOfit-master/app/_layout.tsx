// app/_layout.tsx
import { Slot, useRouter, useSegments } from "expo-router";
import { useState, useEffect } from "react";
import { ThemeProvider } from '../context/themecontext';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import SplashScreen from "./(auth)/splash";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to auth if not logged in
      router.replace('/(auth)/google-signin');
    } else if (user && inAuthGroup) {
      // Redirect to home if already logged in
      router.replace('/tabs/home');
    }
  }, [user, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        {showSplash ? <SplashScreen /> : <RootLayoutNav />}
      </AuthProvider>
    </ThemeProvider>
  );
}