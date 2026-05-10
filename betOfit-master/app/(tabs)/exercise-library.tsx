// app/(tabs)/exercise-library.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
const CACHE_KEY = 'EXERCISE_CACHE_BY_MUSCLE';

const getCache = async () => {
  const cache = await AsyncStorage.getItem(CACHE_KEY);
  return cache ? JSON.parse(cache) : {};
};

const saveToCache = async (muscle: string, data: any[]) => {
  const cache = await getCache();
  cache[muscle] = data;

  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};
// Muscle Groups with PNG images
const MUSCLE_GROUPS = [
  {
    id: 'chest',
    label: 'Chest',
    icon: 'fitness',
    image: require('../../assets/images/chest.png'), // ← ADD THIS
    gradient: ['#FF9966', '#FF5E62'] as const,
    filterMuscles: ['chest'],
    count: 0,
  },
  {
    id: 'back',
    label: 'Back',
    icon: 'body',
    image: require('../../assets/images/back.png'), // ← ADD THIS
    gradient: ['#4A90E2', '#5C7CDB'] as const,
    filterMuscles: ['back'],
    count: 0,
  },
  {
    id: 'legs',
    label: 'Legs',
    icon: 'walk',
    image: require('../../assets/images/legs.png'), // ← ADD THIS
    gradient: ['#11998E', '#38EF7D'] as const,
    filterMuscles: ['legs'],
    count: 0,
  },
  {
    id: 'shoulders',
    label: 'Shoulders',
    icon: 'body',
    image: require('../../assets/images/shoulders.png'), // ← ADD THIS
    gradient: ['#A770EF', '#CF8BF3'] as const,
    filterMuscles: ['shoulders'],
    count: 0,
  },
  {
    id: 'arms',
    label: 'Arms',
    icon: 'barbell',
    image: require('../../assets/images/arms.png'), // ← ADD THIS
    gradient: ['#667EEA', '#764BA2'] as const,
    filterMuscles: ['arms'],
    count: 0,
  },
  {
    id: 'abs',
    label: 'Abs',
    icon: 'shield',
    image: require('../../assets/images/abs.png'), // ← ADD THIS
    gradient: ['#F093FB', '#F5576C'] as const,
    filterMuscles: ['abs'],
    count: 0,
  },
];

interface Exercise {
  id: string;
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
  return ['#F093FB', '#F5576C'] as const;
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
  // const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [muscleGroups, setMuscleGroups] = useState(MUSCLE_GROUPS);
  const [featuredExercise, setFeaturedExercise] = useState<Exercise | null>(null);
  const [recentExercises, setRecentExercises] = useState<Exercise[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [isChangingMuscle, setIsChangingMuscle] = useState(false);
  // Refs for scrolling
  const muscleScrollRef = useRef<ScrollView>(null);
  const musclePositions = useRef<{ [key: string]: number }>({});
  const loadingTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const currentMuscleRef = useRef<string>('');
  const [isLoadingMuscle, setIsLoadingMuscle] = useState(false);
  // Load data on mount
  useEffect(() => {
    handleMusclePress('chest'); // default
  }, []);
  useEffect(() => {
    console.log("🎯 RENDER DATA:", exercises.length);
  }, [exercises]);
  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecentWorkouts();
      selectFeaturedExercise(exercises);
    }, [exercises])
  );


  // Filter exercises based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredExercises(exercises);
    } else {
      const filtered = exercises.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.muscle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.equipment.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredExercises(filtered);
    }
  }, [searchQuery, exercises]);
  // Scroll to selected muscle when it changes
  useEffect(() => {
    if (selectedMuscle && musclePositions.current[selectedMuscle] !== undefined) {
      muscleScrollRef.current?.scrollTo({
        x: musclePositions.current[selectedMuscle] - 20,
        animated: true,
      });
    }
  }, [selectedMuscle]);




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
      id: exercise.id,
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

  const handleMusclePress = useCallback(async (muscleId: string) => {
    if (currentMuscleRef.current === muscleId) return;

    // Show loading immediately
    setIsLoadingMuscle(true);
    setExercises([]);
    setSelectedMuscle(muscleId);
    currentMuscleRef.current = muscleId;

    try {
      const cache = await getCache();
      let cachedData = cache[muscleId];

      if (!cachedData) {
        cachedData = await fetchExercisesByMuscle(muscleId);
        await saveToCache(muscleId, cachedData);
      }

      // Update counts for muscle groups
      setMuscleGroups(prev => prev.map(m =>
        m.id === muscleId ? { ...m, count: cachedData.length } : m
      ));

      // Check if still current muscle
      if (currentMuscleRef.current === muscleId) {
        setExercises(cachedData);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      if (currentMuscleRef.current === muscleId) {
        setIsLoadingMuscle(false);
      }
    }
  }, []);

  const getMuscleImage = (muscle: string) => {
    const muscleLower = muscle.toLowerCase();
    if (muscleLower.includes('chest')) return require('../../assets/images/chest.png');
    if (muscleLower.includes('back')) return require('../../assets/images/back.png');
    if (muscleLower.includes('leg')) return require('../../assets/images/legs.png');
    if (muscleLower.includes('shoulder')) return require('../../assets/images/shoulders.png');
    if (muscleLower.includes('arm')) return require('../../assets/images/arms.png');
    if (muscleLower.includes('ab')) return require('../../assets/images/abs.png');
    return require('../../assets/images/chest.png');
  };

  const renderMuscleCard = (muscle: typeof MUSCLE_GROUPS[0], index: number) => (
    <TouchableOpacity
      key={muscle.id}
      onPress={() => handleMusclePress(muscle.id)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={muscle.gradient}
        style={[styles.muscleCard, selectedMuscle === muscle.id && styles.muscleCardActive]}
      >
        <Image source={muscle.image} style={styles.muscleFullImage} resizeMode="cover" />

        {/* Text with background color from theme */}
        <View style={[styles.muscleCardBottom, { backgroundColor: colors.background }]}>
          <Text style={[styles.muscleCount, { color: colors.textSecondary }]}>{muscle.count} Exercises</Text>
          <Text style={[styles.muscleLabel, { color: colors.text }]}>{muscle.label}</Text>
        </View>

        {selectedMuscle === muscle.id && <View style={styles.activeIndicator} />}
      </LinearGradient>
    </TouchableOpacity>
  );

  // const renderFeaturedCard = () => {
  //   if (!featuredExercise) return null;
  //   return (
  //     <TouchableOpacity
  //       style={styles.featuredCard}
  //       onPress={() => navigateToDetail(featuredExercise)}
  //       activeOpacity={0.9}
  //     >
  //       <LinearGradient
  //         colors={getMuscleGradient(featuredExercise.muscle)}
  //         start={{ x: 0, y: 0 }}
  //         end={{ x: 1, y: 1 }}
  //         style={styles.featuredGradient}
  //       >
  //         <View style={styles.featuredOverlay} />
  //         <View style={styles.featuredContent}>
  //           <View style={styles.featuredBadge}>
  //             <Text style={styles.featuredBadgeText}>YOUR TOP EXERCISE</Text>
  //           </View>
  //           <Text style={styles.featuredTitle}>{featuredExercise.name}</Text>
  //           <View style={styles.featuredMeta}>
  //             <View style={styles.featuredTag}>
  //               <Text style={styles.featuredTagText}>{featuredExercise.muscle}</Text>
  //             </View>
  //             <View style={styles.featuredTag}>
  //               <Text style={styles.featuredTagText}>{featuredExercise.difficulty}</Text>
  //             </View>
  //           </View>
  //         </View>
  //         <TouchableOpacity style={styles.featuredPlayButton}>
  //           <Ionicons name="play" size={24} color="#FF6B4A" />
  //         </TouchableOpacity>
  //       </LinearGradient>
  //     </TouchableOpacity>
  //   );
  // };

  const renderGridItem = ({ item }: { item: Exercise }) => {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => navigateToDetail(item)}
        style={{
          width: (width - 60) / 2,
          marginBottom: 18,
        }}
      >
        <Animated.View
          style={{
            borderRadius: 20,
            backgroundColor: colors.card,
            overflow: 'hidden',

            // 🔥 soft shadow (premium)
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 3,
          }}
        >

          {/* 🎯 TOP VISUAL */}
          <Image
            source={getMuscleImage(item.muscle)}
            style={{
              width: '100%',
              height: 140,
              backgroundColor: colors.surfaceContainerLow,
            }}
            resizeMode="cover"
          />


          {/* 🧠 CONTENT */}
          <View style={{ padding: 14 }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text,
                lineHeight: 18,
              }}
            >
              {item.name}
            </Text>

            <Text
              style={{
                marginTop: 6,
                fontSize: 11,
                color: colors.textSecondary,
                textTransform: 'capitalize',
              }}
            >
              {item.muscle}
            </Text>
          </View>

          {/* ⚡ MINIMAL DIFFICULTY DOT */}
          <View
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor:
                DIFFICULTY_COLORS[
                item.difficulty as keyof typeof DIFFICULTY_COLORS
                ] || colors.textMuted,
            }}
          />

        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item, index }: { item: Exercise; index: number }) => (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.listCard, { backgroundColor: colors.card }]}
    >
      <TouchableOpacity
        style={{ flexDirection: 'row', flex: 1 }}
        onPress={() => navigateToDetail(item)}
        activeOpacity={0.8}
      >
        <Image
          source={getMuscleImage(item.muscle)}
          style={styles.listImageContainer}
          resizeMode="cover"
        />
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

  // if (initialLoading || loading) {
  //   return (
  //     <CustomLoader
  //       fullScreen={true}

  //     />
  //   );
  // }



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
          data={filteredExercises}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          keyExtractor={(item, index) => item.name + index}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 40,
          }}
          columnWrapperStyle={viewMode === 'grid' ? {
            justifyContent: 'space-between',
            paddingHorizontal: 20,
          } : undefined}

          ListHeaderComponent={
            <>
              {/* MUSCLE CAROUSEL */}
              <View style={styles.muscleSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Muscle Groups
                  </Text>
                </View>

                <ScrollView
                  ref={muscleScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.muscleCarousel}
                >
                  {muscleGroups.map((muscle, index) =>
                    renderMuscleCard(muscle, index)
                  )}
                </ScrollView>
              </View>

              {/* VIEW TOGGLE */}
              <View style={styles.viewToggleSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {`${muscleGroups.find(m => m.id === selectedMuscle)?.label} Exercises`}
                </Text>

                <View style={[styles.viewToggle, { backgroundColor: colors.border }]}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      viewMode === 'grid' && styles.toggleButtonActive
                    ]}
                    onPress={() => setViewMode('grid')}
                  >
                    <Ionicons
                      name="grid"
                      size={16}
                      color={viewMode === 'grid' ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={{
                        color: viewMode === 'grid' ? colors.text : colors.textMuted
                      }}
                    >
                      GRID
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      viewMode === 'list' && styles.toggleButtonActive
                    ]}
                    onPress={() => setViewMode('list')}
                  >
                    <Ionicons
                      name="list"
                      size={16}
                      color={viewMode === 'list' ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={{
                        color: viewMode === 'list' ? colors.text : colors.textMuted
                      }}
                    >
                      LIST
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* FEATURED */}
              {/* {renderFeaturedCard()} */}
            </>
          }

          ListFooterComponent={
            <>
              {/* RECENT */}
              {recentExercises.length > 0 && (
                <View style={styles.recommendedSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Recently Used
                  </Text>

                  {recentExercises.map((exercise, index) => (
                    <View
                      key={index}
                      style={[
                        styles.recommendedCard,
                        { backgroundColor: colors.card, borderColor: colors.border }
                      ]}
                    >
                      <TouchableOpacity
                        style={{ flexDirection: 'row', flex: 1 }}
                        onPress={() => navigateToDetail(exercise)}
                      >
                        <LinearGradient
                          colors={getMuscleGradient(exercise.muscle)}
                          style={styles.recommendedImage}
                        >
                          <Ionicons name="fitness" size={24} color="#FFFFFF" />
                        </LinearGradient>

                        <View style={styles.recommendedContent}>
                          <Text
                            style={[styles.recommendedTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {exercise.name}
                          </Text>
                          <Text
                            style={[
                              styles.recommendedSubtitle,
                              { color: colors.textSecondary }
                            ]}
                          >
                            {exercise.muscle} • Recently used
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.recommendedAddButton}>
                        <Ionicons name="add" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ height: 40 }} />
            </>
          }

          ListEmptyComponent={
            isLoadingMuscle ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading {muscleGroups.find(m => m.id === selectedMuscle)?.label} exercises...
                </Text>
              </View>
            ) : !loading && exercises.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="barbell" size={64} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No exercises found
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Try selecting a different muscle group
                </Text>
              </View>
            ) : null
          }

          // 🚀 PERFORMANCE BOOST (VERY IMPORTANT)
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          updateCellsBatchingPeriod={50}
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
    width: 140,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },

  muscleFullImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },
  muscleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  muscleCardBottom: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 2,
    zIndex: 2,
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
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },

  muscleImage: {
    width: 32,
    height: 32,
  },

  muscleCount: {
    fontSize: 11,
    color: colors.background,
    fontWeight: '500',
  },

  muscleLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.background,
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

  activeIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3,
  },
  activeIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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