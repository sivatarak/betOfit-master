// app/(tabs)/exercise-library.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
  Platform,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { CustomLoader } from '../../components/CustomLoader';
import { useTheme } from '../../context/themecontext';
import { fetchExercisesByMuscle } from '../services/exerciseApi';

const { width } = Dimensions.get('window');

// Muscle Groups with PNG images
const MUSCLE_GROUPS = [
  {
    id: 'all',
    label: 'All',
    icon: 'grid',
    image: null,
    gradient: ['#f7e1a0', '#ff8e08'] as const,
    count: 0,
  },
  {
    id: 'chest',
    label: 'Chest',
    icon: 'fitness',
    image: null,
    gradient: ['#FF9966', '#FF5E62'] as const,
    filterMuscles: ['chest'],
    count: 0,
  },
  {
    id: 'back',
    label: 'Back',
    icon: 'body',
    image: null,
    gradient: ['#4A90E2', '#5C7CDB'] as const,
    filterMuscles: ['back'],
    count: 0,
  },
  {
    id: 'legs',
    label: 'Legs',
    icon: 'walk',
    image: null,
    gradient: ['#11998E', '#38EF7D'] as const,
    filterMuscles: ['legs'],
    count: 0,
  },
  {
    id: 'shoulders',
    label: 'Shoulders',
    icon: 'body',
    image: null,
    gradient: ['#A770EF', '#CF8BF3'] as const,
    filterMuscles: ['shoulders'],
    count: 0,
  },
  {
    id: 'arms',
    label: 'Arms',
    icon: 'barbell',
    image: null,
    gradient: ['#667EEA', '#764BA2'] as const,
    filterMuscles: ['arms'],
    count: 0,
  },
  {
    id: 'abs',
    label: 'Abs',
    icon: 'shield',
    image: null,
    gradient: ['#F093FB', '#F5576C'] as const,
    filterMuscles: ['abs'],
    count: 0,
  },
];

interface Exercise {
  name: string;
  type: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  instructions: string;
  equipments?: string[];
  target?: string;
  secondaryMuscles?: string[];
}

// Get muscle color gradient
const getMuscleGradient = (muscle: string): readonly [string, string] => {
  const muscleGroup = muscle.toLowerCase();
  if (muscleGroup.includes('chest')) return ['#FF9966', '#FF5E62'] as const;
  if (muscleGroup.includes('back')) return ['#4A90E2', '#5C7CDB'] as const;
  if (muscleGroup.includes('leg')) return ['#11998E', '#38EF7D'] as const;
  if (muscleGroup.includes('shoulder')) return ['#A770EF', '#CF8BF3'] as const;
  if (muscleGroup.includes('arm') || muscleGroup.includes('bicep') || muscleGroup.includes('tricep'))
    return ['#667EEA', '#764BA2'] as const;
  if (muscleGroup.includes('ab') || muscleGroup.includes('core'))
    return ['#F093FB', '#F5576C'] as const;
  return ['#FF6B4A', '#FF8F6B'] as const;
};


// Difficulty colors
const DIFFICULTY_COLORS = {
  beginner: '#10B981',
  intermediate: '#F59E0B',
  expert: '#EF4444',
};


export default function ExerciseLibraryScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);

  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [muscleGroups, setMuscleGroups] = useState(MUSCLE_GROUPS);
  const [featuredExercise, setFeaturedExercise] = useState<Exercise | null>(null);
  const [recentExercises, setRecentExercises] = useState<Exercise[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refs for scrolling
  const muscleScrollRef = useRef<ScrollView>(null);
  const musclePositions = useRef<{ [key: string]: number }>({});


  // Load data on mount
  useEffect(() => {
    loadCachedDataFirst();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecentWorkouts();
      selectFeaturedExercise(exercises);
    }, [exercises])
  );

  useEffect(() => {
    filterExercises();
  }, [selectedMuscle, searchQuery, exercises]);

  // Scroll to selected muscle when it changes
  useEffect(() => {
    if (selectedMuscle && musclePositions.current[selectedMuscle] !== undefined) {
      muscleScrollRef.current?.scrollTo({
        x: musclePositions.current[selectedMuscle] - 20,
        animated: true,
      });
    }
  }, [selectedMuscle]);
  // Loading Skeleton Component
  const SkeletonLoader = () => (
    <View style={{ padding: 20 }}>
      {[1, 2, 3, 4].map((item) => (
        <Animated.View
          key={item}
          entering={FadeIn.duration(500)}
          style={[
            styles.skeletonItem,
            { backgroundColor: colors.border }
          ]}
        >
          <View style={[styles.skeletonImage, { backgroundColor: colors.border }]} />
          <View style={styles.skeletonContent}>
            <View style={[styles.skeletonLine, { width: '80%', backgroundColor: colors.border }]} />
            <View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.border }]} />
            <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.border }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );


  // Load cached data immediately
  const loadCachedDataFirst = async () => {
    try {
      const cached = await AsyncStorage.getItem('ALL_EXERCISES_CACHE');
      if (cached) {
        const data = JSON.parse(cached);
        // Only use cache if it has exercises AND is not empty
        if (data.exercises && data.exercises.length > 0) {
          console.log('✅ Using cached data with', data.exercises.length, 'exercises');
          setExercises(data.exercises);
          setFilteredExercises(data.exercises);
          updateMuscleCounts(data.exercises);
          selectFeaturedExercise(data.exercises);
          setInitialLoading(false);
          setLoading(false);

          // Check if cache is older than 7 days, refresh in background
          const age = Date.now() - data.timestamp;
          if (age > 7 * 24 * 60 * 60 * 1000) {
            console.log('📱 Cache older than 7 days, refreshing in background');
            loadAllExercisesInBackground(true);
          }
          return;
        } else {
          console.log('⚠️ Cache is empty, fetching fresh data');
          await AsyncStorage.removeItem('ALL_EXERCISES_CACHE');
        }
      }
      // No cache or empty cache, fetch fresh data
      await loadAllExercisesInBackground();
    } catch (error) {
      console.error('Cache error:', error);
      await loadAllExercisesInBackground();
    } finally {
      setInitialLoading(false);
    }
  };

  // Load all exercises in background
  const loadAllExercisesInBackground = async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const muscleStrings = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];
      const allExercises: Exercise[] = [];

      // Load each muscle group sequentially
      for (const muscle of muscleStrings) {
        try {
          setLoadingMore(true);
          const muscleExercises = await fetchExercisesByMuscle(muscle);

          if (muscleExercises && muscleExercises.length > 0) {
            allExercises.push(...muscleExercises);

            // Update UI incrementally for better UX
            setExercises(prev => {
              const combined = [...prev, ...muscleExercises];
              const unique = Array.from(
                new Map(combined.map(ex => [ex.name.toLowerCase(), ex])).values()
              );
              return unique;
            });
          }
        } catch (error) {
          console.error(`Failed to fetch ${muscle}:`, error);
        } finally {
          setLoadingMore(false);
        }
      }

      // Remove duplicates and save to cache
      const uniqueExercises = Array.from(
        new Map(allExercises.map(ex => [ex.name.toLowerCase(), ex])).values()
      );

      if (uniqueExercises.length > 0) {
        await AsyncStorage.setItem('ALL_EXERCISES_CACHE', JSON.stringify({
          exercises: uniqueExercises,
          timestamp: Date.now(),
        }));
        console.log('✅ Cached', uniqueExercises.length, 'exercises');
      }
    } catch (error) {
      console.error('Background fetch error:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setLoadingMore(false);
    }
  };

  const updateMuscleCounts = (allExercises: Exercise[]) => {
    const updated = muscleGroups.map(group => {
      if (group.id === 'all') {
        return { ...group, count: allExercises.length };
      }
      const count = allExercises.filter(ex =>
        ex && ex.muscle && group.filterMuscles?.some(muscle =>
          (ex.muscle || '').toLowerCase().includes(muscle.toLowerCase())
        )
      ).length;
      return { ...group, count };
    });
    setMuscleGroups(updated);
  };

  const filterExercises = () => {
    let filtered = exercises;

    if (selectedMuscle !== 'all') {
      const muscleGroup = muscleGroups.find(m => m.id === selectedMuscle);
      if (muscleGroup?.filterMuscles) {
        filtered = filtered.filter(ex =>
          ex && ex.muscle && muscleGroup.filterMuscles!.some(muscle =>
            (ex.muscle || '').toLowerCase().includes(muscle.toLowerCase())
          )
        );
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ex =>
        ex && (
          (ex.name && ex.name.toLowerCase().includes(query)) ||
          (ex.muscle && (ex.muscle || '').toLowerCase().includes(query)) ||
          (ex.equipment && ex.equipment.toLowerCase().includes(query))
        )
      );
    }

    setFilteredExercises(filtered);
  };

  const loadRecentWorkouts = async () => {
    try {
      const history = await AsyncStorage.getItem('WORKOUT_HISTORY');
      if (history) {
        const parsed = JSON.parse(history);
        const recentExerciseNames = [...new Set(
          parsed.slice(0, 10).map((w: any) => w.exerciseName)
        )].slice(0, 3);

        const recent = exercises.filter(ex =>
          recentExerciseNames.includes(ex.name)
        );

        setRecentExercises(recent);
      }
    } catch (error) {
      console.error('Error loading recent workouts:', error);
    }
  };

  const selectFeaturedExercise = async (allExercises: Exercise[]) => {
    if (!allExercises || allExercises.length === 0) return;

    const mostFrequent = await getMostFrequentExercise();

    if (mostFrequent) {
      const userFavorite = allExercises.find(ex =>
        ex && ex.name && ex.name.toLowerCase() === mostFrequent.toLowerCase()
      );

      if (userFavorite) {
        setFeaturedExercise(userFavorite);
        return;
      }
    }

    const advanced = allExercises.filter(ex =>
      ex && (ex.difficulty === 'expert' || ex.difficulty === 'advanced')
    );

    if (advanced.length > 0) {
      const random = advanced[Math.floor(Math.random() * advanced.length)];
      setFeaturedExercise(random);
    } else {
      setFeaturedExercise(allExercises[0]);
    }
  };

  const getMostFrequentExercise = async (): Promise<string | null> => {
    try {
      const history = await AsyncStorage.getItem('WORKOUT_HISTORY');
      if (!history) return null;
      const parsed = JSON.parse(history);

      const exerciseCount: { [key: string]: number } = {};
      parsed.forEach((workout: any) => {
        const name = workout.exerciseName;
        exerciseCount[name] = (exerciseCount[name] || 0) + 1;
      });

      const sortedExercises = Object.entries(exerciseCount)
        .sort(([, a], [, b]) => b - a);

      if (sortedExercises.length > 0) {
        return sortedExercises[0][0];
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const navigateToDetail = (exercise: Exercise) => {
    const exerciseData = {
      name: exercise.name,
      type: exercise.type,
      muscle: exercise.muscle,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty,
      instructions: exercise.instructions,
      target: exercise.target || exercise.muscle,
      secondaryMuscles: exercise.secondaryMuscles || [],
      equipments: exercise.equipments || (exercise.equipment ? [exercise.equipment] : []),
    };
    router.push({
      pathname: '/(tabs)/exercise-detail',
      params: { exercise: JSON.stringify(exerciseData) }
    });
  };

  const handleMusclePress = (muscleId: string) => {
    setSelectedMuscle(muscleId);
  };

  const renderMuscleCard = (muscle: typeof MUSCLE_GROUPS[0], index: number) => (
    <TouchableOpacity
      key={muscle.id}
      onPress={() => handleMusclePress(muscle.id)}
      activeOpacity={0.8}
      onLayout={(event) => {
        musclePositions.current[muscle.id] = event.nativeEvent.layout.x;
      }}
    >
      <LinearGradient
        colors={muscle.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.muscleCard,
          selectedMuscle === muscle.id && styles.muscleCardActive
        ]}
      >
        <View style={styles.muscleIconContainer}>
          {muscle.image ? (
            <Image
              source={muscle.image}
              style={styles.muscleImage}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name={muscle.icon as any} size={28} color="#FFFFFF" />
          )}
        </View>

        <View style={styles.muscleCardBottom}>
          <Text style={styles.muscleCount}>{muscle.count} Exercises</Text>
          <Text style={styles.muscleLabel}>{muscle.label}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderFeaturedCard = () => {
    if (!featuredExercise) return null;
    return (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() => navigateToDetail(featuredExercise)}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={getMuscleGradient(featuredExercise.muscle)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featuredGradient}
        >
          <View style={styles.featuredOverlay} />
          <View style={styles.featuredContent}>
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>YOUR TOP EXERCISE</Text>
            </View>
            <Text style={styles.featuredTitle}>{featuredExercise.name}</Text>
            <View style={styles.featuredMeta}>
              <View style={styles.featuredTag}>
                <Text style={styles.featuredTagText}>{featuredExercise.muscle}</Text>
              </View>
              <View style={styles.featuredTag}>
                <Text style={styles.featuredTagText}>{featuredExercise.difficulty}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.featuredPlayButton}>
            <Ionicons name="play" size={24} color="#FF6B4A" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderGridItem = ({ item, index }: { item: Exercise; index: number }) => (
    <Animated.View
      entering={FadeIn.delay(index * 50)}
      style={{
        width: (width - 40 - 16) / 2,
        marginBottom: 16,
        marginRight: index % 2 === 0 ? 8 : 0,
        marginLeft: index % 2 === 1 ? 8 : 0,
      }}
    >
      <TouchableOpacity
        style={[styles.gridCard, { backgroundColor: colors.card }]}
        onPress={() => navigateToDetail(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={getMuscleGradient(item.muscle)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gridImageContainer}
        >
          <Ionicons name="fitness" size={40} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.gridContent}>
          <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.gridMeta}>
            <Text style={[styles.gridMetaText, { color: colors.textSecondary }]}>
              {item.muscle}
            </Text>
            <View style={[styles.gridDot, { backgroundColor: colors.border }]} />
            <Text style={[
              styles.gridMetaText,
              { color: DIFFICULTY_COLORS[item.difficulty as keyof typeof DIFFICULTY_COLORS] || colors.textMuted }
            ]}>
              {item.difficulty}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.gridAddButton, { backgroundColor: colors.card }]}>
          <Ionicons name="add" size={20} color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderListItem = ({ item, index }: { item: Exercise; index: number }) => (
    <Animated.View
      entering={FadeIn.delay(index * 50)}
      style={[styles.listCard, { backgroundColor: colors.card }]}
    >
      <TouchableOpacity
        style={{ flexDirection: 'row', flex: 1 }}
        onPress={() => navigateToDetail(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={getMuscleGradient(item.muscle)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.listImageContainer}
        >
          <Ionicons name="fitness" size={32} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.listMuscle, { color: colors.textSecondary }]}>
            {item.muscle} • {item.equipment || 'Bodyweight'}
          </Text>
          <View style={[styles.listDifficultyBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.listDifficultyFill,
                {
                  width: item.difficulty === 'beginner' ? '33%' :
                    item.difficulty === 'intermediate' ? '66%' : '100%',
                  backgroundColor: DIFFICULTY_COLORS[item.difficulty as keyof typeof DIFFICULTY_COLORS] || colors.textMuted
                }
              ]}
            />
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.listAddButton}>
        <Ionicons name="add-circle" size={28} color={colors.primary} />
      </TouchableOpacity>
    </Animated.View>
  );

  if (initialLoading || loading) {
    return (
      <CustomLoader
        fullScreen={true}
        
      />
    );
  }



  // if (initialLoading) {
  //   return (
  //     <View style={[styles.container, { backgroundColor: colors.background }]}>
  //       <SafeAreaView style={styles.safeArea}>
  //         <View style={[styles.header, { backgroundColor: colors.card }]}>
  //           <View style={styles.headerTop}>
  //             <View style={styles.headerLeft}>
  //               <LinearGradient
  //                 colors={[colors.secondary, colors.primary]}
  //                 style={styles.appIcon}
  //               >
  //                 <Ionicons name="barbell" size={24} color="#FFFFFF" />
  //               </LinearGradient>
  //               <Text style={[styles.appTitle, { color: colors.text }]}>Library</Text>
  //             </View>
  //           </View>
  //         </View>
  //         <SkeletonLoader />
  //       </SafeAreaView>
  //     </View>
  //   );
  // }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* GLASSMORPHIC HEADER */}
        <BlurView
          intensity={80}
          tint={theme === "dark" ? "dark" : "light"}
          style={[styles.header, { borderBottomColor: colors.border }]}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                style={styles.appIcon}
              >
                <Ionicons name="barbell" size={24} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.appTitle, { color: colors.text }]}>Library</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.avatar, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="person" size={20} color={colors.primary} />
              </View>
            </View>
          </View>
          {/* SEARCH BAR */}
          <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
            <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search exercises, muscles, gear..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {loadingMore && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
        </BlurView>

        {/* MAIN CONTENT */}
        <FlatList
          data={[]}
          ListHeaderComponent={
            <>
              {/* MUSCLE CAROUSEL */}
              <View style={styles.muscleSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Muscle Groups</Text>
                  <TouchableOpacity>
                    <Text style={[styles.sectionLink, { color: colors.primary }]}>View Atlas</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  ref={muscleScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.muscleCarousel}
                >
                  {muscleGroups.map((muscle, index) => renderMuscleCard(muscle, index))}
                </ScrollView>
              </View>

              {/* VIEW TOGGLE */}
              <View style={styles.viewToggleSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {selectedMuscle === 'all' ? 'Featured Exercises' : `${muscleGroups.find(m => m.id === selectedMuscle)?.label} Exercises`}
                </Text>
                <View style={[styles.viewToggle, { backgroundColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'grid' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('grid')}
                  >
                    <Ionicons name="grid" size={16} color={viewMode === 'grid' ? colors.text : colors.textMuted} />
                    <Text style={[
                      styles.toggleText,
                      { color: viewMode === 'grid' ? colors.text : colors.textMuted }
                    ]}>
                      GRID
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('list')}
                  >
                    <Ionicons name="list" size={16} color={viewMode === 'list' ? colors.text : colors.textMuted} />
                    <Text style={[
                      styles.toggleText,
                      { color: viewMode === 'list' ? colors.text : colors.textMuted }
                    ]}>
                      LIST
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* FEATURED CARD */}
              {selectedMuscle === 'all' && renderFeaturedCard()}
            </>
          }
          ListFooterComponent={
            <>
              {/* RECOMMENDED SECTION */}
              {recentExercises.length > 0 && selectedMuscle === 'all' && (
                <View style={styles.recommendedSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Recently Used</Text>
                  {recentExercises.map((exercise, index) => (
                    <Animated.View
                      key={index}
                      entering={FadeIn.delay(index * 100)}
                      style={[styles.recommendedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <TouchableOpacity
                        style={{ flexDirection: 'row', flex: 1 }}
                        onPress={() => navigateToDetail(exercise)}
                      >
                        <LinearGradient
                          colors={getMuscleGradient(exercise.muscle)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.recommendedImage}
                        >
                          <Ionicons name="fitness" size={24} color="#FFFFFF" />
                        </LinearGradient>
                        <View style={styles.recommendedContent}>
                          <Text style={[styles.recommendedTitle, { color: colors.text }]} numberOfLines={1}>
                            {exercise.name}
                          </Text>
                          <Text style={[styles.recommendedSubtitle, { color: colors.textSecondary }]}>
                            {exercise.muscle} • Recently used
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.recommendedAddButton}>
                        <Ionicons name="add" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              )}
              <View style={{ height: 40 }} />
            </>
          }
          renderItem={null}
          keyExtractor={() => 'header'}
          ListEmptyComponent={
            viewMode === 'grid' ? (
              <FlatList
                data={filteredExercises}
                renderItem={renderGridItem}
                keyExtractor={(item, index) => item.name + index}
                numColumns={2}
                columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
                contentContainerStyle={styles.exercisesContainer}
                showsVerticalScrollIndicator={false}
                key="grid"
                ListEmptyComponent={
                  !loading && filteredExercises.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="barbell" size={64} color={colors.textMuted} />
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>No exercises found</Text>
                      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Try adjusting your search
                      </Text>
                    </View>
                  ) : null
                }
              />
            ) : (
              <FlatList
                data={filteredExercises}
                renderItem={renderListItem}
                keyExtractor={(item, index) => item.name + index}
                contentContainerStyle={[styles.exercisesContainer, { paddingHorizontal: 20 }]}
                showsVerticalScrollIndicator={false}
                key="list"
                ListEmptyComponent={
                  !loading && filteredExercises.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="barbell" size={64} color={colors.textMuted} />
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>No exercises found</Text>
                      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Try adjusting your search
                      </Text>
                    </View>
                  ) : null
                }
              />
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  // Muscle Section
  muscleSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  muscleCarousel: {
    paddingBottom: 24,
    gap: 16,
  },
  muscleCard: {
    width: 128,
    height: 160,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  muscleCardActive: {
    transform: [{ scale: 1.05 }],
  },
  muscleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  muscleImage: {
    width: 32,
    height: 32,
  },
  muscleCardBottom: {
    gap: 4,
  },
  muscleCount: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },
  muscleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // View Toggle
  viewToggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  viewToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 24,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  toggleButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Featured Card
  featuredCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featuredGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  featuredContent: {
    zIndex: 1,
  },
  featuredBadge: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featuredTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  featuredMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  featuredTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  featuredPlayButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  // Exercises Container
  exercisesContainer: {
    paddingBottom: 20,
  },
  // Grid View
  gridCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridImageContainer: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContent: {
    padding: 12,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  gridMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridMetaText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  gridDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 6,
  },
  gridAddButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // List View
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  listMuscle: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  listDifficultyBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: 60,
  },
  listDifficultyFill: {
    height: '100%',
    borderRadius: 2,
  },
  listAddButton: {
    marginLeft: 8,
  },
  // Recommended Section
  recommendedSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  recommendedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  recommendedImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recommendedContent: {
    flex: 1,
  },
  recommendedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  recommendedSubtitle: {
    fontSize: 12,
  },
  recommendedAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Skeleton
  skeletonItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    opacity: 0.3,
  },
  skeletonImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
  },
  // Loading & Empty States
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
  },
});