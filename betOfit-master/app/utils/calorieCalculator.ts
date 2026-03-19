// app/utils/calorieCalculator.ts

/**
 * Calculate calories for STRENGTH exercises using MET formula
 */
export const calculateStrengthCalories = (
  sets: number,
  reps: number,
  weight: number, // kg lifted
  muscleGroup: string,
  userWeight: number = 70 // Default 70kg, will be dynamic later
): number => {
  // MET values by muscle group
  const MET_VALUES = {
    chest: 6.0,
    back: 5.5,
    legs: 7.0,
    shoulders: 5.0,
    biceps: 4.5,
    triceps: 4.5,
    abs: 4.0,
    'full body': 6.0,
  };

  // Get MET value for this muscle group
  const met = MET_VALUES[muscleGroup as keyof typeof MET_VALUES] || 5.0;
  
  // Calculate time: 2.5 minutes per set (work + rest)
  const totalMinutes = sets * 2.5;
  const hours = totalMinutes / 60;
  
  // MET formula: Calories = MET × weight(kg) × time(hours)
  const calories = Math.round(met * userWeight * hours);
  
  return calories;
};

/**
 * Calculate calories for CARDIO exercises using API
 * This will be called from your store
 */
export const calculateCardioCalories = async (
  activity: string,
  duration: number, // minutes
  userWeight: number = 70
): Promise<number> => {
  try {
    // This will call your backend endpoint
    const response = await fetch(
      `http://YOUR_BACKEND_IP:10000/calories-burned?activity=${activity}&weight=${userWeight}&duration=${duration}`
    );
    const data = await response.json();
    return data[0]?.total_calories || 0;
  } catch (error) {
    console.error('Cardio calorie API error:', error);
    // Fallback calculation
    const met = getCardioMet(activity);
    return Math.round(met * userWeight * (duration / 60));
  }
};

/**
 * Fallback MET values for cardio
 */
const getCardioMet = (activity: string): number => {
  const cardioMet = {
    'running': 8.0,
    'cycling': 7.5,
    'swimming': 6.0,
    'walking': 3.5,
    'jumping rope': 8.5,
    'rowing': 7.0,
  };
  return cardioMet[activity.toLowerCase() as keyof typeof cardioMet] || 5.0;
};

/**
 * Calculate total workout volume
 */
export const calculateVolume = (sets: number, reps: number, weight: number): number => {
  return sets * reps * weight;
};