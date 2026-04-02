import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '../../config/firebase';

export async function getUserId(): Promise<string> {
  // Try Firebase first
  const firebaseUid = getCurrentUserId();
  if (firebaseUid) {
    console.log('✅ Using Firebase UID:', firebaseUid);
    return firebaseUid;
  }
  
  // Try AsyncStorage (for signed-in users)
  const savedUid = await AsyncStorage.getItem('FIREBASE_USER_ID');
  if (savedUid) {
    console.log('✅ Using saved UID:', savedUid);
    return savedUid;
  }
  
  // Fallback to mock user (shouldn't happen in production)
  console.warn('⚠️ No Firebase UID found, using mock');
  return 'dev_user_001';
}

export async function getCurrentUser() {
  const userId = await getUserId();
  const email = await AsyncStorage.getItem('FIREBASE_USER_EMAIL');
  const name = await AsyncStorage.getItem('FIREBASE_USER_NAME');
  
  return {
    userId,
    email: email || 'user@betofit.com',
    name: name || 'User',
  };
}

export async function isLoggedIn(): Promise<boolean> {
  const userId = await getUserId();
  return userId !== 'dev_user_001';
}