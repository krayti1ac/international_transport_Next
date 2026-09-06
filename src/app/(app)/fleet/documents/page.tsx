import { Suspense } from 'react';
import { FleetDocumentsDashboard } from '@/features/fleet/components/FleetDocumentsDashboard';

export const metadata = {
  title: 'مصفوفة وثائق الأسطول والتجديد | Trans Bodanon',
  description: 'إدارة وتتبع وثائق الشاحنات والمقطورات والتجديد السريع المرتبط بالخزينة',
};

export default function FleetDocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse font-mono text-sm">Loading... / جاري التحميل...</div>}>
      <FleetDocumentsDashboard />
    </Suspense>
  );
}

