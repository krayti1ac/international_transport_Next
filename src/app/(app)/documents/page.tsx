import { Suspense } from 'react';
import { FleetDocumentsDashboard } from '@/features/fleet/components/FleetDocumentsDashboard';

export const instant = false;

export const metadata = {
  title: 'وثائق الأسطول والتجديد | Trans Bodanon',
  description: 'إدارة وتتبع وثائق الشاحنات والمقطورات والتجديد السريع المرتبط بالخزينة',
};

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse font-mono text-sm">جاري تحميل وثائق الأسطول...</div>}>
      <FleetDocumentsDashboard />
    </Suspense>
  );
}
