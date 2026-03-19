// services/profileApi.ts
// Frontend API service for profile and history

const API_BASE = 'https://fitness-backend-iota.vercel.app/'; // UPDATE THIS!

// ================================
// PROFILE APIs
// ================================

export async function saveProfile(profileData: any) {
  try {

    const payload = {
      userId: profileData.userId,
      name: profileData.name,
      age: profileData.age,
      weight: profileData.weight,
      height: profileData.height,
      gender: profileData.gender,

      targetWeight: profileData.targetWeight,
      timeline: profileData.timeline,
      weeklyWeightLoss: profileData.weeklyWeightLoss,
      dailyDeficit: profileData.dailyDeficit,

      workoutDaysPerWeek: profileData.workoutDaysPerWeek,
      workoutDays: profileData.workoutDays,
      restDays: profileData.restDays,

      waterGoal: profileData.waterGoal,
      bmr: profileData.bmr,
      tdee: profileData.tdee,
      dailyCalorieGoal: profileData.dailyCalorieGoal
    };

    console.log("Saving profile data to backend:", payload);

    const response = await fetch(`${API_BASE}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    console.log("Backend response status:", response.status);
    if (!response.ok) {
      const text = await response.text();
      console.log("Backend error:", text);
      throw new Error("Failed to save profile");
    }

    return await response.json();

  } catch (error) {
    console.error("Save profile error:", error);
    throw error;
  }
}

export async function getProfile(userId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/profile/${userId}`);

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Get profile error:', error);
    throw error;
  }
}

// ================================
// DASHBOARD API
// ================================
export async function getDashboard(userId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/dashboard/${userId}`);

    if (!response.ok) {
      throw new Error('Failed to get dashboard data');
    }

    return await response.json();
  } catch (error) {
    console.error('Dashboard error:', error);
    return null;
  }
}
// ================================
// HISTORY APIs
// ================================

export async function getWorkoutHistory(userId: string, days: number = 7) {
  try {
    const response = await fetch(
      `${API_BASE}/api/history/workouts/${userId}?days=${days}`
    );

    if (!response.ok) {
      throw new Error('Failed to get workout history');
    }

    return await response.json();
  } catch (error) {
    console.error('Workout history error:', error);
    throw error;
  }
}

export async function getFoodHistory(userId: string, days: number = 7) {
  try {
    const response = await fetch(
      `${API_BASE}/api/history/food/${userId}?days=${days}`
    );

    if (!response.ok) {
      throw new Error('Failed to get food history');
    }

    return await response.json();
  } catch (error) {
    console.error('Food history error:', error);
    throw error;
  }
}

export async function getWaterHistory(userId: string, days: number = 7) {
  try {
    const response = await fetch(
      `${API_BASE}/api/history/water/${userId}?days=${days}`
    );

    if (!response.ok) {
      throw new Error('Failed to get water history');
    }

    return await response.json();
  } catch (error) {
    console.error('Water history error:', error);
    throw error;
  }
}

export async function getWeightHistory(userId: string, days: number = 30) {
  try {
    const response = await fetch(
      `${API_BASE}/api/history/weight/${userId}?days=${days}`
    );

    if (!response.ok) {
      throw new Error('Failed to get weight history');
    }

    return await response.json();
  } catch (error) {
    console.error('Weight history error:', error);
    throw error;
  }
}

export async function logWeight(userId: string, weight: number, notes?: string) {
  try {
    const response = await fetch(`${API_BASE}/api/history/weight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, weight, notes }),
    });

    if (!response.ok) {
      throw new Error('Failed to log weight');
    }

    return await response.json();
  } catch (error) {
    console.error('Log weight error:', error);
    throw error;
  }
}

export async function getWeeklySummary(userId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/history/weekly/${userId}`);

    if (!response.ok) {
      throw new Error('Failed to get weekly summary');
    }

    return await response.json();
  } catch (error) {
    console.error('Weekly summary error:', error);
    throw error;
  }
}

// ================================
// SYNC HELPER
// ================================

export async function syncAllData(userId: string) {
  try {
    const [profile, dashboard, workouts, foodLogs, water, weight] = await Promise.all([
      getProfile(userId),
      getDashboard(userId),
      getWorkoutHistory(userId, 7),
      getFoodHistory(userId, 7),
      getWaterHistory(userId, 7),
      getWeightHistory(userId, 30),
    ]);

    return {
      profile,
      dashboard,
      workouts,
      foodLogs,
      water,
      weight,
    };
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}
