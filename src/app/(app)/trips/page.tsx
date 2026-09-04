import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import TripsHubScreen from '@/components/trips/TripsHubScreen';
import { TripsKanbanSkeleton } from '@/components/skeletons';

interface TripsPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const resolvedParams = await searchParams;
  if (resolvedParams?.tab === 'expenses') {
    redirect('/ferry-expenses');
  }

  return (
    <Suspense fallback={<TripsKanbanSkeleton />}>
      <TripsHubScreen />
    </Suspense>
  );
}
