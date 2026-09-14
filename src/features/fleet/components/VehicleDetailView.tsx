'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { useFiscalStore } from '@/lib/stores/fiscal-store';
import { PeriodFilterBar } from '@/components/PeriodFilterBar';
import {
  FileText,
  Wrench,
  Fuel,
  Route,
  Activity,
  Calculator,
  RefreshCw,
} from 'lucide-react';

import type {
  Truck,
  Trailer,
  Driver,
  FleetDocument,
  TruckMaintenance,
  TripOrder,
  Client,
  CompanyBranch,
} from '@/types/database';

import { VehicleProfileHeader } from './VehicleProfileHeader';
import { VehicleKpiBento } from './VehicleKpiBento';
import { VehicleDocumentsTab } from './tabs/VehicleDocumentsTab';
import { VehicleFuelAnalyticsTab } from './tabs/VehicleFuelAnalyticsTab';
import { VehicleMaintenanceTab } from './tabs/VehicleMaintenanceTab';
import { VehicleTripsTab } from './tabs/VehicleTripsTab';
import { VehicleTelematicsTab } from './tabs/VehicleTelematicsTab';
import { TcoDashboard } from './TcoDashboard';

// Modals
import { DocumentUploadModal } from './DocumentUploadModal';
import { QuickRenewDialog } from './QuickRenewDialog';
import { RenewalHistoryModal } from './RenewalHistoryModal';
import { MaintenanceSchedulerModal } from './MaintenanceSchedulerModal';
import { FleetFormModal } from '@/components/fleet-form-modal';

interface VehicleDetailViewProps {
  vehicleId: number;
  vehicleType: 'truck' | 'trailer';
}

export function VehicleDetailView({ vehicleId, vehicleType }: VehicleDetailViewProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const { startDate, endDate } = useFiscalStore();

  // Core Entity State
  const [vehicle, setVehicle] = useState<Truck | Trailer | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [assignedTrailer, setAssignedTrailer] = useState<Trailer | null>(null);
  const [assignedTruck, setAssignedTruck] = useState<Truck | null>(null);
  const [homeBranch, setHomeBranch] = useState<CompanyBranch | null>(null);

  // Operational Collections
  const [documents, setDocuments] = useState<FleetDocument[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<TruckMaintenance[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [driversMap, setDriversMap] = useState<Record<number, Driver>>({});
  const [clientsMap, setClientsMap] = useState<Record<number, Client>>({});
  const [allTrucks, setAllTrucks] = useState<Truck[]>([]);
  const [allTrailers, setAllTrailers] = useState<Trailer[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renewingDocId, setRenewingDocId] = useState<number | null>(null);

  // Modals Visibility State
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isQuickRenewDialogOpen, setIsQuickRenewDialogOpen] = useState(false);
  const [selectedDocForRenew, setSelectedDocForRenew] = useState<FleetDocument | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedDocForHistory, setSelectedDocForHistory] = useState<FleetDocument | null>(null);
  const [isMaintenanceSchedulerOpen, setIsMaintenanceSchedulerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>('documents');

  const fetchVehicleData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const table = vehicleType === 'truck' ? 'trucks' : 'trailers';
      const { data: vData, error: vError } = await supabase
        .from(table)
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (vError) throw vError;
      setVehicle(vData);

      // Concurrent fetching of related collections
      const [
        docsRes,
        maintRes,
        tripsRes,
        driversRes,
        clientsRes,
        allTrucksRes,
        allTrailersRes,
      ] = await Promise.all([
        supabase
          .from('fleet_documents')
          .select('*')
          .eq('entity_type', vehicleType)
          .eq('entity_id', vehicleId)
          .eq('is_archived', false)
          .order('expiry_date', { ascending: true }),

        vehicleType === 'truck'
          ? supabase
              .from('truck_maintenance')
              .select('*')
              .eq('truck_id', vehicleId)
              .gte('maintenance_date', startDate)
              .lte('maintenance_date', endDate)
              .order('maintenance_date', { ascending: false })
          : Promise.resolve({ data: [] }),

        supabase
          .from('trip_orders')
          .select('*')
          .eq(vehicleType === 'truck' ? 'truck_id' : 'trailer_id', vehicleId)
          .gte('departure_date', startDate)
          .lte('departure_date', endDate)
          .order('departure_date', { ascending: false }),

        supabase.from('drivers').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('trailers').select('*'),
      ]);

      setDocuments((docsRes.data as FleetDocument[]) || []);
      setMaintenanceRecords((maintRes.data as TruckMaintenance[]) || []);
      setTrips((tripsRes.data as TripOrder[]) || []);

      const driversList = (driversRes.data as Driver[]) || [];
      const clientsList = (clientsRes.data as Client[]) || [];
      setAllTrucks((allTrucksRes.data as Truck[]) || []);
      setAllTrailers((allTrailersRes.data as Trailer[]) || []);
      setAllDrivers(driversList);

      const dMap: Record<number, Driver> = {};
      driversList.forEach((d) => {
        dMap[d.id] = d;
      });
      setDriversMap(dMap);

      const cMap: Record<number, Client> = {};
      clientsList.forEach((c) => {
        cMap[c.id] = c;
      });
      setClientsMap(cMap);

      // Resolve linked relationships
      if (vehicleType === 'truck') {
        const truckObj = vData as Truck;
        if (truckObj.default_driver_id) {
          setDriver(dMap[truckObj.default_driver_id] || null);
        } else {
          setDriver(null);
        }

        if (truckObj.default_trailer_id) {
          const trailerMatch = (allTrailersRes.data || []).find(
            (tr: Trailer) => tr.id === truckObj.default_trailer_id
          );
          setAssignedTrailer(trailerMatch || null);
        } else {
          setAssignedTrailer(null);
        }

        if (truckObj.home_branch_id) {
          const { data: bData } = await supabase
            .from('company_branches')
            .select('*')
            .eq('id', truckObj.home_branch_id)
            .maybeSingle();
          setHomeBranch(bData || null);
        } else {
          setHomeBranch(null);
        }
      } else {
        // For trailers: check if assigned to a truck
        const trailerObj = vData as Trailer;
        const linkedTruck = (allTrucksRes.data || []).find(
          (tk: Truck) => tk.default_trailer_id === trailerObj.id
        );
        setAssignedTruck(linkedTruck || null);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('خطأ غير معروف', 'Erreur inconnue', 'Unknown error');
      toast({
        title: t('خطأ في تحميل البيانات', 'Erreur de chargement', 'Loading Error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vehicleId, vehicleType, supabase, toast, t, startDate, endDate]);

  useEffect(() => {
    fetchVehicleData();

    // Supabase Realtime Channels for Live Fleet Updates
    const channel = supabase
      .channel(`fleet-vehicle-${vehicleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: vehicleType === 'truck' ? 'trucks' : 'trailers',
          filter: `id=eq.${vehicleId}`,
        },
        () => fetchVehicleData(true)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fleet_documents',
          filter: `entity_id=eq.${vehicleId}`,
        },
        () => fetchVehicleData(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVehicleData, supabase, vehicleId, vehicleType]);

  // Quick 1-Click Renewal Action (+365 days)
  const handleQuickRenewDirect = async (doc: FleetDocument) => {
    setRenewingDocId(doc.id);
    try {
      const currentExpiry = doc.expiry_date ? new Date(doc.expiry_date) : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      const newExpiryStr = newExpiry.toISOString().split('T')[0];

      const { error: updateError } = await supabase
        .from('fleet_documents')
        .update({
          previous_expiry_date: doc.expiry_date,
          expiry_date: newExpiryStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (updateError) throw updateError;

      await supabase.from('fleet_document_renewals').insert({
        fleet_document_id: doc.id,
        previous_expiry_date: doc.expiry_date,
        new_expiry_date: newExpiryStr,
        renewal_cost: 0,
        currency: 'MAD',
        document_type: doc.document_type,
        notes: 'تجديد سريع مباشر (+365 يوم)',
      });

      toast({
        title: t('تم التجديد بنجاح', 'Document renouvelé avec succès', 'Document successfully renewed'),
        description: t(`تم تمديد الصلاحية حتى ${newExpiryStr}`, `Nouvelle validité jusqu'au ${newExpiryStr}`),
      });

      fetchVehicleData(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('فشل التجديد', 'Échec du renouvellement');
      toast({
        title: t('خطأ في التجديد', 'Erreur', 'Error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRenewingDocId(null);
    }
  };

  // Handle Edit Vehicle Save
  const handleSaveVehicleData = async (type: string, data: any) => {
    try {
      const table = vehicleType === 'truck' ? 'trucks' : 'trailers';
      const { error } = await supabase
        .from(table)
        .update(data)
        .eq('id', vehicleId);

      if (error) throw error;

      toast({
        title: t('تم تحديث البيانات بنجاح', 'Données mises à jour avec succès'),
      });
      setIsEditModalOpen(false);
      fetchVehicleData(true);
    } catch (err: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: err.message || 'فشل حفظ التعديلات',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3.5" dir={dir}>
        <RefreshCw className="w-9 h-9 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          {t('جاري جلب تفاصيل الشاحنة والأسطول...', 'Chargement des détails du véhicule...')}
        </p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-20 text-rose-500 font-bold" dir={dir}>
        {t('المركبة المطلوبة غير موجودة في النظام', 'Véhicule introuvable', 'Vehicle not found')}
      </div>
    );
  }

  const isTruck = vehicleType === 'truck';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir={dir}>
      {/* 1. Vehicle Profile Header */}
      <VehicleProfileHeader
        vehicle={vehicle}
        vehicleType={vehicleType}
        driver={driver}
        assignedTrailer={assignedTrailer}
        assignedTruck={assignedTruck}
        homeBranch={homeBranch}
        onEditVehicle={() => setIsEditModalOpen(true)}
        onAddDocument={() => setIsUploadDocOpen(true)}
        onScheduleMaintenance={() => setIsMaintenanceSchedulerOpen(true)}
        onRefresh={() => fetchVehicleData(true)}
        refreshing={refreshing}
      />

      {/* 2. Fiscal Period Filter Bar */}
      <PeriodFilterBar onFilterChange={() => fetchVehicleData(true)} />

      {/* 3. KPI Bento Grid */}
      <VehicleKpiBento
        vehicleType={vehicleType}
        truck={isTruck ? (vehicle as Truck) : null}
        documents={documents}
        maintenanceRecords={maintenanceRecords}
        trips={trips}
        auditRating={isTruck ? 'trustworthy' : null}
        auditScore={98}
      />

      {/* 4. Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 sm:grid-cols-6 h-12 rounded-2xl mb-6 bg-muted/60 p-1">
          {/* Documents Tab */}
          <TabsTrigger value="documents" className="rounded-xl text-xs flex items-center gap-1.5 font-bold">
            <FileText className="w-4 h-4" />
            <span>{t('الوثائق والتراخيص', 'Documents')}</span>
            <span className="opacity-70 font-mono">({documents.length})</span>
          </TabsTrigger>

          {/* Fuel Tab (Only Trucks) */}
          {isTruck && (
            <TabsTrigger value="fuel" className="rounded-xl text-xs flex items-center gap-1.5 font-bold">
              <Fuel className="w-4 h-4" />
              <span>{t('استهلاك الوقود', 'Carburant')}</span>
            </TabsTrigger>
          )}

          {/* Maintenance Tab */}
          <TabsTrigger value="maintenance" className="rounded-xl text-xs flex items-center gap-1.5 font-bold">
            <Wrench className="w-4 h-4" />
            <span>{t('الورشة والصيانة', 'Maintenance')}</span>
            <span className="opacity-70 font-mono">({maintenanceRecords.length})</span>
          </TabsTrigger>

          {/* Trips Tab */}
          <TabsTrigger value="trips" className="rounded-xl text-xs flex items-center gap-1.5 font-bold">
            <Route className="w-4 h-4" />
            <span>{t('الرحلات الدولية', 'Trajets')}</span>
            <span className="opacity-70 font-mono">({trips.length})</span>
          </TabsTrigger>

          {/* Telematics Tab */}
          <TabsTrigger value="telematics" className="rounded-xl text-xs flex items-center gap-1.5 font-bold">
            <Activity className="w-4 h-4" />
            <span>{t('الاتصال والتتبع', 'Télématique')}</span>
          </TabsTrigger>

          {/* TCO Cost Tab */}
          <TabsTrigger value="tco" className="rounded-xl text-xs flex items-center gap-1.5 font-bold">
            <Calculator className="w-4 h-4" />
            <span>{t('تكلفة الكيلومتر', 'TCO / Km')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Documents */}
        <TabsContent value="documents" className="space-y-4">
          <VehicleDocumentsTab
            documents={documents}
            vehiclePlate={vehicle.plate_number}
            vehicleType={vehicleType}
            onAddDocument={() => setIsUploadDocOpen(true)}
            onQuickRenewDirect={handleQuickRenewDirect}
            onOpenRenewDialog={(doc) => {
              setSelectedDocForRenew(doc);
              setIsQuickRenewDialogOpen(true);
            }}
            onViewRenewalHistory={(doc) => {
              setSelectedDocForHistory(doc);
              setIsHistoryModalOpen(true);
            }}
            renewingDocId={renewingDocId}
          />
        </TabsContent>

        {/* Tab 2: Fuel Analytics (Only Truck) */}
        {isTruck && (
          <TabsContent value="fuel" className="space-y-4">
            <VehicleFuelAnalyticsTab
              truck={vehicle as Truck}
              maintenanceRecords={maintenanceRecords}
              trips={trips}
              onRefresh={() => fetchVehicleData(true)}
            />
          </TabsContent>
        )}

        {/* Tab 3: Maintenance */}
        <TabsContent value="maintenance" className="space-y-4">
          <VehicleMaintenanceTab
            vehicle={vehicle}
            vehicleType={vehicleType}
            maintenanceRecords={maintenanceRecords}
            onScheduleMaintenance={() => setIsMaintenanceSchedulerOpen(true)}
          />
        </TabsContent>

        {/* Tab 4: International Trips */}
        <TabsContent value="trips" className="space-y-4">
          <VehicleTripsTab
            trips={trips}
            driversMap={driversMap}
            clientsMap={clientsMap}
          />
        </TabsContent>

        {/* Tab 5: Telematics CAN-bus */}
        <TabsContent value="telematics" className="space-y-4">
          <VehicleTelematicsTab
            vehicle={vehicle}
            vehicleType={vehicleType}
          />
        </TabsContent>

        {/* Tab 6: TCO Dashboard */}
        <TabsContent value="tco" className="space-y-4">
          <TcoDashboard
            vehicleId={vehicleId}
            vehicleType={vehicleType}
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>
      </Tabs>

      {/* --- ALL REUSABLE MODALS --- */}

      {/* Upload New Document Modal */}
      <DocumentUploadModal
        isOpen={isUploadDocOpen}
        onClose={() => setIsUploadDocOpen(false)}
        onSuccess={() => {
          setIsUploadDocOpen(false);
          fetchVehicleData(true);
        }}
        trucks={allTrucks}
        trailers={allTrailers}
        initialVehicle={{
          type: vehicleType,
          id: vehicleId,
          plate: vehicle.plate_number,
        }}
      />

      {/* Quick Renew Dialog with Treasury Deduction */}
      <QuickRenewDialog
        isOpen={isQuickRenewDialogOpen}
        onClose={() => {
          setIsQuickRenewDialogOpen(false);
          setSelectedDocForRenew(null);
        }}
        document={selectedDocForRenew}
        vehicleName={vehicle.plate_number}
        onSuccess={() => {
          setIsQuickRenewDialogOpen(false);
          setSelectedDocForRenew(null);
          fetchVehicleData(true);
        }}
      />

      {/* Document Renewal History Modal */}
      <RenewalHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedDocForHistory(null);
        }}
        document={selectedDocForHistory}
      />

      {/* Maintenance Scheduler Modal */}
      <MaintenanceSchedulerModal
        isOpen={isMaintenanceSchedulerOpen}
        onClose={() => setIsMaintenanceSchedulerOpen(false)}
        onSaved={() => {
          setIsMaintenanceSchedulerOpen(false);
          fetchVehicleData(true);
        }}
        trucks={allTrucks}
        trailers={allTrailers}
      />

      {/* Edit Vehicle Modal */}
      <FleetFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        entityType={vehicleType}
        initialData={vehicle}
        driversList={allDrivers}
        trucksList={allTrucks}
        trailersList={allTrailers}
        onSave={handleSaveVehicleData}
      />
    </div>
  );
}
