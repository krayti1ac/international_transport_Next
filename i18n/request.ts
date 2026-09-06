import { notFound } from 'next/navigation';
import { routing } from './routing';

export async function getRequestConfig(request: Request) {
  const { locale } = await request;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
}
