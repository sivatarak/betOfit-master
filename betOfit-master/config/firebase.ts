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

type GoogleSignInOptions = {
  forceAccountChooser?: boolean;
  expectedEmail?: string;
};

export const signInWithGoogle = async (options: GoogleSignInOptions = {}) => {
  try {
    // Ensure Google Play Services is available
    await GoogleSignin.hasPlayServices();

    if (options.forceAccountChooser) {
      await GoogleSignin.signOut();
    }

    let googleUserInfo;
    if (options.expectedEmail) {
      const silentResponse = await GoogleSignin.signInSilently();
      if (silentResponse.type !== 'success') {
        throw new Error('No saved Google session is available. Use Continue with Google to select your account again.');
      }
      googleUserInfo = silentResponse.data;
    } else {
      const interactiveResponse = await GoogleSignin.signIn();
      if (interactiveResponse.type === 'cancelled') return null;
      googleUserInfo = interactiveResponse.data;
    }

    const selectedEmail = googleUserInfo.user.email;
    if (options.expectedEmail && selectedEmail?.toLowerCase() !== options.expectedEmail.toLowerCase()) {
      await GoogleSignin.signOut();
      throw new Error(`The saved Google session is not ${options.expectedEmail}. Use Continue with Google to select that account.`);
    }

    const idToken = googleUserInfo.idToken || (await GoogleSignin.getTokens()).idToken;
    
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