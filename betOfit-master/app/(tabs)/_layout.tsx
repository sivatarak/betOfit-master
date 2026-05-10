// app/(tabs)/_layout.tsx
import { Tabs, useSegments,usePathname } from "expo-router";
import { useTheme } from "../../context/themecontext";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { colors } = useTheme();
  const segments = useSegments();
  const pathname = usePathname();
  const { user } = useAuth();
  
  const [isOnboarding, setIsOnboarding] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;
    const cachedProfile = await AsyncStorage.getItem(`USER_PROFILE_${user.uid}`);
    if (cachedProfile) {
      const profile = JSON.parse(cachedProfile);
      const isComplete = profile.basic_completed && 
                         profile.goals_completed && 
                         profile.workout_completed;
      setIsOnboarding(!isComplete);
    } else {
      setIsOnboarding(true);
    }
  };

  const isOnProfileSetup = segments[1] === 'profile-setup';
  const isAllMode = pathname.includes('mode=all');
  const shouldHideTabBar = isOnboarding && isOnProfileSetup && !isAllMode;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: shouldHideTabBar ? 'none' : 'flex',
          backgroundColor: colors.card,
          height: 60,
        },
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: "Home", 
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="stats" 
        options={{ 
          title: "Stats", 
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart-outline" size={24} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="history" 
        options={{ 
          title: "History", 
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={24} color={color} /> 
        }} 
      />

      {/* Profile tab — hidden during onboarding, visible after */}
      <Tabs.Screen 
        name="profile-setup" 
        options={{ 
          title: "Profile",
          href: '/(tabs)/profile-setup?mode=all',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />
        }} 
      />

      {/* Hidden screens */}
      <Tabs.Screen name="water" options={{ href: null }} />
      <Tabs.Screen name="workout" options={{ href: null }} />
      <Tabs.Screen name="calories" options={{ href: null }} />
      <Tabs.Screen name="exercise-library" options={{ href: null }} />
      <Tabs.Screen name="exercise-detail" options={{ href: null }} />
      <Tabs.Screen name="logExercise-screen" options={{ href: null }} />
    </Tabs>
  );
}