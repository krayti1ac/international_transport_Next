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
import { useLanguage } from '@/components/language-provider';
import type { CashBox, BankAccount } from '@/types/database';
import { useQueryClient } from '@tanstack/react-query';

export default function TreasuryDashboard() {
  const { t, dir, locale } = useLanguage();
  const { data: balances, isLoading } = useAllTreasuryBalances();
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [showFifoDialog, setShowFifoDialog] = useState(false);
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-amiri text-foreground">{t('الخزينة وإدارة السيولة النقدية', 'Trésorerie et gestion des liquidités')}</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowFifoDialog(true)} variant="default">
            <ArrowRightLeft className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t('تحصيل دفعة عميل', 'Encaissement client')}
          </Button>
          <Button onClick={() => setShowNewTransaction(true)} variant="outline">
            <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t('معاملة جديدة', 'Nouvelle transaction')}
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
          const borderSide = dir === 'rtl' ? 'border-r-4' : 'border-l-4';
          const borderColor =
            box.code === 'owner_cash'
              ? `${borderSide} border-r-blue-600 border-l-blue-600`
              : box.code === 'bank_morocco'
                ? `${borderSide} border-r-emerald-600 border-l-emerald-600`
                : box.code === 'bank_europe'
                  ? `${borderSide} border-r-indigo-600 border-l-indigo-600`
                  : `${borderSide} border-r-amber-600 border-l-amber-600`;

          return (
            <Card key={box.code} className={`${borderColor} bg-card`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  {locale === 'fr' ? box.labelFr || box.labelAr : box.labelAr}
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
  const { t, dir } = useLanguage();
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
        toast({ title: t('يرجى إدخال مبلغ صحيح', 'Veuillez saisir un montant valide'), variant: 'destructive' });
        return;
      }

      if (!destinationId) {
        toast({ title: t('يرجى اختيار الوجهة', 'Veuillez choisir la destination'), variant: 'destructive' });
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

      toast({ title: t('تم تسجيل المعاملة بنجاح', 'Transaction enregistrée avec succès') });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : typeof error === 'string' ? error : t('خطأ غير متوقع', 'Erreur inattendue');
      toast({
        title: t('خطأ أثناء تسجيل المعاملة', 'Erreur lors de l\'enregistrement de la transaction'),
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
    { value: 'capital_injection', label: t('ضخ رأس مال (+)', 'Injection de capital (+)') },
    { value: 'office_expense', label: t('مصروفات مكتبية (-)', 'Frais de bureau (-)') },
    { value: 'owner_withdrawal', label: t('مسحوبات المالك (-)', 'Retrait propriétaire (-)') },
    { value: 'salary', label: t('رواتب (-)', 'Salaires (-)') },
    { value: 'trip_expense', label: t('مصاريف رحلة (-)', 'Frais de voyage (-)') },
    { value: 'provider_debt_settlement', label: t('تسوية ديون موردين (-)', 'Règlement dette fournisseur (-)') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-lg" dir={dir}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-amiri">{t('تسجيل معاملة مالية', 'Enregistrer une transaction financière')}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('نوع العملية', 'Type d\'opération')}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                {TRANSACTION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('المبلغ', 'Montant')}</label>
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
                <label className="text-sm font-medium">{t('العملة', 'Devise')}</label>
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
              <label className="text-sm font-medium">{t('الوصف', 'Description')}</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('المرجع / الشيك (اختياري)', 'N° Référence / Chèque (optionnel)')}</label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ref: CHQ-9812..."
              />
            </div>

            {isProviderDebt && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                {t('تنبيه: تسوية ديون الموردين تتطلب اختيار صندوق المالك أو حساب بنكي ولا يُسمح باستخدام نقدية المكتب.', 'Attention : Le règlement des dettes fournisseurs nécessite la caisse propriétaire ou un compte bancaire.')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('الجهة المالية', 'Entité financière')}</label>
                <select
                  value={destinationType}
                  onChange={(e) => setDestinationType(e.target.value as 'cashbox' | 'bank')}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="cashbox">{t('صندوق نقدي', 'Caisse')}</option>
                  <option value="bank">{t('حساب بنكي', 'Compte bancaire')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('الحساب / الصندوق', 'Compte / Caisse')}</label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  required
                >
                  <option value="">{t('-- اختر --', '-- Choisir --')}</option>
                  {destinationType === 'bank'
                    ? bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name || b.name || `${t('حساب', 'Compte')} #${b.id}`} ({b.currency || 'MAD'})
                        </option>
                      ))
                    : availableCashBoxes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.code || `${t('صندوق', 'Caisse')} #${c.id}`} ({c.currency || 'MAD'})
                        </option>
                      ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('جاري الحفظ...', 'Enregistrement...') : t('حفظ المعاملة', 'Enregistrer la transaction')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('إلغاء', 'Annuler')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
