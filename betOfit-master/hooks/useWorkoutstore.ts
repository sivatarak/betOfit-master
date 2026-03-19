// src/hooks/useWorkoutStore.ts
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WorkoutEntry {
  id: string;
  name: string;
  duration: number;     // minutes
  calories: number;     // estimated kcal burned
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM
}

const WORKOUT_STORAGE_KEY = 'BF_WORKOUTS_V1';

// Realistic MET values (source: Compendium of Physical Activities)
const EXERCISE_MET: Record<string, number> = {
  'Push-ups': 8.0,
  'Squats': 5.0,
  'Running': 9.0,
  'Plank': 3.5,
  'Jumping Jacks': 8.0,
  'Burpees': 10.0,
  'Mountain Climbers': 8.0,
  'Lunges': 5.0,
  'Crunches': 3.8,
  'Pull-ups': 8.0,
  'High Knees': 8.0,
};

export const WEEKLY_PLAN = [
  { day: 'Monday',    focus: 'Chest + Triceps + Abs',    suggested: ['Push-ups', 'Plank', 'Crunches'] },
  { day: 'Tuesday',   focus: 'Back + Biceps',            suggested: ['Pull-ups'] },
  { day: 'Wednesday', focus: 'Legs + Core',              suggested: ['Squats', 'Lunges', 'Plank'] },
  { day: 'Thursday',  focus: 'Shoulders + Cardio',       suggested: ['Jumping Jacks', 'Mountain Climbers'] },
  { day: 'Friday',    focus: 'Full Body',                suggested: ['Burpees', 'Push-ups', 'Squats'] },
  { day: 'Saturday',  focus: 'Active Recovery / Cardio', suggested: ['Running', 'High Knees'] },
  { day: 'Sunday',    focus: 'Rest',                     suggested: [] },
];

export const useWorkoutStore = () => {
  const [history, setHistory] = useState<WorkoutEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  // Load once on mount
  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(WORKOUT_STORAGE_KEY);
      if (json) {
        setHistory(JSON.parse(json));
      }
    } catch (err) {
      console.error('Failed to load workouts', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWorkouts = async (newHistory: WorkoutEntry[]) => {
    try {
      await AsyncStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (err) {
      console.error('Failed to save workouts', err);
    }
  };

  const addWorkout = async (name: string, durationMin: number) => {
    const weightKgStr = await AsyncStorage.getItem('BF_WEIGHT_KG');
    const weightKg = weightKgStr ? parseFloat(weightKgStr) : 70;

    const met = EXERCISE_MET[name] ?? 6.0;
    const hours = durationMin / 60;
    const caloriesBurned = Math.round(met * weightKg * hours);

    const entry: WorkoutEntry = {
      id: Date.now().toString(),
      name,
      duration: durationMin,
      calories: caloriesBurned,
      date: today,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [entry, ...history];
    await saveWorkouts(updated);
  };

  // Today's summary
  const todayWorkouts = history.filter(w => w.date === today);
  const todayStats = {
    minutes: todayWorkouts.reduce((sum, w) => sum + w.duration, 0),
    caloriesBurned: todayWorkouts.reduce((sum, w) => sum + w.calories, 0),
  };

  // Weekly stats (last 7 days)
  const weeklyStats = (() => {
    const labels: string[] = [];
    const minutesArr: number[] = [];
    const caloriesArr: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

      const dayEntries = history.filter(w => w.date === dateStr);
      minutesArr.push(dayEntries.reduce((s, w) => s + w.duration, 0));
      caloriesArr.push(dayEntries.reduce((s, w) => s + w.calories, 0));
    }

    return { labels, minutes: minutesArr, calories: caloriesArr };
  })();

  return {
    history,
    todayStats,
    weeklyStats,
    loading,
    refresh: loadWorkouts,
    addWorkout,
    exercises: Object.keys(EXERCISE_MET),
    getMetValue: (name: string) => EXERCISE_MET[name] ?? 6.0,
  };
};