'use client';

import { useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  X,
  Receipt,
  Printer,
  Save,
  MessageCircle,
  Building,
  Calendar,
  DollarSign,
  ArrowRightLeft,
  CheckCircle2,
  FileText
} from 'lucide-react';
import type { Invoice, Client, BankAccount } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CLIENTS, DEFAULT_BANK_ACCOUNTS, fallbackArray } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  invoices: Invoice[];
  bankAccounts?: BankAccount[];
  initialInvoice?: Invoice | null;
  onSaved?: () => void;
  onOpenFIFOPayment?: (client: Client | null) => void;
}

export function PaymentRequestModal({
  isOpen,
  onClose,
  clients,
  invoices,
  bankAccounts = [],
  initialInvoice,
  onSaved,
  onOpenFIFOPayment,
}: PaymentRequestModalProps) {
  const { t, dir, locale } = useLanguage();
  const availableClients = fallbackArray(clients, DEFAULT_CLIENTS);
  const availableBanks = fallbackArray(bankAccounts, DEFAULT_BANK_ACCOUNTS);

  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | ''>('');
  const [requestRef, setRequestRef] = useState<string>('');
  const [requestDate, setRequestDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [amount, setAmount] = useState<string>('0.00');
  const [currency, setCurrency] = useState<string>('MAD');
  const [selectedBankId, setSelectedBankId] = useState<number | ''>('');
  const [customBankInfo, setCustomBankInfo] = useState<string>('');
  const [notes, setNotes] = useState<string>('يرجى تضمين رقم طلب الدفع في سبب التحويل البنكي.');
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) {
      setIsPrintMode(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setRequestDate(today);
    setDueDate(defaultDue);

    if (initialInvoice) {
      setSelectedInvoiceId(initialInvoice.id);
      setSelectedClientId(Number(initialInvoice.client_id) || '');
      setAmount(String(initialInvoice.ttc_amount || initialInvoice.total_amount || '0'));
      setCurrency(initialInvoice.currency || 'MAD');
      setRequestRef(
        initialInvoice.payment_request_ref ||
        `PR-${new Date().getFullYear()}-${String(initialInvoice.id).padStart(4, '0')}`
      );
      if (initialInvoice.due_date) {
        setDueDate(initialInvoice.due_date);
      }
    } else {
      setSelectedInvoiceId('');
      setRequestRef(`PR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
    }

    if (availableBanks.length > 0 && selectedBankId === '') {
      setSelectedBankId(availableBanks[0].id);
      setCustomBankInfo(
        `${availableBanks[0].bank_name || availableBanks[0].name} - RIB: ${
          availableBanks[0].account_number || ''
        }`
      );
    }
  }, [isOpen, initialInvoice, availableBanks]);

  if (!isOpen) return null;

  const currentClient = availableClients.find((c) => c.id === Number(selectedClientId));
  const currentInvoice = invoices.find((i) => i.id === Number(selectedInvoiceId));
  const clientInvoices = invoices.filter(
    (inv) => selectedClientId && Number(inv.client_id) === Number(selectedClientId)
  );

  const handleClientChange = (clientIdStr: string) => {
    const cid = clientIdStr ? Number(clientIdStr) : '';
    setSelectedClientId(cid);
    setSelectedInvoiceId('');

    if (cid) {
      const client = availableClients.find((c) => c.id === cid);
      if (client?.currency) setCurrency(client.currency);

      const firstUnpaid = invoices.find(
        (inv) => Number(inv.client_id) === cid && inv.status !== 'paid'
      );
      if (firstUnpaid) {
        setSelectedInvoiceId(firstUnpaid.id);
        setAmount(String(firstUnpaid.ttc_amount || firstUnpaid.total_amount || '0'));
        setCurrency(firstUnpaid.currency || 'MAD');
      }
    }
  };

  const handleInvoiceChange = (invIdStr: string) => {
    const invId = invIdStr ? Number(invIdStr) : '';
    setSelectedInvoiceId(invId);
    if (invId) {
      const inv = invoices.find((i) => i.id === invId);
      if (inv) {
        setAmount(String(inv.ttc_amount || inv.total_amount || '0'));
        setCurrency(inv.currency || 'MAD');
        if (inv.due_date) setDueDate(inv.due_date);
        if (inv.payment_request_ref) setRequestRef(inv.payment_request_ref);
      }
    }
  };

  const handleBankChange = (bankIdStr: string) => {
    const bId = bankIdStr ? Number(bankIdStr) : '';
    setSelectedBankId(bId);
    const bank = availableBanks.find((b) => b.id === bId);
    if (bank) {
      setCustomBankInfo(
        `${bank.bank_name || bank.name} - RIB: ${bank.account_number || ''}`
      );
    }
  };

  const handleSavePaymentRequest = async () => {
    if (!selectedClientId) {
      toast({ title: t('يرجى اختيار العميل أولاً', "Veuillez d'abord sélectionner le client"), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (selectedInvoiceId) {
        const { error } = await supabase
          .from('invoices')
          .update({
            payment_request_ref: requestRef,
            due_date: dueDate,
            bank_info_text: customBankInfo,
          })
          .eq('id', Number(selectedInvoiceId));

        if (error) throw error;
      }

      toast({
        title: t('✅ تم حفظ وتثبيت طلب الدفع بنجاح', '✅ Demande de paiement enregistrée avec succès'),
        description: t(`تم ربط المرجع ${requestRef} بالملف المحاسبي.`, `Référence ${requestRef} liée au compte.`),
      });

      if (onSaved) onSaved();
    } catch (err: any) {
      toast({
        title: t('خطأ أثناء الحفظ', "Erreur lors de l'enregistrement"),
        description: err?.message || t('تعذر حفظ طلب الدفع', "Impossible d'enregistrer la demande"),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!currentClient?.phone) {
      toast({
        title: t('رقم هاتف العميل غير مسجل', 'Numéro de téléphone client non enregistré'),
        description: t('يرجى التأكد من إضافة رقم هاتف للعميل في بطاقة بياناته.', 'Veuillez ajouter un numéro de téléphone dans la fiche client.'),
        variant: 'destructive',
      });
      return;
    }

    const cleanPhone = currentClient.phone.replace(/[^0-9]/g, '');
    const clientName = currentClient.name || (locale === 'fr' ? 'Cher Client' : 'العميل المحترم');
    const invText = currentInvoice?.invoice_number 
      ? (locale === 'fr' ? `Concernant la facture: ${currentInvoice.invoice_number}` : `بخصوص الفاتورة: ${currentInvoice.invoice_number}`) 
      : '';

    const message = locale === 'fr'
      ? `Bonjour,\nChers partenaires : *${clientName}*\n\nNous vous informons de l'émission de la *Demande de Paiement* n° : *${requestRef}*\n${invText}\n*Montant exigible :* ${new Decimal(amount || 0).toNumber().toLocaleString()} ${currency}\n*Date d'échéance :* ${dueDate}\n\n*Coordonnées bancaires pour virement :*\n${customBankInfo}\n\nMerci de procéder au virement et de nous transmettre le bordereau.\nCordialement,\nTrans Bodanon.`
      : `السلام عليكم ورحمة الله،\nالسادة المحترمون: *${clientName}*\n\nنحيطكم علماً بصدور *طلب الدفع (Demande de Paiement)* رقم: *${requestRef}*\n${invText}\n*المبلغ المستحق:* ${new Decimal(amount || 0).toNumber().toLocaleString()} ${currency}\n*تاريخ الاستحقاق:* ${dueDate}\n\n*بيانات التحويل البنكي:*\n${customBankInfo}\n\nيرجى التكرم بتنفيذ التحويل وإشعارنا برقم الإشعار البنكي.\nشاكرين حسن تعاونكم،\nشركة النقل الدولي السريع.`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      dir={dir}
    >
      <Card className="w-full max-w-3xl my-6 shadow-2xl border-border bg-card overflow-hidden">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/80 pb-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="font-amiri text-xl text-foreground">
                {t('إنشاء وتصدير طلب الدفع (Demande de Paiement)', 'Création et export de demande de paiement')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'إصدار وثيقة المطالبة المالية الرسمية، ربطها بالحساب البنكي، وتوجيه إشعار للعميل.',
                  'Émission du document officiel de paiement, coordonnées bancaires et notification client.'
                )}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {!isPrintMode ? (
            /* Form Mode */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">{t('العميل المستهدف *', 'Client ciblé *')}</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    required
                  >
                    <option value="">{`-- ${t('اختر العميل', 'Sélectionner le client')} --`}</option>
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''} - {c.currency || 'MAD'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">{t('ربط بفاتورة مستحقة (اختياري)', 'Associer à une facture (Optionnel)')}</label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="">{`-- ${t('طلب دفع عام أو مستقل', 'Demande générale ou indépendante')} --`}</option>
                    {clientInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number || `${t('فاتورة', 'Facture')} #${inv.id}`} - {inv.total_amount} {inv.currency} ({inv.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Reference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">{t('رقم مرجع طلب الدفع (Ref) *', 'N° Réf Demande *')}</label>
                  <Input
                    value={requestRef}
                    onChange={(e) => setRequestRef(e.target.value)}
                    placeholder="PR-2026-0001"
                    className="h-10 text-xs font-mono rounded-xl bg-card"
                    dir="ltr"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">{t('المبلغ المطلوب سداده *', 'Montant à payer *')}</label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-card"
                      dir="ltr"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-10 px-2 text-xs border border-input bg-card rounded-xl font-bold"
                    >
                      <option value="MAD">MAD</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">{t('تاريخ الاستحقاق *', "Date d'échéance *")}</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-10 text-xs rounded-xl bg-card"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Bank Account */}
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-primary" />
                    {t('بيانات الحساب البنكي لاستقبال التحويل', 'Coordonnées bancaires pour virement')}
                  </span>
                  <select
                    value={selectedBankId}
                    onChange={(e) => handleBankChange(e.target.value)}
                    className="text-xs h-8 px-2.5 border border-input bg-card rounded-lg font-medium"
                  >
                    <option value="">{`-- ${t('اختيار حساب بنكي مسجل', 'Sélectionner une banque')} --`}</option>
                    {availableBanks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name || b.name} ({b.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  value={customBankInfo}
                  onChange={(e) => setCustomBankInfo(e.target.value)}
                  placeholder={t('اسم البنك ورقم الحساب (RIB)...', 'Nom de banque et RIB...')}
                  className="h-9 text-xs font-mono bg-card rounded-xl"
                  dir="ltr"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">{t('ملاحظات وتعليمات السداد', 'Notes & Instructions')}</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('تعليمات أو شروط إضافية للعميل...', 'Instructions complémentaires...')}
                  className="h-10 text-xs rounded-xl bg-card"
                />
              </div>

              {/* Action Bar */}
              <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleSavePaymentRequest}
                    disabled={saving}
                    className="h-10 px-4 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  >
                    <Save className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
                    {saving ? t('جاري الحفظ...', 'Enregistrement...') : t('حفظ وتثبيت المرجع', 'Enregistrer')}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPrintMode(true)}
                    className="h-10 px-4 rounded-xl text-xs font-semibold bg-card border-border shadow-2xs"
                  >
                    <Printer className={`w-4 h-4 text-primary ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
                    {t('معاينة وطباعة الوثيقة', 'Aperçu & Imprimer')}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleWhatsAppShare}
                    className="h-10 px-4 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  >
                    <MessageCircle className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
                    {t('إرسال إشعار واتساب', 'WhatsApp')}
                  </Button>
                </div>

                {onOpenFIFOPayment && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      onClose();
                      onOpenFIFOPayment(currentClient || null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground h-10 px-3 rounded-xl"
                  >
                    <ArrowRightLeft className={`w-4 h-4 text-emerald-600 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
                    {t('تسجيل دفعة سداد (FIFO)', 'Encaisser (FIFO)')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Printable Document Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('معاينة وثيقة طلب الدفع الرسمية القابلة للطباعة', 'Aperçu officiel imprimable')}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => window.print()}
                    className="h-8 text-xs rounded-xl font-semibold gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t('طباعة الآن', 'Imprimer')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPrintMode(false)}
                    className="h-8 text-xs rounded-xl"
                  >
                    {t('العودة للنموذج', 'Retour')}
                  </Button>
                </div>
              </div>

              {/* Document Paper Container */}
              <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
                {/* Letterhead */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-5 mb-5">
                  <div>
                    <h2 className="text-xl font-bold font-amiri text-slate-900">
                      شركة النقل الدولي السريع
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">TRANS BODANON INTERNATIONAL LOGISTICS</p>
                    <p className="text-xs text-slate-500">طنجة - المملكة المغربية</p>
                  </div>
                  <div className="text-left" dir="ltr">
                    <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider">
                      Demande de Paiement
                    </div>
                    <p className="text-sm font-mono font-bold text-slate-800 mt-2">
                      Réf: {requestRef}
                    </p>
                    <p className="text-xs text-slate-500">Date: {requestDate}</p>
                  </div>
                </div>

                {/* Client & Payment Info Box */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">الجهة المطالبة بالسداد (Client):</span>
                    <p className="text-sm font-bold text-slate-900">{currentClient?.name || 'العميل'}</p>
                    {currentClient?.ice && <p className="text-slate-600 font-mono">ICE: {currentClient.ice}</p>}
                    <p className="text-slate-600">{currentClient?.city || currentClient?.address || 'المغرب'}</p>
                    <p className="text-slate-600">{currentClient?.phone}</p>
                  </div>
                  <div className="text-left" dir="ltr">
                    <span className="font-bold text-slate-700 block mb-1">Payment Schedule:</span>
                    <p><span className="text-slate-500">Due Date:</span> <span className="font-bold text-rose-600">{dueDate}</span></p>
                    <p><span className="text-slate-500">Currency:</span> <span className="font-bold">{currency}</span></p>
                    {currentInvoice?.invoice_number && (
                      <p><span className="text-slate-500">Related Invoice:</span> #{currentInvoice.invoice_number}</p>
                    )}
                  </div>
                </div>

                {/* Summary Table */}
                <table className="w-full text-right border-collapse mb-5 text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-700 bg-slate-100">
                      <th className="p-2.5">بيان المطالبة المالية (Désignation)</th>
                      <th className="p-2.5 text-center">المرجع</th>
                      <th className="p-2.5 text-left">المبلغ المطلوب (TTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-3">
                        طلب سداد مستحقات خدمات النقل الدولي والشحن اللوجستي
                        {currentInvoice?.route && (
                          <span className="block text-[11px] text-slate-500 mt-0.5">مسار الشحن: {currentInvoice.route}</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">{requestRef}</td>
                      <td className="p-3 text-left font-mono font-extrabold text-sm text-slate-900">
                        {new Decimal(amount || 0).toNumber().toLocaleString()} {currency}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Bank Account Details Box */}
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 mb-5">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" />
                    بيانات التحويل البنكي المعتمدة (Coordonnées Bancaires):
                  </p>
                  <p className="font-mono font-bold text-sm tracking-wide">{customBankInfo}</p>
                  {notes && <p className="text-[11px] text-blue-800 mt-1">{notes}</p>}
                </div>

                {/* Footer Stamp & Signature */}
                <div className="flex justify-between items-end pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <div>
                    <p className="font-medium">حرر بتاريخ: {requestDate}</p>
                    <p className="text-[10px] text-slate-400">وثيقة مالية صادرة بنظام الإدارة الرقمية</p>
                  </div>
                  <div className="text-center">
                    <div className="w-32 h-14 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 mb-1">
                      ختم وتوقيع الإدارة المالية
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

