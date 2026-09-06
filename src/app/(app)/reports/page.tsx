import { Suspense } from 'react';
import ComprehensiveReports from '@/features/analytics/components/ComprehensiveReports';
import { DashboardSkeleton } from '@/components/skeletons';

export const metadata = {
  title: 'مركز التقارير الشاملة والتحليلات | Trans Bodanon',
  description: 'تقارير تفصيلية شاملة لحركة الرحلات الدولية، الفواتير، الأسطول ومستحقات السائقين.',
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ComprehensiveReports />
    </Suspense>
  );
}
