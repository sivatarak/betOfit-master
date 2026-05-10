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
    Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";
import { CustomLoader } from "@/components/CustomLoader";
import { useTheme } from "../../context/themecontext";
import { getWorkoutHistory, getFoodHistory, getWaterHistory } from '../services/profileApi';
import auth from '@react-native-firebase/auth';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    const { colors, theme } = useTheme();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [dates, setDates] = useState<DailyDate[]>([]);
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    // Generate dates for the date picker (last 5 days)
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

    // Load history data from BACKEND for selected date
    const loadHistoryData = useCallback(async () => {
        try {
            setLoading(true);
            const currentUser = auth().currentUser;
            const userId = currentUser?.uid;
            
            if (!userId) {
                setLoading(false);
                return;
            }
            
            const selectedDateStr = selectedDate.toISOString().split('T')[0];
            const items: HistoryItem[] = [];

            // ✅ Load workouts from BACKEND
            const workouts = await getWorkoutHistory(userId, 30);
            const todaysWorkouts = workouts.filter((w: any) => 
                new Date(w.completed_at).toISOString().split('T')[0] === selectedDateStr
            );

            todaysWorkouts.forEach((workout: any, index: number) => {
                items.push({
                    id: `workout-${workout.id || index}`,
                    type: 'workout',
                    title: 'Workout Completed',
                    description: `${workout.exercise_name} • ${workout.duration_minutes || 0} min`,
                    time: new Date(workout.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    icon: 'fitness',
                    iconBg: colors.primary + '20',
                    iconColor: colors.primary,
                    stats: [{
                        value: `${workout.calories_burned || 0} kcal`,
                        color: colors.primary,
                    }],
                });
            });

            // ✅ Load food from BACKEND
            const foodLogs = await getFoodHistory(userId, 30);
            const todaysFood = foodLogs.filter((food: any) => 
                new Date(food.logged_at).toISOString().split('T')[0] === selectedDateStr
            );

            todaysFood.forEach((food: any, index: number) => {
                items.push({
                    id: `meal-${food.id || index}`,
                    type: 'meal',
                    title: 'Meal Logged',
                    description: food.food_name,
                    time: new Date(food.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    icon: 'restaurant',
                    iconBg: colors.warning + '20',
                    iconColor: colors.warning,
                    stats: [{
                        value: `${food.calories} kcal`,
                        color: colors.warning,
                    }],
                });
            });

            // ✅ Load water from BACKEND
            const waterLogs = await getWaterHistory(userId, 30);
            const todaysWater = waterLogs.filter((water: any) => 
                new Date(water.logged_at).toISOString().split('T')[0] === selectedDateStr
            );

            if (todaysWater.length > 0) {
                const totalWater = todaysWater.reduce((sum: number, w: any) => sum + w.amount_ml, 0);
                const waterGoal = 2500; // Get from profile
                const progress = (totalWater / waterGoal) * 100;
                
                items.push({
                    id: `water-${selectedDateStr}`,
                    type: 'water',
                    title: 'Water Goal',
                    description: progress >= 100 ? 'Daily goal achieved!' : `${(totalWater / 1000).toFixed(1)}L consumed`,
                    time: 'Throughout day',
                    icon: 'water',
                    iconBg: colors.info + '20',
                    iconColor: colors.info,
                    progress,
                    stats: [{
                        value: `${(totalWater / 1000).toFixed(1)}L / ${(waterGoal / 1000).toFixed(1)}L`,
                        color: colors.info,
                    }],
                });
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
    }, [selectedDate, colors]);

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

    const handleDateSelect = (date: DailyDate) => {
        setDates(prev =>
            prev.map(d => ({
                ...d,
                isSelected: d.formatted === date.formatted,
            }))
        );
        setSelectedDate(date.date);
    };

    // ✅ Date Picker Functions
    const openDatePicker = () => {
        setTempDate(selectedDate);
        setShowDatePicker(true);
    };

    const onDateChange = (event: any, selected?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        
        if (selected && event.type !== 'dismissed') {
            setSelectedDate(selected);
            updateDatesList(selected);
        }
        
        if (Platform.OS === 'ios') {
            setTempDate(selected || tempDate);
        }
    };

    const onDateConfirm = () => {
        setSelectedDate(tempDate);
        updateDatesList(tempDate);
        setShowDatePicker(false);
    };

    const updateDatesList = (date: Date) => {
        // Generate new dates list based on selected date
        const datesArray: DailyDate[] = [];
        const startDate = new Date(date);
        
        for (let i = 0; i < 5; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() - i);
            
            datesArray.push({
                date: currentDate,
                day: currentDate.getDate(),
                month: currentDate.toLocaleString('default', { month: 'short' }),
                isSelected: i === 0,
                formatted: currentDate.toISOString().split('T')[0],
            });
        }
        
        setDates(datesArray);
    };

    const goToPreviousDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() - 1);
        setSelectedDate(newDate);
        updateDatesList(newDate);
    };

    const goToNextDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + 1);
        
        // Don't allow future dates
        if (newDate > new Date()) {
            Alert.alert('Info', 'Cannot view future dates');
            return;
        }
        
        setSelectedDate(newDate);
        updateDatesList(newDate);
    };

    const formatMonth = (month: string) => {
        return month.charAt(0).toUpperCase() + month.slice(1);
    };

    const styles = getStyles(colors, theme);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
            
            <SafeAreaView style={styles.safeArea}>
                {/* Fixed Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My History</Text>
                    <TouchableOpacity
                        style={styles.calendarButton}
                        onPress={openDatePicker}
                    >
                        <Ionicons name="calendar-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Date Navigation Row */}
                <View style={styles.dateNavigationRow}>
                    <TouchableOpacity onPress={goToPreviousDay} style={styles.navArrow}>
                        <Ionicons name="chevron-back" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={openDatePicker} style={styles.dateDisplay}>
                        <Text style={[styles.dateDisplayText, { color: colors.text }]}>
                            {selectedDate.toLocaleDateString('default', { 
                                weekday: 'long', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={goToNextDay} style={styles.navArrow}>
                        <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Fixed Date Selector (Quick Select) */}
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
                                <Ionicons name="time-outline" size={64} color={colors.textMuted} />
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
                                    <BlurView 
                                        intensity={theme === "dark" ? 30 : 80} 
                                        tint={theme === "dark" ? "dark" : "light"} 
                                        style={styles.historyCard}
                                    >
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
                                                                backgroundColor: colors.info,
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
                        {loading && <CustomLoader fullScreen />}
                    </View>
                    
                    {/* Bottom Padding */}
                    <View style={styles.bottomPadding} />
                </ScrollView>
            </SafeAreaView>

            {/* ✅ Date Picker Modal */}
            {Platform.OS === 'ios' && (
                <Modal
                    transparent={true}
                    visible={showDatePicker}
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={[styles.modalCancelText, { color: colors.primary }]}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date</Text>
                                <TouchableOpacity onPress={onDateConfirm}>
                                    <Text style={[styles.modalDoneText, { color: colors.primary }]}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={tempDate}
                                mode="date"
                                display="spinner"
                                onChange={onDateChange}
                                maximumDate={new Date()}
                                themeVariant={theme === "dark" ? "dark" : "light"}
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    maximumDate={new Date()}
                />
            )}
        </View>
    );
}

const getStyles = (colors: any, theme: string) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.5,
    },
    calendarButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme === "dark" ? 0.2 : 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    // Date Navigation Row
    dateNavigationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: colors.background,
    },
    navArrow: {
        padding: 8,
    },
    dateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.card,
        borderRadius: 20,
    },
    dateDisplayText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Date Selector Wrapper
    dateSelectorWrapper: {
        backgroundColor: colors.background,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme === "dark" ? 0.2 : 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    dateCardSelected: {
        backgroundColor: colors.primary,
    },
    dateMonth: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.textMuted,
        marginBottom: 2,
    },
    dateDay: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
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
        paddingTop: 20,
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
        backgroundColor: colors.border,
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
        borderColor: colors.background,
    },

    // History Card
    historyCard: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        marginLeft: 28,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: theme === "dark" ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
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
        color: colors.text,
        marginBottom: 2,
    },
    cardTime: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
    },
    cardDescription: {
        fontSize: 14,
        color: colors.textSecondary,
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
        backgroundColor: colors.border,
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
        color: colors.textMuted,
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    bottomPadding: {
        height: 40,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '500',
    },
    modalDoneText: {
        fontSize: 16,
        fontWeight: '600',
    },
});