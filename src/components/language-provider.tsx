'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Locale = 'ar' | 'fr';

interface LanguageContextType {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  setLocale: (newLocale: Locale, userKey?: string) => Promise<void>;
  t: (ar: string, fr: string) => string;
  getUserPreferredLanguage: (userKey: string) => Locale | null;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  const applyDomLocale = (loc: Locale) => {
    if (typeof window === 'undefined') return;
    document.documentElement.lang = loc;
    document.documentElement.dir = loc === 'ar' ? 'rtl' : 'ltr';
  };

  const getUserPreferredLanguage = useCallback((userKey: string): Locale | null => {
    if (typeof window === 'undefined' || !userKey) return null;
    try {
      const stored = localStorage.getItem(`user_lang_${userKey.trim().toLowerCase()}`);
      if (stored === 'ar' || stored === 'fr') {
        return stored as Locale;
      }
    } catch (e) {}
    return null;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // 1. Check if there is a saved email and its corresponding preference
      const savedEmail = localStorage.getItem('saved_login_email');
      let initialLocale: Locale | null = null;

      if (savedEmail) {
        initialLocale = getUserPreferredLanguage(savedEmail);
      }

      // 2. If not found, check global app_locale or cookie
      if (!initialLocale) {
        const storedGlobal = localStorage.getItem('app_locale') as Locale | null;
        if (storedGlobal === 'ar' || storedGlobal === 'fr') {
          initialLocale = storedGlobal;
        }
      }

      const active = initialLocale || 'ar';
      setLocaleState(active);
      applyDomLocale(active);
    } catch (e) {}

    const handleExternalChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale: Locale }>;
      if (customEvent.detail?.locale) {
        setLocaleState(customEvent.detail.locale);
        applyDomLocale(customEvent.detail.locale);
      }
    };

    window.addEventListener('app-language-changed', handleExternalChange);
    return () => window.removeEventListener('app-language-changed', handleExternalChange);
  }, [getUserPreferredLanguage]);

  const setLocale = useCallback(async (newLocale: Locale, userKey?: string) => {
    setLocaleState(newLocale);
    applyDomLocale(newLocale);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('app_locale', newLocale);
        document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

        if (userKey) {
          localStorage.setItem(`user_lang_${userKey.trim().toLowerCase()}`, newLocale);
        }

        window.dispatchEvent(
          new CustomEvent('app-language-changed', { detail: { locale: newLocale } })
        );
      } catch (e) {}

      // Try updating in Supabase users table if user is logged in
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = userKey || session?.user?.id;
        if (currentUserId) {
          await supabase
            .from('users')
            .update({ preferred_language: newLocale })
            .eq('id', currentUserId);
        }
        if (session?.user?.email) {
          localStorage.setItem(`user_lang_${session.user.email.trim().toLowerCase()}`, newLocale);
        }
        if (session?.user?.id) {
          localStorage.setItem(`user_lang_${session.user.id.trim().toLowerCase()}`, newLocale);
        }
      } catch (err) {
        console.warn('Could not sync preferred_language to database:', err);
      }
    }
  }, []);

  const t = useCallback((ar: string, fr: string): string => {
    return locale === 'fr' ? fr : ar;
  }, [locale]);

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ locale, dir, setLocale, t, getUserPreferredLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      locale: 'ar' as Locale,
      dir: 'rtl' as const,
      setLocale: async () => {},
      t: (ar: string, _fr: string) => ar,
      getUserPreferredLanguage: () => null,
    };
  }
  return context;
}
