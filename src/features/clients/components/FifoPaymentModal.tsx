'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calculator, CheckCircle2, Loader2, Landmark, Wallet, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { CashBox, BankAccount, Client } from '@/types/database';
import { processClientFifoPaymentAction } from '../services/clients.actions';

interface FifoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client;
  totalDue?: string | number;
  bankAccounts?: BankAccount[];
  cashBoxes?: CashBox[];
  activeCurrencies?: string[];
}

function FifoPaymentForm({
  onClose,
  onSuccess,
  client,
  totalDue = 0,
  bankAccounts = [],
  cashBoxes = [],
}: Omit<FifoPaymentModalProps, 'isOpen'>) {
  const { t, dir } = useLanguage();
  const dueNum = Number(totalDue);

  const [amount, setAmount] = useState<string>(dueNum > 0 ? dueNum.toString() : '');
  const [currency, setCurrency] = useState<'MAD' | 'EUR'>(
    (client.currency === 'EUR' ? 'EUR' : 'MAD') as 'MAD' | 'EUR'
  );
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'check' | 'cash'>('bank_transfer');
  const [destinationType, setDestinationType] = useState<'bank' | 'cashbox'>(
    bankAccounts.length > 0 ? 'bank' : 'cashbox'
  );
  const [destinationId, setDestinationId] = useState<string>(
    bankAccounts.length > 0
      ? bankAccounts[0].id.toString()
      : cashBoxes.length > 0
      ? cashBoxes[0].id.toString()
      : ''
  );
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState(`دفعة تحصيل بنظام FIFO من العميل: ${client.name}`);
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  const handleDestinationTypeChange = (type: 'bank' | 'cashbox') => {
    setDestinationType(type);
    if (type === 'bank' && bankAccounts.length > 0) {
      setDestinationId(bankAccounts[0].id.toString());
    } else if (type === 'cashbox' && cashBoxes.length > 0) {
      setDestinationId(cashBoxes[0].id.toString());
    } else {
      setDestinationId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: t('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'Veuillez saisir un montant valide supérieur à zéro'),
        variant: 'destructive',
      });
      return;
    }

    if (!destinationId) {
      toast({
        title: t('يرجى اختيار حساب أو صندوق الإيداع', 'Veuillez choisir le compte ou la caisse de dépôt'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const result = await processClientFifoPaymentAction({
        clientId: client.id,
        amount: numAmount,
        currency,
        paymentMethod,
        destinationType,
        destinationId: parseInt(destinationId, 10),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'فشلت معالجة دفعة FIFO');
      }

      const resData = result.data;
      toast({
        title: t('تم توزيع الدفعة بنجاح (FIFO)', 'Paiement distribué avec succès (FIFO)'),
        description: t(
          `تمت تسوية ${resData.affectedInvoicesCount} فاتورة بمبلغ ${resData.totalAllocated.toFixed(2)} ${currency}. المعرف: #${resData.paymentId}`,
          `${resData.affectedInvoicesCount} facture(s) réglée(s) pour un montant de ${resData.totalAllocated.toFixed(2)} ${currency}. ID: #${resData.paymentId}`
        ),
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء معالجة الدفعة';
      toast({
        title: t('خطأ أثناء المعالجة', 'Erreur lors du traitement'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const dueDisplay = dueNum.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wide mb-1">
          <Calculator className="w-4 h-4" />
          <span>{t('نظام التوزيع التلقائي للمدفوعات (FIFO)', 'Distribution automatique des paiements (FIFO)')}</span>
        </div>
        <DialogTitle className="font-amiri text-xl">
          {t(`تحصيل دفعة مالية: ${client.name}`, `Encaisser un paiement : ${client.name}`)}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground mt-1">
          {t('إجمالي الديون القائمة قيد التحصيل: ', 'Total des créances en cours : ')}
          <span className="font-bold text-rose-500 font-mono">{dueDisplay} {currency}</span>
          <br />
          {t(
            'يقوم الإجراء المخزن (RPC) بتسديد الفواتير غير المدفوعة آلياً من الأقدم إلى الأحدث وقيد الإيراد فوراً في الخزينة.',
            'La procédure stockée (RPC) affecte automatiquement le montant aux factures les plus anciennes et crédite la trésorerie.'
          )}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2" dir={dir}>
        {/* Amount & Currency */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('المبلغ المستلم للتحصيل', 'Montant reçu à encaisser')}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              dir="ltr"
              className="font-mono text-lg h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('العملة', 'Devise')}
            </label>
            <Select value={currency} onValueChange={(val: 'MAD' | 'EUR') => setCurrency(val)}>
              <SelectTrigger className="h-11 font-mono font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAD">MAD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Payment Method & Destination Type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('طريقة الدفع', 'Mode de paiement')}
            </label>
            <Select
              value={paymentMethod}
              onValueChange={(val: 'bank_transfer' | 'check' | 'cash') => setPaymentMethod(val)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">{t('تحويل بنكي', 'Virement bancaire')}</SelectItem>
                <SelectItem value="check">{t('شيك', 'Chèque')}</SelectItem>
                <SelectItem value="cash">{t('نقداً', 'Espèces')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('وجهة الإيداع', 'Destination du dépôt')}
            </label>
            <Select
              value={destinationType}
              onValueChange={(val: 'bank' | 'cashbox') => handleDestinationTypeChange(val)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">{t('حساب بنكي', 'Compte bancaire')}</SelectItem>
                <SelectItem value="cashbox">{t('صندوق نقدي (خزينة)', 'Caisse (Espèces)')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Specific Account / Cash Box Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            {destinationType === 'bank' ? (
              <Landmark className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <Wallet className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>
              {t(
                destinationType === 'bank' ? 'اختر الحساب البنكي للإيداع' : 'اختر الصندوق النقدي للإيداع',
                destinationType === 'bank' ? 'Compte bancaire de dépôt' : 'Caisse de dépôt'
              )}
            </span>
          </label>
          <Select value={destinationId} onValueChange={setDestinationId}>
            <SelectTrigger className="rounded-xl font-mono text-xs">
              <SelectValue placeholder={t('-- اضغط للاختيار --', '-- Cliquez pour choisir --')} />
            </SelectTrigger>
            <SelectContent>
              {destinationType === 'bank' ? (
                bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.name} ({b.bank_name}) - {b.currency}
                  </SelectItem>
                ))
              ) : (
                cashBoxes.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name} ({c.currency})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Reference & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('رقم المرجع / الشيك (اختياري)', 'N° Référence / Chèque')}
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ref: VIR-84920..."
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('ملاحظات وسجل الحركة', 'Notes & Détails')}
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('ملاحظات الدفعة...', 'Notes du paiement...')}
              className="text-xs"
            />
          </div>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            {t(
              'سيتم قيد معاملة إيراد في الخزينة فوراً وتحديث الرصيد الحالي للحساب المختار بصورة ذرية (Atomic Transaction).',
              'Une transaction de recette sera immédiatement enregistrée en trésorerie et le solde sera mis à jour de manière atomique.'
            )}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {t('إلغاء', 'Annuler')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{t('تأكيد وقيد الدفعة', 'Confirmer et enregistrer')}</span>
          </Button>
        </div>
      </form>
    </>
  );
}

export function FifoPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  client,
  totalDue = 0,
  bankAccounts = [],
  cashBoxes = [],
}: FifoPaymentModalProps) {
  const { dir } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto" dir={dir}>
        {isOpen && (
          <FifoPaymentForm
            onClose={onClose}
            onSuccess={onSuccess}
            client={client}
            totalDue={totalDue}
            bankAccounts={bankAccounts}
            cashBoxes={cashBoxes}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}