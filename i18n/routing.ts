import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ar', 'fr', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];
