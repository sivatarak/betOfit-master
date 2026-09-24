// app/(tabs)/history.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    SafeAreaView,
    Platform,
    Alert,
    Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient as SvgRadialGradient, Stop } from "react-native-svg";
import { CustomLoader } from "@/components/CustomLoader";
import { useTheme } from "../../context/themecontext";
import { AmbientGlow } from "../../components/AmbientGlow";
import { getWorkoutHistory, getFoodHistory, getWaterHistory } from "../services/profileApi";
import auth from "@react-native-firebase/auth";
import DateTimePicker from "@react-native-community/datetimepicker";

// ---------------------------------------------------------------------------
// Fixed accent palette matching the target design (dark cards, orange/amber/
// sky accents per activity type). Ordinary text still reads from
// ThemeContext (colors.text / colors.textSecondary).
// ---------------------------------------------------------------------------
const ACCENT = {
    orange: "#f97316",
    red: "#dc2626",
    amber: "#f59e0b",
    yellow: "#facc15",
    sky: "#38bdf8",
    purple: "#a855f7",
    surface: "#18181b",
};
const WATER_GOAL_ML = 2500;

interface DailyDate {
    date: Date;
    day: number;
    month: string;
    isSelected: boolean;
    formatted: string;
}

interface HistoryItem {
    id: string;
    type: "workout" | "water" | "meal";
    badgeLabel: string; // e.g. "07:30 AM • WORKOUT"
    title: string; // e.g. "Morning HIIT & Strength"
    valueMain: string; // "420"
    valueUnit?: string; // "kcal"
    valueSubLabel?: string; // "kcal burned" / "48g Protein" / "ml logged"
    valueSubColor?: string;
    accentColor: string;
    icon: keyof typeof Ionicons.glyphMap;
}

interface DailyStats {
    burnedKcal: number;
    activeMinutes: number;
    waterLiters: number;
    targetPercent: number;
}

export default function HistoryScreen() {
    const { colors, theme } = useTheme();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [dates, setDates] = useState<DailyDate[]>([]);
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [dailyStats, setDailyStats] = useState<DailyStats>({
        burnedKcal: 0,
        activeMinutes: 0,
        waterLiters: 0,
        targetPercent: 0,
    });
    const [loading, setLoading] = useState(true);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    const generateDates = useCallback(() => {
        const today = new Date();
        const datesArray: DailyDate[] = [];
        for (let i = 0; i < 5; i++) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            datesArray.push({
                date,
                day: date.getDate(),
                month: date.toLocaleString("default", { month: "short" }),
                isSelected: i === 0,
                formatted: date.toISOString().split("T")[0],
            });
        }
        setDates(datesArray);
    }, []);

    const loadHistoryData = useCallback(async () => {
        try {
            setLoading(true);
            const currentUser = auth().currentUser;
            const userId = currentUser?.uid;

            if (!userId) {
                setLoading(false);
                return;
            }

            const selectedDateStr = selectedDate.toISOString().split("T")[0];
            const items: HistoryItem[] = [];

            // Workouts
            const workouts = await getWorkoutHistory(userId, 30);
            const todaysWorkouts = workouts.filter(
                (w: any) => new Date(w.completed_at).toISOString().split("T")[0] === selectedDateStr
            );
            let burnedKcal = 0;
            let activeMinutes = 0;

            todaysWorkouts.forEach((workout: any, index: number) => {
                burnedKcal += workout.calories_burned || 0;
                activeMinutes += workout.duration_minutes || 0;
                items.push({
                    id: `workout-${workout.id || index}`,
                    type: "workout",
                    badgeLabel: `${formatTime(workout.completed_at)} • WORKOUT`,
                    title: workout.exercise_name || "Workout",
                    valueMain: `${workout.calories_burned || 0}`,
                    valueSubLabel: "kcal burned",
                    accentColor: ACCENT.orange,
                    icon: "barbell",
                });
            });

            // Meals
            const foodLogs = await getFoodHistory(userId, 30);
            const todaysFood = foodLogs.filter(
                (food: any) => new Date(food.logged_at).toISOString().split("T")[0] === selectedDateStr
            );

            todaysFood.forEach((food: any, index: number) => {
                items.push({
                    id: `meal-${food.id || index}`,
                    type: "meal",
                    badgeLabel: `${formatTime(food.logged_at)} • MEAL`,
                    title: food.food_name || "Meal",
                    valueMain: `${food.calories || 0}`,
                    valueUnit: "kcal",
                    valueSubLabel: food.protein != null ? `${food.protein}g Protein` : undefined,
                    valueSubColor: "#34d399",
                    accentColor: ACCENT.amber,
                    icon: "restaurant",
                });
            });

            // Water (aggregated for the day)
            const waterLogs = await getWaterHistory(userId, 30);
            const todaysWater = waterLogs.filter(
                (water: any) => new Date(water.logged_at).toISOString().split("T")[0] === selectedDateStr
            );
            const totalWaterMl = todaysWater.reduce((sum: number, w: any) => sum + w.amount_ml, 0);

            if (todaysWater.length > 0) {
                items.push({
                    id: `water-${selectedDateStr}`,
                    type: "water",
                    badgeLabel: "THROUGHOUT DAY • HYDRATION",
                    title:
                        totalWaterMl >= WATER_GOAL_ML
                            ? "Daily water goal achieved!"
                            : `${(totalWaterMl / 1000).toFixed(1)}L consumed`,
                    valueMain: `${totalWaterMl}`,
                    valueSubLabel: "ml logged",
                    accentColor: ACCENT.sky,
                    icon: "water",
                });
            }

            items.sort((a, b) => a.badgeLabel.localeCompare(b.badgeLabel));

            setHistoryItems(items);
            setDailyStats({
                burnedKcal,
                activeMinutes,
                waterLiters: totalWaterMl / 1000,
                // Only water has a fixed daily goal wired up today, so that's
                // what "Daily Target" reflects until calorie/activity goals
                // are exposed here too.
                targetPercent: Math.min(Math.round((totalWaterMl / WATER_GOAL_ML) * 100), 100),
            });
        } catch (error) {
            console.error("Error loading history:", error);
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

    const handleDateSelect = (date: DailyDate) => {
        setDates((prev) => prev.map((d) => ({ ...d, isSelected: d.formatted === date.formatted })));
        setSelectedDate(date.date);
    };

    const openDatePicker = () => {
        setTempDate(selectedDate);
        setShowDatePicker(true);
    };

    const onDateChange = (event: any, selected?: Date) => {
        if (Platform.OS === "android") setShowDatePicker(false);
        if (selected && event.type !== "dismissed") {
            setSelectedDate(selected);
            updateDatesList(selected);
        }
        if (Platform.OS === "ios") setTempDate(selected || tempDate);
    };

    const onDateConfirm = () => {
        setSelectedDate(tempDate);
        updateDatesList(tempDate);
        setShowDatePicker(false);
    };

    const updateDatesList = (date: Date) => {
        const datesArray: DailyDate[] = [];
        const startDate = new Date(date);
        for (let i = 0; i < 5; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() - i);
            datesArray.push({
                date: currentDate,
                day: currentDate.getDate(),
                month: currentDate.toLocaleString("default", { month: "short" }),
                isSelected: i === 0,
                formatted: currentDate.toISOString().split("T")[0],
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
        if (newDate > new Date()) {
            Alert.alert("Info", "Cannot view future dates");
            return;
        }
        setSelectedDate(newDate);
        updateDatesList(newDate);
    };

    const styles = getStyles(colors, theme);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

            <AmbientGlow />

            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* HEADER */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton} accessibilityLabel="Go back">
                            <Ionicons name="arrow-back" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.headerTitleRow}>
                            <Ionicons name="time" size={19} color={colors.primary} />
                            <Text style={[styles.headerTitle, { color: colors.text }]}>My History</Text>
                        </View>
                    </View>

                    {/* DATE NAVIGATOR PILL */}
                    <View style={styles.dateNavRow}>
                        <TouchableOpacity onPress={goToPreviousDay} style={styles.navArrow}>
                            <Ionicons name="chevron-back" size={18} color={ACCENT.orange} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={openDatePicker} style={styles.dateDisplay}>
                            <Ionicons name="calendar-outline" size={13} color={ACCENT.orange} />
                            <Text style={styles.dateDisplayText}>
                                {selectedDate.toLocaleDateString("default", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                })}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={goToNextDay} style={styles.navArrow}>
                            <Ionicons name="chevron-forward" size={18} color={ACCENT.orange} />
                        </TouchableOpacity>
                    </View>

                    {/* DATE CHIP ROW */}
                    <View style={styles.dateChipRow}>
                        {dates.map((date, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.dateChipWrap}
                                onPress={() => handleDateSelect(date)}
                                activeOpacity={0.85}
                            >
                                {date.isSelected ? (
                                    <LinearGradient
                                        colors={[ACCENT.red, ACCENT.orange, ACCENT.yellow]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.dateChip}
                                    >
                                        <Text style={styles.dateChipMonthSelected}>{date.month}</Text>
                                        <Text style={styles.dateChipDaySelected}>{date.day}</Text>
                                    </LinearGradient>
                                ) : (
                                    <View style={[styles.dateChip, styles.dateChipFlat]}>
                                        <Text style={styles.dateChipMonth}>{date.month}</Text>
                                        <Text style={styles.dateChipDay}>{date.day}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* DAILY HIGHLIGHTS */}
                    <LinearGradient
                        colors={
                            theme === "dark"
                                ? ["rgba(45,28,18,0.98)", "rgba(24,24,27,0.98)"]
                                : ["rgba(255,244,235,0.98)", "rgba(255,255,255,0.98)"]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.highlightsCard}
                    >
                        <View style={styles.highlightsRow}>
                            <View style={styles.highlightItem}>
                                <View style={[styles.highlightIconWrap, { backgroundColor: ACCENT.orange + "26" }]}>
                                    <Ionicons name="flame" size={14} color={ACCENT.orange} />
                                </View>
                                <Text style={styles.highlightValue}>
                                    {dailyStats.burnedKcal} <Text style={styles.highlightUnit}>kcal</Text>
                                </Text>
                                <Text style={styles.highlightLabel}>Burned</Text>
                            </View>
                            <View style={styles.highlightDivider} />
                            <View style={styles.highlightItem}>
                                <View style={[styles.highlightIconWrap, { backgroundColor: ACCENT.amber + "26" }]}>
                                    <Ionicons name="time" size={14} color={ACCENT.amber} />
                                </View>
                                <Text style={styles.highlightValue}>
                                    {dailyStats.activeMinutes} <Text style={styles.highlightUnit}>mins</Text>
                                </Text>
                                <Text style={styles.highlightLabel}>Active Time</Text>
                            </View>
                            <View style={styles.highlightDivider} />
                            <View style={styles.highlightItem}>
                                <View style={[styles.highlightIconWrap, { backgroundColor: ACCENT.sky + "26" }]}>
                                    <Ionicons name="water" size={14} color={ACCENT.sky} />
                                </View>
                                <Text style={styles.highlightValue}>
                                    {dailyStats.waterLiters.toFixed(1)} <Text style={styles.highlightUnit}>L</Text>
                                </Text>
                                <Text style={styles.highlightLabel}>Water</Text>
                            </View>
                        </View>

                        <View style={styles.highlightsProgressSection}>
                            <View style={styles.highlightsProgressLabelRow}>
                                <Text style={styles.highlightsProgressLabel}>Daily Target</Text>
                                <Text style={styles.highlightsProgressPercent}>
                                    {dailyStats.targetPercent}% Achieved
                                </Text>
                            </View>
                            <View style={styles.highlightsProgressTrack}>
                                <LinearGradient
                                    colors={[ACCENT.red, ACCENT.orange, ACCENT.yellow]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.highlightsProgressFill, { width: `${dailyStats.targetPercent}%` }]}
                                />
                            </View>
                        </View>
                    </LinearGradient>

                    {/* ACTIVITY TIMELINE */}
                    <View style={styles.timeline}>
                        {historyItems.length > 1 && (
                            <LinearGradient
                                colors={[ACCENT.orange, ACCENT.amber, ACCENT.sky, ACCENT.purple]}
                                style={styles.timelineLine}
                            />
                        )}

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>Loading history...</Text>
                            </View>
                        ) : historyItems.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="time-outline" size={56} color="#52525b" />
                                <Text style={styles.emptyTitle}>No activities</Text>
                                <Text style={styles.emptySubtitle}>
                                    No workouts, meals, or water logged for this day
                                </Text>
                            </View>
                        ) : (
                            historyItems.map((item, index) => (
                                <Animated.View
                                    key={item.id}
                                    entering={FadeInDown.delay(index * 80)}
                                    style={styles.timelineItem}
                                >
                                    <View
                                        style={[
                                            styles.timelineDot,
                                            { borderColor: item.accentColor, shadowColor: item.accentColor },
                                        ]}
                                    >
                                        <Ionicons name={item.icon} size={16} color={item.accentColor} />
                                    </View>

                                    <View style={styles.historyCard}>
                                        <View style={styles.historyCardLeft}>
                                            <Text style={[styles.historyBadge, { color: item.accentColor }]} numberOfLines={1}>
                                                {item.badgeLabel}
                                            </Text>
                                            <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                                                {item.title}
                                            </Text>
                                        </View>
                                        <View style={styles.historyCardRight}>
                                            <Text style={[styles.historyValue, { color: colors.text }]}>
                                                {item.valueMain}
                                                {item.valueUnit ? <Text style={styles.historyValueUnit}> {item.valueUnit}</Text> : null}
                                            </Text>
                                            {!!item.valueSubLabel && (
                                                <Text
                                                    style={[
                                                        styles.historyValueSub,
                                                        { color: item.valueSubColor || "#9CA3AF" },
                                                    ]}
                                                >
                                                    {item.valueSubLabel}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </Animated.View>
                            ))
                        )}
                        {loading && <CustomLoader fullScreen />}
                    </View>

                    <View style={styles.bottomPadding} />
                </ScrollView>
            </SafeAreaView>

            {/* DATE PICKER MODAL */}
            {Platform.OS === "ios" && (
                <Modal
                    transparent
                    visible={showDatePicker}
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date</Text>
                                <TouchableOpacity onPress={onDateConfirm}>
                                    <Text style={styles.modalDoneText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={tempDate}
                                mode="date"
                                display="spinner"
                                onChange={onDateChange}
                                maximumDate={new Date()}
                                themeVariant="dark"
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {Platform.OS === "android" && showDatePicker && (
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

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const getStyles = (colors: any, theme: string) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        ambientGlowWrap: {
            position: "absolute",
            top: -20,
            left: "50%",
            marginLeft: -180,
            width: 360,
            height: 360,
            zIndex: 0,
        },
        safeArea: { flex: 1 },
        scrollContent: {
            paddingHorizontal: 16,
            paddingTop: Platform.OS === "ios" ? 36 : 28,
            // Extra bottom padding so content clears the floating tab bar dock.
            paddingBottom: 120,
        },

        // Header
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
        },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
        },
        headerTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
        headerTitle: { fontSize: 18, fontWeight: "800" },
        calendarButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
        },

        // Date navigator
        dateNavRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 14,
        },
        navArrow: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: ACCENT.surface,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
            justifyContent: "center",
        },
        dateDisplay: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: ACCENT.surface,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
        },
        dateDisplayText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

        // Date chip row
        dateChipRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
        dateChipWrap: { flex: 1 },
        dateChip: {
            borderRadius: 16,
            paddingVertical: 8,
            alignItems: "center",
            justifyContent: "center",
        },
        dateChipFlat: {
            backgroundColor: ACCENT.surface,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.05)",
        },
        dateChipMonth: { fontSize: 9, fontWeight: "700", color: "#71717a", textTransform: "uppercase" },
        dateChipDay: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", marginTop: 2 },
        dateChipMonthSelected: { fontSize: 9, fontWeight: "900", color: "rgba(28,15,0,0.75)", textTransform: "uppercase" },
        dateChipDaySelected: { fontSize: 18, fontWeight: "900", color: "#1c0f00", marginTop: 2 },

        // Daily highlights
        highlightsCard: {
            backgroundColor: "transparent",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            padding: 14,
            marginBottom: 16,
        },
        highlightsRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
        highlightItem: { flex: 1, alignItems: "center" },
        highlightDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.06)" },
        highlightIconWrap: {
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
        },
        highlightValue: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
        highlightUnit: { fontSize: 10, fontWeight: "500", color: "#9CA3AF" },
        highlightLabel: { fontSize: 9, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", marginTop: 2 },

        highlightsProgressSection: {
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
            gap: 6,
        },
        highlightsProgressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
        highlightsProgressLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF" },
        highlightsProgressPercent: { fontSize: 10, fontWeight: "800", color: "#fbbf24" },
        highlightsProgressTrack: {
            height: 6,
            borderRadius: 3,
            backgroundColor: "rgba(0,0,0,0.6)",
            overflow: "hidden",
        },
        highlightsProgressFill: { height: "100%", borderRadius: 3 },

        // Timeline
        timeline: { position: "relative", paddingLeft: 4 },
        timelineLine: {
            position: "absolute",
            left: 17,
            top: 16,
            bottom: 16,
            width: 2,
            borderRadius: 1,
        },
        timelineItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
        timelineDot: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: ACCENT.surface,
            borderWidth: 2,
            alignItems: "center",
            justifyContent: "center",
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 4,
        },

        historyCard: {
            flex: 1,
            backgroundColor: ACCENT.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            paddingHorizontal: 12,
            paddingVertical: 9,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        historyCardLeft: { flex: 1, paddingRight: 8 },
        historyBadge: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4, marginBottom: 2, textTransform: "uppercase" },
        historyTitle: { fontSize: 13, fontWeight: "700" },
        historyCardRight: { alignItems: "flex-end" },
        historyValue: { fontSize: 13, fontWeight: "800" },
        historyValueUnit: { fontSize: 10, fontWeight: "500", color: "#9CA3AF" },
        historyValueSub: { fontSize: 9, fontWeight: "700", marginTop: 2 },

        // Loading / empty
        loadingContainer: { paddingVertical: 40, alignItems: "center" },
        loadingText: { fontSize: 14, color: "#9CA3AF" },
        emptyContainer: { paddingVertical: 50, alignItems: "center" },
        emptyTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginTop: 14 },
        emptySubtitle: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center", paddingHorizontal: 32 },
        bottomPadding: { height: 30 },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
        modalContent: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            backgroundColor: "#141414",
        },
        modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
        modalTitle: { fontSize: 16, fontWeight: "700" },
        modalCancelText: { fontSize: 16, fontWeight: "500", color: "#9CA3AF" },
        modalDoneText: { fontSize: 16, fontWeight: "700", color: ACCENT.orange },
    });