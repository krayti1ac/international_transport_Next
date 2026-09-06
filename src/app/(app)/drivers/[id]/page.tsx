import { DriverDetailView } from '@/features/drivers/DriverDetailView';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const driverId = parseInt(resolvedParams.id, 10);
    if (isNaN(driverId)) {
        return (
            <div className="text-center py-16">
                <p className="text-sm font-semibold text-foreground">Driver ID is invalid</p>
            </div>
        );
    }
    return <DriverDetailView driverId={driverId} />;
}