import type { Metadata } from 'next';
import { FleetUtilizationView } from '@/features/fleet-utilization/components/FleetUtilizationView';

export const metadata: Metadata = {
  title: 'تحليل استخدام الأسطول | Trans Bodanon TMS',
  description: 'تقرير نسبة استفادة الشاحنات والمقطورات والسائقين مع توصيات ذكية لتحسين الاستخدام',
};

export default function FleetUtilizationPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <FleetUtilizationView />
    </div>
  );
}
