import { DriverDetailView } from '@/features/drivers/DriverDetailView';

export default function DriverDetailPage({ params }: { params: { id: string } }) {
    const driverId = parseInt(params.id, 10);
    if (isNaN(driverId)) {
        return (
            <div className="text-center py-16" dir="rtl">
                <p className="text-sm font-semibold text-foreground">معرف السائق غير صحيح</p>
            </div>
        );
    }
    return <DriverDetailView driverId={driverId} />;
}