'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { calculateTripFinancials, type TripFinancialSummary } from '@/lib/profitability';
import { useLanguage } from '@/components/language-provider';
import type {
  TripOrder,
  Client,
  Driver,
  Truck,
  Trailer,
  TransportRoute,
} from '@/types/database';
import {
  FileText,
  ShieldCheck,
  DollarSign,
  RefreshCw,
} from 'lucide-react';

import { TripHeader } from './TripHeader';
import { TripRouteFlow } from './TripRouteFlow';
import { TripFleetCrew } from './TripFleetCrew';
import { TripDocumentsTab } from './tabs/TripDocumentsTab';
import { TripPodTab } from './tabs/TripPodTab';
import { TripProfitabilityTab } from './tabs/TripProfitabilityTab';
import { TripFormModal } from '@/components/trip-form-modal';

interface TripDetailViewProps {
  tripId: number;
}

export function TripDetailView({ tripId }: TripDetailViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const supabase = useMemo(() => createClient(), []);

  const [trip, setTrip] = useState<TripOrder | null>(null);
  const [clientExport, setClientExport] = useState<Client | null>(null);
  const [clientImport, setClientImport] = useState<Client | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [trailer, setTrailer] = useState<Trailer | null>(null);
  const [financials, setFinancials] = useState<TripFinancialSummary | null>(null);

  // Collections for TripFormModal
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [allTrucks, setAllTrucks] = useState<Truck[]>([]);
  const [allTrailers, setAllTrailers] = useState<Trailer[]>([]);
  const [allRoutes, setAllRoutes] = useState<TransportRoute[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('documents');

  const fetchData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      try {
        const { data: tData, error: tError } = await supabase
          .from('trip_orders')
          .select('*')
          .eq('id', tripId)
          .single();

        if (tError) throw tError;
        setTrip(tData);

        const [
          cExpRes,
          cImpRes,
          drvRes,
          trkRes,
          trlRes,
          clientsListRes,
          driversListRes,
          trucksListRes,
          trailersListRes,
          routesListRes,
        ] = await Promise.all([
          tData.client_id
            ? supabase.from('clients').select('*').eq('id', tData.client_id).single()
            : Promise.resolve({ data: null }),
          tData.client_import_id
            ? supabase.from('clients').select('*').eq('id', tData.client_import_id).single()
            : Promise.resolve({ data: null }),
          tData.driver_id
            ? supabase.from('drivers').select('*').eq('id', tData.driver_id).single()
            : Promise.resolve({ data: null }),
          tData.truck_id
            ? supabase.from('trucks').select('*').eq('id', tData.truck_id).single()
            : Promise.resolve({ data: null }),
          tData.trailer_id
            ? supabase.from('trailers').select('*').eq('id', tData.trailer_id).single()
            : Promise.resolve({ data: null }),
          supabase.from('clients').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('trucks').select('*'),
          supabase.from('trailers').select('*'),
          supabase.from('transport_routes').select('*'),
        ]);

        setClientExport(cExpRes.data);
        setClientImport(cImpRes.data);
        setDriver(drvRes.data);
        setTruck(trkRes.data);
        setTrailer(trlRes.data);

        setAllClients((clientsListRes.data as Client[]) || []);
        setAllDrivers((driversListRes.data as Driver[]) || []);
        setAllTrucks((trucksListRes.data as Truck[]) || []);
        setAllTrailers((trailersListRes.data as Trailer[]) || []);
        setAllRoutes((routesListRes.data as TransportRoute[]) || []);

        // Financials calculations data
        const [advancesRes, fuelRes, finesRes, ferriesRes] = await Promise.all([
          tData.driver_id
            ? supabase.from('advances').select('*').eq('driver_id', tData.driver_id)
            : Promise.resolve({ data: [] }),
          tData.truck_id
            ? supabase.from('truck_maintenance').select('*').eq('truck_id', tData.truck_id)
            : Promise.resolve({ data: [] }),
          supabase.from('fine_penalties').select('*').eq('trip_order_id', tripId),
          supabase.from('ferry_expenses').select('*').eq('trip_order_id', tripId),
        ]);

        const fuelRecords = ((fuelRes.data || []) as Array<{
          expense_type?: string;
          type?: string;
        }>).filter((r) => {
          const expType = (r.expense_type || r.type || '').toLowerCase();
          return (
            !expType ||
            expType === 'fuel' ||
            expType === 'carburant' ||
            expType === 'gasoil'
          );
        });

        const calc = calculateTripFinancials({
          trip: tData,
          advances: advancesRes.data || [],
          fuelRecords: fuelRecords as any,
          fines: finesRes.data || [],
          ferries: ferriesRes.data || [],
          driverName: drvRes.data?.name,
          truckPlate: trkRes.data?.plate_number,
          distanceKm: 2400,
          fuelLiters: 750,
        });

        setFinancials(calc);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : t('حدث خطأ أثناء تحميل تفاصيل الرحلة', 'Erreur lors du chargement des détails');
        toast({
          title: t('خطأ', 'Erreur', 'Error'),
          description: message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tripId, supabase, toast, t]
  );

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`trip-${tripId}-updates`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_orders', filter: `id=eq.${tripId}` },
        () => fetchData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_signatures', filter: `trip_order_id=eq.${tripId}` },
        () => fetchData(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase, tripId]);

  const handleUpdateTripData = async (updatedData: Partial<TripOrder>) => {
    try {
      const { error } = await supabase
        .from('trip_orders')
        .update(updatedData)
        .eq('id', tripId);

      if (error) throw error;

      toast({
        title: t('تم تحديث بيانات الرحلة بنجاح', 'Trajet mis à jour avec succès'),
      });
      setIsEditModalOpen(false);
      fetchData(true);
    } catch (err: any) {
      toast({
        title: t('خطأ في التحديث', 'Erreur de mise à jour'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3.5" dir={dir}>
        <RefreshCw className="w-9 h-9 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          {t('جاري جلب ملف الرحلة الشامل...', 'Chargement du dossier de voyage...')}
        </p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20 text-rose-500 font-bold" dir={dir}>
        {t('الرحلة غير موجودة في النظام', 'Trajet introuvable', 'Trip not found')}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir={dir}>
      {/* 1. Trip Header with Status, PDF Dossier & WhatsApp Share */}
      <TripHeader
        trip={trip}
        clientExport={clientExport}
        onEditTrip={() => setIsEditModalOpen(true)}
      />

      {/* 2. Point-to-Point Flow (Export Aller vs Import Retour) */}
      <TripRouteFlow
        trip={trip}
        clientExport={clientExport}
        clientImport={clientImport}
      />

      {/* 3. Fleet & Crew Equipment */}
      <TripFleetCrew
        driver={driver}
        truck={truck}
        trailer={trailer}
      />

      {/* 4. Specialized Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 h-12 rounded-2xl mb-6 bg-muted/60 p-1">
          <TabsTrigger value="documents" className="rounded-xl text-xs sm:text-sm flex items-center gap-2 font-bold">
            <FileText className="w-4 h-4" />
            <span>{t('المستندات والعبور', 'Documents & Transit')}</span>
          </TabsTrigger>

          <TabsTrigger value="pod" className="rounded-xl text-xs sm:text-sm flex items-center gap-2 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('إثبات التسليم (POD)', 'Preuve de Livraison (POD)')}</span>
          </TabsTrigger>

          <TabsTrigger value="financials" className="rounded-xl text-xs sm:text-sm flex items-center gap-2 font-bold">
            <DollarSign className="w-4 h-4" />
            <span>{t('كشف الربحية (P&L)', 'Rentabilité (P&L)')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Documents & Maritime Transit */}
        <TabsContent value="documents" className="space-y-4">
          <TripDocumentsTab trip={trip} />
        </TabsContent>

        {/* Tab 2: Proof of Delivery (e-POD) */}
        <TabsContent value="pod" className="space-y-4">
          <TripPodTab trip={trip} />
        </TabsContent>

        {/* Tab 3: Financial Profitability (P&L) */}
        <TabsContent value="financials" className="space-y-4">
          <TripProfitabilityTab financials={financials} trip={trip} />
        </TabsContent>
      </Tabs>

      {/* Edit Trip Modal */}
      <TripFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateTripData}
        clients={allClients}
        drivers={allDrivers}
        trucks={allTrucks}
        trailers={allTrailers}
        transportRoutes={allRoutes}
        initialData={trip}
      />
    </div>
  );
}
