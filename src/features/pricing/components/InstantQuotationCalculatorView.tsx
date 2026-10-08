'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  createFreightQuotationAction,
  listFreightQuotationsAction,
  convertQuotationToTripAction,
  sendQuotationViaWhatsAppAction,
} from '../services/freight-quotation.actions';
import { CORRIDOR_PRESETS } from '../types';
import type {
  FreightQuotation,
  PricingCurrency,
  PricingTierKey,
} from '../types/freight-quotation.types';
import type { CargoType } from '../types';
import {
  Calculator,
  FileText,
  Truck,
  Sparkles,
  Send,
  CheckCircle2,
  Snowflake,
  ShieldCheck,
  RefreshCw,
  Loader2,
  DollarSign,
  Coins,
  ArrowRight,
  TrendingUp,
  Building2,
  ExternalLink,
} from 'lucide-react';

export function InstantQuotationCalculatorView() {
  const { t, locale, dir } = useLanguage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'calculator' | 'registry'>('calculator');
  const [loading, setLoading] = useState(false);
  const [quotationsList, setQuotationsList] = useState<FreightQuotation[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [activeQuoteForWa, setActiveQuoteForWa] = useState<FreightQuotation | null>(null);
  const [sendingWa, setSendingWa] = useState(false);

  // Form State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('agadir_perpignan');
  const [clientName, setClientName] = useState('Atlas Primeurs Export SARL');
  const [clientPhone, setClientPhone] = useState('+212661987654');
  const [clientEmail, setClientEmail] = useState('contact@atlasprimeurs.ma');
  const [originCity, setOriginCity] = useState('Agadir');
  const [destinationCity, setDestinationCity] = useState('Perpignan');
  const [cargoType, setCargoType] = useState<CargoType>('reefer_temperature_controlled');
  const [distanceKm, setDistanceKm] = useState(2450);
  const [weightTons, setWeightTons] = useState(22);
  const [currency, setCurrency] = useState<PricingCurrency>('EUR');
  const [targetMargin, setTargetMargin] = useState(22);
  const [selectedTier, setSelectedTier] = useState<PricingTierKey>('spot');

  // Active Generated Quote Preview
  const [currentQuotation, setCurrentQuotation] = useState<FreightQuotation | null>(null);

  const fetchQuotations = useCallback(async () => {
    try {
      const res = await listFreightQuotationsAction();
      if (res.success && res.data) {
        setQuotationsList(res.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // Handle Preset change
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = CORRIDOR_PRESETS.find((item) => item.id === presetId);
    if (p) {
      setOriginCity(p.originCity);
      setDestinationCity(p.destCity);
      setDistanceKm(p.distanceKm);
      setCargoType(p.defaultCargo);
    }
  };

  // Generate Quotation
  const handleGenerateQuotation = async () => {
    setLoading(true);
    try {
      const res = await createFreightQuotationAction({
        clientName,
        clientPhone,
        clientEmail,
        originCity,
        destinationCity,
        cargoType,
        roadDistanceKm: Number(distanceKm),
        weightTons: Number(weightTons),
        currency,
        targetMarginPercent: Number(targetMargin),
        selectedTier,
      });

      if (res.success && res.data) {
        setCurrentQuotation(res.data);
        toast({
          title: t('تم إنشاء وتثبيت عرض السعر بنجاح', 'Devis formel généré avec succès', 'Cotización formal generada con éxito'),
          description: `${res.data.quotationNumber}: ${res.data.finalPrice} ${res.data.currency}`,
        });
        fetchQuotations();
      } else {
        toast({
          title: t('فشل إنشاء عرض السعر', 'Échec de génération', 'Fallo al generar'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Convert to Operational Trip Order (CMR)
  const handleConvertToTrip = async (quoteId: string) => {
    setConvertingId(quoteId);
    try {
      const res = await convertQuotationToTripAction(quoteId);
      if (res.success && res.data) {
        toast({
          title: t('تم تحويل العرض إلى أمر شحن رسمي', 'Devis converti en ordre de transport', 'Cotización convertida en viaje'),
          description: res.data.message,
        });
        fetchQuotations();
        if (currentQuotation?.id === quoteId) {
          setCurrentQuotation({
            ...currentQuotation,
            status: 'ACCEPTED',
            convertedToTripId: res.data.tripId,
            cmrNumber: res.data.cmrNumber,
          });
        }
      } else {
        toast({
          title: t('فشل تحويل عرض السعر', 'Échec de conversion', 'Fallo al convertir'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setConvertingId(null);
    }
  };

  // Send WhatsApp
  const handleSendWhatsApp = async () => {
    if (!activeQuoteForWa || !whatsappPhone) return;
    setSendingWa(true);
    try {
      const res = await sendQuotationViaWhatsAppAction({
        quotationId: activeQuoteForWa.id,
        recipientPhone: whatsappPhone,
      });

      if (res.success) {
        toast({
          title: t('تم إرسال عرض السعر عبر WhatsApp', 'Devis envoyé via WhatsApp', 'Cotización enviada vía WhatsApp'),
          description: res.message,
        });
        setActiveQuoteForWa(null);
        fetchQuotations();
      } else {
        toast({
          title: t('فشل الإرسال', 'Échec d’envoi', 'Fallo al enviar'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {t(
                  'محرك تسعير المسارات الديناميكي وعروض الأسعار الفورية',
                  'Moteur de Tarification Dynamique & Devis Instantanés',
                  'Motor de Precios Dinámico y Cotizaciones Instantáneas'
                )}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                {t(
                  'احتساب تكاليف النقل بدقة Decimal.js الصارمة، تفكيك هوامش الربح، والتحويل الفوري إلى أوامر شحن (CMR)',
                  'Calculs stricts Decimal.js (CPK, gasoil, traversées, marges) et conversion directe en CMR',
                  'Cálculos estrictos Decimal.js (CPK, diésel, ferris, márgenes) y conversión directa a CMR'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'calculator'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('حاسبة التسعير الفوري', 'Calculateur de Devis', 'Calculadora')}</span>
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'registry'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('سجل العروض الصادرة', 'Registre des Devis', 'Registro')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 font-mono">
              {quotationsList.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'calculator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Inputs & Parameters (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  <span>{t('مدخلات وبيانات مسار الشحن', 'Paramètres de la Mission', 'Parámetros del Viaje')}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('اختر مساراً جاهزاً أو حدد الوجهة ونوع الشحنة', 'Sélectionnez un corridor ou personnalisez', 'Seleccione corredor o personalice')}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-3.5 text-xs">
                {/* Preset Selector */}
                <div>
                  <label className="font-semibold block mb-1">
                    {t('الممرات المعيارية الجاهزة:', 'Corridors Prédéfinis :', 'Corredores Predeterminados:')}
                  </label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full h-8 text-xs px-2.5 rounded-lg border border-border bg-background"
                  >
                    {CORRIDOR_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {locale === 'fr' ? p.nameFr : p.nameAr} ({p.distanceKm} km)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Client Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold block mb-1">
                      {t('اسم العميل / المصدر:', 'Nom du Client :', 'Nombre del Cliente:')}
                    </label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">
                      {t('هاتف العميل:', 'Téléphone :', 'Teléfono:')}
                    </label>
                    <Input
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="h-8 text-xs"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Origin & Destination */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold block mb-1">{t('مدينة الشحن:', 'Départ :', 'Origen:')}</label>
                    <Input
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">{t('مدينة الوصول:', 'Arrivée :', 'Destino:')}</label>
                    <Input
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Cargo Type & Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold block mb-1">{t('نوع الشحنة:', 'Type de Fret :', 'Tipo de Carga:')}</label>
                    <select
                      value={cargoType}
                      onChange={(e) => setCargoType(e.target.value as CargoType)}
                      className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-background"
                    >
                      <option value="reefer_temperature_controlled">❄️ {t('تبريد Frigo', 'Frigo', 'Frigo')}</option>
                      <option value="dry_box">📦 {t('بضائع عامة جافة', 'Fourgon Sec', 'Carga Seca')}</option>
                      <option value="mega_curtain">🚛 {t('ستارة Mega Tautliner', 'Tautliner', 'Lona')}</option>
                      <option value="hazardous_adr">⚠️ {t('مواد خطرة ADR', 'Dangereux ADR', 'Peligroso ADR')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">{t('الوزن (بالأطنان):', 'Poids (Tonnes) :', 'Peso (Toneladas):')}</label>
                    <Input
                      type="number"
                      value={weightTons}
                      onChange={(e) => setWeightTons(Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Distance and Currency */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold block mb-1">{t('المسافة الكلية (كم):', 'Distance (km) :', 'Distancia (km):')}</label>
                    <Input
                      type="number"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">{t('عملة التسعير:', 'Devise :', 'Moneda:')}</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as PricingCurrency)}
                      className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-background font-bold text-primary"
                    >
                      <option value="MAD">MAD (درهم مغربي)</option>
                      <option value="EUR">EUR (يورو أوروبي)</option>
                      <option value="MRU">MRU (أوقية موريتانية)</option>
                      <option value="XOF">XOF (فرنك سيفا غرب إفريقيا)</option>
                    </select>
                  </div>
                </div>

                {/* Target Margin Slider */}
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{t('هامش الربح المستهدف:', 'Marge Cible :', 'Margen Objetivo:')}</span>
                    <span className="font-mono font-bold text-primary">{targetMargin}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(Number(e.target.value))}
                    className="w-full cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>10% (Floor)</span>
                    <span>22% (Spot Standard)</span>
                    <span>40% (Premium)</span>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateQuotation}
                  disabled={loading}
                  className="w-full h-9 text-xs gap-2 font-bold shadow-xs mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  <span>{t('احتساب وتوليد عرض السعر الرسمي', 'Calculer & Générer le Devis', 'Calcular y Generar Cotización')}</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Live Quotation Result & Tiers (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {currentQuotation ? (
              <div className="space-y-4">
                {/* 1. Quotation Summary Header Card */}
                <Card className="border-border/80 shadow-md overflow-hidden bg-gradient-to-r from-card via-card to-primary/5">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-extrabold text-primary">
                          {currentQuotation.quotationNumber}
                        </span>
                        <Badge variant="outline" className="text-xs font-semibold">
                          {currentQuotation.corridorType === 'african_overland'
                            ? t('الممر الإفريقي', 'Corridor Africain', 'Corredor Africano')
                            : t('الممر الأوروبي', 'Corridor Européen', 'Corredor Europeo')}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        {currentQuotation.status === 'ACCEPTED' ? (
                          <Badge className="bg-emerald-600 text-white text-xs gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('معتمد / رحلة #' + currentQuotation.convertedToTripId, 'Accepté', 'Aceptado')}</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {t('جاهز للاعتماد', 'Prêt pour Validation', 'Listo para Validación')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {/* Route & Cargo badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {currentQuotation.originCity} ➔ {currentQuotation.destinationCity}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          ({currentQuotation.totalDistanceKm} km)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] py-0">
                          {currentQuotation.cargoType} ({currentQuotation.weightTons} T)
                        </Badge>
                        <span className="text-muted-foreground">
                          {t('العميل:', 'Client :')} <strong>{currentQuotation.clientName}</strong>
                        </span>
                      </div>
                    </div>

                    {/* 2. Three Strategic Pricing Tiers */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-foreground">
                        {t('خيارات التسعير التعاقدي (Tiers):', 'Niveaux de Tarification :', 'Niveles de Tarifa:')}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {(['floor', 'spot', 'expressPremium'] as PricingTierKey[]).map((tierKey) => {
                          const tier = currentQuotation.tiers[tierKey];
                          const isSelected = selectedTier === tierKey;

                          return (
                            <div
                              key={tierKey}
                              onClick={() => {
                                setSelectedTier(tierKey);
                                setCurrentQuotation({
                                  ...currentQuotation,
                                  selectedTier: tierKey,
                                  finalPrice: tier.netPrice,
                                  totalPriceWithVat: tier.totalPriceWithVat,
                                });
                              }}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                  : 'border-border/70 bg-card hover:border-primary/40'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-xs">
                                    {locale === 'fr' ? tier.nameFr : locale === 'es' ? tier.nameEs : tier.nameAr}
                                  </span>
                                  {tier.isRecommended && (
                                    <Badge className="text-[9px] px-1 py-0 bg-emerald-600 text-white font-mono">
                                      Spot
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                  {locale === 'fr' ? tier.descriptionFr : locale === 'es' ? tier.descriptionEs : tier.descriptionAr}
                                </p>
                              </div>

                              <div className="mt-3 pt-2 border-t border-border/40 flex items-baseline justify-between">
                                <span className="text-[10px] text-muted-foreground">+{tier.marginPercent}% Marge</span>
                                <span className="font-mono font-extrabold text-sm text-foreground">
                                  {tier.netPrice} <span className="text-xs font-normal">{currentQuotation.currency}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Cost Breakdown Bento */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-[11px]">
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10px]">{t('معدل CPK:', 'Taux CPK :')}</span>
                        <strong className="font-mono text-foreground">{currentQuotation.costBreakdown.baseCpkRateMad} MAD/km</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10px]">{t('وقود المسار:', 'Gasoil :')}</span>
                        <strong className="font-mono text-foreground">{currentQuotation.costBreakdown.fuelTotalCostMad} MAD</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10px]">{t('المعابر والعبارات:', 'Traversée :')}</span>
                        <strong className="font-mono text-foreground">{currentQuotation.costBreakdown.ferryAndTransitCostMad} MAD</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground block text-[10px]">{t('التكلفة المباشرة:', 'Coût Direct :')}</span>
                        <strong className="font-mono text-foreground">{currentQuotation.costBreakdown.totalDirectCostSelectedCurrency} {currentQuotation.currency}</strong>
                      </div>
                    </div>

                    {/* 4. VAT Exemption Legal Notice */}
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                          {t('إعفاء قانوني من الضريبة على القيمة المضافة (0% TVA):', 'Exonération de TVA (0%) :')}
                        </span>
                        <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/80 leading-relaxed">
                          {locale === 'fr'
                            ? currentQuotation.vatExemptionLegalNoticeFr
                            : locale === 'es'
                            ? currentQuotation.vatExemptionLegalNoticeEs
                            : currentQuotation.vatExemptionLegalNoticeAr}
                        </p>
                      </div>
                    </div>

                    {/* 5. Total Price & Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
                      <div>
                        <span className="text-xs text-muted-foreground block">
                          {t('المبلغ النهائي المستحق للفوترة:', 'Prix Total Facturé :')}
                        </span>
                        <span className="text-xl font-mono font-extrabold text-foreground">
                          {currentQuotation.finalPrice} <span className="text-sm font-semibold text-primary">{currentQuotation.currency}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {currentQuotation.status === 'ACCEPTED' ? (
                          <Badge className="h-8 px-3 text-xs bg-emerald-600 text-white font-bold gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t('تم إنشاء أمر الشحن (CMR ' + currentQuotation.cmrNumber + ')', 'Converti en CMR')}</span>
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            disabled={convertingId === currentQuotation.id}
                            onClick={() => handleConvertToTrip(currentQuotation.id)}
                            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                          >
                            {convertingId === currentQuotation.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Truck className="w-3.5 h-3.5" />
                            )}
                            <span>{t('تحويل إلى أمر شحن (CMR)', 'Convertir en CMR', 'Convertir a CMR')}</span>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveQuoteForWa(currentQuotation);
                            setWhatsappPhone(currentQuotation.clientPhone || '');
                          }}
                          className="h-8 text-xs gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{t('إرسال WhatsApp', 'WhatsApp', 'WhatsApp')}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-border/60 border-dashed">
                <CardContent className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                  <Calculator className="w-12 h-12 text-muted-foreground opacity-40" />
                  <h4 className="font-bold text-sm text-foreground">
                    {t('بانتظار تحديد معايير المسار والحساب', 'En attente de calcul de devis', 'Esperando cálculo de cotización')}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {t(
                      'قم باختيار الممر والمسافة ونوع الشحنة ثم اضغط على زر الحساب لتوليد تفكيك التكاليف وعرض السعر التعاقدي.',
                      'Sélectionnez les paramètres et cliquez sur calculer pour obtenir le devis formalisé.',
                      'Seleccione los parámetros y haga clic en calcular para obtener la cotización formal.'
                    )}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Registry Tab */
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>{t('سجل عروض الأسعار الصادرة', 'Registre des Devis Émis', 'Registro de Cotizaciones Emitidas')}</span>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={fetchQuotations} className="h-7 text-xs gap-1">
                <RefreshCw className="w-3 h-3" />
                <span>{t('تحديث', 'Actualiser', 'Actualizar')}</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{t('رقم العرض', 'N° Devis', 'Nº Cotización')}</th>
                    <th className="py-2.5 px-3 text-start">{t('العميل', 'Client', 'Cliente')}</th>
                    <th className="py-2.5 px-3 text-start">{t('المسار', 'Trajet', 'Ruta')}</th>
                    <th className="py-2.5 px-3 text-start">{t('الحمولة', 'Fret', 'Carga')}</th>
                    <th className="py-2.5 px-3 text-start">{t('السعر الصافي', 'Prix Net', 'Precio')}</th>
                    <th className="py-2.5 px-3 text-start">{t('الحالة', 'Statut', 'Estado')}</th>
                    <th className="py-2.5 px-3 text-end">{t('الإجراءات', 'Actions', 'Acciones')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {quotationsList.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-primary">{q.quotationNumber}</td>
                      <td className="py-2.5 px-3">{q.clientName}</td>
                      <td className="py-2.5 px-3">{q.originCity} ➔ {q.destinationCity}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{q.cargoType}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">{q.finalPrice} {q.currency}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={q.status === 'ACCEPTED' ? 'default' : 'outline'}
                          className={`text-[10px] ${q.status === 'ACCEPTED' ? 'bg-emerald-600' : ''}`}
                        >
                          {q.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {q.status !== 'ACCEPTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={convertingId === q.id}
                              onClick={() => handleConvertToTrip(q.id)}
                              className="h-6 text-[10px] px-2 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50"
                            >
                              {t('تحويل لـ CMR', 'Convertir')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setActiveQuoteForWa(q);
                              setWhatsappPhone(q.clientPhone || '');
                            }}
                            className="h-6 text-[10px] px-2"
                          >
                            <Send className="w-3 h-3 text-emerald-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Modal */}
      {activeQuoteForWa && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-border">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-500" />
                <span>{t('إرسال عرض السعر عبر WhatsApp', 'Envoyer Devis via WhatsApp', 'Enviar Cotización por WhatsApp')}</span>
              </h3>
              <button
                onClick={() => setActiveQuoteForWa(null)}
                className="text-muted-foreground hover:text-foreground text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1">
                <p><strong>{t('رقم العرض:', 'N° Devis :')}</strong> {activeQuoteForWa.quotationNumber}</p>
                <p><strong>{t('العميل:', 'Client :')}</strong> {activeQuoteForWa.clientName}</p>
                <p><strong>{t('المسار:', 'Trajet :')}</strong> {activeQuoteForWa.originCity} ➔ {activeQuoteForWa.destinationCity}</p>
                <p><strong>{t('المبلغ:', 'Montant :')}</strong> {activeQuoteForWa.finalPrice} {activeQuoteForWa.currency}</p>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  {t('رقم هاتف WhatsApp للعميل:', 'Numéro WhatsApp du Destinataire :', 'Número WhatsApp del Destinatario:')}
                </label>
                <Input
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+212661000000"
                  className="h-8 text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setActiveQuoteForWa(null)}>
                {t('إلغاء', 'Annuler', 'Cancelar')}
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                disabled={sendingWa || !whatsappPhone}
                onClick={handleSendWhatsApp}
              >
                {sendingWa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{t('إرسال فوري', 'Envoyer', 'Enviar')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
