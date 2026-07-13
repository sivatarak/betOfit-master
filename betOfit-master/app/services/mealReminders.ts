// services/mealReminders.ts
//
// Local-notification scheduling for meal reminders (breakfast/lunch/dinner).
// This file didn't exist yet, which is why both the import (calories.tsx)
// and the call site were failing to resolve. Creating it here fixes both.
//
// Requires expo-notifications:
//   npx expo install expo-notifications

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';


export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Default reminder times (24h). Adjust to match your product's schedule,
// or make these per-user/configurable later.
const MEAL_TIMES: Record<MealType, { hour: number; minute: number } | null> = {
  breakfast: { hour: 9, minute: 0 },
  lunch: { hour: 13, minute: 0 },
  dinner: { hour: 20, minute: 0 },
  snack: null, // no default reminder for snacks
};

const MEAL_MESSAGES: Record<MealType, { title: string; body: string }> = {
  breakfast: {
    title: 'Breakfast reminder',
    body: "Don't forget to log your breakfast — it helps keep today's goals on track.",
  },
  lunch: {
    title: 'Lunch reminder',
    body: "Time for lunch — log it when you're ready.",
  },
  dinner: {
    title: 'Dinner reminder',
    body: "Don't forget to log your dinner for today.",
  },
  snack: {
    title: 'Snack reminder',
    body: 'Logging snacks helps keep your totals accurate.',
  },
};

const storageKey = (mealType: MealType) => `MEAL_REMINDER_ID_${mealType}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
/**
 * ⚠️ TEMPORARY STUB — this unblocks the crash in app/(tabs)/home.tsx,
 * which imports `loadSmartSuggestions` from THIS file.
 *
 * This name/logic actually belongs to the smart-suggestion engine
 * (utils/smartSuggestionEngine.ts -> generateSmartSuggestion), not to
 * meal reminders. Whatever added this call to home.tsx likely meant to
 * import from '../../utils/smartSuggestionEngine' instead.
 *
 * This stub exists only so the app stops crashing with
 * "loadSmartSuggestions is not a function". It safely does nothing and
 * returns null — it does NOT compute or return a real suggestion.
 *
 * ACTION NEEDED: open app/(tabs)/home.tsx, find the import of
 * `loadSmartSuggestions` from './mealReminders' (or similar), and either:
 *   a) change it to import `generateSmartSuggestion` from
 *      '../../utils/smartSuggestionEngine', or
 *   b) if you genuinely want meal-reminder-aware suggestions, describe
 *      what data/shape home.tsx expects back and this can be built out
 *      properly instead of stubbed.
 */
export async function loadSmartSuggestions(...args: any[]): Promise<any> {
  console.warn(
    '[mealReminders] loadSmartSuggestions() is a temporary stub. ' +
    'See the comment above this function in services/mealReminders.ts.'
  );
  return null;
}

/**
 * Sets up the Android notification channel used for meal reminders.
 * Call this once on app start (e.g. in app/(tabs)/_layout.tsx's useEffect).
 * No-op on iOS.
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('meal-reminders', {
    name: 'Meal Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Requests notification permissions. Call this once, e.g. on app start.
 * Safe to call multiple times.
 */
export async function requestMealReminderPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // Ensure the Android channel exists whenever permissions are requested too.
  await setupAndroidNotificationChannel();

  return finalStatus === 'granted';
}

/**
 * Computes the next Date this meal's reminder should fire:
 * today at the configured time if that time hasn't passed yet,
 * otherwise tomorrow at the same time.
 */
function getNextOccurrence(mealType: MealType): Date | null {
  const time = MEAL_TIMES[mealType];
  if (!time) return null;

  const now = new Date();
  const next = new Date();
  next.setHours(time.hour, time.minute, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Schedules (or re-schedules) the next reminder notification for a given
 * meal type, storing its notification id so it can be cancelled later
 * (e.g. once the meal is actually logged).
 */
export async function scheduleNextMealReminder(mealType: MealType): Promise<void> {
  const time = MEAL_TIMES[mealType];
  if (!time) return; // no reminder configured for this meal type (e.g. snack)

  const nextDate = getNextOccurrence(mealType);
  if (!nextDate) return;

  const { title, body } = MEAL_MESSAGES[mealType];

  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextDate,
    },
  });

  await AsyncStorage.setItem(storageKey(mealType), id);
}

/**
 * Cancels whatever reminder is currently scheduled for this meal type,
 * if any. Safe to call even if nothing is scheduled.
 */
export async function cancelMealReminder(mealType: MealType): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(storageKey(mealType));
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(storageKey(mealType));
    }
  } catch (e) {
    console.log('cancelMealReminder error:', e);
  }
}

/**
 * Call this right after a meal is successfully logged.
 * Cancels today's pending reminder for that meal type (so the user
 * doesn't get reminded about something they already logged) and
 * schedules the next occurrence (tomorrow's reminder).
 */
export async function rescheduleMealAfterLog(mealType: MealType): Promise<void> {
  try {
    await cancelMealReminder(mealType);
    await scheduleNextMealReminder(mealType);
  } catch (e) {
    console.log('rescheduleMealAfterLog error:', e);
  }
}

/**
 * Alias of requestMealReminderPermissions, matching the name imported by
 * app/(tabs)/_layout.tsx.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  return requestMealReminderPermissions();
}

/**
 * Schedules all daily meal reminders (breakfast/lunch/dinner) at once.
 * Matches the name imported by app/(tabs)/_layout.tsx. Safe to call
 * repeatedly — it only fills in reminders that aren't already scheduled.
 */
export async function scheduleDailyMealNotifications(): Promise<void> {
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
  for (const mealType of mealTypes) {
    const existingId = await AsyncStorage.getItem(storageKey(mealType));
    if (!existingId) {
      await scheduleNextMealReminder(mealType);
    }
  }
}

// Module-level handle for the foreground check interval, so it can be
// started/stopped from anywhere without leaking multiple timers.
let foregroundCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a lightweight recurring check (every 5 minutes) while the app is
 * in the foreground, useful for catching meal times that fall while the
 * user has the app open (local notifications alone can be unreliable in
 * the foreground on some devices). Safe to call multiple times — it will
 * not create duplicate intervals.
 */
export function startForegroundMealCheck(): void {
  if (foregroundCheckInterval) return; // already running

  foregroundCheckInterval = setInterval(() => {
    // Re-schedule any meal reminders that may have lapsed while the app
    // was open, so the user still gets reminded on time.
    scheduleDailyMealNotifications().catch(e =>
      console.log('startForegroundMealCheck error:', e)
    );
  }, 5 * 60 * 1000); // every 5 minutes
}

/**
 * Stops the foreground check interval started by startForegroundMealCheck.
 * Safe to call even if it was never started.
 */
export function stopForegroundMealCheck(): void {
  if (foregroundCheckInterval) {
    clearInterval(foregroundCheckInterval);
    foregroundCheckInterval = null;
  }
}

/**
 * Call this once on app start (e.g. in your root layout's useEffect) to
 * make sure all meal types have a reminder scheduled if they don't
 * already.
 */
export async function initMealReminders(): Promise<void> {
  const granted = await requestMealReminderPermissions();
  if (!granted) return;

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
  for (const mealType of mealTypes) {
    const existingId = await AsyncStorage.getItem(storageKey(mealType));
    if (!existingId) {
      await scheduleNextMealReminder(mealType);
    }
  }
}











