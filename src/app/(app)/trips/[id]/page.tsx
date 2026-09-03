import { TripDetailView } from '@/features/trips/components/TripDetailView';

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const tripId = parseInt(resolvedParams.id, 10);

  return <TripDetailView tripId={tripId} />;
}