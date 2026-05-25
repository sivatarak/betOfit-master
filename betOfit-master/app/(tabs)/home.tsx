// app/(tabs)/home.tsx
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
const { width } = Dimensions.get("window");

// Widget Card Component
const WidgetCard = ({ type, data, colors }: any) => {
  // SECTION 1: WORKOUT PLAN
  if (type === 'workout') {
    const isWorkoutDay = data?.today?.is_workout_day;
    const isNewUser = data?.user?.is_new_user;
    const lastWeek = data?.last_week_same_day;
    const todayName = data?.today?.day_name;
    const styles = makeStyles(colors);
    if (isWorkoutDay && lastWeek) {
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
    } else if (isWorkoutDay && isNewUser) {
      // New user - encourage to start
      return (
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          style={styles.widgetCard}
        >
          <View style={styles.widgetHeader}>
            <Ionicons name="rocket" size={28} color="#FFF" />
            <Text style={styles.widgetTitle}>Start Your Journey!</Text>
          </View>
          <Text style={styles.widgetMessage}>
            Today is a perfect day to begin your fitness transformation.
          </Text>
          <Text style={styles.widgetSubtitle}>
            Try a full body workout to get started!
          </Text>
          <TouchableOpacity
            style={styles.widgetButton}
            onPress={() => router.push('/(tabs)/workout')}
          >
            <Text style={styles.widgetButtonText}>Browse Exercises</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </LinearGradient>
      );
    } else {
      // Rest day
      return (
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.widgetCard}
        >
          <View style={styles.widgetHeader}>
            <Ionicons name="bed" size={28} color="#FFF" />
            <Text style={styles.widgetTitle}>Rest Day</Text>
          </View>
          <Text style={styles.widgetMessage}>
            Your muscles need recovery to grow stronger.
          </Text>
          <Text style={styles.widgetSubtitle}>
            💧 Stay hydrated{'\n'}
            🧘 Light stretching recommended{'\n'}
            😴 Get 7-8 hours of sleep
          </Text>
          <TouchableOpacity
            style={styles.widgetButton}
            onPress={() => router.push('/(tabs)/stats')}
          >
            <Text style={styles.widgetButtonText}>View Your Progress</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </LinearGradient>
      );
    }
  }

  // SECTION 2: SMART SUGGESTION
  if (type === 'suggestion') {
    const suggestion = data;
    const styles = makeStyles(colors);
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
    const styles = makeStyles(colors);
    return (
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={styles.widgetCard}
      >
        <View style={styles.widgetHeader}>
          <Text style={styles.widgetIcon}>{randomTip.icon}</Text>
          <Text style={styles.widgetTitle}>{randomTip.title}</Text>
        </View>
        <Text style={styles.widgetMessage}>{randomTip.message}</Text>
        <TouchableOpacity
          style={styles.widgetButton}
          onPress={() => router.push('/(tabs)/stats')}
        >
          <Text style={styles.widgetButtonText}>Track Your Stats</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
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
  console.log('Welcome:', name);

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

  console.log('Today Eaten:', todayEaten);
  // FIND and REPLACE entire widgetData useMemo

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


  const generateSmartSuggestion = useCallback(() => {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isWorkoutDay = workoutDays.includes(todayName);
    const caloriesDiff = todayEaten - adjustedGoal;
    const workedOut = todayBurned > 0;

    if (isWorkoutDay) {
      if (caloriesDiff > 300 && !workedOut) {
        return {
          icon: "🔥",
          title: "Burn Extra Calories!",
          message: `You're ${Math.round(caloriesDiff)} kcal over your goal.`,
          suggestion: "Do a 30-min cardio session to burn ~250 kcal!",
          action: "Start Workout",
          actionRoute: "/(tabs)/workout",
          color: "#F97316"
        };
      }
      if (workedOut && caloriesDiff < -300) {
        return {
          icon: "💪",
          title: "Great Workout! Refuel!",
          message: `You're ${Math.abs(Math.round(caloriesDiff))} kcal under.`,
          suggestion: "Have a protein shake or healthy meal to recover!",
          action: "Log Food",
          actionRoute: "/(tabs)/calories",
          color: "#3B82F6"
        };
      }
      if (workedOut && Math.abs(caloriesDiff) < 200) {
        return {
          icon: "✅",
          title: "Perfect Balance!",
          message: "You hit your goals today!",
          suggestion: "Keep up the amazing work! 🎉",
          action: null,
          actionRoute: null,
          color: "#10B981"
        };
      }
      if (!workedOut && Math.abs(caloriesDiff) < 300) {
        return {
          icon: "💪",
          title: "Time for Workout!",
          message: `Today is ${todayName} - a workout day!`,
          suggestion: "Let's crush this workout!",
          action: "Start Workout",
          actionRoute: "/(tabs)/workout",
          color: "#8B5CF6"
        };
      }
    }

    if (!isWorkoutDay) {
      if (caloriesDiff > 300) {
        return {
          icon: "😬",
          title: "Rest Day Overeating",
          message: `You're ${Math.round(caloriesDiff)} kcal over.`,
          suggestion: "Try lighter meals tomorrow or add a light walk.",
          action: null,
          actionRoute: null,
          color: "#EF4444"
        };
      }
      return {
        icon: "😌",
        title: "Perfect Rest Day!",
        message: "Your body is recovering well.",
        suggestion: "Stay hydrated and sleep well!",
        action: null,
        actionRoute: null,
        color: "#10B981"
      };
    }

    return null;
  }, [todayEaten, adjustedGoal, todayBurned, workoutDays]);

  // ADD this useEffect after generateSmartSuggestion function
  useEffect(() => {
    const suggestion = generateSmartSuggestion();
    setSmartSuggestion(suggestion);
  }, [generateSmartSuggestion]);

  // Auto-rotate widgets
  useEffect(() => {
    const startAutoRotate = () => {
      autoRotateTimer.current = setInterval(() => {
        setCurrentWidgetIndex((prev) => {
          const nextIndex = (prev + 1) % widgetData.length;
          flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
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

  // Handle manual scroll
  const onScroll = (event: any) => {
    const slideSize = width - 40;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentWidgetIndex(index);

    // Reset auto-rotate timer on manual scroll
    if (autoRotateTimer.current) {
      clearInterval(autoRotateTimer.current);
      autoRotateTimer.current = setInterval(() => {
        setCurrentWidgetIndex((prev) => {
          const nextIndex = (prev + 1) % widgetData.length;
          flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
          return nextIndex;
        });
      }, 30000);
    }
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

  // if (loading) {
  //   return <CustomLoader fullScreen={true} />;
  // }

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
            <TouchableOpacity
              style={[styles.notificationButton, { backgroundColor: colors.card }]}
              onPress={() => Alert.alert('Notifications', 'No new notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* AUTO-ROTATING WIDGET CAROUSEL */}
          <View style={styles.widgetContainer}>
            <FlatList
              ref={flatListRef}
              data={widgetData}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              snapToInterval={width - 40}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 20 }}
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

      {/* BOTTOM NAVIGATION */}
      {/* <BlurView
        intensity={90}
        tint={theme === "dark" ? "dark" : "light"}
        style={[styles.bottomNav, { borderTopColor: colors.border }]}
      >
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={28} color={colors.primary} />
          <Text style={[styles.navText, { color: colors.primary }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/(tabs)/stats')}
        >
          <Ionicons name="bar-chart-outline" size={28} color={colors.textSecondary} />
          <Text style={[styles.navText, { color: colors.textSecondary }]}>Stats</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/(tabs)/history')}
        >
          <Ionicons name="time-outline" size={28} color={colors.textSecondary} />
          <Text style={[styles.navText, { color: colors.textSecondary }]}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/(auth)/profile-setup?mode=all')}
        >
          <Ionicons name="person-outline" size={28} color={colors.textSecondary} />
          <Text style={[styles.navText, { color: colors.textSecondary }]}>Profile</Text>
        </TouchableOpacity>
      </BlurView> */}
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
      padding: 20,
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
      width: width - 40,
      borderRadius: 20,
      padding: 20,
      marginRight: 0,
    },
    widgetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    widgetIcon: {
      fontSize: 28,
    },
    widgetTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#FFF',
      flex: 1,
    },
    widgetSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: 12,
      lineHeight: 20,
    },
    widgetMessage: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.95)',
      marginBottom: 16,
      lineHeight: 22,
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
      justifyContent: 'center',
      gap: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      marginTop: 4,
    },
    widgetButtonText: {
      color: '#FFF',
      fontSize: 15,
      fontWeight: '700',
    },
    dotContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
    dot: {
      height: 8,
      borderRadius: 4,
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