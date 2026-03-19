// screens/ExerciseListScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
  Platform, // Add this import
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useWorkoutStore } from '../../hooks/useWorkoutstore';
import { fetchExercisesByMuscle } from '../services/exerciseApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Define the exercise type based on your API response
type Exercise = {
  name: string;
  type: string;
  muscle: string;
  difficulty?: string;
  instructions?: string;
  equipment?: string | string[];
  safety_info?: string;
};

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

export default function ExerciseListScreen() {
  // 1. Get the muscle group from navigation
  const params = useLocalSearchParams();
  const workoutStore = useWorkoutStore();
  const muscleGroup = (params.muscle as string) || 'chest';

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // 2. State for the exercise list and loading
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'cached' | 'fresh' | null>(null);
  const [loadTime, setLoadTime] = useState<number>(0);

  // 3. State for the selected exercise and set tracking
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [weight, setWeight] = useState('');

  // Animation on mount
  useEffect(() => {
    console.log("iam in")
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 4. Fetch exercises when screen loads or muscle group changes
  useEffect(() => {
    loadExercises();
    console.log("called useeffect")
  }, [muscleGroup]);

  const loadExercises = async (forceRefresh = false) => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cachedData = await getCachedExercises(muscleGroup);
        if (cachedData) {
          setExercises(cachedData);
          setFilteredExercises(cachedData);
          setCacheStatus('cached');
          setLoadTime(Date.now() - startTime);
          setLoading(false);
          
          // Fetch fresh data in background
          fetchFreshDataInBackground();
          return;
        }
      }

      // No cache or force refresh - fetch from API
      setCacheStatus('fresh');
      await fetchFromAPI(startTime);
      
    } catch (error) {
      console.error('Failed to load exercises:', error);
      setError('Failed to load exercises. Please check your internet connection.');
      
      // Try to get from cache even if it's expired
      const cachedData = await getCachedExercises(muscleGroup, true);
      if (cachedData) {
        setExercises(cachedData);
        setFilteredExercises(cachedData);
        setCacheStatus('cached');
        Alert.alert(
          'Offline Mode',
          'Showing cached data. Please check your internet connection for fresh data.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFreshDataInBackground = async () => {
    try {
      await fetchFromAPI();
    } catch (error) {
      console.log('Background refresh failed:', error);
    }
  };

  const fetchFromAPI = async (startTime = Date.now()) => {
    const data = await fetchExercisesByMuscle(muscleGroup);
    
    if (data && data.length > 0) {
      setExercises(data);
      setFilteredExercises(data);
      await cacheExercises(muscleGroup, data);
      setLoadTime(Date.now() - startTime);
    } else {
      setExercises([]);
      setFilteredExercises([]);
    }
  };

  // Cache functions
  const getCachedExercises = async (muscle: string, ignoreExpiry = false): Promise<Exercise[] | null> => {
    try {
      const cached = await AsyncStorage.getItem(`exercises_${muscle}`);
      const timestamp = await AsyncStorage.getItem(`exercises_${muscle}_timestamp`);
      
      if (cached && timestamp) {
        const cacheTime = parseInt(timestamp);
        const now = Date.now();
        
        if (ignoreExpiry || (now - cacheTime < CACHE_EXPIRATION)) {
          return JSON.parse(cached);
        }
      }
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  };

  const cacheExercises = async (muscle: string, data: Exercise[]) => {
    try {
      await AsyncStorage.setItem(`exercises_${muscle}`, JSON.stringify(data));
      await AsyncStorage.setItem(`exercises_${muscle}_timestamp`, Date.now().toString());
    } catch (error) {
      console.error('Error caching exercises:', error);
    }
  };

  // 5. Filter exercises based on search (debounced)
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim() === '') {
        setFilteredExercises(exercises);
      } else {
        const filtered = exercises.filter(ex =>
          ex.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredExercises(filtered);
      }
    }, 300); // Debounce for 300ms

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, exercises]);

  // 6. Handle exercise selection
  const handleSelectExercise = useCallback((exercise: Exercise) => {
    setSelectedExercise(exercise);
  }, []);

  // 7. Handle log exercise
  const handleLogExercise = async () => {
    if (!selectedExercise) {
      Alert.alert('Select Exercise', 'Please select an exercise first');
      return;
    }
    if (!sets || !reps) {
      Alert.alert('Missing Info', 'Please enter sets and reps');
      return;
    }

    const setsNum = parseInt(sets);
    const repsNum = parseInt(reps);
    const weightNum = parseFloat(weight) || 0;

    try {
      // Save workout using Zustand store
      const savedWorkout = await workoutStore.addWorkout({
        name: selectedExercise.name,
        sets: setsNum,
        reps: repsNum,
        weight: weightNum,
        muscleGroup: muscleGroup,
        type: 'strength',
      });

      // Show success with calculated data
      Alert.alert(
        '✅ Workout Saved!',
        `${savedWorkout.name}\n` +
        `${savedWorkout.sets} sets × ${savedWorkout.reps} reps\n` +
        `${savedWorkout.weight > 0 ? `@ ${savedWorkout.weight}kg` : 'Bodyweight'}\n` +
        `🔥 ${savedWorkout.calories} kcal burned\n` +
        `📊 ${savedWorkout.volume} kg total volume`,
        [
          { 
            text: 'Log Another', 
            onPress: () => {
              setSelectedExercise(null);
              setSets('3');
              setReps('8');
              setWeight('');
            }
          },
          { 
            text: 'Done', 
            onPress: () => router.back(),
            style: 'default'
          }
        ]
      );

    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  // 8. Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadExercises(true);
  }, []);

  // 9. Format equipment display
  const formatEquipment = (equipment: string | string[] | undefined): string => {
    if (!equipment) return 'None';
    if (Array.isArray(equipment)) {
      if (equipment.length === 0) return 'None';
      return equipment.join(', ');
    }
    return equipment;
  };

  // 10. Get difficulty color
  const getDifficultyColor = (difficulty?: string): string => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced':
      case 'expert': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // 11. Render each exercise item
  const renderExerciseItem = ({ item, index }: { item: Exercise; index: number }) => {
    const isSelected = selectedExercise?.name === item.name;
    const difficultyColor = getDifficultyColor(item.difficulty);
    
    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <TouchableOpacity
          style={[
            styles.exerciseItem,
            isSelected && styles.selectedExerciseItem,
          ]}
          onPress={() => handleSelectExercise(item)}
          activeOpacity={0.7}
        >
          <View style={styles.exerciseContent}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{item.name}</Text>
              <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '20' }]}>
                <Text style={[styles.difficultyText, { color: difficultyColor }]}>
                  {item.difficulty || 'intermediate'}
                </Text>
              </View>
            </View>
            
            <View style={styles.exerciseMeta}>
              <View style={styles.metaTag}>
                <Ionicons name="fitness-outline" size={12} color="#666" />
                <Text style={styles.metaText}>{item.type}</Text>
              </View>
              <View style={styles.metaTag}>
                <Ionicons name="barbell-outline" size={12} color="#666" />
                <Text style={styles.metaText} numberOfLines={1}>
                  {formatEquipment(item.equipment)}
                </Text>
              </View>
            </View>

            {item.instructions && (
              <Text style={styles.exerciseInstructions} numberOfLines={2}>
                {item.instructions.substring(0, 100)}...
              </Text>
            )}
          </View>
          
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // 12. Render header with stats
  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{exercises.length}</Text>
          <Text style={styles.statLabel}>Total Exercises</Text>
        </View>
        {cacheStatus && (
          <View style={styles.statBox}>
            <Ionicons 
              name={cacheStatus === 'cached' ? 'cloud-done-outline' : 'cloud-outline'} 
              size={24} 
              color={cacheStatus === 'cached' ? '#4CAF50' : '#FF9800'} 
            />
            <Text style={styles.statLabel}>
              {cacheStatus === 'cached' ? 'Cached' : 'Live'}
            </Text>
          </View>
        )}
        {loadTime > 0 && (
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{loadTime}ms</Text>
            <Text style={styles.statLabel}>Load Time</Text>
          </View>
        )}
      </View>
    </View>
  );

  // 13. Render loading skeleton
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((item) => (
        <View key={item} style={styles.skeletonItem}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonBadge} />
          </View>
          <View style={styles.skeletonMeta}>
            <View style={styles.skeletonTag} />
            <View style={styles.skeletonTag} />
          </View>
          <View style={styles.skeletonText} />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)}
        </Text>
        <TouchableOpacity 
          onPress={onRefresh}
          style={styles.refreshButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="refresh" 
            size={22} 
            color="#666" 
            style={refreshing && styles.rotating}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => loadExercises(true)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Exercise List */}
      {loading && exercises.length === 0 ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={filteredExercises}
          renderItem={renderExerciseItem}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={exercises.length > 0 ? renderHeader : null}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Ionicons name="barbell-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery 
                    ? `No exercises match "${searchQuery}"`
                    : `No exercises found for ${muscleGroup}`}
                </Text>
                {searchQuery ? (
                  <TouchableOpacity 
                    style={styles.clearSearchButton}
                    onPress={() => setSearchQuery('')}
                  >
                    <Text style={styles.clearSearchText}>Clear Search</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => loadExercises(true)}
                  >
                    <Text style={styles.retryText}>Try Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF6B4A']}
              tintColor="#FF6B4A"
            />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      {/* Set Tracker Inputs - Collapsible */}
      {selectedExercise && (
        <Animated.View 
          style={[
            styles.setTrackerContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              }) }]
            }
          ]}
        >
          <View style={styles.setTrackerHeader}>
            <Text style={styles.setTrackerTitle} numberOfLines={1}>
              {selectedExercise.name}
            </Text>
            <TouchableOpacity onPress={() => setSelectedExercise(null)}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sets</Text>
              <TextInput
                style={styles.input}
                value={sets}
                onChangeText={setSets}
                keyboardType="numeric"
                placeholder="3"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                style={styles.input}
                value={reps}
                onChangeText={setReps}
                keyboardType="numeric"
                placeholder="8"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          {/* Volume Preview */}
          {sets && reps && (
            <View style={styles.volumePreview}>
              <Ionicons name="calculator-outline" size={16} color="#007AFF" />
              <Text style={styles.volumeText}>
                Volume: {parseInt(sets) * parseInt(reps) * parseFloat(weight || '0')} kg
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Log Button */}
      <TouchableOpacity
        style={[
          styles.logButton,
          (!selectedExercise || !sets || !reps) && styles.logButtonDisabled,
        ]}
        onPress={handleLogExercise}
        disabled={!selectedExercise || !sets || !reps}
        activeOpacity={0.8}
      >
        <Ionicons name="checkmark-circle" size={22} color="#fff" />
        <Text style={styles.logButtonText}>
          {selectedExercise
            ? `Log ${selectedExercise.name}`
            : 'Select an Exercise'}
        </Text>
      </TouchableOpacity>

      {/* Loading More Indicator */}
      {loadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#FF6B4A" />
          <Text style={styles.loadingMoreText}>Loading more...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  backButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  rotating: {
    transform: [{ rotate: '45deg' }],
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    color: '#333',
    paddingVertical: 8,
  },

  // List Header
  listHeader: {
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF6B4A',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Error Container
  errorContainer: {
    backgroundColor: '#ffebee',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    flex: 1,
    color: '#c62828',
    marginLeft: 8,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#c62828',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // List Container
  listContainer: { 
    paddingHorizontal: 16, 
    paddingBottom: 220, // Extra space for fixed buttons
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 20,
  },
  emptyText: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#666', 
    marginTop: 16,
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 25,
  },
  clearSearchText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Exercise Item
  exerciseItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedExerciseItem: {
    borderColor: '#FF6B4A',
    borderWidth: 2,
    backgroundColor: '#fff5f2',
  },
  exerciseContent: { 
    flex: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exerciseName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
  },
  exerciseInstructions: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  selectedIndicator: {
    marginLeft: 8,
  },

  // Set Tracker
  setTrackerContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  setTrackerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  setTrackerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  inputRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12,
    gap: 8,
  },
  inputGroup: { 
    flex: 1,
  },
  inputLabel: { 
    fontSize: 12, 
    color: '#666', 
    marginBottom: 6, 
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    backgroundColor: '#fafafa',
  },
  volumePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  volumeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },

  // Log Button
  logButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#FF6B4A',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF6B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logButtonDisabled: {
    backgroundColor: '#ccc',
    shadowColor: '#999',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Loading More
  loadingMore: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },

  // Skeleton Loading
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skeletonItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  skeletonTitle: {
    width: '60%',
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  skeletonBadge: {
    width: 80,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  skeletonMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  skeletonTag: {
    width: 80,
    height: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  skeletonText: {
    width: '100%',
    height: 32,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
});