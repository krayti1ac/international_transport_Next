'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Calendar,
} from 'lucide-react';

interface ForexRate {
  id?: number;
  rate_date: string;
  eur_to_mad: number;
  mad_to_eur: number;
  source?: string;
  created_at?: string;
}

interface ForexGainLossEntry {
  id: number;
  trip_id?: number | null;
  invoice_id?: number | null;
  original_amount: number;
  original_currency: string;
  original_rate: number;
  settlement_rate: number;
  realized_gain_loss: number;
  entry_type: 'gain' | 'loss';
  created_at?: string;
}

export default function ForexPage() {
  const [activeTab, setActiveTab] = useState<'rates' | 'gain_loss'>('rates');
  const [rates, setRates] = useState<ForexRate[]>([]);
  const [gainLossEntries, setGainLossEntries] = useState<ForexGainLossEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);

  // Form for manual rate
  const [manualRate, setManualRate] = useState({
    rate_date: '',
    eur_to_mad: '',
    mad_to_eur: '',
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setManualRate((prev) => ({
      ...prev,
      rate_date: new Date().toISOString().split('T')[0],
    }));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ratesRes, glRes] = await Promise.all([
        supabase.from('forex_rates').select('*').order('rate_date', { ascending: false }),
        supabase.from('forex_gain_loss_entries').select('*').order('created_at', { ascending: false }),
      ]);

      if (ratesRes.data) {
        setRates(ratesRes.data as ForexRate[]);
      }
      if (glRes.data) {
        setGainLossEntries(glRes.data as ForexGainLossEntry[]);
      }
    } catch (err: unknown) {
      console.error('Error loading forex data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Sync using open.er-api.com
  const handleSyncLive = async () => {
    setIsSyncingLive(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/EUR');
      if (!res.ok) throw new Error('فشل الاتصال بخادم أسعار الصرف');
      const data = await res.json();
      const eurToMad = data?.rates?.MAD;
      if (!eurToMad) throw new Error('لم يتم العثور على سعر صرف الدرهم');

      const madToEur = 1 / eurToMad;
      const today = new Date().toISOString().split('T')[0];

      // Upsert into forex_rates
      const { error } = await supabase.from('forex_rates').upsert(
        {
          rate_date: today,
          eur_to_mad: Number(eurToMad.toFixed(4)),
          mad_to_eur: Number(madToEur.toFixed(6)),
          source: 'api_live',
        },
        { onConflict: 'rate_date' }
      );

      if (error) throw error;

      toast({
        title: 'تم التحديث بنجاح',
        description: `سعر اليوم: 1 EUR = ${Number(eurToMad).toFixed(4)} MAD`,
      });
      loadData();
    } catch (err: unknown) {
      toast({
        title: 'خطأ في جلب السعر الحي',
        description: err instanceof Error ? err.message : 'تعذر جلب سعر الصرف',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingLive(false);
    }
  };

  const handleManualRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eurMad = parseFloat(manualRate.eur_to_mad);
    let madEur = parseFloat(manualRate.mad_to_eur);

    if (isNaN(eurMad) || eurMad <= 0) {
      toast({ title: 'خطأ', description: 'يرجى إدخال سعر EUR إلى MAD بشكل صحيح', variant: 'destructive' });
      return;
    }

    if (isNaN(madEur) || madEur <= 0) {
      madEur = 1 / eurMad;
    }

    try {
      const { error } = await supabase.from('forex_rates').upsert(
        {
          rate_date: manualRate.rate_date,
          eur_to_mad: Number(eurMad.toFixed(4)),
          mad_to_eur: Number(madEur.toFixed(6)),
          source: 'manual',
        },
        { onConflict: 'rate_date' }
      );

      if (error) throw error;

      toast({ title: 'تم الحفظ', description: 'تم تسجيل سعر الصرف بنجاح' });
      setIsAddRateOpen(false);
      setManualRate({
        rate_date: new Date().toISOString().split('T')[0],
        eur_to_mad: '',
        mad_to_eur: '',
      });
      loadData();
    } catch {
      toast({ title: 'خطأ', description: 'فشل في حفظ سعر الصرف', variant: 'destructive' });
    }
  };

  // Calculations for Gain/Loss
  const totalGain = useMemo(() => {
    return gainLossEntries
      .filter((e) => e.entry_type === 'gain')
      .reduce((acc, curr) => acc + (Number(curr.realized_gain_loss) || 0), 0);
  }, [gainLossEntries]);

  const totalLoss = useMemo(() => {
    return gainLossEntries
      .filter((e) => e.entry_type === 'loss')
      .reduce((acc, curr) => acc + (Number(curr.realized_gain_loss) || 0), 0);
  }, [gainLossEntries]);

  const netGainLoss = totalGain - totalLoss;

  const latestRate = rates[0];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <CircleDollarSign className="w-7 h-7 text-purple-400" />
            أسعار الصرف وفروق العملات المحققة (Forex)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            متابعة أسعار صرف اليورو والدرهم المغربي وحساب الفروقات الربحية والمحققة للرحلات والفواتير الدولية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSyncLive}
            disabled={isSyncingLive}
            variant="outline"
            className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingLive ? 'animate-spin' : ''}`} />
            <span>تحديث السعر المباشر الآن</span>
          </Button>

          <Button
            onClick={() => setIsAddRateOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سعر يدوي</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80">
        <button
          type="button"
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'rates'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CircleDollarSign className="w-4 h-4" />
          <span>سجل أسعار الصرف ({rates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gain_loss')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'gain_loss'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>فروق الصرف المحققة ({gainLossEntries.length})</span>
        </button>
      </div>

      {/* TAB 1: RATES */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          {/* Top Live Rates Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">آخر سعر صرف مسجل (EUR → MAD)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">
                  {latestRate ? `1 € = ${latestRate.eur_to_mad} MAD` : 'غير محدد'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  بتاريخ: {latestRate?.rate_date || '—'} ({latestRate?.source === 'api_live' ? 'سعر حي' : 'يدوي'})
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">السعر المقابل (MAD → EUR)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">
                  {latestRate ? `1 MAD = ${latestRate.mad_to_eur} €` : 'غير محدد'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">معدل التحويل للدرهم إلى اليورو</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">إجمالي الأيام المسجلة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{rates.length}</div>
                <p className="text-xs text-muted-foreground mt-1">تاريخ توثيق أسعار العملات</p>
              </CardContent>
            </Card>
          </div>

          {/* Rates Table */}
          <Card className="bg-card border-border/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">سعر اليورو مقابل الدرهم (1 EUR)</th>
                    <th className="p-3">سعر الدرهم مقابل اليورو (1 MAD)</th>
                    <th className="p-3">المصدر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        جاري تحميل أسعار الصرف...
                      </td>
                    </tr>
                  ) : rates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        لا توجد أسعار صرف مسجلة. انقر على &quot;تحديث السعر المباشر الآن&quot; للمزامنة.
                      </td>
                    </tr>
                  ) : (
                    rates.map((rate, idx) => (
                      <tr key={rate.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-medium text-foreground flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          {rate.rate_date}
                        </td>
                        <td className="p-3 font-bold text-purple-400">
                          {rate.eur_to_mad} MAD
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {rate.mad_to_eur} €
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              rate.source === 'api_live'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }
                          >
                            {rate.source === 'api_live' ? '⚡ API مباشر' : 'يدوي'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: GAIN / LOSS */}
      {activeTab === 'gain_loss' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">إجمالي أرباح الصرف (FX Gain)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-5 h-5" />
                  +{totalGain.toFixed(2)} MAD
                </div>
                <p className="text-xs text-muted-foreground mt-1">مكاسب ناتجة عن تغير سعر التحويل</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">إجمالي خسائر الصرف (FX Loss)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-400 flex items-center gap-1">
                  <TrendingDown className="w-5 h-5" />
                  -{totalLoss.toFixed(2)} MAD
                </div>
                <p className="text-xs text-muted-foreground mt-1">فروقات سلبية عند التسوية</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">صافي فروق الصرف المحققة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${netGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netGainLoss >= 0 ? `+${netGainLoss.toFixed(2)}` : netGainLoss.toFixed(2)} MAD
                </div>
                <p className="text-xs text-muted-foreground mt-1">الرصيد الصافي للأرباح والخسائر</p>
              </CardContent>
            </Card>
          </div>

          {/* Gain/Loss Table */}
          <Card className="bg-card border-border/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">رقم العملية</th>
                    <th className="p-3">المرجع (رحلة / فاتورة)</th>
                    <th className="p-3">المبلغ الأصلي</th>
                    <th className="p-3">السعر الأولي</th>
                    <th className="p-3">سعر التسوية</th>
                    <th className="p-3">الفرق المحقق</th>
                    <th className="p-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {gainLossEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        لا توجد فروق صرف محققة مسجلة حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    gainLossEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono">#{entry.id}</td>
                        <td className="p-3">
                          {entry.trip_id ? (
                            <span className="font-semibold text-foreground">رحلة #{entry.trip_id}</span>
                          ) : entry.invoice_id ? (
                            <span className="font-semibold text-foreground">فاتورة #{entry.invoice_id}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 font-bold">
                          {entry.original_amount} {entry.original_currency}
                        </td>
                        <td className="p-3 font-mono">{entry.original_rate} MAD</td>
                        <td className="p-3 font-mono">{entry.settlement_rate} MAD</td>
                        <td className="p-3 font-bold">
                          <span className={entry.entry_type === 'gain' ? 'text-emerald-400' : 'text-rose-400'}>
                            {entry.entry_type === 'gain' ? '+' : '-'}
                            {Number(entry.realized_gain_loss).toFixed(2)} MAD
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            className={
                              entry.entry_type === 'gain'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }
                          >
                            {entry.entry_type === 'gain' ? 'ربح تحويل' : 'خسارة تحويل'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Manual Rate Modal */}
      {isAddRateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5 text-purple-400" />
                إضافة سعر صرف يدوي
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualRateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">التاريخ</label>
                <Input
                  type="date"
                  required
                  value={manualRate.rate_date}
                  onChange={(e) => setManualRate({ ...manualRate, rate_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">1 EUR = كم بالدرهم المغربي (MAD)؟</label>
                <Input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="مثال: 10.8500"
                  value={manualRate.eur_to_mad}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = parseFloat(val);
                    const inv = num > 0 ? (1 / num).toFixed(6) : '';
                    setManualRate({ ...manualRate, eur_to_mad: val, mad_to_eur: inv });
                  }}
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">1 MAD = كم باليورو (EUR)؟ (تلقائي)</label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="مثال: 0.092166"
                  value={manualRate.mad_to_eur}
                  onChange={(e) => setManualRate({ ...manualRate, mad_to_eur: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddRateOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                >
                  حفظ سعر الصرف
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
