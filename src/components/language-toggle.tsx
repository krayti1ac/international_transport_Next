'use client';

import React from 'react';
import { useLanguage, type Locale } from '@/components/language-provider';
import { Globe } from 'lucide-react';

interface LanguageToggleProps {
  userKey?: string;
  className?: string;
  showIcon?: boolean;
}

export function LanguageToggle({ userKey, className = '', showIcon = true }: LanguageToggleProps) {
  const { locale, setLocale } = useLanguage();

  const handleSelect = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setLocale(nextLocale, userKey);
  };

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-xl bg-muted/70 dark:bg-slate-900/80 border border-border/80 dark:border-slate-800 shadow-2xs backdrop-blur-xs select-none ${className}`}
      dir="ltr"
    >
      {showIcon && (
        <div className="px-1 text-muted-foreground flex items-center justify-center">
          <Globe className="w-3.5 h-3.5 text-sky-500" />
        </div>
      )}
      <button
        type="button"
        onClick={() => handleSelect('ar')}
        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
          locale === 'ar'
            ? 'bg-sky-500 text-slate-950 shadow-xs font-extrabold scale-100'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/60 dark:hover:bg-slate-800/60'
        }`}
        aria-pressed={locale === 'ar'}
        title="العربية (Arabic)"
      >
        AR
      </button>
      <button
        type="button"
        onClick={() => handleSelect('fr')}
        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
          locale === 'fr'
            ? 'bg-sky-500 text-slate-950 shadow-xs font-extrabold scale-100'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/60 dark:hover:bg-slate-800/60'
        }`}
        aria-pressed={locale === 'fr'}
        title="Français (French)"
      >
        FR
      </button>
    </div>
  );
}
