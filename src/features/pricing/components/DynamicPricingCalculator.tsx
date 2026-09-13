'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  ArrowRightLeft,
  Fuel,
  Ship,
  TrendingUp,
  Sparkles,
  Check,
  Copy,
  DollarSign,
  ShieldAlert,
  ThermometerSnowflake,
  Boxes,
  Truck,
  Flame,
  Clock,
  Coins,
  MapPin,
} from 'lucide-react';
import {
  calculateDynamicFreightPrice,
  CORRIDOR_PRESETS,
} from '../services/dynamic-pricing.actions';
import type {
  CargoType,
  DynamicPricingParams,
  DynamicPricingQuote,
  PricingTier,
} from '../types';

export function DynamicPricingCalculator() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [originCity, setOriginCity] = useState('Agadir');
  const [destCity, setDestCity] = useState('Perpignan');
  const [cargoType, setCargoType] = useState<CargoType>('reefer_temperature_controlled');
  const [targetMargin, setTargetMargin] = useState(22);
  const [reeferTemp, setReeferTemp] = useState(4);
  const [weightTons, setWeightTons] = useState(22);
  const [includeReturnCushion, setIncludeReturnCushion] = useState(true);
  const [currency, setCurrency] = useState<'MAD' | 'EUR'>('MAD');
  const [copied, setCopied] = useState(false);

  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<DynamicPricingQuote | null>(null);

  const computePricing = useCallback(async () => {
    setLoading(true);
    try {
      const currentMonth = new Date().getMonth() + 1;
      const params: DynamicPricingParams = {
        originCity,
        destinationCity: destCity,
        cargoType,
        targetMarginPercent: targetMargin,
        departureMonth: currentMonth,
        reeferSetpointTemp: cargoType === 'reefer_temperature_controlled' ? reeferTemp : undefined,
        weightTons,
        includeReturnCushion,
      };

      const res = await calculateDynamicFreightPrice(params);
      if (res.success && res.data) {
        setQuote(res.data);
      } else {
        toast({
          title: t('خطأ في الاحتساب', 'Erreur de calcul'),
          description: res.error || t('تعذر توليد التسعير التنبؤي', 'Impossible de générer la cotation'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue'),
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [originCity, destCity, cargoType, targetMargin, reeferTemp, weightTons, includeReturnCushion, t, toast]);

  useEffect(() => {
    computePricing();
  }, [computePricing]);

  const handleSelectPreset = (presetId: string) => {
    const preset = CORRIDOR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setOriginCity(preset.originCity);
    setDestCity(preset.destCity);
    setCargoType(preset.defaultCargo);
  };

  const handleSwapCities = () => {
    setOriginCity(destCity);
    setDestCity(originCity);
  };

  const handleCopyQuote = () => {
    if (!quote) return;
    const isMad = currency === 'MAD';
    const text = `
=== Trans Bodanon TMS — Cotation Fret International ===
Trajet: ${quote.originCity} ⟵⟶ ${quote.destinationCity} (${quote.totalDistanceKm} km)
Marchandise: ${quote.cargoType}
------------------------------------------------------
Tarif Plancher (Coût Direct): ${isMad ? quote.tiers.floor.priceMad + ' MAD' : quote.tiers.floor.priceEur + ' EUR'}
Tarif Spot Recommandé: ${isMad ? quote.tiers.spot.priceMad + ' MAD' : quote.tiers.spot.priceEur + ' EUR'} (Marge: ${quote.tiers.spot.marginPercent}%)
Tarif Express Premium: ${isMad ? quote.tiers.expressPremium.priceMad + ' MAD' : quote.tiers.expressPremium.priceEur + ' EUR'}
------------------------------------------------------
Économie Bunkering Maroc: ${isMad ? quote.smartBunkeringSavingsMad + ' MAD' : quote.smartBunkeringSavingsEur + ' EUR'}
ID Cotation: ${quote.id}
`.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: t('تم نسخ بيانات العرض', 'Cotation copiée'),
      description: t('تم نسخ تفاصيل التسعيرة للحافظة بنجاح', 'Les détails du devis ont été copiés dans le presse-papiers'),
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const formatPrice = (tier: PricingTier) => {
    return currency === 'MAD' ? `${tier.priceMad} MAD` : `${tier.priceEur} €`;
  };

  const formatProfit = (tier: PricingTier) => {
    return currency === 'MAD' ? `+${tier.profitAmountMad} MAD` : `+${tier.profitAmountEur} €`;
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header with Currency Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            {t('محرك التسعير الديناميكي الذكي للشحن الدولي', 'Moteur de Tarification Dynamique du Fret')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t(
              'تسعير ذكي فوري للمسارات الدولية (TIR) بناءً على تكاليف الوقود الثنائية، العبّارات، ورسوم الطرق ومواسم التصدير',
              'Cotations temps réel basées sur les coûts carburant binationaux, ferries, péages et saisonnalité maraîchère'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-xl border border-border">
          <button
            onClick={() => setCurrency('MAD')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              currency === 'MAD'
                ? 'bg-background shadow-xs text-foreground font-mono font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🇲🇦 MAD
          </button>
          <button
            onClick={() => setCurrency('EUR')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              currency === 'EUR'
                ? 'bg-background shadow-xs text-foreground font-mono font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🇪🇺 EUR (€)
          </button>
        </div>
      </div>

      {/* Corridor Presets Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          {t('المسارات السريعة:', 'Corridors rapides :')}
        </span>
        {CORRIDOR_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => handleSelectPreset(preset.id)}
            className="text-xs rounded-xl h-8 shrink-0 hover:border-primary transition-colors"
          >
            {dir === 'rtl' ? preset.nameAr : preset.nameFr}
          </Button>
        ))}
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Interactive Parameters Form */}
        <Card className="lg:col-span-5 shadow-xs border-border">
          <CardHeader className="pb-4 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              {t('محددات وبيانات الرحلة', 'Paramètres de la Cotation')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('تخصيص المسار، نوع الشاحنة والمقطورة وهامش الربح المطلوب', 'Ajustez l\'itinéraire, type de remorque et marge cible')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-sm">
            {/* Origin & Destination with Swap */}
            <div className="grid grid-cols-11 items-center gap-2">
              <div className="col-span-5 space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium block">{t('مدينة الانطلاق', 'Origine')}</label>
                <Input
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  placeholder="Casablanca, Agadir, Tanger..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="col-span-1 flex justify-center pt-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleSwapCities}
                  className="h-8 w-8 rounded-full hover:bg-muted"
                  title={t('تبديل المسار', 'Inverser')}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>

              <div className="col-span-5 space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium block">{t('وجهة الوصول', 'Destination')}</label>
                <Input
                  value={destCity}
                  onChange={(e) => setDestCity(e.target.value)}
                  placeholder="Paris, Perpignan, Madrid..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Cargo Type Selection */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium block">{t('نوع الحمولة والتجهيز', 'Type de fret & Remorque')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCargoType('reefer_temperature_controlled')}
                  className={`p-2.5 rounded-xl border text-start transition-all flex items-center gap-2 text-xs font-medium ${
                    cargoType === 'reefer_temperature_controlled'
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 font-semibold'
                      : 'border-border hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <ThermometerSnowflake className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <div>
                    <div>{t('شحن مبرد (Frigo)', 'Frigo Sous Température')}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{t('خضار وفواكه / أدوية', 'Fruits, primeurs & pharma')}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCargoType('dry_box')}
                  className={`p-2.5 rounded-xl border text-start transition-all flex items-center gap-2 text-xs font-medium ${
                    cargoType === 'dry_box'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <Boxes className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <div>{t('صندوق جاف (Fourgon)', 'Caisse Sèche / Fourgon')}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{t('بضائع عامة وصناعية', 'Fret général & industriel')}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCargoType('mega_curtain')}
                  className={`p-2.5 rounded-xl border text-start transition-all flex items-center gap-2 text-xs font-medium ${
                    cargoType === 'mega_curtain'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 font-semibold'
                      : 'border-border hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <div>{t('ستائري ميغا (Tautliner)', 'Tautliner / Méga')}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{t('قطع سيارات ومنسوجات', 'Automobile & volumineux')}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCargoType('hazardous_adr')}
                  className={`p-2.5 rounded-xl border text-start transition-all flex items-center gap-2 text-xs font-medium ${
                    cargoType === 'hazardous_adr'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold'
                      : 'border-border hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <div>{t('مواد مصنفة خطرة (ADR)', 'Matières Dangereuses ADR')}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{t('كيماويات ومواد بترولية', 'Produits chimiques & gaz')}</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Reefer Temperature if active */}
            {cargoType === 'reefer_temperature_controlled' && (
              <div className="p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/20 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-cyan-900 dark:text-cyan-200 flex items-center gap-1.5">
                    <ThermometerSnowflake className="w-3.5 h-3.5 text-cyan-600" />
                    {t('درجة حرارة الشحنة المطلوبة:', 'Consigne de température :')}
                  </span>
                  <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">{reeferTemp}°C</span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={20}
                  step={1}
                  value={reeferTemp}
                  onChange={(e) => setReeferTemp(Number(e.target.value))}
                  className="w-full accent-cyan-600 h-2 bg-muted rounded-lg cursor-pointer py-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>-25°C ({t('تجميد عميق', 'Surgelé')})</span>
                  <span>0°C</span>
                  <span>+4°C ({t('خضار وفواكه', 'Primeurs')})</span>
                  <span>+20°C ({t('أدوية', 'Pharma')})</span>
                </div>
              </div>
            )}

            {/* Target Margin Slider */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  {t('هامش الربح المستهدف (Marge Cible):', 'Marge bénéficiaire cible :')}
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                  {targetMargin}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={40}
                step={1}
                value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer py-1"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10% ({t('تنافسي شرس', 'Agressif')})</span>
                <span>22% ({t('النموذج القياسي', 'Standard')})</span>
                <span>40% ({t('أرباح قصوى', 'Haute Marge')})</span>
              </div>
            </div>

            {/* Additional Options */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium block">{t('الوزن القائم (طن)', 'Poids Brut (Tonnes)')}</label>
                <Input
                  type="number"
                  min={5}
                  max={28}
                  value={weightTons}
                  onChange={(e) => setWeightTons(Number(e.target.value))}
                  className="h-8 text-xs rounded-xl"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeReturnCushion}
                    onChange={(e) => setIncludeReturnCushion(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>{t('تأمين حمولة العودة', 'Coussin retour à vide')}</span>
                </label>
              </div>
            </div>

            <Button
              type="button"
              onClick={computePricing}
              disabled={loading}
              className="w-full h-9 rounded-xl text-xs font-bold gap-2 mt-2"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? t('جاري الاحتساب التنبؤي...', 'Calcul en cours...') : t('تحديث الاحتساب الفوري', 'Recalculer les Cotations')}
            </Button>
          </CardContent>
        </Card>

        {/* Right Col: 3-Tier Quotation Results & Smart Insights */}
        <div className="lg:col-span-7 space-y-4">
          {/* Seasonality & Smart Bunkering Alert Banners */}
          {quote && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Seasonality Card */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>{t('مؤشر الموسمية:', 'Indice de Saisonnalité :')}</span>
                    <span className="font-mono">
                      {quote.seasonalityImpactPercent >= 0 ? `+${quote.seasonalityImpactPercent}%` : `${quote.seasonalityImpactPercent}%`}
                    </span>
                  </div>
                  <div className="text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                    {dir === 'rtl' ? quote.seasonalityReasonAr : quote.seasonalityReasonFr}
                  </div>
                </div>
              </div>

              {/* Smart Bunkering Card */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-xs">
                <Fuel className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>{t('وفر استراتيجي في التزود:', 'Optimisation Bunkering :')}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {currency === 'MAD' ? `+${quote.smartBunkeringSavingsMad} MAD` : `+${quote.smartBunkeringSavingsEur} €`}
                    </span>
                  </div>
                  <div className="text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 leading-relaxed">
                    {dir === 'rtl' ? quote.bunkeringAdviceAr : quote.bunkeringAdviceFr}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3 Pricing Tiers Cards */}
          {quote ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Tier 1: Floor / Breakeven */}
              <Card className="border-border/70 relative hover:border-border transition-all flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {dir === 'rtl' ? quote.tiers.floor.nameAr : quote.tiers.floor.nameFr}
                  </div>
                  <div className="text-xl font-mono font-bold text-foreground mt-1">
                    {formatPrice(quote.tiers.floor)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-xs">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {dir === 'rtl' ? quote.tiers.floor.descriptionAr : quote.tiers.floor.descriptionFr}
                  </p>
                  <div className="pt-2 border-t border-border/40 flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">{t('هامش الصافي:', 'Marge nette :')}</span>
                    <span className="font-mono font-bold text-slate-500">0% ({t('تكلفة مباشرة', 'Coût sec')})</span>
                  </div>
                </CardContent>
              </Card>

              {/* Tier 2: Recommended Spot Rate (Highlighted) */}
              <Card className="border-2 border-emerald-500 shadow-md bg-emerald-500/[0.03] relative flex flex-col justify-between">
                <div className="absolute -top-2.5 start-4 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <Check className="w-3 h-3" />
                  {t('العرض الموصى به', 'Recommandé')}
                </div>
                <CardHeader className="pb-2 pt-4">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                    {dir === 'rtl' ? quote.tiers.spot.nameAr : quote.tiers.spot.nameFr}
                  </div>
                  <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatPrice(quote.tiers.spot)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-xs">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {dir === 'rtl' ? quote.tiers.spot.descriptionAr : quote.tiers.spot.descriptionFr}
                  </p>
                  <div className="pt-2 border-t border-emerald-500/20 flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">{t('الأرباح المتوقعة:', 'Bénéfice prévu :')}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatProfit(quote.tiers.spot)} ({quote.tiers.spot.marginPercent}%)
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Tier 3: Express / Premium */}
              <Card className="border-border/70 relative hover:border-indigo-500 transition-all flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dir === 'rtl' ? quote.tiers.expressPremium.nameAr : quote.tiers.expressPremium.nameFr}
                  </div>
                  <div className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatPrice(quote.tiers.expressPremium)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-xs">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {dir === 'rtl' ? quote.tiers.expressPremium.descriptionAr : quote.tiers.expressPremium.descriptionFr}
                  </p>
                  <div className="pt-2 border-t border-border/40 flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">{t('الأرباح المتوقعة:', 'Bénéfice prévu :')}</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatProfit(quote.tiers.expressPremium)} ({quote.tiers.expressPremium.marginPercent}%)
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center border border-dashed rounded-2xl text-muted-foreground text-sm">
              {t('جاري تحميل عروض الأسعار...', 'Chargement des cotations...')}
            </div>
          )}

          {/* Cost Breakdown Details */}
          {quote && (
            <Card className="shadow-xs border-border">
              <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    {t('التفصيل المحاسبي والتشغيلي للتكاليف المباشرة', 'Décomposition Comptable des Coûts')}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t('المسافة الإجمالية:', 'Distance totale :')} {quote.totalDistanceKm} km ({quote.moroccoKm} km {t('المغرب', 'Maroc')} • {quote.europeKm} km {t('أوروبا', 'Europe')})
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyQuote}
                  className="text-xs h-8 rounded-xl gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {t('نسخ العرض', 'Copier')}
                </Button>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-muted/40 rounded-xl space-y-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Fuel className="w-3 h-3 text-amber-500" />
                      {t('إجمالي الوقود:', 'Carburant Total :')}
                    </span>
                    <div className="font-mono font-bold text-foreground">
                      {currency === 'MAD' ? `${quote.breakdown.fuelTotalMad} MAD` : `${quote.breakdown.fuelTotalEur} €`}
                    </div>
                  </div>

                  <div className="p-2.5 bg-muted/40 rounded-xl space-y-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Ship className="w-3 h-3 text-blue-500" />
                      {t('عبّارة المضيق:', 'Ferry Maritime :')}
                    </span>
                    <div className="font-mono font-bold text-foreground">
                      {currency === 'MAD' ? `${quote.breakdown.ferryCrossingCostMad} MAD` : `${quote.breakdown.ferryCrossingCostEur} €`}
                    </div>
                  </div>

                  <div className="p-2.5 bg-muted/40 rounded-xl space-y-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-500" />
                      {t('رسوم الطرق (Péage):', 'Péages :')}
                    </span>
                    <div className="font-mono font-bold text-foreground">
                      {currency === 'MAD' ? `${quote.breakdown.tollsTotalMad} MAD` : `${quote.breakdown.tollsTotalEur} €`}
                    </div>
                  </div>

                  <div className="p-2.5 bg-muted/40 rounded-xl space-y-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary" />
                      {t('تعويضات السائق:', 'Indemnités :')}
                    </span>
                    <div className="font-mono font-bold text-foreground">
                      {currency === 'MAD' ? `${quote.breakdown.driverAllowancesMad} MAD` : `${quote.breakdown.driverAllowancesEur} €`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {Number(quote.breakdown.reeferRunningCostMad) > 0 && (
                      <span>
                        {t('ديزل التبريد:', 'Gasoil Frigo :')}{' '}
                        <strong className="text-foreground font-mono">{quote.breakdown.reeferRunningCostMad} MAD</strong>
                      </span>
                    )}
                    <span>
                      {t('الجمارك والميناء:', 'Douane & Port :')}{' '}
                      <strong className="text-foreground font-mono">{quote.breakdown.customsPortFeesMad} MAD</strong>
                    </span>
                    <span>
                      {t('احتياطي الطوارئ والعودة:', 'Buffer & Retour :')}{' '}
                      <strong className="text-foreground font-mono">{quote.breakdown.deadheadCushionMad} MAD</strong>
                    </span>
                  </div>
                  <div className="font-bold text-foreground">
                    {t('إجمالي التكلفة المباشرة:', 'Total Coût Direct :')}{' '}
                    <span className="font-mono text-primary font-bold">
                      {currency === 'MAD' ? `${quote.breakdown.totalDirectCostMad} MAD` : `${quote.breakdown.totalDirectCostEur} €`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

