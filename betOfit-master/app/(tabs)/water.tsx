import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import Svg, { Circle } from "react-native-svg";

import { useThemedColors } from "@/theme";
import {
  loadWaterData,
  addWaterIntake,
  WEIGHT_KEY,
  WATER_KEY,
  WaterData,
} from "../utils/waterUtils";
import { useWeeklyAverages } from "../../hooks/useOverallstats";
import SingleStatGraph from "../../components/singlestatsgraph";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = Math.min(width * 0.65, 280);

const WATER_PRIMARY = "#00B4D8";
const WATER_ACCENT = "#90E0EF";

/* ---------------------------------------------------------
   MODERN CIRCULAR PROGRESS
--------------------------------------------------------- */
interface ModernCircularProgressProps {
  percentage: number;
  current: number;
  size?: number;
}

function ModernCircularProgress({ 
  percentage, 
  current, 
  size = CIRCLE_SIZE 
}: ModernCircularProgressProps) {
  const progress = useSharedValue(0);
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.value = withSpring(percentage / 100, {
      damping: 20,
      stiffness: 90,
    });

    if (percentage >= 100) {
      runOnJS(Haptics.notificationAsync)(
        Haptics.NotificationFeedbackType.Success
      );
    }
  }, [percentage]);

  // We'll use progress.value for animation
  const animatedStrokeDashoffset = circumference * (1 - (percentage / 100));

  return (
    <View style={[styles.circularProgress, { width: size, height: size }]}>
      {/* Background Circle */}
      <Svg width={size} height={size} style={styles.svgCircle}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={WATER_PRIMARY}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={animatedStrokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center Content */}
      <View style={styles.circleCenter}>
        <Ionicons name="water" size={32} color={WATER_PRIMARY} />
        <Text style={styles.circleAmount}>{current}</Text>
        <Text style={styles.circleLabel}>ml today</Text>
      </View>
    </View>
  );
}

/* ---------------------------------------------------------
   MAIN SCREEN
--------------------------------------------------------- */
export default function HydroSyncScreen() {
  const colors = useThemedColors();
  const weekly = useWeeklyAverages();
  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [waterData, setWaterData] = useState<WaterData>({
    date: "",
    current: 0,
    goal: 2500,
    history: [],
    streak: 0,
  });

  const percentage = useMemo(() => {
    if (waterData.goal === 0) return 0;
    return Math.min((waterData.current / waterData.goal) * 100, 100);
  }, [waterData.current, waterData.goal]);

  useEffect(() => {
    const load = async () => {
      try {
        const wStr = await AsyncStorage.getItem(WEIGHT_KEY);
        let w = 70;
        if (wStr) {
          const parsed = parseFloat(wStr);
          if (parsed > 0) {
            w = parsed;
            setWeightKg(w);
          }
        }
        const data = await loadWaterData(w);
        setWaterData(data);
      } catch (e) {
        console.log("Error loading hydration:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const add = async (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = await addWaterIntake(amount);
    setWaterData(updated);
  };

  const removeLast = async () => {
    if (waterData.history.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lastAmount = waterData.history[0].ml;
    const newCurrent = Math.max(0, waterData.current - lastAmount);
    const newHistory = waterData.history.slice(1);
    const updated: WaterData = {
      ...waterData,
      current: newCurrent,
      history: newHistory,
    };
    await AsyncStorage.setItem(WATER_KEY, JSON.stringify(updated));
    setWaterData(updated);
  };

  const reset = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const today = new Date().toISOString().split("T")[0];
    const resetData: WaterData = {
      date: today,
      current: 0,
      goal: waterData.goal,
      history: [],
      streak: waterData.streak,
    };
    await AsyncStorage.setItem(WATER_KEY, JSON.stringify(resetData));
    setWaterData(resetData);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading…</Text>
      </View>
    );
  }

  const statusMessage =
    percentage < 30
      ? "Let's start hydrating!"
      : percentage < 60
      ? "Almost halfway there!"
      : percentage < 90
      ? "You're doing great!"
      : percentage === 100
      ? "Goal achieved! 🎉"
      : "Keep it up!";

  return (
    <View style={[styles.screen, { backgroundColor: "#F9FAFB" }]}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="person-circle-outline" size={28} color="#1F2937" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Hydration</Text>

            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => router.push("/(auth)/profile-setup?tab=water")}
            >
              <Ionicons name="settings-outline" size={28} color="#1F2937" />
            </TouchableOpacity>
          </View> */}

          {/* CIRCULAR PROGRESS */}
          <View style={styles.progressSection}>
            <ModernCircularProgress
              percentage={percentage}
              current={waterData.current}
              size={CIRCLE_SIZE}
            />
          </View>

          {/* DAILY GOAL SECTION */}
          <View style={styles.goalSection}>
            <View style={styles.goalHeader}>
              <View>
                <Text style={styles.goalTitle}>Daily Goal</Text>
                <Text style={styles.goalSubtitle}>{statusMessage}</Text>
              </View>
              <Text style={styles.goalAmount}>
                <Text style={styles.goalCurrent}>{waterData.current}</Text>
                <Text style={styles.goalSeparator}> / </Text>
                <Text style={styles.goalTarget}>{waterData.goal}</Text>
                <Text style={styles.goalUnit}> ml</Text>
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${percentage}%` },
                ]}
              />
            </View>
          </View>

          {/* QUICK ADD BUTTONS */}
          <View style={styles.quickAddSection}>
            <Text style={styles.sectionLabel}>QUICK ADD</Text>

            <View style={styles.quickAddGrid}>
              <TouchableOpacity
                style={styles.quickAddBtn}
                onPress={() => add(250)}
              >
                <Ionicons name="water-outline" size={24} color={WATER_PRIMARY} />
                <Text style={styles.quickAddText}>250ml</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAddBtn}
                onPress={() => add(500)}
              >
                <Ionicons name="water" size={24} color={WATER_PRIMARY} />
                <Text style={styles.quickAddText}>500ml</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAddBtn}
                onPress={() => add(750)}
              >
                <Ionicons name="beer-outline" size={24} color={WATER_PRIMARY} />
                <Text style={styles.quickAddText}>750ml</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAddBtn, styles.customBtn]}
                onPress={() => add(100)}
              >
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <Text style={styles.customBtnText}>+ Custom</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* HYDRATION HISTORY */}
          {waterData.history.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.historySectionHeader}>
                <Text style={styles.historyTitle}>Hydration History</Text>
                <TouchableOpacity onPress={removeLast}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              {waterData.history.slice(0, 4).map((item, i) => (
                <View key={i} style={styles.historyItem}>
                  <View style={styles.historyIconContainer}>
                    <Ionicons
                      name={
                        item.ml >= 500
                          ? "water"
                          : item.ml >= 300
                          ? "water-outline"
                          : "fitness-outline"
                      }
                      size={20}
                      color={WATER_PRIMARY}
                    />
                  </View>

                  <View style={styles.historyContent}>
                    <Text style={styles.historyAmount}>{item.ml} ml</Text>
                    <Text style={styles.historyTime}>{item.time}</Text>
                  </View>

                  <TouchableOpacity style={styles.historyMenu}>
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          
        

          {/* STREAK & STATS */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Remaining</Text>
              <Text style={styles.statValue}>
                {Math.max(waterData.goal - waterData.current, 0)} ml
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Streak</Text>
              <Text style={styles.statValue}>{waterData.streak} days</Text>
            </View>
          </View>

          {/* RESET BUTTON */}
          <TouchableOpacity style={styles.resetButton} onPress={reset}>
            <Text style={styles.resetButtonText}>Reset Today's Water</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ---------------------------------------------------------
   STYLES
--------------------------------------------------------- */
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },

  // Circular Progress
  progressSection: {
    alignItems: "center",
    paddingVertical: 30,
  },
  circularProgress: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  svgCircle: {
    position: "absolute",
  },
  circleCenter: {
    alignItems: "center",
  },
  circleAmount: {
    fontSize: 48,
    fontWeight: "800",
    color: "#1F2937",
    marginTop: 8,
  },
  circleLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },

  // Goal Section
  goalSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  goalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  goalAmount: {
    fontSize: 18,
  },
  goalCurrent: {
    color: "#FF6B4A",
    fontWeight: "700",
  },
  goalSeparator: {
    color: "#9CA3AF",
  },
  goalTarget: {
    color: "#FF6B4A",
    fontWeight: "400",
  },
  goalUnit: {
    color: "#6B7280",
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: WATER_PRIMARY,
    borderRadius: 4,
  },

  // Quick Add Section
  quickAddSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 1,
    marginBottom: 12,
  },
  quickAddGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickAddBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  customBtn: {
    backgroundColor: "#FF6B4A",
  },
  customBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // History Section
  historySection: {
    marginBottom: 24,
  },
  historySectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B4A",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  historyTime: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  historyMenu: {
    padding: 4,
  },

  // Stats Section
  statsSection: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },

  // Reset Button
  resetButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
  },
});