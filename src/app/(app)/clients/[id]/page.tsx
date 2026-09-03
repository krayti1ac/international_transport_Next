import { ClientDetailView } from '@/features/clients/components/ClientDetailView';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ClientDetailView clientId={parseInt(resolvedParams.id, 10)} />;
}