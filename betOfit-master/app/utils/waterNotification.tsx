import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_IDS_KEY = 'WATER_NOTIFICATION_IDS';
const LAST_DRINK_KEY       = 'WATER_LAST_DRINK_TIME';
const CHANNEL_ID           = 'water-reminders';

// ─── Android channel setup ────────────────────────────────
export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Water Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2196F3',
  });
}

// ─── Permission ───────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Cancel all ───────────────────────────────────────────
export async function cancelAllWaterNotifications() {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      await Promise.all(
        ids.map(id => Notifications.cancelScheduledNotificationAsync(id))
      );
    }
    await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
  } catch (e) {
    console.error('cancelAllWaterNotifications error:', e);
  }
}

// ─── Save ID ──────────────────────────────────────────────
async function saveNotificationId(id: string) {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    ids.push(id);
    await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('saveNotificationId error:', e);
  }
}

// ─── Build trigger ────────────────────────────────────────
// channelId is only valid on Android — omit on iOS
function intervalTrigger(seconds: number) {
  const base: any = {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    repeats: false,
  };
  if (Platform.OS === 'android') base.channelId = CHANNEL_ID;
  return base;
}

function dailyTrigger(hour: number, minute: number) {
  const base: any = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
  if (Platform.OS === 'android') base.channelId = CHANNEL_ID;
  return base;
}

// ─── Schedule post-drink reminder (1 hour later) ──────────
export async function schedulePostDrinkReminder() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await AsyncStorage.setItem(LAST_DRINK_KEY, Date.now().toString());
  await cancelAllWaterNotifications();

  const messages = [
    { title: '💧 Time to Hydrate!',  body: "It's been an hour — grab a glass of water!" },
    { title: '🚰 Water Break!',       body: 'Your body needs water. Take a sip now!'      },
    { title: '💧 Stay Hydrated!',     body: "Don't forget to drink water. You're doing great!" },
    { title: '🥤 Hydration Check!',   body: 'One hour passed — time for another glass!'  },
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body:  msg.body,
        sound: true,
        data:  { type: 'water_reminder' },
      },
      trigger: intervalTrigger(60 * 60),
    });
    await saveNotificationId(id);
    console.log('💧 Post-drink reminder scheduled for 1 hour later');
  } catch (e) {
    console.error('schedulePostDrinkReminder error:', e);
  }
}

// ─── Schedule morning reminders ───────────────────────────
export async function scheduleMorningReminders() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const slots = [
    { hour: 8,  minute: 0,  title: '🌅 Good Morning!',     body: "Start your day right — drink a glass of water!"   },
    { hour: 9,  minute: 30, title: '☀️ Morning Hydration', body: "You haven't had water yet today. Time to hydrate!" },
    { hour: 11, minute: 0,  title: '⏰ Still thirsty?',     body: "It's almost noon and no water logged. Drink up!"  },
  ];

  const now = new Date();

  for (const slot of slots) {
    const triggerTime = new Date();
    triggerTime.setHours(slot.hour, slot.minute, 0, 0);
    if (triggerTime <= now) continue;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: slot.title,
          body:  slot.body,
          sound: true,
          data:  { type: 'morning_water_reminder' },
        },
        trigger: dailyTrigger(slot.hour, slot.minute),
      });
      await saveNotificationId(id);
      console.log(`💧 Morning reminder set for ${slot.hour}:${String(slot.minute).padStart(2, '0')}`);
    } catch (e) {
      console.error(`scheduleMorningReminders error at ${slot.hour}:${slot.minute}:`, e);
    }
  }
}

// ─── Schedule daily reminders throughout the day ──────────
export async function scheduleDailyWaterReminders() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelAllWaterNotifications();

  const slots = [
    { hour: 8,  minute: 0,  body: "Start your day with a glass of water! 🌅" },
    { hour: 10, minute: 0,  body: "Mid-morning hydration check! 💧"           },
    { hour: 12, minute: 0,  body: "Lunchtime — don't forget your water! 🥤"  },
    { hour: 14, minute: 0,  body: "Afternoon slump? Water helps! ⚡"          },
    { hour: 16, minute: 0,  body: "Keep going — hydration fuels you! 💪"     },
    { hour: 18, minute: 0,  body: "Evening reminder — drink some water! 🌇"  },
    { hour: 20, minute: 0,  body: "Last call for water before bed! 🌙"        },
  ];

  for (const slot of slots) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Hydration Reminder',
          body:  slot.body,
          sound: true,
          data:  { type: 'daily_water_reminder' },
        },
        trigger: dailyTrigger(slot.hour, slot.minute),
      });
      await saveNotificationId(id);
      console.log(`💧 Daily reminder set for ${slot.hour}:00`);
    } catch (e) {
      console.error(`scheduleDailyWaterReminders error at ${slot.hour}:00:`, e);
    }
  }

  console.log('💧 All daily water reminders scheduled');
}

// ─── Late morning no-drink check ─────────────────────────
export async function checkLateAndNoDrink(currentMl: number) {
  const hour = new Date().getHours();
  if (!(hour >= 10 && hour < 13 && currentMl === 0)) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '😅 No water yet today?',
        body:  "It's getting late in the morning — hydrate now!",
        sound: true,
        data:  { type: 'late_morning_reminder' },
      },
      trigger: intervalTrigger(5),
    });
    await saveNotificationId(id);
    console.log('💧 Late morning reminder fired');
  } catch (e) {
    console.error('checkLateAndNoDrink error:', e);
  }
}