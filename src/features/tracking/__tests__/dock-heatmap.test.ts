/**
 * Trans Bodanon TMS — Dock Thermal Heatmap & Excursion Risk Radar Unit Tests
 * Rigorous validation of DVI mathematical formulas (Decimal.js), risk clustering, and GDP compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { DockThermalRiskService } from '../services/dock-thermal-risk.service';
import {
  dockRiskQuerySchema,
  flagDockSchema,
} from '../types/dock-heatmap.types';

// Mock Supabase & Audit Log
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'usr-coldchain-auditor-2026', email: 'quality@transbodanon.com' } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn(async () => ({ success: true })),
}));

describe('Trans Bodanon TMS — Dock Thermal Heatmap & Excursion Risk Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Dock Vulnerability Index (DVI) Decimal Precision Formula', () => {
    it('computes Safe Dock profile accurately (DVI < 25)', () => {
      // term1: (0/10)*40 = 0
      // term2: (20/60)*30 = 10
      // term3: (0.5/5)*30 = 3
      // DVI = 13.0
      const res = DockThermalRiskService.calculateDviScore({
        excursionCount: 0,
        totalArrivals: 10,
        avgUnloadingMins: 20,
        peakDeviationC: 0.5,
      });

      expect(res.dviScore).toBe(13.0);
      expect(res.riskLevel).toBe('safe');
      expect(res.intensityWeight).toBe(0.13);
      expect(res.excursionFrequencyPercent).toBe(0);
    });

    it('computes Monitored Dock profile accurately (25 <= DVI < 60)', () => {
      // term1: (3/10)*40 = 12
      // term2: (35/60)*30 = 17.5
      // term3: (2.0/5)*30 = 12
      // DVI = 41.5
      const res = DockThermalRiskService.calculateDviScore({
        excursionCount: 3,
        totalArrivals: 10,
        avgUnloadingMins: 35,
        peakDeviationC: 2.0,
      });

      expect(res.dviScore).toBe(41.5);
      expect(res.riskLevel).toBe('monitored');
      expect(res.intensityWeight).toBe(0.415);
      expect(res.excursionFrequencyPercent).toBe(30.0);
    });

    it('computes Critical Hotspot Dock accurately (DVI >= 60)', () => {
      // term1: (7/10)*40 = 28
      // term2: (60/60)*30 = 30
      // term3: (4.5/5)*30 = 27
      // DVI = 85.0
      const res = DockThermalRiskService.calculateDviScore({
        excursionCount: 7,
        totalArrivals: 10,
        avgUnloadingMins: 60,
        peakDeviationC: 4.5,
      });

      expect(res.dviScore).toBe(85.0);
      expect(res.riskLevel).toBe('critical');
      expect(res.intensityWeight).toBe(0.85);
      expect(res.excursionFrequencyPercent).toBe(70.0);
    });

    it('clamps extreme values to a maximum DVI score of 100.00', () => {
      const res = DockThermalRiskService.calculateDviScore({
        excursionCount: 50,
        totalArrivals: 20,
        avgUnloadingMins: 180,
        peakDeviationC: 15.0,
      });

      expect(res.dviScore).toBe(100.0);
      expect(res.riskLevel).toBe('critical');
      expect(res.intensityWeight).toBe(1.0);
    });
  });

  describe('2. Proactive Operational Protocols & Compartment Impact Analysis', () => {
    it('generates mandatory continuous cooling and solar avoidance protocols for critical docks', () => {
      const protocols = DockThermalRiskService.generateOperationalProtocols('critical', 78, 4.8);
      expect(protocols).toContain('dockRisk.protocols.continuousCooling');
      expect(protocols).toContain('dockRisk.protocols.avoidPeakHours');
      expect(protocols).toContain('dockRisk.protocols.deployBulkheadCurtain');
      expect(protocols).toContain('dockRisk.protocols.preCoolInspectionMandatory');
    });

    it('generates inflatable seal and duration monitoring protocols for monitored docks', () => {
      const protocols = DockThermalRiskService.generateOperationalProtocols('monitored', 42, 2.1);
      expect(protocols).toContain('dockRisk.protocols.verifyInflatableSeal');
      expect(protocols).toContain('dockRisk.protocols.limitDoorOpenIntervals');
      expect(protocols).toContain('dockRisk.protocols.monitorExcursionTimer');
    });

    it('evaluates multi-temp compartment impacts for C1, C2, and C3', () => {
      const impacts = DockThermalRiskService.evaluateCompartmentImpacts(3.5, 2.8);
      expect(impacts).toHaveLength(3);

      const c1 = impacts.find((c) => c.compartment === 'C1');
      expect(c1).toBeDefined();
      expect(c1?.setpointTempC).toBe(-20.0);
      expect(c1?.riskProbability).toBe('high');

      const c2 = impacts.find((c) => c.compartment === 'C2');
      expect(c2).toBeDefined();
      expect(c2?.setpointTempC).toBe(3.0);

      const c3 = impacts.find((c) => c.compartment === 'C3');
      expect(c3).toBeDefined();
      expect(c3?.setpointTempC).toBe(12.0);
    });
  });

  describe('3. Dock Arrivals Clustering & Aggregation Engine', () => {
    it('clusters raw arrivals and sorts docks by descending DVI vulnerability', () => {
      const mockArrivals = [
        {
          dockId: 'DOCK-MAD-04',
          dockName: 'Mercamadrid Hall 4 Frigo',
          status: 'breached',
          unloadingDurationMins: 55,
          setpointTempC: -20,
          actualTempC: -15, // +5°C spike
        },
        {
          dockId: 'DOCK-TMED-01',
          dockName: 'Tanger Med Frigo Dock 1',
          status: 'compliant',
          unloadingDurationMins: 20,
          setpointTempC: 3,
          actualTempC: 3.2,
        },
      ];

      const { clusters, summary } = DockThermalRiskService.clusterDockArrivals(mockArrivals);
      expect(clusters.length).toBeGreaterThanOrEqual(2);
      expect(summary.totalDocksAnalyzed).toBe(clusters.length);

      // Verify descending DVI sort order
      for (let i = 1; i < clusters.length; i++) {
        expect(clusters[i - 1].metrics.dviScore).toBeGreaterThanOrEqual(clusters[i].metrics.dviScore);
      }

      // Check worst dock in summary
      expect(summary.worstDviDock).toBeDefined();
      expect(summary.coldChainPreservationPercent).toBeGreaterThan(0);
    });

    it('applies watch status overrides (blacklisted / monitored)', () => {
      const mockArrivals = [
        {
          dockId: 'DOCK-CUSTOM-01',
          dockName: 'Custom Hub',
          status: 'compliant',
          unloadingDurationMins: 25,
        },
      ];

      const overrides = {
        'DOCK-CUSTOM-01': {
          status: 'blacklisted' as const,
          reason: 'Severe recurring reefer door sealing gap',
        },
      };

      const { clusters } = DockThermalRiskService.clusterDockArrivals(mockArrivals, overrides);
      const target = clusters.find((c) => c.dockId === 'DOCK-CUSTOM-01');
      expect(target).toBeDefined();
      expect(target?.watchStatus).toBe('blacklisted');
      expect(target?.flaggedReason).toBe('Severe recurring reefer door sealing gap');
    });
  });

  describe('4. Zod Schema Validation & Input Guardrails', () => {
    it('validates correct dock risk query parameters', () => {
      const valid = dockRiskQuerySchema.safeParse({
        minDvi: 50,
        riskLevel: 'critical',
        countryCode: 'ES',
        search: 'Mercamadrid',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects invalid DVI bounds in query schema', () => {
      const invalid = dockRiskQuerySchema.safeParse({
        minDvi: 150, // exceeds 100
      });
      expect(invalid.success).toBe(false);
    });

    it('validates flag dock input with required reason', () => {
      const valid = flagDockSchema.safeParse({
        dockId: 'DOCK-RUNGIS-02',
        watchStatus: 'monitored',
        reason: 'Increased unloading delay observed in summer months',
      });
      expect(valid.success).toBe(true);

      const invalid = flagDockSchema.safeParse({
        dockId: 'DOCK-RUNGIS-02',
        watchStatus: 'monitored',
        reason: 'a', // too short (<3 chars)
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('5. Server Actions Integration', () => {
    it('fetches clusters with fallback strategic hubs successfully', async () => {
      const { fetchDockRiskClustersAction } = await import('../services/dock-risk.actions');
      const res = await fetchDockRiskClustersAction({ riskLevel: 'all' });

      expect(res.success).toBe(true);
      expect(res.clusters.length).toBeGreaterThan(0);
      expect(res.summary.totalDocksAnalyzed).toBeGreaterThan(0);
    });

    it('updates dock watch status via flagHighRiskDockAction', async () => {
      const { flagHighRiskDockAction } = await import('../services/dock-risk.actions');
      const res = await flagHighRiskDockAction({
        dockId: 'DOCK-MAD-04',
        watchStatus: 'monitored',
        reason: 'Quality control alert on dock door seals',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('DOCK-MAD-04');
    });
  });
});

