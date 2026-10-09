import React from 'react';
import { TransitWatchdogRadarView } from '@/features/fleet/components/TransitWatchdogRadarView';
import { getTransitWatchdogRadarDataAction } from '@/features/fleet/services/transit-watchdog.actions';

export const metadata = {
  title: 'Transit Watchdog & Visa Expiry Radar | Trans Bodanon TMS',
  description: 'Automated Schengen & West Africa Cross-Border Visa Expiry & Pre-Dispatch Compliance Radar',
};

export default async function TransitWatchdogPage() {
  const { drivers, trucks, summary, alerts } = await getTransitWatchdogRadarDataAction();

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <TransitWatchdogRadarView
        initialDrivers={drivers}
        initialTrucks={trucks}
        initialSummary={summary}
        initialAlerts={alerts}
      />
    </div>
  );
}

