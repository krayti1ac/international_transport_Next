'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Decimal from 'decimal.js';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Lock,
  ArrowRight,
  ArrowLeft,
  FileCheck,
  Printer,
  Loader2,
  DollarSign,
  Landmark,
} from 'lucide-react';
import { getPaymentLinkByTokenAction, confirmOnlinePaymentAction } from '@/features/payments/services/payments.actions';
import type { PaymentGateway, PaymentLink } from '@/features/payments/types/payment-gateway.types';

export default function PublicPaymentPage() {
  const params = useParams();
  const token = params?.token as string;

  const [language, setLanguage] = useState<'ar' | 'fr' | 'es'>('ar');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);
  const [invoice, setInvoice] = useState<{
    id: number;
    invoiceNumber: string;
    totalAmount: string;
    paidAmount: string;
    remainingAmount: string;
    currency: string;
    status: string;
    sellerIce: string;
    buyerIce: string;
  } | null>(null);

  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('cmi');
  const [processing, setProcessing] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [transactionRef, setTransactionRef] = useState<string>('');
  const { toast } = useToast();

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    async function loadLink() {
      if (!token) {
        setError('رمز الرابط مفقود');
        setLoading(false);
        return;
      }

      const res = await getPaymentLinkByTokenAction(token);
      if (!res.success || !res.paymentLink || !res.invoice) {
        setError(res.error || 'رابط السداد غير صالح أو منتهي الصلاحية');
      } else {
        setPaymentLink(res.paymentLink);
        setInvoice(res.invoice);
        if (res.paymentLink.status === 'paid' || res.invoice.status === 'paid') {
          setPaymentSuccess(true);
          setTransactionRef(res.paymentLink.token.slice(0, 16));
        }
      }
      setLoading(false);
    }

    loadLink();
  }, [token]);

  const handlePayNow = async () => {
    if (!paymentLink || !invoice) return;

    try {
      setProcessing(true);

      const ref = `${selectedGateway.toUpperCase()}-${Date.now().toString().slice(-8)}`;

      // Execute payment settlement
      const res = await confirmOnlinePaymentAction({
        token,
        gateway: selectedGateway,
        transactionReference: ref,
        paidAmount: paymentLink.amount,
        currency: paymentLink.currency,
      });

      if (!res.success) {
        throw new Error(res.error || 'فشلت معالجة السداد');
      }

      setTransactionRef(ref);
      setPaymentSuccess(true);

      toast({
        title:
          language === 'es'
            ? '¡Pago completado con éxito!'
            : language === 'fr'
              ? 'Paiement effectué avec succès !'
              : 'تمت عملية السداد الإلكتروني بنجاح!',
        variant: 'default',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تنفيذ الدفع';
      toast({
        title:
          language === 'es'
            ? 'Error en el pago'
            : language === 'fr'
              ? 'Échec du paiement'
              : 'تعذر إتمام الدفع',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">
            {language === 'es'
              ? 'Cargando detalles del pago seguro...'
              : language === 'fr'
                ? 'Chargement du paiement sécurisé...'
                : 'جاري تحميل بوابة السداد الآمن...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !paymentLink || !invoice) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4" dir={dir}>
        <Card className="max-w-md w-full border-rose-500/30 shadow-lg text-center p-6 space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">
            {language === 'es'
              ? 'Enlace no válido o expirado'
              : language === 'fr'
                ? 'Lien invalide ou expiré'
                : 'رابط سداد غير متاح أو منتهي الصلاحية'}
          </h2>
          <p className="text-xs text-muted-foreground">{error}</p>
          <div className="pt-2">
            <span className="text-[11px] text-muted-foreground font-mono">
              TRANS BODANON TMS • SECURE PAY V1
            </span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between p-4 sm:p-6" dir={dir}>
      {/* Top Navbar */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
            TB
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">TRANS BODANON</h1>
            <p className="text-[10px] text-muted-foreground font-mono">
              INTERNATIONAL ROAD TRANSPORT
            </p>
          </div>
        </div>

        {/* Trilingual Selector */}
        <div className="flex items-center gap-1 bg-card border rounded-lg p-0.5 text-xs font-mono">
          <button
            onClick={() => setLanguage('ar')}
            className={`px-2 py-1 rounded transition-colors ${
              language === 'ar' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'
            }`}
          >
            عربي
          </button>
          <button
            onClick={() => setLanguage('fr')}
            className={`px-2 py-1 rounded transition-colors ${
              language === 'fr' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'
            }`}
          >
            FR
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`px-2 py-1 rounded transition-colors ${
              language === 'es' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'
            }`}
          >
            ES
          </button>
        </div>
      </div>

      {/* Main Payment Container */}
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {!paymentSuccess ? (
          <Card className="border shadow-md bg-card overflow-hidden">
            <CardHeader className="bg-primary/5 border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                    {language === 'es'
                      ? 'Portal de Pago Seguro'
                      : language === 'fr'
                        ? 'Portail de Paiement Sécurisé'
                        : 'بوابة السداد الإلكتروني المعتمدة'}
                  </Badge>
                  <CardTitle className="text-xl font-bold font-amiri">
                    {invoice.invoiceNumber}
                  </CardTitle>
                </div>
                <div className="text-end">
                  <span className="text-xs text-muted-foreground block">
                    {language === 'es'
                      ? 'Total a pagar'
                      : language === 'fr'
                        ? 'Net à payer'
                        : 'المبلغ المستحق للدفع'}
                  </span>
                  <span className="text-2xl font-mono font-bold text-primary">
                    {paymentLink.amount} {paymentLink.currency}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Parties & DGI Exemption Notice */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    {language === 'es' ? 'Transportista Emisor' : language === 'fr' ? 'Transporteur Émetteur' : 'الناقل المفوتر'}
                  </span>
                  <p className="font-bold text-foreground">TRANS BODANON SARL</p>
                  <p className="font-mono text-muted-foreground">ICE: {invoice.sellerIce}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    {language === 'es' ? 'Cliente Comprador' : language === 'fr' ? 'Client Donneur d\'ordre' : 'العميل المستفيد'}
                  </span>
                  <p className="font-bold text-foreground">{paymentLink.clientName || 'CLIENT'}</p>
                  <p className="font-mono text-muted-foreground">ICE: {invoice.buyerIce}</p>
                </div>
              </div>

              {/* Fiscal Exemption Alert */}
              <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'es'
                    ? 'Exención total del IVA según Art. 92-I-10° del CGI (Transporte Internacional de Mercancías).'
                    : language === 'fr'
                      ? 'Exonération totale de la TVA en vertu de l\'Art. 92-I-10° du CGI (Transport International).'
                      : 'إعفاء كلي من الضريبة على القيمة المضافة طبقاً للمادة 92-I-10° من المدونة العامة للضرائب (النقل الدولي).'}
                </span>
              </div>

              {/* Gateway Selection Tabs */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground">
                  {language === 'es'
                    ? 'Seleccione el método de pago'
                    : language === 'fr'
                      ? 'Sélectionnez le mode de paiement'
                      : 'اختر وسيلة الدفع المناسبة'}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* CMI */}
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('cmi')}
                    className={`p-4 rounded-xl border text-start transition-all flex flex-col justify-between gap-2 ${
                      selectedGateway === 'cmi'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-xs'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <CreditCard className="w-5 h-5 text-primary" />
                        <Badge variant="secondary" className="text-[10px]">
                          MAD
                        </Badge>
                      </div>
                      <span className="font-bold text-sm block">CMI Maroc</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {language === 'es'
                          ? 'Tarjetas bancarias marroquíes'
                          : language === 'fr'
                            ? 'Cartes bancaires marocaines'
                            : 'بطاقات البنوك المغربية'}
                      </p>
                    </div>
                  </button>

                  {/* Stripe */}
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('stripe')}
                    className={`p-4 rounded-xl border text-start transition-all flex flex-col justify-between gap-2 ${
                      selectedGateway === 'stripe'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-xs'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Lock className="w-5 h-5 text-indigo-600" />
                        <Badge variant="secondary" className="text-[10px]">
                          EUR / USD
                        </Badge>
                      </div>
                      <span className="font-bold text-sm block">Stripe Global</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {language === 'es'
                          ? 'Visa, Mastercard, SEPA'
                          : language === 'fr'
                            ? 'Visa, Mastercard, SEPA'
                            : 'بطاقات دولية وتحويلات SEPA'}
                      </p>
                    </div>
                  </button>

                  {/* Bank Transfer */}
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('bank_transfer')}
                    className={`p-4 rounded-xl border text-start transition-all flex flex-col justify-between gap-2 ${
                      selectedGateway === 'bank_transfer'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-xs'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Landmark className="w-5 h-5 text-emerald-600" />
                        <Badge variant="secondary" className="text-[10px]">
                          0% Fee
                        </Badge>
                      </div>
                      <span className="font-bold text-sm block">
                        {language === 'es'
                          ? 'Transferencia'
                          : language === 'fr'
                            ? 'Virement RIB'
                            : 'تحويل بنكي مباشر'}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {language === 'es'
                          ? 'Banque Populaire (RIB)'
                          : language === 'fr'
                            ? 'Banque Populaire (RIB)'
                            : 'البنك الشعبي المركزي'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bank Details display if bank transfer selected */}
              {selectedGateway === 'bank_transfer' && (
                <div className="p-4 rounded-xl bg-card border font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Banque:</span>
                    <span className="font-bold text-foreground">BANQUE CENTRALE POPULAIRE (BCP)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RIB (24 digits):</span>
                    <span className="font-bold text-foreground">190 780 21111 88992200 45</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IBAN:</span>
                    <span className="font-bold text-foreground">MA64 1907 8021 1118 8992 2004 5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Swift / BIC:</span>
                    <span className="font-bold text-foreground">BCPOMAMC</span>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="bg-muted/20 border-t p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'es'
                    ? 'Transacción cifrada y protegida por TLS 1.3 & SHA-512'
                    : language === 'fr'
                      ? 'Transaction chiffrée et protégée par TLS 1.3 & SHA-512'
                      : 'معاملة مشفرة ومؤمنة بأعلى معايير التشفير TLS 1.3 & SHA-512'}
                </span>
              </div>

              <Button
                size="lg"
                onClick={handlePayNow}
                disabled={processing}
                className="w-full sm:w-auto px-8 font-bold text-base"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin ms-2" />
                ) : (
                  <CreditCard className="w-5 h-5 ms-2" />
                )}
                <span>
                  {language === 'es'
                    ? `Pagar ahora (${paymentLink.amount} ${paymentLink.currency})`
                    : language === 'fr'
                      ? `Régler maintenant (${paymentLink.amount} ${paymentLink.currency})`
                      : `تأكيد السداد الآن (${paymentLink.amount} ${paymentLink.currency})`}
                </span>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          /* Payment Success Confirmation Voucher */
          <Card className="border-emerald-500/30 shadow-xl bg-card overflow-hidden text-center p-8 space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-amiri text-foreground">
                {language === 'es'
                  ? '¡Pago Verificado y Liquidado con Éxito!'
                  : language === 'fr'
                    ? 'Paiement Vérifié et Enregistré avec Succès !'
                    : 'تم تأكيد واعتماد السداد بنجاح!'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {language === 'es'
                  ? 'Su transacción ha sido conciliada y la factura se encuentra totalmente liquidada.'
                  : language === 'fr'
                    ? 'Votre transaction a été rapprochée et la facture est entièrement soldée.'
                    : 'تمت مطابقة السداد وتسوية الفاتورة في النظام المحاسبي للشركة برصيد 0.00.'}
              </p>
            </div>

            {/* Voucher Details */}
            <div className="max-w-md mx-auto p-4 rounded-xl bg-muted/40 border font-mono text-xs text-start space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === 'es' ? 'Nº de Factura:' : language === 'fr' ? 'Nº Facture :' : 'رقم الفاتورة:'}
                </span>
                <span className="font-bold text-foreground">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === 'es' ? 'Importe Pagado:' : language === 'fr' ? 'Montant Réglé :' : 'المبلغ المسدد:'}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {paymentLink.amount} {paymentLink.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === 'es' ? 'Referencia Bancaria:' : language === 'fr' ? 'Réf. Transaction :' : 'المرجع البنكي:'}
                </span>
                <span className="font-bold text-foreground">{transactionRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === 'es' ? 'Fecha y Hora:' : language === 'fr' ? 'Date & Heure :' : 'تاريخ وتوقيت العملية:'}
                </span>
                <span>{new Date().toISOString().replace('T', ' ').slice(0, 19)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {language === 'es' ? 'Imprimir recibo' : language === 'fr' ? 'Imprimer le reçu' : 'طباعة الإيصال'}
                </span>
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-3xl w-full mx-auto text-center pt-8 text-[11px] text-muted-foreground font-mono">
        © 2026 TRANS BODANON TMS • ALL RIGHTS RESERVED • DGI & CMI COMPLIANT
      </div>
    </div>
  );
}

