// app/screens/ActiveWorkout.tsx - LIVE WORKOUT TRACKING
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
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useWorkoutTracking } from '../../hooks/useWorkout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ActiveWorkoutScreen() {
  const workoutTracking = useWorkoutTracking();
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  const activeSession = workoutTracking.activeSession;
  
  if (!activeSession) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={64} color="#8a8a9e" />
            <Text style={styles.emptyTitle}>No Active Workout</Text>
            <Text style={styles.emptyText}>Start a workout to begin tracking</Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => router.back()}
            >
              <Text style={styles.startButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const activeExercise = activeSession.exercises[activeExerciseIndex];
  const activeSet = activeExercise?.sets[activeSetIndex];

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      // Timer completed - show notification
      Alert.alert('Rest Time Over', 'Ready for next set?');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  const startRestTimer = (seconds: number) => {
    setTimer(seconds);
    setIsTimerRunning(true);
  };

  const handleCompleteSet = () => {
    if (!weightInput || !repsInput) {
      Alert.alert('Missing Info', 'Please enter weight and reps');
      return;
    }

    workoutTracking.updateExerciseSet(
      activeExercise.id,
      activeSetIndex,
      {
        weight: parseFloat(weightInput),
        reps: parseInt(repsInput),
        completed: true,
      }
    );

    // Start rest timer
    startRestTimer(activeSet?.restTime || 60);

    // Clear inputs
    setWeightInput('');
    setRepsInput('');

    // Move to next set
    if (activeSetIndex < activeExercise.sets.length - 1) {
      setActiveSetIndex(activeSetIndex + 1);
    } else {
      // All sets completed for this exercise
      workoutTracking.completeExercise(activeExercise.id);
      Alert.alert(
        'Exercise Completed!',
        `Great job completing ${activeExercise.name}!`,
        [
          {
            text: 'Next Exercise',
            onPress: () => {
              if (activeExerciseIndex < activeSession.exercises.length - 1) {
                setActiveExerciseIndex(activeExerciseIndex + 1);
                setActiveSetIndex(0);
              }
            },
          },
        ]
      );
    }
  };

  const handleAddSet = () => {
    workoutTracking.addSetToExercise(activeExercise.id);
  };

  const handleFinishWorkout = () => {
    Alert.alert(
      'Finish Workout?',
      'Are you sure you want to finish this workout session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          style: 'destructive',
          onPress: async () => {
            await workoutTracking.finishWorkoutSession();
            router.push('/screens/WorkoutTracking');
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#8a8a9e" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.workoutName} numberOfLines={1}>
              {activeSession.workoutName}
            </Text>
            <Text style={styles.exerciseCount}>
              {activeExerciseIndex + 1} of {activeSession.exercises.length} exercises
            </Text>
          </View>
          <TouchableOpacity onPress={handleFinishWorkout}>
            <Text style={styles.finishText}>Finish</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Timer Section */}
          {isTimerRunning && (
            <View style={styles.timerCard}>
              <LinearGradient
                colors={['#FF6B6B', '#FF8E8E']}
                style={styles.timerGradient}
              >
                <Text style={styles.timerTitle}>Rest Timer</Text>
                <Text style={styles.timerValue}>{formatTime(timer)}</Text>
                <TouchableOpacity
                  style={styles.timerStopButton}
                  onPress={() => setIsTimerRunning(false)}
                >
                  <Ionicons name="stop-circle" size={24} color="#fff" />
                  <Text style={styles.timerStopText}>Stop</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* Current Exercise */}
          <View style={styles.currentExerciseCard}>
            <View style={styles.exerciseHeader}>
              <View>
                <Text style={styles.exerciseNumber}>
                  Exercise {activeExerciseIndex + 1}
                </Text>
                <Text style={styles.exerciseName}>{activeExercise.name}</Text>
                <Text style={styles.exerciseDetails}>
                  {activeExercise.equipment} • {activeExercise.muscle}
                </Text>
              </View>
              {activeExercise.completed && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#06D6A0" />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>

            {/* Sets */}
            <View style={styles.setsContainer}>
              {activeExercise.sets.map((set, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.setCard,
                    set.completed && styles.completedSet,
                    index === activeSetIndex && styles.activeSet,
                  ]}
                  onPress={() => setActiveSetIndex(index)}
                >
                  <Text style={styles.setNumber}>Set {index + 1}</Text>
                  {set.completed ? (
                    <View style={styles.setCompleted}>
                      <Text style={styles.setValue}>{set.weight} kg</Text>
                      <Text style={styles.setValue}>× {set.reps}</Text>
                    </View>
                  ) : (
                    <Text style={styles.setPending}>Pending</Text>
                  )}
                </TouchableOpacity>
              ))}
              
              {/* Add Set Button */}
              <TouchableOpacity
                style={styles.addSetButton}
                onPress={handleAddSet}
              >
                <Ionicons name="add-circle-outline" size={24} color="#667eea" />
                <Text style={styles.addSetText}>Add Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Log Set Section */}
          {!activeExercise.completed && (
            <View style={styles.logSection}>
              <Text style={styles.logTitle}>Log Set {activeSetIndex + 1}</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#8a8a9e"
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Reps</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#8a8a9e"
                    value={repsInput}
                    onChangeText={setRepsInput}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.completeSetButton}
                onPress={handleCompleteSet}
              >
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.completeSetText}>Complete Set</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.startRestButton}
                onPress={() => startRestTimer(activeSet?.restTime || 60)}
              >
                <Ionicons name="timer-outline" size={20} color="#667eea" />
                <Text style={styles.startRestText}>
                  Start {activeSet?.restTime || 60}s Rest Timer
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Next Exercises */}
          <View style={styles.nextExercisesSection}>
            <Text style={styles.sectionTitle}>Upcoming Exercises</Text>
            {activeSession.exercises.slice(activeExerciseIndex + 1).map((exercise, index) => (
              <View key={exercise.id} style={styles.nextExerciseCard}>
                <View style={styles.nextExerciseInfo}>
                  <Text style={styles.nextExerciseName}>{exercise.name}</Text>
                  <Text style={styles.nextExerciseDetails}>
                    {exercise.sets.length} sets • {exercise.muscle}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => {
                    setActiveExerciseIndex(activeExerciseIndex + index + 1);
                    setActiveSetIndex(0);
                  }}
                >
                  <Text style={styles.skipButtonText}>Skip to</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => {
              if (activeExerciseIndex > 0) {
                setActiveExerciseIndex(activeExerciseIndex - 1);
                setActiveSetIndex(0);
              }
            }}
            disabled={activeExerciseIndex === 0}
          >
            <Ionicons 
              name="arrow-back" 
              size={20} 
              color={activeExerciseIndex === 0 ? '#8a8a9e' : '#fff'} 
            />
            <Text style={[
              styles.navButtonText,
              activeExerciseIndex === 0 && styles.disabledNavText
            ]}>
              Previous
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => {
              if (activeExerciseIndex < activeSession.exercises.length - 1) {
                setActiveExerciseIndex(activeExerciseIndex + 1);
                setActiveSetIndex(0);
              }
            }}
            disabled={activeExerciseIndex === activeSession.exercises.length - 1}
          >
            <Text style={[
              styles.navButtonText,
              activeExerciseIndex === activeSession.exercises.length - 1 && styles.disabledNavText
            ]}>
              Next
            </Text>
            <Ionicons 
              name="arrow-forward" 
              size={20} 
              color={activeExerciseIndex === activeSession.exercises.length - 1 ? '#8a8a9e' : '#fff'} 
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  safeArea: { flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8a8a9e',
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 16 },
  workoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  exerciseCount: {
    fontSize: 12,
    color: '#8a8a9e',
  },
  finishText: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  scrollContent: { padding: 24, paddingBottom: 100 },
  timerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  timerGradient: {
    padding: 24,
    alignItems: 'center',
  },
  timerTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  timerStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  timerStopText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  currentExerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  exerciseNumber: {
    fontSize: 14,
    color: '#8a8a9e',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  exerciseDetails: {
    fontSize: 14,
    color: '#8a8a9e',
  },
  completedBadge: {
    alignItems: 'center',
  },
  completedText: {
    fontSize: 12,
    color: '#06D6A0',
    marginTop: 4,
  },
  setsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  setCard: {
    width: (SCREEN_WIDTH - 96) / 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  activeSet: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  completedSet: {
    backgroundColor: 'rgba(6, 214, 160, 0.2)',
  },
  setNumber: {
    fontSize: 12,
    color: '#8a8a9e',
    marginBottom: 8,
  },
  setCompleted: {
    alignItems: 'center',
  },
  setValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  setPending: {
    fontSize: 14,
    color: '#8a8a9e',
    fontStyle: 'italic',
  },
  addSetButton: {
    width: (SCREEN_WIDTH - 96) / 3,
    borderWidth: 2,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetText: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 4,
    fontWeight: '600',
  },
  logSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#8a8a9e',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  completeSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06D6A0',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  completeSetText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  startRestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  startRestText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginLeft: 8,
  },
  nextExercisesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  nextExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  nextExerciseInfo: { flex: 1 },
  nextExerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  nextExerciseDetails: {
    fontSize: 13,
    color: '#8a8a9e',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  skipButtonText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 15, 35, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  navButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  disabledNavText: {
    color: '#8a8a9e',
  },
});