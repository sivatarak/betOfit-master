// app/(tabs)/workout.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Dimensions,
  ImageBackground,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useTheme } from '../../context/themecontext';

const { width } = Dimensions.get('window');

interface TodayStats {
  caloriesBurned: number;
  activeMinutes: number;
  exercisesCompleted: number;
  totalVolume: number;
  streak: number;
}

interface WorkoutLog {
  id: string;
  exerciseName: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  sets: Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>;
  totalVolume?: number;
}

interface WeeklyProgress {
  move: { current: number; goal: number; unit: string };
  exercise: { current: number; goal: number; unit: string };
  volume: { current: number; goal: number; unit: string };
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  achieved: boolean;
  date?: string;
}

// Helper function - defined outside component for global access
const formatNumber = (n: number): string => {
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'k';
  }
  return n.toString();
};

export default function WorkoutDashboard() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);

  const [userName, setUserName] = useState('Alex Rivers');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    caloriesBurned: 0,
    activeMinutes: 0,
    exercisesCompleted: 0,
    totalVolume: 0,
    streak: 0,
  });
  const [todayGoalPercentage, setTodayGoalPercentage] = useState(0);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutLog[]>([]);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress>({
    move: { current: 0, goal: 1000, unit: 'kcal' },
    exercise: { current: 0, goal: 150, unit: 'min' },
    volume: { current: 0, goal: 5000, unit: 'kg' },
  });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [motivationQuote, setMotivationQuote] = useState('');

  const pulseAnim = useSharedValue(1);

  const quotes = [
    "The only bad workout is the one that didn't happen.",
    "Your body can stand almost anything. It's your mind you have to convince.",
    "The pain you feel today will be the strength you feel tomorrow.",
    "Fitness is not about being better than someone else. It's about being better than you used to be.",
    "Push yourself because no one else is going to do it for you.",
    "Strive for progress, not perfection.",
  ];

  useEffect(() => {
    loadUserData();
    loadDashboardData();
    loadBadges();
    setMotivationQuote(quotes[Math.floor(Math.random() * quotes.length)]);

    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1,
      true
    );
  }, []);


  useEffect(() => {
    checkWorkoutSetup();
  }, []);

  const checkWorkoutSetup = async () => {
    const workoutDone = await AsyncStorage.getItem(STORAGE_KEYS.SETUP_WORKOUT_DONE);

    if (!workoutDone) {
      router.replace("/(auth)/profile-setup?mode=workout");
    }
  };
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      loadBadges();
    }, [])
  );
  const Section = ({
    title,
    right,
    onRightPress,
    children,
    colors,
  }: {
    title: string;
    right?: string;
    onRightPress?: () => void;
    children: React.ReactNode;
    colors: any;
  }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {right && (
          <TouchableOpacity onPress={onRightPress}>
            <Text style={[styles.sectionRight, { color: colors.primary }]}>{right}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );

  const ActionButton = ({ icon, label, onPress, colors, theme }: { icon: string; label: string; onPress: () => void; colors: any; theme: string }) => (
    <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={onPress}>
      <BlurView intensity={80} tint={theme === "dark" ? "dark" : "light"} style={[styles.actionBlur, { borderColor: colors.border }]}>
        <View style={[styles.actionIcon, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name={icon as any} size={26} color={colors.primary} />
        </View>
        <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </BlurView>
    </TouchableOpacity>
  );

  const LegendItem = ({
    color,
    label,
    current,
    goal,
    unit,
    colors,
  }: {
    color: string;
    label: string;
    current: number;
    goal: number;
    unit: string;
    colors: any;
  }) => (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: colors.textSecondary }]}>
        {label}: {formatNumber(current)} / {formatNumber(goal)} {unit}
      </Text>
    </View>
  );
  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem('USER_NAME');
      if (name) setUserName(name);
      const avatar = await AsyncStorage.getItem('USER_AVATAR');
      if (avatar) setUserAvatar(avatar);
    } catch (e) {
      console.log('User data load error:', e);
    }
  };

  const StatCard = ({ icon, label, value, colors, theme }: { icon: string; label: string; value: string; colors: any; theme: string }) => (
    <BlurView intensity={80} tint={theme === "dark" ? "dark" : "light"} style={[styles.statCard, { borderColor: colors.border }]}>
      <Ionicons name={icon as any} size={26} color={colors.primary} />
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </BlurView>
  );

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const historyStr = await AsyncStorage.getItem('WORKOUT_HISTORY');
      if (!historyStr) return;

      const history: WorkoutLog[] = JSON.parse(historyStr);
      const today = new Date().toISOString().split('T')[0];

      const todays = history.filter(w => w.date === today);

      const totalCal = todays.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
      const totalMin = todays.reduce((sum, w) => sum + (w.duration || 0), 0);
      const totalVol = todays.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

      const streak = calculateStreak(history);

      const goalPct = Math.min(Math.round((totalCal / 500) * 100), 100);

      setTodayStats({
        caloriesBurned: totalCal,
        activeMinutes: totalMin,
        exercisesCompleted: todays.length,
        totalVolume: totalVol,
        streak,
      });

      setTodayGoalPercentage(goalPct);

      const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentWorkouts(sorted.slice(0, 5));

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

      const weekly = history.filter(w => new Date(w.date) >= weekStart);

      setWeeklyProgress({
        move: { current: weekly.reduce((s, w) => s + (w.caloriesBurned || 0), 0), goal: 1000, unit: 'kcal' },
        exercise: { current: weekly.reduce((s, w) => s + (w.duration || 0), 0), goal: 150, unit: 'min' },
        volume: { current: weekly.reduce((s, w) => s + (w.totalVolume || 0), 0), goal: 5000, unit: 'kg' },
      });
    } catch (e) {
      console.log('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadBadges = async () => {
    try {
      const historyStr = await AsyncStorage.getItem('WORKOUT_HISTORY');
      if (!historyStr) return;

      const parsed: WorkoutLog[] = JSON.parse(historyStr);
      const streak = calculateStreak(parsed);

      const newBadges: Badge[] = [
        { id: '1', name: 'First Workout', icon: 'trophy', color: '#FFD700', achieved: parsed.length > 0, date: parsed[0]?.date },
        { id: '2', name: '7 Day Streak', icon: 'flame', color: colors.primary, achieved: streak >= 7 },
        { id: '3', name: '30 Day Streak', icon: 'flame', color: '#FF4500', achieved: streak >= 30 },
        { id: '4', name: 'Volume King', icon: 'barbell', color: '#4A90E2', achieved: parsed.some(w => (w.totalVolume || 0) > 1000) },
        { id: '5', name: 'Cardio Master', icon: 'heart', color: '#F59E0B', achieved: parsed.some(w => (w.caloriesBurned || 0) > 500) },
        { id: '6', name: '10 Workouts', icon: 'checkbox', color: '#10B981', achieved: parsed.length >= 10 },
        { id: '7', name: '50 Workouts', icon: 'star', color: '#8B5CF6', achieved: parsed.length >= 50 },
      ];

      setBadges(newBadges);
    } catch (e) {
      console.log('Badges load error:', e);
    }
  };

  const calculateStreak = (workouts: WorkoutLog[]): number => {
    if (!workouts.length) return 0;
    const uniqueDates = [...new Set(workouts.map(w => w.date))].sort().reverse();
    let streak = 0;
    let current = new Date();
    for (const dateStr of uniqueDates) {
      const workoutDate = new Date(dateStr);
      if (current.toISOString().split('T')[0] === dateStr) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getPercentage = (current: number, goal: number) => Math.min((current / goal) * 100, 100);

  const animatedPulse = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={[colors.secondary, colors.primary]} style={styles.loadingGradient}>
          <Animated.View style={[styles.loadingIcon, animatedPulse, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Ionicons name="barbell" size={64} color="#fff" />
          </Animated.View>
          <Text style={styles.loadingText}>Building your dashboard...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Hero Header */}
        <LinearGradient
          colors={[colors.secondary, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Daily Goal Card */}
          <BlurView intensity={30} tint={theme === "dark" ? "dark" : "light"} style={styles.goalCard}>
            <View style={styles.goalRow}>
              <View style={styles.goalLeft}>
                <Text style={[styles.goalTitle, { color: colors.text }]}>Today's Goal</Text>
                <Text style={[styles.goalSubtitle, { color: colors.textSecondary }]}>
                  {todayStats.caloriesBurned} / 500 kcal
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { backgroundColor: colors.accent }]} />
                </View>
              </View>

              {/* Circular Progress */}
              <View style={styles.circleWrapper}>
                <Svg width={80} height={80} viewBox="0 0 36 36">
                  <Defs>
                    <SvgLinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={colors.secondary} />
                      <Stop offset="100%" stopColor={colors.text} />
                    </SvgLinearGradient>
                  </Defs>
                  <Circle cx="18" cy="18" r="16" stroke="rgba(255,255,255,0.2)" strokeWidth="3.2" fill="none" />
                  <Circle
                    cx="18"
                    cy="18"
                    r="16"
                    stroke="url(#grad)"
                    strokeWidth="3.2"
                    fill="none"
                    strokeDasharray={`${todayGoalPercentage}, 100`}
                    strokeLinecap="round"
                    transform="rotate(-90 18 18)"
                  />
                </Svg>
                <Text style={[styles.percentText, { color: colors.text }]}>{todayGoalPercentage}%</Text>
              </View>
            </View>
          </BlurView>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <StatCard
              icon="flame"
              label="Burned"
              value={`${todayStats.caloriesBurned} kcal`}
              colors={colors}
              theme={theme}
            />
            <StatCard
              icon="timer-outline"
              label="Active"
              value={`${todayStats.activeMinutes} min`}
              colors={colors}
              theme={theme}
            />
            <StatCard
              icon="flame"
              label="Streak"
              value={`${todayStats.streak} ${todayStats.streak === 1 ? 'day' : 'days'}`}
              colors={colors}
              theme={theme}
            />
          </View>

          {/* Motivation Quote */}
          <Animated.View entering={FadeInDown.delay(120)} style={styles.quoteCard}>
            <BlurView intensity={70} tint={theme === "dark" ? "dark" : "light"} style={styles.quoteBlur}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={`${colors.primary}88`} />
              <Text style={[styles.quote, { color: colors.textSecondary }]} numberOfLines={3} ellipsizeMode="tail">
                "{motivationQuote}"
              </Text>
            </BlurView>
          </Animated.View>

          {/* Quick Actions */}
          <Section title="Quick Actions" colors={colors}>
            <View style={styles.actionsGrid}>
              <ActionButton
                icon="barbell"
                label="Exercises"
                onPress={() => router.push('/(tabs)/exercise-library')}
                colors={colors}
                theme={theme}
              />
              <ActionButton
                icon="analytics"
                label="Stats"
                onPress={() => Alert.alert('Coming soon', 'Statistics coming soon')}
                colors={colors}
                theme={theme}
              />
            </View>
          </Section>

          {/* Recent Workouts */}
          {recentWorkouts.length > 0 && (
            <Section
              title="Recent Workouts"
              right="See All"
              onRightPress={() => Alert.alert('All workouts', 'Feature coming soon')}
              colors={colors}
            >
              {recentWorkouts.slice(0, 3).map((w, i) => (
                <Animated.View key={w.id} entering={FadeInDown.delay(i * 80)}>
                  <BlurView intensity={70} tint={theme === "dark" ? "dark" : "light"} style={[styles.workoutItem, { backgroundColor: colors.card }]}>
                    <View style={styles.workoutIconBox}>
                      <LinearGradient
                        colors={[colors.secondary, colors.primary]}
                        style={styles.workoutIconBg}
                      >
                        <Ionicons name="barbell" size={26} color="#fff" />
                      </LinearGradient>
                    </View>
                    <View style={styles.workoutInfo}>
                      <Text style={[styles.workoutName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                        {w.exerciseName}
                      </Text>
                      <Text style={[styles.workoutMeta, { color: colors.textSecondary }]}>
                        {w.duration} min • {w.caloriesBurned} kcal
                      </Text>
                      {w.totalVolume ? (
                        <View style={[styles.volumeTag, { backgroundColor: `${colors.primary}15` }]}>
                          <Ionicons name="barbell" size={12} color={colors.primary} />
                          <Text style={[styles.volumeText, { color: colors.primary }]}>{formatNumber(w.totalVolume)} kg</Text>
                        </View>
                      ) : null}
                    </View>
                  </BlurView>
                </Animated.View>
              ))}
            </Section>
          )}

          {/* Weekly Activity Rings */}
          <Section title="Weekly Activity" colors={colors}>
            <BlurView intensity={70} tint={theme === "dark" ? "dark" : "light"} style={[styles.ringsCard, { borderColor: colors.border }]}>
              <View style={styles.ringsRow}>
                <View style={styles.ringsSvgContainer}>
                  <Svg width={130} height={130} viewBox="0 0 36 36">
                    <Circle cx="18" cy="18" r="16" stroke={colors.border} strokeWidth="3" fill="none" />
                    <Circle
                      cx="18"
                      cy="18"
                      r="16"
                      stroke={colors.primary}
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${getPercentage(weeklyProgress.move.current, weeklyProgress.move.goal)}, 100`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                    <Circle cx="18" cy="18" r="12" stroke={colors.border} strokeWidth="3" fill="none" />
                    <Circle
                      cx="18"
                      cy="18"
                      r="12"
                      stroke={colors.secondary}
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${getPercentage(weeklyProgress.exercise.current, weeklyProgress.exercise.goal)}, 100`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                    <Circle cx="18" cy="18" r="8" stroke={colors.border} strokeWidth="3" fill="none" />
                    <Circle
                      cx="18"
                      cy="18"
                      r="8"
                      stroke={colors.accent}
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${getPercentage(weeklyProgress.volume.current, weeklyProgress.volume.goal)}, 100`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  </Svg>
                  <View style={[styles.centerIcon, { backgroundColor: theme === 'dark' ? '#1E1E1E' : 'rgba(255,255,255,0.92)' }]}>
                    <Ionicons name="fitness" size={34} color={colors.primary} />
                  </View>
                </View>

                <View style={styles.legend}>
                  <LegendItem
                    color={colors.primary}
                    label="Move"
                    current={weeklyProgress.move.current}
                    goal={weeklyProgress.move.goal}
                    unit={weeklyProgress.move.unit}
                    colors={colors}
                  />
                  <LegendItem
                    color={colors.secondary}
                    label="Exercise"
                    current={weeklyProgress.exercise.current}
                    goal={weeklyProgress.exercise.goal}
                    unit={weeklyProgress.exercise.unit}
                    colors={colors}
                  />
                  <LegendItem
                    color={colors.accent}
                    label="Volume"
                    current={weeklyProgress.volume.current}
                    goal={weeklyProgress.volume.goal}
                    unit={weeklyProgress.volume.unit}
                    colors={colors}
                  />
                </View>
              </View>
            </BlurView>
          </Section>

          {/* Achievements */}
          <Section
            title="Achievements"
            right={`${badges.filter(b => b.achieved).length}/${badges.length}`}
            colors={colors}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgesRow}
            >
              {badges.map((b, i) => (
                <Animated.View key={b.id} entering={FadeIn.delay(i * 60)}>
                  <TouchableOpacity
                    style={[styles.badgeItem, !b.achieved && styles.badgeLocked]}
                    onPress={() =>
                      b.achieved && Alert.alert(b.name, b.date ? `Earned on ${b.date}` : 'Achieved!')
                    }
                    disabled={!b.achieved}
                  >
                    <BlurView intensity={70} tint={theme === "dark" ? "dark" : "light"} style={[styles.badgeBlur, { borderColor: colors.border }]}>
                      <View style={[styles.badgeIconBg, { backgroundColor: b.achieved ? b.color : colors.border }]}>
                        <Ionicons name={b.icon as any} size={28} color={b.achieved ? '#fff' : colors.textMuted} />
                      </View>
                      <Text style={[styles.badgeLabel, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">
                        {b.name}
                      </Text>
                    </BlurView>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
          </Section>

          {/* Start CTA */}
          <TouchableOpacity
            style={styles.startButton}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/exercise-library')}
          >
            <LinearGradient
              colors={[colors.secondary, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startGradient}
            >
              <Ionicons name="play-circle" size={28} color="#fff" />
              <Text style={styles.startText}>Start New Workout</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ────────────────────────────────────────────────
// Reusable Components
// ────────────────────────────────────────────────





// ────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 80,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 20,
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatar: { flex: 1 },
  avatarFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: '#fff' },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  name: { fontSize: 22, color: '#fff', fontWeight: '800' },

  notifButton: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  blurCircle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.8,
    borderColor: '#fff',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#222' },

  goalCard: {
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalLeft: { flex: 1 },
  goalTitle: { fontSize: 17, fontWeight: '800' },
  goalSubtitle: { fontSize: 14, marginVertical: 6 },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
    overflow: 'hidden',
    width: 140,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  circleWrapper: { position: 'relative', width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  percentText: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '800',
  },

  scroll: { flex: 1, marginTop: -52 },
  scrollContent: { paddingTop: 30, paddingBottom: 80 },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 24,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 0,
    borderWidth: 1,
  },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 17, fontWeight: '800' },

  quoteCard: { paddingHorizontal: 16, marginBottom: 28 },
  quoteBlur: {
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  quote: {
    flex: 1,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    fontWeight: '500',
  },

  section: { paddingHorizontal: 16, marginBottom: 36 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  sectionRight: { fontSize: 15, fontWeight: '600' },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  actionBtn: {
    width: (width - 46) / 2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  actionBlur: { padding: 16, alignItems: 'center', borderWidth: 1 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  workoutIconBox: { marginRight: 14 },
  workoutIconBg: {
    width: 58,
    height: 58,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutInfo: { flex: 1 },
  workoutName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  workoutMeta: { fontSize: 13, marginBottom: 6 },
  volumeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  volumeText: { fontSize: 12, fontWeight: '600' },

  ringsCard: { borderRadius: 28, padding: 20, borderWidth: 1 },
  ringsRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringsSvgContainer: { position: 'relative', width: 130, height: 130, justifyContent: 'center', alignItems: 'center' },
  centerIcon: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  legend: { flex: 1, gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 13, flex: 1 },

  badgesRow: { paddingBottom: 12, gap: 14 },
  badgeItem: { width: 100, borderRadius: 20, overflow: 'hidden' },
  badgeLocked: { opacity: 0.6 },
  badgeBlur: { padding: 14, alignItems: 'center', gap: 8, borderWidth: 1 },
  badgeIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },

  startButton: { marginHorizontal: 16, borderRadius: 28, overflow: 'hidden', marginBottom: 20 },
  startGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  startText: { fontSize: 18, fontWeight: '800', color: '#fff' },

  loadingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  loadingText: { fontSize: 18, fontWeight: '700', color: '#fff', opacity: 0.95 },
});