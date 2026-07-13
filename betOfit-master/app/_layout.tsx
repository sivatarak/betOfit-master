// app/_layout.tsx
import { Slot, useRouter, useSegments, usePathname } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { ThemeProvider } from '../context/themecontext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import SplashScreen from "./(auth)/splash";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile } from './services/profileApi';
import { appEvents, PROFILE_UPDATED } from './utils/eventEmitter';
import { ProfileProvider, useProfile } from '../context/profileContext';
import { TodayProvider } from "@/context/todayContext";
import { CustomLoader } from "../components/CustomLoader";
import { BackHandler } from 'react-native';
// Event for pending navigation to prevent bounce-back
export const PENDING_NAVIGATION = 'PENDING_NAVIGATION';
import * as Notifications from 'expo-notifications';

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

  const getModeFromPathname = (path: string): string | undefined => {
    const match = path.match(/[?&]mode=([^&]+)/);
    return match ? match[1] : undefined;
  };

  const loadProfileStatus = async () => {
    if (!user) return;
    console.log('🔄 Loading profile status...');
    try {
      const storedProfile = await AsyncStorage.getItem(`USER_PROFILE_${user.uid}`);
      console.log("storedProfile", storedProfile);
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        console.log('✅ Profile status from AsyncStorage:', {
          basic: profile.basic_completed,
          goals: profile.goals_completed,
          workout: profile.workout_completed
        });

        setProfileStatus({
          basic_completed: profile.basic_completed || false,
          goals_completed: profile.goals_completed || false,
          workout_completed: profile.workout_completed || false,
          checking: false
        });

      }
      const profileFromDB = await getProfile(user.uid);
      if (profileFromDB && profileFromDB.user_id) {
        console.log('✅ Profile status from database:', {
          basic: profileFromDB.basic_completed,
          goals: profileFromDB.goals_completed,
          workout: profileFromDB.workout_completed
        });
        setProfileStatus({
          basic_completed: profileFromDB.basic_completed || false,
          goals_completed: profileFromDB.goals_completed || false,
          workout_completed: profileFromDB.workout_completed || false,
          checking: false
        });
        console.log("user id for caching", user.uid, profileFromDB);
        await AsyncStorage.setItem(
          `USER_PROFILE_STATUS_${user.uid}`,
          JSON.stringify({
            basic_completed: profileFromDB.basic_completed,
            goals_completed: profileFromDB.goals_completed,
            workout_completed: profileFromDB.workout_completed
          })
        );
      } else {
        console.log('📝 No profile found');
        setProfileStatus({
          basic_completed: false,
          goals_completed: false,
          workout_completed: false,
          checking: false
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfileStatus(prev => ({ ...prev, checking: false }));
    }
  };

  useEffect(() => {
    if (user) {
      redirectedToHomeRef.current = false;
      loadProfileStatus();
    } else {
      setProfileStatus(prev => ({ ...prev, checking: false }));
    }
  }, [user]);

  useEffect(() => {
    const handleProfileUpdate = (updatedStatus?: { basic_completed: boolean, goals_completed: boolean, workout_completed: boolean }) => {
      if (updatedStatus) {
        console.log('📢 Profile update received with fresh data, skipping reload');
        setProfileStatus({ ...updatedStatus, checking: false });
      } else {
        loadProfileStatus();
      }
    };
    appEvents.on(PROFILE_UPDATED, handleProfileUpdate);
    return () => {
      appEvents.off(PROFILE_UPDATED, handleProfileUpdate);
    };
  }, [user]);

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

      // Check if trying to access workout without workout completed
      if (currentTab === 'workout' && !profileStatus.workout_completed) {
        if (pendingNavigationRef.current === '/(tabs)/workout') {
          console.log('⏳ Pending nav to workout, waiting for fresh profile status...');
          return;
        }
        console.log('➡️ Workout not completed, redirecting to workout setup');
        router.replace('/(tabs)/profile-setup?mode=workout');
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
  if (loading || profileStatus.checking) {
    return <CustomLoader fullScreen={true} />;
  }
  return <Slot />;
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
        <AuthProvider>
          <SplashScreen />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <TodayWrapper>
            <RootLayoutNav />
          </TodayWrapper>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}