'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaneTakeoff, PlaneLanding, Truck, DollarSign, X, Navigation } from 'lucide-react';
import { TransitActions } from '@/components/trips/TransitActions';
import { DriverSettlementDialog } from '@/components/trips/DriverSettlementDialog';
import { PodReportView } from '@/features/trips/components/PodReportView';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import type { TripOrder, Client, Driver, Truck as TruckType, Trailer, Advance } from '@/types/database';

interface TripOrderDetailsProps {
  trip: TripOrder;
  clients: Client[];
  drivers: Driver[];
  trucks: TruckType[];
  trailers: Trailer[];
  advances: Advance[];
  cashBoxes: { id: number; name: string }[];
  onClose: () => void;
  onUpdate: (updatedTrip: TripOrder) => void;
}

function TripOrderDetails({
  trip,
  clients,
  drivers,
  trucks,
  trailers,
  advances,
  cashBoxes,
  onClose,
  onUpdate,
}: TripOrderDetailsProps) {
  const [settlementAdvance, setSettlementAdvance] = useState<Advance | null>(null);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  const assignedClient = clients.find((c) => c.id === trip.client_id);
  const assignedClientImport = clients.find((c) => c.id === trip.client_import_id);
  const assignedDriver = drivers.find((d) => d.id === trip.driver_id);
  const assignedTruck = trucks.find((t) => t.id === trip.truck_id);
  const assignedTrailer = trailers.find((tr) => tr.id === trip.trailer_id);
  const driverAdvances = advances.filter((a) => a.driver_id === trip.driver_id && a.status !== 'settled');

  const handleSettle = () => {
    if (driverAdvances.length > 0) {
      setSettlementAdvance(driverAdvances[0]);
      setIsSettlementOpen(true);
    }
  };

  const handleSettled = () => {
    setIsSettlementOpen(false);
    setSettlementAdvance(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-amiri text-xl font-bold text-foreground flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              تفاصيل الرحلة #{trip.id}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{trip.route}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <PlaneTakeoff className="w-4 h-4" />
                  ذهاب (تصدير - Aller)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <strong>العميل:</strong>
                  <span>{assignedClient?.name || 'غير محدد'}</span>
                  {assignedClient && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      عميل ذهاب
                    </span>
                  )}
                </div>
                <p><strong>المسار:</strong> {trip.route_export || 'N/A'}</p>
                <p><strong>CMR:</strong> {trip.cmr_export_number || 'N/A'}</p>
                <p><strong>السعر:</strong> {(trip.price_export || 0).toLocaleString()} MAD</p>
                <p><strong>الانطلاق:</strong> {trip.departure_date || 'N/A'}</p>
                <p><strong>التفريغ:</strong> {trip.unloading_date_export || 'N/A'}</p>
              </CardContent>
            </Card>

            {trip.route_import && (
              <Card className="bg-blue-500/5 border-blue-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <PlaneLanding className="w-4 h-4" />
                    عودة (استيراد - Retour)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <strong>العميل:</strong>
                    <span>{assignedClientImport?.name || 'غير محدد'}</span>
                    {assignedClientImport && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                        عميل عودة
                      </span>
                    )}
                  </div>
                  <p><strong>المسار:</strong> {trip.route_import || 'N/A'}</p>
                  <p><strong>CMR:</strong> {trip.cmr_import_number || 'N/A'}</p>
                  <p><strong>السعر:</strong> {(trip.price_import || 0).toLocaleString()} MAD</p>
                  <p><strong>الشحن:</strong> {trip.loading_date_import || 'N/A'}</p>
                  <p><strong>التفريغ:</strong> {trip.unloading_date_import || 'N/A'}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                الطاقم والأسطول
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">السائق</p>
                <p className="font-medium text-foreground">{assignedDriver?.name || 'غير مسند'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">الشاحنة</p>
                <MatriculeBadge plate={assignedTruck?.plate_number} variant="badge" size="sm" />
              </div>
              <div>
                <p className="text-muted-foreground mb-1">المقطورة</p>
                <MatriculeBadge plate={assignedTrailer?.plate_number} variant="subtle" size="sm" />
              </div>
              <div>
                <p className="text-muted-foreground">إجمالي الإيراد</p>
                <p className="font-bold text-primary font-mono">{(trip.price || 0).toLocaleString()} {trip.price_type || 'MAD'}</p>
              </div>
            </CardContent>
          </Card>

          <TransitActions
            trip={trip}
            onUpdate={onUpdate}
            truckPlate={assignedTruck?.plate_number}
            trailerPlate={assignedTrailer?.plate_number}
            ferryPhone={assignedClient?.phone}
          />

          {driverAdvances.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  تسوية السائق
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  يوجد {driverAdvances.length} سلفة غير مسددة لهذا السائق
                </p>
                <Button onClick={handleSettle} className="w-full">
                  <DollarSign className="w-4 h-4 ml-2" />
                  تسوية السلفة
                </Button>
              </CardContent>
            </Card>
          )}

          <PodReportView tripOrderId={trip.id} />
        </div>
      </div>

      {settlementAdvance && (
        <DriverSettlementDialog
          isOpen={isSettlementOpen}
          onClose={handleSettled}
          advance={settlementAdvance}
          cashBoxes={cashBoxes}
          onSettled={handleSettled}
        />
      )}
    </div>
  );
}

export { TripOrderDetails };
