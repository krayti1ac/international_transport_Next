'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getProviderLedger, recordProviderPayment } from '@/features/providers/services/provider.actions';
import { Wrench, Truck, DollarSign, ArrowUpRight, Wallet, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import { DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';

interface LedgerEntry {
  id: number;
  source: 'repair_invoice' | 'truck_maintenance' | 'payment';
  date: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  runningBalance: number;
}

interface ProviderLedgerData {
  provider: { id: number; name: string };
  entries: LedgerEntry[];
  totalDebt: number;
  balances: Record<string, number>;
}

interface CashBox {
  id: number;
  code: string;
  created_at: string;
}

export default function ProviderLedgerScreen({ providerId }: { providerId: number }) {
  const [ledger, setLedger] = useState<ProviderLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedCashBoxId, setSelectedCashBoxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    const result = await getProviderLedger(providerId);
    if (result.success && result.data) {
      setLedger(result.data as ProviderLedgerData);
    } else {
      toast({
        title: 'خطأ',
        description: result.error || 'فشل في جلب البيانات',
        variant: 'destructive',
      });
    }
    setLoading(false);
  }, [providerId, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLedger();

      let cancelled = false;
      const fetchCashBoxes = async () => {
        try {
          const { data } = await supabase.from('cash_boxes').select('id, code, created_at');
          if (!cancelled) {
            setCashBoxes(fallbackArray(data, DEFAULT_CASH_BOXES as any));
          }
        } catch {
          if (!cancelled) {
            setCashBoxes(DEFAULT_CASH_BOXES as any);
          }
        }
      };
      fetchCashBoxes();
      return () => {
        cancelled = true;
      };
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchLedger, supabase]);

  const handleSettleDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'خطأ', description: 'المبلغ غير صحيح', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    const result = await recordProviderPayment(providerId, amount, parseInt(selectedCashBoxId));
    if (result.success) {
      toast({ title: 'تم تسجيل الدفعة بنجاح' });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setSelectedCashBoxId('');
      fetchLedger();
    } else {
      toast({ title: 'خطأ', description: result.error || 'فشل تسجيل الدفعة', variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  const availableCashBoxes = cashBoxes.filter((cb) => cb.code !== 'secretary_cash');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري تحميل دفتر الأستاذ...</p>
      </div>
    );
  }

  if (!ledger) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">دفتر الأستاذ - {ledger.provider.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">سجل الديون والمدفوعات للمزود</p>
        </div>
        <Button onClick={() => setShowPaymentModal(true)}>
          <Wallet className="w-4 h-4 ml-2" />
          تسوية دين
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-r-4 border-r-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              إجمالي الدين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {formatCurrency(ledger.totalDebt, 'MAD')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              فواتير الصيانة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {ledger.entries.filter((e) => e.source === 'repair_invoice').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">فاتورة مسجلة</p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              مصاريف الشاحنات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {ledger.entries.filter((e) => e.source === 'truck_maintenance').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">عملية صيانة / وقود</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-amiri text-foreground">الخط الزمني للمعاملات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ledger.entries.map((entry) => (
              <div
                key={`${entry.source}-${entry.id}`}
                className="flex items-center justify-between p-4 bg-muted/40 hover:bg-muted/70 transition-colors rounded-lg border-r-4"
                style={{
                  borderRightColor: entry.credit > 0 ? '#10b981' : entry.source === 'repair_invoice' ? '#f59e0b' : '#3b82f6',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${entry.credit > 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                    {entry.credit > 0 ? <ArrowUpRight className="w-5 h-5" /> : entry.source === 'repair_invoice' ? <Wrench className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{entry.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(entry.date).toLocaleDateString('ar-MA')}</span>
                      <span className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-bold uppercase">
                        {entry.source === 'repair_invoice' ? 'فاتورة' : entry.source === 'truck_maintenance' ? 'صيانة' : 'دفعة'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  {entry.debit > 0 && (
                    <p className="font-bold font-mono text-rose-600 dark:text-rose-400">
                      -{formatCurrency(entry.debit, entry.currency)}
                    </p>
                  )}
                  {entry.credit > 0 && (
                    <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(entry.credit, entry.currency)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    الرصيد: {formatCurrency(entry.runningBalance, entry.currency)}
                  </p>
                </div>
              </div>
            ))}
            {ledger.entries.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">لا توجد معاملات مسجلة لهذا المزود</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader>
              <CardTitle className="font-amiri">تسوية دين - {ledger.provider.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSettleDebt} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">المبلغ</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">صندوق الدفع</label>
                  <select
                    value={selectedCashBoxId}
                    onChange={(e) => setSelectedCashBoxId(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    required
                  >
                    <option value="">-- اختر الصندوق --</option>
                    {availableCashBoxes.map((cb) => (
                      <option key={cb.id} value={cb.id}>
                        {cb.code || `صندوق #${cb.id}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">يُمنع استخدام صندوق Secretary لهذه العملية</p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? 'جاري الحفظ...' : 'تسوية الدين'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
