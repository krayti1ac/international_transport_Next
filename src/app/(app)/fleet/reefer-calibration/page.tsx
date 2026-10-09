import React from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import {
  getAtpCertificationsAction,
  getReeferCalibrationRadarSummaryAction,
  getSensorCalibrationLogsAction,
} from '@/features/tracking/services/reefer-calibration.actions';
import { ReeferCalibrationRadarView } from '@/features/tracking/components/ReeferCalibrationRadarView';
import type { ReeferCalibrationRadarSummary } from '@/features/tracking/types/reefer-calibration.types';

export const metadata: Metadata = {
  title: 'رادار معايرة الحساسات وتجديد شهادات ميثاق ATP | Trans Bodanon TMS',
  description: 'إدارة الامتثال القانوني لميثاق ATP ومعايرة مسجلات درجات الحرارة EN 12830 لشاحنات التبريد الدولي Frigo',
};

export default async function ReeferCalibrationPage() {
  const supabase = await createClient();

  const [summaryRes, certsRes, logsRes, { data: trailers }] = await Promise.all([
    getReeferCalibrationRadarSummaryAction(),
    getAtpCertificationsAction(),
    getSensorCalibrationLogsAction(),
    supabase.from('trailers').select('id, plate_number').order('plate_number'),
  ]);

  const defaultSummary: ReeferCalibrationRadarSummary = {
    totalReeferTrailers: trailers?.length || 0,
    validAtpCount: 0,
    expiring60dCount: 0,
    expiring30dCount: 0,
    expiredAtpCount: 0,
    validSensorCalibrationsCount: 0,
    dueSensorCalibrationsCount: 0,
    groundedTrailersCount: 0,
    fleetComplianceHealthRate: 100,
  };

  const trailersList = (trailers || []).map((t: any) => ({
    id: t.id,
    plateNumber: t.plate_number || `REM-${t.id}`,
  }));

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <ReeferCalibrationRadarView
        initialSummary={summaryRes.summary || defaultSummary}
        initialAtpCerts={certsRes.data || []}
        initialCalibrationLogs={logsRes.data || []}
        trailersList={trailersList}
      />
    </div>
  );
}

