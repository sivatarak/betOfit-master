// app/(auth)/google-signin.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/themecontext';
import { signInWithGoogle } from '../../config/firebase';

export default function GoogleSignInScreen() {
  const { colors, theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      console.log('✅ User signed in:', user.user.email);
      console.log('🆔 User UID:', user.user.uid); // ← This is your database key!
      
      // Navigate to home screen on success
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('❌ Sign-in error:', error);
      Alert.alert(
        'Sign-In Failed',
        error.message || 'Could not sign in with Google. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Gradient Background */}
      <LinearGradient
        colors={[colors.secondary, colors.primary]}
        style={StyleSheet.absoluteFill}
        opacity={0.1}
      />

      {/* Logo and Title */}
      <View style={styles.content}>
        <View style={[styles.logoContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="barbell" size={60} color={colors.primary} />
        </View>
        
        <Text style={[styles.title, { color: colors.text }]}>Welcome to BetOFit</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your fitness journey starts here
        </Text>

        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: colors.card }]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color={colors.primary} />
              <Text style={[styles.buttonText, { color: colors.text }]}>
                Sign in with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.terms, { color: colors.textMuted }]}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 50,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  terms: {
    fontSize: 12,
    marginTop: 40,
    textAlign: 'center',
  },
});