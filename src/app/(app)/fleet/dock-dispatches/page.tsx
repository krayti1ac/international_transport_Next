import React from 'react';
import type { Metadata } from 'next';
import { fetchDockArrivalsAuditAction } from '@/features/tracking/services/dock-dispatch-audit.actions';
import { DockArrivalsAuditView } from '@/features/tracking/components/DockArrivalsAuditView';

export const metadata: Metadata = {
  title: 'سجل وصول الأرصفة وبث الشهادات التلقائي | Trans Bodanon TMS',
  description: 'مراقبة حية لوصول شاحنات التبريد للأرصفة وسجلات الإرسال التلقائي لشهادات الحجرات للمستلمين عبر WhatsApp',
};

export default async function DockDispatchesPage() {
  const auditRes = await fetchDockArrivalsAuditAction({ limit: 50 });

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      <DockArrivalsAuditView
        initialItems={auditRes.items}
        initialStats={auditRes.stats}
      />
    </div>
  );
}

