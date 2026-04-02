// app/(auth)/profile.tsx
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from "expo-router";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Platform, Alert, Dimensions,
  Image, Modal, ActivityIndicator, Animated, Easing
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from 'expo-image-picker';
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useTheme } from "../../context/themecontext";
import { saveProfile, getProfile } from '../services/profileApi';
import { CustomLoader } from '../../components/CustomLoader';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { appEvents, PROFILE_UPDATED } from '../utils/eventEmitter';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  name: "",
  age: 0,
  height: 0,
  weight: 0,
  gender: "male",
  activityLevel: 1.55,
  targetWeight: 0,
  timeline: 0,
  workoutDaysPerWeek: 0,
  workoutDays: [],
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
  const { mode } = useLocalSearchParams();
  const isDark = theme === 'dark';
  const styles = makeStyles(colors);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [expandedSections, setExpandedSections] = useState({
    basic: mode === "basic" || mode === "all",
    goals: mode === "goals" || mode === "all",
    workout: mode === "workout" || mode === "all",
  });

  const [editMode, setEditMode] = useState({
    basic: false,
    goals: false,
    workout: false,
  });

  useEffect(() => {
    loadProfile();
    loadUserPhoto();
  }, []);

  const showBottomSheetModal = () => {
    slideAnim.setValue(SCREEN_HEIGHT); // MUST RESET FIRST

    setShowBottomSheet(true);

    requestAnimationFrame(() => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic), // smooth finish
        useNativeDriver: true,
      }).start();
    });
  };

  const hideBottomSheet = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowBottomSheet(false);
    });
  };
  const loadUserPhoto = async () => {
    try {
      const currentUser = auth().currentUser;
      if (currentUser?.photoURL) {
        setUserPhoto(currentUser.photoURL);
      }
    } catch (error) {
      console.error('Error loading photo:', error);
    }
  };

  const pickImage = async () => {
    hideBottomSheet();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    hideBottomSheet();
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const filename = `profile_${currentUser.uid}_${Date.now()}.jpg`;
      const reference = storage().ref(`profile_photos/${filename}`);

      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();

      await currentUser.updateProfile({
        photoURL: downloadURL,
      });

      setUserPhoto(downloadURL);
      await AsyncStorage.setItem(`USER_PHOTO_${currentUser.uid}`, downloadURL);

      Alert.alert('Success', 'Profile photo updated!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;
      if (!userId) {
        setLoading(false);
        return;
      }

      let saved = await AsyncStorage.getItem(`USER_PROFILE_${userId}`);

      if (!saved) {
        try {
          const profileFromDB = await getProfile(userId);
          if (profileFromDB && profileFromDB.user_id) {
            saved = JSON.stringify(profileFromDB);
            await AsyncStorage.setItem(`USER_PROFILE_${userId}`, saved);
          }
        } catch (dbError) {
          console.log('📝 No profile in database yet');
        }
      }

      if (saved) {
        const data = JSON.parse(saved);
        setProfile({
          name: data.name || "",
          age: data.age || 0,
          height: data.height || 0,
          weight: data.weight || 0,
          gender: data.gender || "male",
          activityLevel: data.activityLevel || 1.55,
          targetWeight: data.targetWeight || 0,
          timeline: data.timeline || 0,
          workoutDaysPerWeek: data.workoutDaysPerWeek || 0,
          workoutDays: data.workoutDays || [],
        });
      } else {
        setProfile({
          name: "",
          age: 0,
          height: 0,
          weight: 0,
          gender: "male",
          activityLevel: 1.55,
          targetWeight: 0,
          timeline: 0,
          workoutDaysPerWeek: 0,
          workoutDays: [],
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
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
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      if (mode === "basic") {
        if (!profile.name?.trim()) {
          Alert.alert('Missing Info', 'Please enter your name');
          return;
        }
        if (!profile.age || profile.age <= 0) {
          Alert.alert('Missing Info', 'Please enter your age');
          return;
        }
        if (!profile.height || profile.height <= 0) {
          Alert.alert('Missing Info', 'Please enter your height');
          return;
        }
        if (!profile.weight || profile.weight <= 0) {
          Alert.alert('Missing Info', 'Please enter your weight');
          return;
        }
      }

      if (mode === "goals") {
        if (!profile.targetWeight || profile.targetWeight <= 0) {
          Alert.alert('Missing Info', 'Please enter your target weight');
          return;
        }
        if (!profile.timeline || profile.timeline <= 0) {
          Alert.alert('Missing Info', 'Please enter your timeline in weeks');
          return;
        }
      }

      if (mode === "workout") {
        if (!profile.workoutDaysPerWeek || profile.workoutDaysPerWeek <= 0) {
          Alert.alert('Missing Info', 'Please enter how many days per week you workout');
          return;
        }
        if (profile.workoutDays.length !== profile.workoutDaysPerWeek) {
          Alert.alert('Missing Info', `Please select ${profile.workoutDaysPerWeek} workout days`);
          return;
        }
      }

      const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
      const tdee = calculateTDEE(bmr, profile.activityLevel);
      const waterGoal = Math.round(profile.weight * 33);
      const restDays = WEEKDAYS.filter(day => !profile.workoutDays.includes(day));

      let weeklyWeightLoss = 0;
      let dailyDeficit = 0;
      let dailyCalorieGoal = tdee;

      if (profile.targetWeight > 0 && profile.timeline > 0) {
        const weightDiff = Math.abs(profile.weight - profile.targetWeight);
        weeklyWeightLoss = weightDiff / profile.timeline;
        dailyDeficit = Math.round((weeklyWeightLoss * 7700) / 7);
        const isLosingWeight = profile.weight > profile.targetWeight;
        dailyCalorieGoal = isLosingWeight ? tdee - dailyDeficit : tdee + dailyDeficit;
      }

      const existingData = await AsyncStorage.getItem(`USER_PROFILE_${userId}`);
      const existingProfile = existingData ? JSON.parse(existingData) : {};

      const fullProfileData = {
        userId: userId,
        name: profile.name,
        age: profile.age,
        weight: profile.weight,
        height: profile.height,
        gender: profile.gender,
        targetWeight: profile.targetWeight || 0,
        timeline: profile.timeline || 0,
        weeklyWeightLoss,
        dailyDeficit,
        workoutDaysPerWeek: profile.workoutDaysPerWeek || 0,
        workoutDays: profile.workoutDays || [],
        restDays,
        waterGoal,
        bmr,
        tdee,
        dailyCalorieGoal,
        activityLevel: profile.activityLevel || 1.55,
        basic_completed: mode === "basic" ? true : (existingProfile.basic_completed || false),
        goals_completed: mode === "goals" ? true : (existingProfile.goals_completed || false),
        workout_completed: mode === "workout" ? true : (existingProfile.workout_completed || false),
        setupDate: new Date().toISOString(),
      };

      await AsyncStorage.setItem(`USER_PROFILE_${userId}`, JSON.stringify(fullProfileData));
      await AsyncStorage.setItem(STORAGE_KEYS.BF_WEIGHT_KG, profile.weight.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, profile.name);

      if (waterGoal) {
        const waterData = {
          date: new Date().toISOString().split("T")[0],
          current: 0,
          goal: waterGoal,
          history: [],
          streak: 0,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.WATER_DATA, JSON.stringify(waterData));
      }

      if (dailyCalorieGoal && dailyCalorieGoal > 0) {
        const calData = await AsyncStorage.getItem(STORAGE_KEYS.CALORIES_DATA);
        const parsedCalData = calData ? JSON.parse(calData) : {};
        await AsyncStorage.setItem(STORAGE_KEYS.CALORIES_DATA, JSON.stringify({
          ...parsedCalData,
          goal: dailyCalorieGoal,
          profile: fullProfileData,
        }));
      }

      const dbProfileData = {
        userId: userId,
        name: profile.name,
        age: profile.age,
        weight: profile.weight,
        height: profile.height,
        gender: profile.gender,
        targetWeight: profile.targetWeight || 0,
        timeline: profile.timeline || 0,
        activityLevel: profile.activityLevel || 1.55,
        workoutDays: profile.workoutDays || [],
        workoutDaysPerWeek: profile.workoutDaysPerWeek || 0,
        waterGoal,
        bmr,
        tdee,
        dailyCalorieGoal,
        weeklyWeightLoss,
        dailyDeficit,
        restDays,
        basic_completed: mode === "basic" ? true : (existingProfile.basic_completed || false),
        goals_completed: mode === "goals" ? true : (existingProfile.goals_completed || false),
        workout_completed: mode === "workout" ? true : (existingProfile.workout_completed || false),
      };

      try {
        await saveProfile(dbProfileData);
      } catch (error) {
        console.error('⚠️ Database save failed:', error);
      }

      appEvents.emit(PROFILE_UPDATED, {
        basic_completed: fullProfileData.basic_completed,
        goals_completed: fullProfileData.goals_completed,
        workout_completed: fullProfileData.workout_completed,
      });

      if (mode === "basic") {
        router.replace('/(tabs)/home');
      } else if (mode === "goals") {
        router.replace('/(tabs)/calories');
      } else if (mode === "workout") {
        router.replace('/(tabs)/workout');
      } else if (mode === "all") {
        router.back();
      }

    } catch (error) {
      console.error("❌ Save error:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    }
  };

  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const restDays = WEEKDAYS.filter(day => !profile.workoutDays.includes(day));

  const completionPercentage = Math.round(
    ((profile.name ? 20 : 0) +
      (profile.age ? 20 : 0) +
      (profile.weight ? 20 : 0) +
      (profile.targetWeight ? 20 : 0) +
      (profile.workoutDaysPerWeek ? 20 : 0)) / 5
  );

  if (loading) {
    return <CustomLoader  fullScreen={true} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Subtle gradient background */}
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : ['#f8f9fa', '#ffffff']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Profile Image Section */}
          <View style={styles.profileImageSection}>
            <TouchableOpacity
              style={styles.profileImageContainer}
              onPress={showBottomSheetModal}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'cc']}
                style={styles.profileImageGradient}
              >
                {userPhoto ? (
                  <Image source={{ uri: userPhoto }} style={styles.profileImage} />
                ) : (
                  <Text style={styles.profileInitial}>
                    {profile.name ? profile.name.charAt(0).toUpperCase() : '👤'}
                  </Text>
                )}
                {uploadingPhoto && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                )}
              </LinearGradient>
              <View style={[styles.editIconBadge, { backgroundColor: colors.primary }]}>
                <Feather name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {profile.name || "Add Your Name"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {auth().currentUser?.email || "user@example.com"}
            </Text>
          </View>

          {/* Progress Ring */}
        

          {/* Basic Information Section */}
          {(mode === "basic" || mode === "all") && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection('basic')}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeaderLeft}>
                  <LinearGradient
                    colors={[colors.primary, colors.primary + 'aa']}
                    style={styles.cardIconGradient}
                  >
                    <Ionicons name="person-outline" size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Basic Information</Text>
                </View>
                <Ionicons
                  name={expandedSections.basic ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedSections.basic && (
                <View style={styles.cardContent}>
                  {editMode.basic ? (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surfaceContainerLow, color: colors.text, borderColor: colors.border }]}
                          value={profile.name}
                          onChangeText={(val) => setProfile({ ...profile, name: val })}
                          placeholder="Enter your name"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      <View style={styles.rowGroup}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Age</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surfaceContainerLow, color: colors.text, borderColor: colors.border }]}
                            value={profile.age === 0 ? "" : profile.age.toString()}
                            onChangeText={(val) => setProfile({ ...profile, age: val ? parseInt(val) : 0 })}
                            keyboardType="numeric"
                            placeholder="Years"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>

                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surfaceContainerLow, color: colors.text, borderColor: colors.border }]}
                            value={profile.height === 0 ? "" : profile.height.toString()}
                            onChangeText={(val) => setProfile({ ...profile, height: val ? parseInt(val) : 0 })}
                            keyboardType="numeric"
                            placeholder="cm"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Current Weight (kg)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surfaceContainerLow, color: colors.text, borderColor: colors.border }]}
                          value={profile.weight === 0 ? "" : profile.weight.toString()}
                          onChangeText={(val) => setProfile({ ...profile, weight: val ? parseFloat(val) : 0 })}
                          keyboardType="numeric"
                          placeholder="kg"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender</Text>
                        <View style={styles.genderContainer}>
                          <TouchableOpacity
                            style={[
                              styles.genderOption,
                              profile.gender === "male" && styles.genderOptionActive,
                              { backgroundColor: profile.gender === "male" ? colors.primary : colors.surfaceContainerLow }
                            ]}
                            onPress={() => setProfile({ ...profile, gender: "male" })}
                          >
                            <Ionicons name="male" size={20} color={profile.gender === "male" ? "#FFFFFF" : colors.text} />
                            <Text style={[styles.genderOptionText, { color: profile.gender === "male" ? "#FFFFFF" : colors.text }]}>Male</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.genderOption,
                              profile.gender === "female" && styles.genderOptionActive,
                              { backgroundColor: profile.gender === "female" ? colors.primary : colors.surfaceContainerLow }
                            ]}
                            onPress={() => setProfile({ ...profile, gender: "female" })}
                          >
                            <Ionicons name="female" size={20} color={profile.gender === "female" ? "#FFFFFF" : colors.text} />
                            <Text style={[styles.genderOptionText, { color: profile.gender === "female" ? "#FFFFFF" : colors.text }]}>Female</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                        onPress={() => toggleEditMode('basic')}
                      >
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.infoGrid}>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="person-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Name</Text>
                          <Text style={[styles.infoCardValue, { color: colors.text }]}>{profile.name || "Not set"}</Text>
                        </View>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Age</Text>
                          <Text style={[styles.infoCardValue, { color: colors.text }]}>{profile.age || "Not set"} yrs</Text>
                        </View>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="resize-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Height</Text>
                          <Text style={[styles.infoCardValue, { color: colors.text }]}>{profile.height || "Not set"} cm</Text>
                        </View>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="fitness-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Weight</Text>
                          <Text style={[styles.infoCardValue, { color: colors.text }]}>{profile.weight || "Not set"} kg</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border }]}
                        onPress={() => toggleEditMode('basic')}
                      >
                        <Feather name="edit-2" size={16} color={colors.primary} />
                        <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Information</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Weight Goals Section */}
          {(mode === "goals" || mode === "all") && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection('goals')}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeaderLeft}>
                  <LinearGradient
                    colors={[colors.primary, colors.primary + 'aa']}
                    style={styles.cardIconGradient}
                  >
                    <Ionicons name="trending-down-outline" size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Weight Goals</Text>
                </View>
                <Ionicons
                  name={expandedSections.goals ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedSections.goals && (
                <View style={styles.cardContent}>
                  {/* Metabolic Stats */}
                  <View style={styles.metricRow}>
                    <View style={[styles.metricCard, { backgroundColor: colors.primary + '10' }]}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>BMR</Text>
                      <Text style={[styles.metricValue, { color: colors.primary }]}>{bmr || 0}</Text>
                      <Text style={[styles.metricUnit, { color: colors.textSecondary }]}>kcal/day</Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: colors.primary + '10' }]}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>TDEE</Text>
                      <Text style={[styles.metricValue, { color: colors.primary }]}>{tdee || 0}</Text>
                      <Text style={[styles.metricUnit, { color: colors.textSecondary }]}>kcal/day</Text>
                    </View>
                  </View>

                  {editMode.goals ? (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Target Weight</Text>
                        <View style={styles.weightInputContainer}>
                          <TextInput
                            style={[styles.weightInput, { backgroundColor: colors.surfaceContainerLow, color: colors.text, borderColor: colors.border }]}
                            value={profile.targetWeight === 0 ? "" : profile.targetWeight.toString()}
                            onChangeText={(val) => setProfile({ ...profile, targetWeight: val ? parseFloat(val) : 0 })}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                          />
                          <Text style={[styles.weightUnit, { color: colors.textSecondary }]}>kg</Text>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Timeline</Text>
                        <View style={styles.timelineContainer}>
                          <TextInput
                            style={[styles.timelineInput, { backgroundColor: colors.surfaceContainerLow, color: colors.text, borderColor: colors.border }]}
                            value={profile.timeline === 0 ? "" : profile.timeline.toString()}
                            onChangeText={(val) => setProfile({ ...profile, timeline: val ? parseInt(val) : 0 })}
                            keyboardType="numeric"
                            placeholder="12"
                            placeholderTextColor={colors.textMuted}
                          />
                          <Text style={[styles.timelineUnit, { color: colors.textSecondary }]}>weeks</Text>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Activity Level</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activityScroll}>
                          {[
                            { value: 1.2, label: 'Sedentary', icon: 'bed' },
                            { value: 1.375, label: 'Light', icon: 'walk' },
                            { value: 1.55, label: 'Moderate', icon: 'bicycle' },
                            { value: 1.725, label: 'Active', icon: 'run' },
                            { value: 1.9, label: 'Very Active', icon: 'flash' }
                          ].map((level) => (
                            <TouchableOpacity
                              key={level.value}
                              style={[
                                styles.activityOption,
                                profile.activityLevel === level.value && styles.activityOptionActive,
                                { backgroundColor: profile.activityLevel === level.value ? colors.primary : colors.surfaceContainerLow }
                              ]}
                              onPress={() => setProfile({ ...profile, activityLevel: level.value })}
                            >
                              <MaterialIcons name={level.icon as any} size={24} color={profile.activityLevel === level.value ? "#FFFFFF" : colors.text} />
                              <Text style={[styles.activityOptionText, { color: profile.activityLevel === level.value ? "#FFFFFF" : colors.text }]}>
                                {level.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>

                      <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                        onPress={() => toggleEditMode('goals')}
                      >
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.infoGrid}>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="scale-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Current</Text>
                          <Text style={[styles.infoCardValue, { color: colors.text }]}>{profile.weight || "Not set"} kg</Text>
                        </View>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="flag-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Target</Text>
                          <Text style={[styles.infoCardValue, { color: colors.text }]}>{profile.targetWeight || "Not set"} kg</Text>
                        </View>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="time-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Timeline</Text>
                          <Text style={[styles.infoCardValue, { color: colors.text }]}>{profile.timeline || "Not set"} weeks</Text>
                        </View>
                        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Ionicons name="flame-outline" size={20} color={colors.primary} />
                          <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Daily Goal</Text>
                          <Text style={[styles.infoCardValue, { color: colors.primary, fontWeight: '800' }]}>
                            {profile.targetWeight > 0 ? (profile.weight > profile.targetWeight ? tdee - 500 : tdee + 500) : tdee} kcal
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border }]}
                        onPress={() => toggleEditMode('goals')}
                      >
                        <Feather name="edit-2" size={16} color={colors.primary} />
                        <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Goals</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Workout Schedule Section */}
          {(mode === "workout" || mode === "all") && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection('workout')}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeaderLeft}>
                  <LinearGradient
                    colors={[colors.primary, colors.primary + 'aa']}
                    style={styles.cardIconGradient}
                  >
                    <Ionicons name="barbell-outline" size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Workout Schedule</Text>
                </View>
                <Ionicons
                  name={expandedSections.workout ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedSections.workout && (
                <View style={styles.cardContent}>
                  {editMode.workout ? (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Days per week</Text>
                        <View style={styles.daysCounter}>
                          <TouchableOpacity
                            onPress={() => {
                              if (profile.workoutDaysPerWeek > 1) {
                                setProfile({
                                  ...profile,
                                  workoutDaysPerWeek: profile.workoutDaysPerWeek - 1,
                                  workoutDays: profile.workoutDays.slice(0, profile.workoutDaysPerWeek - 1)
                                });
                              }
                            }}
                            style={[styles.counterButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border }]}
                          >
                            <Ionicons name="remove" size={24} color={colors.primary} />
                          </TouchableOpacity>
                          <Text style={[styles.counterValue, { color: colors.text }]}>{profile.workoutDaysPerWeek}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (profile.workoutDaysPerWeek < 7) {
                                setProfile({ ...profile, workoutDaysPerWeek: profile.workoutDaysPerWeek + 1 });
                              }
                            }}
                            style={[styles.counterButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border }]}
                          >
                            <Ionicons name="add" size={24} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Select {profile.workoutDaysPerWeek} days</Text>
                        <View style={styles.daysGrid}>
                          {WEEKDAYS.map((day) => {
                            const isSelected = profile.workoutDays.includes(day);
                            return (
                              <TouchableOpacity
                                key={day}
                                style={[
                                  styles.dayButton,
                                  isSelected && styles.dayButtonActive,
                                  {
                                    backgroundColor: isSelected ? colors.primary : colors.surfaceContainerLow,
                                    borderColor: isSelected ? colors.primary : colors.border,
                                  }
                                ]}
                                onPress={() => toggleWorkoutDay(day)}
                              >
                                <Text style={[
                                  styles.dayButtonText,
                                  { color: isSelected ? '#FFFFFF' : colors.text }
                                ]}>
                                  {day.substring(0, 3)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                        onPress={() => toggleEditMode('workout')}
                      >
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.workoutStats}>
                        <View style={[styles.workoutStatCard, { backgroundColor: colors.primary + '10' }]}>
                          <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                          <Text style={[styles.workoutStatValue, { color: colors.text }]}>{profile.workoutDaysPerWeek || "Not set"}</Text>
                          <Text style={[styles.workoutStatLabel, { color: colors.textSecondary }]}>Days/Week</Text>
                        </View>
                        <View style={[styles.workoutStatCard, { backgroundColor: colors.primary + '10' }]}>
                          <Ionicons name="fitness-outline" size={24} color={colors.primary} />
                          <Text style={[styles.workoutStatValue, { color: colors.text }]}>{profile.workoutDays.length || 0}</Text>
                          <Text style={[styles.workoutStatLabel, { color: colors.textSecondary }]}>Active Days</Text>
                        </View>
                      </View>

                      <View style={styles.workoutDaysPreview}>
                        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Your Schedule</Text>
                        <View style={styles.previewDays}>
                          {profile.workoutDays.map(day => (
                            <View key={day} style={[styles.previewDay, { backgroundColor: colors.primary + '20' }]}>
                              <Text style={[styles.previewDayText, { color: colors.primary }]}>{day.substring(0, 3)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border }]}
                        onPress={() => toggleEditMode('workout')}
                      >
                        <Feather name="edit-2" size={16} color={colors.primary} />
                        <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Schedule</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleSave}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'dd']}
                style={styles.updateButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Feather name="check-circle" size={20} color="#FFFFFF" />
                <Text style={styles.updateButtonText}>Update Profile</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={async () => {
                Alert.alert(
                  'Logout',
                  'Are you sure you want to logout?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Logout',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await AsyncStorage.clear();
                          await auth().signOut();
                          router.replace('/(auth)/google-signin');
                        } catch (error) {
                          console.error('Logout error:', error);
                          Alert.alert('Error', 'Failed to logout');
                        }
                      }
                    }
                  ]
                );
              }}
            >
              <Feather name="log-out" size={20} color={colors.textSecondary} />
              <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Sheet Popup */}
      {/* Bottom Sheet Popup - Place this OUTSIDE your main View */}
      <Modal
        visible={showBottomSheet}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        hardwareAccelerated
        onRequestClose={hideBottomSheet}
      >
        <View style={styles.bottomSheetOverlay}>

          {/* Background click */}
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={hideBottomSheet}
          />

          {/* Bottom sheet */}
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.background,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.bottomSheetHandle} />

            <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>
              Change Profile Photo
            </Text>

            <TouchableOpacity style={styles.bottomSheetOption} onPress={takePhoto}>
              <Text style={{ color: colors.text }}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bottomSheetOption} onPress={pickImage}>
              <Text style={{ color: colors.text }}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bottomSheetCancel} onPress={hideBottomSheet}>
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>

          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 50 : 40, paddingBottom: 40 },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },

  profileImageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImageGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  profileImage: {
    width: 116,
    height: 116,
    borderRadius: 58,
  },
  profileInitial: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  uploadOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
  },

  progressRingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressRingWrapper: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  progressRingBg: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 8,
    backgroundColor: 'transparent',
  },
  progressRingFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 8,
    borderRadius: 4,
  },
  progressRingInner: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingPercent: {
    fontSize: 24,
    fontWeight: '800',
  },
  progressRingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  card: {
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardContent: {
    padding: 20,
    paddingTop: 0,
  },

  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    padding: 16,
    borderRadius: 16,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1,
  },
  rowGroup: {
    flexDirection: 'row',
    marginBottom: 20,
  },

  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  genderOptionActive: {
    borderWidth: 0,
  },
  genderOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  infoCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
  },

  weightInputContainer: {
    position: 'relative',
  },
  weightInput: {
    padding: 16,
    borderRadius: 16,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1,
  },
  weightUnit: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -12 }],
    fontSize: 14,
    fontWeight: '600',
  },

  timelineContainer: {
    position: 'relative',
  },
  timelineInput: {
    padding: 16,
    borderRadius: 16,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
  },
  timelineUnit: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -12 }],
    fontSize: 14,
    fontWeight: '600',
  },

  activityScroll: {
    flexDirection: 'row',
  },
  activityOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 40,
    marginRight: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activityOptionActive: {
    borderWidth: 0,
  },
  activityOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  daysCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  counterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  counterValue: {
    fontSize: 32,
    fontWeight: '800',
    minWidth: 60,
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
    borderRadius: 40,
    alignItems: 'center',
    borderWidth: 1,
  },
  dayButtonActive: {
    borderWidth: 0,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  workoutStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  workoutStatCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  workoutStatValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  workoutStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  workoutDaysPreview: {
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  previewDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewDay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewDayText: {
    fontSize: 14,
    fontWeight: '600',
  },

  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  saveButton: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  actionButtons: {
    marginTop: 24,
    gap: 12,
  },
  updateButton: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 100,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Bottom Sheet Styles
  // In your styles, replace the bottomSheetOverlay and related styles:

  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.0)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10000, // Add this
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bottomSheetOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bottomSheetOptionTextContainer: {
    flex: 1,
  },
  bottomSheetOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bottomSheetOptionSubtitle: {
    fontSize: 13,
  },
  bottomSheetCancel: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bottomSheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});