// components/CustomLoader.tsx

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  Easing,
  FadeIn,
  cancelAnimation,
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

  const { colors, theme } = useTheme();
  const iconSize = size === 'large' ? 38 : 26;
  const haloSize = size === 'large' ? 84 : 58;
  const tilt = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    tilt.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        withTiming(14, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 550, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(tilt);
      cancelAnimation(pulse);
    };
  }, [tilt, pulse]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value}deg` }],
  }));
  const animatedHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const content = (
    <Animated.View entering={FadeIn.duration(200)} style={styles.content}>
      <Animated.View
        style={[
          styles.iconHalo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2.7,
            backgroundColor: `${colors.primary}16`,
            borderColor: `${colors.primary}35`,
          },
          animatedHaloStyle,
        ]}
      >
        <Animated.View style={animatedIconStyle}>
          <Ionicons name="barbell" size={iconSize} color={colors.primary} />
        </Animated.View>
      </Animated.View>

      {showText && text ? (
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {text}
        </Text>
      ) : null}
    </Animated.View>
  );

  if (fullScreen) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        style={styles.fullScreen}
      >
        <BlurView
          intensity={55}
          tint={theme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: theme === 'dark'
                ? 'rgba(10,10,12,0.38)'
                : 'rgba(255,255,255,0.42)',
            }
          ]}
        />
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
  iconHalo: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  text: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
  },
});