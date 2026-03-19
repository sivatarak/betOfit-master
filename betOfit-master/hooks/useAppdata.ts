// src/hooks/useAppData.ts   (or app/hooks/useAppData.ts)

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAppData = () => {
  const [weight, setWeight] = useState<number | null>(null);
  const [caloriesCurrent, setCaloriesCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // Weight
      const w = await AsyncStorage.getItem('BF_WEIGHT_KG');
      if (w) setWeight(parseFloat(w));

      // Today's calories (very basic version - expand as needed)
      const calData = await AsyncStorage.getItem('CALORIES_DATA_V2');
      if (calData) {
        const parsed = JSON.parse(calData);
        const today = new Date().toISOString().split("T")[0];
        const todayEntries = (parsed.history || []).filter((e: any) => e.date === today);
        const todayKcal = todayEntries.reduce((sum: number, e: any) => sum + (e.calories || 0), 0);
        setCaloriesCurrent(todayKcal);
      }
    } catch (err) {
      console.error('useAppData refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    weight,
    caloriesCurrent,
    loading,
    refresh,
  };
};