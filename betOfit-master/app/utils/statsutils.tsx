import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface OverallWeeklyStats {
  labels: string[];
  calories: number[];
  water: number[];
  avgCalories: number;
  avgWater: number;
}

const getLast7Days = () => {
  const days: { date: string; label: string }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);

    days.push({
      date: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }

  return days;
};

export const useOverallWeeklyStats = () => {
  const [stats, setStats] = useState<OverallWeeklyStats>({
    labels: [],
    calories: [],
    water: [],
    avgCalories: 0,
    avgWater: 0,
  });

  useEffect(() => {
    const load = async () => {
      const days = getLast7Days();

      /* -------- CALORIES (from Calories menu) -------- */
      const calStr = await AsyncStorage.getItem("CALORIES_DATA_V2");
      const calHistory = calStr ? JSON.parse(calStr).history || [] : [];

      let calorieTotal = 0;
      const calorieArr = days.map(d => {
        const dayCalories = calHistory
          .filter((e: any) => e.date === d.date)
          .reduce((s: number, e: any) => s + e.calories, 0);

        calorieTotal += dayCalories;
        return dayCalories;
      });

      /* -------- WATER (from Water menu) -------- */
      const waterStr = await AsyncStorage.getItem("BF_WATER_WEEKLY");
      const waterWeekly = waterStr ? JSON.parse(waterStr) : [];

      let waterTotal = 0;
      const waterArr = days.map(d => {
        const amount =
          waterWeekly.find((w: any) => w.date === d.date)?.amount || 0;

        waterTotal += amount;
        return amount;
      });

      setStats({
        labels: days.map(d => d.label),
        calories: calorieArr,
        water: waterArr,
        avgCalories: Math.round(calorieTotal / 7),
        avgWater: Math.round(waterTotal / 7),
      });
    };

    load();
  }, []);

  return stats;
};
