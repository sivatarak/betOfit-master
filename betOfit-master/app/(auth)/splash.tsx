// app/(auth)/splash.tsx
import { View, Text, Image, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../context/themecontext";

export default function SplashScreen() {
  const { colors, theme } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const slideUpAnim = useRef(new Animated.Value(18)).current;
  const lineScaleX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 9,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 550,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(lineScaleX, {
        toValue: 1,
        duration: 700,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.background, colors.card]}
        style={styles.background}
      />

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideUpAnim }
              ],
              backgroundColor: colors.card,
            },
          ]}
        >
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

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
          Rise every day. Live healthy.
        </Animated.Text>
      </View>
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
    paddingHorizontal: 24,
  },
  logoWrapper: {
    width: 112,
    height: 112,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  logo: {
    width: 82,
    height: 82,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 14,
  },
  line: {
    width: 44,
    height: 3,
    borderRadius: 2,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});