'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, ArrowRightLeft, CheckCircle2, Calculator, TrendingUp } from 'lucide-react';
import { recordBulkClientPayment } from '../services/finance.actions';
import type { Client, CashBox } from '@/types/database';
import { DEFAULT_CLIENTS, DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';
import { previewFIFOAllocation, type FIFOPaymentResult } from '@/lib/utils/decimal';

interface FifoPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FifoPaymentDialog({ isOpen, onClose }: FifoPaymentDialogProps) {
  const { t, dir } = useLanguage();
  const [clientId, setClientId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'MAD' | 'EUR'>('MAD');
  const [settlementRate, setSettlementRate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [cashBoxCode, setCashBoxCode] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FIFOPaymentResult | null>(null);

  const { toast } = useToast();
  const supabase = createClient();

  const { data: clientsRaw } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, city').order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: cashBoxesRaw } = useQuery({
    queryKey: ['cashBoxes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cash_boxes').select('*').order('id');
      if (error) throw error;
      return data as CashBox[];
    },
  });

  const clients = fallbackArray(clientsRaw, DEFAULT_CLIENTS);
  const cashBoxes = fallbackArray(cashBoxesRaw, DEFAULT_CASH_BOXES);

  // Query unpaid/partially paid invoices for the selected client to compute live preview
  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ['client-unpaid-invoices-dialog', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, paid_amount, status, issue_date, currency, exchange_rate, trip_id')
        .or(`client_id.eq.${clientId},client_id.eq.${String(clientId)}`)
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
    enabled: !!clientId,
  });

  // Calculate live FIFO allocation preview
  const preview = useMemo(() => {
    const numericAmount = parseFloat(amount);
    if (!clientId || isNaN(numericAmount) || numericAmount <= 0) return null;
    const rate = currency === 'EUR' && settlementRate ? parseFloat(settlementRate) : undefined;
    return previewFIFOAllocation(unpaidInvoices, numericAmount, rate);
  }, [clientId, unpaidInvoices, amount, currency, settlementRate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      if (!clientId) {
        toast({
          title: t('يرجى اختيار العميل', 'Veuillez sélectionner un client', 'Seleccione un cliente'),
          variant: 'destructive',
        });
        return;
      }

      const numericAmount = parseFloat(amount);
      if (!numericAmount || numericAmount <= 0) {
        toast({
          title: t('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'Veuillez saisir un montant valide supérieur à zéro', 'Ingrese un monto válido mayor a cero'),
          variant: 'destructive',
        });
        return;
      }

      const res = await recordBulkClientPayment({
        clientId: Number(clientId),
        totalAmountPaid: numericAmount,
        paymentMethod,
        reference: reference || undefined,
        cashBoxCode: cashBoxCode || 'owner_cash',
        currency,
        settlementRate: currency === 'EUR' && settlementRate ? parseFloat(settlementRate) : undefined,
      });

      if (!res.success) {
        toast({
          title: t('خطأ في معالجة الدفعة', 'Erreur de traitement du paiement', 'Error al procesar el pago'),
          description: res.error,
          variant: 'destructive',
        });
      } else {
        setResult(res);
        toast({
          title: t('✅ تمت معالجة الدفعة بنجاح', '✅ Paiement traité avec succès', '✅ Pago procesado con éxito'),
          description: t(
            `تم توزيع المبلغ على ${res.affectedInvoicesCount} فاتورة مستحقة.`,
            `Montant affecté à ${res.affectedInvoicesCount} facture(s) due(s).`,
            `Monto asignado a ${res.affectedInvoicesCount} factura(s) pendiente(s).`
          ),
        });
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : t('حدث خطأ أثناء معالجة الدفعة', 'Une erreur s\'est produite lors du traitement du paiement', 'Ocurrió un error al procesar el pago');
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue', 'Error inesperado'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setClientId('');
    setAmount('');
    setReference('');
    setCashBoxCode('');
    setCurrency('MAD');
    setSettlementRate('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto" dir={dir}>
      <Card className="w-full max-w-2xl my-8 shadow-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {t('تحصيل دفعة عميل بنظام FIFO', 'Encaissement Client par FIFO', 'Cobro de cliente por FIFO')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-5">
          {result ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2 font-bold text-base mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  {t('تم تسجيل التحصيل وتوزيع الدفعة بنجاح', 'Encaissement et distribution FIFO enregistrés avec succès', 'Cobro y distribución FIFO registrados con éxito')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('المبلغ الموزع على الفواتير: ', 'Montant affecté aux factures : ', 'Monto asignado a facturas : ')}
                  <span className="font-bold text-foreground font-mono">{result.totalAllocated.toFixed(2)} {currency}</span>
                  {result.unallocatedCredit > 0 && (
                    <span className={`${dir === 'rtl' ? 'mr-3' : 'ml-3'} text-amber-600 dark:text-amber-400 font-mono`}>
                      {t(
                        `(رصيد متبقي كفائض للعميل: ${result.unallocatedCredit.toFixed(2)} ${currency})`,
                        `(Solde excédentaire restant : ${result.unallocatedCredit.toFixed(2)} ${currency})`,
                        `(Saldo excedente restante : ${result.unallocatedCredit.toFixed(2)} ${currency})`
                      )}
                    </span>
                  )}
                </p>
              </div>

              {result.allocations.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    {t('تفاصيل تسوية الفواتير الأقدم:', 'Détails du règlement des factures antérieures :', 'Detalles de liquidación de facturas anteriores :')}
                  </h4>
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border text-sm">
                    {result.allocations.map((alloc) => (
                      <div key={alloc.invoiceId} className="p-3 flex items-center justify-between bg-muted/20">
                        <div>
                          <p className="font-bold text-foreground">
                            {t('فاتورة رقم: ', 'Facture N° : ', 'Factura N° : ')}{alloc.invoiceNumber}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${
                                alloc.newStatus === 'paid'
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {alloc.newStatus === 'paid'
                                ? t('تم السداد بالكامل', 'Payée intégralement', 'Pagada totalmente')
                                : t('سداد جزئي', 'Paiement partiel', 'Pago parcial')}
                            </span>
                            {alloc.forexEntry && alloc.forexEntry.type !== 'neutral' && (
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  alloc.forexEntry.type === 'gain'
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {alloc.forexEntry.type === 'gain' ? '▲ +' : '▼ -'}
                                {alloc.forexEntry.amount.toFixed(2)} MAD
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono`}>
                          <p className="text-xs text-muted-foreground">{t('المبلغ المسدد:', 'Montant réglé :', 'Monto pagado :')}</p>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            +{alloc.allocatedAmount.toFixed(2)} {currency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'لا توجد فواتير غير مدفوعة حالياً لهذا العميل. تم حفظ المبلغ كرصيد مستحق.',
                    'Aucune facture impayée pour ce client. Le montant a été crédité.',
                    'No hay facturas impagadas para este cliente. El monto fue acreditado.'
                  )}
                </p>
              )}

              <Button onClick={handleReset} className="w-full mt-4">
                {t('إغلاق', 'Fermer', 'Cerrar')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('العميل *', 'Client *', 'Cliente *')}</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    required
                  >
                    <option value="">{t('-- اختر العميل --', '-- Sélectionner le client --', '-- Seleccionar cliente --')}</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('مبلغ الدفعة المستلمة *', 'Montant reçu *', 'Monto recibido *')}</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      dir="ltr"
                      className="flex-1 font-mono"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'MAD' | 'EUR')}
                      className="w-24 h-10 px-2 border border-input bg-card rounded-lg text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="MAD">MAD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
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
                      {t('سعر الصرف البنكي', 'Taux effectif banque', 'Tipo de cambio banco')}
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="10.8500"
                    value={settlementRate}
                    onChange={(e) => setSettlementRate(e.target.value)}
                    dir="ltr"
                    className="font-mono text-sm bg-card"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      'سيقوم النظام آلياً باحتساب وقيد فروق الصرف المحققة (أرباح/خسائر عملة) في السجلات المحاسبية.',
                      'Le système calculera et enregistrera automatiquement les écarts de change réalisés.',
                      'El sistema calculará y registrará automáticamente las diferencias por tipo de cambio.'
                    )}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('طريقة الدفع *', 'Mode de paiement *', 'Método de pago *')}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="bank_transfer">{t('تحويل بنكي (Virement)', 'Virement bancaire', 'Transferencia bancaria')}</option>
                    <option value="check">{t('شيك بنكي (Chèque)', 'Chèque bancaire', 'Cheque bancario')}</option>
                    <option value="cash">{t('نقداً (Espèces)', 'Espèces', 'Efectivo')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('الصندوق النقدي المستلم *', 'Caisse réceptrice *', 'Caja receptora *')}</label>
                  <select
                    value={cashBoxCode}
                    onChange={(e) => setCashBoxCode(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    required
                  >
                    <option value="">{t('-- اختر الصندوق --', '-- Sélectionner la caisse --', '-- Seleccionar caja --')}</option>
                    {cashBoxes?.map((box) => (
                      <option key={box.id} value={box.code}>
                        {box.name} ({box.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('رقم المرجع / الشيك / التحويل', 'N° Référence / Chèque / Virement', 'N° Referencia / Cheque / Transferencia')}</label>
                <Input
                  placeholder={t('مثال: CHQ-89021 أو VIR-4412', 'Ex: CHQ-89021 ou VIR-4412', 'Ej: CHQ-89021 o VIR-4412')}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  dir="ltr"
                />
              </div>

              {/* Live FIFO Allocation Preview */}
              {preview && (
                <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                      {t('معاينة التوزيع المباشر (FIFO)', 'Aperçu de la distribution FIFO', 'Vista previa de distribución FIFO')}
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
                      {t(
                        'لا توجد فواتير غير مدفوعة. سيتم حفظ المبلغ كرصيد مستحق للعميل.',
                        'Aucune facture impayée. Le montant sera crédité.',
                        'Sin facturas impagadas. El monto se acreditará.'
                      )}
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

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-900 dark:text-blue-200">
                {t(
                  '💡 مبدأ FIFO: سيقوم النظام تلقائياً بالبحث عن أقدم الفواتير المستحقة لهذا العميل وسدادها أولاً بأول حتى اكتمال المبلغ بالكامل.',
                  '💡 Principe FIFO : Le système imputera automatiquement le montant aux factures les plus anciennes jusqu\'à épuisement du paiement.',
                  '💡 Principio FIFO: El sistema imputará automáticamente el monto a las facturas más antiguas hasta agotar el pago.'
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  {loading
                    ? t('جاري المعالجة وتوزيع الدفعة...', 'Traitement FIFO en cours...', 'Procesando FIFO...')
                    : t('تنفيذ التحصيل وتوزيع FIFO', 'Exécuter l\'encaissement FIFO', 'Ejecutar cobro FIFO')}
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  {t('إلغاء', 'Annuler', 'Cancelar')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
