'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { settleDriverAdvance, type SettleDriverAdvanceInput } from '@/app/actions/settlement-actions';
import { Wallet, Receipt, TrendingUp, Loader2, X } from 'lucide-react';
import { DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';

interface DriverSettlementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  advance: {
    id: number;
    driver_id: number;
    amount: number;
    currency: string;
    reason: string;
    date: string;
    extra_advances: number;
    driver_allowance: number;
    receipt_expenses: number;
  };
  cashBoxes: { id: number; name: string }[];
  onSettled?: () => void;
}

export function DriverSettlementDialog({
  isOpen,
  onClose,
  advance,
  cashBoxes,
  onSettled,
}: DriverSettlementDialogProps) {
  const { t, dir } = useLanguage();
  const availableCashBoxes = fallbackArray(cashBoxes, DEFAULT_CASH_BOXES);
  const [extraAdvances, setExtraAdvances] = useState(() => advance.extra_advances || 0);
  const [driverAllowance, setDriverAllowance] = useState(() => advance.driver_allowance || 0);
  const [receiptExpenses, setReceiptExpenses] = useState(() => advance.receipt_expenses || 0);
  const [cashBoxId, setCashBoxId] = useState(() => cashBoxes[0]?.id || 0);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  const totalGiven = useMemo(() => {
    return new Decimal(advance.amount || 0).plus(new Decimal(extraAdvances || 0));
  }, [advance.amount, extraAdvances]);

  const totalExpenses = useMemo(() => {
    return new Decimal(driverAllowance || 0).plus(new Decimal(receiptExpenses || 0));
  }, [driverAllowance, receiptExpenses]);

  const amountReturned = useMemo(() => {
    return totalGiven.minus(totalExpenses);
  }, [totalGiven, totalExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const input: SettleDriverAdvanceInput = {
        advanceId: advance.id,
        extraAdvances,
        driverAllowance,
        receiptExpenses,
        amountGiven: advance.amount,
        cashBoxId,
        description: description || `Settlement for advance #${advance.id}`,
      };

      const result = await settleDriverAdvance(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: t('تم تسوية السلفة بنجاح', 'Avance réglée avec succès'),
        description: t(
          `المبلغ المرتجع: ${result.amountReturned?.toLocaleString()} ${advance.currency}`,
          `Montant restitué : ${result.amountReturned?.toLocaleString()} ${advance.currency}`
        ),
      });

      onSettled?.();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('حدث خطأ غير متوقع', 'Une erreur inattendue est survenue');
      toast({
        title: t('خطأ في تسوية السلفة', 'Erreur de règlement d\'avance'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto" dir={dir}>
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-amiri text-xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              {t(`تسوية سلفة السائق #${advance.id}`, `Règlement avance chauffeur #${advance.id}`)}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t('تاريخ السلفة: ', 'Date de l\'avance : ')}{advance.date} - {advance.reason}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">{t('المبلغ الأصلي الممنوح', 'Montant initial octroyé')}</p>
            <p className="text-lg font-bold font-mono text-foreground">
              {advance.amount.toLocaleString()} {advance.currency}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              {t('دفعات إضافية (Extra Advances)', 'Avances supplémentaires (Extra Advances)')}
            </label>
            <Input
              type="number"
              step="0.01"
              value={extraAdvances}
              onChange={(e) => setExtraAdvances(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Wallet className="w-4 h-4 text-amber-600" />
              {t('بدل السائق (Driver Allowance)', 'Indemnité chauffeur (Driver Allowance)')}
            </label>
            <Input
              type="number"
              step="0.01"
              value={driverAllowance}
              onChange={(e) => setDriverAllowance(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Receipt className="w-4 h-4 text-emerald-600" />
              {t('مصاريف مشروحة (Receipt Expenses)', 'Frais justifiés (Receipt Expenses)')}
            </label>
            <Input
              type="number"
              step="0.01"
              value={receiptExpenses}
              onChange={(e) => setReceiptExpenses(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('صندوق الاسترجاع', 'Caisse de restitution')}
            </label>
            <select
              value={cashBoxId}
              onChange={(e) => setCashBoxId(parseInt(e.target.value) || 0)}
              className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
              required
            >
              <option value="">{t('-- اختر الصندوق --', '-- Sélectionner la caisse --')}</option>
              {availableCashBoxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('وصف العملية (اختياري)', 'Description (facultatif)')}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('ملاحظات حول التسوية...', 'Notes sur le règlement...')}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-center">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">{t('إجمالي المعطى', 'Total versé')}</p>
              <p className="text-sm font-bold font-mono text-blue-800 dark:text-blue-200">
                {totalGiven.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-lg border border-rose-500/20 text-center">
              <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{t('إجمالي المصاريف', 'Total frais')}</p>
              <p className="text-sm font-bold font-mono text-rose-800 dark:text-rose-200">
                {totalExpenses.toFixed(2)}
              </p>
            </div>
            <div className={`p-3 rounded-lg border text-center ${amountReturned.greaterThanOrEqualTo(0) ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
              <p className={`text-xs font-medium ${amountReturned.greaterThanOrEqualTo(0) ? 'text-emerald-700 dark:text-emerald-300' : 'text-orange-700 dark:text-orange-300'}`}>
                {t('المبلغ المرتجع', 'Montant restitué')}
              </p>
              <p className={`text-sm font-bold font-mono ${amountReturned.greaterThanOrEqualTo(0) ? 'text-emerald-800 dark:text-emerald-200' : 'text-orange-800 dark:text-orange-200'}`}>
                {amountReturned.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
              {t('إلغاء', 'Annuler')}
            </Button>
            <Button type="submit" disabled={isSubmitting || amountReturned.isNaN()} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'} animate-spin`} />
                  {t('جاري الحفظ...', 'Enregistrement...')}
                </>
              ) : (
                t('تأكيد التسوية', 'Confirmer le règlement')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
