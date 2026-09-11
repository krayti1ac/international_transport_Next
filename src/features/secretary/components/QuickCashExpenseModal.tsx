'use client';

import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Wallet, ArrowDownRight, Loader2 } from 'lucide-react';
import { recordSecretaryPettyCashExpense } from '../services/secretary.actions';

interface QuickCashExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
}

export function QuickCashExpenseModal({
  isOpen,
  onClose,
  currency = 'MAD',
}: QuickCashExpenseModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'office_expense' | 'trip_expense'>('office_expense');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({
          title: t('خطأ في المبلغ', 'Montant invalide'),
          description: t('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'Veuillez saisir un montant supérieur à 0'),
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!description.trim()) {
        toast({
          title: t('بيانات ناقصة', 'Données manquantes'),
          description: t('يرجى تحديد بيان المصروف', 'Veuillez indiquer le libellé de la dépense'),
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const res = await recordSecretaryPettyCashExpense({
        amount: parsedAmount,
        description: description.trim(),
        category,
        reference: reference.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || t('فشل تسجيل المصروف', 'Échec de l\'enregistrement'));
      }

      toast({
        title: t('تم تسجيل المصروف بنجاح', 'Dépense enregistrée avec succès'),
        description: `${description} — ${new Decimal(parsedAmount).toFixed(2)} ${currency}`,
      });

      queryClient.invalidateQueries({ queryKey: ['secretary-cash-data'] });
      queryClient.invalidateQueries({ queryKey: ['treasuryBalances'] });
      queryClient.invalidateQueries({ queryKey: ['treasuryBalance'] });

      // Reset
      setAmount('');
      setDescription('');
      setReference('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('حدث خطأ أثناء المعالجة', 'Erreur inattendue');
      toast({
        title: t('خطأ في العملية', 'Erreur'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50 duration-200">
      <Card className="w-full max-w-md border-border bg-card shadow-xl rounded-2xl overflow-hidden" dir={dir}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/30 p-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold font-amiri text-foreground">
                {t('صرف من صندوق السكرتيرة', 'Dépense Caisse Secrétaire')}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('تسجيل مصروف نقدي مباشر من نقدية المكتب', 'Enregistrement immédiat de frais de caisse')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                {t('المبلغ المطلوب صرفه', 'Montant à décaisser')} ({currency}) *
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="font-mono text-lg font-bold h-11 ps-3 pe-12 bg-background rounded-xl border-border"
                  dir="ltr"
                />
                <span className="absolute top-1/2 -translate-y-1/2 end-3 text-xs font-mono font-bold text-muted-foreground">
                  {currency}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                {t('نوع المصروف', 'Type de dépense')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('office_expense')}
                  className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                    category === 'office_expense'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  {t('مصروفات مكتبية / عامة', 'Frais de bureau')}
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('trip_expense')}
                  className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                    category === 'trip_expense'
                      ? 'bg-blue-500/15 border-blue-500/50 text-blue-600 dark:text-blue-400'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  {t('مصاريف طريق / عهدة سريعة', 'Frais de route / Avance')}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                {t('بيان ووصف المصروف', 'Description / Motif')} *
              </label>
              <Input
                type="text"
                placeholder={t(
                  'مثال: أدوات مكتبية، شحن هاتف، تنظيف، طوابع بريدية...',
                  'Ex: Fournitures bureau, recharge téléphonique, pressing...'
                )}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="h-10 text-xs rounded-xl bg-background border-border"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                {t('رقم الفاتورة / الوصل (اختياري)', 'N° Facture / Reçu (optionnel)')}
              </label>
              <Input
                type="text"
                placeholder="REC-00129"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-10 text-xs font-mono rounded-xl bg-background border-border"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="h-9 px-4 text-xs rounded-xl border-border"
              >
                {t('إلغاء', 'Annuler')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin ms-1.5" />
                    {t('جاري التسجيل...', 'Enregistrement...')}
                  </>
                ) : (
                  t('تأكيد وتسجيل المصروف', 'Confirmer la dépense')
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
