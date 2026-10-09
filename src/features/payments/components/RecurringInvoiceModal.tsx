'use client';

import React, { useState } from 'react';
import Decimal from 'decimal.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import {
  Repeat,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';
import type { RecurringFrequency } from '../types/recurring-invoice.types';
import type { PaymentCurrency, PaymentGateway } from '../types/payment-gateway.types';
import { createRecurringScheduleAction } from '../services/payments.actions';

interface RecurringInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients?: { id: string | number; name: string }[];
  onSuccess?: () => void;
}

export function RecurringInvoiceModal({
  isOpen,
  onClose,
  clients = [],
  onSuccess,
}: RecurringInvoiceModalProps) {
  const { locale, dir } = useLanguage();
  const language = locale;
  const { toast } = useToast();

  const [clientId, setClientId] = useState<string>(clients[0]?.id ? String(clients[0].id) : '93');
  const [title, setTitle] = useState<string>('عقد شحن دوري - أكادير ➔ فالنسيا');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [currency, setCurrency] = useState<PaymentCurrency>('MAD');
  const [amountHt, setAmountHt] = useState<string>('48000.00');
  const [isArticle92Exempt, setIsArticle92Exempt] = useState<boolean>(true);
  const [tvaRate, setTvaRate] = useState<string>('0.00');
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>('');
  const [billingDayOfMonth, setBillingDayOfMonth] = useState<number>(1);
  const [autoSendEmail, setAutoSendEmail] = useState<boolean>(true);
  const [autoSendWhatsapp, setAutoSendWhatsapp] = useState<boolean>(true);
  const [autoGeneratePaymentLink, setAutoGeneratePaymentLink] = useState<boolean>(true);
  const [preferredGateway, setPreferredGateway] = useState<PaymentGateway>('multi');
  const [maxCycles, setMaxCycles] = useState<string>('12');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Decimal.js calculation
  const htDec = new Decimal(amountHt || '0');
  const rateDec = isArticle92Exempt ? new Decimal(0) : new Decimal(tvaRate || '0');
  const tvaAmountDec = htDec.times(rateDec.dividedBy(100));
  const totalTtcDec = htDec.plus(tvaAmountDec);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId || htDec.lessThanOrEqualTo(0)) {
      toast({
        title:
          language === 'es'
            ? 'Por favor complete los campos obligatorios'
            : language === 'fr'
              ? 'Veuillez remplir les champs obligatoires'
              : 'يرجى تعبئة الحقول الإلزامية بمبالغ صحيحة',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createRecurringScheduleAction({
        clientId,
        title,
        frequency,
        currency,
        amountHt,
        tvaRate: isArticle92Exempt ? '0.00' : tvaRate,
        isArticle92Exempt,
        startDate,
        endDate: endDate ? endDate : undefined,
        billingDayOfMonth,
        autoSendEmail,
        autoSendWhatsapp,
        autoGeneratePaymentLink,
        preferredGateway,
        maxCycles: maxCycles ? Number(maxCycles) : undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'فشل حفظ جدول الفوترة');
      }

      toast({
        title:
          language === 'es'
            ? 'Plan de facturación periódica creado'
            : language === 'fr'
              ? 'Plan de facturation récurrente créé'
              : 'تم إنشاء جدول الفوترة الدورية بنجاح',
        variant: 'default',
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء الإنشاء';
      toast({
        title:
          language === 'es'
            ? 'Error al crear la programación'
            : language === 'fr'
              ? 'Erreur lors de la création'
              : 'فشل حفظ جدول الفوترة',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold font-amiri">
            <Repeat className="w-5 h-5 text-primary" />
            <span>
              {language === 'es'
                ? 'Nueva Programación de Facturación Recurrente'
                : language === 'fr'
                  ? 'Nouvelle Facturation Récurrente Automatisée'
                  : 'إنشاء جدول فوترة دورية تلقائية للعقود'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Title & Client */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {language === 'es'
                    ? 'Título o contrato logístico'
                    : language === 'fr'
                      ? 'Titre ou contrat logistique'
                      : 'عنوان العقد أو الخدمة الدورية'}
                </span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: شحن مبرد أسبوعي - تعاونية سوس"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {language === 'es' ? 'Cliente' : language === 'fr' ? 'Client' : 'العميل'}
              </label>
              {clients.length > 0 ? (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-2xs font-sans text-foreground"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name} (#{c.id})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="معرّف العميل (Client ID)"
                  required
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {language === 'es'
                  ? 'Frecuencia de emisión'
                  : language === 'fr'
                    ? 'Périodicité'
                    : 'دورية الإصدار'}
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-2xs font-sans text-foreground"
              >
                <option value="weekly">
                  {language === 'es' ? 'Semanal' : language === 'fr' ? 'Hebdomadaire' : 'أسبوعي (Weekly)'}
                </option>
                <option value="biweekly">
                  {language === 'es' ? 'Quincenal' : language === 'fr' ? 'Bi-hebdomadaire' : 'كل أسبوعين (Bi-weekly)'}
                </option>
                <option value="monthly">
                  {language === 'es' ? 'Mensual' : language === 'fr' ? 'Mensuel' : 'شهري (Monthly)'}
                </option>
                <option value="quarterly">
                  {language === 'es' ? 'Trimestral' : language === 'fr' ? 'Trimestriel' : 'ربع سنوي (Quarterly)'}
                </option>
                <option value="annually">
                  {language === 'es' ? 'Anual' : language === 'fr' ? 'Annuel' : 'سنوي (Annually)'}
                </option>
              </select>
            </div>
          </div>

          {/* Amounts & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {language === 'es'
                    ? 'Importe neto (HT)'
                    : language === 'fr'
                      ? 'Montant net HT'
                      : 'المبلغ الصافي (HT)'}
                </span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="1"
                value={amountHt}
                onChange={(e) => setAmountHt(e.target.value)}
                className="font-mono text-sm font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {language === 'es' ? 'Moneda' : language === 'fr' ? 'Devise' : 'العملة'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as PaymentCurrency)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-2xs font-mono text-foreground"
              >
                <option value="MAD">MAD (درهم مغربي)</option>
                <option value="EUR">EUR (€ يورو)</option>
                <option value="USD">USD ($ دولار)</option>
                <option value="GBP">GBP (£ إسترليني)</option>
              </select>
            </div>
          </div>

          {/* Tax Exemption (Article 92-I-10° du CGI) */}
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="art92Check"
                  checked={isArticle92Exempt}
                  onChange={(e) => setIsArticle92Exempt(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="art92Check" className="font-bold cursor-pointer text-foreground">
                  {language === 'es'
                    ? 'Exención del IVA — Art. 92-I-10° CGI (Transporte Internacional)'
                    : language === 'fr'
                      ? 'Exonération de TVA — Art. 92-I-10° CGI (Transport International)'
                      : 'إعفاء كلي من الضريبة 0% TVA (المادة 92-I-10° من المدونة العامة للضرائب)'}
                </label>
              </div>
              <p className="text-muted-foreground text-[11px]">
                {language === 'es'
                  ? 'Aplica automáticamente tasa cero del IVA para operaciones de transporte internacional transfronterizo.'
                  : language === 'fr'
                    ? 'Applique automatiquement un taux zéro de TVA pour le transport international transfrontalier.'
                    : 'يطبق نسبة 0% للضريبة على القيمة المضافة لعمليات النقل الطرقي الدولي العابر للحدود.'}
              </p>
            </div>
          </div>

          {/* Schedule Dates & Day */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{language === 'es' ? 'Inicio' : language === 'fr' ? 'Date début' : 'تاريخ البدء'}</span>
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {language === 'es' ? 'Fin (opcional)' : language === 'fr' ? 'Fin (facultatif)' : 'تاريخ الانتهاء'}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {language === 'es' ? 'Día de cobro' : language === 'fr' ? 'Jour d\'émission' : 'يوم الاستحقاق'}
              </label>
              <Input
                type="number"
                min="1"
                max="31"
                value={billingDayOfMonth}
                onChange={(e) => setBillingDayOfMonth(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Automation Toggles */}
          <div className="p-3 rounded-lg border bg-card text-xs space-y-2">
            <span className="font-bold text-foreground">
              {language === 'es'
                ? 'Automatizaciones en cada ciclo:'
                : language === 'fr'
                  ? 'Automatisations à chaque cycle :'
                  : 'الأتمتة التلقائية عند كل دورة:'}
            </span>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGeneratePaymentLink}
                  onChange={(e) => setAutoGeneratePaymentLink(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <span>
                  {language === 'es'
                    ? 'Generar enlace de pago digital'
                    : language === 'fr'
                      ? 'Générer lien de paiement'
                      : 'توليد رابط سداد رقمي تلقائياً'}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSendWhatsapp}
                  onChange={(e) => setAutoSendWhatsapp(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <span>
                  {language === 'es'
                    ? 'Enviar enlace por WhatsApp'
                    : language === 'fr'
                      ? 'Envoyer le lien par WhatsApp'
                      : 'إرسال الرابط عبر واتساب'}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSendEmail}
                  onChange={(e) => setAutoSendEmail(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <span>
                  {language === 'es'
                    ? 'Enviar factura por Email'
                    : language === 'fr'
                      ? 'Envoyer facture par Email'
                      : 'إرسال الفاتورة عبر الإيميل'}
                </span>
              </label>
            </div>
          </div>

          {/* Total Summary Footer */}
          <div className="p-3 rounded-lg bg-muted/40 border text-xs flex items-center justify-between font-mono">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                {language === 'es' ? 'Total por ciclo' : language === 'fr' ? 'Total par cycle' : 'إجمالي الدورة (TTC)'}
              </span>
              <span className="text-lg font-bold text-foreground">
                {totalTtcDec.toFixed(2)} {currency}
              </span>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 me-1" />
              {frequency.toUpperCase()}
            </Badge>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {language === 'es' ? 'Cancelar' : language === 'fr' ? 'Annuler' : 'إلغاء'}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin ms-2" />
              ) : (
                <Repeat className="w-4 h-4 ms-2" />
              )}
              <span>
                {language === 'es'
                  ? 'Guardar programación'
                  : language === 'fr'
                    ? 'Enregistrer le calendrier'
                    : 'حفظ جدول الفوترة'}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

