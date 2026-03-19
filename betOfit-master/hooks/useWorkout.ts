// hooks/useWorkoutTracking.ts
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WorkoutSet {
  weight: number;
  reps: number;
  completed: boolean;
  restTime: number; // in seconds
}

interface WorkoutExercise {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  type: string;
  sets: WorkoutSet[];
  completed: boolean;
  notes: string;
}

interface WorkoutSession {
  id: string;
  date: string;
  workoutName: string;
  duration: number; // in minutes
  exercises: WorkoutExercise[];
  caloriesBurned: number;
  notes: string;
  volume: number;
  muscleGroups: string[];
}

interface DailySummary {
  date: string;
  totalCaloriesBurned: number;
  totalCaloriesConsumed: number;
  netCalories: number;
  totalVolume: number;
  workoutsCompleted: number;
  workoutSessions: WorkoutSession[];
}

interface NutritionLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  timestamp: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

// Fallback MET values for calorie calculation
const getMetForActivity = (activity: string) => {
  const metMap: Record<string, number> = {
    'running': 8.0,
    'cycling': 7.5,
    'swimming': 6.0,
    'weight lifting': 6.0,
    'yoga': 3.0,
    'walking': 3.5,
    'cardio': 7.0,
    'strength training': 6.0,
    'hiit': 8.5,
  };
  return metMap[activity.toLowerCase()] || 5.0;
};

export const useWorkoutTracking = () => {
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
  const [userWeight, setUserWeight] = useState<number>(70); // Default 70kg
  const [isLoading, setIsLoading] = useState(true);

  // Load saved data
  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      setIsLoading(true);
      const [savedSessions, savedNutrition, savedWeight, savedSummary] = await Promise.all([
        AsyncStorage.getItem('workout_sessions'),
        AsyncStorage.getItem('nutrition_logs'),
        AsyncStorage.getItem('user_weight'),
        AsyncStorage.getItem('daily_summary'),
      ]);

      if (savedSessions) setSessions(JSON.parse(savedSessions));
      if (savedNutrition) setNutritionLogs(JSON.parse(savedNutrition));
      if (savedWeight) setUserWeight(parseFloat(savedWeight));
      if (savedSummary) setDailySummary(JSON.parse(savedSummary));
      
      // Calculate today's summary if not exists
      if (!savedSummary) {
        calculateDailySummary();
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a new workout session
  const startWorkoutSession = (workoutName: string, muscleGroups: string[]) => {
    // Create basic exercises based on muscle groups
    const exercises: WorkoutExercise[] = muscleGroups.map((muscle, index) => ({
      id: `exercise_${Date.now()}_${index}`,
      name: getDefaultExerciseForMuscle(muscle),
      muscle: muscle,
      equipment: 'Barbell/Dumbbell',
      type: 'strength',
      sets: [
        { weight: 0, reps: 10, completed: false, restTime: 60 },
        { weight: 0, reps: 10, completed: false, restTime: 60 },
        { weight: 0, reps: 10, completed: false, restTime: 60 },
      ],
      completed: false,
      notes: '',
    }));

    const newSession: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      workoutName,
      duration: 0,
      exercises,
      caloriesBurned: 0,
      notes: '',
      volume: 0,
      muscleGroups,
    };

    setActiveSession(newSession);
    return newSession;
  };

  // Helper function to get default exercise for muscle group
  const getDefaultExerciseForMuscle = (muscle: string): string => {
    const exercises: Record<string, string> = {
      'chest': 'Bench Press',
      'back': 'Pull-ups',
      'legs': 'Squats',
      'shoulders': 'Overhead Press',
      'arms': 'Bicep Curls',
      'core': 'Plank',
      'biceps': 'Bicep Curls',
      'triceps': 'Tricep Dips',
      'glutes': 'Hip Thrusts',
      'hamstrings': 'Romanian Deadlifts',
      'quadriceps': 'Leg Press',
      'calves': 'Calf Raises',
    };
    return exercises[muscle.toLowerCase()] || 'General Exercise';
  };

  // Update exercise set
  const updateExerciseSet = (
    exerciseId: string,
    setIndex: number,
    updates: Partial<WorkoutSet>
  ) => {
    if (!activeSession) return;

    const updatedExercises = activeSession.exercises.map(exercise => {
      if (exercise.id === exerciseId) {
        const updatedSets = [...exercise.sets];
        updatedSets[setIndex] = {
          ...updatedSets[setIndex],
          ...updates,
          completed: updates.weight !== undefined && updates.reps !== undefined,
        };
        return { ...exercise, sets: updatedSets };
      }
      return exercise;
    });

    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  // Add new set to exercise
  const addSetToExercise = (exerciseId: string) => {
    if (!activeSession) return;

    const updatedExercises = activeSession.exercises.map(exercise => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            { weight: 0, reps: 10, completed: false, restTime: 60 }
          ],
        };
      }
      return exercise;
    });

    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  // Remove set from exercise
  const removeSetFromExercise = (exerciseId: string, setIndex: number) => {
    if (!activeSession) return;

    const updatedExercises = activeSession.exercises.map(exercise => {
      if (exercise.id === exerciseId) {
        const updatedSets = exercise.sets.filter((_, index) => index !== setIndex);
        return { ...exercise, sets: updatedSets };
      }
      return exercise;
    });

    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  // Complete exercise
  const completeExercise = (exerciseId: string) => {
    if (!activeSession) return;

    const updatedExercises = activeSession.exercises.map(exercise => 
      exercise.id === exerciseId 
        ? { ...exercise, completed: true }
        : exercise
    );

    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  // Finish workout session with calorie calculation
  const finishWorkoutSession = async (notes?: string) => {
    if (!activeSession) return;

    const endTime = new Date();
    const startTime = new Date(activeSession.date);
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Calculate total volume
    let totalVolume = 0;
    const completedExercises = activeSession.exercises.filter(ex => ex.completed);
    
    completedExercises.forEach(exercise => {
      exercise.sets.forEach(set => {
        if (set.completed && set.weight > 0 && set.reps > 0) {
          totalVolume += set.weight * set.reps;
        }
      });
    });

    // Calculate calories burned (simplified formula)
    const met = getMetForActivity('strength training');
    const caloriesBurned = Math.round(met * userWeight * (duration / 60));

    const completedSession: WorkoutSession = {
      ...activeSession,
      duration,
      volume: totalVolume,
      caloriesBurned,
      notes: notes || activeSession.notes,
    };

    const updatedSessions = [completedSession, ...sessions];
    setSessions(updatedSessions);
    setActiveSession(null);

    // Save to storage
    await Promise.all([
      AsyncStorage.setItem('workout_sessions', JSON.stringify(updatedSessions)),
      AsyncStorage.setItem('last_workout_date', new Date().toISOString()),
    ]);
    
    // Update daily summary
    await calculateDailySummary();

    return completedSession;
  };

  // Calculate daily summary
  const calculateDailySummary = async () => {
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.filter(session => 
      session.date.startsWith(today)
    );
    
    const todayNutrition = nutritionLogs.filter(log => 
      log.timestamp.startsWith(today)
    );

    const totalCaloriesBurned = todaySessions.reduce(
      (sum, session) => sum + session.caloriesBurned, 0
    );
    
    const totalCaloriesConsumed = todayNutrition.reduce(
      (sum, log) => sum + log.calories, 0
    );

    const totalVolume = todaySessions.reduce(
      (sum, session) => sum + session.volume, 0
    );

    const summary: DailySummary = {
      date: today,
      totalCaloriesBurned,
      totalCaloriesConsumed,
      netCalories: totalCaloriesConsumed - totalCaloriesBurned,
      totalVolume,
      workoutsCompleted: todaySessions.length,
      workoutSessions: todaySessions,
    };

    setDailySummary(summary);
    await AsyncStorage.setItem('daily_summary', JSON.stringify(summary));
    return summary;
  };

  // Nutrition Logging Functions
  const addNutritionLog = async (log: Omit<NutritionLog, 'id' | 'timestamp'>) => {
    const newLog: NutritionLog = {
      ...log,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };

    const updatedLogs = [newLog, ...nutritionLogs];
    setNutritionLogs(updatedLogs);
    
    await AsyncStorage.setItem('nutrition_logs', JSON.stringify(updatedLogs));
    await calculateDailySummary();
    
    return newLog;
  };

  const removeNutritionLog = async (logId: string) => {
    const updatedLogs = nutritionLogs.filter(log => log.id !== logId);
    setNutritionLogs(updatedLogs);
    
    await AsyncStorage.setItem('nutrition_logs', JSON.stringify(updatedLogs));
    await calculateDailySummary();
  };

  const updateUserWeight = async (weight: number) => {
    setUserWeight(weight);
    await AsyncStorage.setItem('user_weight', weight.toString());
  };

  // Get statistics
  const getWeeklyStats = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklySessions = sessions.filter(session => 
      new Date(session.date) >= oneWeekAgo
    );

    const totalCaloriesBurned = weeklySessions.reduce(
      (sum, session) => sum + session.caloriesBurned, 0
    );
    
    const totalVolume = weeklySessions.reduce(
      (sum, session) => sum + session.volume, 0
    );

    const muscleFrequency: Record<string, number> = {};
    weeklySessions.forEach(session => {
      session.muscleGroups.forEach(muscle => {
        muscleFrequency[muscle] = (muscleFrequency[muscle] || 0) + 1;
      });
    });

    return {
      totalSessions: weeklySessions.length,
      totalCaloriesBurned,
      totalVolume,
      muscleFrequency,
      averageDuration: weeklySessions.length > 0
        ? Math.round(weeklySessions.reduce((sum, s) => sum + s.duration, 0) / weeklySessions.length)
        : 0,
    };
  };

  const getProgressChartData = (days: number = 30) => {
    const chartData = [];
    const today = new Date();
    
    // Initialize with empty data for all days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      chartData.push({
        date: dateStr,
        volume: 0,
        caloriesBurned: 0,
        caloriesConsumed: 0,
        workouts: 0,
      });
    }

    // Fill with actual data
    sessions.forEach(session => {
      const sessionDate = session.date.split('T')[0];
      const index = chartData.findIndex(item => item.date === sessionDate);
      if (index !== -1) {
        chartData[index].volume += session.volume;
        chartData[index].caloriesBurned += session.caloriesBurned;
        chartData[index].workouts += 1;
      }
    });

    nutritionLogs.forEach(log => {
      const logDate = log.timestamp.split('T')[0];
      const index = chartData.findIndex(item => item.date === logDate);
      if (index !== -1) {
        chartData[index].caloriesConsumed += log.calories;
      }
    });

    return chartData;
  };

  // Get recent workouts
  const getRecentWorkouts = (limit: number = 5) => {
    return sessions.slice(0, limit);
  };

  // Get today's nutrition logs
  const getTodayNutritionLogs = () => {
    const today = new Date().toISOString().split('T')[0];
    return nutritionLogs.filter(log => log.timestamp.startsWith(today));
  };

  return {
    // State
    activeSession,
    sessions,
    dailySummary,
    nutritionLogs,
    userWeight,
    isLoading,
    
    // Session Management
    startWorkoutSession,
    updateExerciseSet,
    addSetToExercise,
    removeSetFromExercise,
    completeExercise,
    finishWorkoutSession,
    
    // Nutrition Management
    addNutritionLog,
    removeNutritionLog,
    updateUserWeight,
    
    // Analytics
    calculateDailySummary,
    getWeeklyStats,
    getProgressChartData,
    getRecentWorkouts,
    getTodayNutritionLogs,
    
    // Utility
    loadSavedData,
  };
};