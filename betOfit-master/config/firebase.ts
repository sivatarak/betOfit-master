// config/firebase.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { initializeApp, getApps } from '@react-native-firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyCfwkOXwC5kIOG3wLrDxc4uEYGcJRC2lIg",
  authDomain: "betofit-8dfed.firebaseapp.com",
  projectId: "betofit-8dfed",
  storageBucket: "betofit-8dfed.firebasestorage.app",
  messagingSenderId: "238538464081",
  appId: "1:238538464081:web:b23b6e58ef954668941170",
  databaseURL: "https://dummy.firebaseio.com",
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

// Configure Google Sign-In with your Web Client ID
GoogleSignin.configure({
  webClientId:'238538464081-gaojghq418anfbkllbg7uufeoqjf71a6.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['profile', 'email'],
});

export const signInWithGoogle = async () => {
  try {
    // Ensure Google Play Services is available
    await GoogleSignin.hasPlayServices();
    
    // Sign in and get user info
    const userInfo = await GoogleSignin.signIn();
    console.log('User info:', userInfo);
    
    // Get the idToken - THIS IS CRITICAL
    const { idToken } = await GoogleSignin.getTokens();
    
    if (!idToken) {
      throw new Error('No idToken received from Google Sign-In');
    }
    
    // Create credential and sign in to Firebase
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(googleCredential);
    
    console.log('✅ Signed in:', userCredential.user.email);
    return userCredential.user;
  } catch (error) {
    console.error('❌ Sign-in error:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await GoogleSignin.signOut();
    await auth().signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }
};
export function getCurrentUserId() {
  return auth().currentUser?.uid || null;
}

export function getCurrentUser() {
  return auth().currentUser;
}

export { auth };