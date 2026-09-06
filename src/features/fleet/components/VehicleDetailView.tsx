'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import type { Truck, Trailer, FleetDocument, TruckMaintenance, TripOrder } from '@/types/database';
import {
  ArrowRight,
  ShieldCheck,
  Wrench,
  Fuel,
  FileText,
  MapPin,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';

interface VehicleDetailViewProps {
  vehicleId: number;
  vehicleType: 'truck' | 'trailer';
}

export function VehicleDetailView({ vehicleId, vehicleType }: VehicleDetailViewProps) {
  const router = useRouter();
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [vehicle, setVehicle] = useState<Truck | Trailer | null>(null);
  const [documents, setDocuments] = useState<FleetDocument[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<TruckMaintenance[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewingDocId, setRenewingDocId] = useState<number | null>(null);

  const fetchVehicleData = useCallback(async () => {
    setLoading(true);
    try {
      const table = vehicleType === 'truck' ? 'trucks' : 'trailers';
      const { data: vData, error: vError } = await supabase
        .from(table)
        .select('*')
        .eq('id', vehicleId)
        .single();
      if (vError) throw vError;
      setVehicle(vData);

      const [docsRes, maintRes, tripsRes] = await Promise.all([
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
              .order('maintenance_date', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('trip_orders')
          .select('*')
          .eq(vehicleType === 'truck' ? 'truck_id' : 'trailer_id', vehicleId)
          .order('departure_date', { ascending: false }),
      ]);

      setDocuments(docsRes.data || []);
      setMaintenanceRecords((maintRes.data as TruckMaintenance[]) || []);
      setTrips((tripsRes.data as TripOrder[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('خطأ غير معروف', 'Erreur inconnue', 'Unknown error');
      toast({
        title: t('خطأ في تحميل البيانات', 'Erreur de chargement', 'Loading Error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [vehicleId, vehicleType, supabase, toast, t]);

  useEffect(() => {
    fetchVehicleData();

    const channel = supabase
      .channel(`vehicle-detail-${vehicleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: vehicleType === 'truck' ? 'trucks' : 'trailers', filter: `id=eq.${vehicleId}` }, () => fetchVehicleData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_documents', filter: `entity_id=eq.${vehicleId}` }, () => fetchVehicleData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVehicleData, supabase, vehicleId, vehicleType]);

  const handleQuickRenew = async (doc: FleetDocument) => {
    setRenewingDocId(doc.id);
    try {
      const currentExpiry = doc.expiry_date ? new Date(doc.expiry_date) : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);

      const { error: updateError } = await supabase
        .from('fleet_documents')
        .update({
          previous_expiry_date: doc.expiry_date,
          expiry_date: newExpiry.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (updateError) throw updateError;

      await supabase.from('fleet_document_renewals').insert({
        fleet_document_id: doc.id,
        previous_expiry_date: doc.expiry_date,
        new_expiry_date: newExpiry.toISOString().split('T')[0],
        renewal_cost: 0,
        currency: 'MAD',
        document_type: doc.document_type,
        notes: 'تجديد سريع تلقائي (+365 يوم)',
      });

      toast({
        title: t('تم التجديد بنجاح', 'Document renouvelé avec succès', 'Document successfully renewed'),
      });
      fetchVehicleData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('فشل التجديد', 'Échec du renouvellement', 'Renewal failed');
      toast({ title: t('خطأ', 'Erreur', 'Error'), description: message, variant: 'destructive' });
    } finally {
      setRenewingDocId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" dir={dir}>
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('جاري تحميل تفاصيل المركبة...', 'Chargement des détails...', 'Loading vehicle details...')}</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-20 text-rose-500 font-bold" dir={dir}>
        {t('المركبة غير موجودة', 'Véhicule introuvable', 'Vehicle not found')}
      </div>
    );
  }

  const isTruck = vehicleType === 'truck';
  const totalMaintCost = maintenanceRecords.reduce((sum, m) => sum + (m.amount || 0), 0);
  const expiredDocsCount = documents.filter((d) => d.expiry_date && new Date(d.expiry_date) < new Date()).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowRight className={`w-5 h-5 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
                {isTruck ? <TruckIcon className="w-6 h-6 text-primary" /> : <TrailerIcon className="w-6 h-6 text-purple-500" />}
                {isTruck ? t('تفاصيل الشاحنة', 'Détails du Camion', 'Truck Details') : t('تفاصيل المقطورة', 'Détails de la Remorque', 'Trailer Details')}
              </h1>
              <MatriculeBadge plate={vehicle.plate_number} variant="badge" size="sm" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{vehicle.model}</p>
          </div>
        </div>

        <Badge variant={vehicle.status === 'active' ? 'default' : 'secondary'} className="rounded-xl px-3 py-1">
          {vehicle.status === 'active' ? t('نشط ومتاح', 'Actif', 'Active') : vehicle.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('إجمالي الرحلات', 'Total Trajets', 'Total Trips')}</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{trips.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('الوثائق السارية', 'Documents Valides', 'Valid Documents')}</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{documents.length - expiredDocsCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('وثائق منتهية', 'Documents Expirés', 'Expired Documents')}</p>
              <p className="text-xl font-bold text-rose-600 mt-0.5">{expiredDocsCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('مصاريف الصيانة', 'Total Maintenance', 'Maintenance Total')}</p>
              <p className="text-lg font-bold font-mono text-foreground mt-0.5">{formatCurrency(totalMaintCost, 'MAD')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 h-11 rounded-xl mb-4">
          <TabsTrigger value="documents" className="rounded-lg text-xs flex gap-1.5">
            <FileText className="w-4 h-4" />
            {t('الوثائق والتراخيص', 'Documents et Licences', 'Documents & Licenses')} ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-lg text-xs flex gap-1.5">
            <Wrench className="w-4 h-4" />
            {t('الصيانة والوقود', 'Maintenance & Carburant', 'Maintenance & Fuel')} ({maintenanceRecords.length})
          </TabsTrigger>
          <TabsTrigger value="trips" className="rounded-lg text-xs flex gap-1.5">
            <MapPin className="w-4 h-4" />
            {t('تاريخ الرحلات', 'Historique des Trajets', 'Trip History')} ({trips.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-3">
          {documents.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-sm text-muted-foreground">{t('لا توجد وثائق مسجلة لهذه المركبة', 'Aucun document enregistré', 'No documents recorded for this vehicle')}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((doc) => {
                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                return (
                  <Card key={doc.id} className="p-4 border-border flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm text-foreground">{doc.document_type}</span>
                        {isExpired ? (
                          <Badge variant="destructive" className="text-[10px] py-0">{t('منتهي', 'Expiré', 'Expired')}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 text-emerald-600 border-emerald-500/30">{t('ساري', 'Valide', 'Valid')}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {t('تاريخ الانتهاء: ', 'Expire le : ', 'Expires: ')}{doc.expiry_date || '—'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={renewingDocId === doc.id}
                      onClick={() => handleQuickRenew(doc)}
                      className="rounded-xl text-xs flex items-center gap-1 hover:bg-emerald-500/10 hover:text-emerald-600"
                    >
                      {renewingDocId === doc.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>{t('تجديد سريع', 'Renouveler (+1 an)', 'Quick Renew (+1y)')}</span>
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-3">
          {maintenanceRecords.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-sm text-muted-foreground">{t('لا توجد سجلات صيانة أو وقود لهذه المركبة', 'Aucun enregistrement de maintenance', 'No maintenance records found')}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {maintenanceRecords.map((m) => (
                <Card key={m.id} className="p-3.5 border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      {m.expense_type === 'fuel' ? <Fuel className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{m.description || m.expense_type}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{m.maintenance_date ? new Date(m.maintenance_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR') : '—'}</span>
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm text-foreground">{formatCurrency(m.amount, m.currency || 'MAD')}</span>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trips" className="space-y-3">
          {trips.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-sm text-muted-foreground">{t('لا توجد رحلات مسجلة لهذه المركبة', 'Aucun trajet enregistré', 'No trips recorded')}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {trips.map((tr) => (
                <Card key={tr.id} className="p-3.5 border-border flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{tr.route}</span>
                      <Badge variant="outline" className="text-[10px]">{tr.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('تاريخ المغادرة: ', 'Départ : ', 'Departure: ')}{tr.departure_date}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/trips/${tr.id}`)}
                    className="rounded-xl text-xs"
                  >
                    {t('عرض ملف الرحلة', 'Voir le trajet', 'View Trip')}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
