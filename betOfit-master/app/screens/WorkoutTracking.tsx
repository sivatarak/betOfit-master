// app/screens/WorkoutTracking.tsx - UPDATED WITH PROPER IMPORTS
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';

// Import the hook from the correct path
import { useWorkoutTracking } from '../../hooks/useWorkout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WorkoutTrackingScreen() {
  const params = useLocalSearchParams();
  const workoutTracking = useWorkoutTracking();
  
  const [activeTab, setActiveTab] = useState<'workout' | 'nutrition' | 'progress'>('workout');
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [newFood, setNewFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    servingSize: '',
    mealType: 'lunch' as const,
  });

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'short', 
    day: 'numeric' 
  });

  // Handle starting a workout from package
  useEffect(() => {
    if (params.startWorkout === 'true' && params.workoutName) {
      const muscleGroups = params.muscleGroups 
        ? JSON.parse(params.muscleGroups as string)
        : ['chest'];
      
      workoutTracking.startWorkoutSession(
        params.workoutName as string,
        muscleGroups
      );
    }
  }, [params]);

  // Handle adding food
  const handleAddFood = () => {
    if (!newFood.name.trim() || !newFood.calories) {
      alert('Please enter food name and calories');
      return;
    }

    workoutTracking.addNutritionLog({
      name: newFood.name,
      calories: parseInt(newFood.calories) || 0,
      protein: parseInt(newFood.protein) || 0,
      carbs: parseInt(newFood.carbs) || 0,
      fat: parseInt(newFood.fat) || 0,
      servingSize: newFood.servingSize || '1 serving',
      mealType: newFood.mealType,
    });

    setNewFood({
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      servingSize: '',
      mealType: 'lunch',
    });
    setShowAddFoodModal(false);
  };

  // Get meal icon
  const getMealIcon = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return 'cafe';
      case 'lunch': return 'fast-food';
      case 'dinner': return 'restaurant';
      case 'snack': return 'nutrition';
      default: return 'fast-food';
    }
  };

  // Show loading state
  if (workoutTracking.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your data...</Text>
      </View>
    );
  }

  // Render workout tab
  const renderWorkoutTab = () => {
    const weeklyStats = workoutTracking.getWeeklyStats();
    const progressData = workoutTracking.getProgressChartData(7);
    const recentWorkouts = workoutTracking.getRecentWorkouts(3);

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Active Session */}
        {workoutTracking.activeSession && (
          <View style={styles.activeSessionCard}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.activeSessionGradient}
            >
              <View style={styles.activeSessionHeader}>
                <View>
                  <Text style={styles.activeSessionTitle}>Active Workout</Text>
                  <Text style={styles.activeSessionName}>
                    {workoutTracking.activeSession.workoutName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.resumeButton}
                  onPress={() => router.push('/screens/ActiveWorkout')}
                >
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.resumeButtonText}>Resume</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.activeSessionStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {workoutTracking.activeSession.exercises.filter(e => e.completed).length}
                  </Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {workoutTracking.activeSession.exercises.length}
                  </Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={20} color="#fff" />
                  <Text style={styles.statLabel}>In Progress</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Quick Start */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <View style={styles.quickStartGrid}>
            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => workoutTracking.startWorkoutSession('Quick Workout', ['chest', 'arms'])}
            >
              <View style={[styles.quickStartIcon, { backgroundColor: '#FF6B6B' }]}>
                <Ionicons name="flash" size={24} color="#fff" />
              </View>
              <Text style={styles.quickStartText}>Quick 20min</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => router.push('/workout-package')}
            >
              <View style={[styles.quickStartIcon, { backgroundColor: '#4ECDC4' }]}>
                <Ionicons name="barbell" size={24} color="#fff" />
              </View>
              <Text style={styles.quickStartText}>Packages</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => router.push('/(app)/workout')}
            >
              <View style={[styles.quickStartIcon, { backgroundColor: '#FFD166' }]}>
                <Ionicons name="fitness" size={24} color="#fff" />
              </View>
              <Text style={styles.quickStartText}>Exercises</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => setShowAddFoodModal(true)}
            >
              <View style={[styles.quickStartIcon, { backgroundColor: '#06D6A0' }]}>
                <Ionicons name="nutrition" size={24} color="#fff" />
              </View>
              <Text style={styles.quickStartText}>Log Food</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekly Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statCardValue}>{weeklyStats.totalSessions}</Text>
              <Text style={styles.statCardLabel}>Workouts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardValue}>
                {Math.round(weeklyStats.totalCaloriesBurned)}
              </Text>
              <Text style={styles.statCardLabel}>Cal Burned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardValue}>
                {Math.round(weeklyStats.totalVolume / 1000)}k
              </Text>
              <Text style={styles.statCardLabel}>Volume</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardValue}>{weeklyStats.averageDuration}</Text>
              <Text style={styles.statCardLabel}>Avg Mins</Text>
            </View>
          </View>
        </View>

        {/* Recent Workouts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            {recentWorkouts.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/screens/WorkoutHistory')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {recentWorkouts.length > 0 ? (
            recentWorkouts.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.workoutItem}
                onPress={() => router.push({
                  pathname: '/screens/WorkoutDetail',
                  params: { sessionId: session.id }
                })}
              >
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutName}>{session.workoutName}</Text>
                  <Text style={styles.workoutDate}>
                    {new Date(session.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.workoutStats}>
                  <View style={styles.workoutStat}>
                    <Ionicons name="time-outline" size={14} color="#8a8a9e" />
                    <Text style={styles.workoutStatText}>{session.duration}m</Text>
                  </View>
                  <View style={styles.workoutStat}>
                    <Ionicons name="flame" size={14} color="#FF6B6B" />
                    <Text style={styles.workoutStatText}>{session.caloriesBurned}</Text>
                  </View>
                  <View style={styles.workoutStat}>
                    <Ionicons name="barbell" size={14} color="#4ECDC4" />
                    <Text style={styles.workoutStatText}>
                      {Math.round(session.volume / 1000)}k
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color="#8a8a9e" />
              <Text style={styles.emptyStateText}>No workouts yet</Text>
              <Text style={styles.emptyStateSubtext}>Start your first workout!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // Render nutrition tab
  const renderNutritionTab = () => {
    const summary = workoutTracking.dailySummary || {
      totalCaloriesConsumed: 0,
      totalCaloriesBurned: 0,
      netCalories: 0,
      date: new Date().toISOString().split('T')[0],
      totalVolume: 0,
      workoutsCompleted: 0,
      workoutSessions: [],
    };

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
    const todayNutrition = workoutTracking.getTodayNutritionLogs();
    
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calorie Summary */}
        <View style={styles.calorieSummary}>
          <LinearGradient
            colors={['#06D6A0', '#118AB2']}
            style={styles.calorieGradient}
          >
            <View style={styles.calorieHeader}>
              <View>
                <Text style={styles.calorieTitle}>Today's Nutrition</Text>
                <Text style={styles.calorieDate}>{today}</Text>
              </View>
              <TouchableOpacity
                style={styles.addFoodButton}
                onPress={() => setShowAddFoodModal(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.calorieStats}>
              <View style={styles.calorieStat}>
                <Text style={styles.calorieStatValue}>
                  {summary.totalCaloriesConsumed}
                </Text>
                <Text style={styles.calorieStatLabel}>Consumed</Text>
              </View>
              <View style={styles.calorieDivider} />
              <View style={styles.calorieStat}>
                <Text style={styles.calorieStatValue}>
                  {summary.totalCaloriesBurned}
                </Text>
                <Text style={styles.calorieStatLabel}>Burned</Text>
              </View>
              <View style={styles.calorieDivider} />
              <View style={styles.calorieStat}>
                <Text style={[
                  styles.calorieStatValue,
                  { color: summary.netCalories > 0 ? '#FF6B6B' : '#06D6A0' }
                ]}>
                  {summary.netCalories}
                </Text>
                <Text style={styles.calorieStatLabel}>Net</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Macronutrients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Macronutrients</Text>
          <View style={styles.macroGrid}>
            <View style={styles.macroCard}>
              <View style={[styles.macroIcon, { backgroundColor: '#FF6B6B' }]}>
                <Ionicons name="fish" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.macroValue}>
                  {todayNutrition.reduce((sum, log) => sum + log.protein, 0)}g
                </Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
            </View>
            
            <View style={styles.macroCard}>
              <View style={[styles.macroIcon, { backgroundColor: '#4ECDC4' }]}>
                <Ionicons name="nutrition" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.macroValue}>
                  {todayNutrition.reduce((sum, log) => sum + log.carbs, 0)}g
                </Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
            </View>
            
            <View style={styles.macroCard}>
              <View style={[styles.macroIcon, { backgroundColor: '#FFD166' }]}>
                <Ionicons name="water" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.macroValue}>
                  {todayNutrition.reduce((sum, log) => sum + log.fat, 0)}g
                </Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Food Log by Meal Type */}
        {mealTypes.map((mealType) => {
          const mealLogs = todayNutrition.filter(
            log => log.mealType === mealType
          );
          
          if (mealLogs.length === 0) return null;

          return (
            <View key={mealType} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
              </Text>
              {mealLogs.map((log) => (
                <View key={log.id} style={styles.foodItem}>
                  <View style={styles.foodInfo}>
                    <View style={styles.foodHeader}>
                      <Ionicons 
                        name={getMealIcon(log.mealType)} 
                        size={16} 
                        color="#667eea" 
                      />
                      <Text style={styles.foodName}>{log.name}</Text>
                    </View>
                    <Text style={styles.foodDetails}>
                      {log.servingSize} • {log.calories} kcal
                    </Text>
                  </View>
                  <View style={styles.foodMacros}>
                    <Text style={styles.foodMacroText}>P: {log.protein}g</Text>
                    <Text style={styles.foodMacroText}>C: {log.carbs}g</Text>
                    <Text style={styles.foodMacroText}>F: {log.fat}g</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => workoutTracking.removeNutritionLog(log.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}

        {todayNutrition.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="nutrition-outline" size={48} color="#8a8a9e" />
            <Text style={styles.emptyStateText}>No food logged today</Text>
            <Text style={styles.emptyStateSubtext}>Tap the + button to add food</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render progress tab
  const renderProgressTab = () => {
    const progressData = workoutTracking.getProgressChartData(7);
    const weeklyStats = workoutTracking.getWeeklyStats();

    const volumeData = {
      labels: progressData.slice(-7).map(d => new Date(d.date).getDate().toString()),
      datasets: [{
        data: progressData.slice(-7).map(d => d.volume > 0 ? d.volume / 1000 : 0),
      }],
    };

    const calorieData = {
      labels: progressData.slice(-7).map(d => new Date(d.date).getDate().toString()),
      datasets: [{
        data: progressData.slice(-7).map(d => d.caloriesBurned),
      }],
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Progress Charts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume Progress (kg)</Text>
          <View style={styles.chartContainer}>
            {progressData.filter(d => d.volume > 0).length > 0 ? (
              <LineChart
                data={volumeData}
                width={SCREEN_WIDTH - 48}
                height={220}
                chartConfig={{
                  backgroundColor: '#1a1a2e',
                  backgroundGradientFrom: '#1a1a2e',
                  backgroundGradientTo: '#16213e',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#667eea',
                  },
                }}
                bezier
                style={styles.chart}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="stats-chart-outline" size={48} color="#8a8a9e" />
                <Text style={styles.emptyChartText}>No volume data yet</Text>
                <Text style={styles.emptyChartSubtext}>Complete workouts to see progress</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calories Burned</Text>
          <View style={styles.chartContainer}>
            {progressData.filter(d => d.caloriesBurned > 0).length > 0 ? (
              <LineChart
                data={calorieData}
                width={SCREEN_WIDTH - 48}
                height={220}
                chartConfig={{
                  backgroundColor: '#1a1a2e',
                  backgroundGradientFrom: '#1a1a2e',
                  backgroundGradientTo: '#16213e',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={styles.chart}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="flame-outline" size={48} color="#8a8a9e" />
                <Text style={styles.emptyChartText}>No calorie data yet</Text>
                <Text style={styles.emptyChartSubtext}>Complete workouts to see calories burned</Text>
              </View>
            )}
          </View>
        </View>

        {/* Muscle Group Frequency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muscle Group Frequency</Text>
          <View style={styles.muscleGrid}>
            {Object.entries(weeklyStats.muscleFrequency).length > 0 ? (
              Object.entries(weeklyStats.muscleFrequency).map(([muscle, count]) => (
                <View key={muscle} style={styles.muscleItem}>
                  <Text style={styles.muscleName}>
                    {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                  </Text>
                  <View style={styles.muscleBarContainer}>
                    <View 
                      style={[
                        styles.muscleBar,
                        { 
                          width: `${Math.min(count * 20, 100)}%`,
                          backgroundColor: getMuscleColor(muscle),
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.muscleCount}>{count} workouts</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="body-outline" size={48} color="#8a8a9e" />
                <Text style={styles.emptyStateText}>No muscle data</Text>
                <Text style={styles.emptyStateSubtext}>Workout to see muscle frequency</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const getMuscleColor = (muscle: string) => {
    const colors: Record<string, string> = {
      chest: '#FF6B6B',
      back: '#4ECDC4',
      legs: '#FFD166',
      shoulders: '#06D6A0',
      arms: '#667eea',
      core: '#7209B7',
      biceps: '#FF9E00',
      triceps: '#118AB2',
      glutes: '#EF476F',
      hamstrings: '#06D6A0',
      quadriceps: '#4ECDC4',
      calves: '#FFD166',
    };
    return colors[muscle.toLowerCase()] || '#8a8a9e';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tracking</Text>
            <Text style={styles.subtitle}>Monitor your fitness journey</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/screens/Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#8a8a9e" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'workout' && styles.activeTab]}
            onPress={() => setActiveTab('workout')}
          >
            <Ionicons 
              name="barbell" 
              size={20} 
              color={activeTab === 'workout' ? '#fff' : '#8a8a9e'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'workout' && styles.activeTabText
            ]}>
              Workout
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'nutrition' && styles.activeTab]}
            onPress={() => setActiveTab('nutrition')}
          >
            <Ionicons 
              name="nutrition" 
              size={20} 
              color={activeTab === 'nutrition' ? '#fff' : '#8a8a9e'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'nutrition' && styles.activeTabText
            ]}>
              Nutrition
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
            onPress={() => setActiveTab('progress')}
          >
            <Ionicons 
              name="stats-chart" 
              size={20} 
              color={activeTab === 'progress' ? '#fff' : '#8a8a9e'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'progress' && styles.activeTabText
            ]}>
              Progress
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'workout' && renderWorkoutTab()}
          {activeTab === 'nutrition' && renderNutritionTab()}
          {activeTab === 'progress' && renderProgressTab()}
        </View>
      </SafeAreaView>

      {/* Add Food Modal */}
      <Modal
        visible={showAddFoodModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddFoodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Food</Text>
              <TouchableOpacity onPress={() => setShowAddFoodModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Food Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Grilled Chicken Breast"
                placeholderTextColor="#888"
                value={newFood.name}
                onChangeText={(text) => setNewFood({...newFood, name: text})}
              />
              
              <Text style={styles.inputLabel}>Calories</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 165"
                placeholderTextColor="#888"
                value={newFood.calories}
                onChangeText={(text) => setNewFood({...newFood, calories: text})}
                keyboardType="numeric"
              />
              
              <View style={styles.macroRow}>
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor="#888"
                    value={newFood.protein}
                    onChangeText={(text) => setNewFood({...newFood, protein: text})}
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>Carbs (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor="#888"
                    value={newFood.carbs}
                    onChangeText={(text) => setNewFood({...newFood, carbs: text})}
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>Fat (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor="#888"
                    value={newFood.fat}
                    onChangeText={(text) => setNewFood({...newFood, fat: text})}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <Text style={styles.inputLabel}>Serving Size</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 100g, 1 cup, etc."
                placeholderTextColor="#888"
                value={newFood.servingSize}
                onChangeText={(text) => setNewFood({...newFood, servingSize: text})}
              />
              
              <Text style={styles.inputLabel}>Meal Type</Text>
              <View style={styles.mealTypeContainer}>
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.mealTypeButton,
                      newFood.mealType === type && styles.selectedMealType
                    ]}
                    onPress={() => setNewFood({...newFood, mealType: type})}
                  >
                    <Text style={[
                      styles.mealTypeText,
                      newFood.mealType === type && styles.selectedMealTypeText
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={handleAddFood}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.modalSaveText}>Add Food</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  safeArea: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#8a8a9e' },
  settingsButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  tabText: {
    fontSize: 14,
    color: '#8a8a9e',
    fontWeight: '600',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#fff',
  },
  content: { flex: 1, paddingHorizontal: 24 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 16 },
  seeAllText: { fontSize: 14, color: '#667eea', fontWeight: '600' },
  activeSessionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  activeSessionGradient: {
    padding: 20,
  },
  activeSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activeSessionTitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  activeSessionName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resumeButtonText: { fontSize: 14, color: '#fff', fontWeight: '600', marginLeft: 6 },
  activeSessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  quickStartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickStartCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickStartIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickStartText: { fontSize: 14, fontWeight: '600', color: '#fff', textAlign: 'center' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  statCardValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statCardLabel: { fontSize: 12, color: '#8a8a9e' },
  workoutItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  workoutInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  workoutDate: { fontSize: 14, color: '#8a8a9e' },
  workoutStats: {
    flexDirection: 'row',
    gap: 16,
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutStatText: { fontSize: 13, color: '#8a8a9e' },
  calorieSummary: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  calorieGradient: {
    padding: 20,
  },
  calorieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calorieTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  calorieDate: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  addFoodButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calorieStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  calorieStat: { alignItems: 'center' },
  calorieStatValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  calorieStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  calorieDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
  },
  macroIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  macroValue: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 2 },
  macroLabel: { fontSize: 12, color: '#8a8a9e' },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  foodInfo: { flex: 1 },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  foodName: { fontSize: 15, fontWeight: '600', color: '#fff', marginLeft: 8 },
  foodDetails: { fontSize: 13, color: '#8a8a9e' },
  foodMacros: { flexDirection: 'row', gap: 8, marginHorizontal: 12 },
  foodMacroText: { fontSize: 12, color: '#8a8a9e' },
  chartContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  chart: {
    borderRadius: 16,
  },
  emptyChart: {
    alignItems: 'center',
    padding: 20,
  },
  emptyChartText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 12,
    fontWeight: '600',
  },
  emptyChartSubtext: {
    fontSize: 14,
    color: '#8a8a9e',
    marginTop: 4,
    textAlign: 'center',
  },
  muscleGrid: { marginTop: 8 },
  muscleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  muscleName: {
    width: 80,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  muscleBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  muscleBar: {
    height: '100%',
    borderRadius: 4,
  },
  muscleCount: {
    width: 70,
    fontSize: 12,
    color: '#8a8a9e',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 12,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8a8a9e',
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    width: SCREEN_WIDTH - 48,
    maxHeight: '80%',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  modalBody: { marginBottom: 24 },
  inputLabel: { fontSize: 14, color: '#fff', fontWeight: '600', marginBottom: 8 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  macroInput: { flex: 1 },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectedMealType: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  mealTypeText: {
    fontSize: 14,
    color: '#8a8a9e',
    fontWeight: '600',
  },
  selectedMealTypeText: {
    color: '#fff',
  },
  modalFooter: {},
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
  },
  modalSaveText: { 
    fontSize: 16, 
    color: '#fff', 
    fontWeight: '600',
    marginLeft: 8,
  },
});