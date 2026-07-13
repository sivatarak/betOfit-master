// smartSuggestionEngine.ts
//
// Pure extraction of the "smart suggestion" logic from home.tsx's
// generateSmartSuggestion(). No React, no RN, no Date.now(), no context —
// just plain inputs -> a suggestion object (or null).

export type Suggestion = {
  icon: string;
  title: string;
  message: string;
  suggestion: string;
  action: string | null;
  actionRoute: string | null;
  color: string;
} | null;

export type SuggestionInput = {
  todayName: string;       // e.g. "Monday"
  workoutDays: string[];   // e.g. ["Monday", "Wednesday", "Friday"]
  todayEaten: number;
  adjustedGoal: number;
  todayBurned: number;
};

export function generateSmartSuggestion({
  todayName,
  workoutDays,
  todayEaten,
  adjustedGoal,
  todayBurned,
}: SuggestionInput): Suggestion {
  const isWorkoutDay = workoutDays.includes(todayName);
  const caloriesDiff = todayEaten - adjustedGoal;
  const workedOut = todayBurned > 0;

  if (isWorkoutDay) {
    if (caloriesDiff > 300 && !workedOut) {
      return {
        icon: "🔥",
        title: "Burn Extra Calories!",
        message: `You're ${Math.round(caloriesDiff)} kcal over your goal.`,
        suggestion: "Do a 30-min cardio session to burn ~250 kcal!",
        action: "Start Workout",
        actionRoute: "/(tabs)/workout",
        color: "#F97316",
      };
    }
    if (workedOut && caloriesDiff < -300) {
      return {
        icon: "💪",
        title: "Great Workout! Refuel!",
        message: `You're ${Math.abs(Math.round(caloriesDiff))} kcal under.`,
        suggestion: "Have a protein shake or healthy meal to recover!",
        action: "Log Food",
        actionRoute: "/(tabs)/calories",
        color: "#3B82F6",
      };
    }
    if (workedOut && Math.abs(caloriesDiff) < 200) {
      return {
        icon: "✅",
        title: "Perfect Balance!",
        message: "You hit your goals today!",
        suggestion: "Keep up the amazing work! 🎉",
        action: null,
        actionRoute: null,
        color: "#10B981",
      };
    }
    if (!workedOut && Math.abs(caloriesDiff) < 300) {
      return {
        icon: "💪",
        title: "Time for Workout!",
        message: `Today is ${todayName} - a workout day!`,
        suggestion: "Let's crush this workout!",
        action: "Start Workout",
        actionRoute: "/(tabs)/workout",
        color: "#8B5CF6",
      };
    }
    return {
      icon: "👍",
      title: workedOut ? "Nice Work Today" : "Workout Day",
      message: workedOut
        ? "You're close to your calorie goal and got a workout in."
        : `Today is ${todayName} — a scheduled workout day.`,
      suggestion: workedOut
        ? "Keep it up — small consistent days add up!"
        : "Fit in a session when you're ready.",
      action: workedOut ? null : "Start Workout",
      actionRoute: workedOut ? null : "/(tabs)/workout",
      color: "#6366F1",
    };
  }

  if (caloriesDiff > 300) {
    return {
      icon: "😬",
      title: "Rest Day Overeating",
      message: `You're ${Math.round(caloriesDiff)} kcal over.`,
      suggestion: "Try lighter meals tomorrow or add a light walk.",
      action: null,
      actionRoute: null,
      color: "#EF4444",
    };
  }
  return {
    icon: "😌",
    title: "Perfect Rest Day!",
    message: "Your body is recovering well.",
    suggestion: "Stay hydrated and sleep well!",
    action: null,
    actionRoute: null,
    color: "#10B981",
  };
}
