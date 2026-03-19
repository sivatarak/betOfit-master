// app/(auth)/profile.tsx
import { useState, useEffect } from 'react';
import { useLocalSearchParams } from "expo-router";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { STORAGE_KEYS } from "../../constants/storageKeys";

import { useTheme } from "../../context/themecontext";
import { saveProfile } from '../services/profileApi';



const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface UserProfile {
  name: string;
  age: number;
  height: number;
  weight: number;
  gender: "male" | "female";
  activityLevel: number;
  targetWeight: number;
  timeline: number;
  workoutDaysPerWeek: number;
  workoutDays: string[];
}

const defaultProfile: UserProfile = {
  name: "User",
  age: 25,
  height: 170,
  weight: 70,
  gender: "male",
  activityLevel: 1.55,
  targetWeight: 65,
  timeline: 12,
  workoutDaysPerWeek: 5,
  workoutDays: ['Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday'],
};

const calculateBMR = (weight: number, height: number, age: number, gender: string) => {
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  bmr += gender === "male" ? 5 : -161;
  return Math.round(bmr);
};

const calculateTDEE = (bmr: number, activityLevel: number) => {
  return Math.round(bmr * activityLevel);
};

export default function ProfileScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);
  const { mode } = useLocalSearchParams();

  const [profile, setProfile] = useState<UserProfile>(defaultProfile);

  // Section expand/collapse states
  const [expandedSections, setExpandedSections] = useState({
    basic: mode === "basic" || mode === "all",
    goals: mode === "goals" || mode === "all",
    workout: mode === "workout" || mode === "all",
  });

  // Edit mode states
  const [editMode, setEditMode] = useState({
    basic: false,
    goals: false,
    workout: false,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem("USER_PROFILE");
      if (saved) {
        const data = JSON.parse(saved);
        setProfile({
          name: data.name || "User",
          age: data.age || 25,
          height: data.height || 170,
          weight: data.weight || 70,
          gender: data.gender || "male",
          activityLevel: data.activity_level || 1.55,
          targetWeight: data.target_weight || 65,
          timeline: data.timeline || 12,
          workoutDaysPerWeek: data.workout_days_per_week || 5,
          workoutDays: data.workout_days || [],
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const toggleSection = (section: 'basic' | 'goals' | 'workout') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleEditMode = (section: 'basic' | 'goals' | 'workout') => {
    setEditMode(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleWorkoutDay = (day: string) => {
    if (profile.workoutDays.includes(day)) {
      setProfile({
        ...profile,
        workoutDays: profile.workoutDays.filter(d => d !== day)
      });
    } else {
      if (profile.workoutDays.length < profile.workoutDaysPerWeek) {
        setProfile({
          ...profile,
          workoutDays: [...profile.workoutDays, day]
        });
      } else {
        Alert.alert('Limit Reached', `You can only select ${profile.workoutDaysPerWeek} days per week`);
      }
    }
  };

  const handleSave = async () => {
    try {

      const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
      const tdee = calculateTDEE(bmr, profile.activityLevel);

      const weightDiff = Math.abs(profile.weight - profile.targetWeight);
      const weeklyWeightLoss = weightDiff / profile.timeline;

      const dailyDeficit = Math.round((weeklyWeightLoss * 7700) / 7);

      const isLosingWeight = profile.weight > profile.targetWeight;

      const dailyCalorieGoal = isLosingWeight
        ? tdee - dailyDeficit
        : tdee + dailyDeficit;

      const waterGoal = Math.round(profile.weight * 33);

      const restDays = WEEKDAYS.filter(
        (day) => !profile.workoutDays.includes(day)
      );

      const profileData = {
        userId: "user-1",

        name: profile.name,
        age: profile.age,

        weight: profile.weight,
        height: profile.height,

        gender: profile.gender,

        targetWeight: profile.targetWeight,
        timeline: profile.timeline,

        weeklyWeightLoss,
        dailyDeficit,

        workoutDaysPerWeek: profile.workoutDaysPerWeek,
        workoutDays: profile.workoutDays,
        restDays,

        waterGoal,

        bmr,
        tdee,

        dailyCalorieGoal,

        activityLevel: profile.activityLevel,

        profileComplete: true,
        setupDate: new Date().toISOString(),
      };

      // Save profile
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PROFILE,
        JSON.stringify(profileData)
      );

      // Save weight
      await AsyncStorage.setItem(
        STORAGE_KEYS.BF_WEIGHT_KG,
        profile.weight.toString()
      );

      // Save name
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_NAME,
        profile.name
      );

      // Save water goal
      const waterData = {
        date: new Date().toISOString().split("T")[0],
        current: 0,
        goal: waterGoal,
        history: [],
        streak: 0,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.WATER_DATA,
        JSON.stringify(waterData)
      );

      // Save calorie goal
      const calData = await AsyncStorage.getItem(STORAGE_KEYS.CALORIES_DATA);

      const parsedCalData = calData ? JSON.parse(calData) : {};

      await AsyncStorage.setItem(
        STORAGE_KEYS.CALORIES_DATA,
        JSON.stringify({
          ...parsedCalData,
          goal: dailyCalorieGoal,
          profile: profileData,
        })
      );

      // Mark setup complete
      await AsyncStorage.setItem(STORAGE_KEYS.SETUP_BASIC_DONE, "true");
      await AsyncStorage.setItem(STORAGE_KEYS.SETUP_GOALS_DONE, "true");
      await AsyncStorage.setItem(STORAGE_KEYS.SETUP_WORKOUT_DONE, "true");

      // Close edit modes
      setEditMode({
        basic: false,
        goals: false,
        workout: false,
      });
      const response = await saveProfile(profileData);
      console.log("the response from backend after saving profile is:", response);
      if(response.success){
        
        Alert.alert("Success", "Profile saved successfully! in Database");
      }
      Alert.alert("Success", "Profile saved successfully!in local storage");

      // Go to home after setup
      router.replace("/(app)/home");

    } catch (error) {

      console.error("Save error:", error);

      Alert.alert(
        "Error",
        "Failed to save profile. Please try again."
      );
    }
  };

  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const restDays = WEEKDAYS.filter(day => !profile.workoutDays.includes(day));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.background, colors.card]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>My Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* SECTION 1: Basic Information */}
          {(mode === "basic" || mode === "all") && (
            <>
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleSection('basic')}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="person-outline" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Information</Text>
                </View>
                <Ionicons
                  name={expandedSections.basic ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedSections.basic && (
                <View style={[styles.sectionContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {editMode.basic ? (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Name</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          value={profile.name}
                          onChangeText={(val) => setProfile({ ...profile, name: val })}
                          placeholder="Your name"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      <View style={styles.inputRow}>
                        <View style={[styles.inputHalf, { marginRight: 8 }]}>
                          <Text style={[styles.label, { color: colors.text }]}>Age</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={profile.age.toString()}
                            onChangeText={(val) => setProfile({ ...profile, age: parseInt(val) || 0 })}
                            keyboardType="numeric"
                            placeholder="25"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>

                        <View style={[styles.inputHalf, { marginLeft: 8 }]}>
                          <Text style={[styles.label, { color: colors.text }]}>Height (cm)</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={profile.height.toString()}
                            onChangeText={(val) => setProfile({ ...profile, height: parseInt(val) || 0 })}
                            keyboardType="numeric"
                            placeholder="170"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Current Weight (kg)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          value={profile.weight.toString()}
                          onChangeText={(val) => setProfile({ ...profile, weight: parseFloat(val) || 0 })}
                          keyboardType="numeric"
                          placeholder="70"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            style={[
                              styles.genderButton,
                              {
                                backgroundColor: profile.gender === "male" ? colors.primary : colors.background,
                                borderColor: colors.border
                              },
                            ]}
                            onPress={() => setProfile({ ...profile, gender: "male" })}
                          >
                            <Text style={{
                              color: profile.gender === "male" ? "#FFFFFF" : colors.text,
                              fontWeight: '600'
                            }}>
                              Male
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.genderButton,
                              {
                                backgroundColor: profile.gender === "female" ? colors.primary : colors.background,
                                borderColor: colors.border
                              },
                            ]}
                            onPress={() => setProfile({ ...profile, gender: "female" })}
                          >
                            <Text style={{
                              color: profile.gender === "female" ? "#FFFFFF" : colors.text,
                              fontWeight: '600'
                            }}>
                              Female
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: colors.primary }]}
                        onPress={() => toggleEditMode('basic')}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Name</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.name}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Age</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.age} years</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Height</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.height} cm</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Weight</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.weight} kg</Text>
                      </View>
                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Gender</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>
                          {profile.gender === 'male' ? 'Male' : 'Female'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                        onPress={() => toggleEditMode('basic')}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                        <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </>
          )}
          {(mode === "goals" || mode === "all") && (
            <>
              {/* SECTION 2: Weight Goals */}
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleSection('goals')}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="trending-down-outline" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Weight Goals</Text>
                </View>
                <Ionicons
                  name={expandedSections.goals ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedSections.goals && (
                <View style={[styles.sectionContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {editMode.goals ? (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Target Weight (kg)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          value={profile.targetWeight.toString()}
                          onChangeText={(val) => setProfile({ ...profile, targetWeight: parseFloat(val) || 0 })}
                          keyboardType="numeric"
                          placeholder="65"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Timeline (weeks)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          value={profile.timeline.toString()}
                          onChangeText={(val) => setProfile({ ...profile, timeline: parseInt(val) || 0 })}
                          keyboardType="numeric"
                          placeholder="12"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Activity Level</Text>
                        <View style={styles.activityButtons}>
                          {[1.2, 1.375, 1.55, 1.725, 1.9].map((level, index) => {
                            const labels = ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'];
                            const isSelected = profile.activityLevel === level;
                            return (
                              <TouchableOpacity
                                key={index}
                                style={[
                                  styles.activityButton,
                                  {
                                    backgroundColor: isSelected ? colors.primary : colors.background,
                                    borderColor: colors.border,
                                    width: '18%',
                                  },
                                ]}
                                onPress={() => setProfile({ ...profile, activityLevel: level })}
                              >
                                <Text style={[
                                  styles.activityButtonText,
                                  { color: isSelected ? '#FFFFFF' : colors.textSecondary, fontSize: 10 }
                                ]}>
                                  {labels[index]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: colors.primary }]}
                        onPress={() => toggleEditMode('goals')}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Current Weight</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.weight} kg</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Target Weight</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.targetWeight} kg</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Timeline</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.timeline} weeks</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>BMR</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{bmr} kcal</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>TDEE</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{tdee} kcal</Text>
                      </View>
                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Daily Goal</Text>
                        <Text style={[styles.infoValue, { color: colors.primary, fontWeight: '800' }]}>
                          {profile.weight > profile.targetWeight ? tdee - 500 : tdee + 500} kcal
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                        onPress={() => toggleEditMode('goals')}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                        <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </>
          )}
          {(mode === "workout" || mode === "all") && (
            <>

              {/* SECTION 3: Workout Schedule */}
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleSection('workout')}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="barbell-outline" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Workout Schedule</Text>
                </View>
                <Ionicons
                  name={expandedSections.workout ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedSections.workout && (
                <View style={[styles.sectionContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {editMode.workout ? (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Days per week</Text>
                        <View style={styles.daysCounter}>
                          <TouchableOpacity
                            onPress={() => {
                              if (profile.workoutDaysPerWeek > 3) {
                                setProfile({
                                  ...profile,
                                  workoutDaysPerWeek: profile.workoutDaysPerWeek - 1,
                                  workoutDays: profile.workoutDays.filter(d =>
                                    profile.workoutDays.indexOf(d) < profile.workoutDaysPerWeek - 1
                                  )
                                });
                              }
                            }}
                            style={[styles.counterButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                          >
                            <Ionicons name="remove" size={20} color={colors.primary} />
                          </TouchableOpacity>
                          <Text style={[styles.daysCounterValue, { color: colors.text }]}>{profile.workoutDaysPerWeek}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (profile.workoutDaysPerWeek < 7) {
                                setProfile({ ...profile, workoutDaysPerWeek: profile.workoutDaysPerWeek + 1 });
                              }
                            }}
                            style={[styles.counterButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                          >
                            <Ionicons name="add" size={20} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Select {profile.workoutDaysPerWeek} days</Text>
                        <View style={styles.daysGrid}>
                          {WEEKDAYS.map((day) => {
                            const isSelected = profile.workoutDays.includes(day);
                            return (
                              <TouchableOpacity
                                key={day}
                                style={[
                                  styles.dayButton,
                                  {
                                    backgroundColor: isSelected ? colors.primary : colors.background,
                                    borderColor: isSelected ? colors.primary : colors.border,
                                  },
                                ]}
                                onPress={() => toggleWorkoutDay(day)}
                              >
                                <Text style={[styles.dayButtonText, { color: isSelected ? "#FFFFFF" : colors.text }]}>
                                  {day.substring(0, 3)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>
                          {profile.workoutDays.length}/{profile.workoutDaysPerWeek} selected
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: colors.primary }]}
                        onPress={() => toggleEditMode('workout')}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Workout Days</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{profile.workoutDaysPerWeek} days/week</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Schedule</Text>
                        <Text style={[styles.infoValue, { color: colors.text, textAlign: 'right', flex: 1 }]}>
                          {profile.workoutDays.join(', ') || 'Not set'}
                        </Text>
                      </View>
                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Rest Days</Text>
                        <Text style={[styles.infoValue, { color: colors.textMuted, textAlign: 'right', flex: 1 }]}>
                          {restDays.join(', ') || 'None'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                        onPress={() => toggleEditMode('workout')}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                        <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: Platform.OS === "ios" ? 60 : 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  doneButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  daysCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  daysCounterValue: {
    fontSize: 28,
    fontWeight: '800',
    minWidth: 50,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    flex: 1,
    minWidth: '30%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  activityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  activityButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  activityButtonText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});