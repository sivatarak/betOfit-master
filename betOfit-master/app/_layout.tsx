// app/_layout.tsx
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { View } from "react-native";
import { ThemeProvider } from '../context/themecontext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import SplashScreen from "./(auth)/splash";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile } from './services/profileApi';
import { appEvents, PROFILE_UPDATED } from './utils/eventEmitter';
import { ProfileProvider, useProfile } from '../context/profileContext';
import { TodayProvider } from "@/context/todayContext";
import { CustomLoader } from "../components/CustomLoader";
import { ActiveWorkoutBanner } from "../components/ActiveWorkoutBanner";
import { AppAlertProvider } from "../components/AppAlertProvider";
import { BackHandler } from 'react-native';
// Event for pending navigation to prevent bounce-back
export const PENDING_NAVIGATION = 'PENDING_NAVIGATION';
import * as Notifications from 'expo-notifications';

import * as Font from 'expo-font';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();




  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        return false;
      }
    );
    return () => backHandler.remove();
  }, []);

  const [profileStatus, setProfileStatus] = useState({
    basic_completed: false,
    goals_completed: false,
    workout_completed: false,
    checking: true
  });

  const redirectedToHomeRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const profileLoadRequestRef = useRef(0);

  const getModeFromPathname = (path: string): string | undefined => {
    const match = path.match(/[?&]mode=([^&]+)/);
    return match ? match[1] : undefined;
  };

  const loadProfileStatus = async (userId: string, requestId: number) => {
    try {
      const [storedProfile, storedStatus] = await Promise.all([
        AsyncStorage.getItem(`USER_PROFILE_${userId}`),
        AsyncStorage.getItem(`USER_PROFILE_STATUS_${userId}`),
      ]);
      const cachedProfile = storedProfile ? JSON.parse(storedProfile) : {};
      const cachedStatus = storedStatus ? JSON.parse(storedStatus) : {};
      const cached = {
        basic_completed: Boolean(cachedProfile.basic_completed || cachedStatus.basic_completed),
        goals_completed: Boolean(cachedProfile.goals_completed || cachedStatus.goals_completed),
        workout_completed: Boolean(cachedProfile.workout_completed || cachedStatus.workout_completed),
      };

      if (profileLoadRequestRef.current !== requestId) return;
      setProfileStatus({ ...cached, checking: false });

      const profileFromDB = await getProfile(userId);
      if (profileLoadRequestRef.current !== requestId) return;

      if (profileFromDB?.user_id) {
        const freshStatus = {
          basic_completed: Boolean(cached.basic_completed || profileFromDB.basic_completed),
          goals_completed: Boolean(cached.goals_completed || profileFromDB.goals_completed),
          workout_completed: Boolean(cached.workout_completed || profileFromDB.workout_completed),
        };
        setProfileStatus({ ...freshStatus, checking: false });
        await AsyncStorage.setItem(
          `USER_PROFILE_STATUS_${userId}`,
          JSON.stringify(freshStatus)
        );
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      if (profileLoadRequestRef.current === requestId) {
        setProfileStatus(prev => ({ ...prev, checking: false }));
      }
    }
  };

  useEffect(() => {
    if (user) {
      redirectedToHomeRef.current = false;
      profileLoadRequestRef.current += 1;
      const requestId = profileLoadRequestRef.current;
      setProfileStatus({
        basic_completed: false,
        goals_completed: false,
        workout_completed: false,
        checking: true,
      });
      void loadProfileStatus(user.uid, requestId);
    } else {
      profileLoadRequestRef.current += 1;
      setProfileStatus({
        basic_completed: false,
        goals_completed: false,
        workout_completed: false,
        checking: false,
      });
    }
  }, [user]);

  useEffect(() => {
    const handleProfileUpdate = (updatedStatus?: { basic_completed: boolean, goals_completed: boolean, workout_completed: boolean }) => {
      if (updatedStatus) {
        profileLoadRequestRef.current += 1;
        console.log('📢 Profile update received with fresh data, skipping reload');
        setProfileStatus({ ...updatedStatus, checking: false });
        if (user?.uid) {
          AsyncStorage.setItem(`USER_PROFILE_STATUS_${user.uid}`, JSON.stringify(updatedStatus))
            .catch(error => console.error('Could not cache updated profile status:', error));
        }
      } else {
        if (user?.uid) {
          profileLoadRequestRef.current += 1;
          const requestId = profileLoadRequestRef.current;
          setProfileStatus(prev => ({ ...prev, checking: true }));
          void loadProfileStatus(user.uid, requestId);
        }
      }
    };
    appEvents.on(PROFILE_UPDATED, handleProfileUpdate);
    return () => {
      appEvents.off(PROFILE_UPDATED, handleProfileUpdate);
    };
  }, [user?.uid]);

  // Listen for pending navigation events
  useEffect(() => {
    const handlePendingNavigation = (route: string) => {
      console.log('📌 Pending navigation set:', route);
      pendingNavigationRef.current = route;
    };
    appEvents.on(PENDING_NAVIGATION, handlePendingNavigation);
    return () => {
      appEvents.off(PENDING_NAVIGATION, handlePendingNavigation);
    };
  }, []);



  useEffect(() => {
    if (loading || profileStatus.checking) {
      return;
    }
    if (!segments[0]) return;

    const isOnSplash = segments[1] === 'splash';
    const inTabsGroup = segments[0] === '(tabs)';
    const inAuthGroup = segments[0] === '(auth)';

    // ✅ FIXED: Check for profile-setup in tabs (where it belongs)
    const isOnProfileSetup = inTabsGroup && segments[1] === 'profile-setup';

    // ✅ FIXED: Get current tab correctly
    const currentTab = inTabsGroup ? segments[1] : null;
    const mode = getModeFromPathname(pathname);

    console.log('🚦 Navigation Check:', {
      basic: profileStatus.basic_completed,
      goals: profileStatus.goals_completed,
      workout: profileStatus.workout_completed,
      inTabs: inTabsGroup,
      inAuth: inAuthGroup,
      currentTab,
      onProfileSetup: isOnProfileSetup,
      isOnSplash,
      mode,
      pathname,
      pending: pendingNavigationRef.current,
      user: user?.uid,
      segments: segments.join('/')
    });

    // NOT LOGGED IN
    if (!user) {
      if (!inAuthGroup || isOnSplash) {
        console.log('➡️ Redirecting to sign in');
        router.replace('/(auth)/google-signin');
      }
      return;
    }

    // CASE 1: Basic not completed → force profile setup
    if (!profileStatus.basic_completed) {
      if (!isOnProfileSetup) {
        console.log('➡️ Basic not completed, redirecting to profile setup');
        router.replace('/(tabs)/profile-setup?mode=basic');
      } else {
        console.log('✅ Already on profile setup for basic info');
      }
      return;
    }

    // CASE 2: Guard incomplete section tabs
    if (profileStatus.basic_completed) {
      // Check if trying to access calories without goals completed
      if (currentTab === 'calories' && !profileStatus.goals_completed) {
        if (pendingNavigationRef.current === '/(tabs)/calories') {
          console.log('⏳ Pending nav to calories, waiting for fresh profile status...');
          return;
        }
        console.log('➡️ Goals not completed, redirecting to goals setup');
        router.replace('/(tabs)/profile-setup?mode=goals');
        return;
      }

    }

    // CASE 3: On profile-setup screen (in tabs)
    if (isOnProfileSetup) {
      // If we're in 'all' mode (manual edit), stay
      if (mode === 'all') {
        console.log('✅ Manual edit mode (all), staying');
        return;
      }
      // If in goals mode and goals not completed, stay
      if (mode === 'goals' && !profileStatus.goals_completed) {
        console.log('✅ Goals section (not completed), staying');
        return;
      }
      // If in workout mode and workout not completed, stay
      if (mode === 'workout' && !profileStatus.workout_completed) {
        console.log('✅ Workout section (not completed), staying');
        return;
      }
      // Profile setup completed, go to home
      if (!redirectedToHomeRef.current) {
        redirectedToHomeRef.current = true;
        console.log('➡️ Profile setup done, redirecting to home');
        router.replace('/(tabs)/home');
      }
      return;
    }

    // CASE 4: Basic complete, not on profile-setup → ensure in tabs
    if (!inTabsGroup) {
      if (!redirectedToHomeRef.current) {
        redirectedToHomeRef.current = true;
        console.log('➡️ Basic completed, going to home');
        router.replace('/(tabs)/home');
      }
      return;
    }

    // Reached a valid destination — clear pending navigation
    if (pendingNavigationRef.current) {
      console.log('✅ Reached destination, clearing pending nav:', pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }

  }, [user, loading, profileStatus.basic_completed, profileStatus.goals_completed, profileStatus.workout_completed, profileStatus.checking, segments.join('/'), pathname]);
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {loading || profileStatus.checking ? (
        <CustomLoader fullScreen={true} />
      ) : (
        <ActiveWorkoutBanner />
      )}
    </View>
  );
}
function TodayWrapper({ children }: { children: React.ReactNode }) {
  const { dailyCalorieGoal, loading } = useProfile();
  return (
    <TodayProvider baseCalorieGoal={dailyCalorieGoal} profileLoading={loading}>
      {children}
    </TodayProvider>
  );
}
export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  

  useEffect(() => {
    console.log('⏱️ Splash timer started');
    const timer = setTimeout(() => {
      console.log('✅ Splash finished');
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <ThemeProvider>
        <AppAlertProvider>
          <AuthProvider>
            <SplashScreen />
          </AuthProvider>
        </AppAlertProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppAlertProvider>
        <AuthProvider>
          <ProfileProvider>
            <TodayWrapper>
              <RootLayoutNav />
            </TodayWrapper>
          </ProfileProvider>
        </AuthProvider>
      </AppAlertProvider>
    </ThemeProvider>
  );
}