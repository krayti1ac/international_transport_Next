import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['ar', 'fr', 'es'],
  defaultLocale: 'ar',
  localePrefix: 'as-needed',
});

export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);
