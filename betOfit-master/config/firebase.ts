// config/firebase.ts
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// 🔥 Your Firebase configuration (from Step 3)
// Find these values in your Firebase Console → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: "AIzaSyCfwkOXwC5kIOG3wLrDxc4uEYGcJRC2lIg",
  authDomain: "betofit-8dfed.firebaseapp.com",
  projectId: "betofit-8dfed",
  storageBucket: "betofit-8dfed.firebasestorage.app",
  messagingSenderId: "238538464081",
  appId: "1:238538464081:web:b23b6e58ef954668941170"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence (keeps user logged in)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Configure Google Sign-In with your Web Client ID from Step 1
GoogleSignin.configure({
  webClientId: '238538464081-gaojghq418anfbkllbg7uufeoqjf71a6.apps.googleusercontent.com', // ← FROM STEP 1
  offlineAccess: true,
});

// Sign-in function
export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    return userInfo;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

// Sign-out function
export const signOut = async () => {
  try {
    await GoogleSignin.signOut();
    await auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }
};

export { auth };
export default app;