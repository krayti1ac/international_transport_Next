'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import type { FleetPredictiveSummary } from '../types/predictive-engine.types';
import {
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Wrench,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  Truck,
  Gauge,
} from 'lucide-react';

interface Props {
  fleetHealth: FleetPredictiveSummary;
}

export function AssetHealthRadarCard({ fleetHealth }: Props) {
  const { t, locale, dir } = useLanguage();
  const [subTab, setSubTab] = useState<'tires' | 'reefers' | 'engines'>('tires');

  const getActionText = (item: { recommendedActionAr: string; recommendedActionFr: string; recommendedActionEs: string }) => {
    if (locale === 'fr') return item.recommendedActionFr;
    if (locale === 'es') return item.recommendedActionEs;
    return item.recommendedActionAr;
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              {t('رادار صحة الأصول وتوقع الأعطال الميدانية', 'Radar d’État des Actifs & Pannes Prédictives', 'Radar de Estado de Activos y Averías Predictivas')}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {t(
                'مراقبة تآكل الإطارات، تدهور وحدات التبريد Frigo، واستنزاف الزيوت بناءً على إجهاد الممرين الإفريقي والأوروبي',
                'Surveillance TWI des pneus, dégradation frigo et vidanges selon l’intensité des corridors',
                'Monitoreo TWI de neumáticos, degradación frigorífica y cambios de aceite según corredores'
              )}
            </CardDescription>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl gap-1 text-xs">
            <button
              onClick={() => setSubTab('tires')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                subTab === 'tires'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {t('الإطارات (TWI)', 'Pneus (TWI)', 'Neumáticos (TWI)')}
              {fleetHealth.criticalTireCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setSubTab('reefers')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                subTab === 'reefers'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5" />
              {t('مبردات الشحن (Frigo)', 'Groupes Frigo', 'Equipos Frigoríficos')}
              {fleetHealth.criticalReeferCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setSubTab('engines')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                subTab === 'engines'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              {t('الزيوت والمحركات', 'Huiles & Moteurs', 'Aceites y Motores')}
              {fleetHealth.oilServiceDueCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {/* 1. TIRES VIEW */}
        {subTab === 'tires' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/40">
              <span>{t('معامل الإجهاد: الممر الإفريقي (1.4x) | الممر الأوروبي (1.0x)', 'Facteur de stress : Corridor Africain (1.4x) | Maritime (1.0x)', 'Factor de estrés: Corredor Africano (1.4x) | Marítimo (1.0x)')}</span>
              <span className="font-semibold">{t('الحد الأقصى للإطار: 120,000 كم', 'Limite pneu : 120 000 km', 'Límite neumático: 120.000 km')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fleetHealth.tires.map((tire) => {
                const isCritical = tire.status === 'critical';
                const isWarning = tire.status === 'warning';

                return (
                  <div
                    key={`tire-${tire.truckId}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isCritical
                        ? 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/10'
                        : isWarning
                        ? 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10'
                        : 'border-border/60 bg-card hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <MatriculeBadge plate={tire.plateNumber} />
                        <span className="text-xs text-muted-foreground font-mono">{tire.model}</span>
                      </div>
                      {isCritical ? (
                        <Badge variant="destructive" className="gap-1 text-[11px] font-semibold">
                          <XCircle className="w-3 h-3" />
                          {t('حظر المأموريات الطويلة', 'Interdit Longs Trajets', 'Prohibido Viajes Largos')}
                        </Badge>
                      ) : isWarning ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 gap-1 text-[11px]">
                          <AlertTriangle className="w-3 h-3" />
                          {t('فحص مجدول', 'Contrôle Requis', 'Control Requerido')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('جاهز دولياً', 'Prêt International', 'Listo Internacional')}
                        </Badge>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{t('مؤشر التآكل (TWI)', 'Indice d’Usure Pneus', 'Índice de Desgaste')}</span>
                        <span
                          className={
                            isCritical
                              ? 'text-rose-600 dark:text-rose-400 font-bold'
                              : isWarning
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {tire.twiPercentage}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(tire.twiPercentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{t('الفعلي:', 'Réel :')} {tire.accumulatedKm.toLocaleString()} كم</span>
                        <span>{t('المعدّل بالإجهاد:', 'Pondéré :')} {tire.weightedKm.toLocaleString()} كم</span>
                      </div>
                    </div>

                    <p className="text-xs text-foreground/80 bg-background/60 p-2 rounded-lg border border-border/30">
                      💡 <span className="font-medium">{getActionText(tire)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. REEFERS VIEW */}
        {subTab === 'reefers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/40">
              <span>{t('معيار خدمة الضاغط: 1,500 ساعة تشغيل | غرامة الانحراف الحراري: 5 نقاط', 'Intervalle compresseur : 1 500 h | Dérive thermique : 5 pts', 'Intervalo compresor: 1.500 h | Desviación térmica: 5 pts')}</span>
              <span className="font-semibold">{t('درجات الحرارة المستهدفة: (-19°C / +4°C)', 'T° Cible : (-19°C / +4°C)', 'T° Objetivo: (-19°C / +4°C)')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fleetHealth.reefers.map((reefer) => {
                const isHighRisk = reefer.status === 'high_risk';
                const isDue = reefer.status === 'service_due';

                return (
                  <div
                    key={`reefer-${reefer.trailerId}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isHighRisk
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : isDue
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-border/60 bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="font-bold text-sm">{reefer.plateNumber}</div>
                        <div className="text-[11px] text-muted-foreground">{reefer.reeferModel}</div>
                      </div>
                      <Badge
                        variant={isHighRisk ? 'destructive' : 'outline'}
                        className={`text-[11px] font-semibold ${
                          !isHighRisk && isDue ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''
                        } ${!isHighRisk && !isDue ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : ''}`}
                      >
                        {isHighRisk
                          ? t('عالي الخطورة', 'Risque Élevé', 'Alto Riesgo')
                          : isDue
                          ? t('صيانة مستحقة', 'Entretien Requis', 'Mantenimiento Requerido')
                          : t('مثالي للأسماك والفواكه', 'Optimal Frigo', 'Óptimo Frigorífico')}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center my-3 p-2 rounded-lg bg-muted/40 text-xs">
                      <div>
                        <div className="text-muted-foreground text-[10px]">{t('ساعات المحرك', 'Heures moteur', 'Horas motor')}</div>
                        <div className="font-bold text-foreground">{reefer.engineHours} h</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px]">{t('انحراف الحرارة', 'Dérives T°', 'Derivas T°')}</div>
                        <div className="font-bold text-rose-500">{reefer.tempDriftCount} {t('مرات', 'fois', 'veces')}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px]">{t('نقاط الصحة', 'Score santé', 'Puntaje salud')}</div>
                        <div className={`font-bold ${isHighRisk ? 'text-rose-600' : isDue ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {reefer.healthScore} / 100
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-foreground/80 bg-background/60 p-2 rounded-lg border border-border/30">
                      ❄️ <span className="font-medium">{getActionText(reefer)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. ENGINES VIEW */}
        {subTab === 'engines' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/40">
              <span>{t('المعيار: 40,000 كم (يتم ضغطه تلقائياً إذا كان معدل حرق الوقود أعلى من 36 لتر/100كم)', 'Base : 40 000 km (compressé selon surconsommation carburant)', 'Base: 40.000 km (comprimido según sobreconsumo de combustible)')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fleetHealth.engines.map((eng) => {
                const isOverdue = eng.status === 'overdue';
                const isDueSoon = eng.status === 'due_soon';

                return (
                  <div
                    key={`engine-${eng.truckId}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isOverdue
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : isDueSoon
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-border/60 bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <MatriculeBadge plate={eng.plateNumber} />
                      <Badge
                        variant={isOverdue ? 'destructive' : 'outline'}
                        className={`text-[11px] ${
                          !isOverdue && isDueSoon ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''
                        } ${!isOverdue && !isDueSoon ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : ''}`}
                      >
                        {isOverdue
                          ? t('تغيير زيت متأخر', 'Vidange en Retard', 'Cambio Vencido')
                          : isDueSoon
                          ? t('تغيير زيت قريب', 'Vidange Imminente', 'Cambio Próximo')
                          : t('الزيت في حالة ممتازة', 'Huile Optimale', 'Aceite Óptimo')}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{t('نسبة استهلاك الزيت', 'Usure Huile Moteur', 'Desgaste Aceite')}</span>
                        <span className={isOverdue ? 'text-rose-600 font-bold' : isDueSoon ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                          {eng.degradationPercentage}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOverdue ? 'bg-rose-500' : isDueSoon ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(eng.degradationPercentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{t('المقطوع:', 'Parcouru :')} {eng.kmSinceLastService.toLocaleString()} كم</span>
                        <span>{t('الفاصل المضغوط:', 'Intervalle :')} {eng.effectiveIntervalKm.toLocaleString()} كم ({eng.fuelBurnFactor}x حرق)</span>
                      </div>
                    </div>

                    <p className="text-xs text-foreground/80 bg-background/60 p-2 rounded-lg border border-border/30">
                      🛢️ <span className="font-medium">{getActionText(eng)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

