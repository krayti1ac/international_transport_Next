import {getRequestConfig} from 'next-intl/server';
import {routing} from '@/i18n/routing';

export default getRequestConfig(async ({locale}) => {
  const resolvedLocale = locale || routing.defaultLocale;

  return {
    messages: (await import(`@/i18n/messages/${resolvedLocale}.json`)).default,
    locale: resolvedLocale,
  };
});
