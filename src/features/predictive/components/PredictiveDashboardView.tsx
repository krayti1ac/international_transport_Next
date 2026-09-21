'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AssetHealthRadarCard } from './AssetHealthRadarCard';
import { CashFlowProjectionChart } from './CashFlowProjectionChart';
import { getPredictiveEngineDataAction } from '../services/predictive.actions';
import type { PredictiveDashboardData } from '../types/predictive-engine.types';
import {
  BrainCircuit,
  RefreshCw,
  Gauge,
  DollarSign,
  AlertTriangle,
  Snowflake,
  ShieldCheck,
  TrendingUp,
  Activity,
} from 'lucide-react';

export function PredictiveDashboardView() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PredictiveDashboardData | null>(null);
  const [mainTab, setMainTab] = useState<'fleet_health' | 'cash_flow'>('fleet_health');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPredictiveEngineDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast({
          title: t('خطأ في جلب التحليلات التنبؤية', 'Erreur de chargement', 'Error de carga'),
          description: res.error || t('تعذر الاتصال بمحرك الذكاء التنبؤي', 'Impossible de joindre le moteur IA prédictif', 'No se pudo conectar al motor de IA predictivo'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue', 'Error inesperado'),
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4" dir={dir}>
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">
          {t('جاري معالجة الخوارزميات التنبؤية للأسطول والتدفقات النقدية...', 'Traitement des algorithmes prédictifs flotte & trésorerie...', 'Procesando algoritmos predictivos de flota y tesorería...')}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center" dir={dir}>
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="font-bold text-lg">{t('تعذر تحميل البيانات التنبؤية', 'Données prédictives indisponibles', 'Datos predictivos no disponibles')}</h3>
        <Button onClick={fetchData} className="mt-4 gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('إعادة المحاولة', 'Réessayer', 'Reintentar')}
        </Button>
      </div>
    );
  }

  const { fleetHealth, cashFlowProjections } = data;
  const day30 = cashFlowProjections.find((p) => p.horizonDays === 30);

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary" />
            {t('محرك النماذج التنبؤية للأسطول والتدفقات النقدية', 'Moteur d’IA Prédictive Flotte & Trésorerie', 'Motor de IA Predictiva de Flota y Tesorería')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'تحليل استباقي لتآكل الأصول ومبردات Frigo مع استشراف السيولة النقدية وسرعة سداد المصدرين بدقة Decimal.js',
              'Anticipation de l’usure des actifs et groupes frigo avec prévisions de trésorerie strictes en Decimal.js',
              'Anticipación del desgaste de activos y equipos frigoríficos con proyecciones de tesorería en Decimal.js'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="text-xs h-9 rounded-xl gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('تحديث التحليلات', 'Actualiser', 'Actualizar')}
          </Button>
        </div>
      </div>

      {/* Top Bento KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* 1. Fleet Health */}
        <Card className="border-border shadow-sm p-4 rounded-2xl">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">{t('مؤشر صحة الأسطول', 'Score Santé Flotte', 'Salud de Flota')}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {fleetHealth.overallFleetHealthScore}%
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({fleetHealth.totalTrucksAudited} {t('رأس جرار', 'tracteurs', 'tractores')})
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {fleetHealth.overallFleetHealthScore >= 80
              ? t('حالة ممتازة وجاهزية قارية', 'Excellente condition', 'Excelente condición')
              : t('تنبيهات صيانة تتطلب التدخل', 'Intervention requise', 'Intervención requerida')}
          </div>
        </Card>

        {/* 2. Critical Tires */}
        <Card className="border-border shadow-sm p-4 rounded-2xl">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">{t('إطارات حرجة (≥90%)', 'Pneus Critiques (≥90%)', 'Neumáticos Críticos')}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${fleetHealth.criticalTireCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {fleetHealth.criticalTireCount}
            </span>
            <span className="text-[10px] text-muted-foreground">
              +{fleetHealth.warningTireCount} {t('تنبيهات فحص', 'alertes', 'alertas')}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {fleetHealth.criticalTireCount > 0
              ? t('شاحنات محظورة من المسافات الطويلة', 'Camions interdits longs trajets', 'Camiones restringidos')
              : t('كافة الإطارات في حدود الأمان', 'Tous pneus conformes', 'Todos los neumáticos conformes')}
          </div>
        </Card>

        {/* 3. Frigo Reefers */}
        <Card className="border-border shadow-sm p-4 rounded-2xl">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">{t('مبردات الشحن Frigo', 'Groupes Frigo', 'Equipos Frigoríficos')}</span>
            <Snowflake className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${fleetHealth.criticalReeferCount > 0 ? 'text-rose-600' : 'text-sky-600'}`}>
              {fleetHealth.reefers.length - fleetHealth.criticalReeferCount} / {fleetHealth.reefers.length}
            </span>
            <span className="text-[10px] text-muted-foreground">{t('جاهز للتصدير', 'opérationnels', 'operativos')}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {fleetHealth.criticalReeferCount > 0
              ? t('وحدات تبريد مهددة بالانحراف الحراري', 'Risque dérive thermique', 'Riesgo deriva térmica')
              : t('سلسلة التبريد مؤمنة بالكامل', 'Chaîne du froid 100% sécurisée', 'Cadena de frío asegurada')}
          </div>
        </Card>

        {/* 4. 30-Day Liquidity */}
        <Card className="border-border shadow-sm p-4 rounded-2xl">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">{t('سيولة 30 يوماً الصافية', 'Trésorerie Nette à 30J', 'Tesorería Neta a 30D')}</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {day30 ? parseFloat(day30.projectedNetCashMad).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
            </span>
            <span className="text-xs font-sans text-muted-foreground">MAD</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {day30?.liquidityStatus === 'surplus'
              ? t('فائض مالي مريح', 'Excédent confortable', 'Superávit cómodo')
              : t('توازن تشغيلي مستمر', 'Équilibre d’exploitation', 'Equilibrio operativo')}
          </div>
        </Card>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-border gap-6 text-sm">
        <button
          onClick={() => setMainTab('fleet_health')}
          className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-2 ${
            mainTab === 'fleet_health'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Gauge className="w-4 h-4" />
          {t('رادار صحة الأصول وتوقع الأعطال (Fleet Health)', 'Santé des Actifs & Pannes', 'Salud de Activos y Averías')}
        </button>

        <button
          onClick={() => setMainTab('cash_flow')}
          className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-2 ${
            mainTab === 'cash_flow'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {t('استشراف السيولة وسرعة سداد المصدرين (Cash Flow & PVI)', 'Prévisions Trésorerie & PVI', 'Proyecciones de Tesorería y PVI')}
        </button>
      </div>

      {/* Main Tab Content */}
      {mainTab === 'fleet_health' ? (
        <AssetHealthRadarCard fleetHealth={fleetHealth} />
      ) : (
        <CashFlowProjectionChart
          projections={cashFlowProjections}
          clientVelocities={data.clientVelocities}
        />
      )}
    </div>
  );
}

