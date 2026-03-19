// app/(auth)/splash.tsx
import { View, Text, Image, StyleSheet, Animated, Dimensions } from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../context/themecontext";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const { colors, theme } = useTheme();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const lineScaleX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // All animations with useNativeDriver: true
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(lineScaleX, {
        toValue: 1,
        duration: 1200,
        delay: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background - Clean and minimal */}
      <LinearGradient
        colors={[colors.background, colors.card]}
        style={styles.background}
      />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Logo Container */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideUpAnim }
              ],
              shadowColor: colors.primary,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.secondary, colors.primary]}
            style={styles.logoGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </LinearGradient>
        </Animated.View>

        {/* App Name */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
              color: colors.text,
            },
          ]}
        >
          BetOFit
        </Animated.Text>

        {/* Decorative Line */}
        <Animated.View
          style={[
            styles.line,
            {
              opacity: fadeAnim,
              transform: [
                { scaleX: lineScaleX },
                { translateY: slideUpAnim }
              ],
              backgroundColor: colors.primary,
            },
          ]}
        />

        {/* Subtitle */}
        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
              color: colors.textSecondary,
            },
          ]}
        >
          fitness companion
        </Animated.Text>

        {/* Version */}
        <Animated.Text style={[styles.version, { opacity: fadeAnim, color: colors.textMuted }]}>
          v1.0.0
        </Animated.Text>
      </View>

      {/* Footer Note */}
      <Animated.Text style={[styles.footer, { opacity: fadeAnim, color: colors.textMuted }]}>
        © 2026 BetOFit
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 30,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  logoGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 70,
    height: 70,
    tintColor: "#FFFFFF",
  },
  title: {
    fontSize: 42,
    fontWeight: "400",
    letterSpacing: 2,
    marginBottom: 16,
  },
  line: {
    width: 60,
    height: 1,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: 1,
    textTransform: "lowercase",
    marginBottom: 40,
  },
  version: {
    fontSize: 12,
    fontWeight: "300",
    letterSpacing: 1,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 0.5,
  },
});