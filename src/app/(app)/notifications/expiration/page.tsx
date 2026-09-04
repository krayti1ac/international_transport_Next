import { Suspense } from 'react';
import { ExpirationAlertsView } from '@/features/notifications/components/ExpirationAlertsView';

export const instant = false;

export const metadata = {
  title: 'تنبيهات الانتهاء | نظام النقل الدولي',
  description: 'تأشيرات السائقين ووثائق الأسطول القريبة من الانتهاء',
};

export default function ExpirationAlertsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse font-mono text-sm">جاري تحميل تنبيهات الانتهاء...</div>}>
      <ExpirationAlertsView />
    </Suspense>
  );
}