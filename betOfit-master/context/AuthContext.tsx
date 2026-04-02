// context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Wait for Firebase to initialize
      const app = getApp();
      
      // Listen to auth state changes
      const unsubscribe = auth().onAuthStateChanged((user) => {
        setUser(user);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);