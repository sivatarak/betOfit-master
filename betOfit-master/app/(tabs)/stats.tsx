// app/(tabs)/stats.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    StatusBar,
    SafeAreaView,
    Platform,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Svg, Circle, Path, Line, Rect, G, Text as SvgText } from "react-native-svg";
import { BlurView } from "expo-blur";
import { useTheme } from "../../context/themecontext";
import { CustomLoader } from '../../components/CustomLoader';
const { width } = Dimensions.get("window");

// Types
interface WorkoutLog {
    id: string;
    exerciseName: string;
    date: string;
    duration: number;
    caloriesBurned: number;
    sets?: number;
    reps?: number;
}

interface UserProfile {
    weight: number;
    height: number;
    age: number;
    gender: 'male' | 'female';
    targetWeight: number;
    name: string;
    initialWeight?: number;
}

interface ExerciseStat {
    name: string;
    sets: number;
    totalVolume?: number;
}

type PeriodType = 'week' | 'month' | 'year';

export default function StatsScreen() {
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';

    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
    const [userName, setUserName] = useState('Alex');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Weight Progress
    const [currentWeight, setCurrentWeight] = useState(78);
    const [targetWeight, setTargetWeight] = useState(75);
    const [initialWeight, setInitialWeight] = useState(82);

    // Stats Data
    const [totalCalories, setTotalCalories] = useState(0);
    const [totalActiveMinutes, setTotalActiveMinutes] = useState(0);
    const [totalWater, setTotalWater] = useState(0);

    // Weekly Data for Charts
    const [weeklyCalories, setWeeklyCalories] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [weeklyWorkouts, setWeeklyWorkouts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [weeklyWater, setWeeklyWater] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [weekLabels, setWeekLabels] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

    // Quick Stats
    const [workoutDaysThisWeek, setWorkoutDaysThisWeek] = useState(0);
    const [restDaysThisWeek, setRestDaysThisWeek] = useState(0);
    const [totalWaterThisWeek, setTotalWaterThisWeek] = useState(0);

    // Top Exercises
    const [topExercises, setTopExercises] = useState<ExerciseStat[]>([]);

    // Streaks
    const [workoutStreak, setWorkoutStreak] = useState(0);
    const [waterStreak, setWaterStreak] = useState(0);
    const [calorieStreak, setCalorieStreak] = useState(0);

    // Trend percentage
    const [trendPercentage, setTrendPercentage] = useState(12);

    const [loading, setLoading] = useState(true);

    // Calculated values
    const weightLost = initialWeight - currentWeight;
    const weightToGo = currentWeight - targetWeight;
    const progressPercentage = Math.min(100, Math.max(0, ((initialWeight - currentWeight) / (initialWeight - targetWeight)) * 100));
    const weeksToGoal = weightToGo > 0 ? Math.round(weightToGo / 0.5) : 0;

    const loadStatsData = useCallback(async () => {
        try {
            // Load user profile
            const profileStr = await AsyncStorage.getItem('USER_PROFILE');
            if (profileStr) {
                const profile = JSON.parse(profileStr);
                setUserProfile(profile);
                setCurrentWeight(profile.weight || 78);
                setTargetWeight(profile.targetWeight || 75);
                setUserName(profile.name || 'Alex');
                setInitialWeight(profile.initialWeight || profile.weight || 82);
            } else {
                const name = await AsyncStorage.getItem('USER_NAME');
                if (name) setUserName(name);
                const weight = await AsyncStorage.getItem('BF_WEIGHT_KG');
                if (weight) setCurrentWeight(parseFloat(weight));
            }

            const now = new Date();
            let startDate = new Date();

            if (selectedPeriod === 'week') {
                startDate.setDate(now.getDate() - 7);
            } else if (selectedPeriod === 'month') {
                startDate.setMonth(now.getMonth() - 1);
            } else if (selectedPeriod === 'year') {
                startDate.setFullYear(now.getFullYear() - 1);
            }

            // Load workout history
            const historyStr = await AsyncStorage.getItem('WORKOUT_HISTORY');
            if (historyStr) {
                const history: WorkoutLog[] = JSON.parse(historyStr);

                const filtered = history.filter(item => new Date(item.date) >= startDate);

                const totalCals = filtered.reduce((sum, item) => sum + (item.caloriesBurned || 0), 0);
                const totalMins = filtered.reduce((sum, item) => sum + (item.duration || 0), 0);

                setTotalCalories(totalCals);
                setTotalActiveMinutes(totalMins);

                // Calculate weekly data
                const weeklyCals: number[] = [];
                const weeklyMins: number[] = [];

                // Get last 7 days
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toISOString().split('T')[0];

                    const dayWorkouts = history.filter(w => w.date === dateStr);
                    const dayCals = dayWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
                    const dayMins = dayWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);

                    weeklyCals.push(dayCals);
                    weeklyMins.push(dayMins);
                }

                setWeeklyCalories(weeklyCals);
                setWeeklyWorkouts(weeklyMins);

                // Calculate workout days this week
                const workoutDaysSet = new Set();
                history.filter(w => {
                    const workoutDate = new Date(w.date);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return workoutDate >= weekAgo;
                }).forEach(w => workoutDaysSet.add(w.date));

                const workoutDays = workoutDaysSet.size;
                setWorkoutDaysThisWeek(workoutDays);
                setRestDaysThisWeek(7 - workoutDays);

                // Calculate top exercises
                const exerciseMap = new Map<string, number>();
                history.filter(w => {
                    const workoutDate = new Date(w.date);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return workoutDate >= weekAgo;
                }).forEach(w => {
                    const count = exerciseMap.get(w.exerciseName) || 0;
                    exerciseMap.set(w.exerciseName, count + (w.sets || 1));
                });

                const sortedExercises = Array.from(exerciseMap.entries())
                    .map(([name, sets]) => ({ name, sets }))
                    .sort((a, b) => b.sets - a.sets)
                    .slice(0, 5);

                setTopExercises(sortedExercises);

                // Calculate workout streak
                let streak = 0;
                let checkDate = new Date();
                checkDate.setHours(0, 0, 0, 0);

                while (true) {
                    const dateStr = checkDate.toISOString().split('T')[0];
                    const hasWorkout = history.some(w => w.date === dateStr);
                    if (hasWorkout) {
                        streak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    } else {
                        break;
                    }
                }
                setWorkoutStreak(streak);

                // Calculate trend
                if (filtered.length > 1) {
                    const mid = Math.floor(filtered.length / 2);
                    const firstHalf = filtered.slice(0, mid);
                    const secondHalf = filtered.slice(mid);

                    const firstAvg = firstHalf.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0) / (firstHalf.length || 1);
                    const secondAvg = secondHalf.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0) / (secondHalf.length || 1);

                    if (firstAvg > 0) {
                        const trend = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
                        setTrendPercentage(trend);
                    }
                }
            }

            // Load water data
            const waterHistoryStr = await AsyncStorage.getItem('WATER_HISTORY');
            if (waterHistoryStr) {
                const waterHistory = JSON.parse(waterHistoryStr);
                const weeklyWaterData: number[] = [];
                let totalWaterWeekly = 0;

                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toISOString().split('T')[0];

                    const dayWater = waterHistory.filter((w: any) => w.date === dateStr)
                        .reduce((sum: number, w: any) => sum + (w.ml || 0), 0);
                    weeklyWaterData.push(dayWater / 1000);
                    totalWaterWeekly += dayWater;
                }

                setWeeklyWater(weeklyWaterData);
                setTotalWaterThisWeek(totalWaterWeekly / 1000);
                setTotalWater(totalWaterWeekly / 1000);
            }

            // Load calorie streak
            const calDataStr = await AsyncStorage.getItem('CALORIES_DATA_V2');
            if (calDataStr) {
                const calData = JSON.parse(calDataStr);
                setCalorieStreak(calData.streak || 0);
            }

            setWaterStreak(workoutStreak - 2 > 0 ? workoutStreak - 2 : 3);

        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, workoutStreak]);

    useEffect(() => {
        loadStatsData();
    }, [loadStatsData]);

    useFocusEffect(
        useCallback(() => {
            loadStatsData();
        }, [loadStatsData])
    );

    // Bar chart component
    const BarChart = ({ data, color, maxValue, height = 100 }: { data: number[]; color: string; maxValue: number; height?: number }) => {
        const maxDataValue = Math.max(...data, maxValue);
        const barWidth = (width - 80) / 7 - 8;

        return (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height, marginVertical: 10 }}>
                {data.map((value, index) => {
                    const barHeight = (value / maxDataValue) * (height - 20);
                    return (
                        <View key={index} style={{ alignItems: 'center', width: barWidth }}>
                            <LinearGradient
                                colors={[color, color + 'cc']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 0, y: 0 }}
                                style={{ height: barHeight, width: barWidth - 4, borderRadius: 6 }}
                            />
                            <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{weekLabels[index]}</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    // Line chart component for calories
    const LineChart = ({ data, color, maxValue }: { data: number[]; color: string; maxValue: number }) => {
        const maxDataValue = Math.max(...data, maxValue);
        const chartWidth = width - 60;
        const stepX = chartWidth / 6;

        const points = data.map((value, index) => {
            const x = 20 + (index * stepX);
            const y = 100 - (value / maxDataValue) * 80;
            return `${x},${y}`;
        }).join(' ');

        return (
            <View style={{ height: 120, marginVertical: 10 }}>
                <Svg width="100%" height="100%" viewBox={`0 0 ${width - 40} 110`}>
                    {/* Grid lines */}
                    <Line x1="10" y1="20" x2={width - 50} y2="20" stroke={colors.border} strokeWidth="1" />
                    <Line x1="10" y1="50" x2={width - 50} y2="50" stroke={colors.border} strokeWidth="1" />
                    <Line x1="10" y1="80" x2={width - 50} y2="80" stroke={colors.border} strokeWidth="1" />

                    {/* Gradient Line */}
                    <Path
                        d={`M ${points}`}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />

                    {/* Dots */}
                    {data.map((value, index) => {
                        const x = 20 + (index * stepX);
                        const y = 100 - (value / maxDataValue) * 80;
                        return (
                            <Circle key={index} cx={x} cy={y} r="4" fill={color} />
                        );
                    })}
                </Svg>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 10 }}>
                    {weekLabels.map((label, i) => (
                        <Text key={i} style={[styles.chartLabel, { color: colors.textSecondary }]}>{label}</Text>
                    ))}
                </View>
            </View>
        );
    };

    // if (loading) {
    //     return (
    //         <CustomLoader
    //             fullScreen={true}
    //         />
    //     );
    // }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={isDark ? ['#1a1a2e', '#16213e'] : [colors.background, colors.card]}
                style={StyleSheet.absoluteFill}
            />

            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Your Progress</Text>
                    <TouchableOpacity style={styles.headerIcon}>
                        <Ionicons name="settings-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                </BlurView>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Time Period Selector */}
                    <View style={[styles.periodSelector, { backgroundColor: colors.primaryContainerLow, borderColor: colors.border }]}>
                        <TouchableOpacity
                            style={[styles.periodButton, selectedPeriod === 'week' && [styles.periodButtonActive, { backgroundColor: colors.primary, shadowColor: colors.primary }]]}
                            onPress={() => setSelectedPeriod('week')}
                        >
                            <Text style={[styles.periodText, { color: colors.textSecondary }, selectedPeriod === 'week' && { color: colors.background, fontWeight: '700' }]}>Week</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.periodButton, selectedPeriod === 'month' && [styles.periodButtonActive, { backgroundColor: colors.primary, shadowColor: colors.primary }]]}
                            onPress={() => setSelectedPeriod('month')}
                        >
                            <Text style={[styles.periodText, { color: colors.textSecondary }, selectedPeriod === 'month' && { color: colors.background, fontWeight: '700' }]}>Month</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.periodButton, selectedPeriod === 'year' && [styles.periodButtonActive, { backgroundColor: colors.primary, shadowColor: colors.primary }]]}
                            onPress={() => setSelectedPeriod('year')}
                        >
                            <Text style={[styles.periodText, { color: colors.textSecondary }, selectedPeriod === 'year' && { color: colors.background, fontWeight: '700' }]}>Year</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Weight Progress Card - MOST IMPORTANT */}
                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.weightCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                        <LinearGradient
                            colors={[colors.primary + '20', colors.primary + '05']}
                            style={styles.weightCardGradient}
                        />
                        <View style={styles.weightCardHeader}>
                            <View>
                                <Text style={[styles.weightCardTitle, { color: colors.text }]}>Weight Progress</Text>
                                <Text style={[styles.weightCardSubtitle, { color: colors.textSecondary }]}>Target: {targetWeight} kg</Text>
                            </View>
                            <Ionicons name="trending-down" size={28} color={colors.primary} />
                        </View>

                        <View style={styles.weightRow}>
                            <Text style={[styles.currentWeight, { color: colors.primary }]}>{currentWeight} kg</Text>
                            <Text style={[styles.goalWeight, { color: colors.textSecondary }]}>→ {targetWeight} kg</Text>
                        </View>

                        {/* Progress Bar */}
                        <View style={[styles.progressBarContainer, { backgroundColor: colors.primaryContainerHigh }]}>
                            <LinearGradient
                                colors={[colors.primary, colors.primary + 'cc']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.progressBar, { width: `${progressPercentage}%` }]}
                            />
                        </View>

                        <View style={styles.weightStats}>
                            <View style={styles.weightStat}>
                                <Text style={[styles.weightStatLabel, { color: colors.textSecondary }]}>Lost</Text>
                                <Text style={[styles.weightStatValue, { color: colors.text }]}>{weightLost > 0 ? weightLost : 0} kg</Text>
                            </View>
                            <View style={styles.weightStat}>
                                <Text style={[styles.weightStatLabel, { color: colors.textSecondary }]}>To Go</Text>
                                <Text style={[styles.weightStatValue, { color: colors.text }]}>{weightToGo > 0 ? weightToGo : 0} kg</Text>
                            </View>
                            <View style={styles.weightStat}>
                                <Text style={[styles.weightStatLabel, { color: colors.textSecondary }]}>Est. Completion</Text>
                                <Text style={[styles.weightStatValue, { color: colors.text }]}>{weeksToGoal > 0 ? weeksToGoal : 0} weeks</Text>
                            </View>
                        </View>
                    </BlurView>

                    {/* Quick Stats Grid (2x2) */}
                    <View style={styles.quickStatsGrid}>
                        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.quickStatCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                            <Ionicons name="calendar-outline" size={28} color={colors.primary} />
                            <Text style={[styles.quickStatValue, { color: colors.text }]}>{workoutDaysThisWeek}</Text>
                            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Workout Days</Text>
                        </BlurView>

                        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.quickStatCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                            <Ionicons name="bed-outline" size={28} color={colors.textSecondary} />
                            <Text style={[styles.quickStatValue, { color: colors.text }]}>{restDaysThisWeek}</Text>
                            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Rest Days</Text>
                        </BlurView>

                        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.quickStatCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                            <Ionicons name="flame-outline" size={28} color={colors.primary} />
                            <Text style={[styles.quickStatValue, { color: colors.text }]}>{totalCalories.toLocaleString()}</Text>
                            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Calories Burned</Text>
                        </BlurView>

                        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.quickStatCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                            <Ionicons name="water-outline" size={28} color="#3B82F6" />
                            <Text style={[styles.quickStatValue, { color: colors.text }]}>{totalWaterThisWeek.toFixed(1)}L</Text>
                            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Water Drunk</Text>
                        </BlurView>
                    </View>

                    {/* Calories Chart */}
                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.chartCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                        <View style={styles.chartHeader}>
                            <Text style={[styles.chartTitle, { color: colors.text }]}>🍽️ Calories Eaten</Text>
                            <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Daily intake trend</Text>
                        </View>
                        <LineChart data={weeklyCalories} color={colors.primary} maxValue={3000} />
                        <Text style={[styles.chartAvg, { color: colors.textSecondary }]}>Avg: {Math.round(weeklyCalories.reduce((a, b) => a + b, 0) / 7)} kcal/day</Text>
                    </BlurView>

                    {/* Workout Minutes Chart */}
                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.chartCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                        <View style={styles.chartHeader}>
                            <Text style={[styles.chartTitle, { color: colors.text }]}>💪 Workout Minutes</Text>
                            <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Daily activity</Text>
                        </View>
                        <BarChart data={weeklyWorkouts} color="#10B981" maxValue={120} height={100} />
                        <Text style={[styles.chartAvg, { color: colors.textSecondary }]}>Total: {weeklyWorkouts.reduce((a, b) => a + b, 0)} min this week</Text>
                    </BlurView>

                    {/* Water Intake Chart */}
                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.chartCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                        <View style={styles.chartHeader}>
                            <Text style={[styles.chartTitle, { color: colors.text }]}>💧 Water Intake</Text>
                            <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Daily hydration</Text>
                        </View>
                        <BarChart data={weeklyWater} color="#3B82F6" maxValue={4} height={100} />
                        <Text style={[styles.chartAvg, { color: colors.textSecondary }]}>Avg: {(weeklyWater.reduce((a, b) => a + b, 0) / 7).toFixed(1)} L/day</Text>
                    </BlurView>

                    {/* Top Exercises */}
                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.exercisesCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>🏆 Top Exercises This Week</Text>
                        {topExercises.length > 0 ? (
                            topExercises.map((exercise, index) => (
                                <View key={index} style={[styles.exerciseItem, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.exerciseRank, { color: colors.primary }]}>{index + 1}</Text>
                                    <Text style={[styles.exerciseName, { color: colors.text }]}>{exercise.name}</Text>
                                    <Text style={[styles.exerciseSets, { color: colors.textSecondary }]}>{exercise.sets} sets</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={[styles.noDataText, { color: colors.textSecondary }]}>No workouts logged this week</Text>
                        )}
                    </BlurView>

                    {/* Streaks & Achievements */}
                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.streaksCard, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>🔥 Current Streaks</Text>

                        <View style={[styles.streakItem, { borderBottomColor: colors.border }]}>
                            <View style={[styles.streakIcon, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name="fitness" size={24} color={colors.primary} />
                            </View>
                            <View style={styles.streakInfo}>
                                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Workout Streak</Text>
                                <Text style={[styles.streakValue, { color: colors.text }]}>{workoutStreak} days</Text>
                            </View>
                        </View>

                        <View style={[styles.streakItem, { borderBottomColor: colors.border }]}>
                            <View style={[styles.streakIcon, { backgroundColor: '#3B82F615' }]}>
                                <Ionicons name="water" size={24} color="#3B82F6" />
                            </View>
                            <View style={styles.streakInfo}>
                                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Water Goal Streak</Text>
                                <Text style={[styles.streakValue, { color: colors.text }]}>{waterStreak} days</Text>
                            </View>
                        </View>

                        <View style={[styles.streakItem, { borderBottomColor: colors.border }]}>
                            <View style={[styles.streakIcon, { backgroundColor: '#10B98115' }]}>
                                <Ionicons name="restaurant" size={24} color="#10B981" />
                            </View>
                            <View style={styles.streakInfo}>
                                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Calorie Goal Streak</Text>
                                <Text style={[styles.streakValue, { color: colors.text }]}>{calorieStreak} days</Text>
                            </View>
                        </View>
                    </BlurView>

                    {/* Trend Badge */}
                    <View style={styles.trendContainer}>
                        <LinearGradient
                            colors={[colors.primary + '15', colors.primary + '05']}
                            style={[styles.trendBadgeLarge, { backgroundColor: 'transparent' }]}
                        >
                            <Ionicons
                                name={trendPercentage >= 0 ? 'trending-up' : 'trending-down'}
                                size={16}
                                color={colors.primary}
                            />
                            <Text style={[styles.trendTextLarge, { color: colors.textSecondary }]}>
                                {trendPercentage >= 0 ? '+' : ''}{trendPercentage}% vs last {selectedPeriod}
                            </Text>
                        </LinearGradient>
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </SafeAreaView>

            {/* Bottom Navigation */}
            <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={[styles.bottomNav, { borderTopColor: colors.border, backgroundColor: isDark ? 'rgba(30,30,40,0.95)' : 'rgba(255,255,255,0.95)' }]}>
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.push('/(tabs)/home')}
                >
                    <Ionicons name="home-outline" size={24} color={colors.textSecondary} />
                    <Text style={[styles.navText, { color: colors.textSecondary }]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem}>
                    <Ionicons name="bar-chart" size={24} color={colors.primary} />
                    <Text style={[styles.navText, { color: colors.primary }]}>Stats</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => Alert.alert('Coming Soon', 'History page coming soon!')}
                >
                    <Ionicons name="time-outline" size={24} color={colors.textSecondary} />
                    <Text style={[styles.navText, { color: colors.textSecondary }]}>History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.push('/(auth)/profile-setup?mode=all')}
                >
                    <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
                    <Text style={[styles.navText, { color: colors.textSecondary }]}>Profile</Text>
                </TouchableOpacity>
            </BlurView>
             {loading && <CustomLoader fullScreen />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 24 : 0,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 107, 74, 0.1)',
    },
    headerIcon: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
    },

    // Period Selector
    periodSelector: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
        borderWidth: 1,
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    periodButtonActive: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    periodText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Weight Card
    weightCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    weightCardGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    weightCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    weightCardTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    weightCardSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    weightRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 16,
    },
    currentWeight: {
        fontSize: 32,
        fontWeight: '800',
    },
    goalWeight: {
        fontSize: 18,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 20,
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    weightStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    weightStat: {
        alignItems: 'center',
    },
    weightStatLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    weightStatValue: {
        fontSize: 16,
        fontWeight: '700',
    },

    // Quick Stats Grid
    quickStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    quickStatCard: {
        width: (width - 44) / 2,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
    },
    quickStatValue: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 8,
    },
    quickStatLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },

    // Chart Card
    chartCard: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    chartHeader: {
        marginBottom: 8,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    chartSubtitle: {
        fontSize: 11,
        marginTop: 2,
    },
    chartLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    chartAvg: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
    },
    barLabel: {
        fontSize: 9,
        fontWeight: '500',
        marginTop: 4,
    },

    // Exercises Card
    exercisesCard: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    exerciseRank: {
        width: 28,
        fontSize: 14,
        fontWeight: '700',
    },
    exerciseName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    exerciseSets: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Streaks Card
    streaksCard: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    streakItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    streakIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    streakInfo: {
        flex: 1,
    },
    streakLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    streakValue: {
        fontSize: 18,
        fontWeight: '800',
    },

    // Trend
    trendContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    trendBadgeLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 30,
        gap: 6,
    },
    trendTextLarge: {
        fontSize: 12,
        fontWeight: '600',
    },

    noDataText: {
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 20,
    },

    // Bottom Navigation
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 12,
        borderTopWidth: 1,
        zIndex: 1000,
        elevation: 10,
    },
    navItem: {
        alignItems: 'center',
        gap: 4,
    },
    navText: {
        fontSize: 10,
        fontWeight: '600',
    },
});