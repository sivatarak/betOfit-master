// app/(tabs)/log-exercise.tsx
import React, { useState, useEffect } from 'react';
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

import { useTheme } from '../../context/themecontext';
import { calculateCaloriesBurned } from '../services/exerciseApi';

const { width, height } = Dimensions.get('window');

interface WorkoutSet {
  id: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
}

interface LogExerciseParams {
  exerciseName: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  type: string;
}

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

  const params = useLocalSearchParams<LogExerciseParams>();
  const trackingMode = getTrackingMode(params.type, params.equipment, params.exerciseName);

  const createEmptySet = (): WorkoutSet => {
    const base = { id: Date.now().toString(), setNumber: 0 };
    switch (trackingMode) {
      case 'reps-weight': return { ...base, reps: 0, weight: 0 };
      case 'reps-only':   return { ...base, reps: 0 };
      case 'time-only':   return { ...base, duration: 0 };
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

  // Formatting helpers
  const formatFullDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatShortTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const elapsedSeconds = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

  // Load user weight
  useEffect(() => {
    loadUserWeight();
    const timer = setInterval(() => {}, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadUserWeight = async () => {
    try {
      const w = await AsyncStorage.getItem('USER_WEIGHT');
      if (w) setUserWeight(parseFloat(w));
    } catch (e) {}
  };

  // Open modal for new set
  const openNewSetModal = () => {
    setCurrentSet({
      ...createEmptySet(),
      id: Date.now().toString(),
      setNumber: completedSets.length + 1
    });
    setModalVisible(true);
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

  // Complete set and add to list
  const completeSet = () => {
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

    setCompletedSets(prev => [...prev, currentSet]);
    setModalVisible(false);
    Vibration.vibrate(100);
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
              // Renumber remaining sets
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
        return formatShortTime(set.duration || 0);
      case 'time-distance':
        return `${(set.distance || 0).toFixed(1)}km • ${formatShortTime(set.duration || 0)}`;
      default:
        return '';
    }
  };
  
  // Calculate calories for the workout
  const calculateCaloriesForWorkout = async (
    sets: WorkoutSet[],
    mode: string,
    exerciseName: string,
    weight: number
  ): Promise<number> => {
    try {
      // Calculate total duration from all sets
      const totalDuration = sets.reduce((sum, set) => {
        if (set.duration) return sum + set.duration;
        // Estimate duration for strength sets (approx 30 seconds per set + rest)
        if (mode.includes('reps')) return sum + 30;
        return sum;
      }, 0);

      // Convert to minutes (minimum 1 minute)
      const durationMinutes = Math.max(1, Math.ceil(totalDuration / 60));

      // Map exercise name to activity type for calorie calculation
      const activity = mapExerciseToActivity(exerciseName, mode);
      
      console.log('🔥 Calculating calories:', { activity, weight, durationMinutes });
      
      const result = await calculateCaloriesBurned(activity, weight, durationMinutes);
      return result.total_calories;
    } catch (error) {
      console.error('Error calculating calories:', error);
      // Fallback: rough estimate
      return estimateCalories(sets.length, mode);
    }
  };

  // Map exercise to activity type for calorie calculation
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

  // Fallback estimation
  const estimateCalories = (setCount: number, mode: string): number => {
    // Rough estimate: 5-10 calories per set
    const caloriesPerSet = mode.includes('reps') ? 8 : 5;
    return setCount * caloriesPerSet;
  };

  // Save workout
  const saveWorkout = async () => {
    if (completedSets.length === 0) {
      Alert.alert('No sets', 'Complete at least one set first.');
      return;
    }

    try {
      const totalVolume = completedSets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
      const totalDistance = completedSets.reduce((sum, s) => sum + (s.distance || 0), 0);
      const totalTimeSec = completedSets.reduce((sum, s) => sum + (s.duration || 0), 0);
      const totalReps = completedSets.reduce((sum, s) => sum + (s.reps || 0), 0);

      const log = {
        id: Date.now().toString(),
        exerciseName: params.exerciseName,
        muscle: params.muscle,
        type: params.type,
        equipment: params.equipment,
        trackingMode,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        sets: completedSets,
        duration: Math.max(1, Math.floor(elapsedSeconds / 60)),
        caloriesBurned: await calculateCaloriesForWorkout(completedSets, trackingMode, params.exerciseName, userWeight),
        totalVolume,
        totalDistance,
        totalTime: totalTimeSec,
        totalReps,
        notes,
      };

      const histStr = await AsyncStorage.getItem('WORKOUT_HISTORY') || '[]';
      const hist = JSON.parse(histStr);
      hist.unshift(log);
      await AsyncStorage.setItem('WORKOUT_HISTORY', JSON.stringify(hist.slice(0, 100)));

      Vibration.vibrate(200);
      Alert.alert('Workout Saved!', `${completedSets.length} sets completed`, [
        { text: 'Done', onPress: () => router.back() }
      ]);
    } catch (err) {
      Alert.alert('Error', 'Could not save workout');
    }
  };

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
        {/* Beautiful Completed Sets Cards */}
        {completedSets.map((set) => (
          <View key={set.id} style={[styles.completedCard, { backgroundColor: colors.card, borderColor: `${colors.primary}30` }]}>
            <View style={[styles.completedCardDecoration, { backgroundColor: 'transparent' }]} />
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
        {completedSets.length === 0 && (
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
            <Text style={[styles.emptyStateText, { color: colors.text }]}>No Sets Logged Yet</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
              Tap the + button to add your first set
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

        <View style={{height: 180}} />
      </ScrollView>

      {/* Bottom Bar */}
      <BlurView intensity={90} tint={theme === "dark" ? "dark" : "light"} style={[styles.bottomBar, { borderColor: 'rgba(255,255,255,0.5)' }]}>
        <View style={[styles.statsRow, { backgroundColor: colors.background }]}>
          <View style={[styles.stat, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>COMPLETED</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{completedSets.length}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>TIME</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {formatFullDuration(new Date().getTime() - startTime.getTime())}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveWorkout}>
          <LinearGradient colors={[colors.secondary, colors.primary]} style={styles.saveGradient}>
            <Text style={styles.saveText}>FINISH WORKOUT</Text>
            <Ionicons name="checkmark-circle" size={22} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>

      {/* FAB - Opens Modal */}
      <TouchableOpacity style={[styles.fab, { borderColor: 'rgba(255,255,255,0.5)' }]} onPress={openNewSetModal}>
        <LinearGradient colors={[colors.secondary, colors.primary]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal for entering set details */}
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
                        value={currentSet.distance?.toString()}
                        onChangeText={(v) => updateCurrentSet('distance', v)}
                        keyboardType="numeric"
                        placeholder="0"
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

  // Beautiful Completed Set Card
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
  completedCardDecoration: {
    height: 6,
    width: '100%',
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
    shadowColor: colors.primary,
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