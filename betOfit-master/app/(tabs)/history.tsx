// app/(tabs)/history.tsx
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
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";
import { CustomLoader } from "@/components/CustomLoader";

const { width } = Dimensions.get("window");

// Types
interface WorkoutLog {
    id: string;
    exerciseName: string;
    date: string;
    time: string;
    duration: number;
    caloriesBurned: number;
}

interface FoodEntry {
    id: string;
    name: string;
    calories: number;
    protein: number;
    date: string;
    time: string;
}

interface WaterData {
    current: number;
    goal: number;
    history: Array<{ ml: number; time: string }>;
    date: string;
}

interface HistoryItem {
    id: string;
    type: 'workout' | 'water' | 'meal';
    title: string;
    description: string;
    time: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    stats?: Array<{ value: string; color: string }>;
    progress?: number;
}

interface DailyDate {
    date: Date;
    day: number;
    month: string;
    isSelected: boolean;
    formatted: string;
}

export default function HistoryScreen() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [dates, setDates] = useState<DailyDate[]>([]);
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Generate dates for the date picker
    const generateDates = useCallback(() => {
        const today = new Date();
        const datesArray: DailyDate[] = [];

        for (let i = 0; i < 5; i++) {
            const date = new Date();
            date.setDate(today.getDate() - i);

            datesArray.push({
                date,
                day: date.getDate(),
                month: date.toLocaleString('default', { month: 'short' }),
                isSelected: i === 0,
                formatted: date.toISOString().split('T')[0],
            });
        }

        setDates(datesArray);
    }, []);

    // Load history data for selected date
    const loadHistoryData = useCallback(async () => {
        try {
            setLoading(true);
            const selectedDateStr = selectedDate.toISOString().split('T')[0];
            const items: HistoryItem[] = [];

            // Load workouts
            const workoutStr = await AsyncStorage.getItem('WORKOUT_HISTORY');
            if (workoutStr) {
                const workouts: WorkoutLog[] = JSON.parse(workoutStr);
                const todaysWorkouts = workouts.filter(w => w.date === selectedDateStr);

                todaysWorkouts.forEach((workout, index) => {
                    items.push({
                        id: `workout-${workout.id || index}`,
                        type: 'workout',
                        title: 'Workout Completed',
                        description: `${workout.exerciseName} • ${workout.duration} min`,
                        time: workout.time || '08:30 AM',
                        icon: 'fitness',
                        iconBg: '#FF6B4A',
                        iconColor: '#FFFFFF',
                        stats: [{
                            value: `${workout.caloriesBurned} kcal`,
                            color: '#FF6B4A',
                        }],
                    });
                });
            }

            // Load water entries
            const waterStr = await AsyncStorage.getItem('WATER_DATA');
            if (waterStr) {
                const waterData: WaterData = JSON.parse(waterStr);
                if (waterData.date === selectedDateStr && waterData.current > 0) {
                    const progress = (waterData.current / waterData.goal) * 100;
                    items.push({
                        id: `water-${selectedDateStr}`,
                        type: 'water',
                        title: 'Water Goal',
                        description: progress >= 100 ? 'Daily goal achieved!' : `${Math.round(waterData.current / 10) / 100}L consumed`,
                        time: 'Throughout day',
                        icon: 'water',
                        iconBg: '#DBEAFE',
                        iconColor: '#3B82F6',
                        progress,
                        stats: [{
                            value: `${Math.round(waterData.current / 10) / 100}L / ${waterData.goal / 1000}L`,
                            color: '#3B82F6',
                        }],
                    });
                }
            }

            // Load meals
            const caloriesStr = await AsyncStorage.getItem('CALORIES_DATA_V2');
            if (caloriesStr) {
                const caloriesData = JSON.parse(caloriesStr);
                if (caloriesData.history) {
                    const todaysMeals = caloriesData.history.filter((m: any) => m.date === selectedDateStr);

                    todaysMeals.forEach((meal: any, index: number) => {
                        items.push({
                            id: `meal-${meal.id || index}`,
                            type: 'meal',
                            title: 'Meal Logged',
                            description: meal.name,
                            time: meal.time || '12:45 PM',
                            icon: 'restaurant',
                            iconBg: '#FEF3C7',
                            iconColor: '#F59E0B',
                            stats: [{
                                value: `${meal.calories} kcal`,
                                color: '#F59E0B',
                            }],
                        });
                    });
                }
            }

            // Sort by time (most recent first)
            items.sort((a, b) => {
                const timeA = a.time === 'Throughout day' ? '00:00' : a.time;
                const timeB = b.time === 'Throughout day' ? '00:00' : b.time;
                return timeB.localeCompare(timeA);
            });

            setHistoryItems(items);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        generateDates();
    }, [generateDates]);

    useEffect(() => {
        loadHistoryData();
    }, [loadHistoryData]);

    useFocusEffect(
        useCallback(() => {
            loadHistoryData();
        }, [loadHistoryData])
    );


      if (loading) {
        return (
            <CustomLoader 
                fullScreen={true} 
            />
        );
    }
    const handleDateSelect = (date: DailyDate) => {
        setDates(prev =>
            prev.map(d => ({
                ...d,
                isSelected: d.formatted === date.formatted,
            }))
        );
        setSelectedDate(date.date);
    };

    const formatMonth = (month: string) => {
        return month.charAt(0).toUpperCase() + month.slice(1);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            <SafeAreaView style={styles.safeArea}>
                {/* Fixed Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My History</Text>
                    <TouchableOpacity
                        style={styles.calendarButton}
                        onPress={() => Alert.alert('Calendar', 'Date picker coming soon!')}
                    >
                        <Ionicons name="calendar-outline" size={22} color="#FF6B4A" />
                    </TouchableOpacity>
                </View>

                {/* Fixed Date Selector */}
                <View style={styles.dateSelectorWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dateSelector}
                    >
                        {dates.map((date, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.dateCard,
                                    date.isSelected && styles.dateCardSelected,
                                ]}
                                onPress={() => handleDateSelect(date)}
                            >
                                <Text style={[
                                    styles.dateMonth,
                                    date.isSelected && styles.dateTextSelected,
                                ]}>
                                    {formatMonth(date.month)}
                                </Text>
                                <Text style={[
                                    styles.dateDay,
                                    date.isSelected && styles.dateTextSelected,
                                ]}>
                                    {date.day}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Scrollable Timeline */}
                <ScrollView
                    style={styles.timelineScroll}
                    contentContainerStyle={styles.timelineContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.timeline}>
                        {/* Timeline Line */}
                        <View style={styles.timelineLine} />
                        
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>Loading history...</Text>
                            </View>
                        ) : historyItems.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="time-outline" size={64} color="#D1D5DB" />
                                <Text style={styles.emptyTitle}>No activities</Text>
                                <Text style={styles.emptySubtitle}>
                                    No workouts, meals, or water logged for this day
                                </Text>
                            </View>
                        ) : (
                            historyItems.map((item, index) => (
                                <Animated.View
                                    key={item.id}
                                    entering={FadeInDown.delay(index * 100)}
                                    style={styles.timelineItem}
                                >
                                    {/* Timeline Dot */}
                                    <View style={styles.timelineDot}>
                                        <View style={[styles.timelineDotInner, { backgroundColor: item.iconBg }]}>
                                            <Ionicons name={item.icon} size={20} color={item.iconColor} />
                                        </View>
                                    </View>

                                    {/* Content Card */}
                                    <BlurView intensity={80} tint="light" style={styles.historyCard}>
                                        <View style={styles.cardHeader}>
                                            <View>
                                                <Text style={styles.cardTitle}>{item.title}</Text>
                                                <Text style={styles.cardTime}>{item.time}</Text>
                                            </View>
                                        </View>

                                        <Text style={styles.cardDescription}>{item.description}</Text>

                                        {/* Stats */}
                                        {item.stats && item.stats.length > 0 && (
                                            <View style={styles.cardStats}>
                                                {item.stats.map((stat, idx) => (
                                                    <View
                                                        key={idx}
                                                        style={[
                                                            styles.statBadge,
                                                            { backgroundColor: `${stat.color}15` },
                                                        ]}
                                                    >
                                                        <Text style={[styles.statText, { color: stat.color }]}>
                                                            {stat.value}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {/* Progress Bar */}
                                        {item.progress !== undefined && (
                                            <View style={styles.progressContainer}>
                                                <View style={styles.progressBar}>
                                                    <View
                                                        style={[
                                                            styles.progressFill,
                                                            {
                                                                width: `${Math.min(item.progress, 100)}%`,
                                                                backgroundColor: '#3B82F6',
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                            </View>
                                        )}
                                    </BlurView>
                                </Animated.View>
                            ))
                        )}
                    </View>
                    
                    {/* Bottom Padding */}
                    <View style={styles.bottomPadding} />
                </ScrollView>
            </SafeAreaView>

            {/* Bottom Navigation */}
            <BlurView intensity={90} tint="light" style={styles.bottomNav}>
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.push('/(tabs)/home')}
                >
                    <Ionicons name="home-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.navText}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.push('/(tabs)/stats')}
                >
                    <Ionicons name="stats-chart-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.navText}>Stats</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem}>
                    <View style={styles.activeNavIcon}>
                        <Ionicons name="time" size={24} color="#FF6B4A" />
                        <View style={styles.activeDot} />
                    </View>
                    <Text style={[styles.navText, styles.navTextActive]}>History</Text>
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
    safeArea: {
        flex: 1,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#F8F6F5',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 107, 74, 0.1)',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        letterSpacing: -0.5,
    },
    calendarButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    // Date Selector Wrapper
    dateSelectorWrapper: {
        backgroundColor: '#F8F6F5',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 107, 74, 0.1)',
    },

    // Date Selector
    dateSelector: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    dateCard: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    dateCardSelected: {
        backgroundColor: '#FF6B4A',
    },
    dateMonth: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 2,
    },
    dateDay: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    dateTextSelected: {
        color: '#FFFFFF',
    },

    // Timeline Scroll
    timelineScroll: {
        flex: 1,
    },
    timelineContent: {
        paddingHorizontal: 20,
        paddingTop: 60, // Space between date selector and timeline
        paddingBottom: 100,
    },

    // Timeline
    timeline: {
        position: 'relative',
        paddingLeft: 28,
    },
    timelineLine: {
        position: 'absolute',
        left: 36,
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: '#E5E7EB',
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 24,
        position: 'relative',
    },
    timelineDot: {
        position: 'absolute',
        left: -28,
        top: 0,
        width: 56,
        alignItems: 'center',
    },
    timelineDotInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#F8F6F5',
    },

    // History Card
    historyCard: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        marginLeft: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 2,
    },
    cardTime: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    cardDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
    },
    cardStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statText: {
        fontSize: 11,
        fontWeight: '700',
    },

    // Progress Bar
    progressContainer: {
        marginTop: 8,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },

    // Loading & Empty States
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    bottomPadding: {
        height: 40,
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
        paddingVertical: 8,
        paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(255,255,255,0.95)',
    },
    navItem: {
        alignItems: 'center',
        gap: 2,
    },
    navText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    navTextActive: {
        color: '#FF6B4A',
    },
    activeNavIcon: {
        position: 'relative',
    },
    activeDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF6B4A',
    },
});