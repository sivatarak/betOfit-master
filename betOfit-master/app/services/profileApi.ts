// services/profileApi.ts
// Frontend API service for profile and history

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL ;

// ================================
// PROFILE APIs
// ================================

// services/profileApi.ts

export async function saveProfile(profileData: any) {
  try {
    console.log("🔵 1. saveProfile called with data:", JSON.stringify(profileData, null, 2));

    const payload = {
      userId: profileData.userId,
      name: profileData.name,
      email: profileData.email,
      age: profileData.age,
      weight: profileData.weight,
      height: profileData.height,
      gender: profileData.gender,
      targetWeight: profileData.targetWeight || null,
      timeline: profileData.timeline || null,
      activityLevel: profileData.activityLevel || 1.55,
      workoutDays: profileData.workoutDays || [],
      workoutDaysPerWeek: profileData.workoutDaysPerWeek || 0,
      dailyCalorieGoal: profileData.dailyCalorieGoal || null,
      waterGoal: profileData.waterGoal || null,
      bmr: profileData.bmr || null,
      tdee: profileData.tdee || null,
      weeklyWeightLoss: profileData.weeklyWeightLoss || null,
      dailyDeficit: profileData.dailyDeficit || null,
      restDays: profileData.restDays || null,
      basic_completed: profileData.basic_completed || false,
      goals_completed: profileData.goals_completed || false,
      workout_completed: profileData.workout_completed || false,
    };

    console.log("🔵 2. Sending payload to backend:", JSON.stringify(payload, null, 2));
    console.log("🔵 3. API URL:", `${API_BASE}/api/profile`);

    const response = await fetch(`${API_BASE}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("🔵 4. Response status:", response.status);
    console.log("🔵 5. Response ok:", response.ok);

    if (!response.ok) {
      const text = await response.text();
      console.log("🔴 6. Backend error response:", text);
      throw new Error("Failed to save profile");
    }

    const responseData = await response.json();
    console.log("🟢 7. Backend success response:", JSON.stringify(responseData, null, 2));
    
    return responseData;

  } catch (error) {
    console.error("🔴 8. Save profile error:", error);
    throw error;
  }
}

export async function getProfile(userId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/profile/${userId}`);

    // If 404, return null (no profile found)
    if (response.status === 404) {
      console.log('📝 No profile found in database');
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Get profile error:', error);
    // Return null instead of throwing
    return null;
  }
}

// Add this to app/services/profileApi.ts

export async function getStats(userId: string, period: 'week' | 'month' | 'year' = 'week') {
  try {
    console.log(`📊 Fetching stats for ${userId}, period: ${period}`);

    const response = await fetch(
      `${API_BASE}/api/stats/${userId}?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const rawBody = await response.text();
    const responseData = rawBody ? JSON.parse(rawBody) : null;

    if (response.status === 404) {
      console.log(`📝 No stats found for ${userId} period=${period}`);
      return null;
    }

    if (!response.ok) {
      const errorMessage = responseData?.error || rawBody || 'Failed to fetch stats';
      throw new Error(errorMessage);
    }

    console.log('✅ Stats fetched successfully', responseData);
    return responseData;
  } catch (error) {
    console.error('❌ Get stats error:', error);
    throw error;
  }
}
// ================================
// DASHBOARD API
// ================================
export async function getDashboard(userId: string) {
  try {
    console.log('📡 Fetching dashboard for userId:', userId);
    console.log('🔗 URL:', `${API_BASE}/api/dashboard/${userId}`);

    const response = await fetch(`${API_BASE}/api/dashboard/${userId}`);

    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response body:', errorText);
      throw new Error('Failed to get dashboard data');
    }

    const data = await response.json();
    console.log('✅ Dashboard data received:', data);
    return data;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Dashboard error:', message);
    console.error('❌ Full error:', error);
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
