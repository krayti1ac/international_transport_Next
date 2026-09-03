import {create} from 'zustand';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  language: 'ar' | 'fr' | 'en';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: 'ar' | 'fr' | 'en') => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'system',
  language: 'ar',
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_theme_mode', theme);
    }
  },
  setLanguage: (language) => set({ language }),
}));
