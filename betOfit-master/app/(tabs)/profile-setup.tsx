// app/(auth)/profile.tsx
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from "expo-router";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Platform, Alert, Dimensions,
  Image, Modal, ActivityIndicator, Animated, Easing, LayoutAnimation, KeyboardAvoidingView
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Circle, Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useTheme } from "../../context/themecontext";
import { AmbientGlow } from "../../components/AmbientGlow";
import { saveProfile, getProfile } from '../services/profileApi';
import { CustomLoader } from '../../components/CustomLoader';
import auth from '@react-native-firebase/auth';
import { appEvents, PROFILE_UPDATED } from '../utils/eventEmitter';
import { uploadPhotoToFirebase } from '../utils/uploadToFirebaseStorage';
import { useProfile } from '../../context/profileContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SWIPE_HINT_STORAGE_KEY = 'PROFILE_SETUP_SWIPE_HINT_SEEN';

// Adds an alpha channel to a hex color, e.g. hexToRgba('#fd7505', 0.15)
function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  dailyCalorieGoal?: number;
  daily_calorie_goal?: number;
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
  dailyCalorieGoal: 0,
};

const calculateBMR = (weight: number, height: number, age: number, gender: string) => {
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  bmr += gender === "male" ? 5 : -161;
  return Math.round(bmr);
};

const calculateTDEE = (bmr: number, activityLevel: number) => {
  return Math.round(bmr * activityLevel);
};

const sanitizeName = (value: string) => value.replace(/[^A-Za-z\s]/g, '');

const sanitizeNumericInput = (
  value: string,
  options: { min?: number; max?: number; allowDecimal?: boolean; integer?: boolean; enforceRange?: boolean } = {}
) => {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, allowDecimal = true, integer = false, enforceRange = true } = options;

  if (value === '') return 0;

  let cleaned = value.replace(/[^0-9.]/g, '');

  if (!allowDecimal) {
    cleaned = cleaned.replace(/\./g, '');
  }

  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts[1]}`;
  }

  if (cleaned === '' || cleaned === '.') return 0;

  let parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;

  if (integer) {
    parsed = Math.round(parsed);
  }

  if (enforceRange) {
    if (parsed < min) parsed = min;
    if (parsed > max) parsed = max;
  }

  return parsed;
};

export default function ProfileScreen() {
  const { colors, theme } = useTheme();
  const { mode } = useLocalSearchParams();
  const isDark = theme === 'dark';
  const styles = makeStyles(colors);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const sectionOpacity = useRef(new Animated.Value(1)).current;
  const sectionTranslateY = useRef(new Animated.Value(0)).current;
  const swipeStart = useRef({ x: 0, y: 0 });
  const horizontalSwipeActive = useRef(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [showSwipeTooltip, setShowSwipeTooltip] = useState(false);
  const { refreshProfile } = useProfile();

  // Step navigator — mirrors the "Step X of 3" flow in the design.
  // If a specific mode was passed (basic/goals/workout) we start there;
  // "all" (or anything else) starts at basic and lets the user move through all three.
  const stepOrder: Array<'basic' | 'goals' | 'workout'> = ['basic', 'goals', 'workout'];
  const [activeStep, setActiveStep] = useState<'basic' | 'goals' | 'workout'>(
    mode === 'basic' || mode === 'goals' || mode === 'workout' ? (mode as any) : 'basic'
  );
  const stepIndex = stepOrder.indexOf(activeStep);
  const stepLabels: Record<'basic' | 'goals' | 'workout', string> = {
    basic: 'Basic Info',
    goals: 'Weight Goals',
    workout: 'Workout Schedule',
  };

  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    goals: true,
    workout: true,
  });
  const [editMode, setEditMode] = useState({
    basic: mode === "basic" || (mode === "all" && !profile.name),
    goals: mode === "goals" || (mode === "all" && !profile.targetWeight),
    workout: mode === "workout" || (mode === "all" && !profile.workoutDaysPerWeek),
  });
  const editSnapshots = useRef<Record<string, string>>({});

  const getSectionSnapshot = (section: 'basic' | 'goals' | 'workout') => {
    if (section === 'basic') {
      return JSON.stringify({
        name: profile.name,
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        gender: profile.gender,
      });
    }

    if (section === 'goals') {
      return JSON.stringify({
        targetWeight: profile.targetWeight,
        targetWeightInput,
        timeline: profile.timeline,
        activityLevel: profile.activityLevel,
      });
    }

    return JSON.stringify({
      workoutDaysPerWeek: profile.workoutDaysPerWeek,
      workoutDays: profile.workoutDays,
    });
  };

  useEffect(() => {
    sectionOpacity.setValue(0);
    sectionTranslateY.setValue(14);

    Animated.parallel([
      Animated.timing(sectionOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sectionTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeStep, sectionOpacity, sectionTranslateY]);

  useEffect(() => {
    loadCompleteProfile();
  }, []);

  useEffect(() => {
    const loadSwipeHint = async () => {
      const hasSeenHint = await AsyncStorage.getItem(SWIPE_HINT_STORAGE_KEY);
      setShowSwipeTooltip(hasSeenHint !== 'true');
    };

    loadSwipeHint();
  }, []);

  const dismissSwipeTooltip = async () => {
    setShowSwipeTooltip(false);
    await AsyncStorage.setItem(SWIPE_HINT_STORAGE_KEY, 'true');
  };

  useEffect(() => {
    if (!loading) {
      stepOrder.forEach((section) => {
        if (editMode[section] && !editSnapshots.current[section]) {
          editSnapshots.current[section] = getSectionSnapshot(section);
        }
      });
    }
  }, [loading]);

  useEffect(() => {
    if (profile.targetWeight > 0) {
      setTargetWeightInput(profile.targetWeight.toString());
    } else {
      setTargetWeightInput('');
    }
  }, [profile.targetWeight]);

  const loadCompleteProfile = async () => {
    try {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;
      if (!userId) return;

      const dbProfile = await getProfile(userId);
      console.log('🔥 DB Profile:', JSON.stringify(dbProfile, null, 2));

      if (dbProfile) {
        await AsyncStorage.setItem(`USER_PROFILE_${userId}`, JSON.stringify(dbProfile));

        setProfile({
          name: dbProfile.name || "",
          age: dbProfile.age || 0,
          height: parseFloat(dbProfile.height) || 0,
          weight: parseFloat(dbProfile.weight) || 0,
          gender: dbProfile.gender || "male",
          activityLevel: parseFloat(dbProfile.activity_level) || 1.55,
          targetWeight: parseFloat(dbProfile.target_weight) || 0,
          timeline: dbProfile.timeline || 0,
          workoutDaysPerWeek: dbProfile.workout_days_per_week || 0,
          workoutDays: dbProfile.workout_days || [],
          dailyCalorieGoal: dbProfile.daily_calorie_goal || 0,
        });
      } else {
        const cachedProfile = await AsyncStorage.getItem(`USER_PROFILE_${userId}`);
        if (cachedProfile) {
          const data = JSON.parse(cachedProfile);
          setProfile({
            name: data.name || "",
            age: data.age || 0,
            height: parseFloat(data.height) || 0,
            weight: parseFloat(data.weight) || 0,
            gender: data.gender || "male",
            activityLevel: parseFloat(data.activity_level || data.activityLevel) || 1.55,
            targetWeight: parseFloat(data.target_weight || data.targetWeight) || 0,
            timeline: data.timeline || 0,
            workoutDaysPerWeek: data.workout_days_per_week || data.workoutDaysPerWeek || 0,
            workoutDays: data.workout_days || data.workoutDays || [],
            dailyCalorieGoal: data.dailyCalorieGoal || data.daily_calorie_goal || data.dailyCalorieGoal || 0,
          });
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  useEffect(() => {
    loadProfile();
    loadUserPhoto();
  }, []);

  useEffect(() => {
    const handleProfileUpdate = () => {
      loadCompleteProfile();
    };

    appEvents.on(PROFILE_UPDATED, handleProfileUpdate);

    return () => {
      appEvents.off(PROFILE_UPDATED, handleProfileUpdate);
    };
  }, []);

  const showBottomSheetModal = () => {
    slideAnim.setValue(SCREEN_HEIGHT);

    setShowBottomSheet(true);

    requestAnimationFrame(() => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
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
      const downloadURL = await uploadPhotoToFirebase(uri, filename);

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
          height: parseFloat(data.height) || 0,
          weight: parseFloat(data.weight) || 0,
          gender: data.gender || "male",
          activityLevel: parseFloat(data.activity_level || data.activityLevel) || 1.55,
          targetWeight: parseFloat(data.target_weight || data.targetWeight) || 0,
          timeline: data.timeline || 0,
          workoutDaysPerWeek: data.workout_days_per_week || data.workoutDaysPerWeek || 0,
          workoutDays: data.workout_days || data.workoutDays || [],
          dailyCalorieGoal: data.dailyCalorieGoal || data.daily_calorie_goal || 0,
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
          dailyCalorieGoal: 0,
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
    if (!editMode[section]) {
      editSnapshots.current[section] = getSectionSnapshot(section);
    }

    if (mode === "all") {
      setEditMode({
        basic: section === 'basic',
        goals: section === 'goals',
        workout: section === 'workout',
      });
    } else {
      setEditMode(prev => ({
        ...prev,
        [section]: !prev[section]
      }));
    }
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

  const handleTextChange = (field: string, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleNameChange = (value: string) => {
    const cleanedName = sanitizeName(value);
    setProfile(prev => ({ ...prev, name: cleanedName }));
  };

  const handleNumericChange = (
    field: 'age' | 'height' | 'weight' | 'targetWeight' | 'timeline',
    value: string,
    options: { min?: number; max?: number; allowDecimal?: boolean; integer?: boolean; enforceRange?: boolean } = {}
  ) => {
    const parsedValue = sanitizeNumericInput(value, options);

    if (field === 'targetWeight') {
      setTargetWeightInput(value === '' ? '' : parsedValue.toString());
      setProfile(prev => ({ ...prev, targetWeight: value === '' ? 0 : parsedValue }));
    } else {
      setProfile(prev => ({ ...prev, [field]: parsedValue }));
    }
  };

  const handleSave = async () => {
    console.log("🟡 [handleSave] Started");
    try {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;
      const email = currentUser?.email;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const existingData = await AsyncStorage.getItem(`USER_PROFILE_${userId}`);
      const existingProfile = existingData ? JSON.parse(existingData) : {};

      let dbProfile = null;
      try {
        dbProfile = await getProfile(userId);
      } catch (e) {
        console.log("Could not fetch from DB");
      }

      const mergedProfile = {
        name: profile.name || existingProfile.name || dbProfile?.name || "",
        age: profile.age || existingProfile.age || dbProfile?.age || 0,
        height: profile.height || existingProfile.height || dbProfile?.height || 0,
        weight: profile.weight || existingProfile.weight || dbProfile?.weight || 0,
        gender: profile.gender || existingProfile.gender || dbProfile?.gender || "male",
        activityLevel: profile.activityLevel || existingProfile.activityLevel || dbProfile?.activity_level || 1.55,
        targetWeight: profile.targetWeight || existingProfile.targetWeight || dbProfile?.target_weight || 0,
        timeline: profile.timeline || existingProfile.timeline || dbProfile?.timeline || 0,
        workoutDaysPerWeek: profile.workoutDaysPerWeek || existingProfile.workoutDaysPerWeek || dbProfile?.workout_days_per_week || 0,
        workoutDays: profile.workoutDays.length ? profile.workoutDays : existingProfile.workoutDays || dbProfile?.workout_days || [],
      };

      console.log("🟡 Merged profile:", mergedProfile);

      if (mode === "basic") {
        const trimmedName = mergedProfile.name?.trim() || '';

        if (!trimmedName) {
          Alert.alert('Missing Info', 'Please enter your name');
          return;
        }

        if (!/^[A-Za-z\s]+$/.test(trimmedName)) {
          Alert.alert('Invalid Name', 'Name can only contain letters and spaces');
          return;
        }

        if (!mergedProfile.age || mergedProfile.age < 1 || mergedProfile.age > 100) {
          Alert.alert('Invalid Age', 'Age must be between 1 and 100 years');
          return;
        }

        if (!mergedProfile.height || mergedProfile.height < 50 || mergedProfile.height > 300) {
          Alert.alert('Invalid Height', 'Height must be between 50 and 300 cm');
          return;
        }

        if (!mergedProfile.weight || mergedProfile.weight < 1 || mergedProfile.weight > 300) {
          Alert.alert('Invalid Weight', 'Weight must be between 1 and 300 kg');
          return;
        }
      }

      if (mode === "goals") {
        if (!mergedProfile.targetWeight || mergedProfile.targetWeight <= 0) {
          Alert.alert('Missing Info', 'Please enter your target weight');
          return;
        }
        if (!mergedProfile.timeline || mergedProfile.timeline <= 0) {
          Alert.alert('Missing Info', 'Please enter your timeline in weeks');
          return;
        }
      }

      if (mode === "workout") {
        if (!mergedProfile.workoutDaysPerWeek || mergedProfile.workoutDaysPerWeek <= 0) {
          Alert.alert('Missing Info', 'Please enter how many days per week you workout');
          return;
        }
        if (mergedProfile.workoutDays.length !== mergedProfile.workoutDaysPerWeek) {
          Alert.alert('Missing Info', `Please select ${mergedProfile.workoutDaysPerWeek} workout days`);
          return;
        }
      }

      const bmr = calculateBMR(mergedProfile.weight, mergedProfile.height, mergedProfile.age, mergedProfile.gender);
      const tdee = calculateTDEE(bmr, mergedProfile.activityLevel);
      const waterGoal = Math.round(mergedProfile.weight * 33);
      const restDays = WEEKDAYS.filter(day => !mergedProfile.workoutDays.includes(day));

      let weeklyWeightLoss = 0;
      let dailyDeficit = 0;
      let dailyCalorieGoal = tdee;

      if (mergedProfile.targetWeight > 0 && mergedProfile.timeline > 0) {
        const weightDiff = Math.abs(mergedProfile.weight - mergedProfile.targetWeight);
        weeklyWeightLoss = weightDiff / mergedProfile.timeline;
        dailyDeficit = Math.round((weeklyWeightLoss * 7700) / 7);
        const isLosingWeight = mergedProfile.weight > mergedProfile.targetWeight;
        dailyCalorieGoal = isLosingWeight ? tdee - dailyDeficit : tdee + dailyDeficit;
      }

      let basicCompleted = existingProfile.basic_completed || dbProfile?.basic_completed || false;
      let goalsCompleted = existingProfile.goals_completed || dbProfile?.goals_completed || false;
      let workoutCompleted = existingProfile.workout_completed || dbProfile?.workout_completed || false;

      if (mode === "basic") basicCompleted = true;
      if (mode === "goals") goalsCompleted = true;
      if (mode === "workout") workoutCompleted = true;

      console.log("🟡 Completion flags:", { basicCompleted, goalsCompleted, workoutCompleted });

      const fullProfileData = {
        userId: userId,
        name: mergedProfile.name?.trim() || '',
        age: mergedProfile.age,
        weight: mergedProfile.weight,
        height: mergedProfile.height,
        gender: mergedProfile.gender,
        targetWeight: mergedProfile.targetWeight || 0,
        timeline: mergedProfile.timeline || 0,
        weeklyWeightLoss,
        dailyDeficit,
        workoutDaysPerWeek: mergedProfile.workoutDaysPerWeek || 0,
        workoutDays: mergedProfile.workoutDays || [],
        restDays,
        waterGoal,
        bmr,
        tdee,
        dailyCalorieGoal,
        activityLevel: mergedProfile.activityLevel || 1.55,
        basic_completed: basicCompleted,
        goals_completed: goalsCompleted,
        workout_completed: workoutCompleted,
        setupDate: new Date().toISOString(),
      };

      await AsyncStorage.setItem(`USER_PROFILE_${userId}`, JSON.stringify(fullProfileData));
      await AsyncStorage.setItem(STORAGE_KEYS.BF_WEIGHT_KG, mergedProfile.weight.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.USER_NAME, mergedProfile.name);

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
        name: mergedProfile.name,
        email: email,
        age: mergedProfile.age,
        weight: mergedProfile.weight,
        height: mergedProfile.height,
        gender: mergedProfile.gender,
        targetWeight: mergedProfile.targetWeight || 0,
        timeline: mergedProfile.timeline || 0,
        activityLevel: mergedProfile.activityLevel || 1.55,
        workoutDays: mergedProfile.workoutDays || [],
        workoutDaysPerWeek: mergedProfile.workoutDaysPerWeek || 0,
        waterGoal,
        bmr,
        tdee,
        dailyCalorieGoal,
        weeklyWeightLoss,
        dailyDeficit,
        restDays,
        basic_completed: basicCompleted,
        goals_completed: goalsCompleted,
        workout_completed: workoutCompleted,
      };

      console.log("🟡 Saving to backend:", JSON.stringify(dbProfileData, null, 2));

      try {
        await saveProfile(dbProfileData);
        console.log("✅ Profile saved to backend successfully");
      } catch (error) {
        console.error('⚠️ Database save failed:', error);
      }

      await refreshProfile();

      appEvents.emit(PROFILE_UPDATED, {
        basic_completed: basicCompleted,
        goals_completed: goalsCompleted,
        workout_completed: workoutCompleted,
      });

      if (mode === "all") {
        Alert.alert('✅ Success', 'Profile updated successfully!');
        await loadCompleteProfile();
        setEditMode({
          basic: false,
          goals: false,
          workout: false,
        });
      } else if (mode === "basic") {
        router.replace('/(tabs)/home');
      } else if (mode === "goals") {
        router.replace('/(tabs)/calories');
      } else if (mode === "workout") {
        router.replace('/(tabs)/workout');
      }

    } catch (error) {
      console.error("❌ Save error:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    }
  };

  // Advances the visual stepper. On the last step, triggers the actual save.
  const goToNextStep = () => {
    if (stepIndex < stepOrder.length - 1) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveStep(stepOrder[stepIndex + 1]);
    }
    else {
      handleSave();
    }
  };

  const goToPreviousStep = () => {
    if (stepIndex > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveStep(stepOrder[stepIndex - 1]);
    } else {
      router.back();
    }
  };

  const handleSectionEdit = async (section: 'basic' | 'goals' | 'workout') => {
    if (editMode[section]) {
      const snapshot = editSnapshots.current[section];
      const hasChanges = snapshot !== undefined && snapshot !== getSectionSnapshot(section);

      if (hasChanges) {
        await handleSave();
      }

      delete editSnapshots.current[section];
      setEditMode(prev => ({ ...prev, [section]: false }));
    } else {
      toggleEditMode(section);
    }
  };

  const handleSignOut = () => {
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
              const recentGoogleEmail = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_GOOGLE_EMAIL);
              await AsyncStorage.clear();
              if (recentGoogleEmail) {
                await AsyncStorage.setItem(STORAGE_KEYS.RECENT_GOOGLE_EMAIL, recentGoogleEmail);
              }
              await auth().signOut();
              router.replace('/(auth)/google-signin');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ],
    );
  };

  const handleSwipeStart = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    swipeStart.current = { x: pageX, y: pageY };
    horizontalSwipeActive.current = false;
    setScrollEnabled(true);
  };

  const handleSwipeMove = (event: any) => {
    if (horizontalSwipeActive.current) return;

    const { pageX, pageY } = event.nativeEvent;
    const horizontalMovement = Math.abs(pageX - swipeStart.current.x);
    const verticalMovement = Math.abs(pageY - swipeStart.current.y);

    if (horizontalMovement >= 40 && horizontalMovement > verticalMovement * 1.2) {
      horizontalSwipeActive.current = true;
      if (showSwipeTooltip) {
        dismissSwipeTooltip();
      }

      if (pageX < swipeStart.current.x && stepIndex < stepOrder.length - 1) {
        goToNextStep();
      } else if (pageX > swipeStart.current.x && stepIndex > 0) {
        goToPreviousStep();
      }

      setScrollEnabled(false);
    }
  };

  const handleSwipeEnd = (event: any) => {
    horizontalSwipeActive.current = false;
    setScrollEnabled(true);
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
    return <CustomLoader fullScreen />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Ambient glow */}
          <AmbientGlow />

        {/* Header */}
        <View style={styles.newHeader}>
           
          <TouchableOpacity onPress={goToPreviousStep} activeOpacity={0.85}>
            <View style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </View>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.stepEyebrow, { color: colors.primary }]}>
              STEP {stepIndex + 1} OF {stepOrder.length}
            </Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              {activeStep === 'basic' ? 'BODY SPECS & METRICS' : stepLabels[activeStep].toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.signOutGradientButton}
            >
              <Feather name="log-out" size={17} color="#FFFFFF" />
              <Text style={styles.signOutButtonText}>Exit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 28, paddingTop: 12 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          directionalLockEnabled
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={handleSwipeEnd}
          onTouchCancel={() => {
            horizontalSwipeActive.current = false;
            setScrollEnabled(true);
          }}
        >

          {/* Step navigator pill */}
          <View style={styles.stepNavigatorWrap}>
            <View style={[styles.stepPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.stepDotsRow}>
                {stepOrder.map((step, index) => (
                  <View
                    key={step}
                    style={[
                      styles.stepDot,
                      { backgroundColor: index === stepIndex ? colors.primary : colors.border },
                    ]}
                  />
                ))}
                <Text style={[styles.stepPillLabel, { color: colors.text }]}>
                  {stepLabels[activeStep]}
                </Text>
              </View>
            </View>

            {showSwipeTooltip && (
              <View style={[styles.swipeTooltip, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <View style={[styles.swipeTooltipPointer, { backgroundColor: colors.surface, borderColor: colors.primary }]} />
                <Ionicons name="swap-horizontal-outline" size={15} color={colors.primary} />
                <Text style={[styles.swipeTooltipText, { color: colors.text }]}>Swipe to switch</Text>
                <TouchableOpacity onPress={dismissSwipeTooltip} hitSlop={8}>
                  <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* User identity hero */}
          <View style={styles.identityHero}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={showBottomSheetModal}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.avatarRing}
              >
                <View style={[styles.avatarInner, { backgroundColor: colors.surface }]}>
                  {userPhoto ? (
                    <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarInitial, { color: colors.text }]}>
                      {profile.name ? profile.name.charAt(0).toUpperCase() : '👤'}
                    </Text>
                  )}
                  {uploadingPhoto && (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </LinearGradient>
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Feather name="edit-2" size={11} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.nameRow}>
              <Text style={[styles.identityName, { color: colors.text }]}>
                {profile.name || 'Add Your Name'}
              </Text>
              <View style={[styles.verifiedBadge, { backgroundColor: hexToRgba(colors.primary, 0.2) }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              </View>
            </View>
            <Text style={[styles.identityEmail, { color: colors.textSecondary }]}>
              {auth().currentUser?.email || 'user@example.com'}
            </Text>

            <View style={[styles.goalChip, { backgroundColor: hexToRgba(colors.primary, 0.1), borderColor: hexToRgba(colors.primary, 0.25) }]}>
              <View style={[styles.goalChipDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.goalChipText, { color: colors.primary }]}>
                🎯 Goal: {profile.targetWeight ? `${profile.targetWeight}kg in ${profile.timeline}wks` : 'Set your goal'}
              </Text>
            </View>

            <View style={[styles.metabolicStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.metabolicItem}>
                <Ionicons name="flame-outline" size={15} color={colors.primary} />
                <View>
                  <Text style={[styles.metabolicLabel, { color: colors.textSecondary }]}>BMR</Text>
                  <Text style={[styles.metabolicValue, { color: colors.text }]}>{bmr || '—'} <Text style={styles.metabolicUnit}>kcal</Text></Text>
                </View>
              </View>
              <View style={[styles.metabolicDivider, { backgroundColor: colors.border }]} />
              <View style={styles.metabolicItem}>
                <Ionicons name="pulse-outline" size={15} color={colors.secondary} />
                <View>
                  <Text style={[styles.metabolicLabel, { color: colors.textSecondary }]}>TDEE</Text>
                  <Text style={[styles.metabolicValue, { color: colors.text }]}>{tdee || '—'} <Text style={styles.metabolicUnit}>kcal/day</Text></Text>
                </View>
              </View>
            </View>
          </View>

          <Animated.View
            style={[
              styles.sectionFrame,
              {
                opacity: sectionOpacity,
                transform: [{ translateY: sectionTranslateY }],
              },
            ]}
          >
          {/* ---------------- BASIC INFO STEP ---------------- */}
          {activeStep === 'basic' && (
            <View style={{ marginTop: 20 }}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionEyebrow, { color: colors.textSecondary }]}>PHYSICAL PROFILE</Text>
                <TouchableOpacity
                  onPress={() => handleSectionEdit('basic')}
                >
                  <Text style={[styles.editSpecsLink, { color: colors.primary }]}>
                      <Ionicons name={editMode.basic ? 'checkmark' : 'create-outline'} size={13} color={colors.primary} />
                      {editMode.basic ? ' Done' : ' Edit Specs'}
                  </Text>
                </TouchableOpacity>

              </View>

              {editMode.basic ? (
                <View style={[styles.editPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.editPanelHeader}>
                    <View style={[styles.editPanelIcon, { backgroundColor: hexToRgba(colors.primary, 0.12) }]}>
                      <Ionicons name="person-outline" size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.editPanelTitle, { color: colors.text }]}>Your details</Text>
                      <Text style={[styles.editPanelSubtitle, { color: colors.textSecondary }]}>Keep your profile accurate</Text>
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, color: colors.text, borderColor: colors.border }]}
                      value={profile.name}
                      onChangeText={handleNameChange}
                      placeholder="Enter your name"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                      maxLength={50}
                    />
                  </View>

                  <View style={styles.rowGroup}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Age</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, color: colors.text, borderColor: colors.border }]}
                        value={profile.age === 0 ? "" : profile.age.toString()}
                        onChangeText={(val) => handleNumericChange('age', val, { min: 1, max: 100, integer: true })}
                        keyboardType="number-pad"
                        placeholder="Years"
                        placeholderTextColor={colors.textMuted}
                        maxLength={3}
                      />
                    </View>

                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, color: colors.text, borderColor: colors.border }]}
                        value={profile.height === 0 ? "" : profile.height.toString()}
                        onChangeText={(val) => handleNumericChange('height', val, { min: 50, max: 300, allowDecimal: true, enforceRange: false })}
                        keyboardType="decimal-pad"
                        placeholder="cm"
                        placeholderTextColor={colors.textMuted}
                        maxLength={5}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Current Weight (kg)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, color: colors.text, borderColor: colors.border }]}
                      value={profile.weight === 0 ? "" : profile.weight.toString()}
                      onChangeText={(val) => handleNumericChange('weight', val, { min: 1, max: 300, allowDecimal: true })}
                      keyboardType="decimal-pad"
                      placeholder="kg"
                      placeholderTextColor={colors.textMuted}
                      maxLength={5}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender</Text>
                    <View style={styles.genderContainer}>
                      <TouchableOpacity
                        style={[
                          styles.genderOption,
                          { backgroundColor: profile.gender === "male" ? colors.primary : (colors.surfaceContainerLow ?? colors.surface) }
                        ]}
                        onPress={() => setProfile({ ...profile, gender: "male" })}
                      >
                        <Ionicons name="male" size={20} color={profile.gender === "male" ? "#FFFFFF" : colors.text} />
                        <Text style={[styles.genderOptionText, { color: profile.gender === "male" ? "#FFFFFF" : colors.text }]}>Male</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.genderOption,
                          { backgroundColor: profile.gender === "female" ? colors.primary : (colors.surfaceContainerLow ?? colors.surface) }
                        ]}
                        onPress={() => setProfile({ ...profile, gender: "female" })}
                      >
                        <Ionicons name="female" size={20} color={profile.gender === "female" ? "#FFFFFF" : colors.text} />
                        <Text style={[styles.genderOptionText, { color: profile.gender === "female" ? "#FFFFFF" : colors.text }]}>Female</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.specsGrid}>
                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>AGE</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.text }]}>
                      {profile.age || '—'} <Text style={styles.specUnit}>yrs</Text>
                    </Text>
                    <Text style={[styles.specSubtext, { color: colors.success }]}>Prime Metabolic</Text>
                  </View>

                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>GENDER</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="person-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.text }]}>
                      {profile.gender === "male" ? "Male" : "Female"}
                    </Text>
                    <Text style={[styles.specSubtext, { color: colors.textMuted }]}>Biological Sex</Text>
                  </View>

                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>HEIGHT</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="resize-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.text }]}>
                      {profile.height || '—'} <Text style={styles.specUnit}>cm</Text>
                    </Text>
                    <Text style={[styles.specSubtext, { color: colors.primary }]}>
                      {profile.height ? `${Math.floor(profile.height / 30.48)}' ${Math.round((profile.height / 2.54) % 12)}"` : '—'}
                    </Text>
                  </View>

                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>WEIGHT</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="fitness-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.text }]}>
                      {profile.weight || '—'} <Text style={styles.specUnit}>kg</Text>
                    </Text>
                    <Text style={[styles.specSubtext, { color: colors.textMuted }]}>
                      {profile.weight ? `${Math.round(profile.weight * 2.2046)} lbs` : '—'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ---------------- WEIGHT GOALS STEP ---------------- */}
          {activeStep === 'goals' && (
            <View style={{ marginTop: 20 }}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionEyebrow, { color: colors.textSecondary }]}>WEIGHT GOALS</Text>
                <TouchableOpacity
                  onPress={() => handleSectionEdit('goals')}
                >
                  <Text style={[styles.editSpecsLink, { color: colors.primary }]}>
                    <Ionicons name={editMode.goals ? 'checkmark' : 'create-outline'} size={13} color={colors.primary} />
                    {editMode.goals ? ' Done' : ' Edit Goals'}
                  </Text>
                </TouchableOpacity>
              </View>

              {editMode.goals ? (
                <View style={[styles.editPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.editPanelHeader}>
                    <View style={[styles.editPanelIcon, { backgroundColor: hexToRgba(colors.primary, 0.12) }]}>
                      <Ionicons name="flag-outline" size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.editPanelTitle, { color: colors.text }]}>Set your target</Text>
                      <Text style={[styles.editPanelSubtitle, { color: colors.textSecondary }]}>Shape a plan that fits you</Text>
                    </View>
                  </View>
                  <View style={styles.goalsInputRow}>
                    <View style={[styles.inputGroup, styles.goalsInputGroup]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Target Weight</Text>
                      <View style={styles.weightInputContainer}>
                        <TextInput
                          style={[styles.weightInput, styles.goalsInput, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, color: colors.text, borderColor: colors.border }]}
                          value={targetWeightInput}
                          onChangeText={(val) => handleNumericChange('targetWeight', val, { min: 1, max: 300, allowDecimal: true })}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          maxLength={5}
                        />
                        <Text style={[styles.weightUnit, { color: colors.textSecondary }]}>kg</Text>
                      </View>
                    </View>

                    <View style={[styles.inputGroup, styles.goalsInputGroup]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Timeline</Text>
                      <View style={styles.timelineContainer}>
                        <TextInput
                          style={[styles.timelineInput, styles.goalsInput, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, color: colors.text, borderColor: colors.border }]}
                          value={profile.timeline === 0 ? "" : profile.timeline.toString()}
                          onChangeText={(val) => handleNumericChange('timeline', val, { min: 1, max: 104, integer: true })}
                          keyboardType="number-pad"
                          placeholder="12"
                          placeholderTextColor={colors.textMuted}
                          maxLength={3}
                        />
                        <Text style={[styles.timelineUnit, { color: colors.textSecondary }]}>weeks</Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.goalsActivityGroup]}>
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
                            { backgroundColor: profile.activityLevel === level.value ? colors.primary : (colors.surfaceContainerLow ?? colors.surface) }
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
                </View>
              ) : (
                <View style={styles.specsGrid}>
                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>CURRENT</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="scale-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.text }]}>
                      {profile.weight || '—'} <Text style={styles.specUnit}>kg</Text>
                    </Text>
                  </View>

                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>TARGET</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="flag-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.text }]}>
                      {profile.targetWeight || '—'} <Text style={styles.specUnit}>kg</Text>
                    </Text>
                  </View>

                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>TIMELINE</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.text }]}>
                      {profile.timeline || '—'} <Text style={styles.specUnit}>wks</Text>
                    </Text>
                  </View>

                  <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.specCardTopRow}>
                      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>DAILY GOAL</Text>
                      <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                        <Ionicons name="flame-outline" size={14} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={[styles.specValue, { color: colors.primary }]}>
                      {profile.dailyCalorieGoal || '—'} <Text style={styles.specUnit}>kcal</Text>
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ---------------- WORKOUT SCHEDULE STEP ---------------- */}
          {activeStep === 'workout' && (
            <View style={{ marginTop: 20 }}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionEyebrow, { color: colors.textSecondary }]}>WORKOUT SCHEDULE</Text>
               <TouchableOpacity
                  onPress={() => handleSectionEdit('workout')}
                >
                  <Text style={[styles.editSpecsLink, { color: colors.primary }]}>
                    <Ionicons name={editMode.workout ? 'checkmark' : 'create-outline'} size={13} color={colors.primary} />
                    {editMode.workout ? ' Done' : ' Edit Schedule'}
                  </Text>
                </TouchableOpacity>
              </View>

              {editMode.workout ? (
                <View style={[styles.editPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.editPanelHeader}>
                    <View style={[styles.editPanelIcon, { backgroundColor: hexToRgba(colors.primary, 0.12) }]}>
                      <Ionicons name="barbell-outline" size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.editPanelTitle, { color: colors.text }]}>Build your week</Text>
                      <Text style={[styles.editPanelSubtitle, { color: colors.textSecondary }]}>Choose your active days</Text>
                    </View>
                  </View>
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
                        style={[styles.counterButton, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, borderColor: colors.border }]}
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
                        style={[styles.counterButton, { backgroundColor: colors.surfaceContainerLow ?? colors.surface, borderColor: colors.border }]}
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
                              {
                                backgroundColor: isSelected ? colors.primary : (colors.surfaceContainerLow ?? colors.surface),
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
                </View>
              ) : (
                <>
                  <View style={styles.specsGrid}>
                    <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.specCardTopRow}>
                        <Text style={[styles.specLabel, { color: colors.textSecondary }]}>REST DAYS</Text>
                        <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                          <Ionicons name="bed-outline" size={14} color={colors.primary} />
                        </View>
                      </View>
                      <Text style={[styles.specValue, { color: colors.text }]}>
                        {7 - (profile.workoutDays.length || 0)}
                      </Text>
                    </View>

                    <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.specCardTopRow}>
                        <Text style={[styles.specLabel, { color: colors.textSecondary }]}>ACTIVE DAYS</Text>
                        <View style={[styles.specIconChip, { backgroundColor: hexToRgba(colors.primary, 0.1) }]}>
                          <Ionicons name="fitness-outline" size={14} color={colors.primary} />
                        </View>
                      </View>
                      <Text style={[styles.specValue, { color: colors.text }]}>
                        {profile.workoutDays.length || 0}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.workoutDaysPreview}>
                    <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Your Schedule</Text>
                    <View style={styles.previewDays}>
                      {profile.workoutDays.map(day => (
                        <View key={day} style={[styles.previewDay, { backgroundColor: hexToRgba(colors.primary, 0.15) }]}>
                          <Text style={[styles.previewDayText, { color: colors.primary }]}>{day.substring(0, 3)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          </Animated.View>

          {/* Next / Finish CTA — shared across all three steps */}
          <View style={styles.nextCta}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextCtaGradient}
            >
              <TouchableOpacity
                style={styles.nextCtaArrowButton}
                onPress={goToPreviousStep}
                disabled={stepIndex === 0}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="arrow-back"
                  size={16}
                  color={stepIndex === 0 ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                />
              </TouchableOpacity>
              <Text style={styles.nextCtaText}>
                {stepIndex < stepOrder.length - 1
                  ? `NEXT: ${stepLabels[stepOrder[stepIndex + 1]].toUpperCase()}`
                  : 'FINISH'}
              </Text>
              <TouchableOpacity
                style={styles.nextCtaRight}
                onPress={goToNextStep}
                activeOpacity={0.7}
              >
                <View style={styles.nextCtaDots}>
                  {stepOrder.map((s, i) => (
                    <View
                      key={s}
                      style={[
                        styles.nextCtaDot,
                        { backgroundColor: i === stepIndex ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
                      ]}
                    />
                  ))}
                </View>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          <View style={styles.resetSyncRow}>
            <TouchableOpacity style={styles.resetButton} onPress={loadCompleteProfile}>
              <Feather name="refresh-cw" size={13} color={colors.textSecondary} />
              <Text style={[styles.resetText, { color: colors.textSecondary }]}>Reset</Text>
            </TouchableOpacity>
            <Text style={[styles.syncedAgoText, { color: colors.textMuted }]}>Synced 2 mins ago</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Sheet Popup */}
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
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={hideBottomSheet}
          />

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
      {loading && <CustomLoader fullScreen />}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
   ambientGlowWrap: {
      position: 'absolute',
      top: 10,
      left: '50%',
      marginLeft: -180,
    },

  topGlow: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -160,
    width: 320,
    height: 200,
    borderRadius: 100,
    backgroundColor: hexToRgba(colors.primary, 0.15),
  },
  newHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  circleIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutGradientButton: {
    minWidth: 64,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  stepEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2 },
  stepTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stepDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepPillLabel: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  stepNavigatorWrap: { position: 'relative', zIndex: 5 },
  swipeTooltip: {
    position: 'absolute',
    top: 39,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 4,
  },
  swipeTooltipPointer: {
    position: 'absolute',
    top: -5,
    right: 22,
    width: 9,
    height: 9,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  swipeTooltipText: { fontSize: 10, fontWeight: '800' },
  identityHero: { alignItems: 'center', paddingTop: 18, paddingBottom: 6 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatarRing: { width: 80, height: 80, borderRadius: 40, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: '100%', height: '100%', borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 30, fontWeight: '800' },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  identityName: { fontSize: 18, fontWeight: '800' },
  verifiedBadge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  identityEmail: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  goalChipDot: { width: 6, height: 6, borderRadius: 3 },
  goalChipText: { fontSize: 12, fontWeight: '600' },
  metabolicStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 9,
    marginTop: 10,
  },
  metabolicItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metabolicLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  metabolicValue: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  metabolicUnit: { fontSize: 9, fontWeight: '500' },
  metabolicDivider: { width: 1, height: 24 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  sectionEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  editSpecsLink: { fontSize: 12, fontWeight: '600' },
  editPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  editPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.14)',
  },
  editPanelIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPanelTitle: { fontSize: 13, fontWeight: '800' },
  editPanelSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  specCard: { width: '47%', borderWidth: 1, borderRadius: 16, padding: 14 },
  specCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  specLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  specIconChip: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  specValue: { fontSize: 22, fontWeight: '900' },
  specUnit: { fontSize: 12, fontWeight: '400' },
  specSubtext: { fontSize: 10, fontWeight: '600', marginTop: 4 },

  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '500',
    borderWidth: 1,
  },
  rowGroup: {
    flexDirection: 'row',
    marginBottom: 14,
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
    padding: 12,
    borderRadius: 12,
  },
  genderOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  goalsMetricRow: {
    marginBottom: 14,
  },
  goalsInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  goalsInputGroup: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  goalsInput: {
    fontSize: 18,
    paddingLeft: 10,
    paddingRight: 48,
  },
  goalsActivityGroup: {
    marginBottom: 4,
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
    padding: 12,
    borderRadius: 12,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1,
  },
  weightUnit: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    fontSize: 12,
    fontWeight: '600',
  },

  timelineContainer: {
    position: 'relative',
  },
  timelineInput: {
    padding: 12,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
  },
  timelineUnit: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: [{ translateY: -12 }],
    fontSize: 11,
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
  dayButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  workoutDaysPreview: {
    marginTop: 4,
    marginBottom: 4,
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

  nextCta: { marginTop: 20, borderRadius: 18, overflow: 'hidden' },
  sectionFrame: { width: '96%', alignSelf: 'center' },
  nextCtaArrowButton: { width: 28, alignItems: 'center', justifyContent: 'center' },
  nextCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  nextCtaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  nextCtaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextCtaDots: { flexDirection: 'row', gap: 4 },
  nextCtaDot: { width: 5, height: 5, borderRadius: 2.5 },

  resetSyncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginTop: 10 },
  resetButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resetText: { fontSize: 12, fontWeight: '500' },
  syncedAgoText: { fontSize: 11 },

  actionButtons: {
    marginTop: 28,
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
    zIndex: 10000,
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
  bottomSheetCancel: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
});