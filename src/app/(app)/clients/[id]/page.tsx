import { ClientDetailView } from '@/features/clients/components/ClientDetailView';
import { notFound } from 'next/navigation';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const clientId = parseInt(resolvedParams.id, 10);

  if (isNaN(clientId) || clientId <= 0) {
    notFound();
  }

  return <ClientDetailView clientId={clientId} />;
}