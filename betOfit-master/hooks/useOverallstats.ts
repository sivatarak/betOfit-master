import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface WeeklyAvgData {
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

export const useWeeklyAverages = () => {
  const [data, setData] = useState<WeeklyAvgData>({
    labels: [],
    calories: [],
    water: [],
    avgCalories: 0,
    avgWater: 0,
  });

  useEffect(() => {
    const load = async () => {
      const days = getLast7Days();

      /* -------- CALORIES -------- */
      const calStr = await AsyncStorage.getItem("CALORIES_DATA_V2");
      const calHistory = calStr ? JSON.parse(calStr).history || [] : [];

      const caloriesArr: number[] = [];
      let caloriesTotal = 0;

      days.forEach(d => {
        const dayTotal = calHistory
          .filter((e: any) => e.date === d.date)
          .reduce((s: number, e: any) => s + e.calories, 0);

        caloriesArr.push(dayTotal);
        caloriesTotal += dayTotal;
      });

      /* -------- WATER -------- */
      const waterStr = await AsyncStorage.getItem("BF_WATER_WEEKLY");
      const waterWeekly = waterStr ? JSON.parse(waterStr) : [];

      const waterArr: number[] = [];
      let waterTotal = 0;

      days.forEach(d => {
        const day = waterWeekly.find((w: any) => w.date === d.date);
        const amount = day?.amount || 0;
        waterArr.push(amount);
        waterTotal += amount;
      });

      setData({
        labels: days.map(d => d.label),
        calories: caloriesArr,
        water: waterArr,
        avgCalories: Math.round(caloriesTotal / 7),
        avgWater: Math.round(waterTotal / 7),
      });
    };

    load();
  }, []);

  return data;
};
