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
import { Svg, Circle, Path, Line, Polygon, Text as SvgText } from "react-native-svg";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";

const { width } = Dimensions.get("window");

// Types
interface FoodEntry {
    calories: number;
    date: string;
}

interface WorkoutLog {
    id: string;
    exerciseName: string;
    date: string;
    duration: number;
    caloriesBurned: number;
    totalVolume?: number;
}

interface WaterEntry {
    ml: number;
    timestamp: number;
    date: string;
}

interface UserProfile {
    weight: number;
    height: number;
    age: number;
    gender: 'male' | 'female';
    targetWeight: number;
}

interface WeeklyData {
    calories: number[];
    workouts: number[];
    water: number[];
    labels: string[];
}

// Time Period Type
type PeriodType = 'week' | 'month' | 'year';

export default function StatsScreen() {
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month');
    const [userName, setUserName] = useState('Alex');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Stats Data
    const [totalCalories, setTotalCalories] = useState(0);
    const [totalActiveMinutes, setTotalActiveMinutes] = useState(0);
    const [totalSteps, setTotalSteps] = useState(75000); // Mock data - replace with actual step tracking
    const [weeklyData, setWeeklyData] = useState<WeeklyData>({
        calories: [2450, 2100, 2300, 2800, 1900, 2600, 3100],
        workouts: [45, 30, 60, 45, 30, 75, 45],
        water: [2.1, 1.8, 2.5, 2.2, 1.9, 2.8, 3.0],
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    });

    // Body Composition
    const [currentWeight, setCurrentWeight] = useState(78);
    const [bodyFat, setBodyFat] = useState(14);
    const [muscleMass, setMuscleMass] = useState(42);
    const [targetWeight, setTargetWeight] = useState(75);

    // Trend percentage
    const [trendPercentage, setTrendPercentage] = useState(12);

    // Consistency score
    const [consistencyScore, setConsistencyScore] = useState(92);

    const [loading, setLoading] = useState(true);

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
            } else {
                const name = await AsyncStorage.getItem('USER_NAME');
                if (name) setUserName(name);

                const weight = await AsyncStorage.getItem('BF_WEIGHT_KG');
                if (weight) setCurrentWeight(parseFloat(weight));
            }

            // Load workout history
            const historyStr = await AsyncStorage.getItem('WORKOUT_HISTORY');
            if (historyStr) {
                const history: WorkoutLog[] = JSON.parse(historyStr);

                // Calculate totals based on selected period
                const now = new Date();
                let startDate = new Date();

                if (selectedPeriod === 'week') {
                    startDate.setDate(now.getDate() - 7);
                } else if (selectedPeriod === 'month') {
                    startDate.setMonth(now.getMonth() - 1);
                } else if (selectedPeriod === 'year') {
                    startDate.setFullYear(now.getFullYear() - 1);
                }

                const filtered = history.filter(item => new Date(item.date) >= startDate);

                const totalCals = filtered.reduce((sum, item) => sum + (item.caloriesBurned || 0), 0);
                const totalMins = filtered.reduce((sum, item) => sum + (item.duration || 0), 0);

                setTotalCalories(totalCals);
                setTotalActiveMinutes(totalMins);

                // Calculate weekly data for chart
                const weeklyCals: number[] = [];
                const weeklyWorkouts: number[] = [];
                const weeklyWater: number[] = [];

                // Get last 7 days
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toISOString().split('T')[0];

                    const dayWorkouts = history.filter(w => w.date === dateStr);
                    const dayCals = dayWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
                    const dayMins = dayWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);

                    weeklyCals.push(dayCals);
                    weeklyWorkouts.push(dayMins);

                    // Mock water data - replace with actual water tracking
                    weeklyWater.push(Math.round(Math.random() * 1.5 + 1.5) * 10 / 10);
                }

                setWeeklyData({
                    calories: weeklyCals,
                    workouts: weeklyWorkouts,
                    water: weeklyWater,
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                });

                // Calculate trend percentage
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

            // Load calories data for nutrition tracking
            const calDataStr = await AsyncStorage.getItem('CALORIES_DATA_V2');
            if (calDataStr) {
                const calData = JSON.parse(calDataStr);
                // Use for nutrition line in chart if needed
            }

        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        loadStatsData();
    }, [loadStatsData]);

    useFocusEffect(
        useCallback(() => {
            loadStatsData();
        }, [loadStatsData])
    );

    // Calculate max value for chart scaling
    const maxChartValue = Math.max(...weeklyData.calories, ...weeklyData.workouts.map(m => m * 10), 3000);

    // Chart path for activity line
    const getActivityPath = () => {
        const points = weeklyData.calories.map((value, index) => {
            const x = (index / 6) * 380 + 10;
            const y = 120 - (value / maxChartValue) * 100;
            return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(' ');
        return points;
    };

    // Chart path for weight line (mock data - replace with actual)
    const getWeightPath = () => {
        const weightPoints = [currentWeight, currentWeight - 0.5, currentWeight - 1, currentWeight - 1.2, currentWeight - 1.5, currentWeight - 1.8, currentWeight - 2];
        const points = weightPoints.map((value, index) => {
            const x = (index / 6) * 380 + 10;
            const y = 100 - ((value - 70) / 20) * 50;
            return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(' ');
        return points;
    };

    // Chart path for nutrition line (mock data - replace with actual)
    const getNutritionPath = () => {
        const nutritionPoints = [2200, 2100, 2300, 2400, 2100, 2200, 2300];
        const points = nutritionPoints.map((value, index) => {
            const x = (index / 6) * 380 + 10;
            const y = 110 - (value / maxChartValue) * 80;
            return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(' ');
        return points;
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <Text>Loading your stats...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <BlurView intensity={80} tint="light" style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
                        <Ionicons name="arrow-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Activity Analytics</Text>
                    <TouchableOpacity style={styles.headerIcon}>
                        <Ionicons name="notifications-outline" size={24} color="#1F2937" />
                    </TouchableOpacity>
                </BlurView>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Time Period Selector */}
                    <View style={styles.periodSelector}>
                        <TouchableOpacity
                            style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
                            onPress={() => setSelectedPeriod('week')}
                        >
                            <Text style={[styles.periodText, selectedPeriod === 'week' && styles.periodTextActive]}>Week</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
                            onPress={() => setSelectedPeriod('month')}
                        >
                            <Text style={[styles.periodText, selectedPeriod === 'month' && styles.periodTextActive]}>Month</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.periodButton, selectedPeriod === 'year' && styles.periodButtonActive]}
                            onPress={() => setSelectedPeriod('year')}
                        >
                            <Text style={[styles.periodText, selectedPeriod === 'year' && styles.periodTextActive]}>Year</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Activity Summary Card */}
                    <LinearGradient
                        colors={['#FF6B4A', '#FF8F6B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.summaryCard}
                    >
                        <View style={styles.summaryContent}>
                            <Text style={styles.summaryTitle}>Activity Summary</Text>

                            <View style={styles.summaryGrid}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Burned</Text>
                                    <Text style={styles.summaryValue}>{totalCalories.toLocaleString()}</Text>
                                    <Text style={styles.summaryUnit}>KCAL</Text>
                                </View>

                                <View style={[styles.summaryItem, styles.summaryItemBorder]}>
                                    <Text style={styles.summaryLabel}>Active</Text>
                                    <Text style={styles.summaryValue}>{totalActiveMinutes}</Text>
                                    <Text style={styles.summaryUnit}>MINS</Text>
                                </View>

                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Steps</Text>
                                    <Text style={styles.summaryValue}>{(totalSteps / 1000).toFixed(0)}k</Text>
                                    <Text style={styles.summaryUnit}>TOTAL</Text>
                                </View>
                            </View>

                            <View style={styles.summaryFooter}>
                                <View style={styles.trendBadge}>
                                    <Ionicons
                                        name={trendPercentage >= 0 ? 'trending-up' : 'trending-down'}
                                        size={14}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.trendText}>
                                        {trendPercentage >= 0 ? '+' : ''}{trendPercentage}% vs last {selectedPeriod}
                                    </Text>
                                </View>
                                <TouchableOpacity style={styles.detailsButton}>
                                    <Text style={styles.detailsButtonText}>View Details</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Decorative Circle */}
                        <View style={styles.summaryDecoration} />
                    </LinearGradient>

                    {/* Multi-metric Line Chart Trends */}
                    <BlurView intensity={80} tint="light" style={styles.chartCard}>
                        <View style={styles.chartHeader}>
                            <Text style={styles.chartTitle}>Performance Trends</Text>
                            <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
                        </View>

                        <View style={styles.chartContainer}>
                            <Svg width="100%" height={150} viewBox="0 0 400 150">
                                {/* Grid Lines */}
                                <Line x1="10" y1="20" x2="390" y2="20" stroke="#E5E7EB" strokeWidth="1" />
                                <Line x1="10" y1="60" x2="390" y2="60" stroke="#E5E7EB" strokeWidth="1" />
                                <Line x1="10" y1="100" x2="390" y2="100" stroke="#E5E7EB" strokeWidth="1" />

                                {/* Activity Line */}
                                <Path
                                    d={getActivityPath()}
                                    fill="none"
                                    stroke="#FF6B4A"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />

                                {/* Weight Line */}
                                <Path
                                    d={getWeightPath()}
                                    fill="none"
                                    stroke="#94A3B8"
                                    strokeWidth="2"
                                    strokeDasharray="4"
                                />

                                {/* Nutrition Line */}
                                <Path
                                    d={getNutritionPath()}
                                    fill="none"
                                    stroke="#3B82F6"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </Svg>

                            {/* Week Labels */}
                            <View style={styles.chartLabels}>
                                {weeklyData.labels.map((label, index) => (
                                    <Text key={index} style={styles.chartLabel}>{label}</Text>
                                ))}
                            </View>
                        </View>

                        {/* Legend */}
                        <View style={styles.chartLegend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#FF6B4A' }]} />
                                <Text style={styles.legendText}>Activity</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
                                <Text style={styles.legendText}>Weight</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                                <Text style={styles.legendText}>Nutrition</Text>
                            </View>
                        </View>
                    </BlurView>

                    {/* Body Composition */}
                    <View style={styles.compositionSection}>
                        <Text style={styles.sectionTitle}>Body Composition</Text>

                        <View style={styles.compositionGrid}>
                            {/* Weight Card */}
                            <BlurView intensity={80} tint="light" style={styles.compositionCard}>
                                <View style={styles.compositionRing}>
                                    <Svg width={64} height={64} viewBox="0 0 64 64">
                                        <Circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="#FF6B4A20"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <Circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="#FF6B4A"
                                            strokeWidth="4"
                                            fill="none"
                                            strokeDasharray={176}
                                            strokeDashoffset={40}
                                            strokeLinecap="round"
                                            rotation="-90"
                                            originX="32"
                                            originY="32"
                                        />
                                    </Svg>
                                    <Text style={styles.compositionRingText}>{currentWeight}kg</Text>
                                </View>
                                <Text style={styles.compositionLabel}>Weight</Text>
                            </BlurView>

                            {/* Body Fat Card */}
                            <BlurView intensity={80} tint="light" style={styles.compositionCard}>
                                <View style={styles.compositionRing}>
                                    <Svg width={64} height={64} viewBox="0 0 64 64">
                                        <Circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="#3B82F620"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <Circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="#3B82F6"
                                            strokeWidth="4"
                                            fill="none"
                                            strokeDasharray={176}
                                            strokeDashoffset={120}
                                            strokeLinecap="round"
                                            rotation="-90"
                                            originX="32"
                                            originY="32"
                                        />
                                    </Svg>
                                    <Text style={styles.compositionRingText}>{bodyFat}%</Text>
                                </View>
                                <Text style={styles.compositionLabel}>Body Fat</Text>
                            </BlurView>

                            {/* Muscle Mass Card */}
                            <BlurView intensity={80} tint="light" style={styles.compositionCard}>
                                <View style={styles.compositionRing}>
                                    <Svg width={64} height={64} viewBox="0 0 64 64">
                                        <Circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="#10B98120"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <Circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="#10B981"
                                            strokeWidth="4"
                                            fill="none"
                                            strokeDasharray={176}
                                            strokeDashoffset={60}
                                            strokeLinecap="round"
                                            rotation="-90"
                                            originX="32"
                                            originY="32"
                                        />
                                    </Svg>
                                    <Text style={styles.compositionRingText}>{muscleMass}%</Text>
                                </View>
                                <Text style={styles.compositionLabel}>Muscle</Text>
                            </BlurView>
                        </View>
                    </View>

                    {/* Muscle Focus & Consistency Heatmap Row */}
                    <View style={styles.metricsRow}>
                        {/* Muscle Focus Radar */}
                        <BlurView intensity={80} tint="light" style={styles.metricsCard}>
                            <Text style={styles.metricsTitle}>Muscle Focus</Text>
                            <View style={styles.radarContainer}>
                                <View style={styles.radar}>
                                    <View style={styles.radarInner1} />
                                    <View style={styles.radarInner2} />
                                    <Svg width="100%" height="100%" viewBox="0 0 100 100">
                                        <Polygon
                                            points="50,10 85,30 90,70 50,90 10,70 15,30"
                                            fill="rgba(255, 107, 74, 0.2)"
                                            stroke="#FF6B4A"
                                            strokeWidth="1"
                                        />
                                        <SvgText x="50" y="5" fontSize="8" fill="#6B7280" textAnchor="middle">Chest</SvgText>
                                        <SvgText x="95" y="50" fontSize="8" fill="#6B7280" textAnchor="start">Arms</SvgText>
                                        <SvgText x="5" y="50" fontSize="8" fill="#6B7280" textAnchor="end">Legs</SvgText>
                                    </Svg>
                                </View>
                            </View>
                        </BlurView>

                        {/* Consistency Heatmap */}
                        <BlurView intensity={80} tint="light" style={styles.metricsCard}>
                            <Text style={styles.metricsTitle}>Consistency</Text>
                            <View style={styles.heatmap}>
                                {[...Array(20)].map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.heatmapCell,
                                            {
                                                backgroundColor: `rgba(255, 107, 74, ${Math.random() * 0.7 + 0.3})`,
                                            }
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={styles.consistencyText}>{consistencyScore}% Engagement</Text>
                        </BlurView>
                    </View>

                    {/* Bottom Padding */}
                    <View style={{ height: 100 }} />
                </ScrollView>
            </SafeAreaView>

            {/* Bottom Navigation */}
            <BlurView intensity={90} tint="light" style={styles.bottomNav}>
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.push('/(app)/home')}
                >
                    <Ionicons name="home-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.navText}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem}>
                    <Ionicons name="bar-chart" size={24} color="#FF6B4A" />
                    <Text style={[styles.navText, { color: '#FF6B4A' }]}>Stats</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => Alert.alert('Coming Soon', 'History page coming soon!')}
                >
                    <Ionicons name="time-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.navText}>History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => Alert.alert('Coming Soon', 'Profile page coming soon!')}
                >
                    <Ionicons name="person-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.navText}>Profile</Text>
                </TouchableOpacity>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F6F5',
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
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },

    // Period Selector
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 107, 74, 0.05)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 74, 0.1)',
    },
    periodButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    periodButtonActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    periodText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    periodTextActive: {
        color: '#FF6B4A',
        fontWeight: '600',
    },

    // Summary Card
    summaryCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        overflow: 'hidden',
    },
    summaryContent: {
        position: 'relative',
        zIndex: 10,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        opacity: 0.9,
        marginBottom: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    summaryItem: {
        flex: 1,
    },
    summaryItemBorder: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
    },
    summaryLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    summaryUnit: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    summaryFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 4,
    },
    trendText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    detailsButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    detailsButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FF6B4A',
    },
    summaryDecoration: {
        position: 'absolute',
        right: -40,
        bottom: -40,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },

    // Chart Card
    chartCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    chartContainer: {
        marginBottom: 12,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingHorizontal: 10,
    },
    chartLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    chartLegend: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        color: '#4B5563',
    },

    // Body Composition
    compositionSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    compositionGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    compositionCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    compositionRing: {
        position: 'relative',
        width: 64,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    compositionRingText: {
        position: 'absolute',
        fontSize: 12,
        fontWeight: '700',
        color: '#1F2937',
    },
    compositionLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },

    // Metrics Row
    metricsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    metricsCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    metricsTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    radarContainer: {
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radar: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radarInner1: {
        position: 'absolute',
        width: '80%',
        height: '80%',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        transform: [{ rotate: '45deg' }],
        borderRadius: 8,
    },
    radarInner2: {
        position: 'absolute',
        width: '60%',
        height: '60%',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        transform: [{ rotate: '90deg' }],
        borderRadius: 8,
    },
    heatmap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 8,
    },
    heatmapCell: {
        width: '16%',
        aspectRatio: 1,
        borderRadius: 4,
        margin: '0.5%',
    },
    consistencyText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4B5563',
        marginTop: 8,
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
        borderTopColor: 'rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Add solid background
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
        color: '#9CA3AF',
    },
});