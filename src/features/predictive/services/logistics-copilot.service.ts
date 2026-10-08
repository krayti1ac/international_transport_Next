/**
 * Predictive Logistics AI Copilot Service
 * Contextual recommendation engine & fleet-wide risk aggregation.
 * Trans Bodanon TMS
 */

import Decimal from 'decimal.js';
import type {
  TripRiskAssessment,
  TripRiskFactor,
  CopilotRecommendation,
  FleetCopilotInsight,
  RiskCategory,
} from '../types/copilot-risk.types';
import {
  computeTripCompositeRisk,
  determineSeverity,
  type ColdChainEvalParams,
  type FuelAnomalyEvalParams,
  type BorderDelayEvalParams,
  type DriverFatigueEvalParams,
} from './predictive-risk-evaluator.service';
import type { InternationalCorridor } from '@/features/analytics/types/corridor.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface GenerateAssessmentInput {
  tripId: number;
  truckId: number;
  truckPlate: string;
  trailerPlate?: string;
  driverId?: number;
  driverName: string;
  driverPhone?: string;
  corridor: InternationalCorridor | 'domestic';
  coldChain: ColdChainEvalParams;
  fuel: FuelAnomalyEvalParams;
  border: BorderDelayEvalParams;
  fatigue: DriverFatigueEvalParams;
}

/**
 * Generates proactive contextual AI copilot recommendations based on factor evaluations.
 */
export function generateCopilotRecommendations(
  tripId: number,
  factors: TripRiskFactor[]
): CopilotRecommendation[] {
  const recommendations: CopilotRecommendation[] = [];

  for (const factor of factors) {
    if (factor.score < 30) continue; // Low risk doesn't require immediate operational intervention

    const recId = `rec_${tripId}_${factor.category}_${Date.now()}`;

    if (factor.category === 'cold_chain') {
      const isCritical = factor.severity === 'critical';
      const cur = factor.metrics.value;
      const target = factor.metrics.target ?? -18.0;

      recommendations.push({
        id: recId,
        tripId,
        category: 'cold_chain',
        severity: factor.severity,
        actionType: isCritical ? 'emergency_dispatch' : 'adjust_reefer_setpoint',
        titleAr: isCritical
          ? 'تدخل طوارئ لسلسلة التبريد (تجاوز حرج)'
          : 'إعادة ضبط وحدة التبريد Frigo فورياً',
        titleFr: isCritical
          ? 'Intervention d’urgence chaîne du froid'
          : 'Ajuster la consigne du groupe frigorifique',
        titleEs: isCritical
          ? 'Intervención de emergencia cadena de frío'
          : 'Ajustar la consigna del frigorífico',
        recommendationAr: isCritical
          ? `إنذار حرج: درجة الحرارة (${cur}°C) متباعدة جداً عن المستهدف (${target}°C). يجب إرسال أمر طوارئ للسائق وتفعيل وحدة الصيانة الميدانية فوراً.`
          : `تنبيه تبريد: درجة الحرارة الحالية ${cur}°C تختلف عن المستهدف (${target}°C). يوصى بإعادة إرسال أمر الضبط المسبق (${target}°C) عبر تقنية IoT والتأكد من إغلاق الأبواب.`,
        recommendationFr: isCritical
          ? `Alerte critique : La température (${cur}°C) s’éloigne dangereusement de la consigne (${target}°C). Déclencher l’intervention d’urgence.`
          : `Alerte frigo : Température actuelle (${cur}°C) en écart par rapport à la consigne (${target}°C). Réajuster la consigne à ${target}°C via IoT.`,
        recommendationEs: isCritical
          ? `Alerta crítica: La temperatura (${cur}°C) difiere gravemente de la consigna (${target}°C). Activar intervención de emergencia.`
          : `Alerta frío: Temperatura actual (${cur}°C) desviada respecto a la consigna (${target}°C). Reajustar la consigna a ${target}°C vía IoT.`,
        suggestedParams: {
          suggestedTemp: Number(target),
          alertMessage: `Reefer temperature excursion alert for trip #${tripId}`,
        },
        applied: false,
      });
    } else if (factor.category === 'fuel_anomaly') {
      const actual = factor.metrics.value;
      const variance = factor.metrics.variancePercentage ?? 0;

      recommendations.push({
        id: recId,
        tripId,
        category: 'fuel_anomaly',
        severity: factor.severity,
        actionType: 'reroute_fuel_station',
        titleAr: 'فحص استهلاك الوقود وتوجيه الشاحنة لمحطة شريكة',
        titleFr: 'Contrôle surconsommation et réorientation carburant',
        titleEs: 'Control de sobreconsumo y desvío a estación',
        recommendationAr: `شذوذ في استهلاك الوقود (${actual} لتر/100كم، +${variance}%). يوصى بإشعار السائق للتحقق من ضغط الإطارات وتوجيهه لأقرب محطة وقود شريكة (أفريقيا / طوطال) للفحص.`,
        recommendationFr: `Surconsommation anormale (${actual} L/100km, +${variance}%). Vérifier la pression des pneumatiques et diriger vers une station partenaire agréée.`,
        recommendationEs: `Consumo anómalo de combustible (${actual} L/100km, +${variance}%). Verificar presión de neumáticos y orientar hacia una estación asociada.`,
        suggestedParams: {
          nearestStation: 'Afriquia / TotalEnergies Partner Station',
        },
        applied: false,
      });
    } else if (factor.category === 'border_delay') {
      const wait = factor.metrics.value;

      recommendations.push({
        id: recId,
        tripId,
        category: 'border_delay',
        severity: factor.severity,
        actionType: 'escalate_customs_transit',
        titleAr: 'تسريع التخليص الجمركي وتفعيل المسار السريع',
        titleFr: 'Accélération du dédouanement et transit prioritaire',
        titleEs: 'Aceleración aduanera y tránsito prioritario',
        recommendationAr: `تأخير في المعبر الجمركي (${wait} دقيقة). يوصى بالتواصل المباشر مع الوكيل الجمركي وتفعيل بيانات التخليص المسبق لتسريع عبور الشاحنة.`,
        recommendationFr: `Attente prolongée au poste frontière (${wait} min). Coordonner avec le déclarant en douane et activer le dédouanement prioritaire.`,
        recommendationEs: `Demora en el cruce aduanero (${wait} min). Coordinar con el agente de aduanas y activar el carril de despacho prioritario.`,
        suggestedParams: {
          customsLane: 'Green Corridor / Fast-Track',
        },
        applied: false,
      });
    } else if (factor.category === 'driver_fatigue') {
      const mins = factor.metrics.value;

      recommendations.push({
        id: recId,
        tripId,
        category: 'driver_fatigue',
        severity: factor.severity,
        actionType: 'driver_rest_alert',
        titleAr: 'إشعار السائق بالتوقف الإلزامي للراحة (45 دقيقة)',
        titleFr: 'Alerte repos obligatoire pour le chauffeur (45 min)',
        titleEs: 'Alerta de descanso obligatorio para el conductor (45 min)',
        recommendationAr: `ساعات القيادة المتواصلة بلغت ${mins} دقيقة. يوصى بإرسال تنبيه بالهاتف وWhatsApp للسائق للتوقف في أقرب استراحة آمنة تجنباً للحوادث والمخالفات.`,
        recommendationFr: `Conduite continue atteignant ${mins} min. Envoyer une alerte WhatsApp au chauffeur pour une pause réglementaire d'au moins 45 minutes.`,
        recommendationEs: `Conducción continua de ${mins} min alcanzada. Enviar alerta WhatsApp al conductor para un descanso reglamentario de 45 minutos.`,
        suggestedParams: {
          restAreaName: 'Aire de Repos Sécurisée',
        },
        applied: false,
      });
    }
  }

  return recommendations;
}

/**
 * Assesses a single active trip and produces full risk assessment & actionable copilot guidance.
 */
export function assessTripRisk(input: GenerateAssessmentInput): TripRiskAssessment {
  const { compositeScore, overallSeverity, factors } = computeTripCompositeRisk({
    tripId: input.tripId,
    truckId: input.truckId,
    truckPlate: input.truckPlate,
    trailerPlate: input.trailerPlate,
    driverId: input.driverId,
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    corridor: input.corridor,
    coldChain: input.coldChain,
    fuel: input.fuel,
    border: input.border,
    fatigue: input.fatigue,
  });

  const recommendations = generateCopilotRecommendations(input.tripId, factors);

  return {
    tripId: input.tripId,
    truckId: input.truckId,
    truckPlate: input.truckPlate,
    trailerPlate: input.trailerPlate,
    driverId: input.driverId,
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    corridor: input.corridor,
    compositeRiskScore: compositeScore,
    overallSeverity,
    factors,
    recommendations,
    assessedAt: new Date().toISOString(),
  };
}

/**
 * Aggregates assessments from multiple trips into a comprehensive fleet-wide copilot insight.
 */
export function aggregateFleetCopilotInsights(
  assessments: TripRiskAssessment[]
): FleetCopilotInsight {
  if (assessments.length === 0) {
    return {
      totalTripsEvaluated: 0,
      highRiskTripsCount: 0,
      criticalTripsCount: 0,
      averageFleetRiskScore: 0,
      overallFleetStatus: 'low',
      categoryDistribution: {
        cold_chain: { count: 0, avgScore: 0, criticalCount: 0 },
        fuel_anomaly: { count: 0, avgScore: 0, criticalCount: 0 },
        border_delay: { count: 0, avgScore: 0, criticalCount: 0 },
        driver_fatigue: { count: 0, avgScore: 0, criticalCount: 0 },
      },
      topCriticalTrips: [],
      generatedAt: new Date().toISOString(),
    };
  }

  let totalScoreDec = new Decimal(0);
  let highRiskCount = 0;
  let criticalCount = 0;

  const categoryTotals: Record<
    RiskCategory,
    { totalScore: InstanceType<typeof Decimal>; count: number; criticalCount: number }
  > = {
    cold_chain: { totalScore: new Decimal(0), count: 0, criticalCount: 0 },
    fuel_anomaly: { totalScore: new Decimal(0), count: 0, criticalCount: 0 },
    border_delay: { totalScore: new Decimal(0), count: 0, criticalCount: 0 },
    driver_fatigue: { totalScore: new Decimal(0), count: 0, criticalCount: 0 },
  };

  for (const assessment of assessments) {
    totalScoreDec = totalScoreDec.plus(assessment.compositeRiskScore);

    if (assessment.overallSeverity === 'critical') {
      criticalCount++;
    } else if (assessment.overallSeverity === 'high') {
      highRiskCount++;
    }

    for (const factor of assessment.factors) {
      const cat = categoryTotals[factor.category];
      if (cat) {
        cat.totalScore = cat.totalScore.plus(factor.score);
        cat.count++;
        if (factor.severity === 'critical') {
          cat.criticalCount++;
        }
      }
    }
  }

  const avgFleetScore = Number(
    totalScoreDec.dividedBy(assessments.length).toFixed(2)
  );

  const overallFleetStatus = determineSeverity(avgFleetScore);

  const categoryDistribution: Record<
    RiskCategory,
    { count: number; avgScore: number; criticalCount: number }
  > = {
    cold_chain: {
      count: categoryTotals.cold_chain.count,
      avgScore:
        categoryTotals.cold_chain.count > 0
          ? Number(
              categoryTotals.cold_chain.totalScore
                .dividedBy(categoryTotals.cold_chain.count)
                .toFixed(1)
            )
          : 0,
      criticalCount: categoryTotals.cold_chain.criticalCount,
    },
    fuel_anomaly: {
      count: categoryTotals.fuel_anomaly.count,
      avgScore:
        categoryTotals.fuel_anomaly.count > 0
          ? Number(
              categoryTotals.fuel_anomaly.totalScore
                .dividedBy(categoryTotals.fuel_anomaly.count)
                .toFixed(1)
            )
          : 0,
      criticalCount: categoryTotals.fuel_anomaly.criticalCount,
    },
    border_delay: {
      count: categoryTotals.border_delay.count,
      avgScore:
        categoryTotals.border_delay.count > 0
          ? Number(
              categoryTotals.border_delay.totalScore
                .dividedBy(categoryTotals.border_delay.count)
                .toFixed(1)
            )
          : 0,
      criticalCount: categoryTotals.border_delay.criticalCount,
    },
    driver_fatigue: {
      count: categoryTotals.driver_fatigue.count,
      avgScore:
        categoryTotals.driver_fatigue.count > 0
          ? Number(
              categoryTotals.driver_fatigue.totalScore
                .dividedBy(categoryTotals.driver_fatigue.count)
                .toFixed(1)
            )
          : 0,
      criticalCount: categoryTotals.driver_fatigue.criticalCount,
    },
  };

  // Sort top critical trips by composite risk score descending
  const topCriticalTrips = [...assessments]
    .sort((a, b) => b.compositeRiskScore - a.compositeRiskScore)
    .slice(0, 10);

  return {
    totalTripsEvaluated: assessments.length,
    highRiskTripsCount: highRiskCount,
    criticalTripsCount: criticalCount,
    averageFleetRiskScore: avgFleetScore,
    overallFleetStatus,
    categoryDistribution,
    topCriticalTrips,
    generatedAt: new Date().toISOString(),
  };
}
