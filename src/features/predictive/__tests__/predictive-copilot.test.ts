import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateColdChainRisk,
  calculateFuelBurnAnomalyRisk,
  calculateBorderCongestionRisk,
  calculateDriverFatigueRisk,
  computeTripCompositeRisk,
  determineSeverity,
  COLD_CHAIN_WEIGHT,
  FUEL_ANOMALY_WEIGHT,
  BORDER_DELAY_WEIGHT,
  DRIVER_FATIGUE_WEIGHT,
} from '../services/predictive-risk-evaluator.service';
import {
  assessTripRisk,
  generateCopilotRecommendations,
  aggregateFleetCopilotInsights,
} from '../services/logistics-copilot.service';

describe('Predictive Logistics AI Copilot & Risk Radar — Mathematical Engine', () => {
  // Test 1: Mathematical Weights Validation
  it('enforces exact risk factor weights summing to 1.00 with Decimal.js', () => {
    const sum = COLD_CHAIN_WEIGHT.plus(FUEL_ANOMALY_WEIGHT)
      .plus(BORDER_DELAY_WEIGHT)
      .plus(DRIVER_FATIGUE_WEIGHT);

    expect(sum.equals(new Decimal('1.00'))).toBe(true);
    expect(COLD_CHAIN_WEIGHT.toNumber()).toBe(0.35);
    expect(FUEL_ANOMALY_WEIGHT.toNumber()).toBe(0.25);
    expect(BORDER_DELAY_WEIGHT.toNumber()).toBe(0.25);
    expect(DRIVER_FATIGUE_WEIGHT.toNumber()).toBe(0.15);
  });

  // Test 2: Cold Chain Thermal Stability Risk
  describe('Cold Chain Thermal Risk Evaluator', () => {
    it('returns score = 0 and low severity when temperature is within tolerance', () => {
      const res = calculateColdChainRisk({
        currentTemp: -18.5,
        targetTemp: -18.0,
        allowedTolerance: 2.0,
        driftDurationMinutes: 0,
        doorOpen: false,
        cargoType: 'frozen',
      });

      expect(res.score).toBe(0);
      expect(res.severity).toBe('low');
      expect(res.varianceCelsius).toBe(0.5);
    });

    it('evaluates moderate excursion above tolerance with duration penalty', () => {
      const res = calculateColdChainRisk({
        currentTemp: -14.0, // 4°C deviation, excess = 2°C over 2°C tolerance
        targetTemp: -18.0,
        allowedTolerance: 2.0,
        driftDurationMinutes: 50, // 20 mins beyond 30 min threshold
        doorOpen: false,
        cargoType: 'frozen', // 1.15x multiplier
      });

      // baseDev: (2 / 5) * 60 = 24
      // durationPenalty: 20 * 0.75 = 15
      // subtotal: 39 * 1.15 = 44.85
      expect(res.score).toBeCloseTo(44.85, 1);
      expect(res.severity).toBe('medium');
      expect(res.factor.category).toBe('cold_chain');
    });

    it('triggers critical severity for severe pharma excursion with door breach', () => {
      const res = calculateColdChainRisk({
        currentTemp: 12.0, // 7°C deviation from 5.0°C target
        targetTemp: 5.0,
        allowedTolerance: 1.0, // excess = 6.0°C
        driftDurationMinutes: 80,
        doorOpen: true,
        cargoType: 'pharma', // 1.3x multiplier
      });

      // baseDev: min(60, (6/5)*60 = 72) -> 60
      // durationPenalty: min(30, 50 * 0.75 = 37.5) -> 30
      // door: 10
      // sum = 100 * 1.3 -> capped at 100
      expect(res.score).toBe(100);
      expect(res.severity).toBe('critical');
    });
  });

  // Test 3: Fuel Anomaly & Burn Rate Evaluator
  describe('Fuel Burn Anomaly Evaluator', () => {
    it('returns score = 0 when consumption is within 5% normal tolerance of 36 L/100km', () => {
      const res = calculateFuelBurnAnomalyRisk({
        actualConsumptionRate: 37.0, // ~2.7% over 36.0 L/100km
        expectedNormRate: 36.0,
        idleMinutes: 10,
      });

      expect(res.score).toBe(0);
      expect(res.severity).toBe('low');
    });

    it('detects high burn rate spike with excessive engine idling', () => {
      const res = calculateFuelBurnAnomalyRisk({
        actualConsumptionRate: 46.8, // 30% over 36.0 L/100km
        expectedNormRate: 36.0,
        idleMinutes: 75, // 30 mins over 45 min idle threshold
      });

      // variancePct: 30%
      // overconsumptionPenalty: min(75, 30 * 2.5 = 75) -> 75
      // idlePenalty: min(25, (30 / 15) * 5 = 10) -> 10
      // total: 85
      expect(res.score).toBe(85);
      expect(res.severity).toBe('critical');
      expect(res.variancePercentage).toBeCloseTo(30, 1);
    });
  });

  // Test 4: Border Delay & Chokepoint Bottleneck Evaluator
  describe('Border Delay & Customs Bottleneck Evaluator', () => {
    it('returns 0 score when customs status is cleared', () => {
      const res = calculateBorderCongestionRisk({
        corridor: 'african_overland',
        currentWaitMinutes: 200,
        customsStatus: 'cleared',
      });

      expect(res.score).toBe(0);
      expect(res.severity).toBe('low');
    });

    it('returns critical 95 score when border passage is blocked', () => {
      const res = calculateBorderCongestionRisk({
        corridor: 'african_overland',
        currentWaitMinutes: 30,
        customsStatus: 'blocked',
      });

      expect(res.score).toBe(95);
      expect(res.severity).toBe('critical');
    });

    it('calculates proportional delay beyond African corridor baseline (180 min)', () => {
      const res = calculateBorderCongestionRisk({
        corridor: 'african_overland',
        currentWaitMinutes: 300, // 120 mins excess over 180 min baseline
        customsStatus: 'delayed', // +15 bonus
      });

      // excess: 120
      // excessScore: (120 / 180) * 60 = 40
      // raw: 20 + 40 = 60 + 15 (delayed) = 75
      expect(res.score).toBe(75);
      expect(res.severity).toBe('high');
      expect(res.waitMinutes).toBe(300);
    });
  });

  // Test 5: Driver Fatigue & HOS Compliance Evaluator
  describe('Driver Fatigue & HOS Compliance Evaluator', () => {
    it('assigns low risk for safe continuous driving below 3 hours', () => {
      const res = calculateDriverFatigueRisk({
        continuousDriveMinutes: 135, // 2.25 hours
      });

      // (135 / 270) * 20 = 10
      expect(res.score).toBe(10);
      expect(res.severity).toBe('low');
    });

    it('warns when driver enters the 4.0 - 4.5 hour window before mandatory rest', () => {
      const res = calculateDriverFatigueRisk({
        continuousDriveMinutes: 255, // 4 hours 15 min
      });

      // 45 + ((255 - 240) / 30) * 30 = 45 + 15 = 60
      expect(res.score).toBe(60);
      expect(res.severity).toBe('high');
    });

    it('flags critical illegal violation when exceeding 4.5 continuous hours (> 270 mins)', () => {
      const res = calculateDriverFatigueRisk({
        continuousDriveMinutes: 310, // 40 mins overtime
        dailyDriveMinutes: 560, // Exceeds 9h daily threshold (+15 pts)
      });

      // overtimeScore: 75 + (40 * 0.5 = 20) = 95 + 15 = 110 -> capped at 100
      expect(res.score).toBe(100);
      expect(res.severity).toBe('critical');
    });
  });

  // Test 6: Composite Trip Risk Score
  describe('Composite Trip Risk Assessment', () => {
    it('correctly weighs all 4 dimensions into a composite risk score', () => {
      const composite = computeTripCompositeRisk({
        tripId: 401,
        truckId: 10,
        truckPlate: '12345-B-1',
        driverName: 'عمر التازي',
        corridor: 'african_overland',
        coldChain: {
          currentTemp: -18.0,
          targetTemp: -18.0,
          allowedTolerance: 2.0,
        }, // 0 pts * 0.35 = 0
        fuel: {
          actualConsumptionRate: 36.0,
          expectedNormRate: 36.0,
        }, // 0 pts * 0.25 = 0
        border: {
          corridor: 'african_overland',
          currentWaitMinutes: 90, // (90 / 180) * 20 = 10 pts * 0.25 = 2.5
          customsStatus: 'in_progress',
        },
        fatigue: {
          continuousDriveMinutes: 135, // 10 pts * 0.15 = 1.5
        },
      });

      // Expected composite = 0 + 0 + 2.5 + 1.5 = 4.0
      expect(composite.compositeScore).toBeCloseTo(4.0, 1);
      expect(composite.overallSeverity).toBe('low');
      expect(composite.factors).toHaveLength(4);
    });
  });

  // Test 7: AI Copilot Recommendations Trilingual Parity
  describe('Contextual AI Copilot Recommendations', () => {
    it('generates trilingual recommendations with appropriate actionType for elevated factors', () => {
      const factors = [
        {
          category: 'cold_chain' as const,
          score: 85,
          weight: 0.35,
          weightedScore: 29.75,
          severity: 'critical' as const,
          titleAr: 'سلسلة التبريد',
          titleFr: 'Chaîne Froid',
          titleEs: 'Cadena Frío',
          descriptionAr: 'انحراف حراري',
          descriptionFr: 'Écart thermique',
          descriptionEs: 'Desviación térmica',
          metrics: { value: 6.5, target: 4.0 },
        },
        {
          category: 'driver_fatigue' as const,
          score: 65,
          weight: 0.15,
          weightedScore: 9.75,
          severity: 'high' as const,
          titleAr: 'إجهاد السائق',
          titleFr: 'Fatigue',
          titleEs: 'Fatiga',
          descriptionAr: 'ساعات متواصلة',
          descriptionFr: 'Conduite continue',
          descriptionEs: 'Horas continuas',
          metrics: { value: 260, target: 270 },
        },
      ];

      const recommendations = generateCopilotRecommendations(502, factors);

      expect(recommendations).toHaveLength(2);

      // Cold Chain critical recommendation
      const coldRec = recommendations.find((r) => r.category === 'cold_chain');
      expect(coldRec).toBeDefined();
      expect(coldRec?.actionType).toBe('emergency_dispatch');
      expect(coldRec?.titleAr).toContain('طوارئ');
      expect(coldRec?.titleFr).toContain('urgence');
      expect(coldRec?.titleEs).toContain('emergencia');

      // Driver fatigue recommendation
      const fatigueRec = recommendations.find((r) => r.category === 'driver_fatigue');
      expect(fatigueRec).toBeDefined();
      expect(fatigueRec?.actionType).toBe('driver_rest_alert');
      expect(fatigueRec?.recommendationAr).toContain('WhatsApp');
      expect(fatigueRec?.recommendationFr).toContain('WhatsApp');
      expect(fatigueRec?.recommendationEs).toContain('WhatsApp');
    });
  });

  // Test 8: Fleet Insights Aggregator
  describe('Fleet Copilot Insights Aggregation', () => {
    it('aggregates fleet-wide assessments and detects critical bottlenecks', () => {
      const trip1 = assessTripRisk({
        tripId: 1,
        truckId: 101,
        truckPlate: '10101-A-40',
        driverName: 'السائق 1',
        corridor: 'african_overland',
        coldChain: { currentTemp: -18, targetTemp: -18 },
        fuel: { actualConsumptionRate: 36, expectedNormRate: 36 },
        border: { currentWaitMinutes: 60 },
        fatigue: { continuousDriveMinutes: 120 },
      });

      const trip2 = assessTripRisk({
        tripId: 2,
        truckId: 102,
        truckPlate: '20202-B-40',
        driverName: 'السائق 2',
        corridor: 'african_overland',
        coldChain: { currentTemp: 8, targetTemp: 4, driftDurationMinutes: 70, doorOpen: true },
        fuel: { actualConsumptionRate: 48, expectedNormRate: 36, idleMinutes: 80 },
        border: { currentWaitMinutes: 320, customsStatus: 'delayed' },
        fatigue: { continuousDriveMinutes: 300 },
      });

      const insight = aggregateFleetCopilotInsights([trip1, trip2]);

      expect(insight.totalTripsEvaluated).toBe(2);
      expect(insight.criticalTripsCount).toBeGreaterThanOrEqual(1);
      expect(insight.averageFleetRiskScore).toBeGreaterThan(0);
      expect(insight.topCriticalTrips).toHaveLength(2);
      expect(insight.topCriticalTrips[0].tripId).toBe(2); // Higher risk trip first
    });

    it('handles empty assessments array gracefully', () => {
      const insight = aggregateFleetCopilotInsights([]);

      expect(insight.totalTripsEvaluated).toBe(0);
      expect(insight.averageFleetRiskScore).toBe(0);
      expect(insight.overallFleetStatus).toBe('low');
      expect(insight.topCriticalTrips).toHaveLength(0);
    });
  });
});
