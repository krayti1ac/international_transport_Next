import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  resolveReminderStage,
  buildReminderMessages,
  type ReminderStage,
} from '../services/payment-reminders.service';
import type { Invoice, Client } from '@/types/database';

describe('Automated Payment Reminders Engine & Stages', () => {
  const mockClient: Client = {
    id: 1,
    name: 'FRIGO ATLANTIC AGADIR',
    phone: '+212661234567',
    email: 'expeditions@frigoatlantic.ma',
    ice: '003194827000091',
    created_at: '2026-01-01',
    is_active: true,
  } as Client;

  const mockInvoice: Invoice = {
    id: 101,
    client_id: '1',
    invoice_number: 'INV-2026-0042',
    total_amount: '45000.00',
    paid_amount: '10000.00',
    status: 'sent',
    due_date: '2026-09-30',
    currency: 'MAD',
    input_mode: 'manual',
    created_at: '2026-09-01',
  };

  describe('1. Stage Resolution (resolveReminderStage)', () => {
    it('resolves T-3 days to upcoming_3d', () => {
      expect(resolveReminderStage(-3)).toBe('upcoming_3d');
    });

    it('resolves T=0 (due date) to due_today', () => {
      expect(resolveReminderStage(0)).toBe('due_today');
    });

    it('resolves T+7 days overdue to overdue_7d', () => {
      expect(resolveReminderStage(7)).toBe('overdue_7d');
    });

    it('resolves recurring weekly escalations for T >= 15 (e.g. 21, 28, 35 days) to escalation_15d', () => {
      expect(resolveReminderStage(21)).toBe('escalation_15d');
      expect(resolveReminderStage(28)).toBe('escalation_15d');
      expect(resolveReminderStage(35)).toBe('escalation_15d');
    });

    it('returns null for non-trigger days (e.g. -5, -2, 1, 5, 12, 16)', () => {
      expect(resolveReminderStage(-5)).toBeNull();
      expect(resolveReminderStage(-2)).toBeNull();
      expect(resolveReminderStage(1)).toBeNull();
      expect(resolveReminderStage(5)).toBeNull();
      expect(resolveReminderStage(12)).toBeNull();
      expect(resolveReminderStage(16)).toBeNull();
    });
  });

  describe('2. Message Content & Escalation Tone', () => {
    it('formats friendly reminder for upcoming_3d', () => {
      const { waMessage, emailSubject } = buildReminderMessages(
        'upcoming_3d',
        mockInvoice,
        mockClient,
        '35,000.00 MAD',
        -3
      );

      expect(emailSubject).toContain('تذكير بموعد استحقاق الفاتورة');
      expect(waMessage).toContain('INV-2026-0042');
      expect(waMessage).toContain('35,000.00 MAD');
      expect(waMessage).toContain('يحل بعد 3 أيام');
    });

    it('formats official bank notice for due_today', () => {
      const { waMessage, emailSubject } = buildReminderMessages(
        'due_today',
        mockInvoice,
        mockClient,
        '35,000.00 MAD',
        0
      );

      expect(emailSubject).toContain('اليوم');
      expect(waMessage).toContain('FRIGO ATLANTIC AGADIR');
      expect(waMessage).toContain('Attijariwafa Bank');
    });

    it('formats urgent warning for overdue_7d', () => {
      const { waMessage, emailSubject } = buildReminderMessages(
        'overdue_7d',
        mockInvoice,
        mockClient,
        '35,000.00 MAD',
        7
      );

      expect(emailSubject).toContain('[مستعجل]');
      expect(waMessage).toContain('تجاوزت تاريخ الاستحقاق بـ 7 أيام');
    });

    it('formats legal and operations hold notice for escalation_15d', () => {
      const { waMessage, emailSubject } = buildReminderMessages(
        'escalation_15d',
        mockInvoice,
        mockClient,
        '35,000.00 MAD',
        21
      );

      expect(emailSubject).toContain('[إنذار مالي ومطالبة فورية]');
      expect(waMessage).toContain('إيقاف حجوزات');
      expect(waMessage).toContain('21 يوماً');
    });
  });

  describe('3. Decimal.js Precision on Remaining Due Amounts', () => {
    it('calculates remaining balance strictly with Decimal.js without floating drift', () => {
      const total = new Decimal('159483.95');
      const paid = new Decimal('59483.95');
      const remaining = total.minus(paid);

      expect(remaining.toFixed(2)).toBe('100000.00');
      expect(remaining.isZero()).toBe(false);

      const fullyPaid = total.minus(total);
      expect(fullyPaid.lessThanOrEqualTo(0)).toBe(true);
    });
  });
});

