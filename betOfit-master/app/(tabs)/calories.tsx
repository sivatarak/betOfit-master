// app/(tabs)/calories.tsx
import React, { useCallback, useEffect, useState } from "react";
import auth from '@react-native-firebase/auth';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Keyboard,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { BlurView } from "expo-blur";
import { searchFood as searchFoodApi, deleteFoodLog, logFoodToBackend, getTodayFoodLogs } from "../services/exerciseApi";
import { useToday } from '../../context/todayContext';
import { useTheme } from "../../context/themecontext";
import { CustomLoader } from "@/components/CustomLoader";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = Math.min(width * 0.5, 200);

interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  unit: string;
  date: string;
  time: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
}

interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface UserProfile {
  age: number;
  height: number;
  weight: number;
  gender: "male" | "female";
  activityLevel: number;
  targetWeight: number;
}

/* ---------------------------------------------------------
   CIRCULAR PROGRESS COMPONENT
--------------------------------------------------------- */
interface CircularProgressProps {
  remaining: number;
  goal: number;
  eaten: number;
  size?: number;
  colors: any;
}


/* ---------------------------------------------------------
   WEEKLY CHART COMPONENT
--------------------------------------------------------- */
interface WeeklyChartProps {
  data: number[];
  labels: string[];
  goal: number;
  colors: any;
}



export default function CaloriesScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<FoodEntry[]>([]);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantity, setQuantity] = useState("100");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [waterIntake, setWaterIntake] = useState(1.5);
  const [selectedMealType, setSelectedMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const searchInputRef = React.useRef<TextInput>(null);
  // const { dailyCalorieGoal, waterGoal, bmr, tdee, weight, height, age, gender } = useProfile();
  const {
    todayEaten,
    remainingCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    adjustedGoal,      // ← this already = dailyCalorieGoal + burned
    progressPercent,
    updateAfterFoodLog,
    refreshToday,
  } = useToday();

  useEffect(() => {
    // Make sure query is a string before checking length
    const searchTerm = (query || '').toString();

    if (searchTerm.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const delay = setTimeout(() => {
      searchFood();
    }, 400);

    return () => clearTimeout(delay);
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      refreshToday();
    }, [refreshToday])
  );

  function CircularProgress({ remaining, goal, eaten, size = CIRCLE_SIZE, colors }: CircularProgressProps) {
    const percentage = (eaten / goal) * 100;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - percentage / 100);

    return (
      <View style={[styles.circularProgress, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.secondary} />
              <Stop offset="100%" stopColor={colors.primary} />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#grad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.circleCenter}>
          <Text style={[styles.remainingAmount, { color: colors.text }]}>{remaining}</Text>
          <Text style={[styles.remainingLabel, { color: colors.textSecondary }]}>kcal left</Text>
        </View>
      </View>
    );
  }
  /* ---------------------------------------------------------
     MACRO CARD COMPONENT - With specific icons
  --------------------------------------------------------- */
  interface MacroCardProps {
    label: string;
    value: number;
    goal: number;
    color: string;
    icon: string; // Add icon prop
    unit?: string;
    colors: any;
    theme: string;
  }

  function MacroCard({ label, value, goal, color, icon, unit = "g", colors, theme }: MacroCardProps) {
    const percentage = Math.min((value / goal) * 100, 100);

    return (
      <BlurView intensity={80} tint={theme === "dark" ? "dark" : "light"} style={[styles.macroCard, { borderColor: colors.border }]}>
        <Ionicons name={icon as any} size={26} color={color} />
        <Text style={[styles.macroCardLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.macroCardValue, { color: colors.text }]}>
          {Math.round(value)}<Text style={[styles.macroCardUnit, { color: colors.textMuted }]}>/{goal}{unit}</Text>
        </Text>
      </BlurView>
    );
  }

  /* ---------------------------------------------------------
     MEAL CARD COMPONENT
  --------------------------------------------------------- */
  interface MealCardProps {
    title: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    isLogged: boolean;
    onAddPress: () => void;
    items?: FoodEntry[];
    onRemoveItem?: (id: string) => void;
    colors: any;
  }

  function MealCard({ title, calories, protein, carbs, fat, isLogged, onAddPress, items = [], onRemoveItem, colors }: MealCardProps) {
    return (
      <View style={[styles.mealCard, !isLogged && styles.mealCardEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.mealCardContent}>
          <View style={styles.mealCardLeft}>
            <Text style={[styles.mealCardTitle, { color: colors.text }]}>{title}</Text>
            {isLogged ? (
              <Text style={[styles.mealCardMacros, { color: colors.textSecondary }]}>
                {calories} kcal • P:{Math.round(protein)} C:{Math.round(carbs)} F:{Math.round(fat)}
              </Text>
            ) : (
              <Text style={[styles.mealCardEmptyText, { color: colors.textMuted }]}>Not logged yet</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.mealCardButton, isLogged ? styles.mealCardButtonLight : styles.mealCardButtonPrimary,
            isLogged ? { backgroundColor: colors.border } : { backgroundColor: colors.primary }]}
            onPress={onAddPress}
          >
            <Ionicons name="add" size={24} color={isLogged ? colors.primary : "#FFFFFF"} />
          </TouchableOpacity>
        </View>

        {items.length > 0 && (
          <View style={[styles.mealItems, { borderTopColor: colors.border }]}>
            {items.map((item) => (
              <View key={item.id} style={styles.mealItem}>
                <View style={styles.mealItemLeft}>
                  <Text style={[styles.mealItemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.mealItemQuantity, { color: colors.textMuted }]}>{item.quantity}{item.unit}</Text>
                </View>
                <View style={styles.mealItemRight}>
                  <Text style={[styles.mealItemCalories, { color: colors.text }]}>{item.calories} kcal</Text>
                  {onRemoveItem && (
                    <TouchableOpacity onPress={() => onRemoveItem(item.id)}>
                      <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }


  useEffect(() => {
    loadSaved();
  }, []);



  const loadSaved = async () => {
    try {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      // Load from AsyncStorage
      const localSaved = await AsyncStorage.getItem("CALORIES_DATA_V2");
      if (localSaved) {
        const data = JSON.parse(localSaved);
        const today = new Date().toISOString().split("T")[0];
        const todayEntries = data.history?.filter((e: FoodEntry) => e.date === today) || [];
        const todayCalories = todayEntries.reduce((sum: number, e: FoodEntry) => sum + e.calories, 0);

        setHistory(todayEntries);


        if (data.profile) {
          setProfile(data.profile);
        }
      }

      // Sync with backend...
    } catch (error) {
      console.error("Error loading saved data:", error);
    }
  };



  const searchFood = async (q?: string) => {
    // Ensure we have a string value
    let searchQuery = '';

    if (q && typeof q === 'string') {
      searchQuery = q;
    } else if (query && typeof query === 'string') {
      searchQuery = query;
    } else {
      searchQuery = '';
    }

    searchQuery = searchQuery.trim();

    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    Keyboard.dismiss();
    setLoading(true);

    try {
      const foods = await searchFoodApi(searchQuery);
      setResults(Array.isArray(foods) ? foods : []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFoodSelect = (food: FoodItem) => {
    setSelectedFood({
      food_name: food.name,
      servings: {
        serving: {
          calories: food.calories,
          protein: food.protein,
          carbohydrate: food.carbs,
          fat: food.fat,
        }
      }
    });
    setQuantity("100");
    setShowQuantityModal(true);
  };

  const addFoodWithQuantity = async () => {
    if (!selectedFood) return;

    const serving = selectedFood.servings?.serving;
    if (!serving) return;

    const grams = parseFloat(quantity) || 100;
    const multiplier = grams / 100;

    const calories = Math.round(serving.calories * multiplier);
    const protein = Math.round(serving.protein * multiplier * 10) / 10;
    const carbs = Math.round(serving.carbohydrate * multiplier * 10) / 10;
    const fat = Math.round(serving.fat * multiplier * 10) / 10;

    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      name: selectedFood.food_name,
      calories,
      protein,
      carbs,
      fat,
      quantity: grams,
      unit: "g",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      mealType: selectedMealType,
    };

    // ✅ STEP 1: Update UI immediately (optimistic update)
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    updateAfterFoodLog(calories, protein, carbs, fat); // ← replaces setCurrent
    // ✅ STEP 2: Save to AsyncStorage (fast, for next load)
    await AsyncStorage.setItem("CALORIES_DATA_V2", JSON.stringify({
      history: updatedHistory,
    }));

    // ✅ STEP 3: Save to backend (async, don't wait for UI)
    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;

    if (userId) {
      logFoodToBackend({
        userId,
        foodName: selectedFood.food_name,
        calories,
        protein,
        carbs,
        fat,
        mealType: selectedMealType,
        quantity: grams
      }).then(savedLog => {
        if (savedLog && savedLog.id) {
          // Update the entry with real database ID
          const updatedHistoryWithDbId = updatedHistory.map(entry =>
            entry.id === newEntry.id ? { ...entry, id: savedLog.id } : entry
          );
          setHistory(updatedHistoryWithDbId);

          // Update AsyncStorage with real ID
          // ✅ only history, no removed variables
          AsyncStorage.setItem("CALORIES_DATA_V2", JSON.stringify({
            history: updatedHistoryWithDbId,
          }));
        }
      }).catch(error => {
        console.error("Backend save failed:", error);
        // Don't revert UI, just log error
      });
    }

    // Close modal and clear
    setShowQuantityModal(false);
    setSelectedFood(null);
    setQuantity("100");
    setResults([]);
    setQuery("");
  };





  // // Add pull-to-refresh support
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFromBackend();
    setRefreshing(false);
  }, []);




  const today = new Date().toISOString().split("T")[0];
  const todayEntries = history.filter(h => h.date === today);

  const breakfastItems = todayEntries.filter(e => e.mealType === "breakfast");
  const lunchItems = todayEntries.filter(e => e.mealType === "lunch");
  const dinnerItems = todayEntries.filter(e => e.mealType === "dinner");

  const breakfastCalories = breakfastItems.reduce((sum, e) => sum + e.calories, 0);
  const lunchCalories = lunchItems.reduce((sum, e) => sum + e.calories, 0);
  const dinnerCalories = dinnerItems.reduce((sum, e) => sum + e.calories, 0);

  const breakfastProtein = breakfastItems.reduce((sum, e) => sum + e.protein, 0);
  const breakfastCarbs = breakfastItems.reduce((sum, e) => sum + e.carbs, 0);
  const breakfastFat = breakfastItems.reduce((sum, e) => sum + e.fat, 0);

  const lunchProtein = lunchItems.reduce((sum, e) => sum + e.protein, 0);
  const lunchCarbs = lunchItems.reduce((sum, e) => sum + e.carbs, 0);
  const lunchFat = lunchItems.reduce((sum, e) => sum + e.fat, 0);

  const dinnerProtein = dinnerItems.reduce((sum, e) => sum + e.protein, 0);
  const dinnerCarbs = dinnerItems.reduce((sum, e) => sum + e.carbs, 0);
  const dinnerFat = dinnerItems.reduce((sum, e) => sum + e.fat, 0);

  const handleAddPress = (mealType: "breakfast" | "lunch" | "dinner" | "snack") => {
    setSelectedMealType(mealType);
    setResults([]);
    setQuery("");
    searchInputRef.current?.focus();
  };
  const removeFoodEntry = async (id: string) => {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;

    const updatedHistory = history.filter((h) => h.id !== id);

    setHistory(updatedHistory);
    updateAfterFoodLog(-entry.calories, -entry.protein, -entry.carbs, -entry.fat);

    await AsyncStorage.setItem("CALORIES_DATA_V2", JSON.stringify({
      history: updatedHistory,
    }));

    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;
    if (userId && id.length > 10) {
      deleteFoodLog(id);
    }
  };

  const refreshFromBackend = async () => {
    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;

    if (!userId) return;

    try {
      const backendData = await getTodayFoodLogs(userId);

      if (backendData && backendData.logs && backendData.logs.length > 0) {
        const formattedLogs: FoodEntry[] = backendData.logs.map((log: any) => ({
          id: log.id,
          name: log.food_name,
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fat: log.fat,
          quantity: log.quantity,
          unit: "g",
          date: new Date(log.logged_at).toISOString().split("T")[0],
          time: new Date(log.logged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mealType: log.meal_type,
        }));

        setHistory(formattedLogs);

        // ✅ let TodayContext handle the numbers
        await refreshToday();

        await AsyncStorage.setItem("CALORIES_DATA_V2", JSON.stringify({
          history: formattedLogs,
        }));
      }
    } catch (error) {
      console.error("Refresh error:", error);
    }
  };
  // const weeklyData = [2100, 1950, 1800, current, 0, 0, 0];
  // const weeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const renderSearchResult = ({ item }: { item: FoodItem }) => {
    return (
      <TouchableOpacity
        style={[styles.searchResultCard, { backgroundColor: colors.card }]}
        onPress={() => handleFoodSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.searchResultContent}>
          <Text style={[styles.searchResultName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.searchResultCals, { color: colors.textSecondary }]}>
            {item.calories} kcal • P:{item.protein}g C:{item.carbs}g F:{item.fat}g per 100g
          </Text>
        </View>
        <Ionicons name="add-circle" size={28} color={colors.primary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <BlurView intensity={90} tint={theme === "dark" ? "dark" : "light"} style={[styles.header, { borderBottomColor: `${colors.primary}10` }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Nutrition</Text>

          </View>


        </BlurView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            {/* MAIN GOAL CARD */}
            <BlurView intensity={80} tint={theme === "dark" ? "dark" : "light"} style={[styles.goalCard, { borderColor: 'rgba(255,255,255,0.3)' }]}>
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}

              />
              <View style={[styles.goalCardBackground, { backgroundColor: `${colors.accent}10` }]} />
              <View style={styles.goalCardContent}>
                <CircularProgress remaining={remainingCalories} goal={adjustedGoal} eaten={todayEaten} colors={colors} />

                <View style={styles.goalStats}>
                  <View style={styles.goalStat}>
                    <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>Goal</Text>
                    <Text style={[styles.goalStatValue, { color: colors.text }]}>{adjustedGoal.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.goalStatDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.goalStat}>
                    <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>Eaten</Text>
                    <Text style={[styles.goalStatValue, styles.goalStatValueEaten, { color: colors.text }]}>
                      {todayEaten.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </BlurView>


            <View style={styles.macrosRow}>
              <MacroCard
                label="PROTEIN"
                value={totalProtein}
                goal={150}
                color="#3B82F6"
                icon="barbell-outline"
                colors={colors}
                theme={theme}
              />

              <MacroCard
                label="CARBS"
                value={totalCarbs}
                goal={250}
                color={colors.primary}
                icon="restaurant-outline"
                colors={colors}
                theme={theme}
              />

              <MacroCard
                label="FAT"
                value={totalFat}
                goal={70}
                color="#A855F7"
                icon="water-outline"
                colors={colors}
                theme={theme}
              />
            </View>

            {/* SEARCH SECTION */}
            <View style={styles.searchSection}>
              <View style={[styles.searchInputWrapper, { backgroundColor: colors.card }]}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  ref={searchInputRef}
                  placeholder="Search for food..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.text }]}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={searchFood}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setQuery("");
                    setResults([]);
                  }}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* SEARCH RESULTS */}
            {results.length > 0 && (
              <View style={styles.resultsContainer}>
                <View style={styles.resultsHeader}>
                  <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                    {results.length} results
                  </Text>
                  <TouchableOpacity onPress={() => setResults([])}>
                    <Text style={[styles.clearResults, { color: colors.primary }]}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.resultsList}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
                  {results.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.searchResultCard, { backgroundColor: colors.card }]}
                      onPress={() => handleFoodSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.searchResultContent}>
                        <Text style={[styles.searchResultName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.searchResultCals, { color: colors.textSecondary }]}>
                          {item.calories} kcal • P:{item.protein}g C:{item.carbs}g F:{item.fat}g per 100g
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={28} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

              </View>
            )}

            {/* DAILY MEALS */}
            <View style={styles.mealsContainer}>
              <Text style={[styles.mealsTitle, { color: colors.text }]}>Today's Meals</Text>

              <MealCard
                title="Breakfast"
                calories={breakfastCalories}
                protein={breakfastProtein}
                carbs={breakfastCarbs}
                fat={breakfastFat}
                isLogged={breakfastItems.length > 0}
                onAddPress={() => handleAddPress("breakfast")}
                items={breakfastItems}
                onRemoveItem={removeFoodEntry}
                colors={colors}
              />

              <MealCard
                title="Lunch"
                calories={lunchCalories}
                protein={lunchProtein}
                carbs={lunchCarbs}
                fat={lunchFat}
                isLogged={lunchItems.length > 0}
                onAddPress={() => handleAddPress("lunch")}
                items={lunchItems}
                onRemoveItem={removeFoodEntry}
                colors={colors}
              />

              <MealCard
                title="Dinner"
                calories={dinnerCalories}
                protein={dinnerProtein}
                carbs={dinnerCarbs}
                fat={dinnerFat}
                isLogged={dinnerItems.length > 0}
                onAddPress={() => handleAddPress("dinner")}
                items={dinnerItems}
                onRemoveItem={removeFoodEntry}
                colors={colors}
              />
            </View>

            {/* WEEKLY CHART */}
            {/* <WeeklyChart
              data={weeklyData}
              labels={weeklyLabels}
              goal={goal}
              colors={colors}
            /> */}

            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* QUANTITY MODAL */}
      {showQuantityModal && selectedFood && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>
                {selectedFood.food_name}
              </Text>
              <TouchableOpacity onPress={() => setShowQuantityModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {(() => {
              const serving = selectedFood.servings?.serving;
              if (!serving) return null;

              const currentGrams = parseFloat(quantity || "100");
              const multiplier = currentGrams / 100;

              return (
                <>
                  <View style={[styles.modalNutrition, { backgroundColor: colors.background }]}>
                    <View style={styles.modalNutritionItem}>
                      <Text style={[styles.modalNutritionLabel, { color: colors.textSecondary }]}>Calories</Text>
                      <Text style={[styles.modalNutritionValue, { color: colors.text }]}>
                        {Math.round(serving.calories * multiplier)}
                      </Text>
                    </View>
                    <View style={styles.modalNutritionItem}>
                      <Text style={[styles.modalNutritionLabel, { color: colors.textSecondary }]}>Protein</Text>
                      <Text style={[styles.modalNutritionValue, { color: colors.text }]}>
                        {(serving.protein * multiplier).toFixed(1)}g
                      </Text>
                    </View>
                    <View style={styles.modalNutritionItem}>
                      <Text style={[styles.modalNutritionLabel, { color: colors.textSecondary }]}>Carbs</Text>
                      <Text style={[styles.modalNutritionValue, { color: colors.text }]}>
                        {(serving.carbohydrate * multiplier).toFixed(1)}g
                      </Text>
                    </View>
                    <View style={styles.modalNutritionItem}>
                      <Text style={[styles.modalNutritionLabel, { color: colors.textSecondary }]}>Fat</Text>
                      <Text style={[styles.modalNutritionValue, { color: colors.text }]}>
                        {(serving.fat * multiplier).toFixed(1)}g
                      </Text>
                    </View>
                  </View>

                  <View style={styles.quantitySection}>
                    <Text style={[styles.quantityLabel, { color: colors.text }]}>Quantity (grams)</Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        onPress={() => setQuantity(Math.max(10, parseFloat(quantity) - 10).toString())}
                        style={[styles.quantityButton, { backgroundColor: colors.border }]}
                      >
                        <Ionicons name="remove" size={20} color={colors.text} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.quantityInput, { backgroundColor: colors.background, color: colors.text }]}
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        textAlign="center"
                      />
                      <TouchableOpacity
                        onPress={() => setQuantity((parseFloat(quantity) + 10).toString())}
                        style={[styles.quantityButton, { backgroundColor: colors.border }]}
                      >
                        <Ionicons name="add" size={20} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.addFoodButton}
                    onPress={addFoodWithQuantity}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      style={styles.addFoodGradient}
                    >
                      <Text style={styles.addFoodButtonText}>
                        Add to {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      )}
      {loading && <CustomLoader fullScreen />}

    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerDateText: {
    fontSize: 13,
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
  },
  avatarGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
  },

  // Goal Card
  goalCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
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

  // Circular Progress
  circularProgress: {
    justifyContent: "center",
    alignItems: "center",
  },
  circleCenter: {
    position: "absolute",
    alignItems: "center",
  },
  remainingAmount: {
    fontSize: 36,
    fontWeight: "800",
  },
  remainingLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // Goal Stats
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
  goalStatValueEaten: {
    color: colors.primary,
  },
  goalStatDivider: {
    width: 1,
    height: 32,
  },

  // Macros Row
  macrosRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 28,
  },
  macroCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  macroCardLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  macroCardValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  macroCardUnit: {
    fontSize: 12,
    fontWeight: '400',
  },
  macroCardBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  macroCardBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  macroCardPercentage: {
    fontSize: 10,
    fontWeight: "600",
  },

  // Search Section
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },

  // Search Results
  resultsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 14,
  },
  clearResults: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultsList: {
    maxHeight: 300,
  },
  searchResultCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchResultContent: {
    flex: 1,
    marginRight: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  searchResultCals: {
    fontSize: 13,
  },

  // Meals Container
  mealsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  mealsTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
    paddingHorizontal: 4,
  },

  // Meal Card
  mealCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mealCardEmpty: {
    borderWidth: 1,
    borderStyle: "dashed",
  },
  mealCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealCardLeft: {
    flex: 1,
  },
  mealCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  mealCardMacros: {
    fontSize: 13,
  },
  mealCardEmptyText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  mealCardButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  mealCardButtonPrimary: {
    backgroundColor: colors.primary,
  },
  mealCardButtonLight: {
    backgroundColor: colors.border,
  },

  // Meal Items
  mealItems: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  mealItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealItemLeft: {
    flex: 1,
  },
  mealItemName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  mealItemQuantity: {
    fontSize: 12,
  },
  mealItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mealItemCalories: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Weekly Chart
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  chartSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  chartBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chartBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 150,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  chartBarWrapper: {
    width: "100%",
    height: 120,
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    fontWeight: "600",
  },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width - 40,
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
    marginRight: 12,
  },
  modalNutrition: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  modalNutritionItem: {
    flex: 1,
    alignItems: "center",
  },
  modalNutritionLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  modalNutritionValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  quantitySection: {
    marginBottom: 24,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityInput: {
    width: 100,
    height: 50,
    borderRadius: 12,
    fontSize: 20,
    fontWeight: "700",
  },
  addFoodButton: {
    borderRadius: 20,
    overflow: "hidden",
  },
  addFoodGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  addFoodButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});