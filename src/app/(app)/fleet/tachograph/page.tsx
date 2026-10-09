import { Suspense } from 'react';
import { getFleetComplianceRadarAction } from '@/features/fleet/services/tachograph.actions';
import { TachographComplianceRadarView } from '@/features/fleet/components/TachographComplianceRadarView';
import { TachographComplianceEngine } from '@/features/fleet/services/tachograph-compliance.service';

export const metadata = {
  title: 'رادار التاكوغراف وامتثال EC 561/2006 | Trans Bodanon TMS',
  description: 'المراقبة الفورية لأزمنة القيادة والراحة الإلزامية وسقوف العمليات الأوروبية للأسطول الدولي',
};

export default async function FleetTachographPage() {
  const initialData = await getFleetComplianceRadarAction();
  const summary = initialData.success && initialData.summary
    ? initialData.summary
    : TachographComplianceEngine.summarizeFleetCompliance([]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <Suspense
        fallback={
          <div className="p-12 text-center text-muted-foreground animate-pulse font-mono text-sm">
            جاري تحميل رادار الامتثال الأوروبي للتاكوغراف... / Loading Tachograph Radar...
          </div>
        }
      >
        <TachographComplianceRadarView initialSummary={summary} />
      </Suspense>
    </div>
  );
}

