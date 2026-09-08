import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'light' | 'dark' | 'system';
export type AppLanguage = 'ar' | 'fr' | 'en';

export interface AppState {
  theme: AppTheme;
  language: AppLanguage;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (language: AppLanguage) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'ar',
      setTheme: (theme) => {
        set({ theme });
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_theme_mode', theme);
        }
      },
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'app-storage',
    }
  )
);
