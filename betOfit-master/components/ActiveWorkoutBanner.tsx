import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppAlert as Alert } from '../app/utils/appAlert';
import {
  ACTIVE_WORKOUT_SESSION_KEY,
  ACTIVE_WORKOUT_SESSION_META_KEY,
  ActiveWorkoutSession,
  ActiveWorkoutSessionMeta,
  isUntouchedWorkoutDraft,
} from '../app/utils/activeWorkoutSession';
import { ACTIVE_WORKOUT_UPDATED, appEvents } from '../app/utils/eventEmitter';

export function ActiveWorkoutBanner() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{
    exerciseId?: string;
    exerciseName?: string;
    sessionId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [discarding, setDiscarding] = useState(false);
  const [session, setSession] = useState<{
    draft: ActiveWorkoutSession | null;
    meta: ActiveWorkoutSessionMeta | null;
  }>({ draft: null, meta: null });

  const loadSession = useCallback(async () => {
    try {
      const [storedDraft, storedMeta] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY),
        AsyncStorage.getItem(ACTIVE_WORKOUT_SESSION_META_KEY),
      ]);
      setSession({
        draft: storedDraft ? JSON.parse(storedDraft) as ActiveWorkoutSession : null,
        meta: storedMeta ? JSON.parse(storedMeta) as ActiveWorkoutSessionMeta : null,
      });
    } catch (error) {
      console.error('Could not load active workout session:', error);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [pathname, loadSession]);

  useEffect(() => {
    appEvents.on(ACTIVE_WORKOUT_UPDATED, loadSession);
    return () => {
      appEvents.off(ACTIVE_WORKOUT_UPDATED, loadSession);
    };
  }, [loadSession]);

  const isLogger = pathname.includes('logExercise-screen');
  const draftIsNextWorkout = Boolean(
    session.draft &&
    session.meta &&
    session.draft.sessionId === session.meta.sessionId &&
    session.draft.workoutStartTime > (session.meta.lastCompletedAt ?? 0)
  );
  const hasNextExerciseInSession = Boolean(
    isLogger &&
    session.meta &&
    session.meta.completedWorkoutCount > 0 &&
    session.meta.sessionId === params.sessionId &&
    (session.meta.lastCompletedExerciseId !== params.exerciseId || draftIsNextWorkout)
  );
  const showDraftResume = Boolean(!isLogger && session.draft);
  const canDiscardEmptyDraft = Boolean(
    showDraftResume &&
    session.draft &&
    isUntouchedWorkoutDraft(session.draft)
  );

  if (!hasNextExerciseInSession && !showDraftResume) return null;

  const exerciseName = isLogger
    ? params.exerciseName || 'Current exercise'
    : session.draft?.exerciseName || 'Workout';
  const completedWorkoutCount = session.meta?.completedWorkoutCount ?? 0;

  const discardEmptyDraft = async () => {
    if (!session.draft || discarding) return;
    setDiscarding(true);
    try {
      const [storedDraft, storedMeta] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_WORKOUT_SESSION_KEY),
        AsyncStorage.getItem(ACTIVE_WORKOUT_SESSION_META_KEY),
      ]);
      const currentDraft = storedDraft
        ? JSON.parse(storedDraft) as ActiveWorkoutSession
        : null;
      const currentMeta = storedMeta
        ? JSON.parse(storedMeta) as ActiveWorkoutSessionMeta
        : null;

      if (
        !currentDraft ||
        currentDraft.sessionId !== session.draft.sessionId ||
        currentDraft.workoutId !== session.draft.workoutId ||
        !isUntouchedWorkoutDraft(currentDraft)
      ) {
        await loadSession();
        Alert.alert(
          'Workout changed',
          'This workout now has activity, so it was not discarded. Continue it from the banner.'
        );
        return;
      }

      await AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_KEY);
      if (
        currentMeta?.sessionId === currentDraft.sessionId &&
        currentMeta.completedWorkoutCount === 0
      ) {
        await AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_META_KEY);
      }
      appEvents.emit(ACTIVE_WORKOUT_UPDATED);
    } catch (error) {
      console.error('Could not discard empty workout:', error);
      Alert.alert('Could not discard workout', 'Please try again.');
    } finally {
      setDiscarding(false);
    }
  };

  const confirmDiscardEmptyDraft = () => {
    if (!session.draft || !canDiscardEmptyDraft || discarding) return;
    const hasSavedWorkouts =
      session.meta?.sessionId === session.draft.sessionId &&
      session.meta.completedWorkoutCount > 0;
    Alert.alert(
      hasSavedWorkouts ? 'Discard empty exercise?' : 'Discard empty workout?',
      hasSavedWorkouts
        ? `This exercise has no logged sets. Your ${session.meta?.completedWorkoutCount} saved ${session.meta?.completedWorkoutCount === 1 ? 'exercise' : 'exercises'} will remain in the session.`
        : 'No exercises have been logged in this workout. Discard this empty session?',
      [
        { text: 'Keep workout', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discardEmptyDraft },
      ]
    );
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: insets.bottom + 64,
        left: 12,
        right: 12,
        zIndex: 1000,
        elevation: 10,
      }}
    >
      <View
        style={{
          minHeight: 68,
          borderRadius: 18,
          backgroundColor: '#171717',
          borderWidth: 1,
          borderColor: 'rgba(249, 115, 22, 0.42)',
          paddingLeft: 14,
          paddingRight: 8,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.22,
          shadowRadius: 12,
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isLogger ? 'Workout session is active' : `Resume workout: ${exerciseName}`}
          disabled={isLogger}
          onPress={() => {
            if (!session.draft) return;
            router.push({
              pathname: '/(tabs)/logExercise-screen',
              params: {
                sessionId: session.draft.sessionId,
                workoutId: session.draft.workoutId,
                exerciseId: session.draft.exerciseId,
                exerciseName: session.draft.exerciseName,
                muscle: session.draft.muscle,
                equipment: session.draft.equipment,
                difficulty: session.draft.difficulty,
                type: session.draft.type,
              },
            });
          }}
          activeOpacity={0.9}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: 'rgba(249, 115, 22, 0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="barbell" size={21} color="#FB923C" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#FDBA74', fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>
              {isLogger ? 'SESSION IN PROGRESS' : 'WORKOUT IN PROGRESS'}
            </Text>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginTop: 3 }} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={{ color: '#A3A3A3', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              {isLogger
                ? `${completedWorkoutCount} ${completedWorkoutCount === 1 ? 'workout' : 'workouts'} saved · Add another exercise`
                : `${session.draft?.completedSets.length ?? 0} ${session.draft?.completedSets.length === 1 ? 'set' : 'sets'} logged · Tap to continue`}
            </Text>
          </View>
          <View
            style={{
              minHeight: 38,
              borderRadius: 12,
              backgroundColor: '#F97316',
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>
              {isLogger ? 'SESSION ACTIVE' : 'CONTINUE SESSION'}
            </Text>
            {!isLogger && <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />}
          </View>
        </TouchableOpacity>
        {canDiscardEmptyDraft && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Discard empty workout"
            disabled={discarding}
            onPress={confirmDiscardEmptyDraft}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
              opacity: discarding ? 0.55 : 1,
            }}
          >
            <Ionicons name="close" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
