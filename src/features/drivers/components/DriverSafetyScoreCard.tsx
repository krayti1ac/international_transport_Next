'use client';

import React from 'react';
import { useLanguage } from '@/components/language-provider';
import type { DriverSafetyBreakdown } from '../services/driver-safety-score.actions';
import { ShieldCheck, AlertTriangle, Award, Gauge, Activity, Clock, Info } from 'lucide-react';

interface Props {
  data: DriverSafetyBreakdown;
  className?: string;
}

export function DriverSafetyScoreCard({ data, className = '' }: Props) {
  const { t, dir } = useLanguage();

  const getRatingBadgeStyle = (rating: DriverSafetyBreakdown['rating']) => {
    switch (rating) {
      case 'excellent':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'good':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'warning':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'critical':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
    }
  };

  const getScoreCircleColor = (rating: DriverSafetyBreakdown['rating']) => {
    switch (rating) {
      case 'excellent':
        return 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20';
      case 'good':
        return 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20';
      case 'warning':
        return 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20';
      case 'critical':
        return 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20';
    }
  };

  const getRatingTitle = (rating: DriverSafetyBreakdown['rating']) => {
    switch (rating) {
      case 'excellent':
        return t('قيادة مثالية واقتصادية 🛡️', 'Conduite Exemplaire & Éco 🛡️', 'Conducción Ejemplar y Eco 🛡️');
      case 'good':
        return t('قيادة جيدة وآمنة 👍', 'Bonne Conduite Sécurisée 👍', 'Buena Conducción Segura 👍');
      case 'warning':
        return t('بحاجة لتحسين القيادة ⚠️', 'Conduite à Améliorer ⚠️', 'Conducción a Mejorar ⚠️');
      case 'critical':
        return t('مؤشر خطورة مرتفع 🚨', 'Indice de Risque Critique 🚨', 'Índice de Riesgo Crítico 🚨');
    }
  };

  return (
    <div
      dir={dir}
      className={`rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header & Score Circle */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>
              {t(
                `مؤشر سلوك وسلامة السائق (${data.periodDays} يوماً)`,
                `Score de Sécurité Conducteur (${data.periodDays} jours)`,
                `Puntaje de Seguridad del Conductor (${data.periodDays} días)`
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              {getRatingTitle(data.rating)}
            </h3>
            <span
              className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border ${getRatingBadgeStyle(
                data.rating
              )}`}
            >
              {data.totalScore}/100
            </span>
          </div>
        </div>

        {/* Circular Visual Score */}
        <div
          className={`flex h-13 w-13 sm:h-14 sm:w-14 shrink-0 flex-col items-center justify-center rounded-full border-3 font-mono font-black text-lg sm:text-xl shadow-xs ${getScoreCircleColor(
            data.rating
          )}`}
        >
          <span>{data.totalScore}</span>
          <span className="text-[9px] font-normal leading-none -mt-0.5 opacity-80">%</span>
        </div>
      </div>

      {/* Safety Bonus Banner if >= 90 */}
      {data.isEligibleForBonus && (
        <div className="mt-3.5 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">
              {t(
                'مكافأة القيادة الآمنة مستحقة لك هذا الشهر!',
                'Prime de Sécurité & Éco-conduite acquise ce mois-ci !',
                '¡Bono de Seguridad y Eco-conducción ganado este mes!'
              )}
            </span>
          </div>
          <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 shrink-0">
            +{data.safetyBonusMAD} MAD
          </span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <Gauge className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('تجاوز السرعة', 'Excès vitesse', 'Exceso velocidad')}</span>
          </div>
          <span className="font-mono font-bold text-foreground text-sm">
            {data.metrics.overspeedingEvents}
          </span>
          <span className="block text-[10px] text-muted-foreground mt-0.5">
            {data.penaltiesApplied.speedingDeduction > 0 ? `-${data.penaltiesApplied.speedingDeduction} pts` : '0 pts'}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span>{t('كبح وتسارع حاد', 'Freinage/Accél.', 'Frenado/Acel.')}</span>
          </div>
          <span className="font-mono font-bold text-foreground text-sm">
            {data.metrics.harshBrakingEvents + data.metrics.harshAccelerationEvents}
          </span>
          <span className="block text-[10px] text-muted-foreground mt-0.5">
            {data.penaltiesApplied.harshDrivingDeduction > 0 ? `-${data.penaltiesApplied.harshDrivingDeduction} pts` : '0 pts'}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <span>{t('توقف بالمحرك', 'Ralenti idling', 'Ralentí')}</span>
          </div>
          <span className="font-mono font-bold text-foreground text-sm">
            {data.metrics.excessiveIdlingHours}h
          </span>
          <span className="block text-[10px] text-muted-foreground mt-0.5">
            {data.penaltiesApplied.idlingDeduction > 0 ? `-${data.penaltiesApplied.idlingDeduction} pts` : '0 pts'}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>{t('المخالفات', 'Amendes', 'Multas')}</span>
          </div>
          <span className="font-mono font-bold text-foreground text-sm">
            {data.metrics.trafficFinesCount}
          </span>
          <span className="block text-[10px] text-muted-foreground mt-0.5">
            {data.penaltiesApplied.finesDeduction > 0 ? `-${data.penaltiesApplied.finesDeduction} pts` : '0 pts'}
          </span>
        </div>
      </div>

      {/* Smart Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/40">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-foreground">
            {data.recommendations[0]}
          </p>
        </div>
      )}
    </div>
  );
}

