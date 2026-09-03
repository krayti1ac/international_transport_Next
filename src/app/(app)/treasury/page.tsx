'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TreasuryTransaction, BankAccount, CashBox } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Building2,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Receipt,
  Wallet,
  ArrowRightLeft,
  Layers,
  X
} from 'lucide-react';
import { formatCurrency, groupBalancesByCurrency } from '@/lib/forex';
import { DEFAULT_BANK_ACCOUNTS, DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';

export default function TreasuryPage() {
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    type: 'trip_revenue',
    amount: '',
    currency: 'MAD',
    destinationType: 'bank',
    destinationId: '',
    description: '',
    reference: '',
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      const [transactionsRes, bankAccountsRes, cashBoxesRes] = await Promise.all([
        supabase.from('treasury_transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('*').order('id', { ascending: true }),
        supabase.from('cash_boxes').select('*').order('id', { ascending: true }),
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (bankAccountsRes.error) throw bankAccountsRes.error;
      if (cashBoxesRes.error) throw cashBoxesRes.error;

      setTransactions(transactionsRes.data || []);
      setBankAccounts(fallbackArray(bankAccountsRes.data, DEFAULT_BANK_ACCOUNTS));
      setCashBoxes(fallbackArray(cashBoxesRes.data, DEFAULT_CASH_BOXES));
    } catch {
      setBankAccounts((prev) => fallbackArray(prev, DEFAULT_BANK_ACCOUNTS));
      setCashBoxes((prev) => fallbackArray(prev, DEFAULT_CASH_BOXES));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('treasury-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasury_transactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTransactions((prev) => [payload.new as TreasuryTransaction, ...prev]);
            toast({ title: '💰 تم تسجيل معاملة مالية جديدة' });
          } else if (payload.eventType === 'UPDATE') {
            setTransactions((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as TreasuryTransaction) : t))
            );
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_boxes' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase, toast]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const numericAmount = parseFloat(formData.amount);

      const payload: Partial<TreasuryTransaction> = {
        type: formData.type,
        amount: numericAmount,
        currency: formData.currency,
        description: formData.description,
        reference: formData.reference || undefined,
        created_by: session?.user?.id,
        reconciliation_status: 'reconciled',
        bank_account_id: formData.destinationType === 'bank' ? parseInt(formData.destinationId) : undefined,
        cash_box_id: formData.destinationType === 'cashbox' ? parseInt(formData.destinationId) : undefined,
      };

      const { error } = await supabase.from('treasury_transactions').insert(payload);
      if (error) throw error;

      if (formData.destinationType === 'bank' && formData.destinationId) {
        const targetBank = bankAccounts.find((b) => b.id === parseInt(formData.destinationId));
        if (targetBank) {
          const newBal = (targetBank.current_balance || 0) + numericAmount;
          await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', targetBank.id);
        }
      }

      toast({ title: 'تم تسجيل المعاملة وتحديث الرصيد بنجاح' });
      setShowModal(false);
      setFormData({
        type: 'trip_revenue',
        amount: '',
        currency: 'MAD',
        destinationType: 'bank',
        destinationId: '',
        description: '',
        reference: '',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء تسجيل المعاملة',
        description: error?.message || 'خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bankBalances = groupBalancesByCurrency(bankAccounts);
  const filteredTransactions = transactions.filter(
    (t) =>
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeText = (type: string) => {
    switch (type) {
      case 'capital_injection':
        return 'ضخ رأس مال';
      case 'trip_revenue':
        return 'عائدات رحلة';
      case 'expense':
        return 'مصروفات تشغيلية';
      case 'transfer':
        return 'تحويل مالي';
      case 'payment':
        return 'استلام دفعة عميل';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>الخزينة والسيولة النقدية</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            الحسابات البنكية والصناديق النقدية
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            إدارة الأرصدة المتعددة العملات (MAD / EUR / USD) وتدفق السيولة للعمليات الدولية.
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
        >
          <Plus className="w-4 h-4 ml-2" />
          تسجيل حركة مالية جديدة
        </Button>
      </div>

      {/* Bento Grid Treasury KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* MAD Liquidity Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-40 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              السيولة البنكية (MAD)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground">
              {formatCurrency(bankBalances['MAD'] || 0, 'MAD')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              الحسابات بالدرهم المغربي
            </div>
          </div>
        </div>

        {/* EUR Liquidity Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-40 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              السيولة الدولية (EUR)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(bankBalances['EUR'] || 0, 'EUR')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              حسابات اليورو للعمليات الدولية
            </div>
          </div>
        </div>

        {/* Cash Boxes Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-40 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              الصناديق النقدية (Cash Boxes)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground">
              {cashBoxes.length}{' '}
              <span className="text-xs text-muted-foreground font-normal font-sans">صناديق نقدية</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              المصاريف النثرية وسلف السائقين الميدانية
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="بحث في الحركات المالية بالوصف، المرجع، أو نوع العملية..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 h-10 rounded-xl bg-card border-border/80 text-xs"
        />
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-xs text-muted-foreground">جاري تحميل السجلات المالية...</p>
        </div>
      ) : (
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold font-amiri text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              سجل العمليات والتدفقات المالية الأخيرة
            </CardTitle>
            <span className="text-xs font-mono text-muted-foreground">
              {filteredTransactions.length} حركة مسجلة
            </span>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => {
                const isPositive = Number(transaction.amount) >= 0;
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3.5 bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-foreground">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-medium bg-muted px-2 py-0.5 rounded-md text-foreground">
                            {getTypeText(transaction.type)}
                          </span>
                          {transaction.reference && (
                            <>
                              <span>•</span>
                              <span className="font-mono">مرجع: {transaction.reference}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <p
                        className={`font-bold font-mono text-sm sm:text-base ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {new Date(transaction.created_at).toLocaleDateString('ar-MA')}
                      </p>
                    </div>
                  </div>
                );
              })}

              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-xs text-muted-foreground">لا توجد حركات مالية مسجلة</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg rounded-2xl shadow-2xl border-border bg-card overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold font-amiri text-foreground">
                تسجيل حركة مالية جديدة
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setShowModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">نوع العملية</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary shadow-2xs"
                    >
                      <option value="trip_revenue">عائدات رحلة (+)</option>
                      <option value="payment">استلام دفعة عميل (+)</option>
                      <option value="capital_injection">ضخ رأس مال (+)</option>
                      <option value="expense">مصروفات تشغيلية (-)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">العملة</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary shadow-2xs"
                    >
                      <option value="MAD">MAD (درهم مغربي)</option>
                      <option value="EUR">EUR (يورو)</option>
                      <option value="USD">USD (دولار)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">المبلغ (سالب للمصاريف)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    dir="ltr"
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">الجهة المالية</label>
                    <select
                      value={formData.destinationType}
                      onChange={(e) => setFormData({ ...formData, destinationType: e.target.value, destinationId: '' })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary shadow-2xs"
                    >
                      <option value="bank">حساب بنكي</option>
                      <option value="cashbox">صندوق نقدي (Cash Box)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">الحساب / الصندوق</label>
                    <select
                      value={formData.destinationId}
                      onChange={(e) => setFormData({ ...formData, destinationId: e.target.value })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary shadow-2xs"
                      required
                    >
                      <option value="">-- اختر الحساب --</option>
                      {formData.destinationType === 'bank' &&
                        bankAccounts.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bank_name || b.name || `حساب #${b.id}`} ({b.currency || 'MAD'})
                          </option>
                        ))}
                      {formData.destinationType === 'cashbox' &&
                        cashBoxes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.code || `صندوق #${c.id}`} ({c.currency || 'MAD'})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">بيان العملية (الوصف)</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="بيان العملية المالية..."
                    required
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">المرجع / الشيك (اختياري)</label>
                  <Input
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Ref: CHQ-9812..."
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl h-9 text-xs font-semibold"
                  >
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ المعاملة'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl h-9 text-xs"
                  >
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
