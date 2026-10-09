import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  evaluateTpmsReading,
  getCorridorWearMultiplier,
  calculateTireWearMetrics,
  evaluateDualTirePair,
  buildFleetTireSummary,
  LEGAL_MIN_TREAD_DEPTH_MM,
  SAFETY_THRESHOLD_TREAD_DEPTH_MM,
  DUAL_PAIR_MAX_DELTA_MM,
} from '../services/tire-lifecycle.service';
import type { FleetTire } from '../types/tire-fleet.types';

describe('Tire Fleet Management & Tread Wear Telematics Engine', () => {
  describe('TPMS Sensor Telematics Evaluator', () => {
    it('should return normal flag for optimal pressure and safe temperature', () => {
      const flags = evaluateTpmsReading('8.80', '52.0');
      expect(flags).toContain('normal');
      expect(flags.length).toBe(1);
    });

    it('should detect low pressure warning under 7.65 bar', () => {
      const flags = evaluateTpmsReading('7.40', '60.0');
      expect(flags).toContain('low_pressure');
    });

    it('should trigger critical low pressure alert below 6.80 bar', () => {
      const flags = evaluateTpmsReading('6.50', '65.0');
      expect(flags).toContain('critical_low_pressure');
    });

    it('should trigger high pressure warning above 10.20 bar', () => {
      const flags = evaluateTpmsReading('10.50', '70.0');
      expect(flags).toContain('high_pressure');
    });

    it('should detect thermal overheating above 85°C', () => {
      const flags = evaluateTpmsReading('8.60', '92.5');
      expect(flags).toContain('overheating');
    });

    it('should detect simultaneous critical low pressure and overheating', () => {
      const flags = evaluateTpmsReading('6.20', '89.0');
      expect(flags).toContain('critical_low_pressure');
      expect(flags).toContain('overheating');
    });
  });

  describe('Corridor Wear Multiplier', () => {
    it('should return 1.40x multiplier for West African Sahara Corridor (MA-MR-SN)', () => {
      const factor = getCorridorWearMultiplier('MA-MR-SN');
      expect(factor.toFixed(2)).toBe('1.40');
    });

    it('should return 1.00x multiplier for European Overland Corridor (MA-ES-FR)', () => {
      const factor = getCorridorWearMultiplier('MA-ES-FR');
      expect(factor.toFixed(2)).toBe('1.00');
    });

    it('should return 1.10x multiplier for Domestic Moroccan routes', () => {
      const factor = getCorridorWearMultiplier('DOMESTIC');
      expect(factor.toFixed(2)).toBe('1.10');
    });
  });

  describe('Tread Wear Metrics & Lifetime CPK Calculator', () => {
    it('should evaluate brand new tire with initial 16.0mm depth', () => {
      const metrics = calculateTireWearMetrics('16.00', '16.00', 0, 0, '4500.00');
      expect(metrics.health_condition).toBe('optimal');
      expect(metrics.worn_depth_mm).toBe('0.00');
      expect(metrics.remaining_usable_depth_mm).toBe('14.40');
      expect(metrics.rotation_recommended).toBe(false);
    });

    it('should compute wear rate and projected lifetime kilometers with Decimal.js', () => {
      // Initial: 16.0mm, Current: 10.0mm (worn 6.0mm in 60,000 km)
      // Wear Rate = (6.0 / 60,000) * 10,000 = 1.00 mm / 10k km
      // Usable remaining = 10.0 - 1.6 = 8.40mm
      // Projected remaining = (8.40 / 1.00) * 10,000 = 84,000 km (European corridor)
      // Total lifetime = 60,000 + 84,000 = 144,000 km
      // CPK = 4500 / 144,000 = 0.0313 MAD/km
      const metrics = calculateTireWearMetrics('16.00', '10.00', 0, 60000, '4500.00', 'MA-ES-FR');
      expect(metrics.worn_depth_mm).toBe('6.00');
      expect(metrics.wear_rate_mm_per_10k_km).toBe('1.00');
      expect(metrics.remaining_usable_depth_mm).toBe('8.40');
      expect(metrics.projected_remaining_km).toBe(84000);
      expect(metrics.tire_cpk_mad).toBe('0.0313');
      expect(metrics.health_condition).toBe('good');
    });

    it('should accelerate wear rate and reduce remaining km in Sahara corridor', () => {
      // In Sahara: effective wear rate is 1.00 * 1.40 = 1.40 mm / 10k km
      // Projected remaining = (8.40 / 1.40) * 10,000 = 60,000 km
      const metrics = calculateTireWearMetrics('16.00', '10.00', 0, 60000, '4500.00', 'MA-MR-SN');
      expect(metrics.projected_remaining_km).toBe(60000);
    });

    it('should flag legal limit and critical threshold conditions', () => {
      const criticalTire = calculateTireWearMetrics('16.00', '2.50', 0, 120000, '4500.00');
      expect(criticalTire.health_condition).toBe('critical');

      const illegalTire = calculateTireWearMetrics('16.00', '1.40', 0, 140000, '4500.00');
      expect(illegalTire.health_condition).toBe('legal_limit');
      expect(illegalTire.remaining_usable_depth_mm).toBe('0.00');
    });

    it('should recommend rotation when wear exceeds 45%', () => {
      // 16.0 -> 8.0 = 50% wear
      const metrics = calculateTireWearMetrics('16.00', '8.00', 0, 75000, '4500.00');
      expect(metrics.rotation_recommended).toBe(true);
      expect(metrics.rotation_reason).toBeDefined();
    });
  });

  describe('Dual Tire Pair Evaluation (Drive Axle Pairing)', () => {
    it('should accept balanced dual tire pair within 2.0mm tolerance', () => {
      const mockOuter: Partial<FleetTire> = { current_tread_depth_mm: '11.50' };
      const mockInner: Partial<FleetTire> = { current_tread_depth_mm: '11.00' };

      const result = evaluateDualTirePair(
        'Axle 2 Left',
        '2LO',
        '2LI',
        mockOuter as FleetTire,
        mockInner as FleetTire
      );

      expect(result.depth_delta_mm).toBe('0.50');
      expect(result.is_mismatched).toBe(false);
    });

    it('should flag mismatched dual tires exceeding 2.0mm delta with trilingual alerts', () => {
      const mockOuter: Partial<FleetTire> = { current_tread_depth_mm: '12.00' };
      const mockInner: Partial<FleetTire> = { current_tread_depth_mm: '9.20' };

      const result = evaluateDualTirePair(
        'Axle 2 Right',
        '2RO',
        '2RI',
        mockOuter as FleetTire,
        mockInner as FleetTire
      );

      expect(result.depth_delta_mm).toBe('2.80');
      expect(result.is_mismatched).toBe(true);
      expect(result.warning_message_ar).toBeDefined();
      expect(result.warning_message_fr).toBeDefined();
      expect(result.warning_message_es).toBeDefined();
    });
  });

  describe('Fleet Tire Summary Aggregation', () => {
    it('should correctly aggregate fleet-wide metrics', () => {
      const mockTires: Partial<FleetTire>[] = [
        {
          id: 't-1',
          status: 'mounted',
          current_tread_depth_mm: '12.00',
          metrics: { tire_cpk_mad: '0.0250' } as any,
          latest_telematics: { alert_flags: ['normal'] } as any,
        },
        {
          id: 't-2',
          status: 'mounted',
          current_tread_depth_mm: '2.80', // below safety (3.0mm)
          metrics: { tire_cpk_mad: '0.0280' } as any,
          latest_telematics: { alert_flags: ['low_pressure'] } as any,
        },
        {
          id: 't-3',
          status: 'mounted',
          current_tread_depth_mm: '1.40', // at legal limit (1.6mm)
          metrics: { tire_cpk_mad: '0.0300' } as any,
          latest_telematics: { alert_flags: ['critical_low_pressure', 'overheating'] } as any,
        },
        {
          id: 't-4',
          status: 'in_stock', // inactive
          current_tread_depth_mm: '16.00',
        },
      ];

      const summary = buildFleetTireSummary(mockTires as FleetTire[]);

      expect(summary.total_tires_active).toBe(3);
      // Average depth: (12.00 + 2.80 + 1.40) / 3 = 16.20 / 3 = 5.40mm
      expect(summary.average_tread_depth_mm).toBe('5.40');
      expect(summary.tires_below_safety_threshold).toBe(1);
      expect(summary.tires_at_legal_limit).toBe(1);
      expect(summary.active_tpms_alerts_count).toBe(2);
      // 2 tires require replacement budget: 2 * 4600.00 = 9200.00 MAD
      expect(summary.total_projected_tire_replacement_budget_mad).toBe('9200.00');
    });
  });
});
