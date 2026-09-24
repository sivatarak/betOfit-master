// app/(tabs)/water.tsx
import React, { useEffect, useCallback, useState, useMemo, useRef } from "react";
import auth from "@react-native-firebase/auth";
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
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import {
  onFirstAppOpen,
  schedulePostDrinkReminder,
  scheduleMorningReminders,
  scheduleDailyWaterReminders,
  checkLateAndNoDrink,
  cancelAllWaterNotifications,
} from "../utils/waterNotification";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { BlurView } from "expo-blur";
import { CustomLoader } from "../../components/CustomLoader";
import { useTheme } from "../../context/themecontext";
import { AmbientGlow } from "../../components/AmbientGlow";
import {
  loadWaterData,
  addWaterIntake,
  WEIGHT_KEY,
  WATER_KEY,
  WaterData,
  syncWaterWithBackend,
  deleteWaterFromBackend,
  resetWaterFromBackend,
} from "../utils/waterUtils";
import { useProfile } from "../../context/profileContext";
import Svg, {
  Circle,
  Path,
  Ellipse,
  Rect,
  G,
  Defs,
  RadialGradient as SvgRadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = Math.min(width * 0.42, 156);

export default function WaterScreen() {
  const { colors, theme } = useTheme();
  const isDark = theme === "dark";
  const { waterGoal, weight } = useProfile();
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customAmount, setCustomAmount] = useState("250");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [waterData, setWaterData] = useState<WaterData>({
    date: "",
    current: 0,
    goal: waterGoal || 2500,
    history: [],
    streak: 0,
  });

  const liquidFill = useSharedValue(0);
  const bubbleAnim = useRef(new RNAnimated.Value(0)).current;
  const heroImageMotion = useRef(new RNAnimated.Value(0)).current;

  const percentage = useMemo(() => {
    const goal = waterGoal || waterData.goal || 2500;
    if (goal === 0) return 0;
    return Math.min((waterData.current / goal) * 100, 100);
  }, [waterData.current, waterGoal, waterData.goal]);

  const remaining = Math.max((waterGoal || waterData.goal || 2500) - waterData.current, 0);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${Math.min(liquidFill.value * 100, 100)}%`,
  }));

  useEffect(() => {
    liquidFill.value = withTiming(percentage / 100, { duration: 800 });
  }, [percentage]);

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(bubbleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        RNAnimated.timing(bubbleAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(heroImageMotion, { toValue: 1, duration: 4200, useNativeDriver: true }),
        RNAnimated.timing(heroImageMotion, { toValue: 0, duration: 4200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [heroImageMotion]);

  const heroImageScale = heroImageMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });

  useEffect(() => {
    const load = async () => {
      try {
        await onFirstAppOpen();
        const goalValue = waterGoal > 0 ? waterGoal : 2500;
        const data = await loadWaterData(weight || 70);
        setWaterData({ ...data, goal: goalValue });
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
  }, []);

  useEffect(() => {
    if (waterGoal > 0 && !loading) {
      setWaterData((prev) => ({ ...prev, goal: waterGoal }));
    }
  }, [waterGoal, loading]);

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
          setWaterData((prev) => ({ ...data, goal: waterGoal > 0 ? waterGoal : prev.goal }));
        }
      };
      refresh();
    }, [loading, weight, waterGoal])
  );

  const add = async (amount: number) => {
    if (saving || amount <= 0) return false;
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const updated = await addWaterIntake(amount);
      setWaterData(updated);
      await schedulePostDrinkReminder();
      return true;
    } catch (error) {
      console.log("Water add error:", error);
      Alert.alert("Could not add water", "Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeLast = async () => {
    if (waterData.history.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lastAmount = waterData.history[0].ml;
    const newCurrent = Math.max(0, waterData.current - lastAmount);
    const newHistory = waterData.history.slice(1);
    const updated: WaterData = { ...waterData, current: newCurrent, history: newHistory };
    await AsyncStorage.setItem(WATER_KEY, JSON.stringify(updated));
    setWaterData(updated);
    const userId = auth().currentUser?.uid;
    if (userId) {
      await deleteWaterFromBackend(userId);
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
            await cancelAllWaterNotifications();
            await scheduleMorningReminders();
            const userId = auth().currentUser?.uid;
            if (userId) {
              await resetWaterFromBackend(userId);
            }
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
      add(val).then((added) => {
        if (added) {
          setShowCustomModal(false);
          setCustomAmount("250");
        }
      });
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

  const styles = getStyles(colors, theme);

  return (
    <LinearGradient colors={[colors.background, colors.card]} style={styles.container}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
      <AmbientGlow />

      <SafeAreaView
        style={styles.safeArea}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={contentHeight > viewportHeight + 1}
          onContentSizeChange={(_, height) => setContentHeight(height)}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleRow}>
              <Ionicons name="water" size={19} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Hydration</Text>
            </View>
          </View>
          <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>{statusMessage}</Text>

          {/* HERO: RING + ILLUSTRATION */}
          <View style={styles.heroCard}>
            <RNAnimated.Image
              source={{ uri: "https://images.pexels.com/photos/4853255/pexels-photo-4853255.jpeg?auto=compress&cs=tinysrgb&w=1200" }}
              resizeMode="cover"
              style={[styles.heroImage, { transform: [{ scale: heroImageScale }] }]}
            />
            <View style={styles.heroImageOverlay} />
            <View style={styles.heroRow}>
              <WaterCircularProgress
                current={waterData.current}
                goal={waterGoal || waterData.goal || 2500}
                remaining={remaining}
                percentage={percentage}
                colors={colors}
              />
              <View style={styles.heroCopy}>
                <Ionicons name="water" size={22} color={colors.primaryLight || colors.primary} />
                <Text numberOfLines={2} style={styles.heroCopyTitle}>Hydrate as you train</Text>
                <Text numberOfLines={2} style={styles.heroCopyText}>Small sips keep your energy steady.</Text>
              </View>
            </View>

            <View style={styles.heroTelemetryBar}>
              <View style={styles.telemetryDotRow}>
                <View style={[styles.telemetryDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.telemetryText}>
                  Goal: <Text style={styles.telemetryTextStrong}>{(waterGoal || waterData.goal || 2500).toLocaleString()} ml</Text>
                </Text>
              </View>
              <Text style={styles.telemetrySeparator}>|</Text>
              <View style={styles.telemetryDotRow}>
                <View style={[styles.telemetryDot, { backgroundColor: colors.secondary }]} />
                <Text style={styles.telemetryText}>
                  Drunk: <Text style={[styles.telemetryTextStrong, { color: colors.secondary }]}>{waterData.current.toLocaleString()} ml</Text>
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressBarStyle]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{Math.round(percentage)}% complete</Text>
              <Text style={styles.progressLabel}>{remaining.toLocaleString()} ml left</Text>
            </View>
          </View>

          {/* QUICK INTAKE */}
          <View style={styles.quickIntakeSection}>
            <View style={styles.quickIntakeHeaderRow}>
              <View>
                <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>ONE TAP</Text>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Quick Intake</Text>
              </View>
              <Text style={styles.quickIntakeHint}>{saving ? "Saving..." : "Choose a serving"}</Text>
            </View>

            <View style={styles.quickIntakeGrid}>
              <TouchableOpacity disabled={saving} style={styles.quickIntakeButton} onPress={() => add(250)} activeOpacity={0.85}>
                <View style={styles.quickIntakeCopyStandalone}>
                  <Text style={styles.quickIntakeAmount}>+250 ml</Text>
                  <Text style={styles.quickIntakeSub}>Glass</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity disabled={saving} style={styles.quickIntakeButton} onPress={() => add(500)} activeOpacity={0.85}>
                <View style={styles.quickIntakeCopyStandalone}>
                  <Text style={styles.quickIntakeAmount}>+500 ml</Text>
                  <Text style={styles.quickIntakeSub}>Bottle</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity disabled={saving} style={styles.quickIntakeButton} onPress={() => add(750)} activeOpacity={0.85}>
                <View style={styles.quickIntakeCopyStandalone}>
                  <Text style={styles.quickIntakeAmount}>+750 ml</Text>
                  <Text style={styles.quickIntakeSub}>Flask</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={showCustomAmountPrompt} activeOpacity={0.85} style={styles.quickIntakeCustomWrap}>
                <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.quickIntakeCustom}>
                  <View style={styles.quickIntakeCopyStandalone}>
                    <Text style={styles.quickIntakeCustomLabel}>Custom</Text>
                    <Text style={styles.quickIntakeCustomSub}>Amount</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* TELEMETRY CARDS */}
          <View style={styles.telemetryCardsRow}>
            <View style={styles.telemetryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.telemetryCardLabel}>Remaining</Text>
                <Text style={[styles.telemetryCardValue, { color: colors.text }]}>
                  {remaining} <Text style={styles.telemetryCardUnit}>ml</Text>
                </Text>
              </View>
            </View>

            <View style={styles.telemetryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.telemetryCardLabel}>Streak</Text>
                <Text style={[styles.telemetryCardValue, { color: colors.text }]}>
                  {waterData.streak} <Text style={styles.telemetryCardUnit}>Days</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* TODAY'S LOGS */}
          {waterData.history.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>Today's Logs</Text>
                <TouchableOpacity onPress={removeLast} style={styles.historyUndoButton}>
                  <Text style={styles.historyUndoText}>Undo last</Text>
                </TouchableOpacity>
              </View>

              {waterData.history.slice(0, showAllLogs ? 30 : 3).map((item, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyItemMain}>
                    <Text style={[styles.historyItemTitle, { color: colors.text }]}>
                      {item.ml >= 500 ? "Pure Water" : item.ml >= 300 ? "Water" : "Small Sip"}
                    </Text>
                    <Text style={styles.historyItemTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.historyItemAmount}>+{item.ml}ml</Text>
                </View>
              ))}
              {waterData.history.length > 3 && (
                <TouchableOpacity
                  onPress={() => setShowAllLogs((visible) => !visible)}
                  activeOpacity={0.75}
                  style={styles.historyExpandButton}
                >
                  <Text style={styles.historyExpandText}>
                    {showAllLogs ? "Show less" : `View all ${waterData.history.length} logs`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* RESET */}
          <TouchableOpacity onPress={reset} activeOpacity={0.7} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset today's intake</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* CUSTOM AMOUNT MODAL */}
      <Modal visible={showCustomModal} transparent animationType="slide" onRequestClose={() => setShowCustomModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Water</Text>
            <Text style={styles.modalSubtitle}>Enter amount in ml</Text>

            <TextInput
              style={styles.modalInput}
              value={customAmount}
              onChangeText={setCustomAmount}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowCustomModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.modalAddButton]} onPress={handleCustomAdd}>
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading && <CustomLoader fullScreen />}
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Circular hydration ring (left side of hero)
// ---------------------------------------------------------------------------
function WaterCircularProgress({
  current,
  goal,
  remaining,
  percentage,
  colors,
}: {
  current: number;
  goal: number;
  remaining: number;
  percentage: number;
  colors: any;
}) {
  const size = CIRCLE_SIZE;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(percentage, 100) / 100);

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.primary} />
            <Stop offset="100%" stopColor={colors.primaryLight || colors.secondary} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#2a2a2a" strokeWidth={strokeWidth} fill="none" />
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
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Ionicons name="water" size={16} color={colors.primary} style={{ marginBottom: 1 }} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{remaining.toLocaleString()}</Text>
        <Text style={{ fontSize: 9, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5, marginTop: 1 }}>ML LEFT</Text>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary, marginTop: 2 }}>
          {Math.round(percentage)}% of goal
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Decorative cheerful "athlete with a drink" illustration (right side of
// hero) — ported from the mockup's SVG, purely visual/no data binding.
// ---------------------------------------------------------------------------
function HydrationIllustration({ colors }: { colors: any }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 180" fill="none">
      <Circle cx={138} cy={42} r={3} fill="#ffb690" opacity={0.6} />
      <Path d="M142 60 C142 62 140 64 138 64 C136 64 134 62 134 60 C134 57 138 52 138 52 C138 52 142 57 142 60 Z" fill={colors.primary} opacity={0.8} />
      <Circle cx={28} cy={38} r={2.5} fill={colors.primary} opacity={0.5} />

      {/* Torso */}
      <Path d="M52 135 L108 135 L102 180 L58 180 Z" fill="#201f1f" />
      <Path d="M58 135 C64 150 96 150 102 135 L98 180 L62 180 Z" fill="#2a2a2a" />
      <Path d="M78 140 L82 140 L82 180 L78 180 Z" fill={colors.primary} />

      {/* Neck & head */}
      <Path d="M72 118 L88 118 L88 136 L72 136 Z" fill="#e0c0b1" />
      <Ellipse cx={80} cy={94} rx={22} ry={24} fill="#e0c0b1" />

      {/* Hair / sweatband */}
      <Path d="M58 92 C56 70 70 60 88 60 C104 60 106 75 102 92 Z" fill="#353534" />
      <Rect x={58} y={80} width={44} height={10} rx={4} fill={colors.primary} />
      <Rect x={76} y={82} width={8} height={6} rx={2} fill="#ffdbca" />

      {/* Face */}
      <Path d="M71 93 C73 91 76 91 78 93" stroke="#201f1f" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M84 93 C86 91 89 91 91 93" stroke="#201f1f" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M74 104 C77 109 85 109 88 104" stroke="#552100" strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={68} cy={101} r={3} fill="#ffb690" opacity={0.6} />
      <Circle cx={94} cy={101} r={3} fill="#ffb690" opacity={0.6} />

      {/* Arms */}
      <Path d="M54 136 C42 148 38 165 44 180" stroke="#e0c0b1" strokeWidth={11} strokeLinecap="round" />
      <Path d="M106 136 C118 138 126 126 124 108" stroke="#e0c0b1" strokeWidth={11} strokeLinecap="round" />
      <Ellipse cx={123} cy={104} rx={6} ry={7} fill="#e0c0b1" />

      {/* Glass */}
      <G transform="translate(114, 76)">
        <Path d="M3 8 L17 8 L15 32 L5 32 Z" fill="rgba(255,182,144,0.25)" stroke="#e5e2e1" strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M4.5 14 L15.5 14 L14.5 30 L5.5 30 Z" fill={colors.primary} opacity={0.75} />
        <Rect x={7} y={15} width={5} height={5} rx={1} fill="#ffffff" opacity={0.8} transform="rotate(15 7 15)" />
        <Circle cx={16} cy={7} r={5} fill="#ffdcc5" stroke={colors.primary} strokeWidth={1.5} />
        <Path d="M16 2 L16 12 M11 7 L21 7" stroke="#ea580c" strokeWidth={1} />
      </G>
    </Svg>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    ambientGlowWrap: { position: "absolute", top: -110, left: "50%", marginLeft: -180 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "ios" ? 36 : 28,
      paddingBottom: 28,
    },

    // Header
    header: { flexDirection: "row", justifyContent: "flex-start", alignItems: "center", gap: 8, marginBottom: 4 },
    headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerTitle: { fontSize: 18, fontWeight: "800" },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    headerIconButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    statusMessage: { fontSize: 12, fontWeight: "600", marginBottom: 14 },

    // Hero
    heroCard: {
      borderRadius: 26,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 20,
      overflow: "hidden",
    },
    heroImage: { ...StyleSheet.absoluteFillObject, borderRadius: 26 },
    heroImageOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme === "dark" ? "rgba(0,0,0,0.46)" : "rgba(255,255,255,0.38)",
    },
    heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    heroCopy: { flex: 1, minWidth: 0, paddingLeft: 8, paddingRight: 2, justifyContent: "center" },
    heroCopyTitle: { marginTop: 8, fontSize: 15, lineHeight: 18, fontWeight: "900", color: colors.text, flexShrink: 1 },
    heroCopyText: { marginTop: 5, fontSize: 10.5, lineHeight: 14, fontWeight: "600", color: colors.textSecondary, flexShrink: 1 },
    heroTelemetryBar: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 12,
      backgroundColor: theme === "dark" ? "rgba(0,0,0,0.48)" : "rgba(255,255,255,0.72)",
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    telemetryDotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    telemetryDot: { width: 6, height: 6, borderRadius: 3 },
    telemetryText: { fontSize: 10.5, fontWeight: "500", color: colors.textSecondary },
    telemetryTextStrong: { fontWeight: "800", color: colors.text },
    telemetrySeparator: { color: colors.border, fontSize: 11 },
    progressTrack: {
      height: 7,
      borderRadius: 4,
      marginTop: 14,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    progressFill: {
      height: "100%",
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
    progressLabel: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

    // Quick intake
    quickIntakeSection: { marginBottom: 18 },
    quickIntakeHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
    sectionEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 3 },
    sectionLabel: { fontSize: 15, fontWeight: "900" },
    quickIntakeHint: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    quickIntakeGrid: { flexDirection: "row", justifyContent: "space-between" },
    quickIntakeButton: {
      width: "23.5%",
      minHeight: 82,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 9,
      paddingHorizontal: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickIntakeCopyStandalone: { width: "100%", alignItems: "center" },
    quickIntakeAmount: { fontSize: 15.5, fontWeight: "900", color: colors.text, letterSpacing: 0.1 },
    quickIntakeSub: { fontSize: 9.5, fontWeight: "600", color: colors.textSecondary, marginTop: 5 },
    quickIntakeCustomWrap: { width: "23.5%", minHeight: 82, borderRadius: 14, overflow: "hidden" },
    quickIntakeCustom: { flex: 1, justifyContent: "center", paddingVertical: 9, paddingHorizontal: 4 },
    quickIntakeCustomLabel: { fontSize: 15.5, fontWeight: "900", color: colors.background, letterSpacing: 0.1, textAlign: "center" },
    quickIntakeCustomSub: { fontSize: 9.5, fontWeight: "600", color: colors.background, marginTop: 5, textAlign: "center" },

    // Telemetry cards
    telemetryCardsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
    telemetryCard: {
      flex: 1,
      minHeight: 78,
      justifyContent: "center",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
    },
    telemetryCardLabel: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary, marginBottom: 2 },
    telemetryCardValue: { fontSize: 16, fontWeight: "800" },
    telemetryCardUnit: { fontSize: 11, fontWeight: "500", color: colors.textSecondary },

    // History
    historySection: { marginBottom: 16 },
    historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    historyTitle: { fontSize: 14, fontWeight: "800" },
    historyUndoButton: { paddingVertical: 5, paddingHorizontal: 2 },
    historyUndoText: { fontSize: 11, fontWeight: "800", color: colors.primary },
    historyItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    historyItemMain: { flex: 1, minWidth: 0 },
    historyItemTitle: { fontSize: 13, fontWeight: "700" },
    historyItemTime: { fontSize: 10.5, color: colors.textSecondary, marginTop: 1 },
    historyItemAmount: { fontSize: 14, fontWeight: "800", color: colors.primary },
    historyExpandButton: { alignSelf: "center", paddingVertical: 9, paddingHorizontal: 12 },
    historyExpandText: { fontSize: 11, fontWeight: "800", color: colors.primary },

    // Reset
    resetButton: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resetButtonText: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
    modalContainer: { width: "80%", borderRadius: 24, padding: 24, alignItems: "center", backgroundColor: colors.card },
    modalTitle: { fontSize: 19, fontWeight: "800", marginBottom: 6 },
    modalSubtitle: { fontSize: 13, marginBottom: 18, color: colors.textSecondary },
    modalInput: {
      width: "100%",
      padding: 15,
      borderRadius: 16,
      fontSize: 17,
      fontWeight: "700",
      textAlign: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.text,
      marginBottom: 22,
    },
    modalButtons: { flexDirection: "row", gap: 10, width: "100%" },
    modalButton: { flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: "center" },
    modalCancelButton: { borderWidth: 1, borderColor: colors.border },
    modalCancelText: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
    modalAddButton: { backgroundColor: colors.primary },
    modalAddText: { fontSize: 15, fontWeight: "700", color: colors.background },
  });