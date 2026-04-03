// app/(tabs)/water.tsx
import React, { useEffect, useState, useMemo, useRef } from "react";
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
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { CustomLoader } from '../../components/CustomLoader';
import { useTheme } from "../../context/themecontext";
import {
  loadWaterData,
  addWaterIntake,
  WEIGHT_KEY,
  WATER_KEY,
  WaterData,
} from "../utils/waterUtils";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = Math.min(width * 0.65, 280);

// Custom amount modal (will be implemented)
const CustomAmountModal = ({ visible, onClose, onAdd }: any) => {
  const [amount, setAmount] = useState("250");
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <BlurView intensity={80} tint="dark" style={styles.modalContainer}>
        <Text style={styles.modalTitle}>Custom Amount</Text>
        <View style={styles.modalInputContainer}>
          <TextInput
            style={styles.modalInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter ml"
          />
          <Text style={styles.modalUnit}>ml</Text>
        </View>
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalAdd, { backgroundColor: colors.primary }]}
            onPress={() => {
              const val = parseInt(amount);
              if (val > 0) onAdd(val);
              onClose();
            }}
          >
            <Text style={styles.modalAddText}>Add</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
};

export default function WaterScreen() {
  const { colors, theme } = useTheme();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [waterData, setWaterData] = useState<WaterData>({
    date: "",
    current: 0,
    goal: 2500,
    history: [],
    streak: 0,
  });
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Animated liquid fill value
  const liquidFill = useSharedValue(0);
  // For bubble animation
  const bubbleAnim = useRef(new RNAnimated.Value(0)).current;

  const percentage = useMemo(() => {
    if (waterData.goal === 0) return 0;
    return Math.min((waterData.current / waterData.goal) * 100, 100);
  }, [waterData.current, waterData.goal]);

  const remaining = Math.max(waterData.goal - waterData.current, 0);

  // Animate liquid fill when percentage changes
  useEffect(() => {
    liquidFill.value = withTiming(percentage / 100, {
      duration: 800,
    });
  }, [percentage]);

  // Bubble animation loop
  useEffect(() => {
    const animateBubbles = () => {
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
    };
    animateBubbles();
  }, []);

  const liquidStyle = useAnimatedStyle(() => {
    const fillHeight = interpolate(liquidFill.value, [0, 1], [0, 100]);
    return {
      clipPath: `inset(${100 - fillHeight}% 0 0 0)`,
    };
  });

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
              goal: waterData.goal,
              history: [],
              streak: waterData.streak,
            };
            await AsyncStorage.setItem(WATER_KEY, JSON.stringify(resetData));
            setWaterData(resetData);
          },
        },
      ]
    );
  };

  // if (loading) {
  //   return <CustomLoader fullScreen={true} />;
  // }

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : [colors.background, colors.card]}
        style={StyleSheet.absoluteFill}
      />

      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Hydration</Text>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Interactive Liquid Ring Section */}
          <View style={styles.liquidRingSection}>
            <View style={[styles.liquidRing, { borderColor: colors.surfaceContainerLow }]}>
              {/* Background Pulse */}
              <LinearGradient
                colors={[colors.primary, colors.primary + 'cc']}
                style={[styles.liquidRingPulse, { opacity: 0.1 }]}
              />

              {/* Liquid Fill */}
              <Animated.View style={[styles.liquidFill, liquidStyle]}>
                <LinearGradient
                  colors={[colors.primary + '40', colors.primary + '20']}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {/* Center Content */}
              <View style={styles.liquidRingCenter}>
                <Ionicons name="water-drop-outline" size={40} color={colors.primary} />
                <View style={styles.amountRow}>
                  <Text style={[styles.currentAmount, { color: colors.text }]}>
                    {waterData.current}
                  </Text>
                  <Text style={[styles.amountUnit, { color: colors.textSecondary }]}>ml</Text>
                </View>
                <Text style={[styles.goalText, { color: colors.textSecondary }]}>
                  Goal: {waterData.goal}ml
                </Text>
              </View>

              {/* Floating Bubbles */}
              <RNAnimated.View
                style={[
                  styles.bubble,
                  styles.bubble1,
                  {
                    opacity: bubbleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.3, 0.8, 0.3],
                    }),
                  }
                ]}
              />
              <RNAnimated.View
                style={[
                  styles.bubble,
                  styles.bubble2,
                  {
                    opacity: bubbleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.2, 0.6, 0.2],
                    }),
                  }
                ]}
              />
              <RNAnimated.View
                style={[
                  styles.bubble,
                  styles.bubble3,
                  {
                    opacity: bubbleAnim.interpolate({
                      inputRange: [0, 0.4, 0.8],
                      outputRange: [0.4, 0.9, 0.4],
                    }),
                  }
                ]}
              />
            </View>

            {/* Contextual Stats Card */}
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={[styles.statsCard, { borderColor: colors.border }]}
            >
              <View style={styles.statsCardHeader}>
                <View>
                  <Text style={[styles.statsCardTitle, { color: colors.text }]}>Hydration Goal</Text>
                  <Text style={[styles.statsCardSubtitle, { color: colors.textSecondary }]}>
                    {statusMessage}
                  </Text>
                </View>
                <Text style={[styles.statsCardPercent, { color: colors.primary }]}>
                  {Math.round(percentage)}%
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceContainerHigh }]}>
                <LinearGradient
                  colors={[colors.primary, colors.primary + 'cc']}
                  style={[styles.progressBarFill, { width: `${percentage}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </BlurView>
          </View>

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
                onPress={() => {
                  Alert.prompt(
                    "Custom Amount",
                    "Enter amount in ml",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Add",
                        onPress: (amount) => {
                          const val = parseInt(amount || "0");
                          if (val > 0) add(val);
                        },
                      },
                    ],
                    "plain-text",
                    "250"
                  );
                }}
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
            style={[styles.resetButton, { backgroundColor: colors.error + '10', borderColor: colors.error }]}
            onPress={reset}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.error} />
            <Text style={[styles.resetButtonText, { color: colors.error }]}>Reset Today's Water</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Navigation */}
      <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={[styles.bottomNav, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/(tabs)/home')}
        >
          <Ionicons name="home-outline" size={24} color={colors.textSecondary} />
          <Text style={[styles.navText, { color: colors.textSecondary }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/(tabs)/stats')}
        >
          <Ionicons name="bar-chart-outline" size={24} color={colors.textSecondary} />
          <Text style={[styles.navText, { color: colors.textSecondary }]}>Stats</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'cc']}
            style={styles.activeNavIcon}
          >
            <Ionicons name="water" size={24} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.navText, { color: colors.primary }]}>Hydrate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/(tabs)/workout')}
        >
          <Ionicons name="fitness-outline" size={24} color={colors.textSecondary} />
          <Text style={[styles.navText, { color: colors.textSecondary }]}>Activity</Text>
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  // Liquid Ring Section
  liquidRingSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  liquidRing: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    marginBottom: 20,
  },
  liquidRingPulse: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  liquidFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(170, 46, 19, 0.2)",
  },
  liquidRingCenter: {
    alignItems: "center",
    zIndex: 10,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  currentAmount: {
    fontSize: 48,
    fontWeight: "800",
  },
  amountUnit: {
    fontSize: 16,
    fontWeight: "600",
  },
  goalText: {
    fontSize: 12,
    marginTop: 4,
  },
  bubble: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  bubble1: {
    width: 12,
    height: 12,
    bottom: 30,
    left: 30,
  },
  bubble2: {
    width: 20,
    height: 20,
    top: 40,
    right: 25,
  },
  bubble3: {
    width: 8,
    height: 8,
    bottom: 60,
    right: 40,
  },

  // Stats Card
  statsCard: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  statsCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statsCardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  statsCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statsCardPercent: {
    fontSize: 28,
    fontWeight: "800",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },

  // Quick Add Section
  quickAddSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  quickAddGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickAddButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: "700",
  },
  customButton: {
    shadowColor: "#aa2e13",
  },
  customButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  statIconContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statUnit: {
    fontSize: 12,
    fontWeight: "600",
  },

  // History Section
  historySection: {
    marginBottom: 24,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
  },
  historyIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  historyIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  historyTitleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyTime: {
    fontSize: 11,
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: "700",
  },

  // Reset Button
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Bottom Navigation
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 12,
    borderTopWidth: 1,
    zIndex: 1000,
    elevation: 10,
  },
  navItem: {
    alignItems: "center",
    gap: 4,
  },
  navItemActive: {
    marginTop: -8,
  },
  activeNavIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#aa2e13",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navText: {
    fontSize: 10,
    fontWeight: "600",
  },
});