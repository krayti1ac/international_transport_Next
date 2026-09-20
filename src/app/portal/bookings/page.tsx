import { Suspense } from 'react';
import { CustomerPortalView } from '@/features/portal/components/CustomerPortalView';

export const metadata = {
  title: 'طلبات الحجز الذاتية | Trans Bodanon TMS',
  description: 'بوابة العملاء المصدرين - تقديم ومتابعة طلبات حجز الشاحنات الدولية',
};

export default async function PortalBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ice?: string; client_id?: string; cmr?: string }>;
}) {
  const resolvedParams = await searchParams;
  const clientId = resolvedParams.client_id ? parseInt(resolvedParams.client_id, 10) : undefined;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14]">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CustomerPortalView
        initialIce={resolvedParams.ice}
        initialClientId={clientId}
        initialCmr={resolvedParams.cmr}
        initialTab="bookings"
      />
    </Suspense>
  );
}

