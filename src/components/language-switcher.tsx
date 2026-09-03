'use client';

import { useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';

const LOCALES = [
  { code: 'ar', label: 'العربية', short: 'AR' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as LocaleCode;
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: LocaleCode) => {
    if (next === currentLocale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/40">
      <Languages className={`w-4 h-4 mx-1 text-muted-foreground ${isPending ? 'animate-pulse' : ''}`} />
      {LOCALES.map((l) => {
        const active = l.code === currentLocale;
        return (
          <button
            key={l.code}
            type="button"
            disabled={isPending}
            onClick={() => handleChange(l.code)}
            className={`px-2.5 h-7 text-xs font-semibold rounded-lg transition-colors ${
              active
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            } disabled:opacity-50`}
            aria-pressed={active}
            aria-label={`Switch language to ${l.label}`}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}