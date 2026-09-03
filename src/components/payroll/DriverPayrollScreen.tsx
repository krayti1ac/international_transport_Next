'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  DollarSign,
  TrendingUp,
  Wallet,
  Printer,
  CheckCircle2,
  Calendar,
  MapPin,
  FileText,
  AlertOctagon,
} from 'lucide-react';
import { DEFAULT_DRIVERS, fallbackArray } from '@/lib/default-data';
import type { Driver } from '@/types/database';
import { formatCurrency } from '@/lib/forex';
import { calculateDriverPayroll } from '@/features/hr/services/payroll.actions';
import { PaySalaryDialog } from '@/components/payroll/PaySalaryDialog';
import { PayslipPrintModal } from '@/components/payroll/PayslipPrintModal';

export default function DriverPayrollScreen() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [payrollData, setPayrollData] = useState<Awaited<ReturnType<typeof calculateDriverPayroll>>['data'] | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  const initializedRef = useRef(false);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchInitialData = useCallback(async () => {
    try {
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*')
        .order('name');

      if (driversError) throw driversError;

      const loadedDrivers = fallbackArray(driversData, DEFAULT_DRIVERS);
      setDrivers(loadedDrivers);

      if (loadedDrivers.length > 0 && !selectedDriverId) {
        setSelectedDriverId(loadedDrivers[0].id);
      }
    } catch {
      const fallbackList = DEFAULT_DRIVERS;
      setDrivers(fallbackList);
      if (fallbackList.length > 0 && !selectedDriverId) {
        setSelectedDriverId(fallbackList[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDriverId, supabase]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchInitialData();
    }
  }, [fetchInitialData]);

  const handleCalculate = useCallback(async () => {
    if (!selectedDriverId) return;

    setCalculating(true);
    setPayrollData(null);
    setAlreadyPaid(false);

    try {
      const result = await calculateDriverPayroll(selectedDriverId, selectedMonth, selectedYear);

      if (!result.success || !result.data) {
        toast({
          title: 'خطأ',
          description: result.error || 'حدث خطأ أثناء احتساب الراتب',
          variant: 'destructive',
        });
        setCalculating(false);
        return;
      }

      setPayrollData(result.data);

      const { data: salaryCheck, error: salaryError } = await supabase
        .from('driver_salaries')
        .select('id')
        .eq('driver_id', selectedDriverId)
        .eq('status', 'settled')
        .gte('period_start', result.data.periodStart)
        .lte('period_end', result.data.periodEnd)
        .maybeSingle();

      if (salaryError) {
        console.warn('Salary check warning:', salaryError);
      }

      setAlreadyPaid(!!salaryCheck);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCalculating(false);
    }
  }, [selectedDriverId, selectedMonth, selectedYear, supabase, toast]);

  useEffect(() => {
    if (selectedDriverId && initializedRef.current) {
      handleCalculate();
    }
  }, [selectedDriverId, selectedMonth, selectedYear, handleCalculate]);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  const handlePaySuccess = useCallback(() => {
    setShowPayDialog(false);
    setAlreadyPaid(true);
    if (selectedDriverId) {
      handleCalculate();
    }
    toast({
      title: 'تم صرف الراتب بنجاح',
      description: 'تم تسجيل العملية في الخزينة وتحديث السجلات',
    });
  }, [selectedDriverId, handleCalculate, toast]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">الرواتب الشهرية للسائقين</h1>
          <p className="text-sm text-muted-foreground mt-0.5">احتساب الرواتب، عمولات الرحلات، اقتطاع السلف والغرامات</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <User className="w-4 h-4" />
                السائق
              </label>
              <select
                value={selectedDriverId || ''}
                onChange={(e) => setSelectedDriverId(Number(e.target.value))}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="">-- اختر السائق --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-[160px] space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                الشهر
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-[120px] space-y-2">
              <label className="text-sm font-medium text-foreground">السنة</label>
              <Input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                min={2020}
                max={2030}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {payrollData && selectedDriver && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-r-4 border-r-blue-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  الراتب الأساسي وعدد الرحلات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(payrollData.baseSalary, 'MAD')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {payrollData.trips.length} رحلة مكتملة في هذه الفترة
                </p>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-emerald-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  عمولات الرحلات ({payrollData.bonusPercentage}%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(payrollData.totalBonus, 'MAD')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  إجمالي إيرادات الرحلات: {formatCurrency(payrollData.totalTripsRevenue, 'MAD')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  صافي المستحق للصرف
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(payrollData.netPay, 'MAD')}
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  after advances ({formatCurrency(payrollData.totalAdvances, 'MAD')}) and fines ({formatCurrency(payrollData.totalFines, 'MAD')})
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setShowPrintModal(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              تصدير Payslip (PDF)
            </Button>
            <Button
              onClick={() => setShowPayDialog(true)}
              disabled={alreadyPaid}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {alreadyPaid ? 'تم الصرف بالفعل' : 'صرف وصرف الراتب'}
            </Button>
          </div>

          {/* Trips Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-amiri text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                الرحلات المساهمة في العمولة ({payrollData.trips.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payrollData.trips.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">لا توجد رحلات مكتملة في هذه الفترة</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-right py-3 px-4 font-medium">#</th>
                        <th className="text-right py-3 px-4 font-medium">المسار</th>
                        <th className="text-right py-3 px-4 font-medium">تاريخ الانطلاق</th>
                        <th className="text-right py-3 px-4 font-medium">الحالة</th>
                        <th className="text-right py-3 px-4 font-medium">السعر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollData.trips.map((trip) => (
                        <tr key={trip.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono text-muted-foreground">#{trip.id}</td>
                          <td className="py-3 px-4 font-medium text-foreground">{trip.route}</td>
                          <td className="py-3 px-4 text-muted-foreground">{trip.departure_date}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              trip.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                                : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25'
                            }`}>
                              {trip.status === 'completed' ? 'مكتملة' : 'مسددة'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            {formatCurrency(trip.price, 'MAD')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border font-bold">
                        <td colSpan={4} className="py-3 px-4 text-left text-muted-foreground">
                          Total Trips Revenue
                        </td>
                        <td className="py-3 px-4 font-mono text-primary">
                          {formatCurrency(payrollData.totalTripsRevenue, 'MAD')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deductions Details */}
          {(payrollData.advances.length > 0 || payrollData.fines.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {payrollData.advances.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      السلف المعتمدة ({payrollData.advances.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                      {payrollData.advances.map((adv) => (
                        <div key={adv.id} className="flex justify-between p-2.5 bg-muted/40 rounded-lg border border-border">
                          <div>
                            <span className="font-bold text-foreground">#{adv.id}</span> - {adv.reason || 'سلفة عادية'}
                            <span className="text-muted-foreground block">{adv.date}</span>
                          </div>
                          <span className="font-bold font-mono text-amber-700 dark:text-amber-300">
                            -{formatCurrency(adv.amount, adv.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {payrollData.fines.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      المخالفات والغرامات ({payrollData.fines.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                      {payrollData.fines.map((fine) => (
                        <div key={fine.id} className="flex justify-between p-2.5 bg-muted/40 rounded-lg border border-border">
                          <div>
                            <span className="font-bold text-foreground">{fine.fine_type || fine.description || 'مخالفة'}</span>
                            <span className="text-muted-foreground block">{new Date(fine.created_at).toLocaleDateString('ar-MA')}</span>
                          </div>
                          <span className="font-bold font-mono text-rose-700 dark:text-rose-300">
                            -{formatCurrency(fine.amount, fine.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {!payrollData && !calculating && (
        <Card className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground">يرجى اختيار سائق لعرض تفاصيل الراتب</p>
        </Card>
      )}

      {calculating && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">جاري احتساب الراتب...</p>
        </div>
      )}

      {/* Modals */}
      {payrollData && selectedDriver && (
        <>
          <PaySalaryDialog
            isOpen={showPayDialog}
            onClose={() => setShowPayDialog(false)}
            onSuccess={handlePaySuccess}
            driverName={selectedDriver.name}
            netPay={payrollData.netPay}
            currency="MAD"
            driverId={selectedDriver.id}
            month={selectedMonth}
            year={selectedYear}
          />
          <PayslipPrintModal
            isOpen={showPrintModal}
            onClose={() => setShowPrintModal(false)}
            driver={selectedDriver}
            trips={payrollData.trips}
            advances={payrollData.advances}
            fines={payrollData.fines}
            baseSalary={payrollData.baseSalary}
            bonusPercentage={payrollData.bonusPercentage}
            totalBonus={payrollData.totalBonus}
            totalAdvances={payrollData.totalAdvances}
            totalFines={payrollData.totalFines}
            netPay={payrollData.netPay}
            currency="MAD"
            periodStart={payrollData.periodStart}
            periodEnd={payrollData.periodEnd}
          />
        </>
      )}
    </div>
  );
}
