'use client';

import React, { useState, useEffect } from 'react';
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
  CreditCard,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  Send,
  Loader2,
  Calendar,
  DollarSign,
} from 'lucide-react';
import type { PaymentGateway, PaymentCurrency, PaymentLink } from '../types/payment-gateway.types';
import { generatePaymentLinkAction } from '../services/payments.actions';
import { calculateGatewayFees } from '../services/payment-gateway.service';

interface GeneratePaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: number;
    invoice_number: string;
    client_id: string;
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    total_amount: string | number;
    paid_amount?: string | number;
    currency?: string;
  };
  onSuccess?: (paymentLink: PaymentLink) => void;
}

export function GeneratePaymentLinkModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}: GeneratePaymentLinkModalProps) {
  const { t, locale, dir } = useLanguage();
  const language = locale;
  const { toast } = useToast();

  const totalDec = new Decimal(invoice.total_amount || 0);
  const paidDec = new Decimal(invoice.paid_amount || 0);
  const remainingDec = Decimal.max(0, totalDec.minus(paidDec));

  const [amount, setAmount] = useState<string>(remainingDec.toFixed(2));
  const [gateway, setGateway] = useState<PaymentGateway>('multi');
  const [currency, setCurrency] = useState<PaymentCurrency>(
    (invoice.currency as PaymentCurrency) || 'MAD'
  );
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdLink, setCreatedLink] = useState<PaymentLink | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    setAmount(remainingDec.toFixed(2));
    setCurrency((invoice.currency as PaymentCurrency) || 'MAD');
    setCreatedLink(null);
  }, [invoice, remainingDec]);

  // Fee preview with Decimal.js
  const feePreview = calculateGatewayFees({
    amount: new Decimal(amount || '0'),
    gateway,
    currency,
  });

  const handleGenerate = async () => {
    try {
      setIsSubmitting(true);
      const res = await generatePaymentLinkAction({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientId: String(invoice.client_id),
        clientName: invoice.client_name,
        clientEmail: invoice.client_email,
        clientPhone: invoice.client_phone,
        amount,
        currency,
        gateway,
        expiresInDays,
      });

      if (!res.success || !res.paymentLink) {
        throw new Error(res.error || 'فشل توليد رابط السداد');
      }

      setCreatedLink(res.paymentLink);
      if (onSuccess) onSuccess(res.paymentLink);

      toast({
        title:
          language === 'es'
            ? 'Enlace generado con éxito'
            : language === 'fr'
              ? 'Lien de paiement généré'
              : 'تم توليد رابط السداد بنجاح',
        variant: 'default',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الرابط';
      toast({
        title:
          language === 'es'
            ? 'Error al generar el enlace'
            : language === 'fr'
              ? 'Erreur lors de la génération'
              : 'خطأ أثناء توليد الرابط',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdLink) return;
    navigator.clipboard.writeText(createdLink.payUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title:
        language === 'es'
          ? 'Enlace copiado al portapapeles'
          : language === 'fr'
            ? 'Lien copié dans le presse-papiers'
            : 'تم نسخ الرابط إلى الحافظة',
    });
  };

  const handleShareWhatsApp = () => {
    if (!createdLink) return;
    const phone = (invoice.client_phone || '').replace(/[^0-9]/g, '');
    const clientName = invoice.client_name || '';

    const textAr = `مرحباً ${clientName}،\nيرجى تسديد الفاتورة رقم ${invoice.invoice_number} بقيمة ${createdLink.amount} ${createdLink.currency} عبر الرابط الآمن التالي:\n${createdLink.payUrl}\nشركة ترانس بودانون للنقل الدولي.`;
    const textFr = `Bonjour ${clientName},\nVeuillez régler votre facture ${invoice.invoice_number} d'un montant de ${createdLink.amount} ${createdLink.currency} via le lien sécurisé suivant :\n${createdLink.payUrl}\nTrans Bodanon Transport International.`;
    const textEs = `Hola ${clientName},\nPor favor pague su factura ${invoice.invoice_number} por un importe de ${createdLink.amount} ${createdLink.currency} a través del siguiente enlace seguro:\n${createdLink.payUrl}\nTrans Bodanon Transporte Internacional.`;

    const text = language === 'es' ? textEs : language === 'fr' ? textFr : textAr;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px]" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold font-amiri">
            <CreditCard className="w-5 h-5 text-primary" />
            <span>
              {language === 'es'
                ? `Generar enlace de pago — ${invoice.invoice_number}`
                : language === 'fr'
                  ? `Générer un lien de paiement — ${invoice.invoice_number}`
                  : `توليد رابط سداد إلكتروني — ${invoice.invoice_number}`}
            </span>
          </DialogTitle>
        </DialogHeader>

        {!createdLink ? (
          <div className="space-y-4 py-2">
            {/* Invoice Info Banner */}
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-sm flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs">
                  {language === 'es'
                    ? 'Total de la factura'
                    : language === 'fr'
                      ? 'Total de la facture'
                      : 'إجمالي الفاتورة'}
                </p>
                <p className="font-mono font-bold text-foreground">
                  {totalDec.toFixed(2)} {invoice.currency || 'MAD'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">
                  {language === 'es'
                    ? 'Importe pendiente'
                    : language === 'fr'
                      ? 'Reste à payer'
                      : 'المبلغ المتبقي'}
                </p>
                <p className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {remainingDec.toFixed(2)} {invoice.currency || 'MAD'}
                </p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">
                {language === 'es' ? 'En línea' : language === 'fr' ? 'En ligne' : 'دفع رقمي'}
              </Badge>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {language === 'es'
                    ? 'Importe a cobrar'
                    : language === 'fr'
                      ? 'Montant à régler'
                      : 'المبلغ المراد تحصيله'}
                </span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="1"
                max={remainingDec.toNumber()}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono text-base font-bold"
              />
            </div>

            {/* Gateway Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {language === 'es'
                  ? 'Pasarela de pago'
                  : language === 'fr'
                    ? 'Passerelle de paiement'
                    : 'بوابة الدفع الإلكتروني'}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setGateway('multi')}
                  className={`p-3 rounded-lg border text-start transition-all flex flex-col gap-1 ${
                    gateway === 'multi'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      {language === 'es'
                        ? 'Multi-Pasarela'
                        : language === 'fr'
                          ? 'Multi-Passerelle'
                          : 'بوابة موحدة (Multi)'}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {language === 'es' ? 'Recomendado' : language === 'fr' ? 'Recommandé' : 'موصى به'}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {language === 'es'
                      ? 'Permite CMI, Stripe y Transferencia'
                      : language === 'fr'
                        ? 'Autorise CMI, Stripe et Virement'
                        : 'يتيح CMI و Stripe والتحويل البنكي'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGateway('cmi')}
                  className={`p-3 rounded-lg border text-start transition-all flex flex-col gap-1 ${
                    gateway === 'cmi'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <span className="font-bold text-sm">CMI Maroc</span>
                  <span className="text-[11px] text-muted-foreground">
                    {language === 'es'
                      ? 'Tarjetas bancarias marroquíes (MAD)'
                      : language === 'fr'
                        ? 'Cartes bancaires marocaines (MAD)'
                        : 'البطاقات البنكية المغربية (MAD)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGateway('stripe')}
                  className={`p-3 rounded-lg border text-start transition-all flex flex-col gap-1 ${
                    gateway === 'stripe'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <span className="font-bold text-sm">Stripe International</span>
                  <span className="text-[11px] text-muted-foreground">
                    {language === 'es'
                      ? 'Tarjetas internacionales y SEPA (EUR/USD)'
                      : language === 'fr'
                        ? 'Cartes internationales et SEPA (EUR/USD)'
                        : 'البطاقات الدولية وتحويلات SEPA'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGateway('bank_transfer')}
                  className={`p-3 rounded-lg border text-start transition-all flex flex-col gap-1 ${
                    gateway === 'bank_transfer'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <span className="font-bold text-sm">
                    {language === 'es' ? 'Virement Bancaire' : language === 'fr' ? 'Virement Bancaire' : 'تحويل بنكي مباشر (RIB)'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {language === 'es'
                      ? 'Sin comisión bancaria (0.00%)'
                      : language === 'fr'
                        ? 'Sans commission de passerelle (0.00%)'
                        : 'بدون أي عمولة اقتطاع (0.00%)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Fee calculation breakdown with Decimal.js */}
            <div className="p-3 rounded-lg bg-card border border-border/70 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {language === 'es'
                    ? 'Comisión estimada de pasarela'
                    : language === 'fr'
                      ? 'Commission passerelle estimée'
                      : 'عمولة بوابة الدفع التقديرية'}
                </span>
                <span>
                  {feePreview.totalGatewayFee} {currency}
                </span>
              </div>
              <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/50">
                <span>
                  {language === 'es'
                    ? 'Ingreso neto en tesorería'
                    : language === 'fr'
                      ? 'Net versé en trésorerie'
                      : 'صافي الإيداع في الخزينة'}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {feePreview.netSettlementAmount} {currency}
                </span>
              </div>
            </div>

            {/* Expiry option */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {language === 'es'
                  ? 'Validez del enlace:'
                  : language === 'fr'
                    ? 'Validité du lien :'
                    : 'صلاحية الرابط:'}
              </span>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="bg-transparent border rounded px-1.5 py-0.5 text-foreground font-mono"
              >
                <option value={7}>7 {t('أيام', 'jours', 'días')}</option>
                <option value={15}>15 {t('يوماً', 'jours', 'días')}</option>
                <option value={30}>30 {t('يوماً', 'jours', 'días')}</option>
                <option value={60}>60 {t('يوماً', 'jours', 'días')}</option>
              </select>
            </div>
          </div>
        ) : (
          /* Link Generated Success View */
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h4 className="font-bold text-base text-foreground">
                {language === 'es'
                  ? '¡Enlace de pago listo!'
                  : language === 'fr'
                    ? 'Lien de paiement prêt !'
                    : 'رابط السداد جاهز للاستخدام!'}
              </h4>
              <p className="text-xs text-muted-foreground">
                {language === 'es'
                  ? `Importe asignado: ${createdLink.amount} ${createdLink.currency}`
                  : language === 'fr'
                    ? `Montant alloué : ${createdLink.amount} ${createdLink.currency}`
                    : `المبلغ المخصص: ${createdLink.amount} ${createdLink.currency}`}
              </p>
            </div>

            {/* Link URL Input Box */}
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdLink.payUrl}
                className="font-mono text-xs text-foreground bg-muted/40 select-all"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
                title="Copy link"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(createdLink.payUrl, '_blank')}
                className="shrink-0"
                title="Open payment page"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Share Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                onClick={handleShareWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {language === 'es'
                    ? 'Enviar por WhatsApp'
                    : language === 'fr'
                      ? 'Partager via WhatsApp'
                      : 'مشاركة عبر واتساب'}
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>
                  {language === 'es'
                    ? 'Copiar enlace directo'
                    : language === 'fr'
                      ? 'Copier le lien direct'
                      : 'نسخ الرابط المباشر'}
                </span>
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!createdLink ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                {language === 'es' ? 'Cancelar' : language === 'fr' ? 'Annuler' : 'إلغاء'}
              </Button>
              <Button onClick={handleGenerate} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin ms-2" />
                ) : (
                  <CreditCard className="w-4 h-4 ms-2" />
                )}
                <span>
                  {language === 'es'
                    ? 'Crear enlace'
                    : language === 'fr'
                      ? 'Créer le lien'
                      : 'إنشاء الرابط'}
                </span>
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>
              {language === 'es' ? 'Cerrar' : language === 'fr' ? 'Fermer' : 'إغلاق'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

