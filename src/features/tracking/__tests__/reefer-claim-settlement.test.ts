/**
 * Trans Bodanon TMS — Reefer Cargo Loss & Insurance Claim Settlement Unit Tests
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { CargoLossAssessmentService } from '../services/cargo-loss-assessment.service';
import {
  calculateCargoLossEstimateAction,
  createInsuranceClaimAction,
  fetchReeferClaimsAction,
  updateClaimStatusAction,
} from '../services/reefer-claim.actions';
import {
  calculateDepreciationSchema,
  createInsuranceClaimSchema,
  updateClaimStatusSchema,
} from '../types/reefer-claim-settlement.types';

// Mock Supabase server and audit log
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })
  ),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Trans Bodanon TMS — Reefer Cargo Loss & Insurance Claim Settlement Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Cargo Depreciation Mathematical Engine (Decimal.js)', () => {
    it('declares 100% total loss on GDP Pharma when severe excursion occurs (duration >= 120m or delta >= 5°C)', () => {
      const res = CargoLossAssessmentService.calculateDepreciation({
        cargoCategory: 'pharma_cold',
        durationMinutes: 135,
        tempRiseDeltaC: 5.2,
        maxAllowedTempC: 8.0,
        tempAtCloseC: 13.2,
        mktElevationC: 1.4,
        insuredCargoValue: 500000.0,
        deductibleAmount: 10000.0,
      });

      expect(res.isTotalLoss).toBe(true);
      expect(res.depreciationRatePct).toBe(100);
      expect(res.grossLossAmount).toBe(500000.0);
      expect(res.netIndemnityAmount).toBe(490000.0); // 500k - 10k deductible
      expect(res.explanation).toContain('Total Loss 100%');
    });

    it('calculates zero loss on GDP Pharma when temperature remains within threshold', () => {
      const res = CargoLossAssessmentService.calculateDepreciation({
        cargoCategory: 'pharma_cold',
        durationMinutes: 10,
        tempRiseDeltaC: 0.8,
        maxAllowedTempC: 8.0,
        tempAtCloseC: 4.5,
        insuredCargoValue: 200000.0,
        deductibleAmount: 5000.0,
      });

      expect(res.depreciationRatePct).toBe(0);
      expect(res.grossLossAmount).toBe(0);
      expect(res.netIndemnityAmount).toBe(0);
    });

    it('calculates Deep Frozen seafood depreciation with thaw recrystallization penalty', () => {
      const res = CargoLossAssessmentService.calculateDepreciation({
        cargoCategory: 'deep_frozen',
        durationMinutes: 45,
        tempRiseDeltaC: 4.0,
        maxAllowedTempC: -18.0,
        tempAtCloseC: -8.0, // Above -10.0°C critical thaw threshold
        insuredCargoValue: 100000.0,
        deductibleAmount: 5000.0,
      });

      // Base: (4/8 * 40%) + (45/180 * 60%) = 20% + 15% = 35%
      // Thaw penalty: +25% = 60%
      expect(res.depreciationRatePct).toBe(60.0);
      expect(res.grossLossAmount).toBe(60000.0);
      expect(res.netIndemnityAmount).toBe(55000.0); // 60k - 5k
      expect(res.explanation).toContain('Frozen Thaw Hazard');
    });

    it('calculates Fresh Produce depreciation proportionally', () => {
      const res = CargoLossAssessmentService.calculateDepreciation({
        cargoCategory: 'fresh_produce',
        durationMinutes: 30,
        tempRiseDeltaC: 3.0,
        maxAllowedTempC: 6.0,
        tempAtCloseC: 5.5, // within max
        insuredCargoValue: 80000.0,
        deductibleAmount: 5000.0,
      });

      // (3/6 * 50%) + (30/120 * 50%) = 25% + 12.5% = 37.5%
      expect(res.depreciationRatePct).toBe(37.5);
      expect(res.grossLossAmount).toBe(30000.0); // 80,000 * 37.5% = 30,000
      expect(res.netIndemnityAmount).toBe(25000.0); // 30,000 - 5,000
    });

    it('caps net indemnity at 0 when gross loss is less than insurance deductible', () => {
      const res = CargoLossAssessmentService.calculateDepreciation({
        cargoCategory: 'fresh_produce',
        durationMinutes: 6,
        tempRiseDeltaC: 0.6,
        maxAllowedTempC: 6.0,
        tempAtCloseC: 4.0,
        insuredCargoValue: 20000.0,
        deductibleAmount: 5000.0,
      });

      // Minor loss less than 5,000 MAD deductible
      expect(res.grossLossAmount).toBeLessThan(5000.0);
      expect(res.netIndemnityAmount).toBe(0.0);
    });

    it('triggers bacterial safety cap of at least 50% for Chilled Meat exceeding 8.0°C', () => {
      const res = CargoLossAssessmentService.calculateDepreciation({
        cargoCategory: 'meat_chilled',
        durationMinutes: 15,
        tempRiseDeltaC: 4.5,
        maxAllowedTempC: 4.0,
        tempAtCloseC: 9.2, // Exceeds 8.0°C safety cap
        insuredCargoValue: 120000.0,
        deductibleAmount: 5000.0,
      });

      expect(res.depreciationRatePct).toBeGreaterThanOrEqual(50.0);
      expect(res.explanation).toContain('Microbial Growth Danger');
    });
  });

  describe('2. HMAC-SHA256 Cryptographic Seal Validation', () => {
    it('generates a valid 64-character hexadecimal signature', () => {
      const seal = CargoLossAssessmentService.generateClaimDossierSeal({
        claimReference: 'CLM-2026-8840-A1',
        tripId: 8840,
        cargoCategory: 'fresh_produce',
        insuredCargoValue: 145000.0,
        depreciationRatePct: 42.5,
        grossLossAmount: 61625.0,
        netIndemnityAmount: 56625.0,
        policyNumber: 'POL-FRIGO-2026-TANGIER',
        timestamp: '2026-10-10T12:00:00.000Z',
      });

      expect(typeof seal).toBe('string');
      expect(seal).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(seal)).toBe(true);
    });

    it('is deterministic for identical claim parameters', () => {
      const params = {
        claimReference: 'CLM-2026-8840-SAME',
        tripId: 8840,
        cargoCategory: 'fresh_produce',
        insuredCargoValue: 100000.0,
        depreciationRatePct: 30.0,
        grossLossAmount: 30000.0,
        netIndemnityAmount: 25000.0,
        policyNumber: 'POL-FRIGO-2026-TANGIER',
        timestamp: '2026-10-10T12:00:00.000Z',
      };

      const seal1 = CargoLossAssessmentService.generateClaimDossierSeal(params);
      const seal2 = CargoLossAssessmentService.generateClaimDossierSeal(params);
      expect(seal1).toBe(seal2);
    });
  });

  describe('3. Process Claim & Status Lifecycle', () => {
    it('creates a formal claim dossier with under_review status and credit note draft', async () => {
      const claim = await CargoLossAssessmentService.processInsuranceClaim({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckPlate: '67890-A-40',
        driverName: 'Mohamed El Idrissi',
        annexId: 'ANNEX-8840-A1',
        cargoCategory: 'fresh_produce',
        insuredCargoValue: 145000.0,
        currency: 'MAD',
        deductibleAmount: 5000.0,
        durationMinutes: 32,
        tempRiseDeltaC: 5.6,
        maxAllowedTempC: 6.0,
        tempAtCloseC: 9.1,
        settlementType: 'credit_note',
        lines: [
          {
            itemDescription: 'Fraise de Larache (Grade A)',
            affectedQuantity: 10000,
            unitOfMeasure: 'kg',
            unitValue: 14.5,
            depreciationPct: 50,
          },
        ],
      });

      expect(claim.id).toBeDefined();
      expect(claim.claimReference).toContain('CLM-8840-');
      expect(claim.claimStatus).toBe('under_review');
      expect(claim.creditNoteNumber).toBeDefined();
      expect(claim.lines).toHaveLength(1);
      expect(claim.claimDossierHash).toHaveLength(64);
    });

    it('updates claim status to settled and issues settlement timestamp', async () => {
      const claim = await CargoLossAssessmentService.processInsuranceClaim({
        tripId: 8845,
        tripNumber: 'TRIP-2026-8845',
        truckPlate: '12345-A-1',
        driverName: 'Karim Tazi',
        cargoCategory: 'deep_frozen',
        insuredCargoValue: 50000.0,
        durationMinutes: 20,
        tempRiseDeltaC: 2.0,
        maxAllowedTempC: -18.0,
        tempAtCloseC: -16.0,
      });

      const updated = await CargoLossAssessmentService.updateClaimStatus({
        claimId: claim.id,
        status: 'settled',
        creditNoteNumber: 'CN-2026-SETTLED-01',
        notes: 'Claim paid via direct insurer reimbursement',
      });

      expect(updated.claimStatus).toBe('settled');
      expect(updated.settledAt).toBeDefined();
      expect(updated.creditNoteNumber).toBe('CN-2026-SETTLED-01');
    });

    it('queries claims with filters successfully', async () => {
      const result = await CargoLossAssessmentService.queryClaims({ limit: 10 });
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Zod Schema Validations', () => {
    it('validates correct calculation schema', () => {
      const valid = calculateDepreciationSchema.safeParse({
        cargoCategory: 'fresh_produce',
        durationMinutes: 25,
        tempRiseDeltaC: 3.2,
        maxAllowedTempC: 6.0,
        tempAtCloseC: 7.5,
        insuredCargoValue: 100000,
        deductibleAmount: 5000,
      });

      expect(valid.success).toBe(true);
    });

    it('rejects create insurance claim schema when insured value is negative', () => {
      const invalid = createInsuranceClaimSchema.safeParse({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckPlate: '67890-A-40',
        driverName: 'Mohamed',
        insuredCargoValue: -1000, // Invalid negative
        durationMinutes: 20,
        tempRiseDeltaC: 2.0,
        maxAllowedTempC: 6.0,
        tempAtCloseC: 8.0,
      });

      expect(invalid.success).toBe(false);
    });
  });

  describe('5. Server Actions Execution', () => {
    it('executes calculateCargoLossEstimateAction successfully', async () => {
      const res = await calculateCargoLossEstimateAction({
        cargoCategory: 'pharma_cold',
        durationMinutes: 140,
        tempRiseDeltaC: 6.0,
        maxAllowedTempC: 8.0,
        tempAtCloseC: 15.0,
        insuredCargoValue: 400000,
        deductibleAmount: 10000,
      });

      expect(res.success).toBe(true);
      expect(res.data?.isTotalLoss).toBe(true);
      expect(res.data?.netIndemnityAmount).toBe(390000);
    });

    it('executes createInsuranceClaimAction successfully', async () => {
      const res = await createInsuranceClaimAction({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckPlate: '67890-A-40',
        driverName: 'Mohamed El Idrissi',
        cargoCategory: 'fresh_produce',
        insuredCargoValue: 100000,
        deductibleAmount: 5000,
        durationMinutes: 30,
        tempRiseDeltaC: 3.0,
        maxAllowedTempC: 6.0,
        tempAtCloseC: 7.0,
      });

      expect(res.success).toBe(true);
      expect(res.data?.claimReference).toBeDefined();
    });

    it('executes fetchReeferClaimsAction successfully', async () => {
      const res = await fetchReeferClaimsAction({ limit: 5 });
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data?.items)).toBe(true);
    });
  });
});

