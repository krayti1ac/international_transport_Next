/**
 * Trans Bodanon TMS — Commercial Bills & LCN Engine Unit Tests
 * Enforces Decimal.js precision for banking discount agios, lifecycle transitions, and FIFO clearing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateNetDiscountProceeds,
  getMaturityUrgency,
  calculatePortfolioSummary,
} from '../services/commercial-bills-calc.service';
import {
  createCommercialBillAction,
  remitCommercialBillAction,
  clearCommercialBillAction,
  bounceCommercialBillAction,
  fetchCommercialBillsAction,
  clearCommercialBillsCache,
} from '../services/commercial-bills.actions';
import type { CommercialBill } from '../types/commercial-bills.types';

describe('Commercial Bills, Promissory Notes & Moroccan LCN Engine', () => {
  beforeEach(async () => {
    await clearCommercialBillsCache();
  });

  describe('calculateNetDiscountProceeds (Decimal.js Banking Formula)', () => {
    it('computes exact discount agios with 360-day commercial basis and 10% VAT', () => {
      // Example: 100,000 MAD, 6.0% annual rate, 60 days, 50 MAD commission
      // Interest = (100,000 * 6.0 * 60) / 36,000 = 1,000.00 MAD
      // Agios = 1,000.00 + 50.00 = 1,050.00 MAD
      // TVA (10%) = 105.00 MAD
      // Total Deductions = 1,155.00 MAD
      // Net Proceeds = 98,845.00 MAD
      const result = calculateNetDiscountProceeds({
        faceValue: 100000,
        annualRatePct: 6.0,
        daysToMaturity: 60,
        fixedCommissionMad: 50,
        includeVat10Pct: true,
      });

      expect(result.faceValue).toBe(100000);
      expect(result.agios).toBe(1050.0);
      expect(result.vatAmount).toBe(105.0);
      expect(result.totalDeductions).toBe(1155.0);
      expect(result.netProceeds).toBe(98845.0);
    });

    it('handles zero discount rate without precision distortion', () => {
      const result = calculateNetDiscountProceeds({
        faceValue: 50000,
        annualRatePct: 0,
        daysToMaturity: 30,
        fixedCommissionMad: 0,
      });

      expect(result.agios).toBe(0);
      expect(result.totalDeductions).toBe(0);
      expect(result.netProceeds).toBe(50000);
    });
  });

  describe('getMaturityUrgency', () => {
    it('accurately identifies past due bills as overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const urgency = getMaturityUrgency(pastDate.toISOString().split('T')[0]);
      expect(urgency).toBe('overdue');
    });

    it('accurately identifies today as due_today', () => {
      const today = new Date().toISOString().split('T')[0];
      const urgency = getMaturityUrgency(today);
      expect(urgency).toBe('due_today');
    });

    it('identifies bills maturing within 7 days as due_soon', () => {
      const inFourDays = new Date();
      inFourDays.setDate(inFourDays.getDate() + 4);
      const urgency = getMaturityUrgency(inFourDays.toISOString().split('T')[0]);
      expect(urgency).toBe('due_soon');
    });

    it('identifies bills maturing after 7 days as upcoming', () => {
      const inThirtyDays = new Date();
      inThirtyDays.setDate(inThirtyDays.getDate() + 30);
      const urgency = getMaturityUrgency(inThirtyDays.toISOString().split('T')[0]);
      expect(urgency).toBe('upcoming');
    });
  });

  describe('calculatePortfolioSummary', () => {
    it('aggregates portfolio amounts strictly using Decimal.js', () => {
      const sampleBills: CommercialBill[] = [
        {
          id: 'b1',
          billType: 'lcn_promissory_note',
          billNumber: 'LCN-001',
          clientName: 'Client Alpha',
          faceValue: 40000,
          currency: 'MAD',
          issueDate: '2026-10-01',
          dueDate: '2026-11-15',
          status: 'in_portfolio',
          discountFee: 0,
          bounceFee: 0,
          allocatedInvoiceIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'b2',
          billType: 'cheque',
          billNumber: 'CHQ-002',
          clientName: 'Client Beta',
          faceValue: 25000,
          currency: 'MAD',
          issueDate: '2026-10-01',
          dueDate: '2026-10-20',
          status: 'remitted_for_collection',
          discountFee: 0,
          bounceFee: 0,
          allocatedInvoiceIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'b3',
          billType: 'traite',
          billNumber: 'TRT-003',
          clientName: 'Client Gamma',
          faceValue: 15000,
          currency: 'MAD',
          issueDate: '2026-09-01',
          dueDate: '2026-10-01',
          status: 'bounced_unpaid',
          discountFee: 0,
          bounceFee: 150,
          allocatedInvoiceIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const summary = calculatePortfolioSummary(sampleBills);

      expect(summary.totalPortfolioValue).toBe(40000);
      expect(summary.totalRemittedValue).toBe(25000);
      expect(summary.totalBouncedValue).toBe(15000);
      expect(summary.totalBillsCount).toBe(3);
    });
  });

  describe('Server Actions & Lifecycle Execution', () => {
    it('registers a new commercial bill and assigns in_portfolio status', async () => {
      const res = await createCommercialBillAction({
        billType: 'lcn_promissory_note',
        billNumber: 'LCN-2026-9041',
        clientName: 'Agro Export Souss',
        faceValue: 85000,
        currency: 'MAD',
        drawerBankName: 'Attijariwafa bank',
        drawerBankRib: '011 780 0000123456789012 34',
        dueDate: '2026-11-30',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.status).toBe('in_portfolio');
      expect(res.data?.billNumber).toBe('LCN-2026-9041');
      expect(res.data?.faceValue).toBe(85000);
    }, 20000);

    it('rejects bill creation with negative or zero face value', async () => {
      const res = await createCommercialBillAction({
        billType: 'cheque',
        billNumber: 'CHQ-INVALID',
        clientName: 'Invalid Client',
        faceValue: -500,
        dueDate: '2026-11-30',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('transitions bill to remitted_for_collection or discounted upon bank remittance', async () => {
      const createRes = await createCommercialBillAction({
        billType: 'lcn_promissory_note',
        billNumber: 'LCN-REMIT-TEST',
        clientName: 'Transit Maroc Nord',
        faceValue: 60000,
        dueDate: '2026-12-15',
      });

      const billId = createRes.data!.id;

      const remitRes = await remitCommercialBillAction({
        billId,
        operationType: 'collection',
        remittanceReference: 'BORD-2026-5541',
      });

      expect(remitRes.success).toBe(true);
      expect(remitRes.data?.status).toBe('remitted_for_collection');
      expect(remitRes.data?.remittanceReference).toBe('BORD-2026-5541');
    }, 20000);

    it('clears a commercial bill with real value encaissement', async () => {
      const createRes = await createCommercialBillAction({
        billType: 'cheque',
        billNumber: 'CHQ-CLEAR-TEST',
        clientName: 'Transporteur Express Tanger',
        faceValue: 32000,
        dueDate: '2026-10-25',
      });

      const billId = createRes.data!.id;

      const clearRes = await clearCommercialBillAction({
        billId,
        clearedAmount: 32000,
        triggerFifoAllocation: true,
      });

      expect(clearRes.success).toBe(true);
      expect(clearRes.data?.status).toBe('cleared');
      expect(clearRes.data?.clearedAmount).toBe(32000);
      expect(clearRes.data?.clearedDate).toBeDefined();
    }, 20000);

    it('marks a bill as bounced_unpaid and logs rejection reason and fee', async () => {
      const createRes = await createCommercialBillAction({
        billType: 'traite',
        billNumber: 'TRT-BOUNCE-TEST',
        clientName: 'Client Rejet Test',
        faceValue: 18000,
        dueDate: '2026-10-10',
      });

      const billId = createRes.data!.id;

      const bounceRes = await bounceCommercialBillAction({
        billId,
        bounceReason: 'Défaut de provision (Sans provision)',
        bounceFee: 165,
        reverseSettlement: true,
      });

      expect(bounceRes.success).toBe(true);
      expect(bounceRes.data?.status).toBe('bounced_unpaid');
      expect(bounceRes.data?.bounceFee).toBe(165);
      expect(bounceRes.data?.bounceReason).toContain('Défaut de provision');
    }, 20000);
  });
});
