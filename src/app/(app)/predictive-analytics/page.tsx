import type { Metadata } from 'next';
import { PredictiveInsightsView } from '@/features/analytics/components/PredictiveInsightsView';

export const metadata: Metadata = {
  title: 'التحليلات التنبؤية للنمو والأداء | Trans Bodanon TMS',
  description: 'لوحة استشراف النمو السنوي وموازنة الفروع الدولية وإدارة مخاطر الصيانة للعبور الدولي',
};

export default function PredictiveAnalyticsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <PredictiveInsightsView />
    </div>
  );
}

