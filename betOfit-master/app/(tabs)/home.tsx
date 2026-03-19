// app/(tabs)/home.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
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
} from "react-native";
import { getUserId } from '../utils/mockAuth';
import { getDashboard } from '../services/profileApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Svg, Circle } from "react-native-svg";
import Animated, { FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";

import { useTheme } from "../../context/themecontext";
import { loadWaterData } from "../utils/waterUtils";

const { width } = Dimensions.get("window");

// Animated Progress Ring
const ProgressRing = ({
  progress,
  size = 100,
  strokeWidth = 8,
  color,
  backgroundColor,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  backgroundColor: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressValue = Math.min(progress, 100) / 100;
  const strokeDashoffset = circumference * (1 - progressValue);

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
    </View>
  );
};

export default function Home() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [userName, setUserName] = useState("Alex");
  const [greeting, setGreeting] = useState("Good morning");
  const [calories, setCalories] = useState(0);
  const [caloriesGoal, setCaloriesGoal] = useState(2000);
  const [water, setWater] = useState(0);
  const [waterGoal, setWaterGoal] = useState(3000);
  const [streak, setStreak] = useState(0);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const refreshData = useCallback(async () => {
    try {
      // Load from database first
      const userId = getUserId();
      const data = await getDashboard(userId);

      if (data) {
        setDashboard(data);
        setProfile(data.profile);

        // Update all stats from database
        setUserName(data.profile?.name || "Alex");
        setCalories(data.food?.calories || 0);
        setWater(data.water?.total || 0);
        setWaterGoal(data.profile?.water_goal || 3000);
        setCaloriesGoal(data.profile?.daily_calorie_goal || 2000);

        // Workout duration
        const duration = data.workouts?.duration || 0;

        // Set streak (you can calculate this from water history later)
        setStreak(0); // TODO: Calculate from water logs

        console.log('✅ Dashboard loaded from database:', {
          name: data.profile?.name,
          calories: data.food?.calories,
          calorieGoal: data.profile?.daily_calorie_goal,
          water: data.water?.total,
          waterGoal: data.profile?.water_goal,
          workoutDuration: duration,
        });
      }

      setGreeting(getGreeting());
    } catch (error) {
      console.log("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const userId = getUserId();
      const data = await getDashboard(userId);

      console.log('📊 Dashboard data:', data); // ← ADD THIS

      if (data) {
        setDashboard(data);
        setProfile(data.profile);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setLoading(false);
    }
  }
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const dailyProgress = Math.min((calories / caloriesGoal) * 100, 100);
  const totalDuration = dashboard?.workouts?.duration ||
    recentWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);

  // Quick Action Component
  const QuickAction = ({ icon, label, color, bgColor, onPress }: any) => (
    <TouchableOpacity
      style={[styles.quickAction, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: colors.card }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.text }}>Loading your dashboard...</Text>
      </View>
    );
  }

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
                <LinearGradient
                  colors={[colors.secondary, colors.primary]}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarText}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
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

          {/* DAILY GOAL CARD */}
          <LinearGradient
            colors={[colors.secondary, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.goalCard}
          >
            <View style={styles.goalCardContent}>
              <View style={styles.goalCardLeft}>
                <Text style={styles.goalCardLabel}>Daily Progress</Text>
                <Text style={styles.goalCardTitle}>
                  {Math.round(dailyProgress)}% of your daily task completed
                </Text>
                <TouchableOpacity
                  style={styles.goalCardButton}
                  onPress={() => router.push('/(tabs)/workout')}
                >
                  <Text style={styles.goalCardButtonText}>View Details</Text>
                </TouchableOpacity>
              </View>

              {/* Circular Progress */}
              <View style={styles.goalCardRing}>
                <Svg width={96} height={96} viewBox="0 0 96 96">
                  <Circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <Circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 * (1 - dailyProgress / 100)}
                    strokeLinecap="round"
                    rotation="-90"
                    originX="48"
                    originY="48"
                  />
                </Svg>
                <Text style={styles.goalCardRingText}>{Math.round(dailyProgress)}%</Text>
              </View>
            </View>

            {/* Decorative Pattern */}
            <View style={styles.goalCardDecoration} />
          </LinearGradient>

          {/* QUICK STATS ROW */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="flame" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{calories}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>kcal</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.secondary}20` }]}>
                <Ionicons name="timer-outline" size={24} color={colors.secondary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{totalDuration}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>min</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.accent}20` }]}>
                <Ionicons name="flash" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{streak}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>days</Text>
            </View>
          </View>

          {/* AI RECOMMENDATIONS */}



          {/* ACTIVITY RINGS */}
          <BlurView
            intensity={80}
            tint={theme === "dark" ? "dark" : "light"}
            style={[styles.activityCard, { borderColor: colors.border }]}
          >
            <View style={styles.activityHeader}>
              <Text style={[styles.activityTitle, { color: colors.text }]}>Activity Status</Text>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            </View>

            <View style={styles.activityContent}>
              <View style={styles.activityRings}>
                <Svg width={128} height={128} viewBox="0 0 128 128">
                  {/* Move Ring */}
                  <Circle
                    cx="64"
                    cy="64"
                    r="50"
                    stroke={colors.border}
                    strokeWidth="10"
                    fill="none"
                  />
                  <Circle
                    cx="64"
                    cy="64"
                    r="50"
                    stroke={colors.primary}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={314}
                    strokeDashoffset={62.8}
                    strokeLinecap="round"
                    rotation="-90"
                    originX="64"
                    originY="64"
                  />

                  {/* Exercise Ring */}
                  <Circle
                    cx="64"
                    cy="64"
                    r="36"
                    stroke={colors.border}
                    strokeWidth="10"
                    fill="none"
                  />
                  <Circle
                    cx="64"
                    cy="64"
                    r="36"
                    stroke={colors.secondary}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={226}
                    strokeDashoffset={90}
                    strokeLinecap="round"
                    rotation="-90"
                    originX="64"
                    originY="64"
                  />

                  {/* Water Ring */}
                  <Circle
                    cx="64"
                    cy="64"
                    r="22"
                    stroke={colors.border}
                    strokeWidth="10"
                    fill="none"
                  />
                  <Circle
                    cx="64"
                    cy="64"
                    r="22"
                    stroke={colors.accent}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={138}
                    strokeDashoffset={40}
                    strokeLinecap="round"
                    rotation="-90"
                    originX="64"
                    originY="64"
                  />
                </Svg>
              </View>

              <View style={styles.activityLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Move</Text>
                  <Text style={[styles.legendValue, { color: colors.text }]}>
                    {calories}/{caloriesGoal} kcal
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Exercise</Text>
                  <Text style={[styles.legendValue, { color: colors.text }]}>
                    {totalDuration}/60 min
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Water</Text>
                  <Text style={[styles.legendValue, { color: colors.text }]}>
                    {(water / 1000).toFixed(1)}/{(waterGoal / 1000).toFixed(1)}L
                  </Text>
                </View>
              </View>
            </View>
          </BlurView>

          {/* QUICK ACTIONS GRID */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          </View>

          <View style={styles.quickActionsGrid}>
            <QuickAction
              icon="barbell-outline"
              label="Log Workout"
              color={colors.primary}
              bgColor={`${colors.primary}15`}
              onPress={() => router.push('/(tabs)/workout')}
            />
            <QuickAction
              icon="water-outline"
              label="Add Water"
              color={colors.accent}
              bgColor={`${colors.accent}15`}
              onPress={() => router.push('/(app)/water')}
            />
            <QuickAction
              icon="restaurant-outline"
              label="Nutrients"
              color={colors.secondary}
              bgColor={`${colors.secondary}15`}
              onPress={() => router.push('/(app)/calories')}
            />

          </View>

          {/* BOTTOM PADDING */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* BOTTOM NAVIGATION */}
      <BlurView
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
      </BlurView>
    </View >
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
      paddingTop: Platform.OS === 'ios' ? 60 : 20, // Increase top padding
      paddingBottom: 100,
    },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 50,
      marginTop: Platform.OS === 'ios' ? 20 : 30, // Add this line
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

    // Goal Card
    goalCard: {
      borderRadius: 24,
      padding: 20,
      marginBottom: 24,
      overflow: 'hidden',
    },
    goalCardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    goalCardLeft: {
      flex: 1,
      marginRight: 16,
    },
    goalCardLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '600',
      marginBottom: 8,
    },
    goalCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      lineHeight: 24,
      marginBottom: 16,
    },
    goalCardButton: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    goalCardButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    goalCardRing: {
      position: 'relative',
      width: 96,
      height: 96,
      justifyContent: 'center',
      alignItems: 'center',
    },
    goalCardRingText: {
      position: 'absolute',
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    goalCardDecoration: {
      position: 'absolute',
      bottom: -16,
      right: -16,
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },

    // Stats Row
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    statIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
    },

    // Section Header
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    sectionLink: {
      fontSize: 14,
      fontWeight: '600',
    },

    // AI Recommendations
    aiScrollContent: {
      paddingRight: 20,
      gap: 16,
      marginBottom: 24,
    },
    aiCard: {
      width: 240,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      marginRight: 12,
    },
    aiImageContainer: {
      height: 120,
      position: 'relative',
    },
    aiBadgeContainer: {
      position: 'absolute',
      top: 12,
      left: 12,
      flexDirection: 'row',
      gap: 8,
    },
    aiBadge: {
      backgroundColor: 'rgba(0,0,0,0.3)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    aiLevelBadge: {
      backgroundColor: '#ff8e08',
    },
    aiBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    aiContent: {
      padding: 16,
    },
    aiTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    aiDescription: {
      fontSize: 12,
    },

    // Activity Card
    activityCard: {
      borderRadius: 24,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    activityTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    activityContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    activityRings: {
      width: 128,
      height: 128,
    },
    activityLegend: {
      flex: 1,
      gap: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      fontSize: 12,
      fontWeight: '600',
      width: 50,
    },
    legendValue: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
    },

    // Quick Actions Grid
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
    bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      paddingBottom: Platform.OS === 'ios' ? 34 : 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background, // Add solid background
      zIndex: 1000,
      elevation: 10,
    },
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