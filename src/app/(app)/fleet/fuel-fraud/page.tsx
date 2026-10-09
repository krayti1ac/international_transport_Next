import React from 'react';
import { FuelFraudMonitorView } from '@/features/fleet/components/FuelFraudMonitorView';
import {
  getFuelTheftIncidentsAction,
  getFuelFraudKpiStatsAction,
} from '@/features/fleet/services/fuel-fraud.actions';

export const metadata = {
  title: 'رادار كشف احتيال وشفط الوقود | Trans Bodanon TMS',
  description: 'Intelligent Fuel Fraud & Anti-Siphoning Detection Engine — Telematics & Receipt Correlation',
};

export default async function FuelFraudPage() {
  const [incidentsRes, statsRes] = await Promise.all([
    getFuelTheftIncidentsAction(),
    getFuelFraudKpiStatsAction(),
  ]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <FuelFraudMonitorView
        initialIncidents={incidentsRes.incidents || []}
        initialStats={
          statsRes.stats || {
            activeIncidentsCount: 0,
            confirmedDeductionsCount: 0,
            totalLossLiters: 0,
            totalFinancialLossMad: 0,
            siphoningCount: 0,
            overflowCount: 0,
            ghostRefuelingCount: 0,
          }
        }
      />
    </div>
  );
}

