// components/CustomLoader.tsx

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image
} from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  Easing,
  FadeIn
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/themecontext';

interface CustomLoaderProps {
  text?: string;
  fullScreen?: boolean;
  size?: 'small' | 'large';
  showText?: boolean;
}

export const CustomLoader = ({
  text = '',
  fullScreen = true,
  size = 'large',
  showText = false
}: CustomLoaderProps) => {

  const { colors } = useTheme();
  const iconSize = size === 'large' ? 70 : 50;

  // 🎯 Animations
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    // 🪙 Coin flip
    rotation.value = withRepeat(
      withSequence(
        withTiming(90, { duration: 250, easing: Easing.out(Easing.ease) }),
        withTiming(180, { duration: 250 }),
        withTiming(270, { duration: 250 }),
        withTiming(360, { duration: 250, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );

    // 💥 Slight bounce
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 200 }),
        withTiming(0.95, { duration: 150 }),
        withTiming(1, { duration: 150 })
      ),
      -1,
      true
    );
  }, []);

  // 🎬 3D flip style
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${rotation.value}deg` },
      { scale: scale.value }
    ]
  }));

  const content = (
    <Animated.View entering={FadeIn.duration(200)} style={styles.content}>
      <Animated.View style={animatedIconStyle}>
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
      </Animated.View>

      {showText && text ? (
        <Text style={[styles.text, { color: colors.text }]}>
          {text}
        </Text>
      ) : null}
    </Animated.View>
  );

  if (fullScreen) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.fullScreen, { backgroundColor: 'transparent' }]}
      >

        {/* 🌫️ REAL BACKGROUND BLUR */}
        <BlurView
          intensity={80}
          tint="light"
          style={StyleSheet.absoluteFill}
        />

        {/* 🤍 GLASS WHITE OVERLAY (light, not blocking) */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(255,255,255,0.2)' }
          ]}
        />

        {/* 🪙 LOADER */}
        {content}

      </Animated.View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },

  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  text: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
  },
});