'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import Decimal from 'decimal.js';
import {
  TrendingUp,
  DollarSign,
  Fuel,
  Ship,
  ShieldCheck,
  AlertTriangle,
  Send,
  CheckCircle2,
  Activity,
  Layers,
  FileText,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { pushDeclarationToCustomsGateway } from '@/features/customs/services/portnet-badr-push.actions';
import { useToast } from '@/hooks/use-toast';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ExecutiveControlTowerProps {
  metrics?: {
    totalRevenueMAD: number;
    totalRevenueEUR: number;
    totalExpensesMAD: number;
    cashBalanceMAD: number;
    bankBalanceMAD: number;
    eurBalance: number;
    fleetUptimePercent: number;
    averageCpkMad: number;
    totalFleetDistanceKm: number;
    expiredDocumentsCount: number;
    criticalDocumentsCount: number;
    averageSafetyScore: number;
    safeDriversCount: number;
  };
}

export function ExecutiveControlTower({ metrics: propMetrics }: ExecutiveControlTowerProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [isPushingCustoms, setIsPushingCustoms] = useState(false);
  const [customsStatus, setCustomsStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Baseline metrics defaults with Decimal.js precision
  const metrics = propMetrics || {
    totalRevenueMAD: 485000,
    totalRevenueEUR: 32000,
    totalExpensesMAD: 312500,
    cashBalanceMAD: 85400,
    bankBalanceMAD: 342000,
    eurBalance: 28500,
    fleetUptimePercent: 91.5,
    averageCpkMad: 3.42,
    totalFleetDistanceKm: 78500,
    expiredDocumentsCount: 0,
    criticalDocumentsCount: 2,
    averageSafetyScore: 94.2,
    safeDriversCount: 14,
  };

  // Financial Calculations via Decimal.js
  const revMadDec = new Decimal(metrics.totalRevenueMAD);
  const revEurDec = new Decimal(metrics.totalRevenueEUR);
  const eurExchangeRate = new Decimal(10.90);
  const totalRevCombinedMad = revMadDec.plus(revEurDec.times(eurExchangeRate));

  const expensesDec = new Decimal(metrics.totalExpensesMAD);
  const netProfitDec = totalRevCombinedMad.minus(expensesDec);
  const marginPercent = totalRevCombinedMad.gt(0)
    ? netProfitDec.dividedBy(totalRevCombinedMad).times(100).toNumber()
    : 0;

  const totalMadLiquidity = new Decimal(metrics.cashBalanceMAD).plus(new Decimal(metrics.bankBalanceMAD)).toNumber();

  const handleTestPortNetPush = async () => {
    setIsPushingCustoms(true);
    try {
      const res = await pushDeclarationToCustomsGateway(101, 'portnet');
      if (res.success) {
        setCustomsStatus('success');
        toast({
          title: t('✅ تم الإرسال إلى PortNet بنجاح', '✅ Envoi PortNet réussi', '✅ Envío a PortNet exitoso'),
          description: t(
            `تم قبول الإشعار المسبق برقم مرجعي: ${res.referenceNumber}`,
            `Préavis accepté avec réf : ${res.referenceNumber}`,
            `Preaviso aceptado con ref: ${res.referenceNumber}`
          ),
        });
      } else {
        throw new Error(res.error || 'Failed push');
      }
    } catch {
      setCustomsStatus('error');
      toast({
        title: t('خطأ في الاتصال ببوابة الجمارك', 'Erreur Passerelle Douane', 'Error Pasarela Aduanas'),
        variant: 'destructive',
      });
    } finally {
      setIsPushingCustoms(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* 1. Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-card via-card/95 to-primary/5 border border-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black font-amiri text-foreground tracking-tight">
              {t(
                'برج المراقبة والتحكم التنفيذي للأسطول الدولي (TIR)',
                'Tour de Contrôle Exécutive TIR',
                'Torre de Control Ejecutiva TIR'
              )}
            </h1>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-xs">
              Live Control
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 ms-10">
            {t(
              'الرؤية المركزية الشاملة: السيولة النقدية، هوامش الربحية P&L، كفاءة المحروقات، والربط المباشر مع PortNet / BADR.',
              'Vue consolidée : Trésorerie multi-devises, rentabilité nette, audit carburant et passerelle PortNet/BADR.',
              'Vista consolidada: Tesorería multisede, rentabilidad neta, auditoría combustible y pasarela PortNet/BADR.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleTestPortNetPush}
            disabled={isPushingCustoms}
            className="rounded-xl text-xs gap-1.5 font-bold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {isPushingCustoms
                ? t('جاري الإرسال...', 'Envoi en cours...', 'Enviando...')
                : t('دفع تجريبي لـ PortNet', 'Push Direct PortNet', 'Push Directo PortNet')}
            </span>
          </Button>
        </div>
      </div>

      {/* 2. Executive Liquidity & Treasury Reserves */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* MAD Total Liquidity */}
        <Card className="rounded-2xl border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('السيولة المتاحة بالدرهم (صندوق + بنوك)', 'Disponibilités Trésorerie MAD', 'Liquidez Total MAD')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {formatCurrency(totalMadLiquidity, 'MAD')}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
            <span>{t('البنك:', 'Banque :')} {formatCurrency(metrics.bankBalanceMAD, 'MAD')}</span>
            <span>{t('الصندوق:', 'Caisse :')} {formatCurrency(metrics.cashBalanceMAD, 'MAD')}</span>
          </div>
        </Card>

        {/* EUR Currency Reserves */}
        <Card className="rounded-2xl border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('احتياطي العملة الصعبة (EUR الدولي)', 'Réserves Devises EUR (Transit)', 'Reservas de Divisas EUR')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-2">
            {formatCurrency(metrics.eurBalance, 'EUR')}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
            <span>{t('القيمة بالدرهم:', 'Contrevaleur :')} ≈ {formatCurrency(new Decimal(metrics.eurBalance).times(eurExchangeRate).toNumber(), 'MAD')}</span>
            <span className="font-mono text-emerald-600 font-semibold">Taux: 10.90</span>
          </div>
        </Card>

        {/* Executive Net Margin P&L */}
        <Card className="rounded-2xl border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('صافي هامش الربح التشغيلي (P&L)', 'Marge Nette Consolidée', 'Margen Neto Consolidado')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-foreground mt-2">
            {formatCurrency(netProfitDec.toNumber(), 'MAD')}
          </p>
          <div className="flex items-center justify-between text-[11px] font-bold mt-2 pt-2 border-t border-border/50">
            <span className="text-purple-600">{marginPercent.toFixed(1)}% {t('نسبة الربح الصافي', 'Marge Nette')}</span>
            <span className="text-muted-foreground font-normal">
              {t('الإيراد الإجمالي:', 'Revenu :')} {formatCurrency(totalRevCombinedMad.toNumber(), 'MAD')}
            </span>
          </div>
        </Card>
      </div>

      {/* 3. Operational KPIs: CPK, Fleet Uptime, Predictive Fuel, Customs Gateway */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Efficiency & Cost Per KM */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                {t('كفاءة الأسطول والتكلفة للكيلومتر (CPK)', 'Efficacité Flotte & Coût au KM')}
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {metrics.totalFleetDistanceKm.toLocaleString()} KM Total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] text-muted-foreground block">
                  {t('متوسط تكلفة الكيلومتر (CPK):', 'Coût Moyen au KM (CPK) :')}
                </span>
                <span className="text-xl font-bold font-mono text-foreground mt-1 block">
                  {metrics.averageCpkMad} <span className="text-xs font-normal text-muted-foreground">MAD / km</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] text-muted-foreground block">
                  {t('نسبة تشغيل الأسطول (Uptime):', 'Disponibilité Flotte (Uptime) :')}
                </span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {metrics.fleetUptimePercent}%
                </span>
              </div>
            </div>

            {/* Document Radar Status */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {t('رادار وثائق الأسطول والتراخيص', 'Radar Documents Flotte')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {metrics.criticalDocumentsCount} {t('وثائق تنتهي خلال 15 يوماً', 'documents à renouveler sous 15j')}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-xs">
                {metrics.expiredDocumentsCount === 0 ? t('0 منتهية', '0 expiré') : `${metrics.expiredDocumentsCount} منتهية`}
              </Badge>
            </div>

            {/* Driver Eco-Safety Bonus */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {t('مؤشر القيادة الآمنة ومكافآت السائقين', 'Score Sécurité & Eco-Conduite')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {metrics.safeDriversCount} {t('سائقين مؤهلين لمكافأة السلامة والوقود', 'chauffeurs éligibles à la prime')}
                  </p>
                </div>
              </div>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {metrics.averageSafetyScore} / 100
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Direct Customs Gateway & PortNet Hub */}
        <Card className="rounded-2xl border-border bg-card shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Ship className="w-5 h-5 text-primary" />
                  {t('بوابة الجمارك المباشرة والشباك الوحيد (PortNet / BADR)', 'Passerelle Douane & PortNet Direct')}
                </span>
                <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                  EDI / XML Push
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(
                  'تجهيز وإرسال الإشعارات المسبقة للشحنات والحاويات (Pre-Arrival Gate Pass) المتوافقة مع معايير شباك الموانئ الوحيد PortNet ونظام الجمارك المغربي BADR لتفادي التوقف في معابر طنجة المتوسط.',
                  'Génération automatique des avis préalables de transit portuaire conformes aux standards PortNet et douane BADR.',
                  'Generación automática de avisos previos de tránsito portuario conformes a PortNet y aduana BADR.'
                )}
              </p>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('بروتوكول الأمان والتشفير:', 'Sécurité & Signature :')}</span>
                  <span className="font-mono font-bold text-foreground">HMAC-SHA256 Signed</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('معبر العبور البحري:', 'Corridor Maritime :')}</span>
                  <span className="font-mono text-blue-600 font-bold">Tanger Med ⟷ Algeciras</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('حالة الربط الآلي:', 'Statut Passerelle :')}</span>
                  <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t('متصل ومعتمد (Production Ready)', 'Opérationnel')}
                  </span>
                </div>
              </div>

              {/* Predictive Insights Teaser */}
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-foreground">
                    {t('التنبؤ الذكي بالاستهلاك:', 'Prévision Carburant :')}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-600">
                  {t('ميزانية الشهر القادم: 52,000 كم', 'Budget Prochain Mois : 52,000 km')}
                </span>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}

