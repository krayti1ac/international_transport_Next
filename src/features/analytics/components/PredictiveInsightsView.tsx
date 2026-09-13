'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useBranchStore } from '@/lib/stores/branch-store';
import {
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Building2,
  Wrench,
  Compass,
  AlertTriangle,
  CheckCircle,
  Clock,
  Fuel,
  RefreshCw,
} from 'lucide-react';
import { getPredictiveInsightsData } from '../services/predictive-insights.actions';
import type {
  PredictiveInsightsSummary,
  QuarterlyForecast,
  BranchEfficiencyMetrics,
  CrossBorderMaintenanceRisk,
  StrategicGrowthRecommendation,
} from '../types/predictive.types';

export function PredictiveInsightsView() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId, availableBranches } = useBranchStore();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PredictiveInsightsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'quarterly' | 'branches' | 'maintenance_radar' | 'recommendations'>('quarterly');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPredictiveInsightsData(selectedBranchId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast({
          title: t('خطأ في استرجاع البيانات', 'Erreur de chargement'),
          description: res.error || t('تعذر جلب التحليلات التنبؤية', 'Impossible de récupérer les analyses prédictives'),
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
  }, [selectedBranchId, t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedBranchName = availableBranches.find((b) => b.id === selectedBranchId)?.name;

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            {t('التحليلات التنبؤية للنمو والأداء التشغيلي', 'Analyses Prédictives & Croissance')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t(
              'استشراف نمو الأسطول، موازنة تدفقات الفروع (Casablanca, Tanger, Madrid)، وخفض الكيلومترات الفارغة',
              'Prévisions de croissance, équilibrage multi-hubs et réduction du roulage à vide'
            )}
            {selectedBranchName && (
              <span className="ms-2 font-semibold text-primary">
                ({t('الفرع:', 'Hub :')} {selectedBranchName})
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="text-xs h-9 rounded-xl gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('تحديث التنبؤات', 'Actualiser')}
          </Button>
        </div>
      </div>

      {/* Top Executive Forecast KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {t('توقعات الإيراد السنوي (CA Prévisionnel)', 'Chiffre d\'Affaires Projeté')}
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">
                {data.totalForecastedRevenueMad} MAD
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>≈ {data.totalForecastedRevenueEur} €</span>
                <span className="font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                  +14.5% {t('نمو سنوي', 'Croissance')}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {t('صافي الأرباح التشغيلية المتوقعة', 'Bénéfice Net Opérationnel')}
              </CardTitle>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {data.totalForecastedNetProfitMad} MAD
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>≈ {data.totalForecastedNetProfitEur} €</span>
                <span className="font-bold text-emerald-600 text-[10px]">
                  {t('متوسط هامش 22%', 'Marge moy. 22%')}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {t('مؤشر صحة وكفاءة الأسطول', 'Indice d\'Efficience Flotte')}
              </CardTitle>
              <CheckCircle className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">
                {data.overallFleetHealthScore} / 100
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('معدل دوران الشاحنات جاهز للذروة', 'Taux de disponibilité optimal')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {t('مستهدف الكيلومترات الفارغة (À Vide)', 'Objectif Roulage à Vide')}
              </CardTitle>
              <Fuel className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {data.emptyKmReductionTargetPercent}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('خفض من 18% إلى 9.5% سنوياً', 'Réduction de 18% à 9.5% / an')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center p-1 rounded-xl bg-muted border border-border text-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('quarterly')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'quarterly'
              ? 'bg-background text-foreground shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          {t('التوقعات الربع سنوية (2027)', 'Projections Trimestrielles')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('branches')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'branches'
              ? 'bg-background text-foreground shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-blue-500" />
          {t('مقارنة كفاءة الفروع والمراكز', 'Efficience Multi-Hubs')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('maintenance_radar')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'maintenance_radar'
              ? 'bg-background text-foreground shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 text-amber-500" />
          {t('رادار الصيانة قبل العبور الدولي', 'Radar Entretien Pré-Départ')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recommendations')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'recommendations'
              ? 'bg-background text-foreground shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-emerald-500" />
          {t('توصيات الذكاء الاصطناعي الاستراتيجية', 'Recommandations Stratégiques')}
        </button>
      </div>

      {/* Tab 1: Quarterly Projections */}
      {activeTab === 'quarterly' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.forecasts.map((f: QuarterlyForecast) => (
              <Card key={f.quarter} className="border-border hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {f.quarter}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {f.confidenceScorePercent}% {t('دقة النموذج', 'confiance')}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-bold mt-1 text-foreground">
                    {dir === 'rtl' ? f.quarterNameAr : f.quarterNameFr}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('الإيراد المتوقع:', 'CA Prévu :')}</span>
                    <span className="font-mono font-bold text-foreground">{f.projectedRevenueMad} MAD</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('صافي الربح:', 'Bénéfice Net :')}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{f.projectedNetProfitMad} MAD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('ميزانية الوقود:', 'Budget Gasoil :')}</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">
                      {f.projectedFuelExpensesMad} MAD
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex justify-between items-center text-[11px] text-muted-foreground">
                    <span>{t('الرحلات المقدرة:', 'Trajets estimés :')} <strong>{f.projectedTripsCount}</strong></span>
                    <span className="font-bold text-primary font-mono">
                      {f.projectedGrowthRatePercent >= 0 ? `+${f.projectedGrowthRatePercent}%` : `${f.projectedGrowthRatePercent}%`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Multi-Branch Efficiency */}
      {activeTab === 'branches' && data && (
        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              {t('مصفوفة مقارنة الفروع ومراكز العمليات الدولية', 'Matrice d\'Efficience Multi-Hubs')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('مقارنة الكيلومترات المحملة والفارغة والمساهمة في الأرباح الصافية', 'Comparatif roulage en charge / à vide et contribution au résultat')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-semibold">{t('الفرع / المركز', 'Hub / Agence')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('الدولة والمدينة', 'Localisation')}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t('الشاحنات النشطة', 'Flotte')}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t('نسبة الكيلومتر الفارغ', 'Taux à Vide')}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t('الإيراد لكل كم', 'CA / Km')}</th>
                    <th className="py-3 px-4 text-end font-semibold">{t('المساهمة في الأرباح', 'Contribution')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {data.branches.map((b: BranchEfficiencyMetrics) => (
                    <tr key={b.branchId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          {b.isHeadquarters && (
                            <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.2 rounded">
                              HQ
                            </span>
                          )}
                          {b.branchName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {b.city} ({b.country})
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="font-bold text-foreground">{b.activeTrucks}</span>
                        <span className="text-muted-foreground"> / {b.totalTrucks}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            b.emptyKmRatioPercent <= 10
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : b.emptyKmRatioPercent <= 15
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {b.emptyKmRatioPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-foreground font-semibold">
                        {b.revenuePerKmMad} MAD/km
                      </td>
                      <td className="py-3 px-4 text-end">
                        <span className="font-mono font-bold text-primary">
                          {b.profitContributionPercent}%
                        </span>
                        <div className="text-[10px] text-muted-foreground">{b.netProfitMad} MAD</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Maintenance Radar */}
      {activeTab === 'maintenance_radar' && data && (
        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" />
              {t('رادار الصيانة الاستباقية للعبور الدولي (TIR Pre-Departure Radar)', 'Radar de Maintenance Pré-Départ TIR')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t(
                'رصد الشاحنات القريبة من عتبات الصيانة الدورية قبل عبور مضيق جبل طارق لتفادي تكاليف الورشات الأوروبية الباهظة',
                'Identification des camions proches du seuil d\'entretien avant traversée maritime pour éviter le dépannage européen'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-semibold">{t('الشاحنة', 'Véhicule')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('المسافة المتبقية', 'Km Restants')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('نوع التدخل المطلوب', 'Intervention')}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t('مستوى الخطر', 'Niveau de Risque')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('التوجيه التشغيلي', 'Directive')}</th>
                    <th className="py-3 px-4 text-end font-semibold">{t('التكلفة المقدرة', 'Coût')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {data.maintenanceRadar.map((item: CrossBorderMaintenanceRisk) => (
                    <tr key={item.truckId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <MatriculeBadge plate={item.plateNumber} variant="badge" size="xs" />
                          <span className="font-semibold text-foreground">{item.model}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {item.kmUntilNextService} km
                      </td>
                      <td className="py-3 px-4 text-muted-foreground capitalize">
                        {item.serviceCategory.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.riskLevel === 'critical'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                              : item.riskLevel === 'warning'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.riskLevel === 'critical'
                            ? t('حرج (إيقاف قبل الإبحار)', 'Critique')
                            : item.riskLevel === 'warning'
                            ? t('تحذير', 'Attention')
                            : t('آمن', 'Conforme')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-muted-foreground max-w-xs">
                        {dir === 'rtl' ? item.adviceAr : item.adviceFr}
                      </td>
                      <td className="py-3 px-4 text-end font-mono font-bold text-foreground">
                        {item.estimatedCostMad} MAD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: AI Strategic Recommendations */}
      {activeTab === 'recommendations' && data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.recommendations.map((rec: StrategicGrowthRecommendation) => (
            <Card key={rec.id} className="border-border hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {rec.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {rec.impactScore}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-bold mt-2 text-foreground">
                    {dir === 'rtl' ? rec.titleAr : rec.titleFr}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 text-xs text-muted-foreground leading-relaxed">
                  {dir === 'rtl' ? rec.descriptionAr : rec.descriptionFr}
                </CardContent>
              </div>
              <div className="p-4 pt-0">
                <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('الوفر السنوي المقدر:', 'Gain annuel estimé :')}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{rec.projectedAnnualSavingsMad} MAD
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

