'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { DocumentUploadModal } from '@/features/fleet/components/DocumentUploadModal';
import { QuickRenewDialog } from '@/features/fleet/components/QuickRenewDialog';
import {
  DOCUMENT_TYPE_LABELS,
  getDocumentTypeLabel,
  getDocStatusDetails,
} from '@/features/fleet/services/fleet-documents.constants';
import type { Truck, Trailer, Driver, FleetDocument, TripOrder } from '@/types/database';
import {
  ArrowRight, FileText, Wrench, Truck as TruckIcon,
  Plus, ExternalLink, RefreshCw, AlertTriangle, ShieldCheck, Activity, MapPin, Gauge
} from 'lucide-react';

interface VehicleDetailViewProps {
  vehicleId: number;
  vehicleType: 'truck' | 'trailer';
}

export function VehicleDetailView({ vehicleId, vehicleType }: VehicleDetailViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [vehicle, setVehicle] = useState<Truck | Trailer | null>(null);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [assignedTrailer, setAssignedTrailer] = useState<Trailer | null>(null);
  const [assignedTruck, setAssignedTruck] = useState<Truck | null>(null);

  const [documents, setDocuments] = useState<FleetDocument[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [selectedDocForRenew, setSelectedDocForRenew] = useState<FleetDocument | null>(null);

  const isTruck = vehicleType === 'truck';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const table = isTruck ? 'trucks' : 'trailers';
      const { data: vData, error: vError } = await supabase
        .from(table)
        .select('*')
        .eq('id', vehicleId)
        .single();
      if (vError) throw vError;
      setVehicle(vData);

      if (isTruck) {
        if (vData.default_driver_id) {
          const { data } = await supabase
            .from('drivers')
            .select('*')
            .eq('id', vData.default_driver_id)
            .maybeSingle();
          setAssignedDriver(data);
        }
        if (vData.default_trailer_id) {
          const { data } = await supabase
            .from('trailers')
            .select('*')
            .eq('id', vData.default_trailer_id)
            .maybeSingle();
          setAssignedTrailer(data);
        }
      } else {
        const { data } = await supabase
          .from('trucks')
          .select('*')
          .eq('default_trailer_id', vehicleId)
          .limit(1)
          .maybeSingle();
        setAssignedTruck(data);
      }

      const { data: docs } = await supabase
        .from('fleet_documents')
        .select('*')
        .eq('entity_type', vehicleType)
        .eq('entity_id', vehicleId)
        .eq('is_archived', false)
        .order('expiry_date');
      setDocuments(docs || []);

      let maintRecords: any[] = [];
      if (isTruck) {
        const { data } = await supabase
          .from('truck_maintenance')
          .select('*')
          .eq('truck_id', vehicleId);
        maintRecords = (data || []).sort(
          (a: { maintenance_date?: string; date?: string; created_at?: string }, b: { maintenance_date?: string; date?: string; created_at?: string }) =>
            new Date(b.maintenance_date || b.date || b.created_at || 0).getTime() -
            new Date(a.maintenance_date || a.date || a.created_at || 0).getTime()
        );
      }
      const { data: repairs } = await supabase
        .from('repair_invoices')
        .select('*')
        .ilike('notes', `%${vData.plate_number}%`);
      setMaintenance([...maintRecords, ...(repairs || [])]);

      const tripCol = isTruck ? 'truck_id' : 'trailer_id';
      const { data: tData } = await supabase
        .from('trip_orders')
        .select('*')
        .eq(tripCol, vehicleId)
        .order('departure_date', { ascending: false });
      setTrips(tData || []);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [vehicleId, vehicleType, isTruck, supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-500 flex flex-col items-center">
        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
        جاري تحميل السجل التقني للمركبة...
      </div>
    );
  }

  if (!vehicle) {
    return <div className="text-center py-20 text-rose-500">لم يتم العثور على المركبة</div>;
  }

  const totalMaintenanceCost = maintenance.reduce(
    (sum, item) => sum + (parseFloat(item.amount || item.total_amount || 0)),
    0
  );

  const expiringDocs = documents.filter((d) => {
    if (!d.expiry_date) return false;
    const diff = (new Date(d.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    return diff <= 30;
  });

  const getDocStatusInfo = (expiryDate?: string | null) => {
    if (!expiryDate) {
      return { label: 'ساري', badgeClass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
    }
    const diff = Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff < 0) {
      return { label: 'منتهي', badgeClass: 'bg-rose-500/15 text-rose-600 border-rose-500/30' };
    }
    if (diff <= 30) {
      return { label: `ينتهي خلال ${diff} يوم`, badgeClass: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
    }
    return { label: 'ساري', badgeClass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
  };

  const vehicleStatusLabel: Record<string, string> = {
    active: 'نشط ومتاح',
    in_maintenance: 'في الصيانة',
    on_trip: 'في رحلة',
    out_of_service: 'خارج الخدمة',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
              <TruckIcon className="w-6 h-6 text-primary" />
              {isTruck ? 'تفاصيل الشاحنة' : 'تفاصيل المقطورة'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              السجل التقني والوثائق المرتبطة بالمركبة
            </p>
          </div>
        </div>
      </div>

      <Card className="border-l-4 border-l-blue-500 shadow-sm bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex flex-col gap-2">
              <MatriculeBadge plate={vehicle.plate_number} variant="badge" size="lg" />
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className="font-semibold">
                  {vehicle.model || (isTruck ? 'شاحنة نقل' : 'مقطورة')}
                </span>
                <span className="text-slate-300">|</span>
                <Badge variant={vehicle.status === 'active' ? 'default' : 'secondary'}>
                  {vehicleStatusLabel[vehicle.status as string] || vehicle.status}
                </Badge>
              </div>
            </div>

            <div className="flex gap-4 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/40">
              {isTruck ? (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs">السائق المسند</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      {assignedDriver?.name || 'غير مسند'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 border-r pr-4">
                    <span className="text-xs">المقطورة المربوطة</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <TruckIcon className="w-4 h-4 text-blue-500" />
                      {assignedTrailer?.plate_number || 'بدون مقطورة'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-xs">الشاحنة القاطرة</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <TruckIcon className="w-4 h-4 text-blue-500" />
                    {assignedTruck?.plate_number || 'غير موصولة بشاحنة'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-1">الرحلات المنفذة</p>
              <p className="text-2xl font-bold font-mono text-foreground">{trips.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                مصاريف الصيانة والوقود
              </p>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {totalMaintenanceCost.toLocaleString()} MAD
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Wrench className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card className={expiringDocs.length > 0 ? 'border-rose-500/50 bg-rose-500/5' : ''}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                الوثائق تنتهي قريباً
              </p>
              <p
                className={`text-2xl font-bold font-mono ${
                  expiringDocs.length > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {expiringDocs.length}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                expiringDocs.length > 0
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              {expiringDocs.length > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 h-12 rounded-xl mb-4">
          <TabsTrigger value="documents" className="rounded-lg text-sm flex gap-2">
            <FileText className="w-4 h-4" /> الوثائق والتراخيص
          </TabsTrigger>
          <TabsTrigger value="trips" className="rounded-lg text-sm flex gap-2">
            <MapPin className="w-4 h-4" /> تاريخ الرحلات
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-lg text-sm flex gap-2">
            <Gauge className="w-4 h-4" /> الصيانة والوقود
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <CardTitle className="font-amiri text-lg">الوثائق القانونية</CardTitle>
              <Button size="sm" onClick={() => setIsUploadOpen(true)} className="h-8">
                <Plus className="w-4 h-4 ml-1" /> إضافة وثيقة
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {documents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl">
                  لا توجد وثائق مسجلة
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc) => {
                    const label = getDocumentTypeLabel(doc, 'ar');
                    const statusDetails = getDocStatusDetails(doc.expiry_date, 'ar');
                    return (
                      <div
                        key={doc.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-2xs transition-all ${statusDetails.cardClass}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-sm text-foreground">{label}</h4>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              رقم: {doc.document_number || '—'}
                            </p>
                            <p className={`text-xs mt-1 ${statusDetails.textClass}`}>
                              {statusDetails.durationText}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusDetails.badgeClass}`}
                          >
                            {statusDetails.badgeLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                          <span className="font-mono text-muted-foreground text-[11px]">
                            {doc.expiry_date
                              ? `تاريخ الانتهاء: ${doc.expiry_date}`
                              : 'بدون تاريخ انتهاء'}
                          </span>
                          <div className="flex gap-1.5 items-center">
                            {doc.file_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => window.open(doc.file_url, '_blank')}
                              >
                                <ExternalLink className="w-3.5 h-3.5 ml-1" />
                                عرض
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs font-semibold rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/50 transition-colors"
                              onClick={() => {
                                setSelectedDocForRenew(doc);
                                setIsRenewOpen(true);
                              }}
                            >
                              <RefreshCw className="w-3.5 h-3.5 ml-1" /> تجديد
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trips">
          <Card>
            <CardContent className="pt-6">
              {trips.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد رحلات مسجلة</p>
              ) : (
                <div className="space-y-3">
                  {trips.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex justify-between items-center p-4 border rounded-xl hover:bg-muted/30"
                    >
                      <div>
                        <p className="font-bold text-sm">{trip.route}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          تاريخ الانطلاق: {trip.departure_date} | رقم:{' '}
                          {trip.cmr_number || trip.id}
                        </p>
                      </div>
                      <Badge variant="outline">{trip.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardContent className="pt-6">
              {maintenance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد سجلات صيانة أو وقود
                </p>
              ) : (
                <div className="space-y-3">
                  {maintenance.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-4 border rounded-xl hover:bg-muted/30"
                    >
                      <div>
                        <p className="font-bold text-sm text-foreground flex items-center gap-2">
                          {m.type === 'fuel' ? (
                            <Gauge className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Wrench className="w-4 h-4 text-amber-500" />
                          )}
                          {m.type === 'fuel' ? 'تعبئة ديزل' : m.workshop_name || 'صيانة'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {m.date || m.created_at?.split('T')[0]} | {m.notes}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-rose-500">
                        -
                        {parseFloat(m.amount || m.total_amount).toLocaleString()} MAD
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isUploadOpen && vehicle && (
        <DocumentUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={fetchData}
          trucks={isTruck ? [vehicle as Truck] : []}
          trailers={!isTruck ? [vehicle as Trailer] : []}
          initialVehicle={{ type: vehicleType, id: vehicle.id, plate: vehicle.plate_number }}
        />
      )}

      {isRenewOpen && selectedDocForRenew && vehicle && (
        <QuickRenewDialog
          isOpen={isRenewOpen}
          document={selectedDocForRenew}
          vehicleName={vehicle.plate_number}
          onClose={() => setIsRenewOpen(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}