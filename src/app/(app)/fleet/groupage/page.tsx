import React from 'react';
import type { Metadata } from 'next';
import { fetchTripConsignmentsAction } from '@/features/tracking/services/groupage-consignment.actions';
import { GroupageManifestCard } from '@/features/tracking/components/GroupageManifestCard';

export const metadata: Metadata = {
  title: 'الشحن التجميعي وتعدد الشحنات بالرحلة LTL | Trans Bodanon TMS',
  description: 'محرك إدارة الشحن التجميعي الدولي، قياس الأمتار الخطية (LDM)، وتوليد وثائق CMR المستقلة لكل عميل',
};

export default async function GroupagePage() {
  const tripId = 8840;
  const consignmentsRes = await fetchTripConsignmentsAction(tripId);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl space-y-6">
      <GroupageManifestCard
        tripId={tripId}
        tripNumber="TRIP-2026-8840"
        initialConsignments={consignmentsRes.data || []}
      />
    </div>
  );
}

