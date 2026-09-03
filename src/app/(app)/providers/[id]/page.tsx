import ProviderLedgerScreen from '@/features/providers/components/ProviderLedgerScreen';

export default function ProviderLedgerPage({ params }: { params: { id: string } }) {
  const providerId = parseInt(params.id, 10);
  if (isNaN(providerId)) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">معرف المزود غير صحيح</p>
      </div>
    );
  }
  return <ProviderLedgerScreen providerId={providerId} />;
}
