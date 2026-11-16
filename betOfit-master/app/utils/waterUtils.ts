// app/utils/waterUtils.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from '@react-native-firebase/auth';
import { getUserStorageKey } from '../../constants/userStorage';
import { fetchWithAuth } from '../services/authenticatedFetch';

export const WEIGHT_KEY = "BF_WEIGHT_KG";
export const WATER_KEY = "BF_WATER_DATA";
export const WATER_WEEKLY_KEY = "BF_WATER_WEEKLY";

const BACKEND_URL = 'https://fitness-backend-iota.vercel.app';

const getWaterStorageKey = (key: string, userId?: string): string | null => {
  const resolvedUserId = userId ?? auth().currentUser?.uid;
  return resolvedUserId ? getUserStorageKey(resolvedUserId, key) : null;
};

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

export const getStoredWaterData = async (userId?: string): Promise<WaterData | null> => {
  const storageKey = getWaterStorageKey(WATER_KEY, userId);
  if (!storageKey) return null;

  const stored = await AsyncStorage.getItem(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored) as WaterData;
    } catch (error) {
      console.error("Could not parse saved water data:", error);
      await AsyncStorage.removeItem(storageKey);
    }
  }

  return null;
};
// Delete single log from backend
export const deleteWaterFromBackend = async (userId: string) => {
  try {
    const response = await fetchWithAuth(`${BACKEND_URL}/api/water/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }) // ✅ only userId needed
    });

    if (!response.ok) {
      console.log('❌ Delete failed:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('✅ Water deleted from backend:', result);
    return result;
  } catch (error) {
    console.log('Delete failed:', error);
    return null;
  }
};

// Reset today from backend
export const resetWaterFromBackend = async (userId: string) => {
  try {
    const response = await fetchWithAuth(
      `${BACKEND_URL}/api/water/reset/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      console.log('❌ Reset failed:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('✅ Water reset on backend:', result);
    return result;
  } catch (error) {
    console.log('Reset failed:', error);
    return null;
  }
};


// ========================================
// BACKEND API CALLS
// ========================================

// Save water log to backend
const saveWaterToBackend = async (userId: string, amountMl: number) => {
  try {
    const response = await fetchWithAuth(`${BACKEND_URL}/api/water`, {
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
    const response = await fetchWithAuth(`${BACKEND_URL}/api/water/${encodeURIComponent(userId)}`);
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

export const saveWaterDailySummary = async (
  date: string,
  amount: number,
  goal: number,
  userId?: string
) => {
  try {
    const storageKey = getWaterStorageKey(WATER_WEEKLY_KEY, userId);
    if (!storageKey) return;
    const stored = await AsyncStorage.getItem(storageKey);
    let summaries: DailyWaterSummary[] = stored ? JSON.parse(stored) : [];

    const existingIndex = summaries.findIndex(s => s.date === date);
    if (existingIndex !== -1) {
      summaries[existingIndex] = { date, amount, goal };
    } else {
      summaries.push({ date, amount, goal });
    }

    summaries = summaries.slice(-30);
    await AsyncStorage.setItem(storageKey, JSON.stringify(summaries));
  } catch (e) {
    console.error("Failed to save water weekly summary", e);
  }
};

// ========================================
// UPDATED LOAD FUNCTION WITH BACKEND SYNC
// ========================================

export const loadWaterData = async (weightKg: number, userId?: string): Promise<WaterData> => {
  const storageKey = getWaterStorageKey(WATER_KEY, userId);
  if (!storageKey) throw new Error('Cannot load water data without a signed-in user.');

  const today = getToday();
  const currentGoal = calculateDailyGoal(weightKg);

  // Try to load from AsyncStorage first (fast)
  const stored = await getStoredWaterData(userId);

  if (stored) {
    try {
      const parsed = stored;

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
        await AsyncStorage.setItem(storageKey, JSON.stringify(freshData));
        return freshData;
      }

      if (parsed.date === today) {
        // Same day - return cached data, KEEP THE EXISTING GOAL
        await saveWaterDailySummary(today, parsed.current, parsed.goal, userId);
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

      await AsyncStorage.setItem(storageKey, JSON.stringify(newData));
      await saveWaterDailySummary(today, 0, currentGoal, userId);
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
  await AsyncStorage.setItem(storageKey, JSON.stringify(newData));
  await saveWaterDailySummary(today, 0, currentGoal, userId);
  return newData;
};

// ========================================
// UPDATED ADD FUNCTION WITH BACKEND SAVE
// ========================================

export const addWaterIntake = async (amount: number, userId?: string): Promise<WaterData> => {
  const resolvedUserId = userId ?? auth().currentUser?.uid;
  const storageKey = getWaterStorageKey(WATER_KEY, resolvedUserId ?? undefined);
  if (!resolvedUserId || !storageKey) throw new Error('Cannot save water data without a signed-in user.');

  const stored = await getStoredWaterData(resolvedUserId);
  if (!stored) throw new Error("No water data");

  const parsed = stored;

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
  await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
  await saveWaterDailySummary(parsed.date, newCurrent, parsed.goal, resolvedUserId);

  // Save to backend
  saveWaterToBackend(resolvedUserId, amount).catch(err =>
    console.log('Background save failed:', err)
  );

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

    const storageKey = getWaterStorageKey(WATER_KEY, userId);
    if (!storageKey) return;
    const stored = await AsyncStorage.getItem(storageKey);

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
      await AsyncStorage.setItem(storageKey, JSON.stringify(localData));
      await saveWaterDailySummary(today, backendTotal, localData.goal, userId);
      console.log('✅ Water data synced from backend');
    } else if (backendTotal > maxReasonable) {
      // Backend has corrupted data - ignore it
      console.log('⚠️ Ignoring corrupted backend water data:', backendTotal);
    }
  } catch (error) {
    console.log('Sync error:', error);
  }
};

export const resetWaterDay = async (goal: number, userId?: string): Promise<WaterData> => {
  const storageKey = getWaterStorageKey(WATER_KEY, userId);
  if (!storageKey) throw new Error('Cannot reset water data without a signed-in user.');

  const today = getToday();
  const newData: WaterData = {
    date: today,
    current: 0,
    goal,
    history: [],
    streak: 0,
  };
  await AsyncStorage.setItem(storageKey, JSON.stringify(newData));
  return newData;
};