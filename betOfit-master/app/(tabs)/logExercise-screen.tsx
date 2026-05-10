// app/(tabs)/log-exercise.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  Vibration,
  ImageBackground,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../../context/themecontext';
import { useToday } from '../../context/todayContext';
import { calculateCaloriesBurned, saveWorkoutToBackend } from '../services/exerciseApi';

const { width, height } = Dimensions.get('window');

interface WorkoutSet {
  id: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  actualDuration?: number; // Real time spent on this set
  caloriesBurned?: number; // Calories for this specific set
}

interface LogExerciseParams {
  exerciseId: string;
  exerciseName: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  type: string;
}

type SetTimerState = 'idle' | 'running' | 'paused';

const getTrackingMode = (type: string, equipment: string, exerciseName: string): 'reps-weight' | 'reps-only' | 'time-only' | 'time-distance' => {
  const name = exerciseName.toLowerCase();
  const equip = equipment.toLowerCase();
  const exerciseType = type.toLowerCase();

  if (exerciseType === 'cardio' ||
    name.includes('run') || name.includes('jog') || name.includes('bike') ||
    name.includes('cycle') || name.includes('swim') || name.includes('rowing') ||
    name.includes('treadmill') || name.includes('elliptical')) {
    return 'time-distance';
  }

  if (name.includes('plank') || name.includes('wall sit') || name.includes('hold') ||
    exerciseType === 'flexibility' || name.includes('stretch')) {
    return 'time-only';
  }

  if (equip === 'body only' || equip === 'bodyweight' || equip === 'none' ||
    name.includes('push-up') || name.includes('pushup') || name.includes('pull-up') ||
    name.includes('pullup') || name.includes('sit-up') || name.includes('situp') ||
    (name.includes('dip') && equip === 'body only')) {
    return 'reps-only';
  }

  return 'reps-weight';
};

export default function LogExerciseScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);
  const { updateAfterWorkout } = useToday();
  const params = useLocalSearchParams<LogExerciseParams>();
  const trackingMode = getTrackingMode(params.type, params.equipment, params.exerciseName);

  const createEmptySet = (): WorkoutSet => {
    const base = { id: Date.now().toString(), setNumber: 0, actualDuration: 0, caloriesBurned: 0 };
    switch (trackingMode) {
      case 'reps-weight': return { ...base, reps: 0, weight: 0 };
      case 'reps-only': return { ...base, reps: 0 };
      case 'time-only': return { ...base, duration: 0 };
      case 'time-distance': return { ...base, duration: 0, distance: 0 };
      default: return { ...base, reps: 0, weight: 0 };
    }
  };

  const [completedSets, setCompletedSets] = useState<WorkoutSet[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSet, setCurrentSet] = useState<WorkoutSet>(createEmptySet());
  const [notes, setNotes] = useState('');
  const [startTime] = useState(new Date());
  const [userWeight, setUserWeight] = useState(70);

  // ⏱️ TIMER STATES
  const [setTimerState, setSetTimerState] = useState<SetTimerState>('idle');
  const [setStartTime, setSetStartTime] = useState<number>(0);
  const [setElapsedTime, setSetElapsedTime] = useState<number>(0);
  const [restStartTime, setRestStartTime] = useState<number>(0);
  const [restElapsedTime, setRestElapsedTime] = useState<number>(0);
  const timerInterval = useRef<any>(null);
  const restTimerInterval = useRef<any>(null);

  // Formatting helpers
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatFullDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const elapsedSeconds = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

  // Load user weight
  useEffect(() => {
    loadUserWeight();
  }, []);

  const loadUserWeight = async () => {
    try {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (!userId) {
        setUserWeight(70);
        return;
      }

      // Read from the same cache as ProfileSetup
      const cachedProfile = await AsyncStorage.getItem(`USER_PROFILE_${userId}`);

      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        const weight = profile.weight || 70;
        setUserWeight(weight);
        console.log(`📦 Using cached weight: ${weight} kg`);
      } else {
        setUserWeight(70);
        console.log("⚠️ No cached profile found, using default: 70 kg");
      }
    } catch (error) {
      console.error("Error loading cached weight:", error);
      setUserWeight(70);
    }
  };

  // ⏱️ TIMER MANAGEMENT
  useEffect(() => {
    if (setTimerState === 'running') {
      timerInterval.current = setInterval(() => {
        const now = Date.now();
        setSetElapsedTime(Math.floor((now - setStartTime) / 1000));
      }, 100);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [setTimerState, setStartTime]);

  // REST TIMER
  useEffect(() => {
    if (restStartTime > 0) {
      restTimerInterval.current = setInterval(() => {
        const now = Date.now();
        setRestElapsedTime(Math.floor((now - restStartTime) / 1000));
      }, 100);
    } else {
      if (restTimerInterval.current) {
        clearInterval(restTimerInterval.current);
      }
    }

    return () => {
      if (restTimerInterval.current) clearInterval(restTimerInterval.current);
    };
  }, [restStartTime]);

  // 🟢 START SET
  const startSet = () => {
    // Stop rest timer if running
    setRestStartTime(0);
    setRestElapsedTime(0);

    // Start set timer
    setSetStartTime(Date.now());
    setSetElapsedTime(0);
    setSetTimerState('running');
    Vibration.vibrate(50);
  };

  // ⏸️ PAUSE & LOG SET
  const pauseAndLog = () => {
    setSetTimerState('paused');

    // Create new set with actual duration
    const newSet: WorkoutSet = {
      ...createEmptySet(),
      id: Date.now().toString(),
      setNumber: completedSets.length + 1,
      actualDuration: setElapsedTime,
    };

    setCurrentSet(newSet);
    setModalVisible(true);
    Vibration.vibrate(100);
  };

  // Calculate calories for single set
  // Calculate calories for single set
  const calculateSetCalories = async (set: WorkoutSet): Promise<number> => {
    try {
      // Convert seconds to minutes, minimum 1 minute for very short sets
      let durationMinutes = Math.max(0.5, (set.actualDuration || 0) / 60);
      // Round to 1 decimal place for accuracy
      durationMinutes = Math.round(durationMinutes * 10) / 10;

      console.log("Exercise ID:", params.exerciseId);
      console.log("User weight:", userWeight, "kg");
      console.log("Duration in minutes:", durationMinutes);

      const result = await calculateCaloriesBurned(params.exerciseId, userWeight, durationMinutes);
      console.log('Calories calculated:', result);

      // Fix: Use correct property name 'calories_burned' not 'total_calories'
      const caloriesBurned = Math.round(result.calories_burned);
      console.log(`Calories burned for this set: ${caloriesBurned} kcal`);

      return caloriesBurned;
    } catch (error) {
      console.error('Error calculating set calories:', error);
      // Fallback: ~6 calories per minute for strength training
      const mins = Math.max(0.5, (set.actualDuration || 0) / 60);
      return Math.round(mins * 6);
    }
  };
  // Map exercise to activity
  const mapExerciseToActivity = (exerciseName: string, mode: string): string => {
    const name = exerciseName.toLowerCase();

    if (name.includes('run') || name.includes('jog')) return 'running';
    if (name.includes('walk')) return 'walking';
    if (name.includes('bike') || name.includes('cycle')) return 'cycling';
    if (name.includes('swim')) return 'swimming';
    if (name.includes('row')) return 'rowing';
    if (name.includes('jump')) return 'jumping rope';
    if (mode.includes('reps')) return 'weight lifting';

    return 'calisthenics';
  };

  // Update current set values
  const updateCurrentSet = (field: keyof WorkoutSet, value: string) => {
    const num = parseFloat(value) || 0;
    setCurrentSet(prev => ({ ...prev, [field]: num }));
  };

  const incrementCurrentSet = (field: keyof WorkoutSet, delta: number) => {
    setCurrentSet(prev => {
      const val = ((prev[field] as number) || 0) + delta;
      return { ...prev, [field]: Math.max(0, val) };
    });
  };

  // ✅ COMPLETE SET
  const completeSet = async () => {
    // Validate inputs
    if (trackingMode === 'reps-weight' && (!currentSet.reps || !currentSet.weight)) {
      Alert.alert('Enter values', 'Please enter reps and weight');
      return;
    }
    if (trackingMode === 'reps-only' && !currentSet.reps) {
      Alert.alert('Enter reps', 'Please enter number of reps');
      return;
    }
    if (trackingMode === 'time-only' && !currentSet.duration) {
      Alert.alert('Enter duration', 'Please enter duration');
      return;
    }
    if (trackingMode === 'time-distance' && (!currentSet.duration || !currentSet.distance)) {
      Alert.alert('Enter values', 'Please enter duration and distance');
      return;
    }

    // Calculate calories for this set
    const calories = await calculateSetCalories(currentSet);
    const setWithCalories = { ...currentSet, caloriesBurned: calories };

    setCompletedSets(prev => [...prev, setWithCalories]);
    setModalVisible(false);

    // Reset timer state
    setSetTimerState('idle');
    setSetElapsedTime(0);

    // Start rest timer
    setRestStartTime(Date.now());
    setRestElapsedTime(0);

    Vibration.vibrate(200);
  };

  // Remove a completed set
  const removeSet = (id: string) => {
    Alert.alert(
      'Remove Set',
      'Are you sure you want to remove this set?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCompletedSets(prev => {
              const filtered = prev.filter(set => set.id !== id);
              return filtered.map((set, index) => ({ ...set, setNumber: index + 1 }));
            });
          }
        }
      ]
    );
  };

  // Get set display text
  const getSetDisplay = (set: WorkoutSet): string => {
    switch (trackingMode) {
      case 'reps-weight':
        return `${set.weight}kg × ${set.reps}`;
      case 'reps-only':
        return `${set.reps} reps`;
      case 'time-only':
        return formatTime(set.duration || 0);
      case 'time-distance':
        return `${(set.distance || 0).toFixed(1)}km • ${formatTime(set.duration || 0)}`;
      default:
        return '';
    }
  };

  // Save workout
  // Save workout - Save to BOTH AsyncStorage AND Database
  const saveWorkout = async () => {
    if (completedSets.length === 0) {
      Alert.alert('No sets', 'Complete at least one set first.');
      return;
    }

    try {
      const totalVolume = completedSets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
      const totalDistance = completedSets.reduce((sum, s) => sum + (s.distance || 0), 0);
      const totalTimeSec = completedSets.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
      const totalReps = completedSets.reduce((sum, s) => sum + (s.reps || 0), 0);
      const totalCalories = completedSets.reduce((sum, s) => sum + (s.caloriesBurned || 0), 0);

      const workoutLog = {
        id: Date.now().toString(),
        exerciseName: params.exerciseName,
        muscle: params.muscle,
        type: params.type,
        equipment: params.equipment,
        trackingMode,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sets: completedSets,
        duration: Math.max(1, Math.floor(totalTimeSec / 60)),
        caloriesBurned: totalCalories,
        totalVolume,
        totalDistance,
        totalTime: totalTimeSec,
        totalReps,
        notes,
      };

      // ✅ STEP 1: Save to AsyncStorage (fast)
      const histStr = await AsyncStorage.getItem('WORKOUT_HISTORY') || '[]';
      const hist = JSON.parse(histStr);
      hist.unshift(workoutLog);
      await AsyncStorage.setItem('WORKOUT_HISTORY', JSON.stringify(hist.slice(0, 100)));

      // ✅ STEP 2: Save to database (persistent)
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (userId) {
        await saveWorkoutToBackend({
          userId,
          exerciseId: params.exerciseId,
          exerciseName: params.exerciseName,
          sets: completedSets,
          durationMinutes: Math.max(1, Math.floor(totalTimeSec / 60)),
          notes,
        });
      }

      // ✅ Update TodayContext instantly — calories screen goal adjusts automatically
      updateAfterWorkout(
        totalCalories,
        Math.max(1, Math.floor(totalTimeSec / 60))
      );

      Vibration.vibrate(200);
      Alert.alert('Workout Saved!', `${completedSets.length} sets • ${totalCalories} kcal burned`, [
        { text: 'Done', onPress: () => router.back() }
      ]);
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'Could not save workout');
    }
  };
  // Calculate total calories burned so far
  const totalCaloriesBurned = completedSets.reduce((sum, s) => sum + (s.caloriesBurned || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800' }}
        style={styles.headerBg}
        blurRadius={8}
      >
        <LinearGradient colors={['rgba(249,250,251,0.4)', colors.background]} style={styles.headerGradient}>
          <SafeAreaView style={styles.safeHeader}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => {
                Alert.alert('Discard?', 'Progress will be lost.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: () => router.back() }
                ]);
              }}>
                <Ionicons name="arrow-back" size={26} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={[styles.exerciseTitle, { color: colors.text }]} numberOfLines={1}>
                  {params.exerciseName}
                </Text>
                <Text style={[styles.subtitle, { color: colors.primary }]}>
                  {params.muscle.toUpperCase()} • {trackingMode.replace('-', ' + ').toUpperCase()}
                </Text>
              </View>

              <TouchableOpacity>
                <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.durationBox}>
              <Text style={[styles.durationLabel, { color: colors.textMuted }]}>TOTAL TIME</Text>
              <Text style={[styles.bigDuration, { color: colors.text }]}>
                {formatFullDuration(new Date().getTime() - startTime.getTime())}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ⏱️ SET TIMER CARD (When timer is running) */}
        {setTimerState === 'running' && (
          <View style={[styles.timerCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <LinearGradient
              colors={[colors.primary + '20', colors.primary + '05']}
              style={styles.timerCardGradient}
            />
            <View style={styles.timerCardContent}>
              <Text style={[styles.timerCardLabel, { color: colors.textSecondary }]}>
                SET {completedSets.length + 1} IN PROGRESS
              </Text>
              <Text style={[styles.timerCardTime, { color: colors.primary }]}>
                {formatTime(setElapsedTime)}
              </Text>
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={pauseAndLog}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.pauseButtonGradient}
                >
                  <Ionicons name="pause" size={24} color="white" />
                  <Text style={styles.pauseButtonText}>PAUSE & LOG</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 😌 REST TIMER (Between sets) */}
        {setTimerState === 'idle' && restStartTime > 0 && completedSets.length > 0 && (
          <View style={[styles.restCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.restCardContent}>
              <View style={styles.restCardHeader}>
                <Ionicons name="cafe-outline" size={24} color={colors.textSecondary} />
                <Text style={[styles.restCardLabel, { color: colors.textSecondary }]}>RESTING</Text>
              </View>
              <Text style={[styles.restCardTime, { color: colors.text }]}>
                {formatTime(restElapsedTime)}
              </Text>
            </View>
          </View>
        )}

        {/* Completed Sets */}
        {completedSets.map((set) => (
          <View key={set.id} style={[styles.completedCard, { backgroundColor: colors.card, borderColor: `${colors.primary}30` }]}>
            <View style={styles.completedCardHeader}>
              <View style={styles.setNumberBadge}>
                <LinearGradient
                  colors={[colors.secondary, colors.primary]}
                  style={styles.setNumberGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.setNumberText}>{set.setNumber}</Text>
                </LinearGradient>
              </View>
              <View style={styles.completedCardContent}>
                <Text style={[styles.completedCardTitle, { color: colors.textSecondary }]}>
                  {trackingMode === 'reps-weight' ? 'WEIGHT • REPS' :
                    trackingMode === 'reps-only' ? 'REPS' :
                      trackingMode === 'time-only' ? 'DURATION' : 'DISTANCE • TIME'}
                </Text>
                <Text style={[styles.completedCardText, { color: colors.text }]}>{getSetDisplay(set)}</Text>
                <View style={styles.setMetrics}>
                  <View style={styles.setMetric}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.setMetricText, { color: colors.textSecondary }]}>
                      {formatTime(set.actualDuration || 0)}
                    </Text>
                  </View>
                  <View style={styles.setMetric}>
                    <Ionicons name="flame-outline" size={14} color="#F59E0B" />
                    <Text style={[styles.setMetricText, { color: '#F59E0B' }]}>
                      ~{set.caloriesBurned || 0} kcal
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => removeSet(set.id)}
                style={[styles.minusButton, { backgroundColor: `${colors.error}15`, borderColor: `${colors.error}30` }]}
              >
                <Ionicons name="remove-circle" size={26} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Empty state */}
        {completedSets.length === 0 && setTimerState === 'idle' && (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyStateIcon, { shadowColor: colors.primary }]}>
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                style={styles.emptyStateGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="barbell-outline" size={40} color="white" />
              </LinearGradient>
            </View>
            <Text style={[styles.emptyStateText, { color: colors.text }]}>Ready to Start!</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
              Tap START SET to begin your workout
            </Text>
          </View>
        )}

        {/* Notes Input */}
        <View style={[styles.notesContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.notesLabel, { color: colors.primary }]}>NOTES</Text>
          <TextInput
            style={[styles.notesInput, { color: colors.text }]}
            placeholder="Add notes about this workout..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <BlurView intensity={90} tint={theme === "dark" ? "dark" : "light"} style={[styles.bottomBar, { borderColor: 'rgba(255,255,255,0.5)' }]}>
        <View style={[styles.statsRow, { backgroundColor: colors.background }]}>
          <View style={[styles.stat, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>SETS</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{completedSets.length}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>CALORIES</Text>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{totalCaloriesBurned}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveWorkout}>
          <LinearGradient colors={[colors.secondary, colors.primary]} style={styles.saveGradient}>
            <Text style={styles.saveText}>FINISH WORKOUT</Text>
            <Ionicons name="checkmark-circle" size={22} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>

      {/* 🟢 START SET FAB (Only show when idle) */}
      {setTimerState === 'idle' && (
        <TouchableOpacity
          style={[styles.fab, { borderColor: 'rgba(255,255,255,0.5)' }]}
          onPress={startSet}
        >
          <LinearGradient colors={['#10B981', '#059669']} style={styles.fabGradient}>
            <Ionicons name="play" size={32} color="white" />
            <Text style={styles.fabText}>START</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Modal for entering set details (AFTER pausing) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity
            style={[styles.modalContent, { backgroundColor: colors.card, borderColor: 'rgba(255,255,255,0.3)' }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Set <Text style={[styles.modalTitleHighlight, { color: colors.primary }]}>{completedSets.length + 1}</Text>
                </Text>
                <Text style={[styles.modalDuration, { color: colors.textSecondary }]}>
                  ⏱️ {formatTime(currentSet.actualDuration || 0)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.border }]}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Input fields based on tracking mode */}
            <View style={styles.modalBody}>
              {trackingMode === 'reps-weight' && (
                <>
                  <View style={styles.modalInputGroup}>
                    <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>WEIGHT (kg)</Text>
                    <View style={[styles.modalInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('weight', -2.5)}
                      >
                        <Ionicons name="remove" size={24} color={colors.primary} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.modalInput, { color: colors.text }]}
                        value={currentSet.weight?.toString()}
                        onChangeText={(v) => updateCurrentSet('weight', v)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('weight', 2.5)}
                      >
                        <Ionicons name="add" size={24} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.modalInputGroup}>
                    <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>REPS</Text>
                    <View style={[styles.modalInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('reps', -1)}
                      >
                        <Ionicons name="remove" size={24} color={colors.primary} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.modalInput, { color: colors.text }]}
                        value={currentSet.reps?.toString()}
                        onChangeText={(v) => updateCurrentSet('reps', v)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('reps', 1)}
                      >
                        <Ionicons name="add" size={24} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {trackingMode === 'reps-only' && (
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>REPS</Text>
                  <View style={[styles.modalInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                      onPress={() => incrementCurrentSet('reps', -1)}
                    >
                      <Ionicons name="remove" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.modalInput, { color: colors.text }]}
                      value={currentSet.reps?.toString()}
                      onChangeText={(v) => updateCurrentSet('reps', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      textAlign="center"
                    />
                    <TouchableOpacity
                      style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                      onPress={() => incrementCurrentSet('reps', 1)}
                    >
                      <Ionicons name="add" size={24} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {trackingMode === 'time-only' && (
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>DURATION (seconds)</Text>
                  <View style={[styles.modalInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                      onPress={() => incrementCurrentSet('duration', -5)}
                    >
                      <Ionicons name="remove" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.modalInput, { color: colors.text }]}
                      value={currentSet.duration?.toString()}
                      onChangeText={(v) => updateCurrentSet('duration', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      textAlign="center"
                    />
                    <TouchableOpacity
                      style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                      onPress={() => incrementCurrentSet('duration', 5)}
                    >
                      <Ionicons name="add" size={24} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {trackingMode === 'time-distance' && (
                <>
                  <View style={styles.modalInputGroup}>
                    <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>DISTANCE (km)</Text>
                    <View style={[styles.modalInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('distance', -0.1)}
                      >
                        <Ionicons name="remove" size={24} color={colors.primary} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.modalInput, { color: colors.text }]}
                        value={currentSet.distance?.toFixed(1)}
                        onChangeText={(v) => updateCurrentSet('distance', v)}
                        keyboardType="numeric"
                        placeholder="0.0"
                        placeholderTextColor={colors.textMuted}
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('distance', 0.1)}
                      >
                        <Ionicons name="add" size={24} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.modalInputGroup}>
                    <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>DURATION (seconds)</Text>
                    <View style={[styles.modalInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('duration', -5)}
                      >
                        <Ionicons name="remove" size={24} color={colors.primary} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.modalInput, { color: colors.text }]}
                        value={currentSet.duration?.toString()}
                        onChangeText={(v) => updateCurrentSet('duration', v)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={[styles.modalStepBtn, { backgroundColor: colors.card }]}
                        onPress={() => incrementCurrentSet('duration', 5)}
                      >
                        <Ionicons name="add" size={24} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={completeSet}
            >
              <LinearGradient colors={[colors.secondary, colors.primary]} style={styles.completeButtonGradient}>
                <Text style={styles.completeButtonText}>COMPLETE SET</Text>
                <Ionicons name="checkmark-circle" size={24} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },

  headerBg: { width: '100%', height: height * 0.38 },
  headerGradient: { flex: 1 },
  safeHeader: { flex: 1, paddingTop: Platform.OS === 'android' ? 30 : 10 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  exerciseTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  durationBox: { alignItems: 'center', marginTop: 20 },
  durationLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bigDuration: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
  },

  scroll: { flex: 1, marginTop: -36 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  // ⏱️ Timer Card
  timerCard: {
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  timerCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  timerCardContent: {
    padding: 24,
    alignItems: 'center',
  },
  timerCardLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  timerCardTime: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 20,
  },
  pauseButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
  },
  pauseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  pauseButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Rest Card
  restCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  restCardContent: {
    alignItems: 'center',
  },
  restCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  restCardLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  restCardTime: {
    fontSize: 32,
    fontWeight: '800',
  },

  // Completed Set Card
  completedCard: {
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    overflow: 'hidden',
  },
  completedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  setNumberBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  setNumberGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  setNumberText: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
  },
  completedCardContent: {
    flex: 1,
  },
  completedCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  completedCardText: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  setMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  setMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setMetricText: {
    fontSize: 12,
    fontWeight: '600',
  },
  minusButton: {
    padding: 8,
    borderRadius: 22,
    borderWidth: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    borderRadius: 24,
    marginTop: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  emptyStateIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyStateGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },

  // Notes Container
  notesContainer: {
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 1,
  },
  notesInput: {
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
    lineHeight: 24,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 8,
    gap: 12,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    minWidth: 110,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },

  saveBtn: {
    margin: 16,
    marginTop: 8,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  saveText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 200,
    right: 24,
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 3,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width - 40,
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 2,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalTitleHighlight: {
    fontSize: 34,
    fontWeight: '900',
  },
  modalDuration: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 20,
  },
  modalBody: {
    gap: 24,
    marginBottom: 28,
  },
  modalInputGroup: {
    gap: 10,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 6,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    padding: 6,
    borderWidth: 2,
  },
  modalStepBtn: {
    padding: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  modalInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '800',
    padding: 12,
    textAlign: 'center',
  },
  completeButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  completeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});