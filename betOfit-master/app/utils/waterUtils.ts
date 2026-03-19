// app/utils/waterUtils.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const WEIGHT_KEY = "BF_WEIGHT_KG";
export const WATER_KEY = "BF_WATER_DATA";
export const WATER_WEEKLY_KEY = "BF_WATER_WEEKLY"; // <-- NEW

export interface WaterLog {
  ml: number;
  time: string;
}
export interface DailyWaterSummary {
  date: string;        // YYYY-MM-DD
  amount: number;      // total ml consumed that day
  goal: number;
}

export interface WaterData {
  date: string;
  current: number;
  goal: number;
  history: WaterLog[];
  streak: number;
}

// <-- NEW: Save daily summary whenever current changes
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

    // Keep only last 30 days
    summaries = summaries.slice(-30);

    await AsyncStorage.setItem(WATER_WEEKLY_KEY, JSON.stringify(summaries));
  } catch (e) {
    console.error("Failed to save water weekly summary", e);
  }
};

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

export const loadWaterData = async (weightKg: number): Promise<WaterData> => {
  const today = getToday();
  const currentGoal = calculateDailyGoal(weightKg);
  const stored = await AsyncStorage.getItem(WATER_KEY);

  if (stored) {
    try {
      const parsed: WaterData = JSON.parse(stored);

      if (parsed.date === today) {
        // Same day – save current state as summary
        await saveWaterDailySummary(today, parsed.current, parsed.goal || currentGoal);
        return { ...parsed, goal: parsed.goal || currentGoal };
      }

      // New day logic...
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
      await saveWaterDailySummary(today, 0, currentGoal); // new day starts at 0
      return newData;
    } catch (e) {
      console.log("Parse error, resetting");
    }
  }

  // First time
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

export const addWaterIntake = async (amount: number): Promise<WaterData> => {
  const stored = await AsyncStorage.getItem(WATER_KEY);
  if (!stored) throw new Error("No water data");

  const parsed: WaterData = JSON.parse(stored);
  const newCurrent = Math.min(parsed.current + amount, parsed.goal); // cap at goal if you want
  const newEntry: WaterLog = { ml: amount, time: formatTime(new Date()) };
  const newHistory = [newEntry, ...parsed.history].slice(0, 30);

  const updated: WaterData = {
    ...parsed,
    current: newCurrent,
    history: newHistory,
  };

  await AsyncStorage.setItem(WATER_KEY, JSON.stringify(updated));

  // <-- NEW: Save daily summary
  await saveWaterDailySummary(parsed.date, newCurrent, parsed.goal);

  return updated;
};

export const resetWaterDay = async (goal: number): Promise<WaterData> => {
  const today = getToday();
  const newData: WaterData = {
    date: today,
    current: 0,
    goal,
    history: [],
    streak: 0, // or keep previous streak if you want
  };
  await AsyncStorage.setItem(WATER_KEY, JSON.stringify(newData));
  return newData;
};