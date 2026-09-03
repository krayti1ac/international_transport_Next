import { Suspense } from 'react';
import TripsHubScreen from '@/components/trips/TripsHubScreen';
import { TripsKanbanSkeleton } from '@/components/skeletons';

export default function TripsPage() {
  return (
    <Suspense fallback={<TripsKanbanSkeleton />}>
      <TripsHubScreen />
    </Suspense>
  );
}
