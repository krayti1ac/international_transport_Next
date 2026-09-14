'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SPANISH_DICTIONARY } from '@/i18n/dictionary';

export type Locale = 'ar' | 'fr' | 'es';

interface LanguageContextType {
  locale: Locale;
  localeCode: 'ar-MA' | 'fr-FR' | 'es-ES';
  dir: 'rtl' | 'ltr';
  setLocale: (newLocale: Locale, userKey?: string) => Promise<void>;
  t: (ar: string, fr: string, es?: string) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
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
      if (stored === 'ar' || stored === 'fr' || stored === 'es') {
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
        if (storedGlobal === 'ar' || storedGlobal === 'fr' || storedGlobal === 'es') {
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

      // Update in Supabase users table if user is logged in with valid UUID
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const userEmail = session?.user?.email;

        if (userId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId.trim());
          if (isUuid) {
            await supabase
              .from('users')
              .update({ preferred_language: newLocale })
              .eq('id', userId);
          }
          if (userEmail) {
            localStorage.setItem(`user_lang_${userEmail.trim().toLowerCase()}`, newLocale);
          }
          localStorage.setItem(`user_lang_${userId.trim().toLowerCase()}`, newLocale);
        }
      } catch (err) {
        console.warn('Could not sync preferred_language to database:', err);
      }
    }
  }, []);

  const t = useCallback((ar: string, fr: string, es?: string): string => {
    if (locale === 'fr') return fr;
    if (locale === 'es') {
      if (es && !/^(general dashboard|manage trips|total trips|active trips|refresh|in transit|in progress|completed|delivered|loaded|pending|cancelled)$/i.test(es.trim())) {
        return es;
      }
      const trimmedAr = ar?.trim();
      if (trimmedAr && SPANISH_DICTIONARY[trimmedAr]) return SPANISH_DICTIONARY[trimmedAr];
      const trimmedFr = fr?.trim();
      if (trimmedFr && SPANISH_DICTIONARY[trimmedFr]) return SPANISH_DICTIONARY[trimmedFr];
      const trimmedFrLower = fr?.trim()?.toLowerCase();
      if (trimmedFrLower && SPANISH_DICTIONARY[trimmedFrLower]) return SPANISH_DICTIONARY[trimmedFrLower];
      return es || fr || ar;
    }
    return ar;
  }, [locale]);

  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const localeCode: 'ar-MA' | 'fr-FR' | 'es-ES' = locale === 'ar' ? 'ar-MA' : locale === 'es' ? 'es-ES' : 'fr-FR';

  const formatDate = useCallback((date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
    try {
      const d = typeof date === 'object' ? date : new Date(date);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(localeCode, options);
    } catch {
      return '';
    }
  }, [localeCode]);

  const formatNumber = useCallback((num: number, options?: Intl.NumberFormatOptions): string => {
    try {
      return num.toLocaleString(localeCode, options);
    } catch {
      return String(num);
    }
  }, [localeCode]);

  return (
    <LanguageContext.Provider value={{ locale, localeCode, dir, setLocale, t, formatDate, formatNumber, getUserPreferredLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      locale: 'ar' as Locale,
      localeCode: 'ar-MA' as const,
      dir: 'rtl' as const,
      setLocale: async () => {},
      t: (ar: string, _fr: string, es?: string) => es || ar,
      formatDate: (d: Date | string | number) => String(d),
      formatNumber: (n: number) => String(n),
      getUserPreferredLanguage: () => null,
    };
  }
  return context;
}

