'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import {
  getFleetCopilotInsightsAction,
  applyCopilotMitigationAction,
} from '../services/copilot.actions';
import type {
  FleetCopilotInsight,
  TripRiskAssessment,
  CopilotRecommendation,
  RiskCategory,
} from '../types/copilot-risk.types';
import {
  Sparkles,
  Bot,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Snowflake,
  Fuel,
  Clock,
  Navigation,
  CheckCircle2,
  ArrowRight,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';

interface Props {
  initialData?: FleetCopilotInsight;
  onSelectTrip?: (tripId: number) => void;
  className?: string;
}

export function LogisticsCopilotCard({ initialData, onSelectTrip, className }: Props) {
  const { t, locale, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(!initialData);
  const [data, setData] = useState<FleetCopilotInsight | null>(initialData || null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [appliedRecIds, setAppliedRecIds] = useState<Set<string>>(new Set());

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFleetCopilotInsightsAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast({
          title: t('خطأ في جلب بيانات المساعد الذكي', 'Erreur de chargement Copilot', 'Error cargando datos del copiloto'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (!initialData) {
      fetchInsights();
    }
  }, [initialData, fetchInsights]);

  const handleApplyMitigation = async (
    tripId: number,
    rec: CopilotRecommendation
  ) => {
    setActionLoadingId(rec.id);
    try {
      const res = await applyCopilotMitigationAction({
        tripId,
        recommendationId: rec.id,
        actionType: rec.actionType,
        notes: `تطبيق تلقائي عبر واجهة Copilot (${locale})`,
      });

      if (res.success) {
        setAppliedRecIds((prev) => new Set([...prev, rec.id]));
        toast({
          title: t('تم تنفيذ الإجراء الاستباقي بنجاح', 'Action proactive exécutée avec succès', 'Acción proactiva ejecutada con éxito'),
          description: res.message || rec.titleAr,
        });
      } else {
        toast({
          title: t('تعذر تنفيذ الإجراء', 'Échec de l’action', 'Error al ejecutar la acción'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const getRecTitle = (rec: CopilotRecommendation) => {
    if (locale === 'fr') return rec.titleFr;
    if (locale === 'es') return rec.titleEs;
    return rec.titleAr;
  };

  const getRecDesc = (rec: CopilotRecommendation) => {
    if (locale === 'fr') return rec.recommendationFr;
    if (locale === 'es') return rec.recommendationEs;
    return rec.recommendationAr;
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
  };

  const filteredTrips = (data?.topCriticalTrips || []).filter((trip) => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'critical') return trip.overallSeverity === 'critical';
    return trip.factors.some((f) => f.category === categoryFilter && f.score >= 30);
  });

  return (
    <Card className={`border-border shadow-md overflow-hidden ${className || ''}`}>
      {/* 1. Header with AI Pulse Glow */}
      <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-gradient-to-r from-indigo-500/5 via-primary/5 to-cyan-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold">
                  {t(
                    'مساعد العمليات اللوجستي الذكي ورادار المخاطر',
                    'Copilot Logistique IA & Radar des Risques',
                    'Copiloto Logístico IA y Radar de Riesgos'
                  )}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-mono px-1.5 py-0 border-indigo-400/40 text-indigo-600 dark:text-indigo-400"
                >
                  AI Copilot
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                {t(
                  'تحليل استباقي متكامل لمخاطر التبريد، شذوذ استهلاك الوقود، تكدس المعابر، وإجهاد السائقين',
                  'Évaluation prédictive : chaîne du froid, surconsommation, goulots douaniers et fatigue',
                  'Evaluación predictiva: cadena de frío, sobreconsumo, demoras aduaneras y fatiga'
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInsights}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('تحديث التحليل', 'Actualiser', 'Actualizar')}</span>
            </Button>
          </div>
        </div>

        {/* 2. Fleet Risk Dimension Gauges */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 mt-2 border-t border-border/40">
            {/* Cold Chain Gauge */}
            <div className="p-2.5 rounded-xl bg-card border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
                  {t('سلسلة التبريد', 'Chaîne Froid', 'Cadena de Frío')}
                </span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                  {data.categoryDistribution.cold_chain.avgScore}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.categoryDistribution.cold_chain.avgScore)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{t('حالات حرجة:', 'Critiques :', 'Críticos :')}</span>
                <span className="font-bold text-rose-500 font-mono">
                  {data.categoryDistribution.cold_chain.criticalCount}
                </span>
              </div>
            </div>

            {/* Fuel Anomaly Gauge */}
            <div className="p-2.5 rounded-xl bg-card border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-500" />
                  {t('شذوذ الوقود', 'Anomalie Carburant', 'Anomalía Combustible')}
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                  {data.categoryDistribution.fuel_anomaly.avgScore}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.categoryDistribution.fuel_anomaly.avgScore)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{t('حالات حرجة:', 'Critiques :', 'Críticos :')}</span>
                <span className="font-bold text-rose-500 font-mono">
                  {data.categoryDistribution.fuel_anomaly.criticalCount}
                </span>
              </div>
            </div>

            {/* Border Delays Gauge */}
            <div className="p-2.5 rounded-xl bg-card border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-indigo-500" />
                  {t('تكدس المعابر', 'Goulots Douaniers', 'Demoras Aduana')}
                </span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  {data.categoryDistribution.border_delay.avgScore}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.categoryDistribution.border_delay.avgScore)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{t('حالات حرجة:', 'Critiques :', 'Críticos :')}</span>
                <span className="font-bold text-rose-500 font-mono">
                  {data.categoryDistribution.border_delay.criticalCount}
                </span>
              </div>
            </div>

            {/* Driver Fatigue Gauge */}
            <div className="p-2.5 rounded-xl bg-card border border-border/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  {t('إجهاد السائقين', 'Fatigue Chauffeur', 'Fatiga Conductor')}
                </span>
                <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                  {data.categoryDistribution.driver_fatigue.avgScore}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.categoryDistribution.driver_fatigue.avgScore)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{t('حالات حرجة:', 'Critiques :', 'Críticos :')}</span>
                <span className="font-bold text-rose-500 font-mono">
                  {data.categoryDistribution.driver_fatigue.criticalCount}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* 3. Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium me-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              {t('تصفية الرادار:', 'Filtre :', 'Filtro :')}
            </span>
            {[
              { id: 'all', label: t('الكل', 'Tous', 'Todos') },
              { id: 'critical', label: t('🚨 حرجة فقط', '🚨 Critiques', '🚨 Críticos') },
              { id: 'cold_chain', label: t('❄️ التبريد', '❄️ Frigo', '❄️ Frío') },
              { id: 'fuel_anomaly', label: t('⛽ الوقود', '⛽ Carburant', '⛽ Combustible') },
              { id: 'border_delay', label: t('🚧 المعابر', '🚧 Douanes', '🚧 Aduanas') },
              { id: 'driver_fatigue', label: t('⏱️ الإجهاد', '⏱️ Fatigue', '⏱️ Fatiga') },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCategoryFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  categoryFilter === f.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            {t('الرحلات المرصودة:', 'Trajets audités :', 'Viajes auditados :')}{' '}
            <strong className="text-foreground font-mono">{filteredTrips.length}</strong>
          </div>
        </div>

        {/* 4. Trips Risk List & AI Recommendations */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center p-8 gap-3 text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-xs font-medium">
              {t(
                'جاري حساب مؤشرات الذكاء التنبؤي للأساطيل...',
                'Calcul des indicateurs prédictifs de la flotte...',
                'Calculando indicadores predictivos de la flota...'
              )}
            </p>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-xl text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-bold text-foreground">
              {t(
                'جميع مؤشرات الرحلات ضمن الحدود الآمنة',
                'Tous les indicateurs de mission sont optimaux',
                'Todos los indicadores de viaje son óptimos'
              )}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t(
                'لم يتم رصد أي انحراف حراري أو شذوذ في استهلاك الوقود أو إجهاد قيادة يتطلب تدخلاً فورياً.',
                'Aucune anomalie thermique, surconsommation ou fatigue requérant une action immédiate.',
                'No se detectaron anomalías térmicas, sobreconsumo o fatiga que requieran acción inmediata.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrips.map((trip) => (
              <div
                key={trip.tripId}
                className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all space-y-3"
              >
                {/* Trip Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <MatriculeBadge plate={trip.truckPlate} />
                    {trip.trailerPlate && (
                      <span className="text-xs text-muted-foreground font-mono">
                        ({trip.trailerPlate})
                      </span>
                    )}
                    <span className="text-xs font-semibold text-foreground">
                      {trip.driverName}
                    </span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                      {trip.corridor === 'african_overland'
                        ? t('الممر الإفريقي', 'Corridor Africain', 'Corredor Africano')
                        : trip.corridor === 'european_maritime'
                        ? t('الممر الأوروبي', 'Corridor Européen', 'Corredor Europeo')
                        : t('نقل وطني', 'National', 'Nacional')}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-end">
                      <span className="text-[10px] text-muted-foreground block">
                        {t('مؤشر الخطر الإجمالي:', 'Indice de Risque :', 'Índice de Riesgo :')}
                      </span>
                      <span className="text-sm font-extrabold font-mono">
                        {trip.compositeRiskScore}/100
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold px-2 py-0.5 border ${getSeverityBadgeClass(
                        trip.overallSeverity
                      )}`}
                    >
                      {trip.overallSeverity === 'critical'
                        ? t('🚨 حرج للغاية', '🚨 Critique', '🚨 Crítico')
                        : trip.overallSeverity === 'high'
                        ? t('⚠️ مرتفع', '⚠️ Élevé', '⚠️ Alto')
                        : trip.overallSeverity === 'medium'
                        ? t('متوسط', 'Moyen', 'Medio')
                        : t('آمن', 'Faible', 'Bajo')}
                    </Badge>
                  </div>
                </div>

                {/* Factors Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {trip.factors.map((factor) => (
                    <div
                      key={factor.category}
                      className={`p-2 rounded-lg border text-xs flex flex-col justify-between ${
                        factor.score >= 60
                          ? 'bg-rose-500/5 border-rose-500/30'
                          : factor.score >= 30
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-muted/40 border-border/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[11px] truncate">
                          {factor.category === 'cold_chain' && '❄️ '}
                          {factor.category === 'fuel_anomaly' && '⛽ '}
                          {factor.category === 'border_delay' && '🚧 '}
                          {factor.category === 'driver_fatigue' && '⏱️ '}
                          {locale === 'fr'
                            ? factor.titleFr
                            : locale === 'es'
                            ? factor.titleEs
                            : factor.titleAr}
                        </span>
                        <span
                          className={`font-mono font-bold text-[11px] ${
                            factor.score >= 60
                              ? 'text-rose-600'
                              : factor.score >= 30
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {factor.score}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">
                        {locale === 'fr'
                          ? factor.descriptionFr
                          : locale === 'es'
                          ? factor.descriptionEs
                          : factor.descriptionAr}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Copilot Actionable Recommendations */}
                {trip.recommendations.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {t(
                          'توصيات الذكاء الاصطناعي الاستباقية للتدخل:',
                          'Recommandations Proactives de l’IA :',
                          'Recomendaciones Proactivas de la IA :'
                        )}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {trip.recommendations.map((rec) => {
                        const isApplied = appliedRecIds.has(rec.id);
                        const isCurrentActionLoading = actionLoadingId === rec.id;

                        return (
                          <div
                            key={rec.id}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              rec.severity === 'critical'
                                ? 'bg-rose-500/5 border-rose-500/30'
                                : 'bg-indigo-500/5 border-indigo-500/20'
                            }`}
                          >
                            <div className="space-y-1 max-w-xl">
                              <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                {isApplied ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                )}
                                <span>{getRecTitle(rec)}</span>
                              </h5>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {getRecDesc(rec)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {isApplied ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs gap-1 py-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{t('تم التطبيق', 'Appliqué', 'Aplicado')}</span>
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={rec.severity === 'critical' ? 'destructive' : 'default'}
                                  disabled={isCurrentActionLoading}
                                  onClick={() => handleApplyMitigation(trip.tripId, rec)}
                                  className="h-8 text-xs gap-1.5 shadow-xs"
                                >
                                  {isCurrentActionLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  <span>
                                    {rec.actionType === 'adjust_reefer_setpoint'
                                      ? t('إعادة ضبط المبرد', 'Ajuster Consigne', 'Ajustar Consigna')
                                      : rec.actionType === 'driver_rest_alert'
                                      ? t('إشعار استراحة السائق', 'Alerte Repos', 'Alerta Descanso')
                                      : rec.actionType === 'reroute_fuel_station'
                                      ? t('توجيه لمحطة وقود', 'Orienter Station', 'Desviar Estación')
                                      : rec.actionType === 'escalate_customs_transit'
                                      ? t('تسريع التخليص', 'Priorité Douane', 'Prioridad Aduana')
                                      : t('تدخل طوارئ فوري', 'Intervention Immédiate', 'Intervención Inmediata')}
                                  </span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
