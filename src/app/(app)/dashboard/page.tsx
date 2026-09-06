import { Suspense } from 'react';
import GeneralDashboard from '@/features/analytics/components/GeneralDashboard';
import { DashboardSkeleton } from '@/components/skeletons';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <GeneralDashboard />
    </Suspense>
  );
}

