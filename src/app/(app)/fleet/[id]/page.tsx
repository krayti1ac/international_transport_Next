import { VehicleDetailView } from '@/features/fleet/components/VehicleDetailView';

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const vehicleId = parseInt(resolvedParams.id, 10);
  const type = resolvedSearchParams.type === 'trailer' ? 'trailer' : 'truck';

  return <VehicleDetailView vehicleId={vehicleId} vehicleType={type} />;
}