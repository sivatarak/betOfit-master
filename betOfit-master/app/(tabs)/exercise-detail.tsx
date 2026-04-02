// app/(tabs)/exercise-detail.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { CustomLoader } from '../../components/CustomLoader';
import { useTheme } from '../../context/themecontext';

const { width, height } = Dimensions.get('window');

interface Exercise {
  id?: string;
  name: string;
  type: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  instructions: string;
  gifUrl?: string;
  target?: string;
  secondaryMuscles?: string[];
  equipments?: string[];
}

interface WorkoutSet {
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
}

interface WorkoutHistory {
  id: string;
  exerciseName: string;
  sets: WorkoutSet[];
  date: string;
  time: string;
  duration: number;
  caloriesBurned?: number;
  totalVolume?: number;
  totalReps?: number;
  totalDistance?: number;
  totalTime?: number;
  notes?: string;
}

// Exercise video IDs (expandable)
const EXERCISE_VIDEOS: { [key: string]: string } = {
  'bench press': 'SCVCLChPQFY',
  'incline bench press': 'SrqOu55lrYU',
  'decline bench press': 'OR6MQ5icT4o',
  'squat': 'ultWZbUMPL8',
  'deadlift': 'op9kVnSso6Q',
  'pull up': 'eGo4IYlbE5g',
  'chin up': 'BR0GxE9BfBk',
  'push up': 'IODxDxX7oi4',
  'shoulder press': 'qEwKCR5JCog',
  'overhead press': '2yjwXTZQDDI',
  'bicep curl': 'ykJmrZ5v0Oo',
  'tricep extension': '_gsUck-7M74',
  'lat pulldown': 'CAwf7n6Bp8A',
  'leg press': 'IZxyjW7MPJQ',
  'leg extension': 'YyvSfVjQeL0',
  'leg curl': '1Tq3QdYUuHs',
  'calf raise': '-M4-G8p8kTk',
  'lateral raise': '3VcKaXpzqRo',
  'front raise': 'Gt5pJzfR56o',
  'bent over row': 'FWJR5VeNfEU',
  'barbell row': 'FWJR5VeNfEU',
  'seated row': 'GZbfZ033f74',
  'face pull': 'V-8dNS1H8lA',
  'dumbbell fly': 'eGjt4lkMDgM',
  'cable crossover': 'taI4X3L1o7Q',
  'dips': '2z8JmcrW-As',
  'plank': 'BQu25ABwlms',
  'crunch': 'Xyd_fa5zoEU',
  'sit up': 'jDwoBqPH0jk',
  'leg raise': 'JB2oyawG9KI',
  'running': 'brFHyOtJsH0',
  'lunge': 'QOVaHwm-Q6U',
  'hip thrust': 'jCqvG6F3wYw',
  'glute bridge': 'nTgEtiMUe7c',
};

// Difficulty colors
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#10B981',
  intermediate: '#F59E0B',
  expert: '#EF4444',
  advanced: '#EF4444',
};

export default function ExerciseDetailScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);

  const params = useLocalSearchParams();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistory[]>([]);
  const [personalRecord, setPersonalRecord] = useState<{ weight: number; date: string } | null>(null);
  const [estimated1RM, setEstimated1RM] = useState<number | null>(null);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [averageVolume, setAverageVolume] = useState(0);
  const [recentVolume, setRecentVolume] = useState(0);
  const [previousVolume, setPreviousVolume] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    loadExercise();
  }, [params.exercise]);

  useEffect(() => {
    if (exercise) {
      loadWorkoutHistory(exercise.name);
      checkIfFavorite(exercise.name);
      findVideoForExercise(exercise.name);
    }
  }, [exercise]);

  const loadExercise = async () => {
    try {
      if (params.exercise) {
        const parsedExercise = JSON.parse(params.exercise as string);
        setExercise(parsedExercise);
      }
    } catch (error) {
      console.error('Error parsing exercise:', error);
      Alert.alert('Error', 'Failed to load exercise details');
    } finally {
      setLoading(false);
    }
  };

  const findVideoForExercise = (exerciseName: string) => {
    if (!exerciseName) {
      setVideoId(null);
      return;
    }

    const name = exerciseName.toLowerCase().trim();

    // 1️⃣ Exact match
    if (EXERCISE_VIDEOS[name]) {
      setVideoId(EXERCISE_VIDEOS[name]);
      return;
    }

    // 2️⃣ Contains match
    for (const key of Object.keys(EXERCISE_VIDEOS)) {
      if (name.includes(key)) {
        setVideoId(EXERCISE_VIDEOS[key]);
        return;
      }
    }

    // 3️⃣ Word match (VERY IMPORTANT)
    const words = name.split(' ');

    for (const key of Object.keys(EXERCISE_VIDEOS)) {
      for (const word of words) {
        if (key.includes(word)) {
          setVideoId(EXERCISE_VIDEOS[key]);
          return;
        }
      }
    }

    // ❌ No match found
    setVideoId(null);
  };

  const loadWorkoutHistory = async (exerciseName: string) => {
    try {
      const history = await AsyncStorage.getItem('WORKOUT_HISTORY');
      if (history) {
        const parsed: WorkoutHistory[] = JSON.parse(history);

        const exerciseWorkouts = parsed
          .filter(w => w.exerciseName === exerciseName)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setWorkoutHistory(exerciseWorkouts);
        setTotalWorkouts(exerciseWorkouts.length);

        let maxWeight = 0;
        let maxWeightDate = '';

        exerciseWorkouts.forEach(workout => {
          workout.sets?.forEach(set => {
            if (set.weight && set.weight > maxWeight) {
              maxWeight = set.weight;
              maxWeightDate = workout.date;
            }
          });
        });

        if (maxWeight > 0) {
          setPersonalRecord({ weight: maxWeight, date: maxWeightDate });
        }

        const volumes: { date: string; value: number }[] = [];
        let totalVolumeSum = 0;
        let volumeCount = 0;

        exerciseWorkouts.slice(0, 6).reverse().forEach(workout => {
          let workoutVolume = 0;
          workout.sets?.forEach(set => {
            if (set.weight && set.reps) {
              workoutVolume += set.weight * set.reps;
            }
          });

          if (workoutVolume > 0) {
            volumes.push({ date: workout.date, value: Math.round(workoutVolume) });
            totalVolumeSum += workoutVolume;
            volumeCount++;
          }
        });

        setChartData(volumes);

        if (volumeCount > 0) {
          setAverageVolume(Math.round(totalVolumeSum / volumeCount));
        }

        if (exerciseWorkouts.length >= 2) {
          const recent = exerciseWorkouts[0];
          const previous = exerciseWorkouts[1];

          let recentVol = 0;
          let previousVol = 0;

          recent.sets?.forEach(set => {
            if (set.weight && set.reps) recentVol += set.weight * set.reps;
          });

          previous.sets?.forEach(set => {
            if (set.weight && set.reps) previousVol += set.weight * set.reps;
          });

          setRecentVolume(recentVol);
          setPreviousVolume(previousVol);
        }

        if (maxWeight > 0) {
          let maxWeightSet: WorkoutSet | null = null;
          exerciseWorkouts.forEach(workout => {
            workout.sets?.forEach(set => {
              if (set.weight === maxWeight && set.reps) {
                maxWeightSet = set;
              }
            });
          });

          if (maxWeightSet && maxWeightSet.reps) {
            if (maxWeightSet.reps <= 10) {
              const estimated = maxWeightSet.weight! / (1.0278 - 0.0278 * maxWeightSet.reps);
              setEstimated1RM(Math.round(estimated));
            } else {
              const estimated = maxWeightSet.weight! * (1 + maxWeightSet.reps / 30);
              setEstimated1RM(Math.round(estimated));
            }
          } else {
            setEstimated1RM(Math.round(maxWeight * 1.1));
          }
        }
      }
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  };

  const checkIfFavorite = async (exerciseName: string) => {
    try {
      const favorites = await AsyncStorage.getItem('FAVORITE_EXERCISES');
      if (favorites) {
        const parsed = JSON.parse(favorites);
        setIsFavorite(parsed.includes(exerciseName));
      }
    } catch (error) {
      console.error('Error checking favorites:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!exercise) return;

    try {
      const favorites = await AsyncStorage.getItem('FAVORITE_EXERCISES') || '[]';
      let parsed = JSON.parse(favorites);

      if (isFavorite) {
        parsed = parsed.filter((name: string) => name !== exercise.name);
      } else {
        parsed.push(exercise.name);
      }

      await AsyncStorage.setItem('FAVORITE_EXERCISES', JSON.stringify(parsed));
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const startExercise = () => {
    if (!exercise) return;

    try {
      router.push({
        pathname: '/(tabs)/logExercise-screen',
        params: {
          exerciseName: exercise.name,
          muscle: exercise.muscle,
          equipment: exercise.equipment,
          difficulty: exercise.difficulty,
          type: exercise.type,
        },
      });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Could not navigate to workout screen');
    }
  };

  const parseInstructions = (instructions: string): string[] => {
    if (!instructions || instructions.trim() === '') {
      return [
        'Position yourself correctly with proper form',
        'Maintain control throughout the movement',
        'Focus on the target muscle engagement',
        'Breathe properly - exhale during exertion',
        'Complete the movement with controlled tempo'
      ];
    }

    return instructions
      .split(/\.\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const calculateProgressPercentage = (): number => {
    if (recentVolume === 0 || previousVolume === 0) return 0;
    return Math.round(((recentVolume - previousVolume) / previousVolume) * 100);
  };

  const getProTip = (): string => {
    if (!exercise) return 'Focus on form over weight';

    const name = exercise.name.toLowerCase();
    const muscle = exercise.muscle.toLowerCase();

    if (name.includes('bench') || name.includes('press') && muscle.includes('chest')) {
      return 'Squeeze chest at the top and keep shoulders pinned back';
    }

    if (name.includes('pull') || name.includes('row') || muscle.includes('back')) {
      return 'Pull with elbows, squeeze shoulder blades together';
    }

    if (name.includes('squat') || name.includes('lunge') || muscle.includes('quad') || muscle.includes('leg')) {
      return 'Keep chest up and knees tracking over toes';
    }

    if (name.includes('deadlift')) {
      return 'Keep bar close to body, drive through heels';
    }

    if (name.includes('curl')) {
      return 'Keep elbows pinned, squeeze biceps at the top';
    }

    return 'Focus on controlled movement and proper form';
  };

  const getEquipmentList = (): string[] => {
    if (!exercise) return ['Bodyweight'];

    if (exercise.equipments && exercise.equipments.length > 0) {
      return exercise.equipments;
    }

    if (exercise.equipment) {
      return exercise.equipment.split(',').map(e => e.trim());
    }

    return ['Bodyweight'];
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const getChartMaxValue = (): number => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map(d => d.value));
    return max > 0 ? max : 100;
  };

  const getChartPath = (): string => {
    if (chartData.length < 2) return '';

    const maxValue = getChartMaxValue();
    const width = 400;
    const height = 120;
    const step = width / (chartData.length - 1);

    let path = '';
    chartData.forEach((point, index) => {
      const x = index * step;
      const y = height - (point.value / maxValue) * 100;

      if (index === 0) {
        path += `M${x},${y}`;
      } else {
        path += ` L${x},${y}`;
      }
    });

    return path;
  };

  const getAreaPath = (): string => {
    if (chartData.length < 2) return '';

    const maxValue = getChartMaxValue();
    const width = 400;
    const height = 120;
    const step = width / (chartData.length - 1);

    let path = '';
    chartData.forEach((point, index) => {
      const x = index * step;
      const y = height - (point.value / maxValue) * 100;

      if (index === 0) {
        path += `M${x},${y}`;
      } else {
        path += ` L${x},${y}`;
      }
    });

    const lastX = (chartData.length - 1) * step;
    path += ` L${lastX},${height} L0,${height} Z`;

    return path;
  };

 if ( loading) {
  return (
    <CustomLoader 
      fullScreen={true} 
    />
  );
}

  if (!exercise) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="fitness-outline" size={80} color={colors.primary} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Exercise Not Found</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            The exercise you're looking for doesn't exist
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const instructionSteps = parseInstructions(exercise.instructions);
  const difficultyColor = DIFFICULTY_COLORS[exercise.difficulty?.toLowerCase()] || colors.textMuted;
  const equipmentsList = getEquipmentList();
  const progressPercentage = calculateProgressPercentage();
  const proTip = getProTip();
  const chartPath = getChartPath();
  const areaPath = getAreaPath();
  const chartMaxValue = getChartMaxValue();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HERO SECTION */}
      <ImageBackground
        source={{
          uri: exercise.gifUrl || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800'
        }}
        style={styles.heroSection}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)', colors.background]}
          locations={[0, 0.3, 0.8]}
          style={styles.heroGradient}
        >
          <SafeAreaView style={styles.heroSafeArea}>
            <View style={styles.heroTopNav}>
              <View style={styles.navButton} /> 

              <TouchableOpacity style={styles.navButton} onPress={toggleFavorite}>
                <BlurView intensity={80} tint="dark" style={styles.navButtonBlur}>
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isFavorite ? '#EF4444' : '#FFFFFF'}
                  />
                </BlurView>
              </TouchableOpacity>
            </View>

            <View style={styles.heroTitleContainer}>
              <View style={styles.heroBadgesRow}>
                <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor }]}>
                  <Text style={styles.difficultyBadgeText}>
                    {exercise.difficulty?.toUpperCase() || 'BEGINNER'}
                  </Text>
                </View>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{exercise.type?.toUpperCase() || 'STRENGTH'}</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>{exercise.name}</Text>
              <Text style={styles.heroMuscle}>{exercise.muscle}</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PERFORMANCE STATS GRID */}
        {personalRecord && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="trophy" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>PERSONAL RECORD</Text>
              <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: colors.text }]}>{personalRecord.weight}</Text>
                <Text style={[styles.statUnit, { color: colors.textMuted }]}>kg</Text>
              </View>
              {personalRecord.date && (
                <Text style={[styles.statDate, { color: colors.textMuted }]}>{formatDate(personalRecord.date)}</Text>
              )}
            </View>

            {estimated1RM && (
              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="flash" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>EST. 1RM</Text>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{estimated1RM}</Text>
                  <Text style={[styles.statUnit, { color: colors.textMuted }]}>kg</Text>
                </View>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>Based on PR</Text>
              </View>
            )}

            {averageVolume > 0 && (
              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="barbell" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>AVG. VOLUME</Text>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{averageVolume}</Text>
                  <Text style={[styles.statUnit, { color: colors.textMuted }]}>kg</Text>
                </View>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>Per workout</Text>
              </View>
            )}
          </View>
        )}

        {/* PROGRESS HISTORY CHART */}
        {chartData.length >= 2 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Progress History</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                  Last {chartData.length} workouts
                </Text>
              </View>
              {progressPercentage !== 0 && (
                <View style={[
                  styles.progressBadge,
                  { backgroundColor: progressPercentage > 0 ? `${colors.success}15` : `${colors.error}15` }
                ]}>
                  <Ionicons
                    name={progressPercentage > 0 ? 'trending-up' : 'trending-down'}
                    size={16}
                    color={progressPercentage > 0 ? colors.success : colors.error}
                  />
                  <Text style={[
                    styles.progressBadgeText,
                    { color: progressPercentage > 0 ? colors.success : colors.error }
                  ]}>
                    {progressPercentage > 0 ? '+' : ''}{progressPercentage}%
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
              <Svg width="100%" height={200} viewBox="0 0 400 140">
                <Defs>
                  <SvgLinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.primary} stopOpacity="0.3" />
                    <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
                  </SvgLinearGradient>
                </Defs>

                <Path d="M0,100 L400,100" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
                <Path d="M0,60 L400,60" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
                <Path d="M0,20 L400,20" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />

                {areaPath && <Path d={areaPath} fill="url(#chartGradient)" />}
                {chartPath && (
                  <Path
                    d={chartPath}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )}

                {chartData.map((point, index) => {
                  const x = (index / (chartData.length - 1)) * 400;
                  const y = 120 - (point.value / chartMaxValue) * 100;
                  return (
                    <Circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="5"
                      fill={colors.primary}
                      stroke={colors.background}
                      strokeWidth="2"
                    />
                  );
                })}
              </Svg>

              <View style={styles.chartLabels}>
                {chartData.map((point, index) => (
                  <Text key={index} style={[styles.chartLabel, { color: colors.textMuted }]}>
                    {formatDate(point.date)}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* QUICK INFO GRID */}
        <View style={styles.quickInfoGrid}>
          <View style={[styles.quickInfoCard, { backgroundColor: colors.card }]}>
            <View style={[styles.quickInfoIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="barbell-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.quickInfoTitle, { color: colors.text }]}>Equipment</Text>
            <Text style={[styles.quickInfoText, { color: colors.textSecondary }]} numberOfLines={2}>
              {equipmentsList.join(' • ')}
            </Text>
          </View>

          <View style={[styles.quickInfoCard, { backgroundColor: colors.card }]}>
            <View style={[styles.quickInfoIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="bulb-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.quickInfoTitle, { color: colors.text }]}>Pro Tip</Text>
            <Text style={[styles.quickInfoText, { color: colors.textSecondary }]} numberOfLines={2}>
              {proTip}
            </Text>
          </View>

          <View style={[styles.quickInfoCard, { backgroundColor: colors.card }]}>
            <View style={[styles.quickInfoIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.quickInfoTitle, { color: colors.text }]}>Workouts</Text>
            <Text style={[styles.quickInfoText, { color: colors.textSecondary }]}>
              {totalWorkouts} {totalWorkouts === 1 ? 'time' : 'times'}
            </Text>
          </View>
        </View>

        {/* INLINE VIDEO PLAYER SECTION */}
        {videoId && (
          <View style={{ margin: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Video Tutorial</Text>

            <View style={{ height: 220, borderRadius: 16, overflow: 'hidden', marginTop: 10 }}>
              <WebView
                source={{
                  uri: `https://www.youtube.com/embed/${videoId}?playsinline=1`
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsFullscreenVideo={true}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
                originWhitelist={['*']}
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/88.0.4324.93 Mobile Safari/537.36"
              />
            </View>
          </View>
        )}

        {/* NO VIDEO AVAILABLE SECTION */}
        {!videoId && (
          <View style={styles.section}>
            <View style={[styles.noVideoCard, { backgroundColor: colors.card }]}>
              <View style={[styles.noVideoIconContainer, { backgroundColor: colors.border }]}>
                <Ionicons name="videocam-off-outline" size={32} color={colors.textMuted} />
              </View>
              <Text style={[styles.noVideoTitle, { color: colors.text }]}>No Video Available</Text>
              <Text style={[styles.noVideoSubtitle, { color: colors.textSecondary }]}>
                Tutorial video not found for this exercise
              </Text>
              <TouchableOpacity
                style={styles.searchYouTubeButton}
                onPress={() => {
                  const query = encodeURIComponent(`${exercise.name} exercise tutorial proper form`);
                  const youtubeUrl = `https://www.youtube.com/results?search_query=${query}`;
                  Linking.openURL(youtubeUrl);
                }}
              >
                <LinearGradient
                  colors={['#FF0000', '#CC0000']}
                  style={styles.searchYouTubeGradient}
                >
                  <Ionicons name="logo-youtube" size={20} color="#FFFFFF" />
                  <Text style={styles.searchYouTubeText}>Search on YouTube</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MUSCLE FOCUS SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Muscle Focus</Text>

          <View style={[styles.muscleFocusCard, { backgroundColor: colors.card }]}>
            <View style={styles.muscleDiagram}>
              <View style={styles.muscleDiagramCircle}>
                <LinearGradient
                  colors={[colors.secondary, colors.primary]}
                  style={styles.muscleGradient}
                >
                  <Ionicons name="body" size={100} color="rgba(255, 255, 255, 0.3)" />
                </LinearGradient>
              </View>
            </View>

            <View style={styles.muscleInfo}>
              <View style={styles.muscleItem}>
                <View style={[styles.muscleDot, { backgroundColor: colors.primary }]} />
                <View>
                  <Text style={[styles.muscleLabel, { color: colors.textSecondary }]}>PRIMARY</Text>
                  <Text style={[styles.muscleText, { color: colors.text }]}>
                    {exercise.target || exercise.muscle}
                  </Text>
                </View>
              </View>

              {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                <>
                  <View style={[styles.muscleDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.muscleItem}>
                    <View style={[styles.muscleDot, styles.secondaryDot, { backgroundColor: colors.textMuted }]} />
                    <View>
                      <Text style={[styles.muscleLabel, { color: colors.textSecondary }]}>SECONDARY</Text>
                      <Text style={[styles.muscleText, { color: colors.text }]}>
                        {exercise.secondaryMuscles.join(', ')}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* EXECUTION GUIDE */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Execution Guide</Text>

          <View style={styles.instructionsContainer}>
            {instructionSteps.map((step, index) => (
              <View key={index} style={styles.instructionRow}>
                {index < instructionSteps.length - 1 && (
                  <View style={[styles.connectingLine, { backgroundColor: `${colors.primary}30` }]} />
                )}

                <View style={styles.stepNumberCircle}>
                  <LinearGradient
                    colors={[colors.secondary, colors.primary]}
                    style={styles.stepNumberGradient}
                  >
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </LinearGradient>
                </View>

                <View style={styles.instructionContent}>
                  <Text style={[styles.instructionStep, { color: colors.primary }]}>Step {index + 1}</Text>
                  <Text style={[styles.instructionText, { color: colors.textSecondary }]}>{step}.</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* START EXERCISE BUTTON */}
        <TouchableOpacity
          style={styles.startExerciseButton}
          onPress={startExercise}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.secondary, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startExerciseGradient}
          >
            <View style={styles.startExerciseContent}>
              <View style={[styles.startIconContainer, { borderColor: 'rgba(255,255,255,0.5)' }]}>
                <Ionicons name="play" size={22} color="white" />
              </View>
              <Text style={styles.startExerciseText}>Start Exercise</Text>
              <View style={styles.startBadge}>
                <Text style={styles.startBadgeText}>GO!</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Hero Section
  heroSection: {
    height: height * 0.45,
    width: '100%',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroSafeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  heroTopNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  navButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 44,
    textTransform: 'capitalize',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMuscle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'capitalize',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  scrollView: {
    flex: 1,
    marginTop: -20,
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 20,
  },

  // Performance Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  statUnit: {
    fontSize: 12,
    marginBottom: 2,
    fontWeight: '500',
  },
  statDate: {
    fontSize: 10,
    marginTop: 4,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  progressBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Chart
  chartContainer: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Quick Info Grid
  quickInfoGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  quickInfoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickInfoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  quickInfoText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },

  // No Video Card
  noVideoCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noVideoIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noVideoTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  noVideoSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  searchYouTubeButton: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  searchYouTubeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  searchYouTubeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Muscle Focus
  muscleFocusCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  muscleDiagram: {
    alignItems: 'center',
    marginBottom: 24,
  },
  muscleDiagramCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  muscleGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  muscleInfo: {
    gap: 16,
  },
  muscleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  muscleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  secondaryDot: {
    backgroundColor: '#9CA3AF',
  },
  muscleLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  muscleText: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  muscleDivider: {
    height: 1,
    marginVertical: 8,
  },

  // Instructions
  instructionsContainer: {
    position: 'relative',
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
    position: 'relative',
  },
  connectingLine: {
    position: 'absolute',
    left: 22,
    top: 44,
    bottom: -24,
    width: 2,
    borderRadius: 1,
  },
  stepNumberCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  stepNumberGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  instructionContent: {
    flex: 1,
    paddingTop: 8,
  },
  instructionStep: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 15,
    lineHeight: 22,
  },

  // Start Exercise Button
  startExerciseButton: {
    marginHorizontal: 40,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  startExerciseGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  startExerciseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  startIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  startExerciseText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  startBadge: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 4,
  },
  startBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
});