import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, AppColors } from '../constants/Colors';

type ThemeContextValue = {
  isDark: boolean;
  colors: AppColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

const STORAGE_KEY = '@activistem_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => { if (val === 'light') setIsDark(false); })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;
