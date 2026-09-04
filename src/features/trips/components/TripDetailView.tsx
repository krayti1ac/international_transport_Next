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
import {
  ArrowRight, MapPin, FileText, User,
  DollarSign, ExternalLink, TrendingUp, RefreshCw, ShieldCheck, Box
} from 'lucide-react';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';

interface TripDetailViewProps {
  tripId: number;
}

export function TripDetailView({ tripId }: TripDetailViewProps) {
  const router = useRouter();
  const { toast } = useToast();
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
        tData.truck_id ? supabase.from('truck_maintenance').select('*').eq('type', 'fuel').eq('truck_id', tData.truck_id) : Promise.resolve({ data: [] }),
        supabase.from('fine_penalties').select('*').eq('trip_order_id', tripId),
        supabase.from('ferry_expenses').select('*').eq('trip_order_id', tripId),
      ]);

      const calc = calculateTripFinancials({
        trip: tData,
        advances: advancesRes.data || [],
        fuelRecords: fuelRes.data || [],
        fines: finesRes.data || [],
        ferries: ferriesRes.data || [],
        driverName: drvRes.data?.name,
        truckPlate: trkRes.data?.plate_number,
        distanceKm: 1850,
        fuelLiters: 580,
      });

      setFinancials(calc);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase, toast]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`trip-${tripId}-updates`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trip_orders', filter: `id=eq.${tripId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase, tripId]);

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-500 flex flex-col items-center">
        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
        جاري تحميل ملف الرحلة...
      </div>
    );
  }

  if (!trip) {
    return <div className="text-center py-20 text-rose-500">لم يتم العثور على الرحلة</div>;
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'قيد الانتظار', color: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' };
      case 'in_transit': return { text: 'في الطريق (Aller)', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30' };
      case 'customs_export': return { text: 'تخليص جمركي', color: 'bg-purple-500/15 text-purple-700 border-purple-500/30' };
      case 'at_destination_export': return { text: 'في وجهة التفريغ', color: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30' };
      case 'en_route_inbound': return { text: 'في طريق العودة (Retour)', color: 'bg-teal-500/15 text-teal-700 border-teal-500/30' };
      case 'completed': return { text: 'تم التسليم (Livrée)', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' };
      case 'settled': return { text: 'تمت التسوية', color: 'bg-slate-500/15 text-slate-700 border-slate-500/30' };
      default: return { text: status, color: 'bg-slate-100 text-slate-800' };
    }
  };

  const statusInfo = getStatusInfo(trip.status);
  const docLinks = [
    { key: 'cmr_export_url', label: 'CMR الذهاب (Export)', url: trip.cmr_export_url },
    { key: 'cmr_import_url', label: 'CMR العودة (Import)', url: trip.cmr_import_url },
    { key: 'mrn_export_url', label: 'بيان التصدير (MRN)', url: trip.mrn_export_url },
    { key: 'phyto_url', label: 'الشهادة الصحية (Phyto)', url: trip.phyto_url },
    { key: 'facture_url', label: 'فاتورة البضاعة', url: trip.facture_url },
  ].filter((d) => d.url);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              تفاصيل الرحلة #{trip.id}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">ملف التتبع اللوجستي والمالي الشامل</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
          {statusInfo.text}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-500" /> مسار الرحلة والعملاء
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <Badge className="bg-blue-600">ذهاب (Export)</Badge>
                <span className="font-mono text-xs text-muted-foreground">{trip.departure_date}</span>
              </div>
              <p className="font-bold text-foreground mb-1">{trip.route_export || trip.route}</p>
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <User className="w-3.5 h-3.5" /> العميل: {clientExport?.name || 'غير محدد'}
              </p>
              {trip.goods_description_export && (
                <p className="text-muted-foreground text-xs mt-1">البضاعة: {trip.goods_description_export}</p>
              )}
            </div>

            {(trip.route_import || clientImport) && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <Badge className="bg-emerald-600">عودة (Import)</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{trip.loading_date_import || 'غير محدد'}</span>
                </div>
                <p className="font-bold text-foreground mb-1">{trip.route_import}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <User className="w-3.5 h-3.5" /> العميل: {clientImport?.name || 'غير محدد'}
                </p>
                {trip.goods_description_import && (
                  <p className="text-muted-foreground text-xs mt-1">البضاعة: {trip.goods_description_import}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm flex flex-col">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TruckIcon className="w-4 h-4 text-amber-500" /> السائق والمعدات
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 flex-1">
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> السائق المسؤول:
              </span>
              <span className="font-bold text-foreground">{driver?.name || 'غير مسند'}</span>
            </div>
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <TruckIcon className="w-4 h-4 text-blue-500" /> الشاحنة (Tracteur):
              </span>
              <div className="text-right">
                <MatriculeBadge plate={truck?.plate_number || 'غير مسندة'} variant="badge" size="xs" />
              </div>
            </div>
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <TrailerIcon className="w-4 h-4 text-purple-500" /> المقطورة (Remorque):
              </span>
              <div className="text-right">
                <MatriculeBadge plate={trailer?.plate_number || 'غير مسندة'} variant="badge" size="xs" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 h-12 rounded-xl mb-4">
          <TabsTrigger value="documents" className="rounded-lg text-sm flex gap-2">
            <FileText className="w-4 h-4 hidden sm:block" /> وثائق وعبور
          </TabsTrigger>
          <TabsTrigger value="pod" className="rounded-lg text-sm flex gap-2">
            <ShieldCheck className="w-4 h-4 hidden sm:block" /> إثبات التسليم
          </TabsTrigger>
          <TabsTrigger value="financials" className="rounded-lg text-sm flex gap-2">
            <DollarSign className="w-4 h-4 hidden sm:block" /> الأرباح (P&L)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-amiri font-bold">مستندات الشحن والجمارك</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {docLinks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 border border-dashed rounded-xl text-sm">
                    لا توجد وثائق مرفوعة بعد
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
                          <ExternalLink className="w-3 h-3 ml-1" /> معاينة
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-amiri font-bold">بيانات العبور البحري (Ferry)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-sm">
                <div className="flex justify-between p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <span className="text-muted-foreground">شركة الملاحة:</span>
                  <span className="font-bold text-foreground">{trip.ferry_company || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <span className="text-muted-foreground">رقم الحجز (Localizador):</span>
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
                كشف الأرباح والخسائر للرحلة (P&L)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {financials ? (
                <div className="max-w-2xl mx-auto space-y-4 text-sm">
                  <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    <span className="font-bold text-blue-800 dark:text-blue-300">
                      إجمالي إيراد الرحلة (Export + Import):
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(financials.revenue, trip.price_type || 'MAD')}
                    </span>
                  </div>

                  <div className="pl-4 space-y-2 border-r-2 border-rose-200 dark:border-rose-900/50 pr-4">
                    <div className="flex justify-between text-muted-foreground">
                      <span>مصاريف الوقود:</span>
                      <span className="font-mono text-rose-500">
                        -{formatCurrency(financials.fuelCost, 'MAD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>سلف ومصروفات السائق:</span>
                      <span className="font-mono text-rose-500">
                        -{formatCurrency(financials.advancesCost, 'MAD')}
                      </span>
                    </div>
                    {financials.ferryCost > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>تذاكر العبّارة:</span>
                        <span className="font-mono text-rose-500">
                          -{formatCurrency(financials.ferryCost, 'MAD')}
                        </span>
                      </div>
                    )}
                    {financials.finesCost > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>الغرامات والمخالفات:</span>
                        <span className="font-mono text-rose-500">
                          -{formatCurrency(financials.finesCost, 'MAD')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-900/30 mt-4">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 text-base">
                      صافي الربح الفعلي:
                    </span>
                    <div className="text-left">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg block">
                        {formatCurrency(financials.netProfit, 'MAD')}
                      </span>
                      <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                        هامش {financials.profitMarginPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">جاري حساب الربية...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}