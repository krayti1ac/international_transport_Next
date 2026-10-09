import React from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import {
  getCrossBulkheadAlertsAction,
  getMultiTempMatrixSummaryAction,
} from '@/features/tracking/services/multi-temp.actions';
import { MultiTempCompartmentMatrixView } from '@/features/tracking/components/MultiTempCompartmentMatrixView';
import type { MultiTempTrailerMatrixSummary } from '@/features/tracking/types/multi-temp.types';

export const metadata: Metadata = {
  title: 'التوزيع متعدد الحجرات والمبخرات المستقلة Multi-Temp | Trans Bodanon TMS',
  description: 'المراقبة المستقلة للحجرات المجزأة بحواجز عازلة متحركة ومبخرات مستقلة لشاحنات التبريد الدولي Frigo',
};

export default async function ReeferMultiTempPage() {
  const supabase = await createClient();

  const { data: trailers } = await supabase
    .from('trailers')
    .select('id, plate_number')
    .order('plate_number');

  const trailersList = (trailers || []).map((t: any) => ({
    id: t.id,
    plateNumber: t.plate_number || `REM-${t.id}`,
  }));

  const activeTrailerId = trailersList.length > 0 ? trailersList[0].id : 1;
  const activeTrailerPlate = trailersList.length > 0 ? trailersList[0].plateNumber : 'REM-101';

  const [summaryRes, alertsRes] = await Promise.all([
    getMultiTempMatrixSummaryAction(activeTrailerId),
    getCrossBulkheadAlertsAction(activeTrailerId),
  ]);

  const defaultSummary: MultiTempTrailerMatrixSummary = {
    trailerId: activeTrailerId,
    trailerPlate: activeTrailerPlate,
    configurationType: 'bi_temp',
    totalCompartments: 2,
    compartments: [
      {
        profile: {
          id: 'comp-1',
          companyId: 1,
          trailerId: activeTrailerId,
          configurationType: 'bi_temp',
          compartmentCode: 'C1',
          compartmentName: 'Front Deep-Freeze',
          cargoCategory: 'deep_frozen',
          setpointTempC: -20.0,
          minTempLimitC: -25.0,
          maxTempLimitC: -18.0,
          hasSideDoor: false,
          hasRearDoor: false,
          bulkheadPositionPct: 50,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        latestLog: {
          id: 'log-1',
          companyId: 1,
          compartmentId: 'comp-1',
          trailerId: activeTrailerId,
          supplyAirTempC: -22.5,
          returnAirTempC: -19.8,
          cargoProbeTempC: -20.1,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        mktAudit: {
          compartmentCode: 'C1',
          compartmentName: 'Front Deep-Freeze',
          cargoCategory: 'deep_frozen',
          setpointTempC: -20.0,
          mktTempC: -19.8,
          avgSupplyAirTempC: -22.5,
          avgReturnAirTempC: -19.8,
          excursionMinutes: 0,
          doorOpenCount: 0,
          isCompliant: true,
          status: 'compliant',
        },
      },
      {
        profile: {
          id: 'comp-2',
          companyId: 1,
          trailerId: activeTrailerId,
          configurationType: 'bi_temp',
          compartmentCode: 'C2',
          compartmentName: 'Rear Chilled & Fresh',
          cargoCategory: 'fresh_produce',
          setpointTempC: 4.0,
          minTempLimitC: 2.0,
          maxTempLimitC: 6.0,
          hasSideDoor: true,
          hasRearDoor: true,
          bulkheadPositionPct: 50,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        latestLog: {
          id: 'log-2',
          companyId: 1,
          compartmentId: 'comp-2',
          trailerId: activeTrailerId,
          supplyAirTempC: 2.8,
          returnAirTempC: 4.2,
          cargoProbeTempC: 3.9,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        mktAudit: {
          compartmentCode: 'C2',
          compartmentName: 'Rear Chilled & Fresh',
          cargoCategory: 'fresh_produce',
          setpointTempC: 4.0,
          mktTempC: 4.1,
          avgSupplyAirTempC: 2.8,
          avgReturnAirTempC: 4.2,
          excursionMinutes: 0,
          doorOpenCount: 0,
          isCompliant: true,
          status: 'compliant',
        },
      },
    ],
    bulkheadIntegrityScore: 100,
    activeBulkheadAlertsCount: 0,
    overallStatus: 'optimal',
  };

  const finalSummary =
    summaryRes.success && summaryRes.data && summaryRes.data.compartments.length > 0
      ? summaryRes.data
      : defaultSummary;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <MultiTempCompartmentMatrixView
        initialSummary={finalSummary}
        initialAlerts={alertsRes.data || []}
        trailersList={trailersList}
        currentTrailerId={activeTrailerId}
      />
    </div>
  );
}

