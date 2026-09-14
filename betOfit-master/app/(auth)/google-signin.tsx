// app/(auth)/google-signin.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  InteractionManager,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/themecontext';
import { signInWithGoogle } from '../../config/firebase';

// Adds an alpha channel to a hex color, e.g. hexToRgba('#fd7505', 0.15)
function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function LoadingRing({ size = 20, color }: { size?: number; color: string }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: hexToRgba(color, 0.22),
        borderTopColor: color,
        transform: [{ rotate }],
      }}
    />
  );
}

// Small pulsing/blinking dot — used for the brand dot, member badge dot, synced dot
function PulseDot({ size, color }: { size: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

export default function GoogleSignInScreen() {
  const { colors, theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const styles = useMemo(() => makeStyles(colors, theme), [colors, theme]);
  const [termsPressed, setTermsPressed] = useState<'terms' | 'privacy' | null>(null);
  // Dumbbell tilt: rests at -20deg, straightens to 0deg on press/hover
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const rotate = tiltAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-20deg', '0deg'],
  });

  const straightenIcon = () => {
    Animated.timing(tiltAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const tiltIconBack = () => {
    Animated.timing(tiltAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Continuous rotation for the moving stripe around the Google button
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      console.log('✅ User signed in:', user.email);
      console.log('🆔 User UID:', user.uid);

      InteractionManager.runAfterInteractions(() => {
        router.replace('/(tabs)/profile-setup?mode=basic');
      });
    } catch (error: any) {
      console.error('❌ Sign-in error:', error);
      Alert.alert('Sign-In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  function GoogleGIcon({ size = 20 }: { size?: number }) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          fill="#4285F4"
        />
        <Path
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          fill="#34A853"
        />
        <Path
          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          fill="#FBBC05"
        />
        <Path
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          fill="#EA4335"
        />
      </Svg>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient glow — true radial gradient, no hard edge */}
      <View pointerEvents="none" style={styles.ambientGlowWrap}>
        <Svg width={360} height={360}>
          <Defs>
            <SvgRadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={theme === 'dark' ? 0.32 : 0.2} />
              <Stop offset="55%" stopColor={colors.primary} stopOpacity={theme === 'dark' ? 0.14 : 0.09} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </SvgRadialGradient>
          </Defs>
          <Circle cx={180} cy={180} r={180} fill="url(#glow)" />
        </Svg>
      </View>

      {/* Brand header */}
      <View style={styles.brandHeader}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>BetOFit</Text>
          <View style={styles.brandDotWrap}>
            <PulseDot size={8} color={colors.primary} />
          </View>
        </View>
        <View style={styles.memberBadge}>
          <PulseDot size={6} color={colors.primary} />
          <Text style={styles.memberBadgeText}>MEMBER ACCESS</Text>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Pressable
          onPressIn={straightenIcon}
          onPressOut={tiltIconBack}
          onHoverIn={straightenIcon}
          onHoverOut={tiltIconBack}
          style={styles.logoBadgeOuter}
        >
          <View style={styles.logoBadgeInner}>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name="barbell" size={34} color={colors.primary} />
            </Animated.View>
          </View>
        </Pressable>

        <Text style={styles.title}>
          Level Up with <Text style={{ color: colors.primary }}>BetOFit</Text>
        </Text>
        <Text style={styles.subtitle}>Commit. Track. Dominate your athletic goals.</Text>

        {/* Bento grid */}
        <View style={styles.bentoGrid}>
          <View style={styles.bentoRow}>
            {/* Card 1 */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoCardTopRow}>
                <View style={styles.iconChip}>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                </View>
                <View style={styles.statBadgeSuccess}>
                  <Text style={styles.statBadgeSuccessText}>+24% stamina</Text>
                </View>
              </View>
              <Text style={styles.bentoBigNumber}>500+</Text>
              <Text style={styles.bentoLabel}>Curated Workouts</Text>
              <Text style={styles.bentoSubLabel}>HIIT, strength & mobility</Text>
            </View>

            {/* Card 2 */}
            <View style={styles.bentoCard}>
              <View style={styles.bentoCardTopRow}>
                <View style={styles.iconChip}>
                  <Text style={{ fontSize: 14 }}>⚡</Text>
                </View>
                <View style={styles.statBadgeNeutral}>
                  <Text style={styles.statBadgeNeutralText}>24/7 Live</Text>
                </View>
              </View>
              <Text style={styles.bentoBigNumber} numberOfLines={1}>
                Smart AI Coach
              </Text>
              <Text style={styles.bentoLabel}>Adaptive Insights</Text>
              <Text style={styles.bentoSubLabel}>Real-time rep & set tweaks</Text>
            </View>
          </View>

          {/* Full-width banner */}
          <View style={styles.bannerCard}>
            <View style={styles.bannerTopRow}>
              <View style={styles.bannerIconChip}>
                <Ionicons name="flash" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.bannerHeaderRow}>
                  <Text style={styles.bannerTitle}>Performance Tracking</Text>
                  <View style={styles.syncedRow}>
                    <PulseDot size={5} color={colors.primary} />
                    <Text style={styles.syncedText}>SYNCED</Text>
                  </View>
                </View>
                <Text style={styles.bannerDesc} numberOfLines={1}>
                  Track calories, heart rate & personal records seamlessly
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>CALORIE BURN</Text>
                <Text style={styles.metricValue}>Real-time</Text>
              </View>
              <View style={[styles.metricCell, styles.metricCellBordered]}>
                <Text style={styles.metricLabel}>HEART ZONES</Text>
                <Text style={[styles.metricValue, { color: colors.primary }]}>Optimized</Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>MILESTONES</Text>
                <Text style={styles.metricValue}>Streak Auto</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Footer / auth actions */}
      <View style={styles.footer}>
        {/* Google button with rotating stripe border */}
        <View style={styles.googleButtonWrap}>
          <Animated.View style={[styles.rotatingBorderLayer, { transform: [{ rotate: spin }] }]}>
            <LinearGradient
              colors={['transparent', 'transparent', colors.primary, 'transparent', 'transparent']}
              locations={[0, 0.42, 0.5, 0.58, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientSquare}
            />
          </Animated.View>

          <Pressable
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {({ pressed, hovered }) => {
              const active = pressed || hovered;
              return loading ? (
                <>
                  <LoadingRing size={18} color={colors.primary} />
                  <Text style={styles.googleButtonText}>Signing in…</Text>
                </>
              ) : (
                <>
                  <GoogleGIcon size={20} />
                  <Text style={[styles.googleButtonText, active && { color: colors.primary }]}>
                    Continue with Google
                  </Text>
                </>
              );
            }}
          </Pressable>
        </View>

        <View style={styles.altSignInRow}>
          <PulseDot size={6} color={colors.success} />
          <Text style={styles.altSignInText}>1-Tap Fast Sign-in</Text>
          <Text style={styles.dotSeparator}>•</Text>
          <Pressable onPress={() => { }}>
            {({ pressed, hovered }) => (
              <Text style={[styles.appleLink, (pressed || hovered) && { color: colors.primary }]}>
                Or sign in with Apple
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.securityRow}>
          <Ionicons name="lock-closed" size={13} color={colors.primary} />
          <Text style={styles.securityText}>Your health & fitness data stays strictly private</Text>
        </View>

        <Text style={styles.termsText}>
          By continuing, you agree to BetOFit's{' '}
          <Text
            style={[
              styles.termsLink,
              termsPressed === 'terms' && { color: colors.primary },
            ]}
            onPress={() => { }}
            onPressIn={() => setTermsPressed('terms')}
            onPressOut={() => setTermsPressed(null)}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            style={[
              styles.termsLink,
              termsPressed === 'privacy' && { color: colors.primary },
            ]}
            onPress={() => { }}
            onPressIn={() => setTermsPressed('privacy')}
            onPressOut={() => setTermsPressed(null)}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, theme: 'light' | 'dark') =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between' },
    ambientGlowWrap: {
      position: 'absolute',
      top: -58,
      left: '50%',
      marginLeft: -180,
    },

    brandHeader: {
      paddingHorizontal: 20,
      paddingTop: 50,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    brandText: { fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    brandDotWrap: { marginLeft: 4 },
    memberBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: hexToRgba(colors.primary, 0.1),
      borderWidth: 1,
      borderColor: hexToRgba(colors.primary, 0.25),
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      gap: 6,
    },
    memberBadgeText: { fontSize: 9, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },

    hero: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, marginTop: -15 },
    logoBadgeOuter: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: hexToRgba(colors.primary, 0.4),
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    logoBadgeInner: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: hexToRgba(colors.card, 0.8),
      borderWidth: 1,
      borderColor: hexToRgba(colors.primary, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginTop: 14,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 20,
      fontWeight: '500',
    },

    bentoGrid: { gap: 10 },
    bentoRow: { flexDirection: 'row', gap: 10 },
    bentoCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
    },
    bentoCardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    iconChip: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: hexToRgba(colors.primary, 0.15),
      borderWidth: 1,
      borderColor: hexToRgba(colors.primary, 0.3),
      alignItems: 'center',
      justifyContent: 'center',
    },
    statBadgeSuccess: {
      backgroundColor: hexToRgba(colors.success, 0.15),
      borderWidth: 1,
      borderColor: hexToRgba(colors.success, 0.3),
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    statBadgeSuccessText: { fontSize: 9, fontWeight: '700', color: colors.success },
    statBadgeNeutral: {
      backgroundColor: hexToRgba(colors.text, 0.05),
      borderWidth: 1,
      borderColor: hexToRgba(colors.text, 0.1),
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    statBadgeNeutralText: { fontSize: 9, fontWeight: '600', color: colors.primary },
    bentoBigNumber: { fontSize: 17, fontWeight: '900', color: colors.text },
    bentoLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
    bentoSubLabel: { fontSize: 10, color: colors.textMuted, marginTop: 1 },

    bannerCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
    },
    bannerTopRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    bannerIconChip: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: hexToRgba(colors.primary, 0.15),
      borderWidth: 1,
      borderColor: hexToRgba(colors.primary, 0.3),
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bannerTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
    syncedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    syncedText: { fontSize: 9, fontWeight: '600', color: colors.primary },
    bannerDesc: { fontSize: 10.5, color: colors.textSecondary, marginTop: 2 },

    metricsRow: {
      flexDirection: 'row',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metricCell: { flex: 1, alignItems: 'center' },
    metricCellBordered: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    metricLabel: { fontSize: 8, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.4 },
    metricValue: { fontSize: 10.5, fontWeight: '700', color: colors.text, marginTop: 2 },

    footer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8, alignItems: 'center', marginTop: -15 },

    googleButtonWrap: {
      width: '100%',
      height: 54,
      borderRadius: 27,
      padding: 1.5,
      overflow: 'hidden',
    },
    rotatingBorderLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gradientSquare: {
      width: 600,
      height: 600,
    },
    googleButton: {
      flex: 1,
      borderRadius: 25.5,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    googleButtonText: { fontSize: 15, fontWeight: '700', color: colors.text },

    altSignInRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    altSignInText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
    dotSeparator: { fontSize: 11, color: colors.textMuted },
    appleLink: { fontSize: 11, color: colors.textMuted, textDecorationLine: 'underline' },

    securityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    securityText: { fontSize: 11, color: colors.textMuted },

    termsText: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 300,
      lineHeight: 14,
    },
    termsLink: { textDecorationLine: 'underline', color: colors.textMuted },
  });