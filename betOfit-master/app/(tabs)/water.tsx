// app/(tabs)/water.tsx
import React, { useEffect, useCallback, useState, useMemo, useRef } from "react";
import auth from '@react-native-firebase/auth';
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
  Alert,
  Animated as RNAnimated,
  Modal,
  TextInput,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import {
  schedulePostDrinkReminder,
  scheduleMorningReminders,
  scheduleDailyWaterReminders,
  checkLateAndNoDrink,
  cancelAllWaterNotifications,
} from '../utils/waterNotification';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { BlurView } from "expo-blur";
import { CustomLoader } from '../../components/CustomLoader';
import { useTheme } from "../../context/themecontext";
import {
  loadWaterData,
  addWaterIntake,
  WEIGHT_KEY,
  WATER_KEY,
  WaterData,
  syncWaterWithBackend,
  deleteWaterFromBackend
} from "../utils/waterUtils";
import { useProfile } from '../../context/profileContext';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = Math.min(width * 0.65, 200);

export default function WaterScreen() {
  const { colors, theme } = useTheme();
  const isDark = theme === "dark";
  const { waterGoal, weight } = useProfile();
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customAmount, setCustomAmount] = useState("250");
  const [loading, setLoading] = useState(true);
  const [waterData, setWaterData] = useState<WaterData>({
    date: "",
    current: 0,
    goal: waterGoal || 2500,
    history: [],
    streak: 0,
  });

  // Animated liquid fill value
  const liquidFill = useSharedValue(0);
  const bubbleAnim = useRef(new RNAnimated.Value(0)).current;

  const percentage = useMemo(() => {
    const goal = waterGoal || waterData.goal || 2500;
    if (goal === 0) return 0;
    return Math.min((waterData.current / goal) * 100, 100);
  }, [waterData.current, waterGoal, waterData.goal]);

  const remaining = Math.max((waterGoal || waterData.goal || 2500) - waterData.current, 0);
  console.log("💧 WaterScreen render: current =", waterData.current, "goal =", waterGoal || waterData.goal, "percentage =", percentage.toFixed(2) + "%");
  console.log("💧 WaterScreen render: weight =", weight, "waterGoal =", waterGoal);
  // Animate liquid fill when percentage changes
  useEffect(() => {
    liquidFill.value = withTiming(percentage / 100, { duration: 800 });
  }, [percentage]);

  // Bubble animation
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(bubbleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(bubbleAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);



  // Load initial data - ONCE
  useEffect(() => {
    const load = async () => {
      try {
        const goalValue = waterGoal > 0 ? waterGoal : 2500;
        const data = await loadWaterData(weight || 70);
        setWaterData({
          ...data,
          goal: goalValue,
        });
        await scheduleMorningReminders();
        await scheduleDailyWaterReminders();
        await checkLateAndNoDrink(data.current);
      } catch (e) {
        console.log("Error loading hydration:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []); // Empty dependency - run once on mount

  // Update goal when profile context updates
  useEffect(() => {
    if (waterGoal > 0 && !loading) {
      setWaterData(prev => ({
        ...prev,
        goal: waterGoal
      }));
    }
  }, [waterGoal, loading]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        if (!loading) {
          await syncWaterWithBackend();
          const wStr = await AsyncStorage.getItem(WEIGHT_KEY);
          let w = weight || 70;
          if (wStr) {
            const parsed = parseFloat(wStr);
            if (parsed > 0) w = parsed;
          }
          const data = await loadWaterData(w);
          setWaterData(prev => ({
            ...data,
            goal: waterGoal > 0 ? waterGoal : prev.goal,
          }));
        }
      };
      refresh();
    }, [loading, weight, waterGoal])
  );

  const add = async (amount: number) => {
    console.log('💧 Adding water:', amount);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = await addWaterIntake(amount);
    console.log('💧 Updated water data:', updated);
    setWaterData(updated);
    await schedulePostDrinkReminder();
    // Force a re-render by setting state again
    setTimeout(() => {
      setWaterData(prev => ({ ...prev }));
    }, 100);
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
    // ✅ Now tells backend too
    const userId = auth().currentUser?.uid;
    if (userId && lastEntry.id) {
      await deleteWaterFromBackend(userId, lastEntry.id);
    }

  };

  const reset = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Reset Today's Water",
      "Are you sure you want to reset all water intake for today?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const today = new Date().toISOString().split("T")[0];
            const resetData: WaterData = {
              date: today,
              current: 0,
              goal: waterGoal || waterData.goal || 2500,
              history: [],
              streak: waterData.streak,
            };
            await AsyncStorage.setItem(WATER_KEY, JSON.stringify(resetData));
            setWaterData(resetData);
            // ← ADD THIS — cancel the 1-hour post-drink reminder on reset
            await cancelAllWaterNotifications();
            await scheduleMorningReminders(); //
          },
        },
      ]
    );
  };
  const showCustomAmountPrompt = () => {
    setCustomAmount("250");
    setShowCustomModal(true);
  };

  const handleCustomAdd = () => {
    const val = parseInt(customAmount || "0");
    if (val > 0) {
      add(val);
      setShowCustomModal(false);
      setCustomAmount("250");
    } else {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0");
    }
  };

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



  function WaterCircularProgress({ current, goal, remaining, colors }: {
    current: number;
    goal: number;
    remaining: number;
    colors: any;
  }) {
    const size = CIRCLE_SIZE;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min((current / goal) * 100, 100);
    const strokeDashoffset = circumference * (1 - percentage / 100);

    return (
      <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.secondary} />
              <Stop offset="100%" stopColor={colors.primary} />
            </SvgLinearGradient>
          </Defs>
          {/* Track ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.accent + "40"}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#waterGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {/* Center text */}
        <View style={{ position: "absolute", alignItems: "center" }}>
          <Ionicons name="water" size={22} color={colors.primary} style={{ marginBottom: 2 }} />
          <Text style={{ fontSize: 30, fontWeight: "800", color: colors.text }}>{remaining}</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginTop: 2 }}>ml left</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>


      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>

            <Text style={[styles.headerTitle, { color: colors.text }]}>Hydration</Text>

          </View>

          {/* Interactive Liquid Ring Section */}
          {/* Circular Progress Section */}
          <BlurView intensity={80} tint={theme === "dark" ? "dark" : "light"} style={[styles.goalCard, { borderColor: 'rgba(255,255,255,0.3)' }]}>
            <LinearGradient
              colors={[colors.secondary, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.goalCardBackground, { backgroundColor: `${colors.accent}10` }]} />
            <View style={styles.goalCardContent}>
              <WaterCircularProgress
                current={waterData.current}
                goal={waterGoal || waterData.goal || 2500}
                remaining={remaining}
                colors={colors}
              />
              <View style={styles.goalStats}>
                <View style={styles.goalStat}>
                  <Text style={[styles.goalStatLabel, { color: "rgba(255,255,255,0.7)" }]}>Goal</Text>
                  <Text style={[styles.goalStatValue, { color: colors.text }]}>{(waterGoal || waterData.goal || 2500).toLocaleString()}</Text>
                  <Text style={[styles.goalStatUnit, { color: "rgba(255,255,255,0.6)" }]}>ml</Text>
                </View>
                <View style={[styles.goalStatDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
                <View style={styles.goalStat}>
                  <Text style={[styles.goalStatLabel, { color: "rgba(255,255,255,0.7)" }]}>Drunk</Text>
                  <Text style={[styles.goalStatValue, { color: colors.text }]}>{waterData.current.toLocaleString()}</Text>
                  <Text style={[styles.goalStatUnit, { color: "rgba(255,255,255,0.6)" }]}>ml</Text>
                </View>
              </View>
            </View>
          </BlurView>
          <Modal
            visible={showCustomModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCustomModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Water</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Enter amount in ml</Text>

                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceContainerLow, color: colors.text, borderColor: colors.border }]}
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textMuted}
                  autoFocus={true}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
                    onPress={() => setShowCustomModal(false)}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalAddButton, { backgroundColor: colors.primary }]}
                    onPress={handleCustomAdd}
                  >
                    <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* Quick Add Grid */}
          <View style={styles.quickAddSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Quick Add</Text>
            <View style={styles.quickAddGrid}>
              <TouchableOpacity
                style={[styles.quickAddButton, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border }]}
                onPress={() => add(250)}
                activeOpacity={0.9}
              >
                <Ionicons name="water-outline" size={24} color={colors.primary} />
                <Text style={[styles.quickAddText, { color: colors.text }]}>250ml</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAddButton, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border }]}
                onPress={() => add(500)}
                activeOpacity={0.9}
              >
                <Ionicons name="water" size={24} color={colors.primary} />
                <Text style={[styles.quickAddText, { color: colors.text }]}>500ml</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAddButton, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.border }]}
                onPress={() => add(750)}
                activeOpacity={0.9}
              >
                <Ionicons name="beer-outline" size={24} color={colors.primary} />
                <Text style={[styles.quickAddText, { color: colors.text }]}>750ml</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAddButton, styles.customButton, { backgroundColor: colors.primary }]}
                onPress={showCustomAmountPrompt}
                activeOpacity={0.9}
              >
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <Text style={styles.customButtonText}>Custom</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Activity & Streak Stats */}
          <View style={styles.statsGrid}>
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={[styles.statCard, { borderColor: colors.border }]}
            >
              <View style={styles.statIconContainer}>
                <View style={[styles.statIconBg, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="hourglass-outline" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Remaining</Text>
              </View>
              <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: colors.text }]}>{remaining}</Text>
                <Text style={[styles.statUnit, { color: colors.textSecondary }]}>ml</Text>
              </View>
            </BlurView>

            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={[styles.statCard, { borderColor: colors.border }]}
            >
              <View style={styles.statIconContainer}>
                <View style={[styles.statIconBg, { backgroundColor: colors.secondary + '20' }]}>
                  <Ionicons name="flame-outline" size={20} color={colors.secondary} />
                </View>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak</Text>
              </View>
              <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: colors.text }]}>{waterData.streak}</Text>
                <Text style={[styles.statUnit, { color: colors.textSecondary }]}>Days</Text>
              </View>
            </BlurView>
          </View>

          {/* Daily History Log */}
          {waterData.history.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>Today's Logs</Text>
                <TouchableOpacity onPress={removeLast}>
                  <Ionicons name="trash-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {waterData.history.slice(0, 5).map((item, index) => (
                <BlurView
                  key={index}
                  intensity={80}
                  tint={isDark ? "dark" : "light"}
                  style={[styles.historyItem, { borderColor: colors.border }]}
                >
                  <View style={styles.historyIcon}>
                    <View style={[styles.historyIconBg, { backgroundColor: colors.primary + '10' }]}>
                      <Ionicons
                        name={item.ml >= 500 ? "water" : item.ml >= 300 ? "water-outline" : "cafe-outline"}
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <View>
                      <Text style={[styles.historyTitleText, { color: colors.text }]}>
                        {item.ml >= 500 ? "Pure Water" : item.ml >= 300 ? "Water" : "Small Sip"}
                      </Text>
                      <Text style={[styles.historyTime, { color: colors.textSecondary }]}>{item.time}</Text>
                    </View>
                  </View>
                  <Text style={[styles.historyAmount, { color: colors.primary }]}>+{item.ml}ml</Text>
                </BlurView>
              ))}
            </View>
          )}

          {/* Reset Button */}

          <TouchableOpacity
            onPress={reset}
            activeOpacity={0.7}
            style={{
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.error,
              backgroundColor: `${colors.error}18`,
            }}
          >
            <Ionicons name="refresh-outline" size={26} color={colors.error} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.error }}>Reset</Text>
          </TouchableOpacity>

          {/* Custom Amount Modal */}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
      {loading && <CustomLoader fullScreen />}
    </View>
  );
}

// Styles remain the same as yours, just remove the bottomNav styles if not used
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === "android" ? 24 : 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 20,
  },
  headerIcon: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  liquidRingSection: { alignItems: "center", marginBottom: 24 },
  liquidRing: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    marginBottom: 0,
  },
  liquidFill: { position: "absolute", bottom: 0, left: 0, right: 0 },
  liquidRingCenter: { alignItems: "center", zIndex: 10 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  currentAmount: { fontSize: 48, fontWeight: "800" },
  amountUnit: { fontSize: 16, fontWeight: "600" },
  goalText: { fontSize: 12, marginTop: 4 },
  bubble: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.4)" },
  bubble1: { width: 12, height: 12, bottom: 30, left: 30 },
  bubble2: { width: 20, height: 20, top: 40, right: 25 },
  bubble3: { width: 8, height: 8, bottom: 60, right: 40 },
  statsCard: { width: "100%", borderRadius: 20, padding: 20, overflow: "hidden", borderWidth: 1 },
  statsCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  statsCardTitle: { fontSize: 18, fontWeight: "700" },
  statsCardSubtitle: { fontSize: 12, marginTop: 2 },
  statsCardPercent: { fontSize: 28, fontWeight: "800" },
  progressBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  quickAddSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 12 },
  quickAddGrid: { flexDirection: "row", gap: 12 },
  quickAddButton: {
    flex: 1, aspectRatio: 1, borderRadius: 999, alignItems: "center", justifyContent: "center",
    gap: 6, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  quickAddText: { fontSize: 12, fontWeight: "700" },
  customButton: { shadowColor: "#aa2e13" },
  customButtonText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 20, padding: 16, overflow: "hidden", borderWidth: 1 },
  statIconContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  statIconBg: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  statLabel: { fontSize: 12, fontWeight: "600" },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  statValue: { fontSize: 24, fontWeight: "800" },
  statUnit: { fontSize: 12, fontWeight: "600" },
  historySection: { marginBottom: 24 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  historyTitle: { fontSize: 16, fontWeight: "700" },
  historyItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 16, marginBottom: 10, overflow: "hidden", borderWidth: 1 },
  historyIcon: { flexDirection: "row", alignItems: "center", gap: 12 },
  historyIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  historyTitleText: { fontSize: 14, fontWeight: "600" },
  historyTime: { fontSize: 11, marginTop: 2 },
  historyAmount: { fontSize: 16, fontWeight: "700" },
  resetButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 16, padding: 5, borderWidth: 1 },
  resetButtonText: { fontSize: 14, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalInput: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalAddButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  goalCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 24,
    padding: 45,
    overflow: "hidden",
    borderWidth: 1,
  },
  goalCardBackground: {
    position: "absolute",
    top: -96,
    right: -96,
    width: 192,
    height: 192,
    borderRadius: 96,
  },
  goalCardContent: {
    alignItems: "center",
    gap: 24,
  },
  goalStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  goalStat: {
    alignItems: "center",
  },
  goalStatLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  goalStatValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  goalStatUnit: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  goalStatDivider: {
    width: 1,
    height: 32,
  },
});