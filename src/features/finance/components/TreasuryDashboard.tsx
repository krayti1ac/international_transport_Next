'use client';

import { useState, useEffect } from 'react';
import { useAllTreasuryBalances } from '../hooks/use-finance-queries';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Wallet, Landmark, Coins, ArrowRightLeft, X } from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import FifoPaymentDialog from './FifoPaymentDialog';
import { CASH_BOXES } from '../hooks/use-finance-queries';
import { createClient } from '@/lib/supabase/client';
import type { CashBox, BankAccount } from '@/types/database';
import { useQueryClient } from '@tanstack/react-query';

export default function TreasuryDashboard() {
  const { data: balances, isLoading } = useAllTreasuryBalances();
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [showFifoDialog, setShowFifoDialog] = useState(false);
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-amiri text-foreground">الخزينة وإدارة السيولة النقدية</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowFifoDialog(true)} variant="default">
            <ArrowRightLeft className="w-4 h-4 ml-2" />
            تحصيل دفعة عميل
          </Button>
          <Button onClick={() => setShowNewTransaction(true)} variant="outline">
            <Plus className="w-4 h-4 ml-2" />
            معاملة جديدة
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CASH_BOXES.map((box) => {
          const balance = balances?.[box.code];
          const Icon =
            box.code === 'owner_cash'
              ? Wallet
              : box.code.includes('bank')
                ? Landmark
                : Coins;
          const color =
            box.code === 'owner_cash'
              ? 'text-blue-600 dark:text-blue-400'
              : box.code === 'bank_morocco'
                ? 'text-emerald-600 dark:text-emerald-400'
                : box.code === 'bank_europe'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-amber-600 dark:text-amber-400';
          const borderColor =
            box.code === 'owner_cash'
              ? 'border-r-blue-600'
              : box.code === 'bank_morocco'
                ? 'border-r-emerald-600'
                : box.code === 'bank_europe'
                  ? 'border-r-indigo-600'
                  : 'border-r-amber-600';

          return (
            <Card key={box.code} className={`${borderColor} bg-card`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  {box.labelAr}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {isLoading ? '...' : formatCurrency(parseFloat(balance || '0'), box.currency)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showNewTransaction && (
        <NewTransactionDialog
          onClose={() => setShowNewTransaction(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['treasuryBalances'] });
            queryClient.invalidateQueries({ queryKey: ['treasuryBalance'] });
          }}
        />
      )}

      {showFifoDialog && <FifoPaymentDialog isOpen={showFifoDialog} onClose={() => setShowFifoDialog(false)} />}
    </div>
  );
}

function NewTransactionDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState('capital_injection');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [destinationType, setDestinationType] = useState<'cashbox' | 'bank'>('cashbox');
  const [destinationId, setDestinationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    const fetchDestinations = async () => {
      const [cashRes, bankRes] = await Promise.all([
        supabase.from('cash_boxes').select('*').order('id'),
        supabase.from('bank_accounts').select('*').order('id'),
      ]);
      if (!cashRes.error) setCashBoxes(cashRes.data || []);
      if (!bankRes.error) setBankAccounts(bankRes.data || []);
    };
    fetchDestinations();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const numericAmount = parseFloat(amount);
      if (!numericAmount || numericAmount <= 0) {
        toast({ title: 'يرجى إدخال مبلغ صحيح', variant: 'destructive' });
        return;
      }

      if (!destinationId) {
        toast({ title: 'يرجى اختيار الوجهة', variant: 'destructive' });
        return;
      }

      const payload: Record<string, unknown> = {
        type,
        amount: numericAmount,
        currency,
        description,
        reference: reference || undefined,
        reconciliation_status: 'reconciled',
      };

      if (destinationType === 'bank') {
        payload.bank_account_id = parseInt(destinationId);
      } else {
        payload.cash_box_id = parseInt(destinationId);
      }

      const { error } = await supabase.from('treasury_transactions').insert(payload);
      if (error) throw error;

      toast({ title: 'تم تسجيل المعاملة بنجاح' });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'خطأ غير متوقع';
      toast({
        title: 'خطأ أثناء تسجيل المعاملة',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isProviderDebt = type === 'provider_debt_settlement';
  const availableCashBoxes = isProviderDebt
    ? cashBoxes.filter((c) => c.code !== 'secretary_cash')
    : cashBoxes;

  const TRANSACTION_TYPES = [
    { value: 'capital_injection', label: 'ضخ رأس مال (+)' },
    { value: 'office_expense', label: 'مصروفات مكتبية (-)' },
    { value: 'owner_withdrawal', label: 'مسحوبات المالك (-)' },
    { value: 'salary', label: 'رواتب (-)' },
    { value: 'trip_expense', label: 'مصاريف رحلة (-)' },
    { value: 'provider_debt_settlement', label: 'تسوية ديون موردين (-)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-amiri">تسجيل معاملة مالية</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">نوع العملية</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">المبلغ</label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">العملة</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">الوصف</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">المرجع / الشيك (اختياري)</label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ref: CHQ-9812..."
              />
            </div>

            {isProviderDebt && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                تنبيه: تسوية ديون الموردين تتطلب اختيار صندوق المالك أو حساب بنكي ولا يُسمح باستخدام نقدية المكتب.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الجهة المالية</label>
                <select
                  value={destinationType}
                  onChange={(e) => setDestinationType(e.target.value as 'cashbox' | 'bank')}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="cashbox">صندوق نقدي</option>
                  <option value="bank">حساب بنكي</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الحساب / الصندوق</label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  required
                >
                  <option value="">-- اختر --</option>
                  {destinationType === 'bank'
                    ? bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name || b.name || `حساب #${b.id}`} ({b.currency || 'MAD'})
                        </option>
                      ))
                    : availableCashBoxes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.code || `صندوق #${c.id}`} ({c.currency || 'MAD'})
                        </option>
                      ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'جاري الحفظ...' : 'حفظ المعاملة'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
