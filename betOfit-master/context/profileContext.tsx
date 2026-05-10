// context/ProfileContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { getProfile } from '../app/services/profileApi';
interface ProfileContextType {
  profile: any;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  // User stats
  dailyCalorieGoal: number;
  waterGoal: number;
  bmr: number;
  tdee: number;
  workoutDays: string[];
  weight: number;
  height: number;
  age: number;
  gender: string;
  name: string;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Derived values for easy access
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(2000);
  const [waterGoal, setWaterGoal] = useState(2500);
  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [weight, setWeight] = useState(0);
  const [height, setHeight] = useState(0);
  const [age, setAge] = useState(0);
  const [gender, setGender] = useState('male');
  const [name, setName] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (!userId) {
        setLoading(false);
        return;
      }

      const cached = await AsyncStorage.getItem(`USER_PROFILE_${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.dailyCalorieGoal !== undefined) {
          updateDerivedValues(parsed);
        } else if (parsed.daily_calorie_goal !== undefined) {
          updateDerivedValues({
            name: parsed.name,
            age: parsed.age,
            weight: parsed.weight,
            height: parsed.height,
            gender: parsed.gender,
            dailyCalorieGoal: parsed.daily_calorie_goal,
            waterGoal: parsed.water_goal,
            bmr: parsed.bmr,
            tdee: parsed.tdee,
            workoutDays: parsed.workout_days || [],
            activityLevel: parsed.activity_level || 1.55,
          });
        }
        // ✅ KEY FIX: cache hit = we have enough data, unblock TodayContext NOW
        setLoading(false);
      }

      // Fetch fresh in background — don't block anything
      const freshProfile = await getProfile(userId);
      if (freshProfile && freshProfile.user_id) {
        const mapped = {
          name: freshProfile.name,
          age: freshProfile.age,
          weight: freshProfile.weight,
          height: freshProfile.height,
          gender: freshProfile.gender,
          dailyCalorieGoal: freshProfile.daily_calorie_goal,
          waterGoal: freshProfile.water_goal,
          bmr: freshProfile.bmr,
          tdee: freshProfile.tdee,
          workoutDays: freshProfile.workout_days || [],
          activityLevel: freshProfile.activity_level || 1.55,
          basic_completed: freshProfile.basic_completed || false,
          goals_completed: freshProfile.goals_completed || false,
          workout_completed: freshProfile.workout_completed || false,
        };
        setProfile(mapped);
        updateDerivedValues(mapped);
        await AsyncStorage.setItem(`USER_PROFILE_${userId}`, JSON.stringify(mapped));
      }

    } catch (error) {
      console.error('ProfileContext error:', error);
    } finally {
      setLoading(false); // always ensure loading ends
    }
  }, []);

  const updateDerivedValues = (data: any) => {
    setDailyCalorieGoal(data.dailyCalorieGoal || 2000);
    setWaterGoal(data.waterGoal || 2500);
    setBmr(data.bmr || 0);
    setTdee(data.tdee || 0);
    setWorkoutDays(data.workoutDays || []);
    setWeight(data.weight || 0);
    setHeight(data.height || 0);
    setAge(data.age || 0);
    setGender(data.gender || 'male');
    setName(data.name || 'User');
  };

  const refreshProfile = async () => {
    try {
      setLoading(true);
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (!userId) {
        setLoading(false);
        return;
      }

      // FORCE fetch from backend - ignore cache
      console.log('🔄 Refresh: forcing backend fetch...in context');
      const freshProfile = await getProfile(userId);

      if (freshProfile && freshProfile.user_id) {
        const mapped = {
          name: freshProfile.name,
          age: freshProfile.age,
          weight: freshProfile.weight,
          height: freshProfile.height,
          gender: freshProfile.gender,
          dailyCalorieGoal: freshProfile.daily_calorie_goal,
          waterGoal: freshProfile.water_goal,
          bmr: freshProfile.bmr,
          tdee: freshProfile.tdee,
          workoutDays: freshProfile.workout_days || [],
          activityLevel: freshProfile.activity_level || 1.55,
          basic_completed: freshProfile.basic_completed || false,
          goals_completed: freshProfile.goals_completed || false,
          workout_completed: freshProfile.workout_completed || false,
        };

        setProfile(mapped);
        updateDerivedValues(mapped);

        // Update cache with fresh data
        await AsyncStorage.setItem(`USER_PROFILE_${userId}`, JSON.stringify(mapped));
        console.log('✅ Profile refreshed and cached');
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for Firebase auth to be ready
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        loadProfile();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadProfile]);

  return (
    <ProfileContext.Provider value={{
      profile,
      loading,
      refreshProfile,
      dailyCalorieGoal,
      waterGoal,
      bmr,
      tdee,
      workoutDays,
      weight,
      height,
      age,
      gender,
      name,
    }}>
      {children}
    </ProfileContext.Provider>
  );
};