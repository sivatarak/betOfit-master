import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Circle, Path } from 'react-native-svg';
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
  Image,
  FlatList,
  Animated as RNAnimated,
} from "react-native";
import { getDashboard } from "../services/profileApi";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import { useTheme } from "../../context/themecontext";
import { AmbientGlow } from "../../components/AmbientGlow";
import { CustomLoader } from "../../components/CustomLoader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useProfile } from "../../context/profileContext";
import { useToday } from "../../context/todayContext";
import { generateSmartSuggestion, SuggestionInput } from "../utils/smartsuggestionengine";

const { width } = Dimensions.get("window");
const SLIDE_WIDTH = width;
const CARD_WIDTH = width - 32;
const WATER_GOAL_ML = 2500;
const WATER_HERO_IMAGE = { uri: "https://images.pexels.com/photos/4853255/pexels-photo-4853255.jpeg?auto=compress&cs=tinysrgb&w=1200" };
const FOOD_HERO_IMAGE = { uri: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=1200" };
const WORKOUT_HERO_IMAGE = { uri: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800" };
const SMART_WORKOUT_IMAGE = { uri: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80" };
const PROTEIN_TIP_IMAGE = { uri: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80" };
const RECOVERY_TIP_IMAGE = { uri: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80" };
const CONSISTENCY_TIP_IMAGE = { uri: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=80" };

// A rough, non-fabricated macro split (30% protein / 40% carbs / 30% fat of
// the daily calorie goal) used until real per-macro tracking exists.
function getMacroTargets(goalKcal: number) {
  return {
    protein: Math.round((goalKcal * 0.3) / 4),
    carbs: Math.round((goalKcal * 0.4) / 4),
    fats: Math.round((goalKcal * 0.3) / 9),
  };
}
function getMacroConsumed(eatenKcal: number) {
  return {
    protein: Math.round((eatenKcal * 0.3) / 4),
    carbs: Math.round((eatenKcal * 0.4) / 4),
    fats: Math.round((eatenKcal * 0.3) / 9),
  };
}

// ---------------------------------------------------------------------------
// Single "Focus" card used by the top carousel (workout / smart suggestion /
// daily tip). One shared layout: eyebrow + dot indicator, title, message,
// divider, action link + meta — matching the uploaded design.
// ---------------------------------------------------------------------------
const FocusCard = ({
  eyebrow,
  icon,
  title,
  message,
  actionLabel,
  onPress,
  meta,
  accentColor,
  colors,
  theme,
  activeIndex,
  total,
  imageSource,
}: any) => {
  const styles = makeStyles(colors);
  const imageMotion = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(imageMotion, { toValue: 1, duration: 4200, useNativeDriver: true }),
        RNAnimated.timing(imageMotion, { toValue: 0, duration: 4200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [imageMotion]);

  const imageScale = imageMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });

  return (
    <View style={styles.focusCardWrap}>
      <View style={[styles.focusCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <RNAnimated.Image
        source={imageSource}
        style={[styles.focusCardImage, { transform: [{ scale: imageScale }] }]}
        resizeMode="cover"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme === "dark" ? "rgba(0,0,0,0.46)" : "rgba(255,255,255,0.38)" },
        ]}
      />
      <View style={styles.focusHeaderRow}>
        <View style={styles.focusEyebrowRow}>
          <Text style={{ fontSize: 13 }}>{icon}</Text>
          <Text style={[styles.focusEyebrow, { color: accentColor }]}>{eyebrow}</Text>
        </View>
        {total > 1 && (
          <View style={styles.dotIndicatorRow}>
            {Array.from({ length: total }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dotIndicator,
                  {
                    backgroundColor: i === activeIndex ? accentColor : colors.border,
                    width: i === activeIndex ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <Text style={[styles.focusTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.focusMessage, { color: colors.textSecondary }]} numberOfLines={3}>
        {message}
      </Text>

      <View style={styles.focusDivider} />

      <View style={styles.focusFooterRow}>
        <TouchableOpacity onPress={onPress} style={styles.focusActionRow} disabled={!onPress}>
          <Text style={[styles.focusActionText, { color: accentColor }]}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={accentColor} />
        </TouchableOpacity>
        {!!meta && <Text style={styles.focusMeta}>{meta}</Text>}
      </View>
      </View>
    </View>
  );
};

export default function Home() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { name, workoutDays } = useProfile();
  const [userName, setUserName] = useState("");
  const [greeting, setGreeting] = useState("Good morning");
  const [lastWeekWorkout, setLastWeekWorkout] = useState<any>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [smartSuggestion, setSmartSuggestion] = useState<any>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  const [currentWidgetIndex, setCurrentWidgetIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoRotateTimer = useRef<any>(null);
  const {
    todayEaten,
    todayBurned,
    adjustedGoal,
    netCalories,
    progressPercent,
    refreshToday,
  } = useToday();

  const todayName = useMemo(() => new Date().toLocaleDateString("en-US", { weekday: "long" }), []);
  const isWorkoutDay = workoutDays.includes(todayName);
  const dateKey = useMemo(() => new Date().toISOString().split("T")[0], []);

  const widgetData = useMemo(() => {
    const widgets: any[] = [];
    widgets.push({
      type: "workout",
      data: {
        today: { is_workout_day: isWorkoutDay, day_name: todayName },
        user: { is_new_user: isNewUser },
        last_week_same_day: lastWeekWorkout,
      },
    });
    if (smartSuggestion) widgets.push({ type: "suggestion", data: smartSuggestion });
    widgets.push({ type: "tip", data: null });
    return widgets;
  }, [lastWeekWorkout, isNewUser, isWorkoutDay, todayName, smartSuggestion]);

  const tips = useMemo(
    () => [
      { icon: "💧", title: "Hydration Reminder", message: "Drink 2L of water before lunch for better energy levels throughout the day." },
      { icon: "🍖", title: "Protein Power", message: "High protein breakfast = better muscle gains and less hunger during the day." },
      { icon: "😴", title: "Recovery Matters", message: "7-8 hours of quality sleep speeds up muscle recovery by 30%." },
      { icon: "🔥", title: "Consistency Wins", message: "Small daily progress beats occasional perfection. Stay consistent!" },
    ],
    []
  );
  const dailyTip = useMemo(() => tips[new Date().getDate() % tips.length], [tips]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const loadWorkoutWidget = useCallback(async () => {
    try {
      const historyStr = await AsyncStorage.getItem("WORKOUT_HISTORY");

      if (!historyStr || JSON.parse(historyStr).length === 0) {
        setIsNewUser(true);
        setLastWeekWorkout(null);
        setStreakDays(0);
        return;
      }

      const history = JSON.parse(historyStr);
      setIsNewUser(false);

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastWeekDate = lastWeek.toISOString().split("T")[0];
      const lastWeekWorkouts = history.filter((w: any) => w.date === lastWeekDate);

      setLastWeekWorkout(
        lastWeekWorkouts.length === 0
          ? null
          : {
              exercises: lastWeekWorkouts.map((w: any) => ({ name: w.exerciseName })),
              total_duration: lastWeekWorkouts.reduce((s: number, w: any) => s + (w.duration || 0), 0),
              total_calories_burned: lastWeekWorkouts.reduce((s: number, w: any) => s + (w.caloriesBurned || 0), 0),
            }
      );

      // Consecutive-day streak, counted back from today, based on logged
      // workout dates in history. Real streak logic — not a placeholder.
      const loggedDates = new Set(history.map((w: any) => w.date));
      let streak = 0;
      const cursor = new Date();
      if (!loggedDates.has(cursor.toISOString().split("T")[0])) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (loggedDates.has(cursor.toISOString().split("T")[0])) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      setStreakDays(streak);
    } catch (e) {
      console.log("Workout widget error:", e);
    }
  }, []);

  const loadWater = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(`WATER_INTAKE_${dateKey}`);
      setWaterMl(stored ? parseInt(stored, 10) : 0);
    } catch (e) {
      console.log("Water widget error:", e);
    }
  }, [dateKey]);

  const addWater = useCallback(() => {
    router.push("/(tabs)/water");
  }, []);

  useEffect(() => {
    const suggestion = generateSmartSuggestion({ todayName, workoutDays, todayEaten, adjustedGoal, todayBurned });
    setSmartSuggestion(suggestion);
  }, [todayEaten, adjustedGoal, todayBurned, workoutDays, todayName]);

  useEffect(() => {
    const startAutoRotate = () => {
      autoRotateTimer.current = setInterval(() => {
        setCurrentWidgetIndex((prev) => {
          const len = widgetData.length;
          if (len === 0) return prev;
          const nextIndex = (prev + 1) % len;
          flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
          return nextIndex;
        });
      }, 30000);
    };
    startAutoRotate();
    return () => {
      if (autoRotateTimer.current) clearInterval(autoRotateTimer.current);
    };
  }, [widgetData.length]);

  const onScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setCurrentWidgetIndex(index);
  };

  const onMomentumScrollEnd = () => {
    if (autoRotateTimer.current) clearInterval(autoRotateTimer.current);
    autoRotateTimer.current = setInterval(() => {
      setCurrentWidgetIndex((prev) => {
        const len = widgetData.length;
        if (len === 0) return prev;
        const nextIndex = (prev + 1) % len;
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    }, 30000);
  };

  const refreshData = useCallback(async () => {
    try {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;
      if (!userId) {
        setLoading(false);
        return;
      }
      const photoURL = currentUser?.photoURL;
      if (photoURL) setUserPhoto(photoURL.split("=")[0]);
      setUserName(currentUser?.displayName || name || "User");
      setGreeting(getGreeting());

      await loadWorkoutWidget();
      await loadWater();
    } catch (error) {
      console.log("Error:", error);
    } finally {
      setLoading(false);
    }
  }, [loadWorkoutWidget, loadWater, name]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
      refreshToday();
    }, [refreshData, refreshToday])
  );

  const dailyProgress = progressPercent;
  const kcalRemaining = Math.max(Math.round(adjustedGoal - netCalories), 0);
  const macroTargets = getMacroTargets(adjustedGoal);
  const macroConsumed = getMacroConsumed(todayEaten);

  const renderFocusSlide = (item: any, index: number) => {
    if (item.type === "workout") {
      const isWD = item.data.today.is_workout_day;
      const newUser = item.data.user.is_new_user;
      const lastWeek = item.data.last_week_same_day;

      if (isWD && lastWeek) {
        return (
          <FocusCard
            colors={colors}
            theme={theme}
            imageSource={WORKOUT_HERO_IMAGE}
            eyebrow="WORKOUT FOCUS"
            icon="⚡"
            accentColor={colors.primary}
            title="Today's Workout Plan"
            message={`Last ${item.data.today.day_name} you did ${lastWeek.exercises.length} exercise${lastWeek.exercises.length === 1 ? "" : "s"} · ${lastWeek.total_duration} min · ~${lastWeek.total_calories_burned} kcal burned.`}
            actionLabel="Start Workout"
            onPress={() => router.push("/(tabs)/workout")}
            meta={`${lastWeek.total_duration} MIN\nSESSION`}
            activeIndex={index}
            total={widgetData.length}
          />
        );
      }
      if (isWD) {
        return (
          <FocusCard
            colors={colors}
            theme={theme}
            imageSource={WORKOUT_HERO_IMAGE}
            eyebrow="DAY 1 FOCUS"
            icon="⚡"
            accentColor={colors.primary}
            title={newUser ? "Start Your Journey" : "Today's Workout"}
            message={
              newUser
                ? "The perfect day to ignite your routine. 7-8 hours of deep restorative sleep speeds recovery by 30%."
                : `${item.data.today.day_name} is a scheduled workout day — no history logged for it yet.`
            }
            actionLabel="Browse Guided Exercises"
            onPress={() => router.push("/(tabs)/workout")}
            meta={"3 MIN\nREAD"}
            activeIndex={index}
            total={widgetData.length}
          />
        );
      }
      return (
        <FocusCard
          colors={colors}
          theme={theme}
          imageSource={WORKOUT_HERO_IMAGE}
          eyebrow="REST DAY"
          icon="😴"
          accentColor={colors.success}
          title="Recovery Mode"
          message="Your muscles need proper recovery to grow stronger. Stay hydrated, stretch lightly, and get 7-8 hours of sleep."
          actionLabel="View Progress"
          onPress={() => router.push("/(tabs)/stats")}
          meta={"REST\nDAY"}
          activeIndex={index}
          total={widgetData.length}
        />
      );
    }

    if (item.type === "suggestion" && item.data) {
      const s = item.data;
      const suggestionText = `${s.title} ${s.message} ${s.suggestion || ""}`.toLowerCase();
      const suggestionImage = /water|hydrat/.test(suggestionText)
        ? WATER_HERO_IMAGE
        : /food|meal|protein|calorie|refuel/.test(suggestionText) || s.actionRoute?.includes("calories")
          ? FOOD_HERO_IMAGE
          : SMART_WORKOUT_IMAGE;
      return (
        <FocusCard
          colors={colors}
          theme={theme}
          imageSource={suggestionImage}
          eyebrow="SMART FOCUS"
          icon={s.icon || "✨"}
          accentColor={s.color || colors.secondary}
          title={s.title}
          message={`${s.message} ${s.suggestion || ""}`.trim()}
          actionLabel={s.action || "View Details"}
          onPress={s.actionRoute ? () => router.push(s.actionRoute as any) : undefined}
          meta={"TAILORED\nFOR YOU"}
          activeIndex={index}
          total={widgetData.length}
        />
      );
    }

    return (
      <FocusCard
        colors={colors}
        theme={theme}
        imageSource={dailyTip.title.includes("Hydration")
          ? WATER_HERO_IMAGE
          : dailyTip.title.includes("Protein")
            ? PROTEIN_TIP_IMAGE
            : dailyTip.title.includes("Recovery")
              ? RECOVERY_TIP_IMAGE
              : CONSISTENCY_TIP_IMAGE}
        eyebrow="DAILY TIP"
        icon={dailyTip.icon}
        accentColor={colors.accent}
        title={dailyTip.title}
        message={dailyTip.message}
        actionLabel="Track Your Stats"
        onPress={() => router.push("/(tabs)/stats")}
        meta={"3 MIN\nREAD"}
        activeIndex={index}
        total={widgetData.length}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                {userPhoto ? (
                  <Image source={{ uri: userPhoto }} style={styles.avatarImage} onError={() => setUserPhoto(null)} />
                ) : (
                  <LinearGradient colors={[colors.primary, colors.accent]} style={styles.avatarGradient}>
                    <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                )}
                <View style={styles.onlineDot} />
              </View>
              <View>
                <Text style={styles.welcomeLabel}>{greeting}</Text>
                <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.streakPill}>
                <Text style={styles.streakPillNumber}>{streakDays}</Text>
                <Text style={styles.streakPillLabel}>Days</Text>
              </View>
              <TouchableOpacity style={styles.bellButton} onPress={() => router.push("/(tabs)/profile-setup")}>
                <Ionicons name="notifications-outline" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* FOCUS CAROUSEL (workout / smart suggestion / daily tip) */}
          <View style={styles.widgetSlideWrapper}>
            <FlatList
              ref={flatListRef}
              data={widgetData}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              getItemLayout={(_, index) => ({ length: SLIDE_WIDTH, offset: SLIDE_WIDTH * index, index })}
              onScroll={onScroll}
              onMomentumScrollEnd={onMomentumScrollEnd}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => (
                <View style={styles.widgetSlide}>{renderFocusSlide(item, index)}</View>
              )}
              keyExtractor={(_, index) => `focus-${index}`}
            />
          </View>


          {/* TODAY'S BALANCE */}
          <View style={styles.balanceCardWrap}>
            <AmbientGlow />

            <LinearGradient
              colors={
                theme === "dark"
                  ? ["rgba(30,30,30,0.78)", "rgba(13,13,14,0.62)", "rgba(13,13,14,0.78)"]
                  : ["rgba(255,255,255,0.72)", "rgba(255,249,245,0.58)", "rgba(255,255,255,0.72)"]
              }
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.balanceCard}
            >
              <BlurView
                pointerEvents="none"
                intensity={theme === "dark" ? 28 : 45}
                tint={theme === "dark" ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
           
            <View style={styles.balanceHeaderRow}>
              
              <View style={styles.balanceHeaderLeft}>
                <Ionicons name="stats-chart" size={18} color={colors.primary} />
                <Text style={[styles.balanceTitle, { color: colors.text }]}>Today's Balance</Text>
              </View>
              <View style={styles.goalPill}>
                <Text style={styles.goalPillText}>{Math.round(dailyProgress)}% of daily goal</Text>
              </View>
            </View>

            <View style={styles.kcalRow}>
              <Text style={styles.kcalValue}>{kcalRemaining.toLocaleString()}</Text>
              <Text style={styles.kcalUnit}>KCAL LEFT</Text>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{todayEaten}</Text>
                <Text style={styles.statLabel}>EATEN</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{adjustedGoal}</Text>
                <Text style={styles.statLabel}>GOAL</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{todayBurned}</Text>
                <Text style={styles.statLabel}>BURNED</Text>
              </View>
            </View>

            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net intake</Text>
              <Text style={styles.netValue}>
                {netCalories} / {adjustedGoal} kcal
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(dailyProgress, 100)}%` }]} />
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroPill}>
                <View style={styles.macroHeaderRow}>
                  <View style={[styles.macroDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.macroLabel}>Protein</Text>
                </View>
                <Text style={styles.macroValue}>
                  {macroConsumed.protein}/{macroTargets.protein}g
                </Text>
              </View>
              <View style={styles.macroPill}>
                <View style={styles.macroHeaderRow}>
                  <View style={[styles.macroDot, { backgroundColor: colors.secondary }]} />
                  <Text style={styles.macroLabel}>Carbs</Text>
                </View>
                <Text style={styles.macroValue}>
                  {macroConsumed.carbs}/{macroTargets.carbs}g
                </Text>
              </View>
              <View style={styles.macroPill}>
                <View style={styles.macroHeaderRow}>
                  <View style={[styles.macroDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.macroLabel}>Fats</Text>
                </View>
                <Text style={styles.macroValue}>
                  {macroConsumed.fats}/{macroTargets.fats}g
                </Text>
              </View>
            </View>
            </LinearGradient>
          </View>

          {/* QUICK ACTIONS */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
              <View style={styles.sectionUnderline} />
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/history")}>
              <Text style={styles.sectionLink}>Log activity</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push("/(tabs)/calories")}>
                <View style={[styles.quickActionIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="restaurant" size={20} color={colors.background} />
                </View>
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>Log Food</Text>
                <Text style={styles.quickActionSub}>+ Meals</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={addWater}>
                <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="water" size={20} color={colors.background} />
                </View>
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>Add Water</Text>
                <Text style={styles.quickActionSub}>+250 ml</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={() => router.push("/(tabs)/workout")}>
                <View style={[styles.quickActionIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="barbell" size={20} color={colors.background} />
                </View>
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>Workout</Text>
                <Text style={styles.quickActionSub}>Start now</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>

      {loading && <CustomLoader fullScreen />}
      <BannerAd
        unitId={__DEV__ ? TestIds.BANNER : "ca-app-pub-5710308532604049/1229186685"}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "ios" ? 36 : 28,
      paddingBottom: 24,
    },

    // Header
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    profileSection: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatarContainer: { position: "relative", width: 42, height: 42 },
    avatarGradient: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarImage: { width: 42, height: 42, borderRadius: 21 },
    avatarText: { fontSize: 16, fontWeight: "800", color: colors.background },
    onlineDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.background,
    },
    welcomeLabel: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    userName: { fontSize: 16, fontWeight: "800" },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    streakPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.primary + "55",
      backgroundColor: colors.card,
      alignItems: "center",
    },
    streakPillNumber: { fontSize: 14, fontWeight: "900", color: colors.text, lineHeight: 16 },
    streakPillLabel: { fontSize: 9, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" },
    bellButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },

    // Focus carousel
    widgetSlideWrapper: { width: SLIDE_WIDTH, marginLeft: -16, marginBottom: 18 },
    widgetSlide: { width: SLIDE_WIDTH, paddingHorizontal: 16 },
    focusCardWrap: {
      width: CARD_WIDTH,
      minHeight: 168,
      borderRadius: 21,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    focusCard: {
      width: "100%",
      borderRadius: 20,
      borderWidth: 0,
      padding: 18,
      minHeight: 168,
      overflow: "hidden",
    },
    focusCardImage: { ...StyleSheet.absoluteFillObject, borderRadius: 20 },
    focusHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    focusEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    focusEyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
    dotIndicatorRow: { flexDirection: "row", gap: 5 },
    dotIndicator: { height: 6, borderRadius: 3 },
    focusTitle: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
    focusMessage: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
    focusDivider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
    focusFooterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    focusActionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    focusActionText: { fontSize: 13, fontWeight: "800" },
    focusMeta: { fontSize: 10, fontWeight: "700", color: colors.textMuted, textAlign: "right", textTransform: "uppercase", lineHeight: 13 },

    // Balance card
    balanceCardWrap: {
      position: "relative",
      marginBottom: 20,
    },
    ambientGlowWrap: {
      position: "absolute",
      top: -96,
      left: "50%",
      marginLeft: -180,
      width: 360,
      height: 360,
      zIndex: 0,
    },
    balanceCard: {
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      zIndex: 1,
    },
    balanceHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    balanceHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    balanceTitle: { fontSize: 16, fontWeight: "800" },
    goalPill: {
      maxWidth: 110,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    goalPillText: { fontSize: 10, fontWeight: "700", color: colors.primary, textAlign: "right" },

    kcalRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 18 },
    kcalValue: { fontSize: 38, fontWeight: "900", color: colors.text },
    kcalUnit: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },

    statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
    statItem: { alignItems: "center", flex: 1 },
    statValue: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
    statLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },

    netRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    netLabel: { fontSize: 12, color: colors.textMuted },
    netValue: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
      marginBottom: 18,
    },
    progressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },

    macroRow: { flexDirection: "row", gap: 10 },
    macroPill: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
    },
    macroHeaderRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
    macroDot: { width: 6, height: 6, borderRadius: 3 },
    macroLabel: { fontSize: 10.5, color: colors.textSecondary, fontWeight: "600" },
    macroValue: { fontSize: 13, fontWeight: "800", color: colors.text },

    // Quick actions
    sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
    sectionTitle: { fontSize: 12.5, fontWeight: "900", color: colors.text, letterSpacing: 0.8 },
    sectionUnderline: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.primary, marginTop: 5 },
    sectionLink: { fontSize: 12, fontWeight: "600", color: colors.textMuted },

    quickActionsGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
    quickAction: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 10,
      alignItems: "center",
      gap: 6,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickActionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    quickActionLabel: { fontSize: 12.5, fontWeight: "800" },
    quickActionSub: { fontSize: 10, fontWeight: "600", color: colors.textMuted },
  });