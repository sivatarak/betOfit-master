// app/(auth)/google-signin.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/themecontext';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle } from '../../config/firebase';

export default function GoogleSignInScreen() {
  const { colors, theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      console.log('✅ User signed in:', user.email);
      console.log('🆔 User UID:', user.uid);
      
      // Navigate to profile setup screen
      router.replace('/(auth)/profile-setup?mode=basic');
    } catch (error: any) {
      console.error('❌ Sign-in error:', error);
      Alert.alert('Sign-In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.logoContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="barbell" size={60} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Welcome to BetOFit</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your fitness journey starts here</Text>

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
              <Text style={[styles.buttonText, { color: colors.text }]}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  logoContainer: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 50, textAlign: 'center' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 30, width: '100%', gap: 12 },
  buttonText: { fontSize: 18, fontWeight: '600' },
});