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
import { calculateTripFinancials, type TripFinancialSummary } from '@/lib/profitability';
import { PodReportView } from '@/features/trips/components/PodReportView';
import type { TripOrder, Client, Driver, Truck, Trailer } from '@/types/database';
import { formatCurrency } from '@/lib/forex';
import { useLanguage } from '@/components/language-provider';
import {
  ArrowRight,
  MapPin,
  FileText,
  User,
  DollarSign,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  Box,
} from 'lucide-react';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';

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
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: tData, error: tError } = await supabase
        .from('trip_orders')
        .select('*')
        .eq('id', tripId)
        .single();
      if (tError) throw tError;
      setTrip(tData);

      const [cExpRes, cImpRes, drvRes, trkRes, trlRes] = await Promise.all([
        tData.client_id ? supabase.from('clients').select('*').eq('id', tData.client_id).single() : Promise.resolve({ data: null }),
        tData.client_import_id ? supabase.from('clients').select('*').eq('id', tData.client_import_id).single() : Promise.resolve({ data: null }),
        tData.driver_id ? supabase.from('drivers').select('*').eq('id', tData.driver_id).single() : Promise.resolve({ data: null }),
        tData.truck_id ? supabase.from('trucks').select('*').eq('id', tData.truck_id).single() : Promise.resolve({ data: null }),
        tData.trailer_id ? supabase.from('trailers').select('*').eq('id', tData.trailer_id).single() : Promise.resolve({ data: null }),
      ]);

      setClientExport(cExpRes.data);
      setClientImport(cImpRes.data);
      setDriver(drvRes.data);
      setTruck(trkRes.data);
      setTrailer(trlRes.data);

      const [advancesRes, fuelRes, finesRes, ferriesRes] = await Promise.all([
        tData.driver_id ? supabase.from('advances').select('*').eq('driver_id', tData.driver_id) : Promise.resolve({ data: [] }),
        tData.truck_id ? supabase.from('truck_maintenance').select('*').eq('truck_id', tData.truck_id) : Promise.resolve({ data: [] }),
        supabase.from('fine_penalties').select('*').eq('trip_order_id', tripId),
        supabase.from('ferry_expenses').select('*').eq('trip_order_id', tripId),
      ]);

      const fuelRecords = ((fuelRes.data || []) as Array<{ expense_type?: string; type?: string }>).filter((r) => {
        const expType = (r.expense_type || r.type || '').toLowerCase();
        return !expType || expType === 'fuel' || expType === 'carburant' || expType === 'gasoil';
      });

      const calc = calculateTripFinancials({
        trip: tData,
        advances: advancesRes.data || [],
        fuelRecords: fuelRecords as any,
        fines: finesRes.data || [],
        ferries: ferriesRes.data || [],
        driverName: drvRes.data?.name,
        truckPlate: trkRes.data?.plate_number,
        distanceKm: 1850,
        fuelLiters: 580,
      });
      setFinancials(calc);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('حدث خطأ أثناء تحميل تفاصيل الرحلة', 'Erreur lors du chargement des détails du trajet', 'An error occurred while loading trip details');
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase, toast, t]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`trip-${tripId}-updates`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trip_orders', filter: `id=eq.${tripId}` },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase, tripId]);

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-500 flex flex-col items-center" dir={dir}>
        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
        <p>{t('جاري تحميل تفاصيل الرحلة...', 'Chargement des détails du trajet...', 'Loading trip details...')}</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20 text-rose-500 font-semibold" dir={dir}>
        {t('الرحلة غير موجودة', 'Trajet introuvable', 'Trip not found')}
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          text: t('قيد الانتظار', 'En attente', 'Pending'),
          color: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
        };
      case 'in_transit':
        return {
          text: t('في الطريق (ذهاب)', 'En transit (Aller)', 'In transit (Outbound)'),
          color: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
        };
      case 'customs_export':
        return {
          text: t('التخليص الجمركي', 'Dédouanement', 'Customs clearance'),
          color: 'bg-purple-500/15 text-purple-700 border-purple-500/30',
        };
      case 'at_destination_export':
        return {
          text: t('في وجهة التفريغ', 'À destination de déchargement', 'At destination'),
          color: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30',
        };
      case 'en_route_inbound':
        return {
          text: t('في طريق العودة', 'En route retour (Retour)', 'On return route'),
          color: 'bg-teal-500/15 text-teal-700 border-teal-500/30',
        };
      case 'completed':
        return {
          text: t('تم التسليم', 'Livré', 'Delivered'),
          color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
        };
      case 'settled':
        return {
          text: t('تمت التسوية', 'Règlement effectué', 'Settled'),
          color: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
        };
      default:
        return { text: status, color: 'bg-slate-100 text-slate-800' };
    }
  };

  const statusInfo = getStatusInfo(trip.status);

  const docLinks = [
    {
      key: 'cmr_export_url',
      label: t('CMR الذهاب (تصدير)', 'CMR aller (Export)', 'Outbound CMR (Export)'),
      url: trip.cmr_export_url,
    },
    {
      key: 'cmr_import_url',
      label: t('CMR العودة (استيراد)', 'CMR retour (Import)', 'Return CMR (Import)'),
      url: trip.cmr_import_url,
    },
    {
      key: 'mrn_export_url',
      label: t('التصريح الجمركي (MRN)', "Déclaration d'exportation (MRN)", 'Customs declaration (MRN)'),
      url: trip.mrn_export_url,
    },
    {
      key: 'phyto_url',
      label: t('الشهادة الصحية (Phyto)', 'Certificat sanitaire (Phyto)', 'Phytosanitary certificate (Phyto)'),
      url: trip.phyto_url,
    },
    {
      key: 'facture_url',
      label: t('فاتورة البضاعة', 'Facture des marchandises', 'Goods invoice'),
      url: trip.facture_url,
    },
  ].filter((d) => d.url);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full"
            title={t('رجوع', 'Retour', 'Back')}
          >
            <ArrowRight className={`w-5 h-5 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              {t('تفاصيل الرحلة', 'Détails du trajet', 'Trip Details')} #{trip.id}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('ملف الشحنة اللوجستي والمالي الشامل', 'Dossier logistique et financier complet', 'Comprehensive Logistics and Financial File')}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
          {statusInfo.text}
        </span>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Route and Clients */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-500" />
              {t('المسار والعملاء', 'Itinéraire et clients', 'Route and Clients')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <Badge className="bg-blue-600">{t('ذهاب (تصدير)', 'Aller (Export)', 'Outbound (Export)')}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{trip.departure_date}</span>
              </div>
              <p className="font-bold text-foreground mb-1">{trip.route_export || trip.route}</p>
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <User className="w-3.5 h-3.5" />
                {t('العميل:', 'Client :', 'Client:')} {clientExport?.name || t('غير محدد', 'Non spécifié', 'Not specified')}
              </p>
              {trip.goods_description_export && (
                <p className="text-muted-foreground text-xs mt-1">
                  {t('البضاعة:', 'Marchandises :', 'Goods:')} {trip.goods_description_export}
                </p>
              )}
            </div>

            {(trip.route_import || clientImport) && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <Badge className="bg-emerald-600">{t('عودة (استيراد)', 'Retour (Import)', 'Return (Import)')}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {trip.loading_date_import || t('غير محدد', 'Non spécifié', 'Not specified')}
                  </span>
                </div>
                <p className="font-bold text-foreground mb-1">{trip.route_import}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <User className="w-3.5 h-3.5" />
                  {t('العميل:', 'Client :', 'Client:')} {clientImport?.name || t('غير محدد', 'Non spécifié', 'Not specified')}
                </p>
                {trip.goods_description_import && (
                  <p className="text-muted-foreground text-xs mt-1">
                    {t('البضاعة:', 'Marchandises :', 'Goods:')} {trip.goods_description_import}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Fleet Equipment */}
        <Card className="border-border shadow-xs flex flex-col">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TruckIcon className="w-4 h-4 text-amber-500" />
              {t('السائق والمعدات', 'Chauffeur et équipement', 'Driver and Equipment')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 flex-1">
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                {t('السائق المعين:', 'Chauffeur assigné :', 'Assigned Driver:')}
              </span>
              <span className="font-bold text-foreground">
                {driver?.name || t('غير مسند', 'Non assigné', 'Not assigned')}
              </span>
            </div>
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <TruckIcon className="w-4 h-4 text-blue-500" />
                {t('الشاحنة (الرأس):', 'Camion (Tracteur) :', 'Truck (Tractor):')}
              </span>
              <div className="text-end">
                <MatriculeBadge plate={truck?.plate_number || t('غير مسند', 'Non assigné', 'Not assigned')} variant="badge" size="xs" />
              </div>
            </div>
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <TrailerIcon className="w-4 h-4 text-purple-500" />
                {t('المقطورة:', 'Remorque :', 'Trailer:')}
              </span>
              <div className="text-end">
                <MatriculeBadge plate={trailer?.plate_number || t('غير مسند', 'Non assigné', 'Not assigned')} variant="badge" size="xs" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 h-12 rounded-xl mb-4">
          <TabsTrigger value="documents" className="rounded-lg text-sm flex gap-2">
            <FileText className="w-4 h-4 hidden sm:block" />
            {t('المستندات والعبور', 'Documents et transit', 'Documents and Transit')}
          </TabsTrigger>
          <TabsTrigger value="pod" className="rounded-lg text-sm flex gap-2">
            <ShieldCheck className="w-4 h-4 hidden sm:block" />
            {t('إثبات التسليم (POD)', 'Preuve de livraison (POD)', 'Proof of Delivery (POD)')}
          </TabsTrigger>
          <TabsTrigger value="financials" className="rounded-lg text-sm flex gap-2">
            <DollarSign className="w-4 h-4 hidden sm:block" />
            {t('الربحية (P&L)', 'Bénéfices (P&L)', 'Profitability (P&L)')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-amiri font-bold">
                  {t('وثائق الشحن والجمارك', "Documents d'expédition et douane", 'Shipping and Customs Documents')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {docLinks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 border border-dashed rounded-xl text-sm">
                    {t('لا توجد وثائق مرفوعة بعد', 'Aucun document téléversé', 'No documents uploaded yet')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {docLinks.map((doc) => (
                      <div
                        key={doc.key}
                        className="flex justify-between items-center p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" /> {doc.label}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => window.open(doc.url!, '_blank')}
                        >
                          <ExternalLink className={`w-3 h-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                          {t('معاينة', 'Aperçu', 'Preview')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-amiri font-bold">
                  {t('بيانات العبور البحري (Ferry)', 'Données de transit maritime (Ferry)', 'Maritime Transit Data (Ferry)')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-sm">
                <div className="flex justify-between p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <span className="text-muted-foreground">{t('شركة الملاحة:', 'Compagnie maritime :', 'Ferry Company:')}</span>
                  <span className="font-bold text-foreground">
                    {trip.ferry_company || t('غير محدد', 'Non spécifié', 'Not specified')}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <span className="text-muted-foreground">{t('رمز الحجز (Localizador):', 'Réf. réservation (Localizador) :', 'Booking Reference (Localizador):')}</span>
                  <span className="font-mono font-bold text-blue-600" dir="ltr">
                    {trip.ferry_localizador || 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pod">
          <PodReportView tripOrderId={tripId} />
        </TabsContent>

        <TabsContent value="financials">
          <Card className="border-border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-amiri font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {t('تقرير أرباح وخسائر الرحلة (P&L)', 'Rapport P&L du trajet', 'Trip P&L Report')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {financials ? (
                <div className="max-w-2xl mx-auto space-y-4 text-sm">
                  <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    <span className="font-bold text-blue-800 dark:text-blue-300">
                      {t('إجمالي إيراد الرحلة (تصدير + استيراد):', 'Revenu total du trajet (Export + Import) :', 'Total Trip Revenue (Export + Import):')}
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(financials.revenue, trip.price_type || 'MAD')}
                    </span>
                  </div>

                  <div className="ps-4 space-y-2 border-s-2 border-rose-200 dark:border-rose-900/50 pe-4">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('مصاريف الوقود:', 'Dépenses de carburant :', 'Fuel Expenses:')}</span>
                      <span className="font-mono text-rose-500">
                        -{formatCurrency(financials.fuelCost, 'MAD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('سلف ومصاريف السائق:', 'Avances chauffeur :', 'Driver Advances:')}</span>
                      <span className="font-mono text-rose-500">
                        -{formatCurrency(financials.advancesCost, 'MAD')}
                      </span>
                    </div>
                    {financials.ferryCost > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('تذاكر العبّارة (Ferry):', 'Billets de ferry :', 'Ferry Tickets:')}</span>
                        <span className="font-mono text-rose-500">
                          -{formatCurrency(financials.ferryCost, 'MAD')}
                        </span>
                      </div>
                    )}
                    {financials.finesCost > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('الغرامات والمخالفات:', 'Amendes et infractions :', 'Fines and Penalties:')}</span>
                        <span className="font-mono text-rose-500">
                          -{formatCurrency(financials.finesCost, 'MAD')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-900/30 mt-4">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 text-base">
                      {t('صافي الربح الفعلي:', 'Bénéfice net réel :', 'Actual Net Profit:')}
                    </span>
                    <div className="text-end">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg block">
                        {formatCurrency(financials.netProfit, 'MAD')}
                      </span>
                      <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {t('هامش الربح', 'Marge', 'Profit Margin')}: {financials.profitMarginPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  {t('جاري احتساب الربحية...', 'Calcul du profit en cours...', 'Calculating profitability...')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
