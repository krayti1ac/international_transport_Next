'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');

  const applyTheme = (currentTheme: Theme) => {
    if (typeof window === 'undefined') return;
    const isDark =
      currentTheme === 'dark' ||
      (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('app_theme_mode') as Theme | null;
      const initialTheme = stored || 'system';
      setThemeState(initialTheme);
      applyTheme(initialTheme);
    } catch (e) {}

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      try {
        const stored = localStorage.getItem('app_theme_mode') as Theme | null;
        if (!stored || stored === 'system') {
          applyTheme('system');
        }
      } catch (e) {}
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('app_theme_mode', newTheme);
      applyTheme(newTheme);
    } catch (e) {}
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'system' as Theme,
      setTheme: () => {},
    };
  }
  return context;
}
