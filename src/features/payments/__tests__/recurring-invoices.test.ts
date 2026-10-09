/**
 * Trans Bodanon TMS — Automated Recurring Invoices Tests
 * Tests schedule calculation, frequency date advancement, Decimal.js financial sums, and cycle life.
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateNextBillingDate,
  isScheduleDueForBilling,
  buildRecurringScheduleRecord,
  advanceScheduleCycle,
  generateRecurringInvoiceNumber,
} from '../services/recurring-invoices.service';
import type { RecurringInvoiceSchedule } from '../types/recurring-invoice.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

describe('Trans Bodanon TMS — Automated Recurring Invoices Engine', () => {
  // ---------------------------------------------------------------------------
  // 1. Next Billing Date Calculations
  // ---------------------------------------------------------------------------
  describe('1. Billing Date Advancement Algorithms', () => {
    it('advances weekly schedules by exactly 7 days', () => {
      const nextDate = calculateNextBillingDate('weekly', '2026-10-01');
      expect(nextDate).toBe('2026-10-08');
    });

    it('advances bi-weekly schedules by exactly 14 days', () => {
      const nextDate = calculateNextBillingDate('biweekly', '2026-10-01');
      expect(nextDate).toBe('2026-10-15');
    });

    it('advances monthly schedules while respecting billing day of month', () => {
      const nextDate = calculateNextBillingDate('monthly', '2026-05-15', 15);
      expect(nextDate).toBe('2026-06-15');
    });

    it('clamps 31st day properly for months with fewer days (e.g. February)', () => {
      // 31st of January advanced to February should clamp to 28 (non-leap 2027)
      const nextDate = calculateNextBillingDate('monthly', '2027-01-31', 31);
      expect(nextDate).toBe('2027-02-28');
    });

    it('advances quarterly schedules by 3 months', () => {
      const nextDate = calculateNextBillingDate('quarterly', '2026-01-01', 1);
      expect(nextDate).toBe('2026-04-01');
    });

    it('advances annual schedules by 1 full year', () => {
      const nextDate = calculateNextBillingDate('annually', '2026-10-09', 9);
      expect(nextDate).toBe('2027-10-09');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Schedule Eligibility & Due Status
  // ---------------------------------------------------------------------------
  describe('2. Schedule Due Checking & Lifecycle Guards', () => {
    const baseSchedule: RecurringInvoiceSchedule = {
      id: 101,
      clientId: '93',
      title: 'Transport Frigo Agadir-Valencia',
      frequency: 'monthly',
      currency: 'MAD',
      amountHt: '48000.00',
      tvaRate: '0.00',
      tvaAmount: '0.00',
      totalAmountTtc: '48000.00',
      isArticle92Exempt: true,
      startDate: '2026-09-01',
      nextIssueDate: '2026-10-01',
      billingDayOfMonth: 1,
      autoSendEmail: true,
      autoSendWhatsapp: true,
      autoGeneratePaymentLink: true,
      preferredGateway: 'multi',
      status: 'active',
      totalCyclesCompleted: 1,
      itemsBreakdown: [],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    it('identifies schedule as due when nextIssueDate is in the past or today', () => {
      const isDue = isScheduleDueForBilling(baseSchedule, '2026-10-05');
      expect(isDue).toBe(true);
    });

    it('identifies schedule as NOT due when nextIssueDate is in the future', () => {
      const isDue = isScheduleDueForBilling(baseSchedule, '2026-09-20');
      expect(isDue).toBe(false);
    });

    it('does not process schedules with paused or completed status', () => {
      const pausedSchedule = { ...baseSchedule, status: 'paused' as const };
      expect(isScheduleDueForBilling(pausedSchedule, '2026-10-05')).toBe(false);

      const completedSchedule = { ...baseSchedule, status: 'completed' as const };
      expect(isScheduleDueForBilling(completedSchedule, '2026-10-05')).toBe(false);
    });

    it('does not process schedules exceeding maxCycles', () => {
      const maxedSchedule = {
        ...baseSchedule,
        totalCyclesCompleted: 12,
        maxCycles: 12,
      };
      expect(isScheduleDueForBilling(maxedSchedule, '2026-10-05')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Financial Calculation & Record Building (Decimal.js)
  // ---------------------------------------------------------------------------
  describe('3. Financial Calculations & Cycle Advancement (Decimal.js)', () => {
    it('accurately applies Article 92-I-10° 0% VAT exemption on international freight', () => {
      const record = buildRecurringScheduleRecord({
        clientId: '93',
        title: 'Contrat Agrumes 2026',
        frequency: 'monthly',
        amountHt: '48000.00',
        isArticle92Exempt: true,
        startDate: '2026-10-01',
      });

      expect(record.amountHt).toBe('48000.00');
      expect(record.tvaRate).toBe('0.00');
      expect(record.tvaAmount).toBe('0.00');
      expect(record.totalAmountTtc).toBe('48000.00');
      expect(record.status).toBe('active');
    });

    it('accurately applies standard 20% VAT when exemption is not active', () => {
      const record = buildRecurringScheduleRecord({
        clientId: '93',
        title: 'Transport National Standard',
        frequency: 'monthly',
        amountHt: '10000.00',
        tvaRate: '20.00',
        isArticle92Exempt: false,
        startDate: '2026-10-01',
      });

      expect(record.amountHt).toBe('10000.00');
      expect(record.tvaRate).toBe('20.00');
      expect(record.tvaAmount).toBe('2000.00');
      expect(record.totalAmountTtc).toBe('12000.00');
    });

    it('advances schedule cycle and marks as completed when max cycles reached', () => {
      const schedule: RecurringInvoiceSchedule = {
        id: 50,
        clientId: '93',
        title: 'Saison Export 3 Mois',
        frequency: 'monthly',
        currency: 'MAD',
        amountHt: '48000.00',
        tvaRate: '0.00',
        tvaAmount: '0.00',
        totalAmountTtc: '48000.00',
        isArticle92Exempt: true,
        startDate: '2026-01-01',
        nextIssueDate: '2026-03-01',
        billingDayOfMonth: 1,
        autoSendEmail: true,
        autoSendWhatsapp: true,
        autoGeneratePaymentLink: true,
        preferredGateway: 'stripe',
        status: 'active',
        totalCyclesCompleted: 2,
        maxCycles: 3,
        itemsBreakdown: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const result = advanceScheduleCycle(schedule, '2026-03-01');

      expect(result.updatedSchedule.totalCyclesCompleted).toBe(3);
      expect(result.isCompleted).toBe(true);
      expect(result.updatedSchedule.status).toBe('completed');
      expect(result.updatedSchedule.lastIssuedDate).toBe('2026-03-01');
    });

    it('generates standardized invoice reference numbers for recurring cycles', () => {
      const invNum = generateRecurringInvoiceNumber(1024, 3, '2026-10-09');
      expect(invNum).toBe('FA-REC-202610-1024-03');
    });
  });
});

