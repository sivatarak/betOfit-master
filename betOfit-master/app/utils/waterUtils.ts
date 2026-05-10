// app/utils/waterUtils.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from '@react-native-firebase/auth';

export const WEIGHT_KEY = "BF_WEIGHT_KG";
export const WATER_KEY = "BF_WATER_DATA";
export const WATER_WEEKLY_KEY = "BF_WATER_WEEKLY";

const BACKEND_URL = 'https://fitness-backend-iota.vercel.app';

export interface WaterLog {
  ml: number;
  time: string;
  id?: string; // For backend reference
}

export interface DailyWaterSummary {
  date: string;
  amount: number;
  goal: number;
}

export interface WaterData {
  date: string;
  current: number;
  goal: number;
  history: WaterLog[];
  streak: number;
}

// ========================================
// BACKEND API CALLS
// ========================================

// Save water log to backend
const saveWaterToBackend = async (userId: string, amountMl: number) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/water`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amountMl })
    });

    if (!response.ok) {
      throw new Error('Failed to save to backend');
    }

    const result = await response.json();
    console.log('✅ Water saved to backend:', result);
    return result;
  } catch (error) {
    console.error('Backend save error:', error);
    return null;
  }
};

// Get today's total water from backend
const getTodayWaterFromBackend = async (userId: string): Promise<number> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/water/${userId}`);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.total_ml || 0;
  } catch (error) {
    console.error('Backend get error:', error);
    return 0;
  }
};

// ========================================
// EXISTING UTILITIES (KEPT AS IS)
// ========================================

export const getToday = (): string => {
  const now = new Date();
  return now.toISOString().split("T")[0];
};

export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const calculateDailyGoal = (weightKg: number): number => {
  return Math.round(weightKg * 30);
};

export const saveWaterDailySummary = async (date: string, amount: number, goal: number) => {
  try {
    const stored = await AsyncStorage.getItem(WATER_WEEKLY_KEY);
    let summaries: DailyWaterSummary[] = stored ? JSON.parse(stored) : [];

    const existingIndex = summaries.findIndex(s => s.date === date);
    if (existingIndex !== -1) {
      summaries[existingIndex] = { date, amount, goal };
    } else {
      summaries.push({ date, amount, goal });
    }

    summaries = summaries.slice(-30);
    await AsyncStorage.setItem(WATER_WEEKLY_KEY, JSON.stringify(summaries));
  } catch (e) {
    console.error("Failed to save water weekly summary", e);
  }
};

// ========================================
// UPDATED LOAD FUNCTION WITH BACKEND SYNC
// ========================================

export const loadWaterData = async (weightKg: number): Promise<WaterData> => {
  const today = getToday();
  const currentGoal = calculateDailyGoal(weightKg);

  // Try to load from AsyncStorage first (fast)
  const stored = await AsyncStorage.getItem(WATER_KEY);

  if (stored) {
    try {
      const parsed: WaterData = JSON.parse(stored);

      // ✅ ADD THIS CORRUPTED DATA CHECK
      if (parsed.current > currentGoal * 2) {
        console.log('⚠️ Corrupted water data detected, resetting...');
        const freshData: WaterData = {
          date: today,
          current: 0,
          goal: currentGoal,
          history: [],
          streak: 0,
        };
        await AsyncStorage.setItem(WATER_KEY, JSON.stringify(freshData));
        return freshData;
      }

      if (parsed.date === today) {
        // Same day - return cached data, KEEP THE EXISTING GOAL
        await saveWaterDailySummary(today, parsed.current, parsed.goal);
        return parsed; // Just return parsed, don't modify goal
      }

      // New day logic
      const hitGoalYesterday = parsed.current >= (parsed.goal || currentGoal);
      const newStreak = hitGoalYesterday ? parsed.streak + 1 : 0;

      const newData: WaterData = {
        date: today,
        current: 0,
        goal: currentGoal,
        history: [],
        streak: newStreak,
      };

      await AsyncStorage.setItem(WATER_KEY, JSON.stringify(newData));
      await saveWaterDailySummary(today, 0, currentGoal);
      return newData;
    } catch (e) {
      console.log("Parse error, resetting");
    }
  }

  // Fresh start
  const newData: WaterData = {
    date: today,
    current: 0,
    goal: currentGoal,
    history: [],
    streak: 0,
  };
  await AsyncStorage.setItem(WATER_KEY, JSON.stringify(newData));
  await saveWaterDailySummary(today, 0, currentGoal);
  return newData;
};

// ========================================
// UPDATED ADD FUNCTION WITH BACKEND SAVE
// ========================================

export const addWaterIntake = async (amount: number): Promise<WaterData> => {
  const stored = await AsyncStorage.getItem(WATER_KEY);
  if (!stored) throw new Error("No water data");

  const parsed: WaterData = JSON.parse(stored);

  // DEBUG: Log the current state
  console.log('💧 Before add - current:', parsed.current, 'goal:', parsed.goal, 'amount:', amount);

  const newCurrent = parsed.current + amount; // Remove the Math.min
  const newEntry: WaterLog = { ml: amount, time: formatTime(new Date()) };
  const newHistory = [newEntry, ...parsed.history].slice(0, 30);

  const updated: WaterData = {
    ...parsed,
    current: newCurrent,
    history: newHistory,
    // IMPORTANT: Keep the original goal, don't change it!
    goal: parsed.goal,  // Make sure goal stays the same
  };

  console.log('💧 After add - current:', updated.current, 'goal:', updated.goal);

  // Save to AsyncStorage
  await AsyncStorage.setItem(WATER_KEY, JSON.stringify(updated));
  await saveWaterDailySummary(parsed.date, newCurrent, parsed.goal);

  // Save to backend
  const currentUser = auth().currentUser;
  const userId = currentUser?.uid;

  if (userId) {
    saveWaterToBackend(userId, amount).catch(err =>
      console.log('Background save failed:', err)
    );
  }

  return updated;
};

// ========================================
// SYNC FUNCTION - Call this on screen focus
// ========================================

// ========================================
// FIXED SYNC FUNCTION - Don't pull old data
// ========================================

export const syncWaterWithBackend = async (): Promise<void> => {
  try {
    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;

    if (!userId) return;

    const stored = await AsyncStorage.getItem(WATER_KEY);

    if (!stored) return;

    const localData = JSON.parse(stored);
    const today = getToday();

    // ONLY sync if it's today's data
    if (localData.date !== today) return;

    // Get backend data
    const backendTotal = await getTodayWaterFromBackend(userId);

    // IMPORTANT: Only update from backend if backend has MORE water than local
    // AND backend total is reasonable (not > 2x goal)
    const maxReasonable = localData.goal * 2;

    if (backendTotal > localData.current && backendTotal <= maxReasonable) {
      // Backend has more data, sync to local
      localData.current = backendTotal;
      await AsyncStorage.setItem(WATER_KEY, JSON.stringify(localData));
      await saveWaterDailySummary(today, backendTotal, localData.goal);
      console.log('✅ Water data synced from backend');
    } else if (backendTotal > maxReasonable) {
      // Backend has corrupted data - ignore it
      console.log('⚠️ Ignoring corrupted backend water data:', backendTotal);
    }
  } catch (error) {
    console.log('Sync error:', error);
  }
};

export const resetWaterDay = async (goal: number): Promise<WaterData> => {
  const today = getToday();
  const newData: WaterData = {
    date: today,
    current: 0,
    goal,
    history: [],
    streak: 0,
  };
  await AsyncStorage.setItem(WATER_KEY, JSON.stringify(newData));
  return newData;
};