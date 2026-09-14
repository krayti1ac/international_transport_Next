'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import { useFiscalStore } from '@/lib/stores/fiscal-store';
import type { Driver, FinePenalty, TripOrder, Advance } from '@/types/database';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  Calculator,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Plus,
  User,
  CheckCircle2,
  MinusCircle,
  TrendingUp,
} from 'lucide-react';

import { formatCurrency } from '@/lib/forex';
import { DriverFineModal } from '@/features/drivers/components/DriverFineModal';
import { processDriverSettlementPayout } from '@/features/drivers/services/driver-fines.actions';

export default function DriverSettlementsPage() {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const { startDate, endDate } = useFiscalStore();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fines, setFines] = useState<FinePenalty[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isFineModalOpen, setIsFineModalOpen] = useState(false);

  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [drvRes, finesRes, advRes, tripsRes] = await Promise.all([
        supabase.from('drivers').select('*').order('name'),
        supabase
          .from('fine_penalties')
          .select('*')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('advances')
          .select('*')
          .eq('status', 'approved')
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('trip_orders')
          .select('*')
          .gte('departure_date', startDate)
          .lte('departure_date', endDate),
      ]);

      setDrivers(drvRes.data || []);
      setFines(finesRes.data || []);
      setAdvances(advRes.data || []);
      setTrips(tripsRes.data || []);

      if (drvRes.data && drvRes.data.length > 0 && !selectedDriver) {
        setSelectedDriver(drvRes.data[0]);
      }
    } catch (err: unknown) {
      console.warn('Driver settlements data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, startDate, endDate, selectedDriver]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('settlements-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fine_penalties' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advances' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_salaries' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_orders' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const driverFines = useMemo(() => {
    if (!selectedDriver) return [];
    return fines.filter((f) => f.driver_id === selectedDriver.id);
  }, [fines, selectedDriver]);

  const pendingFines = useMemo(() => {
    return driverFines.filter((f) => !f.deducted_from_settlement);
  }, [driverFines]);

  const driverAdvances = useMemo(() => {
    if (!selectedDriver) return [];
    return advances.filter((a) => a.driver_id === selectedDriver.id && !a.is_deleted);
  }, [advances, selectedDriver]);

  const completedTrips = useMemo(() => {
    if (!selectedDriver) return [];
    return trips.filter((t) => t.driver_id === selectedDriver.id && ['completed', 'delivered', 'settled'].includes(t.status));
  }, [trips, selectedDriver]);

  const financialBreakdown = useMemo(() => {
    if (!selectedDriver) {
      return { base: 0, autoBonus: 0, advancesTotal: 0, finesTotal: 0, net: 0, safetyScore: 100 };
    }

    Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

    const base = new Decimal(selectedDriver.base_salary || 0);
    const bonusPercentage = new Decimal(selectedDriver.bonus_percentage || 0).dividedBy(100);

    const totalTripRevenue = completedTrips.reduce(
      (sum, t) => sum.plus(new Decimal(t.price || 0)),
      new Decimal(0)
    );
    const autoBonus = totalTripRevenue.times(bonusPercentage);

    const advancesTotal = driverAdvances.reduce(
      (sum, a) => sum.plus(new Decimal(a.amount || 0)),
      new Decimal(0)
    );

    const finesTotal = pendingFines.reduce(
      (sum, f) => sum.plus(new Decimal(f.amount || 0)),
      new Decimal(0)
    );

    const net = base.plus(autoBonus).minus(advancesTotal).minus(finesTotal);

    let score = 100 - driverFines.length * 12;
    score = Math.max(10, Math.min(100, score));

    return {
      base: base.toNumber(),
      autoBonus: autoBonus.toNumber(),
      advancesTotal: advancesTotal.toNumber(),
      finesTotal: finesTotal.toNumber(),
      net: net.toNumber(),
      safetyScore: score,
    };
  }, [selectedDriver, completedTrips, driverAdvances, pendingFines, driverFines]);

  const handleConfirmPayout = async () => {
    if (!selectedDriver) return;

    setIsPayoutDialogOpen(false);
    setProcessingPayout(true);

    try {
      const res = await processDriverSettlementPayout({
        driverId: selectedDriver.id,
        baseSalary: financialBreakdown.base,
        bonusAmount: financialBreakdown.autoBonus,
        advancesToDeduct: financialBreakdown.advancesTotal,
        fineIdsToDeduct: pendingFines.map((f) => f.id),
        finesAmountToDeduct: financialBreakdown.finesTotal,
        periodStart: startDate,
        periodEnd: endDate,
      });

      if (res.success) {
        toast({
          title: 'تم اعتماد وصرف التسوية بنجاح',
          description: 'تم قيد الراتب وتصفير السلف والمخالفات للفترة المحددة.',
        });
        fetchData();
      } else {
        toast({ title: 'خطأ في عملية الصرف', description: res.error, variant: 'destructive' });
      }
    } finally {
      setProcessingPayout(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" />
            تسويات الأجور وإدارة المخاطر
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            الاحتساب الآلي للأجور والعمولات واقتطاع السلف والغرامات وفقاً للفترة المحاسبية المغلقة
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setIsFineModalOpen(true)}
            className="rounded-xl gap-2 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مخالفة</span>
          </Button>

          <Button variant="outline" onClick={fetchData} disabled={loading} className="rounded-xl h-10 w-10 p-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/60">
        {drivers.map((drv) => {
          const isSelected = selectedDriver?.id === drv.id;
          const drvFinesCount = fines.filter((f) => f.driver_id === drv.id && !f.deducted_from_settlement).length;

          return (
            <button
              key={drv.id}
              onClick={() => setSelectedDriver(drv)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border hover:border-border/80'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{drv.name}</span>
              {drvFinesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                  {drvFinesCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDriver && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-border shadow-xs">
              <CardHeader className="border-b border-border/70 py-3.5 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  <span>احتساب الأجر الصافي</span>
                </CardTitle>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    financialBreakdown.safetyScore >= 80
                      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                  }`}
                >
                  مؤشر السلامة: {financialBreakdown.safetyScore}%
                </span>
              </CardHeader>

              <CardContent className="p-4 space-y-3.5 text-xs">
                <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-3">

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">الراتب الأساسي:</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(financialBreakdown.base, 'MAD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <TrendingUp className="w-3.5 h-3.5" />
                      عمولة الرحلات (آلي):
                    </span>
                    <span className="font-mono font-bold text-emerald-600">
                      +{formatCurrency(financialBreakdown.autoBonus, 'MAD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-rose-600 pt-2 border-t border-border/50">
                    <span className="flex items-center gap-1">
                      <MinusCircle className="w-3.5 h-3.5" />
                      إجمالي سلف الفترة ({driverAdvances.length}):
                    </span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(financialBreakdown.advancesTotal, 'MAD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-rose-600">
                    <span className="flex items-center gap-1">
                      <MinusCircle className="w-3.5 h-3.5" />
                      مخالفات قيد الخصم ({pendingFines.length}):
                    </span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(financialBreakdown.finesTotal, 'MAD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-border/80 text-sm font-black">
                    <span className="text-foreground">صافي الدفع:</span>
                    <span className="font-mono text-emerald-600 text-base">
                      {formatCurrency(financialBreakdown.net, 'MAD')}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => setIsPayoutDialogOpen(true)}
                  disabled={processingPayout || financialBreakdown.net <= 0}
                  className="w-full h-10 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد وصرف كشف الأجر</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border overflow-hidden">
              <CardHeader className="border-b border-border/70 py-3.5 px-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>سجل مخالفات السائق ({selectedDriver.name}) ضمن الفترة</span>
                </CardTitle>
                <span className="text-xs text-muted-foreground font-mono">
                  إجمالي الخصم: {formatCurrency(financialBreakdown.finesTotal, 'MAD')}
                </span>
              </CardHeader>

              <CardContent className="p-0">
                {driverFines.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-500" />
                    <span>سجل السائق نظيف تماماً من أي مخالفات أو غرامات خلال هذه الفترة المحاسبية.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                          <th className="py-3 px-4 text-start font-semibold">المخالفة</th>
                          <th className="py-3 px-4 text-start font-semibold">المبلغ</th>
                          <th className="py-3 px-4 text-start font-semibold">الرحلة</th>
                          <th className="py-3 px-4 text-start font-semibold">الحالة</th>
                          <th className="py-3 px-4 text-end font-semibold">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 text-xs">
                        {driverFines.map((fine) => (
                          <tr key={fine.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-semibold text-foreground">{fine.fine_type}</td>
                            <td className="py-3 px-4 font-mono font-bold text-rose-600">
                              -{formatCurrency(fine.amount, fine.currency)}
                            </td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">
                              {fine.trip_order_id ? `#${fine.trip_order_id}` : 'عام'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  fine.deducted_from_settlement
                                    ? 'bg-slate-500/15 text-slate-600 border-slate-500/30'
                                    : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                                }`}
                              >
                                {fine.deducted_from_settlement ? 'مقتطعة' : 'قيد الخصم'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-end text-muted-foreground font-mono whitespace-nowrap">
                              {new Date(fine.created_at).toLocaleDateString('ar-MA')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <AlertDialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد صرف التسوية المالية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من صرف الراتب الصافي بقيمة <strong className="text-emerald-600">{formatCurrency(financialBreakdown.net, 'MAD')}</strong> للسائق {selectedDriver?.name}؟
              <br />سيتم تسجيل الحركة في الخزينة وتصفير السلف والمخالفات المرتبطة بهذه الفترة. هذه العملية لا يمكن التراجع عنها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction onClick={handleConfirmPayout} className="bg-emerald-600 hover:bg-emerald-700">
              تأكيد الصرف واعتماد القيود
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DriverFineModal
        isOpen={isFineModalOpen}
        onClose={() => setIsFineModalOpen(false)}
        onSaved={fetchData}
        drivers={drivers}
        trips={trips}
        preselectedDriverId={selectedDriver?.id}
      />
    </div>
  );
}
