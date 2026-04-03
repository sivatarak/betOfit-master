// services/exerciseApi.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const BACKEND_BASE_URL = 'https://fitness-backend-iota.vercel.app/';

// ========================================
// TYPES
// ========================================

export interface Exercise {
  id?: string;
  name: string;
  type: 'strength' | 'cardio' | 'bodyweight' | 'stretching';
  muscle: string;
  equipment: string;
  difficulty: 'beginner' | 'intermediate' | 'expert';
  instructions: string;
  equipments: string[];
  gifUrl?: string;
  target?: string;
  secondaryMuscles?: string[];
}

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  food_id?: string;
  brand_name?: string;
  source?: string;
}

export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  weight: number;
  height: number;
}

// ========================================
// FETCH WITH TIMEOUT
// ========================================

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 15000
): Promise<Response> => {

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// ========================================
// USER PROFILE
// ========================================

const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const profile = await AsyncStorage.getItem('USER_PROFILE');
    return profile ? JSON.parse(profile) : null;
  } catch {
    return null;
  }
};

// ========================================
// EXERCISE API
// ========================================

export const fetchExercisesByMuscle = async (muscle: string): Promise<Exercise[]> => {

  const bodyPartMap: Record<string, string> = {
    abs: "waist",
    arms: "upper arms",
    legs: "upper legs",
    calves: "lower legs",
    biceps: "upper arms",
    triceps: "upper arms"
  };

  const bodyPart = bodyPartMap[muscle] || muscle;

  try {

    const res = await fetch(`${BACKEND_BASE_URL}/api/exercises?bodyPart=${encodeURIComponent(bodyPart)}`);
    console.log(`API CALL: /api/exercises?bodyPart=${encodeURIComponent(bodyPart)} - Status: ${res.status}`);
    if (!res.ok) throw new Error();

    const raw = await res.json();
    console.log("Raw exercise data:", raw);
    return raw.map((ex: any) => ({
      id: ex.id,
      name: ex.name,
      type: ex.exercise_type,
      muscle: ex.body_part,
      equipment: ex.equipment,
      difficulty: ex.difficulty,
      instructions: ex.instructions,
      target: ex.target_muscle,
      secondaryMuscles: ex.secondary_muscles || []
    }));

  } catch {
    return [];
  }
};

// ========================================
// CALORIE CALCULATION
// ========================================

export const calculateCaloriesBurned = async (
  activity: string,
  weight: number,
  duration: number
) => {

  const url =
    `${BACKEND_BASE_URL}/calories-burned?activity=${encodeURIComponent(activity)}&weight=${weight}&duration=${duration}`;

  const res = await fetchWithTimeout(url);

  if (!res.ok) throw new Error("Failed to calculate calories");

  return res.json();
};

// ========================================
// FOOD SEARCH
// ========================================
export const searchFood = async (query: string): Promise<FoodItem[]> => {
  const q = query.trim().toLowerCase();

  if (q.length < 2) return [];

  try {
    const url = `${BACKEND_BASE_URL}/api/food/search?q=${encodeURIComponent(q)}`;

    console.log("Calling API:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    console.log("Response status:", res.status);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    console.log("API DATA:", data);

    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      name: item.name,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
      source: item.source || "api"
    }));

  } catch (error) {
    console.log("Search error:", error);
    return [];
  }
};

// ========================================
// FOOD DETAILS
// ========================================

export const getFoodDetails = async (foodId: string): Promise<FoodItem | null> => {

  try {

    const res = await fetchWithTimeout(
      `${BACKEND_BASE_URL}/api/food/details?food_id=${encodeURIComponent(foodId)}`
    );

    if (!res.ok) throw new Error();

    const data = await res.json();

    return {
      name: data.name || data.food_name,
      calories: Number(data.calories) || 0,
      protein: Number(data.protein) || 0,
      carbs: Number(data.carbs) || 0,
      fat: Number(data.fat) || 0,
      brand_name: data.brand_name,
      source: data.source || "api"
    };

  } catch {
    return null;
  }
};

// ========================================
// FOOD ANALYSIS
// ========================================

export const analyzeFood = async (query: string) => {

  const q = query.trim();

  if (q.length < 2) return null;

  try {

    const res = await fetchWithTimeout(
      `${BACKEND_BASE_URL}/api/food/analyze?q=${encodeURIComponent(q)}`
    );

    if (!res.ok) throw new Error();

    const data = await res.json();

    if (!data || data.error) return null;

    return {
      food: data.food,
      grams: Number(data.grams) || 0,
      calories: Number(data.calories) || 0,
      protein: Number(data.protein) || 0,
      carbs: Number(data.carbs) || 0,
      fat: Number(data.fat) || 0
    };

  } catch {
    return null;
  }
};

// ========================================
// METADATA APIs
// ========================================

export const getMuscleGroups = async (): Promise<string[]> => {

  try {

    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/muscle-groups`);

    if (!res.ok) throw new Error();

    return res.json();

  } catch {

    return [
      'back','cardio','chest','lower arms','lower legs',
      'neck','shoulders','upper arms','upper legs','waist'
    ];
  }
};

export const getEquipmentList = async (): Promise<string[]> => {

  try {

    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/equipment-list`);

    if (!res.ok) throw new Error();

    return res.json();

  } catch {

    return [];
  }
};

// ========================================
// HEALTH CHECK
// ========================================

export const checkServerHealth = async (): Promise<boolean> => {

  try {

    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/`, {}, 5000);

    return res.ok;

  } catch {

    return false;
  }
};

// ========================================
// SAVE PROFILE
// ========================================

export const saveUserProfile = async (profile: UserProfile) => {

  try {

    await AsyncStorage.setItem('USER_PROFILE', JSON.stringify(profile));

    return true;

  } catch {

    return false;
  }
};

// ========================================
// EXPORT
// ========================================

export default {
  fetchExercisesByMuscle,
  calculateCaloriesBurned,
  searchFood,
  getFoodDetails,
  analyzeFood,
  getMuscleGroups,
  getEquipmentList,
  checkServerHealth,
  saveUserProfile
};