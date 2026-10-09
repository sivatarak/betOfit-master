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
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, RadialGradient as SvgRadialGradient, Stop } from 'react-native-svg';
import { CustomLoader } from '../../components/CustomLoader';
import { useTheme } from '../../context/themecontext';
import { AmbientGlow } from '../../components/AmbientGlow';
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

// Pre-load all images once
const MUSCLE_IMAGES = {
  chest: require('../../assets/images/chest.webp'),
  back: require('../../assets/images/back.webp'),
  legs: require('../../assets/images/legs.webp'),
  shoulders: require('../../assets/images/shoulders.webp'),
  arms: require('../../assets/images/arms.webp'),
  abs: require('../../assets/images/abs.webp'),
};
// Muscle Groups with PNG images
const MUSCLE_GROUPS = [
  {
    id: 'chest',
    label: 'Chest',
    icon: 'fitness',
    image: MUSCLE_IMAGES.chest, // ← ADD THIS
    gradient: ['#FF9966', '#FF5E62'] as const,
    filterMuscles: ['chest'],
    count: 0,
  },
  {
    id: 'back',
    label: 'Back',
    icon: 'body',
    image: MUSCLE_IMAGES.back, // ← ADD THIS
    gradient: ['#4A90E2', '#5C7CDB'] as const,
    filterMuscles: ['back'],
    count: 0,
  },
  {
    id: 'legs',
    label: 'Legs',
    icon: 'walk',
    image: MUSCLE_IMAGES.legs, // ← ADD THIS
    gradient: ['#11998E', '#38EF7D'] as const,
    filterMuscles: ['legs'],
    count: 0,
  },
  {
    id: 'shoulders',
    label: 'Shoulders',
    icon: 'body',
    image: MUSCLE_IMAGES.shoulders, // ← ADD THIS
    gradient: ['#A770EF', '#CF8BF3'] as const,
    filterMuscles: ['shoulders'],
    count: 0,
  },
  {
    id: 'arms',
    label: 'Arms',
    icon: 'barbell',
    image: MUSCLE_IMAGES.arms, // ← ADD THIS
    gradient: ['#667EEA', '#764BA2'] as const,
    filterMuscles: ['arms'],
    count: 0,
  },
  {
    id: 'abs',
    label: 'Abs',
    icon: 'shield',
    image: MUSCLE_IMAGES.abs, // ← ADD THIS
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
    console.log("🎯 GET IMAGE FOR MUSCLE:", muscleLower);
    if (muscleLower.includes('chest') || muscleLower.includes('pectoral')) return MUSCLE_IMAGES.chest;
    if (muscleLower.includes('back') || muscleLower.includes('lat') || muscleLower.includes('trap')) return MUSCLE_IMAGES.back;
    if (muscleLower.includes('leg') || muscleLower.includes('quad') || muscleLower.includes('hamstring') || muscleLower.includes('glute') || muscleLower.includes('calf')) return MUSCLE_IMAGES.legs;
    if (muscleLower.includes('shoulder') || muscleLower.includes('delt')) return MUSCLE_IMAGES.shoulders;
    if (muscleLower.includes('arm') || muscleLower.includes('bicep') || muscleLower.includes('tricep') || muscleLower.includes('forearm')) return MUSCLE_IMAGES.arms;
    if (muscleLower.includes('waist') || muscleLower.includes('core') || muscleLower.includes('oblique') || muscleLower.includes('stomach') || muscleLower.includes('abdomen')) return MUSCLE_IMAGES.abs;
    return MUSCLE_IMAGES.chest; // true fallback for unknown muscles
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
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(0,0,0,0.78)']}
          style={styles.muscleImageShade}
        />
        <View style={styles.muscleCardBottom}>
          <Text style={styles.muscleCount}>{muscle.count} exercises</Text>
          <Text style={styles.muscleLabel}>{muscle.label}</Text>
        </View>
        {selectedMuscle === muscle.id && (
          <View style={styles.activeIndicator}>
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
          </View>
        )}
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

  const renderGridItem = useCallback(({ item }: { item: Exercise }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigateToDetail(item)}
        style={styles.gridItem}
      >
        <Animated.View
          style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Image
            source={getMuscleImage(item.muscle)}
            defaultSource={MUSCLE_IMAGES.chest}
            style={[styles.gridImage, { backgroundColor: colors.surfaceContainerLow }]}
            resizeMode="cover"
            fadeDuration={0}
          />
          <View style={styles.gridContent}>
            <Text
              numberOfLines={2}
              style={[styles.gridTitle, { color: colors.text }]}
            >
              {item.name}
            </Text>
            <View style={styles.gridMetaRow}>
              <Text style={[styles.gridMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.muscle}
              </Text>
              <View
                style={[
                  styles.difficultyBadge,
                  {
                    backgroundColor: `${DIFFICULTY_COLORS[item.difficulty as keyof typeof DIFFICULTY_COLORS] || colors.textMuted}18`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.difficultyDot,
                    {
                      backgroundColor:
                        DIFFICULTY_COLORS[item.difficulty as keyof typeof DIFFICULTY_COLORS] || colors.textMuted,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.difficultyText,
                    {
                      color:
                        DIFFICULTY_COLORS[item.difficulty as keyof typeof DIFFICULTY_COLORS] || colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.difficulty || 'beginner'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  }, [colors]);

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
          defaultSource={MUSCLE_IMAGES.chest}
          style={styles.listImageContainer}
          resizeMode="cover"
          fadeDuration={0}
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
      <TouchableOpacity
        style={styles.listAddButton}
        onPress={() => navigateToDetail(item)}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}`}
      >
        <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
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
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <AmbientGlow />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View
          style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                style={styles.appIcon}
              >
                <Ionicons name="barbell" size={24} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <Text style={[styles.appTitle, { color: colors.text }]}>Exercise Library</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Find your next move
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search exercises, muscles, gear..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              accessibilityLabel="Search exercises"
            />
            {loadingMore && <ActivityIndicator size="small" color={colors.primary} />}
            {!!searchQuery && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

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
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Muscle Groups</Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                      Choose an area to explore
                    </Text>
                  </View>
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
                <View style={styles.resultsHeading}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {`${muscleGroups.find(m => m.id === selectedMuscle)?.label || 'All'} Exercises`}
                  </Text>
                  <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                    {filteredExercises.length} {filteredExercises.length === 1 ? 'exercise' : 'exercises'}
                  </Text>
                </View>

                <View style={[styles.viewToggle, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.border }]}>
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
                      color={viewMode === 'grid' ? '#FFFFFF' : colors.text}
                    />
                    <Text
                      style={{
                        color: viewMode === 'grid' ? '#FFFFFF' : colors.textSecondary,
                        fontWeight: viewMode === 'grid' ? '800' : '600',
                      }}
                    >
                      Grid
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
                      color={viewMode === 'list' ? '#FFFFFF' : colors.text}
                    />
                    <Text
                      style={{
                        color: viewMode === 'list' ? '#FFFFFF' : colors.textSecondary,
                        fontWeight: viewMode === 'list' ? '800' : '600',
                      }}
                    >
                      List
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

                      <TouchableOpacity
                        style={[styles.recommendedAddButton, { backgroundColor: `${colors.primary}14` }]}
                        onPress={() => navigateToDetail(exercise)}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${exercise.name}`}
                      >
                        <Ionicons name="arrow-forward" size={18} color={colors.primary} />
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
                <CustomLoader
                  fullScreen={false}
                  size="small"
                  showText
                  text={`Loading ${muscleGroups.find(m => m.id === selectedMuscle)?.label} exercises...`}
                />
              </View>
            ) : !loading && filteredExercises.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <Ionicons name="search" size={30} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {searchQuery ? 'No matching exercises' : 'No exercises found'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? 'Try another exercise name, muscle, or equipment.'
                    : 'Try selecting a different muscle group.'}
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
  ambientGlowWrap: { position: 'absolute', top: -110, left: '50%', marginLeft: -180 },
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
    fontSize: 21,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  clearSearchButton: {
    padding: 4,
    marginRight: -6,
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
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 3,
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
    height: 168,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
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
  muscleImageShade: {
    ...StyleSheet.absoluteFillObject,
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
    bottom: 13,
    left: 14,
    right: 12,
    gap: 3,
    zIndex: 2,
  },
  muscleCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
  },
  muscleLabel: {
    fontSize: 19,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  muscleCardActive: {
    borderColor: colors.primary,
    borderWidth: 3,
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

  // View Toggle
  viewToggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 18,
    gap: 8,
  },
  resultsHeading: {
    flex: 1,
    minWidth: 0,
  },
  resultsCount: {
    fontSize: 11,
    marginTop: 3,
  },
  viewToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gridItem: {
    width: (width - 60) / 2,
    marginBottom: 14,
  },
  gridCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  gridImage: {
    width: '100%',
    height: 128,
  },
  gridContent: {
    padding: 12,
    gap: 8,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    minHeight: 38,
    textTransform: 'capitalize',
  },
  gridMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  gridMeta: {
    flex: 1,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 86,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'capitalize',
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
    padding: 2,
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
    paddingVertical: 52,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

});