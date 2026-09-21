import type { Metadata } from 'next';
import { PredictiveDashboardView } from '@/features/predictive/components/PredictiveDashboardView';

export const metadata: Metadata = {
  title: 'محرك النماذج التنبؤية للأسطول والتدفقات النقدية | Trans Bodanon TMS',
  description: 'رادار الصيانة التنبؤية للأصول ومبردات Frigo واستشراف السيولة النقدية وسرعة سداد المصدرين',
};

export default function PredictiveAnalyticsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <PredictiveDashboardView />
    </div>
  );
}
