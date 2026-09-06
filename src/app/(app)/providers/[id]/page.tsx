import ProviderLedgerScreen from '@/features/providers/components/ProviderLedgerScreen';

export default async function ProviderLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const providerId = parseInt(id, 10);
  if (isNaN(providerId)) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">معرف المزود غير صحيح / Identifiant fournisseur invalide</p>
      </div>
    );
  }
  return <ProviderLedgerScreen providerId={providerId} />;
}
