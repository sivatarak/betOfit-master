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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isUntouchedWorkoutDraft = (draft: ActiveWorkoutSession): boolean => {
  if (
    draft.completedSets.length > 0 ||
    draft.setTimerState !== 'idle' ||
    draft.modalVisible ||
    draft.setStartTime > 0 ||
    draft.setElapsedTime > 0 ||
    draft.restStartTime > 0 ||
    (typeof draft.notes === 'string' && draft.notes.trim().length > 0)
  ) {
    return false;
  }

  if (!isRecord(draft.currentSet)) return false;

  return Object.entries(draft.currentSet).every(([key, value]) => {
    if (key === 'id' || key === 'setNumber' || value === undefined || value === null || value === '') {
      return true;
    }
    return typeof value === 'number' && value === 0;
  });
};
