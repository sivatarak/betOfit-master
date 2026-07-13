import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Image,
  FlatList,
} from "react-native";
import { getDashboard } from '../services/profileApi';
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import auth from '@react-native-firebase/auth';
import { useTheme } from "../../context/themecontext";
import { CustomLoader } from '../../components/CustomLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '../../context/profileContext';
import { useToday } from '../../context/todayContext';
import { generateSmartSuggestion, SuggestionInput } from "../utils/smartsuggestionengine";
const { width } = Dimensions.get("window");
 
// Widget Card Component
const WidgetCard = ({ type, data, colors }: any) => {
  const styles = makeStyles(colors);
 
  // SECTION 1: WORKOUT PLAN
  if (type === 'workout') {
    const isWorkoutDay = data?.today?.is_workout_day;
    const isNewUser = data?.user?.is_new_user;
    const lastWeek = data?.last_week_same_day;
    const todayName = data?.today?.day_name;
 
    if (isWorkoutDay) {
      if (lastWeek) {
        // Established user - show last week's workout
        return (
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.widgetCard}
          >
            <View style={styles.widgetHeader}>
              <Ionicons name="barbell" size={28} color="#FFF" />
              <Text style={styles.widgetTitle}>Today's Workout Plan</Text>
            </View>
            <Text style={styles.widgetSubtitle}>
              Last {todayName} you did:
            </Text>
            <View style={styles.exercisesList}>
              {lastWeek.exercises.slice(0, 3).map((ex: any, i: number) => (
                <View key={i} style={styles.exerciseItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.exerciseText}>{ex.name}</Text>
                </View>
              ))}
            </View>
            <View style={styles.widgetStats}>
              <Text style={styles.widgetStatText}>
                ⏱️ {lastWeek.total_duration} min
              </Text>
              <Text style={styles.widgetStatText}>
                🔥 ~{lastWeek.total_calories_burned} kcal
              </Text>
            </View>
            <TouchableOpacity
              style={styles.widgetButton}
              onPress={() => router.push('/(tabs)/workout')}
            >
              <Text style={styles.widgetButtonText}>Start Workout</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>
        );
      }
 
      // Workout day, but no last-week history to show — covers BOTH brand
      // new users and existing users with no logged data for this weekday.
      return (
        <LinearGradient
          colors={[colors.background, '#FF8A00']}
          style={styles.widgetCard}
        >
          {/* Header */}
          <View style={styles.widgetHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="rocket" size={42} color="#FF8A00" />
            </View>
 
            <View style={{ marginLeft: 18 }}>
              <Text style={styles.widgetTitle}>
                {isNewUser ? 'Start Your Journey' : "Today's Workout"}
              </Text>
 
              <View style={styles.lineContainer}>
                <View style={styles.line} />
                <View style={styles.dot} />
              </View>
            </View>
          </View>
 
          {/* Main Text */}
          <Text style={[styles.widgetMessage, { color: colors.text }]}>
            {isNewUser
              ? 'Today is a perfect day to begin your fitness transformation.'
              : `${todayName} is a scheduled workout day — no history logged for it yet.`}
          </Text>
 
          <Text style={[styles.widgetSubtitle, { color: colors.text }]}>
            Try a full body workout to get started!
          </Text>
 
          {/* Button */}
          <TouchableOpacity
            style={[styles.widgetButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/workout')}
          >
            <View style={styles.buttonLeft}>
              <View style={styles.smallIconContainer}>
                <Ionicons name="barbell" size={28} color="#FF8A00" />
              </View>
 
              <Text style={styles.widgetButtonText}>Browse Exercises</Text>
            </View>
 
            <Ionicons name="arrow-forward" size={28} color="#FF8A00" />
          </TouchableOpacity>
        </LinearGradient>
      );
    }
 
    // Rest day (isWorkoutDay is false)
    return (
      <LinearGradient
        colors={[colors.background, '#10B981']}
        style={styles.widgetCard}
      >
        {/* Header */}
        <View style={styles.widgetHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="bed" size={42} color="#10B981" />
          </View>
 
          <View style={{ marginLeft: 18 }}>
            <Text style={styles.widgetTitle}>Rest Day</Text>
 
            <View style={styles.lineContainer}>
              <View style={[styles.line, { backgroundColor: '#10B981' }]} />
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            </View>
          </View>
        </View>
 
        {/* Main Text */}
        <Text style={[styles.widgetMessage, { color: colors.text }]}>
          Your muscles need proper recovery to grow stronger and perform better.
        </Text>
 
        <Text style={[styles.widgetSubtitle, { color: colors.text }]}>
          💧 Stay hydrated{"\n"}
          🧘 Light stretching recommended{"\n"}
          😴 Get 7–8 hours of sleep
        </Text>
 
        {/* Button */}
        <TouchableOpacity
          style={[styles.widgetButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/stats')}
        >
          <View style={styles.buttonLeft}>
            <View style={[styles.smallIconContainer, { borderColor: '#10B981' }]}>
              <Ionicons name="stats-chart" size={28} color="#10B981" />
            </View>
 
            <Text style={[styles.widgetButtonText, { color: '#10B981' }]}>
              View Progress
            </Text>
          </View>
 
          <Ionicons name="arrow-forward" size={28} color="#10B981" />
        </TouchableOpacity>
      </LinearGradient>
    );
  }
 
  // SECTION 2: SMART SUGGESTION
  if (type === 'suggestion') {
    const suggestion = data;
    if (!suggestion) return null;
 
    return (
      <LinearGradient
        colors={[suggestion.color, suggestion.color + 'CC']}
        style={styles.widgetCard}
      >
        <View style={styles.widgetHeader}>
          <Text style={styles.widgetIcon}>{suggestion.icon}</Text>
          <Text style={styles.widgetTitle}>{suggestion.title}</Text>
        </View>
        <Text style={styles.widgetMessage}>{suggestion.message}</Text>
        <Text style={styles.widgetSubtitle}>{suggestion.suggestion}</Text>
        {suggestion.action && (
          <TouchableOpacity
            style={styles.widgetButton}
            onPress={() => router.push(suggestion.actionRoute as any)}
          >
            <Text style={styles.widgetButtonText}>{suggestion.action}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    );
  }
 
  // SECTION 3: DAILY TIP
  if (type === 'tip') {
    const tips = [
      {
        icon: "💧",
        title: "Hydration Reminder",
        message: "Drink 2L of water before lunch for better energy levels throughout the day."
      },
      {
        icon: "🍖",
        title: "Protein Power",
        message: "High protein breakfast = better muscle gains and less hunger during the day."
      },
      {
        icon: "😴",
        title: "Recovery Matters",
        message: "7-8 hours of quality sleep speeds up muscle recovery by 30%."
      },
      {
        icon: "🔥",
        title: "Consistency Wins",
        message: "Small daily progress beats occasional perfection. Stay consistent!"
      }
    ];
 
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    return (
      <LinearGradient
        colors={[colors.background, '#935cf1']}
        style={styles.widgetCard}
      >
        {/* Header */}
        <View style={styles.widgetHeader}>
          <View style={styles.iconContainer}>
            <Text style={{ fontSize: 38 }}>{randomTip.icon}</Text>
          </View>
 
          <View style={{ marginLeft: 18 }}>
            <Text style={styles.widgetTitle}>{randomTip.title}</Text>
 
            <View style={styles.lineContainer}>
              <View style={styles.line} />
              <View style={styles.dot} />
            </View>
          </View>
        </View>
 
        {/* Message */}
        <Text style={[styles.widgetMessage, { color: colors.text }]}>
          {randomTip.message}
        </Text>
 
        {/* Button */}
        <TouchableOpacity
          style={[styles.widgetButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/stats')}
        >
          <View style={styles.buttonLeft}>
            <View style={styles.smallIconContainer}>
              <Ionicons name="stats-chart" size={28} color="#FF8A00" />
            </View>
 
            <Text style={styles.widgetButtonText}>Track Your Stats</Text>
          </View>
 
          <Ionicons name="arrow-forward" size={28} color="#FF8A00" />
        </TouchableOpacity>
      </LinearGradient>
    );
  }
 
  return null;
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
  // Widget carousel state
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
 
  // 🧪 TEST INFUSION — delete this useEffect when done testing.
  // Runs the pure-function test suite for the suggestion engine once on
  // mount, in dev builds only, and prints PASS/FAIL results to the
  // Metro/console log. Doesn't touch app state, home screen UI, or the
  // real generateSmartSuggestion call below.

 
  const widgetData = useMemo(() => {
    const widgets = [];
 
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isWorkoutDay = workoutDays.includes(todayName);
 
    const workoutWidgetData = {
      today: {
        is_workout_day: isWorkoutDay,
        day_name: todayName,
        workout: { completed: todayBurned > 0 },
      },
      user: {
        is_new_user: isNewUser,
      },
      last_week_same_day: lastWeekWorkout,
    };
 
    widgets.push({ type: 'workout', data: workoutWidgetData });
 
    if (smartSuggestion) {
      widgets.push({ type: 'suggestion', data: smartSuggestion });
    }
 
    widgets.push({ type: 'tip', data: null });
 
    return widgets;
  }, [lastWeekWorkout, isNewUser, todayBurned, smartSuggestion, workoutDays]);
 
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };
 
  const loadWorkoutWidget = useCallback(async () => {
    try {
      const historyStr = await AsyncStorage.getItem('WORKOUT_HISTORY');
 
      // Check if new user
      if (!historyStr || JSON.parse(historyStr).length === 0) {
        setIsNewUser(true);
        setLastWeekWorkout(null);
        return;
      }
 
      const history = JSON.parse(historyStr);
      setIsNewUser(false);
 
      // Get same day last week
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastWeekDate = lastWeek.toISOString().split('T')[0];
 
      const lastWeekWorkouts = history.filter(
        (w: any) => w.date === lastWeekDate
      );
 
      if (lastWeekWorkouts.length === 0) {
        setLastWeekWorkout(null);
        return;
      }
 
      setLastWeekWorkout({
        exercises: lastWeekWorkouts.map((w: any) => ({
          name: w.exerciseName
        })),
        total_duration: lastWeekWorkouts.reduce(
          (s: number, w: any) => s + (w.duration || 0), 0
        ),
        total_calories_burned: lastWeekWorkouts.reduce(
          (s: number, w: any) => s + (w.caloriesBurned || 0), 0
        ),
      });
 
    } catch (e) {
      console.log('Workout widget error:', e);
    }
  }, []);
 
  useEffect(() => {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const suggestion = generateSmartSuggestion({
      todayName,
      workoutDays,
      todayEaten,
      adjustedGoal,
      todayBurned,
    });
    setSmartSuggestion(suggestion);
  }, [todayEaten, adjustedGoal, todayBurned, workoutDays]);
 
  // Auto-rotate widgets
  useEffect(() => {
    const startAutoRotate = () => {
      autoRotateTimer.current = setInterval(() => {
        setCurrentWidgetIndex((prev) => {
          const len = widgetData.length;
          if (len === 0) return prev;
          const nextIndex = (prev + 1) % len;
          if (nextIndex < len) {
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
          }
          return nextIndex;
        });
      }, 30000); // 30 seconds
    };
 
    startAutoRotate();
 
    return () => {
      if (autoRotateTimer.current) {
        clearInterval(autoRotateTimer.current);
      }
    };
  }, [widgetData.length]);
 
  // Handle manual scroll — only updates the tracked index.
  const onScroll = (event: any) => {
    const slideSize = width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentWidgetIndex(index);
  };
 
  // Timer only resets once a manual swipe actually finishes, instead of on
  // every scroll frame.
  const onMomentumScrollEnd = () => {
    if (autoRotateTimer.current) {
      clearInterval(autoRotateTimer.current);
    }
    autoRotateTimer.current = setInterval(() => {
      setCurrentWidgetIndex((prev) => {
        const len = widgetData.length;
        if (len === 0) return prev;
        const nextIndex = (prev + 1) % len;
        if (nextIndex < len) {
          flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        }
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
      if (photoURL) setUserPhoto(photoURL.split('=')[0]);
      setUserName(currentUser?.displayName || name || 'User');
      setGreeting(getGreeting());
 
      await loadWorkoutWidget();
 
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [loadWorkoutWidget, name]);
 
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
 
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
 
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                {userPhoto ? (
                  <Image
                    source={{ uri: userPhoto }}
                    style={styles.avatarImage}
                    onError={() => setUserPhoto(null)}
                  />
                ) : (
                  <LinearGradient
                    colors={[colors.secondary, colors.primary]}
                    style={styles.avatarGradient}
                  >
                    <Text style={styles.avatarText}>
                      {userName.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
                <View style={styles.onlineDot} />
              </View>
              <View>
                <Text style={[styles.welcomeLabel, { color: colors.textSecondary }]}>
                  {greeting}
                </Text>
                <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
              </View>
            </View>
            {/* <TouchableOpacity
              style={[styles.notificationButton, { backgroundColor: colors.card }]}
              onPress={() => Alert.alert('Notifications', 'No new notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
            </TouchableOpacity> */}
          </View>
 
          {/* AUTO-ROTATING WIDGET CAROUSEL */}
          <View style={styles.widgetContainer}>
            <FlatList
              ref={flatListRef}
              data={widgetData}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={width - 10}
              snapToAlignment="center"
              decelerationRate="fast"
              disableIntervalMomentum={true}
              contentContainerStyle={{ paddingHorizontal: 10 }}
              pagingEnabled
              onScroll={onScroll}
              onMomentumScrollEnd={onMomentumScrollEnd}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <WidgetCard type={item.type} data={item.data} colors={colors} />
              )}
              keyExtractor={(item, index) => `widget-${index}`}
            />
 
            {/* Dot Indicators */}
            <View style={styles.dotContainer}>
              {widgetData.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: currentWidgetIndex === index
                        ? colors.primary
                        : colors.textMuted,
                      width: currentWidgetIndex === index ? 20 : 8,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
 
          {/* TODAY'S BALANCE CARD */}
          <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.balanceHeader}>
              <Ionicons name="stats-chart" size={24} color={colors.primary} />
              <Text style={[styles.balanceTitle, { color: colors.text }]}>Today's Balance</Text>
            </View>
 
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Eaten</Text>
                <Text style={[styles.balanceValue, { color: colors.text }]}>{todayEaten} kcal</Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Goal</Text>
                <Text style={[styles.balanceValue, { color: colors.text }]}>{adjustedGoal} kcal</Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Burned</Text>
                <Text style={[styles.balanceValue, { color: colors.text }]}>{todayBurned} kcal</Text>
              </View>
            </View>
 
            <View style={styles.netCaloriesContainer}>
              <Text style={[styles.netCaloriesLabel, { color: colors.textSecondary }]}>Net</Text>
              <Text style={[styles.netCaloriesValue, { color: colors.primary }]}>
                {netCalories} / {adjustedGoal} kcal
              </Text>
            </View>
 
            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.min(dailyProgress, 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {Math.round(dailyProgress)}% of daily goal
            </Text>
          </View>
 
          {/* QUICK ACTIONS */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          </View>
 
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: `${colors.primary}15` }]}
              onPress={() => router.push('/(tabs)/calories')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.card }]}>
                <Ionicons name="restaurant-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>Log Food</Text>
            </TouchableOpacity>
 
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: `${colors.accent}15` }]}
              onPress={() => router.push('/(tabs)/water')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.card }]}>
                <Ionicons name="water-outline" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>Add Water</Text>
            </TouchableOpacity>
 
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: `${colors.secondary}15` }]}
              onPress={() => router.push('/(tabs)/workout')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.card }]}>
                <Ionicons name="barbell-outline" size={24} color={colors.secondary} />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>Workout</Text>
            </TouchableOpacity>
          </View>
 
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
 
      {loading && <CustomLoader fullScreen />}
    </View>
  );
}
 
const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
      paddingBottom: 100,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
      marginTop: Platform.OS === 'ios' ? 20 : 30,
    },
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarContainer: {
      position: 'relative',
      width: 56,
      height: 56,
    },
    avatarGradient: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    avatarText: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#10B981',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    welcomeLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    userName: {
      fontSize: 20,
      fontWeight: '700',
    },
    notificationButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    // Widget Carousel
    widgetContainer: {
      marginBottom: 24,
    },
    widgetCard: {
      marginHorizontal: 16.5,
      marginVertical: 17,
      padding: 15,
      width: width - 50,
 
      borderRadius: 24,
 
      borderWidth: 1.5,
      borderColor: '#FF8A00',
 
      shadowColor: '#FF8A00',
      shadowOffset: {
        width: 0,
        height: 0,
      },
      shadowOpacity: 0.4,
      shadowRadius: 8,
 
      elevation: 6,
    },
 
    widgetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 28,
    },
 
    iconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
 
      justifyContent: 'center',
      alignItems: 'center',
 
      borderWidth: 1.5,
      borderColor: '#FF8A00',
 
      shadowColor: '#FF8A00',
      shadowOpacity: 0.8,
      shadowRadius: 10,
 
      elevation: 10,
    },
 
    widgetTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FF8A00',
    },
 
    lineContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },
 
    line: {
      width: 90,
      height: 8,
      borderRadius: 10,
      backgroundColor: '#FF8A00',
    },
 
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#FF8A00',
      marginLeft: 12,
    },
 
    widgetMessage: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500',
 
      color: '#EAEAEA',
 
      marginBottom: 10,
    },
 
    widgetSubtitle: {
      fontSize: 13,
      lineHeight: 20,
 
      color: '#BDBDBD',
 
      marginBottom: 20,
    },
 
    buttonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
 
    smallIconContainer: {
      width: 45,
      height: 45,
      borderRadius: 22,
 
      justifyContent: 'center',
      alignItems: 'center',
 
      borderWidth: 1.5,
      borderColor: '#FF8A00',
 
      marginRight: 10,
    },
 
    widgetButtonText: {
      fontSize: 16,
      fontWeight: '700',
 
      color: '#FF8A00',
    },
 
    widgetIcon: {
      fontSize: 28,
    },
    exercisesList: {
      gap: 8,
      marginBottom: 12,
    },
    exerciseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    exerciseText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFF',
    },
    widgetStats: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
    },
    widgetStatText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
    },
    widgetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
 
      borderWidth: 1.5,
 
 
      borderRadius: 20,
 
      paddingVertical: 12,
      paddingHorizontal: 14,
 
      backgroundColor: colors.background,
 
 
      shadowOpacity: 0.5,
      shadowRadius: 6,
 
      elevation: 4,
 
      marginTop: 10,
    },
 
    dotContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
 
    // Balance Card
    balanceCard: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
    },
    balanceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    balanceTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    balanceItem: {
      alignItems: 'center',
    },
    balanceLabel: {
      fontSize: 12,
      marginBottom: 4,
    },
    balanceValue: {
      fontSize: 16,
      fontWeight: '700',
    },
    netCaloriesContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    netCaloriesLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    netCaloriesValue: {
      fontSize: 18,
      fontWeight: '800',
    },
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      textAlign: 'center',
    },
    // Quick Actions
    sectionHeader: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    quickAction: {
      width: (width - 52) / 2,
      padding: 16,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    quickActionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickActionLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    // Bottom Navigation
    navItem: {
      alignItems: 'center',
      gap: 4,
    },
    navText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
  });
 
