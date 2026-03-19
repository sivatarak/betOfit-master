// hooks/useAuth.ts
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type User = { id: string; name: string } | null;

export function useAuth() {
  const [user, setUser] = useState<User>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [userJson, onboardingDone] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("hasCompletedOnboarding"),
        ]);

        if (userJson) setUser(JSON.parse(userJson));
        if (onboardingDone === "true") setHasCompletedOnboarding(true);
      } catch (e) {
        console.warn(e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const login = async (userData: User) => {
    await AsyncStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem("hasCompletedOnboarding", "true");
    setHasCompletedOnboarding(true);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["user", "hasCompletedOnboarding"]);
    setUser(null);
    setHasCompletedOnboarding(false);
  };

  return {
    user,
    isLoading,
    hasCompletedOnboarding,
    login,
    completeOnboarding,
    logout,
  };
}