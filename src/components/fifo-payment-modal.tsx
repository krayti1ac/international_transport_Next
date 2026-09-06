'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, CheckCircle2, ArrowRightLeft, DollarSign, Layers } from 'lucide-react';
import type { Client, BankAccount, CashBox } from '@/types/database';
import { processFIFOPayment, FIFOPaymentResult } from '@/lib/fifo-payment';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CLIENTS, DEFAULT_BANK_ACCOUNTS, DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';

interface FIFOPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  bankAccounts?: BankAccount[];
  cashBoxes?: CashBox[];
  onPaymentProcessed?: () => void;
  initialClientId?: number | '';
}

export function FIFOPaymentModal({
  isOpen,
  onClose,
  clients,
  bankAccounts = [],
  cashBoxes = [],
  onPaymentProcessed,
  initialClientId,
}: FIFOPaymentModalProps) {
  const { t, dir, locale } = useLanguage();
  const availableClients = fallbackArray(clients, DEFAULT_CLIENTS);
  const availableBankAccounts = fallbackArray(bankAccounts, DEFAULT_BANK_ACCOUNTS);
  const availableCashBoxes = fallbackArray(cashBoxes, DEFAULT_CASH_BOXES);

  const [selectedClientId, setSelectedClientId] = useState<number | ''>(initialClientId || '');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('MAD');
  const [method, setMethod] = useState<string>('bank_transfer');
  const [bankAccountId, setBankAccountId] = useState<number | ''>('');
  const [cashBoxId, setCashBoxId] = useState<number | ''>('');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FIFOPaymentResult | null>(null);

  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && initialClientId) {
      setSelectedClientId(initialClientId);
    }
  }, [isOpen, initialClientId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      toast({ title: t('يرجى اختيار العميل', 'Veuillez sélectionner le client'), variant: 'destructive' });
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: t('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'Veuillez saisir un montant supérieur à zéro'), variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await processFIFOPayment(supabase, {
        clientId: Number(selectedClientId),
        amount: numAmount,
        currency,
        paymentMethod: method,
        bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
        cashBoxId: cashBoxId ? Number(cashBoxId) : undefined,
        reference,
        notes,
      });

      if (!res.success) {
        toast({
          title: t('خطأ في معالجة الدفعة', 'Erreur lors du traitement du paiement'),
          description: res.error,
          variant: 'destructive',
        });
      } else {
        setResult(res);
        toast({
          title: t('✅ تمت معالجة الدفعة بنجاح', '✅ Paiement traité avec succès'),
          description: t(`تم توزيع المبلغ على ${res.affectedInvoicesCount} فاتورة مستحقة.`, `Montant alloué sur ${res.affectedInvoicesCount} facture(s) due(s).`),
        });
        if (onPaymentProcessed) {
          onPaymentProcessed();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setAmount('');
    setReference('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto" dir={dir}>
      <Card className="w-full max-w-2xl my-8 shadow-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {t('تحصيل دفعة عميل بنظام FIFO (تسوية الأقدم أولاً)', 'Encaissement Client FIFO (Règlement par antériorité)')}
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
                  {t('تم تسجيل التحصيل وتوزيع الدفعة بنجاح', 'Encaissement et allocation réussis')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('المبلغ الموزع على الفواتير:', 'Montant imputé sur les factures :')} <span className="font-bold text-foreground">{result.totalAllocated.toFixed(2)} {currency}</span>
                  {result.unallocatedCredit > 0 && (
                    <span className={`${dir === 'rtl' ? 'mr-3' : 'ml-3'} text-amber-600 dark:text-amber-400`}>
                      ({t('رصيد متبقي كفائض للعميل:', 'Solde restant en avoir :')} {result.unallocatedCredit.toFixed(2)} {currency})
                    </span>
                  )}
                </p>
              </div>

              {result.allocations.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">{t('تفاصيل تسوية الفواتير الأقدم:', 'Détails des factures apurées :')}</h4>
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border text-sm">
                    {result.allocations.map((alloc) => (
                      <div key={alloc.invoiceId} className="p-3 flex items-center justify-between bg-muted/20">
                        <div>
                          <p className="font-bold text-foreground">{t('فاتورة رقم:', 'Facture n° :')} {alloc.invoiceNumber}</p>
                          <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full mt-1 ${
                            alloc.newStatus === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}>
                            {alloc.newStatus === 'paid' ? t('تم السداد بالكامل', 'Payée en totalité') : t('سداد جزئي', 'Partiellement payée')}
                          </span>
                        </div>
                        <div className="text-left font-mono">
                          <p className="text-xs text-muted-foreground">{t('المبلغ المسدد:', 'Montant alloué :')}</p>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            +{alloc.allocatedAmount.toFixed(2)} {currency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('لا توجد فواتير غير مدفوعة حالياً لهذا العميل. تم حفظ المبلغ كرصيد مستحق.', 'Aucune facture impayée pour ce client. Le montant est conservé comme avoir.')}</p>
              )}

              <Button onClick={handleReset} className="w-full mt-4">
                {t('إغلاق', 'Fermer')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('العميل *', 'Client *')}</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    required
                  >
                    <option value="">{`-- ${t('اختر العميل', 'Sélectionner le client')} --`}</option>
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('مبلغ الدفعة المستلمة *', 'Montant reçu *')}</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      dir="ltr"
                      className="flex-1"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="MAD">MAD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('طريقة الدفع *', 'Mode de paiement *')}</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="bank_transfer">{t('تحويل بنكي (Virement)', 'Virement bancaire')}</option>
                    <option value="check">{t('شيك بنكي (Chèque)', 'Chèque')}</option>
                    <option value="cash">{t('نقداً (Espèces)', 'Espèces')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {method === 'cash' ? t('صندوق الخزينة المستلم', 'Caisse de destination') : t('الحساب البنكي المودع به', 'Compte bancaire')}
                  </label>
                  {method === 'cash' ? (
                    <select
                      value={cashBoxId}
                      onChange={(e) => setCashBoxId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">{`-- ${t('الصندوق المكتبي الافتراضي', 'Caisse par défaut')} --`}</option>
                      {availableCashBoxes.map((box) => (
                        <option key={box.id} value={box.id}>
                          {box.name} ({box.currency})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">{`-- ${t('الحساب البنكي الافتراضي', 'Compte bancaire par défaut')} --`}</option>
                      {availableBankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - {b.account_number} ({b.currency})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('رقم المرجع / الشيك / التحويل', 'N° de référence / Chèque / Virement')}</label>
                  <Input
                    placeholder={t('مثال: CHQ-89021 أو VIR-4412', 'Ex: VIR-1029 أو CHQ-4412')}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('ملاحظات التحصيل', 'Notes')}</label>
                  <Input
                    placeholder={t('ملاحظات اختيارية...', 'Notes optionnelles...')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-900 dark:text-blue-200">
                💡 <strong>{t('مبدأ FIFO:', 'Principe FIFO :')}</strong> {t('سيقوم النظام تلقائياً بالبحث عن أقدم الفواتير المستحقة لهذا العميل وسدادها أولاً بأول حتى اكتمال المبلغ بالكامل.', 'Le système affecte ce paiement aux factures impayées les plus anciennes du client par ordre chronologique.')}
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  {loading ? t('جاري المعالجة وتوزيع الدفعة...', 'Traitement...') : t('تنفيذ التحصيل وتوزيع FIFO', 'Encaisser via FIFO')}
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  {t('إلغاء', 'Annuler')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

