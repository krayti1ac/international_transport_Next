import React from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import {
  getCircuitDiagnosticsLogsAction,
  getPredictiveLeakIncidentsAction,
  getRefrigerantRadarSummaryAction,
} from '@/features/tracking/services/refrigerant-radar.actions';
import { RefrigerantPressureRadarView } from '@/features/tracking/components/RefrigerantPressureRadarView';
import type { RefrigerantRadarSummary } from '@/features/tracking/types/refrigerant-radar.types';

export const metadata: Metadata = {
  title: 'رادار تسريب غاز التبريد وأعطال الصمام التمددي | Trans Bodanon TMS',
  description: 'المراقبة الثرموديناميكية لضغوط الشفط والطرد واكتشاف تسريب الفريون الاستباقي لشاحنات التبريد الدولي Frigo',
};

export default async function ReeferRefrigerantRadarPage() {
  const supabase = await createClient();

  const [summaryRes, logsRes, incidentsRes, { data: trailers }] = await Promise.all([
    getRefrigerantRadarSummaryAction(),
    getCircuitDiagnosticsLogsAction(),
    getPredictiveLeakIncidentsAction(),
    supabase.from('trailers').select('id, plate_number').order('plate_number'),
  ]);

  const defaultSummary: RefrigerantRadarSummary = {
    totalMonitoredReefers: trailers?.length || 0,
    healthyCircuitsCount: trailers?.length || 0,
    activeLeakIncidentsCount: 0,
    txvAnomaliesCount: 0,
    criticalRiskTrailersCount: 0,
    averageFleetRefrigerantChargePct: 100,
    fleetThermodynamicHealthRate: 100,
  };

  const trailersList = (trailers || []).map((t: any) => ({
    id: t.id,
    plateNumber: t.plate_number || `REM-${t.id}`,
  }));

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <RefrigerantPressureRadarView
        initialSummary={summaryRes.data || defaultSummary}
        initialLogs={logsRes.data || []}
        initialIncidents={incidentsRes.data || []}
        trailersList={trailersList}
      />
    </div>
  );
}

