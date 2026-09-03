import {routing} from '@/i18n/routing';
import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

export function generateStaticParams() {
  return routing.locales.map(locale => ({locale}));
}

export const metadata = {
  title: 'Trans Bodanon - International Transport',
  description: 'International Transport and Logistics Management System',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const isRTL = locale === 'ar';

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-full flex flex-col flex-1">
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
