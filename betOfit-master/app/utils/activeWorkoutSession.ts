export const ACTIVE_WORKOUT_SESSION_KEY = 'ACTIVE_WORKOUT_SESSION_V1';
export const ACTIVE_WORKOUT_SESSION_META_KEY = 'ACTIVE_WORKOUT_SESSION_META_V1';

export interface ActiveWorkoutSessionMeta {
  sessionId: string;
  completedWorkoutCount: number;
  lastCompletedExerciseId?: string;
  lastCompletedAt?: number;
}

export interface ActiveWorkoutSession {
  sessionId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  type: string;
  workoutStartTime: number;
  completedSets: unknown[];
  currentSet: unknown;
  notes: string;
  setTimerState: 'idle' | 'running' | 'paused';
  setStartTime: number;
  setElapsedTime: number;
  restStartTime: number;
  modalVisible: boolean;
}
