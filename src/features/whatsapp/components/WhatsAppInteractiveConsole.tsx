'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Send,
  Zap,
  Phone,
  RefreshCw,
  Compass,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import {
  triggerTripDepartureInteractiveAction,
  triggerInvoicePaymentReminderInteractiveAction,
  simulateInboundMessageAction,
  sendInteractiveButtonsAction,
} from '../services/whatsapp.actions';
import type { WhatsAppMessageLog } from '@/types/database';

interface WhatsAppInteractiveConsoleProps {
  initialLogs?: WhatsAppMessageLog[];
  trips?: Array<{ id: number; route?: string; cmr_number?: string }>;
  invoices?: Array<{ id: number; invoice_number?: string; total_amount?: string; currency?: string }>;
}

export function WhatsAppInteractiveConsole({
  initialLogs = [],
  trips = [],
  invoices = [],
}: WhatsAppInteractiveConsoleProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [logs, setLogs] = useState<WhatsAppMessageLog[]>(initialLogs);
  const [selectedTripId, setSelectedTripId] = useState<number | ''>(trips[0]?.id || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | ''>(invoices[0]?.id || '');

  // Simulation State
  const [simPhone, setSimPhone] = useState('212694585307');
  const [simScenario, setSimScenario] = useState<'track' | 'invoice' | 'driver' | 'emergency'>('track');
  const [simText, setSimText] = useState('تتبع 501');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Custom Interactive message state
  const [customPhone, setCustomPhone] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [customBtn1, setCustomBtn1] = useState('📍 تتبع الشحنة');
  const [customBtn2, setCustomBtn2] = useState('💳 سداد الفاتورة');
  const [sendingCustom, setSendingCustom] = useState(false);

  // Loading states
  const [dispatchingTrip, setDispatchingTrip] = useState(false);
  const [dispatchingInv, setDispatchingInv] = useState(false);

  // Trigger Trip Departure Alert
  const handleTripDepartureDispatch = async () => {
    if (!selectedTripId) return;
    setDispatchingTrip(true);
    try {
      const res = await triggerTripDepartureInteractiveAction({ tripId: Number(selectedTripId) });
      if (res.success) {
        toast({
          title: t('تم إرسال إشعار الانطلاق التفاعلي', 'Notification de départ interactive envoyée'),
          description: t('تم إرسال بوليصة CMR ورابط التتبع المباشر إلى العميل والسائق', 'CMR et lien de suivi envoyés au client et chauffeur'),
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({
        title: t('خطأ في الإرسال', "Erreur d'envoi"),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDispatchingTrip(false);
    }
  };

  // Trigger Invoice Reminder with Payment Link
  const handleInvoiceReminderDispatch = async () => {
    if (!selectedInvoiceId) return;
    setDispatchingInv(true);
    try {
      const res = await triggerInvoicePaymentReminderInteractiveAction({ invoiceId: Number(selectedInvoiceId) });
      if (res.success) {
        toast({
          title: t('تم إرسال تذكير السداد التفاعلي', 'Rappel de paiement interactif envoyé'),
          description: t('تم توليد رابط الدفع الرقمي المشفر وإرفاقه بالأزرار التفاعلية', 'Lien de paiement chiffré généré et joint avec boutons interactifs'),
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({
        title: t('خطأ في إرسال التذكير', "Erreur d'envoi du rappel"),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDispatchingInv(false);
    }
  };

  // Run Bot Simulation
  const handleSimulate = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      let promptText = simText;
      let buttonId = undefined;
      let buttonTitle = undefined;
      let msgType: 'text' | 'interactive_button' = 'text';

      if (simScenario === 'track') {
        promptText = simText || 'تتبع 501';
      } else if (simScenario === 'invoice') {
        promptText = 'فاتورة مستحقة';
      } else if (simScenario === 'driver') {
        msgType = 'interactive_button';
        buttonId = 'btn_driver_trip_501';
        buttonTitle = '🚚 تفاصيل رحلتي';
      } else if (simScenario === 'emergency') {
        promptText = 'SOS عطل في الشاحنة';
      }

      const res = await simulateInboundMessageAction({
        fromPhone: simPhone,
        messageType: msgType,
        textBody: promptText,
        buttonId,
        buttonTitle,
      });

      if (res.success) {
        setSimResult(res.botResult);
        toast({
          title: t('اكتملت المحاكاة التفاعلية', 'Simulation interactive terminée'),
          description: t('رد المساعد الآلي على الرسالة بنجاح', 'Le bot a répondu avec succès au message'),
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({
        title: t('فشل المحاكاة', 'Échec de la simulation'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSimulating(false);
    }
  };

  // Send Custom Interactive Message
  const handleSendCustomInteractive = async () => {
    if (!customPhone || !customBody) return;
    setSendingCustom(true);
    try {
      const buttons = [];
      if (customBtn1.trim()) {
        buttons.push({ id: 'btn_custom_1', title: customBtn1.trim().substring(0, 20) });
      }
      if (customBtn2.trim()) {
        buttons.push({ id: 'btn_custom_2', title: customBtn2.trim().substring(0, 20) });
      }

      const res = await sendInteractiveButtonsAction({
        to: customPhone,
        body: customBody,
        buttons: buttons.length > 0 ? buttons : [{ id: 'btn_ack', title: 'تم الاستلام' }],
      });

      if (res.success) {
        toast({
          title: t('تم إرسال الرسالة التفاعلية بنجاح', 'Message interactif envoyé avec succès'),
        });
        setCustomBody('');
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({
        title: t('تعذر إرسال الرسالة التفاعلية', "Échec de l'envoi du message interactif"),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSendingCustom(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Header Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-amiri text-foreground flex items-center gap-2">
                {t('بوابة الرسائل التفاعلية الرسمية WhatsApp Cloud API', 'Passerelle Interactive Officielle WhatsApp Cloud API')}
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  <ShieldCheck className="w-3 h-3 ms-1" />
                  Meta Verified v20.0
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'أتمتة إرسال بوالص الشحن e-CMR، روابط التتبع المباشر، وروابط الدفع الفوري عبر أزرار تفاعلية سريعة',
                  "Automatisation de l'e-CMR, liens de suivi en direct et paiements instantanés avec boutons interactifs"
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Triggers & Right Simulation Lab */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Automated Operational Triggers */}
        <Card className="rounded-2xl shadow-xs">
          <CardHeader>
            <CardTitle className="font-amiri text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {t('إطلاق الأتمتة الميدانية اللحظية', 'Déclencheurs Opérationnels Instantanés')}
            </CardTitle>
            <CardDescription>
              {t('إرسال فوري مع أزرار تفاعلية مخصصة ومحمية ضد أخطاء التعديل', 'Envoi direct avec boutons interactifs sécurisés')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Action A: Trip Departure Dispatch */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  {t('إشعار انطلاق الشحنة + رابط التتبع المباشر', 'Départ expédition + Suivi en direct')}
                </span>
                <Badge variant="secondary" className="text-[11px]">
                  e-CMR & GPS
                </Badge>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(Number(e.target.value) || '')}
                  className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs"
                >
                  <option value="">{t('-- اختر رحلة دولية --', '-- Choisir un voyage --')}</option>
                  {trips.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      #{tr.id} - {tr.route || 'مسار دولي'} ({tr.cmr_number || 'CMR'})
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  onClick={handleTripDepartureDispatch}
                  disabled={!selectedTripId || dispatchingTrip}
                  className="h-9 px-4 rounded-lg font-medium text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <Send className={`w-3.5 h-3.5 ms-1.5 ${dispatchingTrip ? 'animate-spin' : ''}`} />
                  {dispatchingTrip ? t('جارٍ الإرسال...', 'Envoi...') : t('إرسال الإشعار', 'Envoyer')}
                </Button>
              </div>
            </div>

            {/* Action B: Invoice Payment Reminder Dispatch */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  {t('تذكير سداد فاتورة + رابط دفع إلكتروني CMI/Stripe', 'Rappel facture + Lien de paiement')}
                </span>
                <Badge variant="secondary" className="text-[11px]">
                  Decimal.js / 30j
                </Badge>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(Number(e.target.value) || '')}
                  className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs"
                >
                  <option value="">{t('-- اختر فاتورة مستحقة --', '-- Choisir une facture --')}</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number || `#${inv.id}`} - {inv.total_amount} {inv.currency || 'MAD'}
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  onClick={handleInvoiceReminderDispatch}
                  disabled={!selectedInvoiceId || dispatchingInv}
                  className="h-9 px-4 rounded-lg font-medium text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                >
                  <CreditCard className={`w-3.5 h-3.5 ms-1.5 ${dispatchingInv ? 'animate-spin' : ''}`} />
                  {dispatchingInv ? t('جارٍ الإرسال...', 'Envoi...') : t('إرسال الرابط', 'Envoyer lien')}
                </Button>
              </div>
            </div>

            {/* Action C: Custom Interactive Message Composer */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <span className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                {t('رسالة تفاعلية مخصصة مع أزرار ردود سريعة', 'Message interactif personnalisé avec boutons')}
              </span>

              <Input
                placeholder={t('رقم الهاتف الدولي (مثال: +2126...)', 'Téléphone (ex: +2126...)')}
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="h-9 text-xs"
                dir="ltr"
              />

              <textarea
                placeholder={t('نص الرسالة التفاعلية...', 'Corps du message...')}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t('زر 1 (أقصى 20 حرف)', 'Bouton 1')}
                  value={customBtn1}
                  onChange={(e) => setCustomBtn1(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t('زر 2 (أقصى 20 حرف)', 'Bouton 2')}
                  value={customBtn2}
                  onChange={(e) => setCustomBtn2(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleSendCustomInteractive}
                disabled={!customPhone || !customBody || sendingCustom}
                className="w-full h-8 text-xs font-semibold"
              >
                <Send className="w-3.5 h-3.5 ms-1.5" />
                {sendingCustom ? t('جارٍ الإرسال...', 'Envoi...') : t('إرسال للأزرار التفاعلية', 'Envoyer avec boutons')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Interactive Bot Sandbox & Simulator */}
        <Card className="rounded-2xl shadow-xs border-emerald-500/20 bg-emerald-500/[0.02]">
          <CardHeader>
            <CardTitle className="font-amiri text-lg flex items-center gap-2 text-foreground">
              <Bot className="w-5 h-5 text-emerald-600" />
              {t('مختبر محاكاة المساعد الآلي WhatsApp Bot QA Lab', 'Laboratoire de Simulation WhatsApp Bot QA')}
            </CardTitle>
            <CardDescription>
              {t('تجربة سيناريوهات الردود الذكية الفورية دون الحاجة لإرسال رسائل حقيقية للمتعاملين', 'Tester les scénarios de réponses automatiques')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('رقم هاتف المرسل (سائق / عميل / ضيف)', 'Téléphone expéditeur')}
              </label>
              <Input
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="212694585307"
                dir="ltr"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('اختر سيناريو التجربة اللوجستية', 'Scénario de test')}
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Button
                  size="sm"
                  type="button"
                  variant={simScenario === 'track' ? 'default' : 'outline'}
                  onClick={() => {
                    setSimScenario('track');
                    setSimText('تتبع 501');
                  }}
                  className="h-8 text-xs"
                >
                  <Compass className="w-3.5 h-3.5 ms-1" />
                  {t('استعلام تتبع شحنة', 'Suivi expédition')}
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={simScenario === 'invoice' ? 'default' : 'outline'}
                  onClick={() => {
                    setSimScenario('invoice');
                    setSimText('فاتورة');
                  }}
                  className="h-8 text-xs"
                >
                  <CreditCard className="w-3.5 h-3.5 ms-1" />
                  {t('استعلام وسداد فاتورة', 'Facture & Paiement')}
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={simScenario === 'driver' ? 'default' : 'outline'}
                  onClick={() => {
                    setSimScenario('driver');
                    setSimText('رحلتي اليوم');
                  }}
                  className="h-8 text-xs"
                >
                  <Truck className="w-3.5 h-3.5 ms-1" />
                  {t('مهمة السائق التفاعلية', 'Mission chauffeur')}
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={simScenario === 'emergency' ? 'default' : 'outline'}
                  onClick={() => {
                    setSimScenario('emergency');
                    setSimText('SOS عطل طارئ');
                  }}
                  className="h-8 text-xs text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                >
                  <AlertTriangle className="w-3.5 h-3.5 ms-1" />
                  {t('نداء طوارئ SOS', 'Alerte SOS')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('نص الرسالة الواردة المحاكاة', 'Message simulant')}
              </label>
              <Input
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <Button
              onClick={handleSimulate}
              disabled={simulating}
              className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl"
            >
              <Play className={`w-3.5 h-3.5 ms-1.5 ${simulating ? 'animate-spin' : ''}`} />
              {simulating ? t('جارٍ تشغيل المحاكاة...', 'Simulation en cours...') : t('تنفيذ المحاكاة التفاعلية', 'Exécuter la simulation')}
            </Button>

            {/* Simulation Response Output Card */}
            {simResult && (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('نتيجة معالجة المساعد الآلي', 'Résultat du bot')}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Intent: {simResult.intent}
                  </Badge>
                </div>
                {simResult.replyMessage ? (
                  <pre className="p-2.5 rounded-lg bg-card border border-border text-[11px] whitespace-pre-wrap font-sans text-foreground">
                    {simResult.replyMessage}
                  </pre>
                ) : (
                  <p className="text-muted-foreground italic">
                    {t('تم إرسال الرد التفاعلي بنجاح إلى طرف العميل.', 'Réponse interactive envoyée avec succès.')}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

