import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { RefrigerantDiagnosticsService } from '../services/refrigerant-diagnostics.service';
import {
  recordCircuitDiagnosticsSchema,
  resolveLeakIncidentSchema,
} from '../types/refrigerant-radar.types';
import type {
  ReeferCircuitDiagnosticsLog,
  ReeferPredictiveLeakIncident,
} from '../types/refrigerant-radar.types';

describe('Reefer Refrigerant Leak & TXV Predictive Radar Engine (EN 12830 / ISO 14903)', () => {
  describe('1. Thermodynamic Parameter Calculations (Decimal.js)', () => {
    it('calculates Superheat (°C) accurately as Suction Line Temp minus Evaporator Temp', () => {
      const sh = RefrigerantDiagnosticsService.calculateSuperheat(-9.5, -18.0);
      expect(sh).toBe(8.5); // -9.5 - (-18) = 8.5°C

      const shWarm = RefrigerantDiagnosticsService.calculateSuperheat(4.2, 0.0);
      expect(shWarm).toBe(4.2);
    });

    it('calculates Subcooling (°C) accurately as Condenser Temp minus Liquid Line Temp', () => {
      const sc = RefrigerantDiagnosticsService.calculateSubcooling(38.0, 32.5);
      expect(sc).toBe(5.5); // 38 - 32.5 = 5.5°C
    });

    it('calculates Compression Ratio with atmospheric offset (1.013 bar)', () => {
      // (15.2 + 1.013) / (1.85 + 1.013) = 16.213 / 2.863 = 5.66
      const cr = RefrigerantDiagnosticsService.calculateCompressionRatio(15.2, 1.85);
      expect(cr).toBeGreaterThan(5.6);
      expect(cr).toBeLessThan(5.7);
    });
  });

  describe('2. Normal Operation Thermodynamic Envelope', () => {
    it('identifies healthy R452A circuit and marks no anomaly', () => {
      const evaluation = RefrigerantDiagnosticsService.evaluateCircuitHealth({
        refrigerantType: 'R452A',
        suctionPressureBar: 1.85,
        dischargePressureBar: 15.2,
        evaporatorTempC: -18.0,
        suctionLineTempC: -10.0, // Superheat = 8.0°C (optimal)
        condenserTempC: 38.0,
        liquidLineTempC: 32.0, // Subcooling = 6.0°C (optimal)
      });

      expect(evaluation.isAnomaly).toBe(false);
      expect(evaluation.incidentType).toBe('normal');
      expect(evaluation.severity).toBe('info');
      expect(evaluation.riskScore).toBeLessThanOrEqual(20);
      expect(evaluation.superheatC).toBe(8.0);
      expect(evaluation.subcoolingC).toBe(6.0);
    });
  });

  describe('3. Micro-Leakage Detection Logic', () => {
    it('detects progressive refrigerant micro-leak when suction is starved and superheat is excessive', () => {
      const evaluation = RefrigerantDiagnosticsService.evaluateCircuitHealth({
        refrigerantType: 'R452A',
        suctionPressureBar: 0.95, // Low suction (< 1.2 bar for freezer)
        dischargePressureBar: 11.5,
        evaporatorTempC: -16.0,
        suctionLineTempC: 6.5, // Superheat = 22.5°C (> 18°C)
        condenserTempC: 32.0,
        liquidLineTempC: 30.5, // Subcooling = 1.5°C (< 3°C, loss of liquid seal)
      });

      expect(evaluation.isAnomaly).toBe(true);
      expect(evaluation.incidentType).toBe('micro_leakage');
      expect(evaluation.riskScore).toBeGreaterThanOrEqual(75);
      expect(evaluation.estimatedRefrigerantLossPct).toBeGreaterThan(15);
      expect(evaluation.description).toContain('micro-leakage detected');
    });

    it('escalates micro-leak to critical severity when estimated loss exceeds 30%', () => {
      const evaluation = RefrigerantDiagnosticsService.evaluateCircuitHealth({
        refrigerantType: 'R452A',
        suctionPressureBar: 0.65, // Severe drop
        dischargePressureBar: 10.0,
        evaporatorTempC: -15.0,
        suctionLineTempC: 13.0, // Superheat = 28°C
        condenserTempC: 30.0,
        liquidLineTempC: 29.5, // Subcooling = 0.5°C
      });

      expect(evaluation.isAnomaly).toBe(true);
      expect(evaluation.incidentType).toBe('micro_leakage');
      expect(evaluation.severity).toBe('critical');
      expect(evaluation.riskScore).toBeGreaterThanOrEqual(90);
    });
  });

  describe('4. Expansion Valve (TXV/EXV) Diagnostics', () => {
    it('detects TXV Starvation (valve stuck closed / orifice plugged)', () => {
      const evaluation = RefrigerantDiagnosticsService.evaluateCircuitHealth({
        refrigerantType: 'R452A',
        suctionPressureBar: 0.55, // Very low (< 0.8 bar)
        dischargePressureBar: 14.8,
        evaporatorTempC: -18.0,
        suctionLineTempC: 8.0, // Superheat = 26°C (> 22°C)
        condenserTempC: 40.0,
        liquidLineTempC: 32.0, // Subcooling = 8.0°C (normal/high, gas backed up in condenser)
      });

      expect(evaluation.isAnomaly).toBe(true);
      expect(evaluation.incidentType).toBe('txv_starvation_closed');
      expect(evaluation.severity).toBe('high');
      expect(evaluation.riskScore).toBe(82);
      expect(evaluation.description).toContain('starved');
    });

    it('detects TXV Flooding (valve stuck open / liquid floodback hazard)', () => {
      const evaluation = RefrigerantDiagnosticsService.evaluateCircuitHealth({
        refrigerantType: 'R452A',
        suctionPressureBar: 4.5,
        dischargePressureBar: 16.0,
        evaporatorTempC: -15.0,
        suctionLineTempC: -14.0, // Superheat = 1.0°C (< 2.0°C DANGER)
        condenserTempC: 40.0,
        liquidLineTempC: 34.0,
      });

      expect(evaluation.isAnomaly).toBe(true);
      expect(evaluation.incidentType).toBe('txv_flooding_open');
      expect(evaluation.severity).toBe('critical');
      expect(evaluation.riskScore).toBe(88);
      expect(evaluation.description).toContain('flooded');
    });
  });

  describe('5. Compressor Inefficiency Diagnostics', () => {
    it('detects compressor volumetric inefficiency with reed valve blow-by', () => {
      const evaluation = RefrigerantDiagnosticsService.evaluateCircuitHealth({
        refrigerantType: 'R452A',
        suctionPressureBar: 4.2, // High suction
        dischargePressureBar: 8.8, // Low discharge
        evaporatorTempC: -5.0,
        suctionLineTempC: 3.0,
        condenserTempC: 28.0,
        liquidLineTempC: 22.0,
      });

      expect(evaluation.isAnomaly).toBe(true);
      expect(evaluation.incidentType).toBe('compressor_inefficiency');
      expect(evaluation.severity).toBe('high');
      expect(evaluation.riskScore).toBe(76);
      expect(evaluation.description).toContain('volumetric inefficiency');
    });
  });

  describe('6. Fleet Radar Summary & Aggregation', () => {
    it('handles empty fleet gracefully with 100% health rate', () => {
      const summary = RefrigerantDiagnosticsService.calculateFleetSummary(0, [], []);
      expect(summary.totalMonitoredReefers).toBe(0);
      expect(summary.fleetThermodynamicHealthRate).toBe(100);
      expect(summary.averageFleetRefrigerantChargePct).toBe(100);
    });

    it('aggregates fleet statistics and calculates health rate with Decimal precision', () => {
      const mockLogs: ReeferCircuitDiagnosticsLog[] = [
        {
          id: '1',
          companyId: 1,
          trailerId: 101,
          refrigerantType: 'R452A',
          suctionPressureBar: 1.85,
          dischargePressureBar: 15.2,
          evaporatorTempC: -18,
          suctionLineTempC: -10,
          condenserTempC: 38,
          liquidLineTempC: 32,
          superheatC: 8,
          subcoolingC: 6,
          source: 'telematics',
          recordedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      const mockIncidents: ReeferPredictiveLeakIncident[] = [
        {
          id: 'inc-1',
          companyId: 1,
          trailerId: 102,
          refrigerantType: 'R452A',
          incidentType: 'micro_leakage',
          severity: 'high',
          riskScore: 78,
          estimatedRefrigerantLossPct: 20,
          description: 'Micro-leak',
          recommendedAction: 'Fix leak',
          isResolved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'inc-2',
          companyId: 1,
          trailerId: 103,
          refrigerantType: 'R452A',
          incidentType: 'txv_starvation_closed',
          severity: 'critical',
          riskScore: 85,
          estimatedRefrigerantLossPct: 0,
          description: 'TXV starved',
          recommendedAction: 'Replace TXV',
          isResolved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Total 4 trailers: 2 affected (102, 103), 2 healthy -> health rate = (2/4) * 100 = 50%
      const summary = RefrigerantDiagnosticsService.calculateFleetSummary(4, mockLogs, mockIncidents);

      expect(summary.totalMonitoredReefers).toBe(4);
      expect(summary.healthyCircuitsCount).toBe(2);
      expect(summary.activeLeakIncidentsCount).toBe(1);
      expect(summary.txvAnomaliesCount).toBe(1);
      expect(summary.criticalRiskTrailersCount).toBe(1);
      expect(summary.fleetThermodynamicHealthRate).toBe(50);
      // Average loss across 4 trailers = 20 / 4 = 5% -> average charge = 95%
      expect(summary.averageFleetRefrigerantChargePct).toBe(95);
    });
  });

  describe('7. Zod Schema Validations', () => {
    it('validates correct circuit diagnostic input', () => {
      const valid = {
        trailerId: 5,
        refrigerantType: 'R452A',
        suctionPressureBar: 1.85,
        dischargePressureBar: 15.2,
        evaporatorTempC: -18,
        suctionLineTempC: -9.5,
        condenserTempC: 38,
        liquidLineTempC: 32,
        source: 'manifold_gauge',
      };

      const parsed = recordCircuitDiagnosticsSchema.parse(valid);
      expect(parsed.trailerId).toBe(5);
      expect(parsed.refrigerantType).toBe('R452A');
      expect(parsed.suctionPressureBar).toBe(1.85);
    });

    it('rejects invalid or missing values', () => {
      const invalid = {
        trailerId: -1, // Invalid positive ID
        refrigerantType: 'UNKNOWN_GAS',
      };

      expect(() => recordCircuitDiagnosticsSchema.parse(invalid)).toThrow();
    });

    it('validates resolve incident schema', () => {
      const valid = {
        incidentId: '123e4567-e89b-12d3-a456-426614174000',
        notes: 'Repaired flare fitting and recharged R452A.',
      };

      const parsed = resolveLeakIncidentSchema.parse(valid);
      expect(parsed.incidentId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });
});
