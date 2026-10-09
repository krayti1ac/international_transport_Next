import React from 'react';
import { TollReconciliationView } from '@/features/fleet/components/TollReconciliationView';
import { getTollReconciliationDataAction } from '@/features/fleet/services/european-tolls.actions';

export const metadata = {
  title: 'European Tolls & Eurovignette Engine | Trans Bodanon TMS',
  description: 'DKV, Telepass EU, AS 24 European Tolls Reconciliation & VAT 8th Directive Recovery Engine',
};

export default async function EuropeanTollsPage() {
  const { batches, expenses, summary } = await getTollReconciliationDataAction();

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <TollReconciliationView
        initialBatches={batches}
        initialExpenses={expenses}
        initialSummary={summary}
      />
    </div>
  );
}

