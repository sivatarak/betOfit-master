// context/ThemeContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your color palette
export const colors = {
  light: {
    primary: '#fd7505',
    secondary: '#ffc30a',
    accent: '#f7e1a0',
    background: '#FFFFFF',
    card: '#F8F6F5',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  },
  dark: {
    primary: '#fd7505',
    secondary: '#ffc30a',
    accent: '#f7e1a0',
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    border: '#2A2A2A',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  },
};

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  colors: typeof colors.light;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>(systemColorScheme || 'light');

  useEffect(() => {
    // Update theme when system theme changes
    setTheme(systemColorScheme || 'light');
  }, [systemColorScheme]);

  const themeColors = colors[theme];

  return (
    <ThemeContext.Provider value={{ theme, colors: themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};