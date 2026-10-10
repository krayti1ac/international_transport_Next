import React from 'react';
import type { Metadata } from 'next';
import { fetchDockRiskClustersAction } from '@/features/tracking/services/dock-risk.actions';
import { DockThermalHeatmapView } from '@/features/tracking/components/DockThermalHeatmapView';

export const metadata: Metadata = {
  title: 'خريطة ورادار مخاطر التبريد في الأرصفة | Trans Bodanon TMS',
  description: 'رصد بؤر الانحرافات الحرارية، تقييم مؤشر هشاشة الأرصفة (DVI)، والبروتوكولات الوقائية في الموانئ والمستودعات الدولية',
};

export default async function DockHeatmapPage() {
  const res = await fetchDockRiskClustersAction();

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      <DockThermalHeatmapView
        initialClusters={res.clusters}
        initialSummary={res.summary}
      />
    </div>
  );
}

