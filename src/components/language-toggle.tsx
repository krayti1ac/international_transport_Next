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
      className={`h-9 inline-flex items-center gap-0.5 p-1 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/60 shadow-2xs backdrop-blur-xs select-none transition-colors ${className}`}
      dir="ltr"
    >
      {showIcon && (
        <div className="ps-1 pe-0.5 text-muted-foreground flex items-center justify-center">
          <Globe className="w-3.5 h-3.5 text-muted-foreground/80" />
        </div>
      )}
      <button
        type="button"
        onClick={() => handleSelect('ar')}
        className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
          locale === 'ar'
            ? 'bg-background text-foreground shadow-xs font-bold border border-border/50'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
        }`}
        aria-pressed={locale === 'ar'}
        title="العربية (Arabic)"
      >
        AR
      </button>
      <button
        type="button"
        onClick={() => handleSelect('fr')}
        className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
          locale === 'fr'
            ? 'bg-background text-foreground shadow-xs font-bold border border-border/50'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
        }`}
        aria-pressed={locale === 'fr'}
        title="Français (French)"
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => handleSelect('en')}
        className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
          locale === 'en'
            ? 'bg-background text-foreground shadow-xs font-bold border border-border/50'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
        }`}
        aria-pressed={locale === 'en'}
        title="English"
      >
        EN
      </button>
    </div>
  );
}

