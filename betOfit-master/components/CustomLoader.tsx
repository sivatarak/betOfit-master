// components/CustomLoader.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  withRepeat, 
  withSequence, 
  withTiming,
  useAnimatedStyle,
  Easing,
  FadeIn
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/themecontext';

const { width, height } = Dimensions.get('window');

interface CustomLoaderProps {
  text?: string;
  fullScreen?: boolean;
  size?: 'small' | 'large';
}

export const CustomLoader = ({ 
  text = 'Loading...', 
  fullScreen = true,
  size = 'large'
}: CustomLoaderProps) => {
  const { colors, theme } = useTheme();
  
  // Define icon size based on prop
  const iconSize = size === 'large' ? 50 : 32;
  const containerSize = size === 'large' ? 100 : 70;
  const containerRadius = size === 'large' ? 50 : 35;
  
  // Animation values
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0.5);
  
  // Pulse animation
  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 800, easing: Easing.ease }),
        withTiming(1, { duration: 800, easing: Easing.ease })
      ),
      -1,
      true
    );
    
    rotate.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
    
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);
  
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` }
    ],
    opacity: opacity.value
  }));
  
  const content = (
    <Animated.View 
      entering={FadeIn.duration(400)}
      style={[styles.content, { backgroundColor: colors.background }]}
    >
      <Animated.View style={[styles.iconContainer, animatedIconStyle, { 
        width: containerSize, 
        height: containerSize, 
        borderRadius: containerRadius 
      }]}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          style={[styles.iconGradient, { borderRadius: containerRadius }]}
        >
          <Ionicons name="barbell" size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
      
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
      
      <ActivityIndicator 
        size={size === 'large' ? 'large' : 'small'} 
        color={colors.primary}
        style={styles.activityIndicator}
      />
    </Animated.View>
  );
  
  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
        {content}
      </View>
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
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    minWidth: 200,
  },
  iconContainer: {
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#FF6B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 16,
  },
  activityIndicator: {
    marginTop: 8,
  },
});