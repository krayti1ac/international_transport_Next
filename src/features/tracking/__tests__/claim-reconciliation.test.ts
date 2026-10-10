import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateCreditNoteFinancials,
  generateDoubleEntryLedger,
  reconcileCargoClaimCreditNote,
  rollbackClaimCreditNoteSettlement,
  getClaimReconciliationDetails,
  clearClaimReconciliations,
} from '../services/cargo-claim-ledger-sync.service';
import {
  reconcileClaimCreditNoteAction,
  rollbackClaimSettlementAction,
  getClaimReconciliationDetailsAction,
} from '../services/claim-ledger.actions';
import type { ReconcileClaimCreditNoteValidated } from '../types/claim-reconciliation.types';

// Mock Supabase & Audit logging
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 701 }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Automated Credit Note & General Ledger Reconciliation Engine', () => {
  beforeEach(() => {
    clearClaimReconciliations();
    vi.clearAllMocks();
  });

  const samplePayload: ReconcileClaimCreditNoteValidated = {
    claimId: 'CLM-UUID-8840-01',
    claimReference: 'CLM-2026-8840-01',
    tripId: 8840,
    tripNumber: 'TRIP-2026-8840',
    clientId: 1,
    clientName: 'Maroc Primeurs Export S.A.',
    originalInvoiceId: 504,
    originalInvoiceNumber: 'INV-2026-8840',
    creditNoteNumber: 'AV-2026-8840-01',
    reason: 'cargo_thermal_excursion',
    netClaimAmount: 13705,
    currency: 'MAD',
    tvaRatePct: 0,
    isTaxExempt: true,
    taxExemptionClause: 'Exonération de TVA en vertu de l’article 92-I-10° du CGI (Transport International)',
    insurerName: 'Allianz Maroc / RMA Watanya',
    policyNumber: 'POL-FRIGO-2026-TANGIER',
    notes: 'Avoir direct accordé pour compensation perte thermique aux quais de Tanger Med',
  };

  describe('Financial & Tax Precision via Decimal.js', () => {
    it('calculates tax-exempt credit notes with 0% TVA (Article 92-I-10° CGI)', () => {
      const res = calculateCreditNoteFinancials({
        netClaimAmount: 13705,
        tvaRatePct: 0,
        isTaxExempt: true,
      });

      expect(res.htAmount).toBe(13705);
      expect(res.tvaAmount).toBe(0);
      expect(res.ttcAmount).toBe(13705);
    });

    it('calculates 20% standard TVA correctly without floating-point errors', () => {
      const res = calculateCreditNoteFinancials({
        netClaimAmount: 12000,
        tvaRatePct: 20,
        isTaxExempt: false,
      });

      Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
      const sum = new Decimal(res.htAmount).plus(new Decimal(res.tvaAmount));
      expect(sum.toNumber()).toBe(12000);
      expect(res.htAmount).toBe(10000);
      expect(res.tvaAmount).toBe(2000);
      expect(res.ttcAmount).toBe(12000);
    });
  });

  describe('Dual-Entry Ledger Generation (PCM / IFRS 15)', () => {
    it('maintains strict mathematical balance: Total Debits == Total Credits', () => {
      const { ledgerEntries } = generateDoubleEntryLedger({
        creditNoteNumber: 'AV-2026-8840-01',
        claimReference: 'CLM-2026-8840-01',
        clientName: 'Maroc Primeurs Export S.A.',
        currency: 'MAD',
        htAmount: 10000,
        tvaAmount: 2000,
        ttcAmount: 12000,
        insurerName: 'Allianz Maroc',
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
      const totalDebit = ledgerEntries.reduce(
        (acc, e) => acc.plus(new Decimal(e.debit)),
        new Decimal(0)
      );
      const totalCredit = ledgerEntries.reduce(
        (acc, e) => acc.plus(new Decimal(e.credit)),
        new Decimal(0)
      );

      expect(totalDebit.toNumber()).toBe(totalCredit.toNumber());
      expect(totalDebit.toNumber()).toBe(12000);
    });

    it('generates expected Moroccan PCM accounts: 7129 (Debit), 3421 (Credit), 3488 (Insurance)', () => {
      const { ledgerEntries, insuranceReceivableEntry } = generateDoubleEntryLedger({
        creditNoteNumber: 'AV-2026-8840-01',
        claimReference: 'CLM-2026-8840-01',
        clientName: 'Maroc Primeurs Export S.A.',
        currency: 'MAD',
        htAmount: 13705,
        tvaAmount: 0,
        ttcAmount: 13705,
        insurerName: 'Allianz Maroc',
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      const rabaisEntry = ledgerEntries.find((e) => e.accountCode === '7129');
      const clientEntry = ledgerEntries.find((e) => e.accountCode === '3421');

      expect(rabaisEntry).toBeDefined();
      expect(rabaisEntry?.debit).toBe(13705);
      expect(clientEntry).toBeDefined();
      expect(clientEntry?.credit).toBe(13705);

      expect(insuranceReceivableEntry.accountCode).toBe('3488');
      expect(insuranceReceivableEntry.debit).toBe(13705);
      expect(insuranceReceivableEntry.insurerName).toBe('Allianz Maroc');
    });
  });

  describe('Reconciliation Engine Execution & Rollback', () => {
    it('executes full claim reconciliation and updates client balance', async () => {
      const result = await reconcileCargoClaimCreditNote(samplePayload);

      expect(result.id).toBe('REC-CLM-2026-8840-01');
      expect(result.status).toBe('reconciled');
      expect(result.creditNoteNumber).toBe('AV-2026-8840-01');
      expect(result.ttcAmount).toBe(13705);
      expect(result.clientClosingBalance).toBe(85400 - 13705);

      const cached = await getClaimReconciliationDetails(samplePayload.claimId);
      expect(cached).not.toBeNull();
      expect(cached?.creditNoteNumber).toBe('AV-2026-8840-01');
    });

    it('rolls back settlement and reverts status to rolled_back', async () => {
      await reconcileCargoClaimCreditNote(samplePayload);

      const rollbackRes = await rollbackClaimCreditNoteSettlement({
        claimId: samplePayload.claimId,
        creditNoteNumber: samplePayload.creditNoteNumber,
        reason: 'Insurer dispute on deductible franchise application',
      });

      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.rolledBackAt).toBeDefined();

      const updated = await getClaimReconciliationDetails(samplePayload.claimId);
      expect(updated?.status).toBe('rolled_back');
    });
  });

  describe('Server Actions Validation & Dispatch', () => {
    it('validates schema and successfully executes reconcileClaimCreditNoteAction', async () => {
      const actionRes = await reconcileClaimCreditNoteAction(samplePayload);

      expect(actionRes.success).toBe(true);
      expect(actionRes.data?.creditNoteNumber).toBe('AV-2026-8840-01');
      expect(actionRes.data?.status).toBe('reconciled');
    });

    it('rejects action with invalid negative or zero netClaimAmount', async () => {
      const actionRes = await reconcileClaimCreditNoteAction({
        ...samplePayload,
        netClaimAmount: -500,
      });

      expect(actionRes.success).toBe(false);
      expect(actionRes.error).toContain('netClaimAmount');
    });

    it('executes rollbackClaimSettlementAction and getClaimReconciliationDetailsAction', async () => {
      await reconcileClaimCreditNoteAction(samplePayload);

      const rollbackActionRes = await rollbackClaimSettlementAction({
        claimId: samplePayload.claimId,
        creditNoteNumber: samplePayload.creditNoteNumber,
        reason: 'Adjustment requested by auditor',
      });

      expect(rollbackActionRes.success).toBe(true);

      const detailsRes = await getClaimReconciliationDetailsAction(samplePayload.claimId);
      expect(detailsRes.success).toBe(true);
      expect(detailsRes.data?.status).toBe('rolled_back');
    });
  });
});

