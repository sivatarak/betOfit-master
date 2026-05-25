// context/todayContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import auth from '@react-native-firebase/auth';
import { getTodayFoodLogs, getWorkoutHistory } from '../app/services/exerciseApi';

interface TodayData {
  todayEaten: number;
  todayBurned: number;
  adjustedGoal: number;
  netCalories: number;
  remainingCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  waterIntake: number;
  workoutCount: number;
  activeMinutes: number;
  isOverGoal: boolean;
  progressPercent: number;
}

interface TodayContextType extends TodayData {
  refreshToday: () => Promise<void>;
  updateAfterFoodLog: (calories: number, protein: number, carbs: number, fat: number) => void;
  updateAfterWorkout: (caloriesBurned: number, minutes: number) => void;
}

const TodayContext = createContext<TodayContextType | undefined>(undefined);

export const useToday = () => {
  const context = useContext(TodayContext);
  if (!context) throw new Error('useToday must be used within TodayProvider');
  return context;
};

const getToday = () => new Date().toISOString().split('T')[0];

const defaultData: TodayData = {
  todayEaten: 0,
  todayBurned: 0,
  adjustedGoal: 2000,
  netCalories: 0,
  remainingCalories: 2000,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  waterIntake: 0,
  workoutCount: 0,
  activeMinutes: 0,
  isOverGoal: false,
  progressPercent: 0,
};

export const TodayProvider: React.FC<{
  children: React.ReactNode;
  baseCalorieGoal: number;
  profileLoading: boolean;
}> = ({ children, baseCalorieGoal, profileLoading }) => {

  const [data, setData] = useState<TodayData>(defaultData);

  // ─────────────────────────────────────────
  // CALCULATOR
  // ─────────────────────────────────────────
  const calculate = useCallback((
    eaten: number,
    burned: number,
    protein: number,
    carbs: number,
    fat: number,
    water: number,
    workoutCount: number,
    activeMinutes: number,
    goal: number,
  ): TodayData => {
    const adjustedGoal = goal + burned;
    const netCalories = eaten - burned;
    const remainingCalories = Math.max(adjustedGoal - eaten, 0);
    const progressPercent = adjustedGoal > 0
      ? Math.min(Math.round((eaten / adjustedGoal) * 100), 100)
      : 0;
    const isOverGoal = eaten > adjustedGoal;

    return {
      todayEaten: eaten,
      todayBurned: burned,
      adjustedGoal,
      netCalories,
      remainingCalories,
      totalProtein: Math.round(protein),
      totalCarbs: Math.round(carbs),
      totalFat: Math.round(fat),
      waterIntake: water,
      workoutCount,
      activeMinutes,
      isOverGoal,
      progressPercent,
    };
  }, []);

  // ─────────────────────────────────────────
  // STEP 1: TRY ASYNCSTORAGE (fast)
  // ─────────────────────────────────────────
  const loadFromCache = async (goal: number): Promise<TodayData | null> => {
    try {
      const TODAY = getToday();

      // Check snapshot first — fastest path
      const snapshot = await AsyncStorage.getItem('TODAY_SNAPSHOT');
      if (snapshot) {
        const parsed = JSON.parse(snapshot);
        // Only use if same day and same goal
        if (parsed.date === TODAY && parsed.baseGoal === goal) {
          return parsed;
        }
      }

      // Build from raw storage
      let eaten = 0, protein = 0, carbs = 0, fat = 0, water = 0;
      let burned = 0, workoutCount = 0, activeMinutes = 0;

      const caloriesRaw = await AsyncStorage.getItem('CALORIES_DATA_V2');
      if (caloriesRaw) {
        const caloriesData = JSON.parse(caloriesRaw);
        const todayEntries = (caloriesData.history || []).filter(
          (e: any) => e.date === TODAY
        );
        if (todayEntries.length > 0) {
          eaten = todayEntries.reduce((s: number, e: any) => s + (e.calories || 0), 0);
          protein = todayEntries.reduce((s: number, e: any) => s + (e.protein || 0), 0);
          carbs = todayEntries.reduce((s: number, e: any) => s + (e.carbs || 0), 0);
          fat = todayEntries.reduce((s: number, e: any) => s + (e.fat || 0), 0);
        }
      }

      const waterRaw = await AsyncStorage.getItem('WATER_DATA');
      if (waterRaw) {
        const waterData = JSON.parse(waterRaw);
        if (waterData.date === TODAY) water = waterData.current || 0;
      }

      const workoutRaw = await AsyncStorage.getItem('WORKOUT_HISTORY');
      if (workoutRaw) {
        const history = JSON.parse(workoutRaw);
        const todayWorkouts = history.filter((w: any) => w.date === TODAY);
        burned = todayWorkouts.reduce((s: number, w: any) => s + (w.caloriesBurned || 0), 0);
        workoutCount = todayWorkouts.length;
        activeMinutes = todayWorkouts.reduce((s: number, w: any) => s + (w.duration || 0), 0);
      }

      // If all zero — cache might be empty (new device/fresh install)
      if (eaten === 0 && burned === 0) return null;

      return calculate(eaten, burned, protein, carbs, fat, water, workoutCount, activeMinutes, goal);

    } catch (e) {
      console.log('Cache load error:', e);
      return null;
    }
  };

  // ─────────────────────────────────────────
  // STEP 2: FETCH FROM BACKEND (permanent)
  // ─────────────────────────────────────────
  const loadFromBackend = async (goal: number): Promise<TodayData | null> => {
    try {
      const TODAY = getToday();
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;
      if (!userId) return null;

      console.log('🌐 TodayContext: fetching from backend...');

      // Fetch both in parallel
      const [foodData, workoutData] = await Promise.all([
        getTodayFoodLogs(userId),
        getWorkoutHistory(userId),
      ]);

      // ── FOOD ──
      let eaten = 0, protein = 0, carbs = 0, fat = 0;
      if (foodData?.logs?.length > 0) {
        eaten = foodData.totals?.total_calories || 0;
        protein = foodData.totals?.total_protein || 0;
        carbs = foodData.totals?.total_carbs || 0;
        fat = foodData.totals?.total_fat || 0;

        // Sync to AsyncStorage
        const formattedLogs = foodData.logs.map((log: any) => ({
          id: log.id,
          name: log.food_name,
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fat: log.fat,
          quantity: log.quantity,
          unit: 'g',
          date: new Date(log.logged_at).toISOString().split('T')[0],
          time: new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mealType: log.meal_type,
        }));

        await AsyncStorage.setItem('CALORIES_DATA_V2', JSON.stringify({
          current: eaten,
          goal,
          history: formattedLogs,
        }));
      }

      // ── WORKOUT ──
      let burned = 0, workoutCount = 0, activeMinutes = 0;
      if (workoutData?.length > 0) {
        const todayWorkouts = workoutData.filter((w: any) => {
          const workoutDate = new Date(w.logged_at || w.date).toISOString().split('T')[0];
          return workoutDate === TODAY;
        });

        burned = todayWorkouts.reduce((s: number, w: any) =>
          s + (w.calories_burned || w.caloriesBurned || 0), 0);
        workoutCount = todayWorkouts.length;
        activeMinutes = todayWorkouts.reduce((s: number, w: any) =>
          s + (w.duration_minutes || w.duration || 0), 0);

        // Sync to AsyncStorage
        const formattedWorkouts = todayWorkouts.map((w: any) => ({
          id: w.id,
          exerciseName: w.exercise_name || w.exerciseName,
          date: TODAY,
          duration: w.duration_minutes || w.duration || 0,
          caloriesBurned: w.calories_burned || w.caloriesBurned || 0,
          sets: w.sets || [],
          totalVolume: w.total_volume || 0,
        }));

        await AsyncStorage.setItem('WORKOUT_HISTORY', JSON.stringify(formattedWorkouts));
      }

      // ── WATER (still from AsyncStorage only) ──
      let water = 0;
      const waterRaw = await AsyncStorage.getItem('WATER_DATA');
      if (waterRaw) {
        const waterData = JSON.parse(waterRaw);
        if (waterData.date === TODAY) water = waterData.current || 0;
      }

      return calculate(eaten, burned, protein, carbs, fat, water, workoutCount, activeMinutes, goal);

    } catch (e) {
      console.log('Backend load error:', e);
      return null;
    }
  };

  // ─────────────────────────────────────────
  // MAIN REFRESH — cache first, backend fallback
  // ─────────────────────────────────────────
  const refreshToday = useCallback(async () => {
    const goal = baseCalorieGoal || 2000;

    // Try cache first (instant)
    const cached = await loadFromCache(goal);
    if (cached) {
      setData(cached);
    }

    // Always sync with backend in background
    // (keeps data fresh even if cache had values)
    const fresh = await loadFromBackend(goal);
    if (fresh) {
      setData(fresh);
      // Save snapshot for next fast load
      await AsyncStorage.setItem('TODAY_SNAPSHOT', JSON.stringify({
        ...fresh,
        date: getToday(),
        baseGoal: goal,
      }));
    }

  }, [baseCalorieGoal, calculate]);

  // ─────────────────────────────────────────
  // OPTIMISTIC UPDATES
  // ─────────────────────────────────────────
  const updateAfterFoodLog = useCallback((
  calories: number, protein: number, carbs: number, fat: number,
) => {
  setData(prev => calculate(
    Number(prev.todayEaten) + Number(calories),
    Number(prev.todayBurned),
    Number(prev.totalProtein) + Number(protein),
    Number(prev.totalCarbs) + Number(carbs),
    Number(prev.totalFat) + Number(fat),
    Number(prev.waterIntake),
    Number(prev.workoutCount),
    Number(prev.activeMinutes),
    baseCalorieGoal,
  ));
}, [baseCalorieGoal, calculate]);

  const updateAfterWorkout = useCallback((
    caloriesBurned: number, minutes: number,
  ) => {
    setData(prev => calculate(
      prev.todayEaten,
      prev.todayBurned + caloriesBurned,
      prev.totalProtein,
      prev.totalCarbs,
      prev.totalFat,
      prev.waterIntake,
      prev.workoutCount + 1,
      prev.activeMinutes + minutes,
      baseCalorieGoal,
    ));
  }, [baseCalorieGoal, calculate]);

  // ─────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────
  useEffect(() => {
    console.log('🗓️ TodayContext effect: profileLoading =', profileLoading, 'goal =', baseCalorieGoal);
    if (!profileLoading && baseCalorieGoal > 0) {
      console.log('🗓️ TodayContext: firing refreshToday with goal =', baseCalorieGoal);
      refreshToday();
    }

  }, [baseCalorieGoal, profileLoading]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refreshToday();
    });
    return () => subscription.remove();
  }, [refreshToday]);

  return (
    <TodayContext.Provider value={{
      ...data,
      refreshToday,
      updateAfterFoodLog,
      updateAfterWorkout,
    }}>
      {children}
    </TodayContext.Provider>
  );
};