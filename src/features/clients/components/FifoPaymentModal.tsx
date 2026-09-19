'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  Calculator,
  CheckCircle2,
  Loader2,
  Landmark,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { CashBox, BankAccount, Client } from '@/types/database';
import { processClientFifoPaymentAction } from '../services/clients.actions';
import { previewFIFOAllocation } from '@/lib/utils/decimal';
import { createClient } from '@/lib/supabase/browser';

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
  const [settlementRate, setSettlementRate] = useState<string>('');
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
  const supabase = createClient();

  // Query unpaid/partially paid invoices for the client to compute live preview
  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ['client-unpaid-invoices', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, paid_amount, status, issue_date, currency, exchange_rate, trip_id')
        .or(`client_id.eq.${client.id},client_id.eq.${String(client.id)}`)
        .in('status', ['unpaid', 'partially_paid', 'overdue'])
        .order('issue_date', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      return (data || []).map((inv: {
        id: number;
        invoice_number?: string;
        total_amount: number;
        paid_amount?: number;
        status: string;
        issue_date?: string;
        currency?: string;
        exchange_rate?: number;
        trip_id?: number;
      }) => ({
        id: inv.id,
        invoice_number: inv.invoice_number || `#${inv.id}`,
        total_amount: inv.total_amount,
        paid_amount: inv.paid_amount || 0,
        status: inv.status,
        issue_date: inv.issue_date,
        currency: inv.currency || currency || 'MAD',
        exchange_rate: inv.exchange_rate,
        trip_id: inv.trip_id,
      }));
    },
    enabled: !!client.id,
  });

  // Calculate live FIFO allocation preview
  const preview = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return null;
    const rate = currency === 'EUR' && settlementRate ? parseFloat(settlementRate) : undefined;
    return previewFIFOAllocation(unpaidInvoices, numAmount, rate);
  }, [unpaidInvoices, amount, currency, settlementRate]);

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
        title: t('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'Veuillez saisir un montant valide supérieur à zéro', 'Ingrese un monto válido mayor a cero'),
        variant: 'destructive',
      });
      return;
    }

    if (!destinationId) {
      toast({
        title: t('يرجى اختيار حساب أو صندوق الإيداع', 'Veuillez choisir le compte ou la caisse de dépôt', 'Seleccione la cuenta o caja de depósito'),
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
        settlementRate: currency === 'EUR' && settlementRate ? parseFloat(settlementRate) : undefined,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'فشلت معالجة دفعة FIFO');
      }

      const resData = result.data;
      const forexInfo = resData.forexEntries && resData.forexEntries.length > 0
        ? ` | ${t('تم قيد فروق الصرف', 'Écarts de change enregistrés', 'Diferencias cambiarias registradas')}`
        : '';

      toast({
        title: t('تم توزيع الدفعة بنجاح (FIFO)', 'Paiement distribué avec succès (FIFO)', 'Pago distribuido con éxito (FIFO)'),
        description: t(
          `تمت تسوية ${resData.affectedInvoicesCount} فاتورة بمبلغ ${resData.totalAllocated.toFixed(2)} ${currency}${forexInfo}. المعرف: #${resData.paymentId}`,
          `${resData.affectedInvoicesCount} facture(s) réglée(s) pour un montant de ${resData.totalAllocated.toFixed(2)} ${currency}${forexInfo}. ID: #${resData.paymentId}`,
          `${resData.affectedInvoicesCount} factura(s) liquidada(s) por ${resData.totalAllocated.toFixed(2)} ${currency}${forexInfo}. ID: #${resData.paymentId}`
        ),
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء معالجة الدفعة';
      toast({
        title: t('خطأ أثناء المعالجة', 'Erreur lors du traitement', 'Error durante el procesamiento'),
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
          <span>{t('نظام التوزيع التلقائي للمدفوعات (FIFO)', 'Distribution automatique des paiements (FIFO)', 'Distribución automática de pagos (FIFO)')}</span>
        </div>
        <DialogTitle className="font-amiri text-xl">
          {t(`تحصيل دفعة مالية: ${client.name}`, `Encaisser un paiement : ${client.name}`, `Cobrar pago: ${client.name}`)}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground mt-1">
          {t('إجمالي الديون القائمة قيد التحصيل: ', 'Total des créances en cours : ', 'Total de deudas pendientes : ')}
          <span className="font-bold text-rose-500 font-mono">{dueDisplay} {currency}</span>
          <br />
          {t(
            'يقوم محرك FIFO بتسديد الفواتير غير المدفوعة آلياً من الأقدم إلى الأحدث واحتساب فروق الصرف وتحديث الخزينة.',
            'Le moteur FIFO affecte automatiquement le montant aux factures les plus anciennes, calcule le Forex et met à jour la trésorerie.',
            'El motor FIFO asigna automáticamente el monto a las facturas más antiguas, calcula Forex y actualiza tesorería.'
          )}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2" dir={dir}>
        {/* Amount & Currency */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('المبلغ المستلم للتحصيل *', 'Montant reçu à encaisser *', 'Monto recibido para cobro *')}
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
              {t('العملة', 'Devise', 'Moneda')}
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

        {/* EUR Settlement Rate Input */}
        {currency === 'EUR' && (
          <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                {t('سعر صرف التحصيل الفعلي (MAD/EUR)', 'Taux de change réel (MAD/EUR)', 'Tipo de cambio real (MAD/EUR)')}
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {t('سعر البنك الفعلي', 'Taux effectif banque', 'Tipo efectivo banco')}
              </span>
            </div>
            <Input
              type="number"
              step="0.0001"
              placeholder="مثال: 10.92"
              value={settlementRate}
              onChange={(e) => setSettlementRate(e.target.value)}
              dir="ltr"
              className="font-mono text-sm bg-card"
            />
            <p className="text-[11px] text-muted-foreground">
              {t(
                'يقوم النظام آلياً باحتساب وقيد فروق الصرف المحققة (أرباح/خسائر عملة) في السجلات المحاسبية.',
                'Le système calculera et enregistrera automatiquement les gains/pertes de change réalisés (Forex).',
                'El sistema calculará y registrará automáticamente las ganancias/pérdidas por tipo de cambio realizadas (Forex).'
              )}
            </p>
          </div>
        )}

        {/* Payment Method & Destination Type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('طريقة الدفع', 'Mode de paiement', 'Método de pago')}
            </label>
            <Select
              value={paymentMethod}
              onValueChange={(val: 'bank_transfer' | 'check' | 'cash') => setPaymentMethod(val)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">{t('تحويل بنكي', 'Virement bancaire', 'Transferencia bancaria')}</SelectItem>
                <SelectItem value="check">{t('شيك', 'Chèque', 'Cheque')}</SelectItem>
                <SelectItem value="cash">{t('نقداً', 'Espèces', 'Efectivo')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('وجهة الإيداع', 'Destination du dépôt', 'Destino del depósito')}
            </label>
            <Select
              value={destinationType}
              onValueChange={(val: 'bank' | 'cashbox') => handleDestinationTypeChange(val)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">{t('حساب بنكي', 'Compte bancaire', 'Cuenta bancaria')}</SelectItem>
                <SelectItem value="cashbox">{t('صندوق نقدي (خزينة)', 'Caisse (Espèces)', 'Caja (Efectivo)')}</SelectItem>
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
                destinationType === 'bank' ? 'Compte bancaire de dépôt' : 'Caisse de dépôt',
                destinationType === 'bank' ? 'Cuenta bancaria de depósito' : 'Caja de depósito'
              )}
            </span>
          </label>
          <Select value={destinationId} onValueChange={setDestinationId}>
            <SelectTrigger className="rounded-xl font-mono text-xs">
              <SelectValue placeholder={t('-- اضغط للاختيار --', '-- Cliquez pour choisir --', '-- Haga clic para elegir --')} />
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

        {/* Live FIFO Allocation Preview */}
        {preview && (
          <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                {t('معاينة التوزيع المباشر (FIFO)', 'Aperçu de l\'allocation FIFO', 'Vista previa de distribución FIFO')}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                {t(
                  `${preview.affectedInvoicesCount} فاتورة مستهدفة`,
                  `${preview.affectedInvoicesCount} facture(s) couverte(s)`,
                  `${preview.affectedInvoicesCount} factura(s) cubierta(s)`
                )}
              </span>
            </div>

            {preview.allocations.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {preview.allocations.map((alloc) => (
                  <div
                    key={alloc.invoiceId}
                    className="p-2 rounded-lg bg-card border border-border/80 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">{alloc.invoiceNumber}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            alloc.newStatus === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {alloc.newStatus === 'paid'
                            ? t('سداد كامل', 'Soldée', 'Pagada total')
                            : t('سداد جزئي', 'Partielle', 'Pago parcial')}
                        </span>
                      </div>
                      {alloc.remainingDue !== undefined && alloc.remainingDue > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {t('المتبقي:', 'Reste :', 'Restante :')}{' '}
                          <span className="font-mono">{alloc.remainingDue.toFixed(2)} {currency}</span>
                        </p>
                      )}
                    </div>

                    <div className="text-end shrink-0">
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{alloc.allocatedAmount.toFixed(2)} {currency}
                      </div>
                      {alloc.forexGainLoss && alloc.forexGainLoss.type !== 'neutral' && (
                        <span
                          className={`text-[10px] font-mono font-bold block ${
                            alloc.forexGainLoss.type === 'gain'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {alloc.forexGainLoss.type === 'gain' ? '▲ +' : '▼ -'}
                          {alloc.forexGainLoss.amount.toFixed(2)} MAD
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2 text-center">
                {t('لا توجد فواتير غير مدفوعة. سيتم حفظ المبلغ كرصيد مستحق للعميل.', 'Aucune facture impayée. Le montant sera crédité.', 'Sin facturas impagadas. El monto se acreditará.')}
              </p>
            )}

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t('المجموع المسدد:', 'Total affecté :', 'Total asignado :')}
              </span>
              <span className="font-mono font-bold text-foreground">
                {preview.totalAllocated.toFixed(2)} {currency}
              </span>
            </div>
            {preview.unallocatedCredit > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                <span>{t('فائض رصيد للعميل:', 'Solde créditeur restant :', 'Saldo a favor del cliente :')}</span>
                <span className="font-mono font-bold">+{preview.unallocatedCredit.toFixed(2)} {currency}</span>
              </div>
            )}
          </div>
        )}

        {/* Reference & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('رقم المرجع / الشيك (اختياري)', 'N° Référence / Chèque', 'N° Referencia / Cheque')}
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
              {t('ملاحظات وسجل الحركة', 'Notes & Détails', 'Notas y detalles')}
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('ملاحظات الدفعة...', 'Notes du paiement...', 'Notas del pago...')}
              className="text-xs"
            />
          </div>
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
            {t('إلغاء', 'Annuler', 'Cancelar')}
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
            <span>{t('تأكيد وقيد الدفعة', 'Confirmer et enregistrer', 'Confirmar y registrar')}</span>
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