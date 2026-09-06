'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/forex';
import {
  Globe,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building2,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { ForexConverterWidget } from '@/features/treasury/components/ForexConverterWidget';
import { syncDailyForexRate } from '@/features/treasury/services/forex.actions';
import type { BankAccount, CashBox, ForexRate, ForexGainLossEntry } from '@/types/database';

export default function ForexManagementPage() {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [currentRate, setCurrentRate] = useState<number>(10.85);
  const [ratesHistory, setRatesHistory] = useState<ForexRate[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [gainLossEntries, setGainLossEntries] = useState<ForexGainLossEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ratesRes, banksRes, cashRes, fxEntriesRes] = await Promise.all([
        supabase.from('forex_rates').select('*').order('rate_date', { ascending: false }).limit(7),
        supabase.from('bank_accounts').select('*').eq('is_active', true),
        supabase.from('cash_boxes').select('*'),
        supabase.from('forex_gain_loss_entries').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      if (ratesRes.data && ratesRes.data.length > 0) {
        setRatesHistory(ratesRes.data);
        setCurrentRate(ratesRes.data[0].eur_to_mad || 10.85);
      }

      setBankAccounts(banksRes.data || []);
      setCashBoxes(cashRes.data || []);
      setGainLossEntries(fxEntriesRes.data || []);
    } catch (err: unknown) {
      console.warn('Forex data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncRate = async () => {
    setSyncing(true);
    try {
      const res = await syncDailyForexRate();
      if (res.success) {
        setCurrentRate(res.eurToMad);
        toast({
          title: '✅ تم تحديث سعر الصرف',
          description: `1 EUR = ${res.eurToMad} MAD (${res.source})`,
        });
        fetchData();
      } else {
        toast({ title: 'تنبيه', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSyncing(false);
    }
  };

  const totalBalances = useMemo(() => {
    let madBank = new Decimal(0);
    let eurBank = new Decimal(0);

    bankAccounts.forEach((acc) => {
      const b = new Decimal(acc.current_balance || 0);
      if (acc.currency === 'EUR') {
        eurBank = eurBank.plus(b);
      } else {
        madBank = madBank.plus(b);
      }
    });

    return {
      madTotal: madBank.toNumber(),
      eurTotal: eurBank.toNumber(),
    };
  }, [bankAccounts]);

  const totalGainLoss = useMemo(() => {
    let total = new Decimal(0);
    gainLossEntries.forEach((entry) => {
      const amt = new Decimal(entry.realized_gain_loss || 0);
      if (entry.entry_type === 'gain') {
        total = total.plus(amt);
      } else {
        total = total.minus(amt);
      }
    });
    return total.toNumber();
  }, [gainLossEntries]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            إدارة العملات الأجنبية وأسعار الصرف (Forex & Treasury)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة السيولة المزدوجة (EUR / MAD)، تسعير العملات الأجنبية، ورصد فروق الصرف المحققة
          </p>
        </div>

        <Button
          onClick={handleSyncRate}
          disabled={syncing}
          className="rounded-xl gap-2 font-bold shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>تحديث سعر الصرف الآن</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">أرصدة البنوك بالدرهم (MAD)</p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                {formatCurrency(totalBalances.madTotal, 'MAD')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">أرصدة الخزينة باليورو (€)</p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                {formatCurrency(totalBalances.eurTotal, 'EUR')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                totalGainLoss >= 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              {totalGainLoss >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">صافي فروق الصرف المحققة</p>
              <p
                className={`text-xl font-bold font-mono mt-0.5 ${
                  totalGainLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {totalGainLoss >= 0 ? '+' : ''}
                {formatCurrency(totalGainLoss, 'MAD')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ForexConverterWidget
        currentRate={currentRate}
        onRefreshRate={handleSyncRate}
        isLoading={syncing}
      />

      <Card className="border-border overflow-hidden">
        <CardHeader className="border-b border-border/70 py-3.5 px-5">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>سجل تسويات فروق أسعار الصرف (Realized FX Entries)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">جاري تحميل البيانات...</div>
          ) : gainLossEntries.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              لا توجد قيود فروق صرف مسجلة حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-semibold">المبلغ الأصلي</th>
                    <th className="py-3 px-4 text-start font-semibold">سعر الإصدار</th>
                    <th className="py-3 px-4 text-start font-semibold">سعر التسوية</th>
                    <th className="py-3 px-4 text-start font-semibold">الفارق المحقق</th>
                    <th className="py-3 px-4 text-start font-semibold">النوع</th>
                    <th className="py-3 px-4 text-start font-semibold">البيان</th>
                    <th className="py-3 px-4 text-end font-semibold">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-xs">
                  {gainLossEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground">
                        {entry.original_amount} {entry.original_currency}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{entry.original_rate}</td>
                      <td className="py-3 px-4 text-muted-foreground">{entry.settlement_rate}</td>
                      <td
                        className={`py-3 px-4 font-bold ${
                          entry.entry_type === 'gain' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {entry.entry_type === 'gain' ? '+' : '-'}
                        {formatCurrency(entry.realized_gain_loss, 'MAD')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.entry_type === 'gain'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                          }`}
                        >
                          {entry.entry_type === 'gain' ? 'أرباح صرف' : 'خسائر صرف'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-muted-foreground truncate max-w-xs">
                        {entry.notes || 'تسوية آلية'}
                      </td>
                      <td className="py-3 px-4 text-end text-muted-foreground whitespace-nowrap">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString('ar-MA') : '—'}
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
  );
}
