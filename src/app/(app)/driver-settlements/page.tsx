'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import type { Driver, FinePenalty, TripOrder, Advance } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Plus,
  DollarSign,
  User,
  CheckCircle2,
  MinusCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import { DriverFineModal } from '@/features/drivers/components/DriverFineModal';
import { processDriverSettlementPayout } from '@/features/drivers/services/driver-fines.actions';

export default function DriverSettlementsPage() {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fines, setFines] = useState<FinePenalty[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const now = new Date();
  const [periodStart, setPeriodStart] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [bonusAmount, setBonusAmount] = useState('1500');
  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [drvRes, finesRes, advRes, tripsRes] = await Promise.all([
        supabase.from('drivers').select('*').order('name'),
        supabase.from('fine_penalties').select('*').order('created_at', { ascending: false }),
        supabase.from('advances').select('*').eq('status', 'approved'),
        supabase.from('trip_orders').select('*'),
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
  }, [supabase, selectedDriver]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const financialBreakdown = useMemo(() => {
    if (!selectedDriver) {
      return { base: 0, bonus: 0, advancesTotal: 0, finesTotal: 0, net: 0, safetyScore: 100 };
    }

    const base = new Decimal(selectedDriver.base_salary || 0);
    const bonus = new Decimal(parseFloat(bonusAmount) || 0);

    const advancesTotal = driverAdvances.reduce(
      (sum, a) => sum.plus(new Decimal(a.amount || 0)),
      new Decimal(0)
    );

    const finesTotal = pendingFines.reduce(
      (sum, f) => sum.plus(new Decimal(f.amount || 0)),
      new Decimal(0)
    );

    const net = base.plus(bonus).minus(advancesTotal).minus(finesTotal);

    let score = 100 - driverFines.length * 12;
    score = Math.max(10, Math.min(100, score));

    return {
      base: base.toNumber(),
      bonus: bonus.toNumber(),
      advancesTotal: advancesTotal.toNumber(),
      finesTotal: finesTotal.toNumber(),
      net: net.toNumber(),
      safetyScore: score,
    };
  }, [selectedDriver, bonusAmount, driverAdvances, pendingFines, driverFines]);

  const handleConfirmPayout = async () => {
    if (!selectedDriver) return;
    if (!confirm(`تأكيد صرف الراتب الصافي بقيمة ${formatCurrency(financialBreakdown.net, 'MAD')} للسائق ${selectedDriver.name}؟`)) {
      return;
    }

    setProcessingPayout(true);
    try {
      const res = await processDriverSettlementPayout({
        driverId: selectedDriver.id,
        baseSalary: financialBreakdown.base,
        bonusAmount: financialBreakdown.bonus,
        advancesToDeduct: financialBreakdown.advancesTotal,
        fineIdsToDeduct: pendingFines.map((f) => f.id),
        finesAmountToDeduct: financialBreakdown.finesTotal,
        periodStart,
        periodEnd,
      });

      if (res.success) {
        toast({
          title: '✅ تم اعتماد وصرف التسوية بنجاح',
          description: `تم قيد الراتب في الخزينة واقتطاع ${pendingFines.length} مخالفات معلقة.`,
        });
        fetchData();
      } else {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
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
            إدارة المخاطر وتسويات رواتب السائقين
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة سجل المخالفات الميدانية، تقييم السلامة، واحتساب الأجور الصافية آلياً
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setIsFineModalOpen(true)}
            className="rounded-xl gap-2 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مخالفة جديدة</span>
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
                <div className="space-y-1">
                  <label className="text-muted-foreground">الفترة المعتمدة:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="h-8 text-[11px] font-mono rounded-lg"
                      dir="ltr"
                    />
                    <Input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="h-8 text-[11px] font-mono rounded-lg"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">الراتب الأساسي:</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(financialBreakdown.base, 'MAD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">مكافآت الرحلات والإنتاجية:</span>
                    <Input
                      type="number"
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      className="w-24 h-7 text-xs font-mono font-bold text-emerald-600 text-end"
                      dir="ltr"
                    />
                  </div>

                  <div className="flex justify-between items-center text-rose-600">
                    <span className="flex items-center gap-1">
                      <MinusCircle className="w-3.5 h-3.5" />
                      إجمالي السلف المقتطعة:
                    </span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(financialBreakdown.advancesTotal, 'MAD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-rose-600">
                    <span className="flex items-center gap-1">
                      <MinusCircle className="w-3.5 h-3.5" />
                      اقتطاع الغرامات المعلقة ({pendingFines.length}):
                    </span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(financialBreakdown.finesTotal, 'MAD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border/80 text-sm font-black">
                    <span className="text-foreground">صافي المبلغ المستحق للصرف:</span>
                    <span className="font-mono text-emerald-600 text-base">
                      {formatCurrency(financialBreakdown.net, 'MAD')}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleConfirmPayout}
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
                  <span>سجل مخالفات السائق ({selectedDriver.name})</span>
                </CardTitle>
                <span className="text-xs text-muted-foreground font-mono">
                  معلق: {formatCurrency(financialBreakdown.finesTotal, 'MAD')}
                </span>
              </CardHeader>

              <CardContent className="p-0">
                {driverFines.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-500" />
                    <span>سجل السائق نظيف تماماً من أي مخالفات أو غرامات مرورية.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                          <th className="py-3 px-4 text-start font-semibold">المخالفة</th>
                          <th className="py-3 px-4 text-start font-semibold">المبلغ</th>
                          <th className="py-3 px-4 text-start font-semibold">الرحلة</th>
                          <th className="py-3 px-4 text-start font-semibold">حالة الاقتطاع</th>
                          <th className="py-3 px-4 text-start font-semibold">البيان</th>
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
                                {fine.deducted_from_settlement ? 'مقتطعة من الأجر' : 'قيد الخصم'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground truncate max-w-xs">
                              {fine.description || '—'}
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
