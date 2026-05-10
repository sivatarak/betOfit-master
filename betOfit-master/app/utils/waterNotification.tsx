import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_IDS_KEY = 'WATER_NOTIFICATION_IDS';
const LAST_DRINK_KEY = 'WATER_LAST_DRINK_TIME';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Permission ───────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false; // won't work on emulator

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Cancel all scheduled water notifications ─────────────
export async function cancelAllWaterNotifications() {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
    }
    await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
  } catch (e) {
    console.error('Cancel notifications error:', e);
  }
}

// ─── Save notification IDs ────────────────────────────────
async function saveNotificationId(id: string) {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    ids.push(id);
    await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Save notification ID error:', e);
  }
}

// ─── Schedule "1 hour after drinking" reminder ────────────
export async function schedulePostDrinkReminder() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Save the time they drank
  await AsyncStorage.setItem(LAST_DRINK_KEY, Date.now().toString());

  // Cancel existing so we don't stack them
  await cancelAllWaterNotifications();

  const messages = [
    { title: '💧 Time to Hydrate!', body: "It's been an hour — grab a glass of water!" },
    { title: '🚰 Water Break!', body: 'Your body needs water. Take a sip now!' },
    { title: '💧 Stay Hydrated!', body: "Don't forget to drink water. You're doing great!" },
    { title: '🥤 Hydration Check!', body: 'One hour passed — time for another glass!' },
  ];

  const msg = messages[Math.floor(Math.random() * messages.length)];

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title,
      body: msg.body,
      sound: true,
      data: { type: 'water_reminder' },
    },
    trigger: {
      seconds: 60 * 60, // 1 hour
      repeats: false,
    },
  });

  await saveNotificationId(id);
  console.log('💧 Post-drink reminder scheduled for 1 hour later');
}

// ─── Schedule morning reminders if no water logged ────────
export async function scheduleMorningReminders() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const morningSlots = [
    { hour: 8,  minute: 0,  title: '🌅 Good Morning!',      body: "Start your day right — drink a glass of water!" },
    { hour: 9,  minute: 30, title: '☀️ Morning Hydration',   body: "You haven't had water yet today. Time to hydrate!" },
    { hour: 11, minute: 0,  title: '⏰ Still thirsty?',      body: "It's almost noon and no water logged. Drink up!" },
  ];

  for (const slot of morningSlots) {
    const trigger = new Date();
    trigger.setHours(slot.hour, slot.minute, 0, 0);

    // If time already passed today, skip
    if (trigger <= new Date()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: slot.title,
        body: slot.body,
        sound: true,
        data: { type: 'morning_water_reminder' },
      },
      trigger: {
        hour: slot.hour,
        minute: slot.minute,
        repeats: true, // every day
      },
    });

    await saveNotificationId(id);
    console.log(`💧 Morning reminder scheduled at ${slot.hour}:${slot.minute < 10 ? '0' : ''}${slot.minute}`);
  }
}

// ─── Schedule reminders throughout the day ────────────────
export async function scheduleDailyWaterReminders() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelAllWaterNotifications();

  const timeSlots = [
    { hour: 8,  minute: 0,  body: "Start your day with a glass of water! 🌅" },
    { hour: 10, minute: 0,  body: "Mid-morning hydration check! 💧" },
    { hour: 12, minute: 0,  body: "Lunchtime — don't forget your water! 🥤" },
    { hour: 14, minute: 0,  body: "Afternoon slump? Water helps! ⚡" },
    { hour: 16, minute: 0,  body: "Keep going — hydration fuels you! 💪" },
    { hour: 18, minute: 0,  body: "Evening reminder — drink some water! 🌇" },
    { hour: 20, minute: 0,  body: "Last call for water before bed! 🌙" },
  ];

  for (const slot of timeSlots) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 Hydration Reminder',
        body: slot.body,
        sound: true,
        data: { type: 'daily_water_reminder' },
      },
      trigger: {
        hour: slot.hour,
        minute: slot.minute,
        repeats: true,
      },
    });

    await saveNotificationId(id);
  }

  console.log('💧 Daily water reminders scheduled');
}

// ─── Check if late morning with no water (call on app focus) ─
export async function checkLateAndNoDrink(currentMl: number) {
  const hour = new Date().getHours();

  // Between 10am and 1pm with no water logged → fire immediately
  if (hour >= 10 && hour < 13 && currentMl === 0) {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '😅 No water yet today?',
        body: "It's getting late in the morning — hydrate now!",
        sound: true,
        data: { type: 'late_morning_reminder' },
      },
      trigger: {
        seconds: 5, // near-immediate
        repeats: false,
      },
    });
  }
}