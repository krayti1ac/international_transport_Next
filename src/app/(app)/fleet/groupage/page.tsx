import React from 'react';
import type { Metadata } from 'next';
import { fetchTripConsignmentsAction } from '@/features/tracking/services/groupage-consignment.actions';
import { fetchGroupagePnlAction } from '@/features/tracking/services/groupage-split-billing.actions';
import { GroupageManifestCard } from '@/features/tracking/components/GroupageManifestCard';
import { GroupageCostAllocationCard } from '@/features/tracking/components/GroupageCostAllocationCard';
import { DriverMultiDropCard } from '@/features/tracking/components/DriverMultiDropCard';

export const metadata: Metadata = {
  title: 'الشحن التجميعي وتعدد الشحنات بالرحلة LTL | Trans Bodanon TMS',
  description: 'محرك إدارة الشحن التجميعي الدولي، قياس الأمتار الخطية (LDM)، وتوليد وثائق CMR المستقلة، الفوترة الجزئية وإثبات التسليم e-POD',
};

export default async function GroupagePage() {
  const tripId = 8840;
  const [consignmentsRes, pnlRes] = await Promise.all([
    fetchTripConsignmentsAction(tripId),
    fetchGroupagePnlAction(tripId),
  ]);

  const consignments = consignmentsRes.data || [];

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl space-y-6">
      <GroupageManifestCard
        tripId={tripId}
        tripNumber="TRIP-2026-8840"
        initialConsignments={consignments}
      />

      <DriverMultiDropCard
        tripId={tripId}
        initialConsignments={consignments}
      />

      <GroupageCostAllocationCard
        tripId={tripId}
        initialSummary={pnlRes.data || null}
      />
    </div>
  );
}


