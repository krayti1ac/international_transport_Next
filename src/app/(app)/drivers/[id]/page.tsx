import { DriverDetailView } from '@/features/drivers/DriverDetailView';

export default async function DriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const driverId = parseInt(resolvedParams.id, 10);

  return <DriverDetailView driverId={driverId} />;
}
