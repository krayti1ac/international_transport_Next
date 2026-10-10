import React from 'react';
import type { Metadata } from 'next';
import { fetchReeferClaimsAction } from '@/features/tracking/services/reefer-claim.actions';
import { ReeferInsuranceClaimSettlementView } from '@/features/tracking/components/ReeferInsuranceClaimSettlementView';

export const metadata: Metadata = {
  title: 'تسوية مطالبات التأمين للشحنات المبردة | Trans Bodanon TMS',
  description: 'محرك تسوية التعويض المالي التلقائي لتلف البضائع المبردة وربطها بملحق e-POD (ATP / GDP / INCOTERMS)',
};

export default async function ReeferClaimsPage() {
  const claimsRes = await fetchReeferClaimsAction({ limit: 50 });

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      <ReeferInsuranceClaimSettlementView
        initialClaims={claimsRes.data?.items || []}
      />
    </div>
  );
}

