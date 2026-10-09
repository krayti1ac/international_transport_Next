import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  STANDARD_DTC_CATALOG,
  HOURLY_LABOR_RATE_MAD,
  lookupDtcProfile,
  calculateHealthIndex,
  calculateBreakdownRisk,
  calculateFinancialImpact,
  buildFleetHealthSummary,
} from '../services/predictive-maintenance-radar.service';
import type {
  FleetObdDiagnosticEvent,
  PredictiveMaintenanceRecommendation,
} from '../types/obd-diagnostic.types';

describe('Predictive Fleet Maintenance & OBD-II Diagnostic Radar', () => {
  describe('DTC Standard Catalog & Lookup', () => {
    it('should have standard heavy-duty diagnostic DTC profiles registered', () => {
      expect(STANDARD_DTC_CATALOG['P0299']).toBeDefined();
      expect(STANDARD_DTC_CATALOG['P20EE']).toBeDefined();
      expect(STANDARD_DTC_CATALOG['P0217']).toBeDefined();
      expect(STANDARD_DTC_CATALOG['C1095']).toBeDefined();
      expect(STANDARD_DTC_CATALOG['U0100']).toBeDefined();
      expect(STANDARD_DTC_CATALOG['P0524']).toBeDefined();
    });

    it('should correctly lookup and retrieve known DTC codes', () => {
      const turboBoost = lookupDtcProfile('p0299');
      expect(turboBoost.code).toBe('P0299');
      expect(turboBoost.category).toBe('powertrain');
      expect(turboBoost.severity).toBe('moderate');
      expect(turboBoost.urgency).toBe('within_24h');
      expect(turboBoost.required_spare_parts.length).toBeGreaterThan(0);

      const scrNox = lookupDtcProfile('P20EE');
      expect(scrNox.category).toBe('powertrain');
      expect(scrNox.severity).toBe('critical');
    });

    it('should gracefully fallback for uncatalogued SAE DTC codes by prefix', () => {
      const genericPowertrain = lookupDtcProfile('P0300');
      expect(genericPowertrain.category).toBe('powertrain');
      expect(genericPowertrain.severity).toBe('moderate');

      const genericChassis = lookupDtcProfile('C0550');
      expect(genericChassis.category).toBe('chassis');

      const genericNetwork = lookupDtcProfile('U0401');
      expect(genericNetwork.category).toBe('network');
      expect(genericNetwork.severity).toBe('minor');
    });
  });

  describe('Predictive Health Index (0 - 100)', () => {
    it('should return 100.00 for trucks with zero active faults', () => {
      const health = calculateHealthIndex([]);
      expect(health).toBe('100.00');
    });

    it('should deduct points according to DTC severity levels', () => {
      // 1 critical (-35) + 1 moderate (-15) = 50.00
      const health = calculateHealthIndex([
        { severity: 'critical', dtc_code: 'P0217' },
        { severity: 'moderate', dtc_code: 'P0299' },
      ]);
      expect(health).toBe('50.00');
    });

    it('should apply extra penalties for dangerous freeze-frame conditions', () => {
      // 1 moderate fault: 100 - 15 = 85.00
      // Coolant temp 109°C (> 107): -25.00 => 60.00
      // Low oil pressure 110 kPa (< 120): -25.00 => 35.00
      // Low battery 22.8V (< 23.5): -8.00 => 27.00
      const health = calculateHealthIndex(
        [{ severity: 'moderate', dtc_code: 'P0299' }],
        {
          coolant_temp_c: 109,
          oil_pressure_kpa: 110,
          battery_voltage: 22.8,
        }
      );
      expect(health).toBe('27.00');
    });

    it('should strictly clamp health score between 0.00 and 100.00', () => {
      const multipleCritical = calculateHealthIndex([
        { severity: 'critical', dtc_code: 'P0217' },
        { severity: 'critical', dtc_code: 'P0524' },
        { severity: 'critical', dtc_code: 'C1095' },
        { severity: 'critical', dtc_code: 'P20EE' },
      ]);
      expect(multipleCritical).toBe('0.00');
    });
  });

  describe('Breakdown Risk Probability (%)', () => {
    it('should return 0.00% risk for 100.00 health score on domestic routes', () => {
      const risk = calculateBreakdownRisk('100.00', false, 'DOMESTIC');
      expect(risk).toBe('0.00');
    });

    it('should boost breakdown risk to at least 85.00% for immediate stop faults', () => {
      // Health 80 normally gives 20 * 1.15 = 23%
      const risk = calculateBreakdownRisk('80.00', true, 'DOMESTIC');
      expect(risk).toBe('85.00');
    });

    it('should scale risk with international corridor multipliers', () => {
      // Health 50: deficit 50 * 1.15 = 57.50%
      const domesticRisk = calculateBreakdownRisk('50.00', false, 'DOMESTIC');
      expect(domesticRisk).toBe('57.50');

      // European Corridor: 57.50 * 1.10 = 63.25%
      const euRisk = calculateBreakdownRisk('50.00', false, 'MA-ES-FR');
      expect(euRisk).toBe('63.25');

      // Sahara Corridor: 57.50 * 1.25 = 71.88%
      const saharaRisk = calculateBreakdownRisk('50.00', false, 'MA-MR-SN');
      expect(saharaRisk).toBe('71.88');
    });
  });

  describe('Financial Calculations (Decimal.js)', () => {
    it('should accurately calculate proactive cost, breakdown cost and net savings', () => {
      // Parts: 2500 MAD, Labor: 3 hours * 350 = 1050 MAD => Proactive = 3550.00 MAD
      // Catalog Breakdown: 14500 MAD on DOMESTIC (multiplier 1.0) => 14500.00 MAD
      // Net Savings = 14500.00 - 3550.00 = 10950.00 MAD
      const fin = calculateFinancialImpact('2500.00', '3.0', '14500.00', 'DOMESTIC');
      expect(fin.estimated_proactive_cost_mad).toBe('3550.00');
      expect(fin.estimated_breakdown_cost_mad).toBe('14500.00');
      expect(fin.estimated_savings_mad).toBe('10950.00');
    });

    it('should apply European corridor recovery multiplier of 1.35x', () => {
      // Catalog Breakdown: 20000 MAD * 1.35 = 27000.00 MAD
      // Proactive: 5000 + (2 * 350) = 5700.00 MAD
      // Savings = 27000.00 - 5700.00 = 21300.00 MAD
      const fin = calculateFinancialImpact('5000.00', '2.0', '20000.00', 'MA-ES-FR');
      expect(fin.estimated_breakdown_cost_mad).toBe('27000.00');
      expect(fin.estimated_savings_mad).toBe('21300.00');
    });
  });

  describe('Fleet Health Summary Aggregation', () => {
    it('should aggregate fleet metrics and isolate high risk trucks correctly', () => {
      const mockTrucks = [
        { id: 1, plate_number: '12345-A-1', model: 'Volvo FH16' },
        { id: 2, plate_number: '67890-B-26', model: 'Scania R500' },
        { id: 3, plate_number: '11223-D-50', model: 'Mercedes Actros' },
      ];

      const mockEvents: FleetObdDiagnosticEvent[] = [
        {
          id: 'evt-1',
          company_id: 1,
          truck_id: 1,
          dtc_code: 'P0217',
          dtc_standard: 'SAE_J1939',
          category: 'powertrain',
          severity: 'critical',
          description: 'Engine Overheating',
          mil_status: true,
          freeze_frame_data: { coolant_temp_c: 108 },
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'evt-2',
          company_id: 1,
          truck_id: 2,
          dtc_code: 'P0101',
          dtc_standard: 'SAE_J2012',
          category: 'powertrain',
          severity: 'minor',
          description: 'MAF Sensor Range',
          mil_status: false,
          freeze_frame_data: {},
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockRecs: PredictiveMaintenanceRecommendation[] = [
        {
          id: 'rec-1',
          company_id: 1,
          truck_id: 1,
          urgency: 'immediate_stop',
          health_index_score: '40.00',
          breakdown_risk_probability: '85.00',
          recommended_action: 'Replace Water Pump',
          required_spare_parts: [],
          estimated_labor_hours: '5.0',
          estimated_cost_mad: '3800.00',
          estimated_breakdown_cost_mad: '52000.00',
          estimated_savings_mad: '48200.00',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const summary = buildFleetHealthSummary(mockTrucks, mockEvents, mockRecs);

      expect(summary.total_trucks_scanned).toBe(3);
      expect(summary.critical_faults_count).toBe(1);
      expect(summary.minor_faults_count).toBe(1);
      expect(summary.total_projected_proactive_cost_mad).toBe('3800.00');
      expect(summary.total_projected_breakdown_cost_mad).toBe('52000.00');
      expect(summary.total_net_savings_mad).toBe('48200.00');
      expect(summary.high_risk_trucks.length).toBeGreaterThan(0);
      expect(summary.high_risk_trucks[0].truck_id).toBe(1);
    });
  });
});

