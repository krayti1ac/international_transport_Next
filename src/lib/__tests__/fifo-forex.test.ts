import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateFIFOAllocation,
  type FIFOInvoiceInput,
} from '@/lib/utils/decimal';
import {
  calculateForexGainLoss,
  recordForexGainLossEntry,
} from '@/lib/forex';
import {
  processFIFOPayment,
  previewFIFOAllocation,
} from '@/lib/fifo-payment';

// Mock audit logging
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(true),
}));

describe('FIFO Payment Allocation & Realized Forex Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. calculateFIFOAllocation (Pure Decimal.js Engine)', () => {
    it('should allocate full payment to a single invoice', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 1,
          invoice_number: 'INV-001',
          total_amount: 5000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-10',
          currency: 'MAD',
        },
      ];

      const result = calculateFIFOAllocation(invoices, 5000);

      expect(result.totalAllocated).toBe(5000);
      expect(result.unallocatedCredit).toBe(0);
      expect(result.affectedInvoicesCount).toBe(1);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0]).toMatchObject({
        invoiceId: 1,
        invoiceNumber: 'INV-001',
        allocatedAmount: 5000,
        newPaidAmount: 5000,
        remainingDue: 0,
        newStatus: 'paid',
      });
    });

    it('should allocate partial payment when payment amount is less than invoice total', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 10,
          invoice_number: 'INV-010',
          total_amount: 10000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-02-01',
          currency: 'MAD',
        },
      ];

      const result = calculateFIFOAllocation(invoices, 3500);

      expect(result.totalAllocated).toBe(3500);
      expect(result.unallocatedCredit).toBe(0);
      expect(result.affectedInvoicesCount).toBe(1);
      expect(result.allocations[0]).toMatchObject({
        invoiceId: 10,
        allocatedAmount: 3500,
        newPaidAmount: 3500,
        remainingDue: 6500,
        newStatus: 'partially_paid',
      });
    });

    it('should allocate across multiple invoices in chronological FIFO order (oldest first)', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 3,
          invoice_number: 'INV-003',
          total_amount: 3000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-03-01',
          currency: 'MAD',
        },
        {
          id: 1,
          invoice_number: 'INV-001',
          total_amount: 2000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-01',
          currency: 'MAD',
        },
        {
          id: 2,
          invoice_number: 'INV-002',
          total_amount: 4000,
          paid_amount: 1000, // partially paid before, remaining 3000
          status: 'partially_paid',
          issue_date: '2026-02-01',
          currency: 'MAD',
        },
      ];

      // Total due = 2000 (INV-001) + 3000 (INV-002) + 3000 (INV-003) = 8000
      // Payment = 4500
      // Expected:
      // 1. INV-001 (Jan 1): 2000 -> fully paid
      // 2. INV-002 (Feb 1): remaining 3000, gets 2500 -> partially paid (newPaid = 3500, remainingDue = 500)
      // 3. INV-003 (Mar 1): untouched
      const result = calculateFIFOAllocation(invoices, 4500);

      expect(result.totalAllocated).toBe(4500);
      expect(result.unallocatedCredit).toBe(0);
      expect(result.affectedInvoicesCount).toBe(2);

      expect(result.allocations[0].invoiceId).toBe(1);
      expect(result.allocations[0].allocatedAmount).toBe(2000);
      expect(result.allocations[0].newStatus).toBe('paid');
      expect(result.allocations[0].remainingDue).toBe(0);

      expect(result.allocations[1].invoiceId).toBe(2);
      expect(result.allocations[1].allocatedAmount).toBe(2500);
      expect(result.allocations[1].newPaidAmount).toBe(3500);
      expect(result.allocations[1].newStatus).toBe('partially_paid');
      expect(result.allocations[1].remainingDue).toBe(500);
    });

    it('should correctly handle surplus overpayment as unallocated credit', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 1,
          invoice_number: 'INV-001',
          total_amount: 1000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-01',
          currency: 'MAD',
        },
      ];

      const result = calculateFIFOAllocation(invoices, 2500);

      expect(result.totalAllocated).toBe(1000);
      expect(result.unallocatedCredit).toBe(1500);
      expect(result.affectedInvoicesCount).toBe(1);
      expect(result.allocations[0].newStatus).toBe('paid');
    });

    it('should handle sorting fallback: null issue_date placed last and tiebreak by id ASC', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 5,
          invoice_number: 'INV-NULL-5',
          total_amount: 1000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: null,
          currency: 'MAD',
        },
        {
          id: 4,
          invoice_number: 'INV-NULL-4',
          total_amount: 1000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: null,
          currency: 'MAD',
        },
        {
          id: 2,
          invoice_number: 'INV-DATED',
          total_amount: 1000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-15',
          currency: 'MAD',
        },
      ];

      const result = calculateFIFOAllocation(invoices, 2500);

      expect(result.allocations).toHaveLength(3);
      expect(result.allocations[0].invoiceId).toBe(2); // DATED first
      expect(result.allocations[1].invoiceId).toBe(4); // NULL id=4 before id=5
      expect(result.allocations[2].invoiceId).toBe(5); // NULL id=5
      expect(result.allocations[2].allocatedAmount).toBe(500);
    });

    it('should ignore fully paid or zero-balance invoices', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 1,
          invoice_number: 'INV-001',
          total_amount: 1000,
          paid_amount: 1000,
          status: 'paid',
          issue_date: '2026-01-01',
          currency: 'MAD',
        },
        {
          id: 2,
          invoice_number: 'INV-002',
          total_amount: 800,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-02',
          currency: 'MAD',
        },
      ];

      const result = calculateFIFOAllocation(invoices, 500);

      expect(result.affectedInvoicesCount).toBe(1);
      expect(result.allocations[0].invoiceId).toBe(2);
      expect(result.allocations[0].allocatedAmount).toBe(500);
    });

    it('should maintain strict Decimal.js financial precision against JS floating-point issues', () => {
      // Classic JS floating-point flaw: 0.1 + 0.2 = 0.30000000000000004
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 1,
          invoice_number: 'INV-001',
          total_amount: 0.1,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-01',
          currency: 'MAD',
        },
        {
          id: 2,
          invoice_number: 'INV-002',
          total_amount: 0.2,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-02',
          currency: 'MAD',
        },
      ];

      const result = calculateFIFOAllocation(invoices, 0.3);

      expect(result.totalAllocated).toBe(0.3);
      expect(result.unallocatedCredit).toBe(0);
      expect(result.allocations[0].allocatedAmount).toBe(0.1);
      expect(result.allocations[1].allocatedAmount).toBe(0.2);
      expect(result.allocations[1].newPaidAmount).toBe(0.2);
    });
  });

  describe('2. Realized Forex Gain/Loss Engine (calculateForexGainLoss)', () => {
    it('should calculate realized Forex Gain when settlement rate is higher than invoice rate', () => {
      // Invoice was 1000 EUR at 10.85 MAD/EUR. Collected at 11.00 MAD/EUR.
      // Gain = 1000 * (11.00 - 10.85) = 1000 * 0.15 = 150.00 MAD
      const result = calculateForexGainLoss(1000, 10.85, 11.00);

      expect(result.type).toBe('gain');
      expect(result.amount).toBe(150.00);
      expect(result.delta).toBe(150.00);
    });

    it('should calculate realized Forex Loss when settlement rate is lower than invoice rate', () => {
      // Invoice was 2500 EUR at 10.90 MAD/EUR. Collected at 10.75 MAD/EUR.
      // Loss = 2500 * (10.75 - 10.90) = 2500 * (-0.15) = -375.00 MAD
      const result = calculateForexGainLoss(2500, 10.90, 10.75);

      expect(result.type).toBe('loss');
      expect(result.amount).toBe(375.00);
      expect(result.delta).toBe(-375.00);
    });

    it('should treat minor fluctuations within [-0.01, 0.01] as neutral to prevent penny noise', () => {
      // 1 EUR with 0.005 rate difference = 0.005 MAD (< 0.01)
      const result = calculateForexGainLoss(1, 10.850, 10.855);

      expect(result.type).toBe('neutral');
      expect(result.amount).toBe(0);
      expect(result.delta).toBe(0.01);
    });

    it('should attach live forexGainLoss into calculateFIFOAllocation for EUR invoices', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 77,
          invoice_number: 'INV-EUR-77',
          total_amount: 2000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-02-15',
          currency: 'EUR',
          exchange_rate: 10.80,
        },
      ];

      // Settle at 10.95 (gain of 0.15 * 2000 = 300 MAD)
      const result = calculateFIFOAllocation(invoices, 2000, 10.95);

      expect(result.allocations[0].forexGainLoss).toBeDefined();
      expect(result.allocations[0].forexGainLoss?.type).toBe('gain');
      expect(result.allocations[0].forexGainLoss?.amount).toBe(300);
    });
  });

  describe('3. recordForexGainLossEntry Integration', () => {
    it('should insert entry into forex_gain_loss_entries when there is gain or loss', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 999 },
            error: null,
          }),
        }),
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'forex_gain_loss_entries') {
            return { insert: mockInsert };
          }
          return {};
        }),
      } as any;

      const result = await recordForexGainLossEntry(mockSupabase, {
        invoiceId: 101,
        tripId: 42,
        originalAmount: 1000,
        originalCurrency: 'EUR',
        originalRate: 10.85,
        settlementRate: 11.00,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(999);
      expect(result.success).toBe(true);
      expect(result.recorded).toBe(true);
      expect(result.type).toBe('gain');
      expect(result.amount).toBe(150);
      expect(mockSupabase.from).toHaveBeenCalledWith('forex_gain_loss_entries');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_id: 101,
          trip_id: 42,
          original_amount: 1000,
          original_currency: 'EUR',
          original_rate: 10.85,
          settlement_rate: 11.00,
          realized_gain_loss: 150,
          entry_type: 'gain',
        })
      );
    });

    it('should skip inserting entry when entry is neutral', async () => {
      const mockSupabase = {
        from: vi.fn(),
      } as any;

      const result = await recordForexGainLossEntry(mockSupabase, {
        invoiceId: 101,
        originalAmount: 1,
        originalCurrency: 'EUR',
        originalRate: 10.85,
        settlementRate: 10.85,
      });

      expect(result.success).toBe(true);
      expect(result.recorded).toBe(false);
      expect(result.type).toBe('neutral');
      expect(result.amount).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('4. processFIFOPayment Integration Flow', () => {
    it('should reject payment amounts less than or equal to zero', async () => {
      const mockSupabase = {} as any;
      const resZero = await processFIFOPayment(mockSupabase, {
        clientId: 1,
        amount: 0,
        paymentMethod: 'bank_transfer',
      });
      expect(resZero.success).toBe(false);
      expect(resZero.error).toContain('أكبر من الصفر');

      const resNegative = await processFIFOPayment(mockSupabase, {
        clientId: 1,
        amount: -500,
        paymentMethod: 'cash',
      });
      expect(resNegative.success).toBe(false);
    });

    it('should process FIFO payment and mutate database state across tables', async () => {
      const mockInvoices = [
        {
          id: 101,
          invoice_number: 'INV-101',
          total_amount: 1500,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-01-10',
          currency: 'EUR',
          exchange_rate: 10.85,
          trip_id: 42,
        },
      ];

      const insertedPayment = { id: 701 };
      const updatedInvoice = vi.fn().mockResolvedValue({ error: null });
      const insertedAllocations = vi.fn().mockResolvedValue({ error: null });
      const insertedTreasury = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 801 }, error: null }),
          single: vi.fn().mockResolvedValue({ data: { id: 801 }, error: null }),
        }),
      });
      const insertedForex = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 901 }, error: null }),
        }),
      });
      const updatedAccount = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          switch (table) {
            case 'invoices':
              return {
                select: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: mockInvoices, error: null }),
                      }),
                    }),
                  }),
                }),
                update: vi.fn().mockReturnValue({
                  eq: updatedInvoice,
                }),
              };
            case 'payments':
              return {
                insert: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: insertedPayment, error: null }),
                  }),
                }),
              };
            case 'payment_invoice_allocations':
              return {
                insert: insertedAllocations,
              };
            case 'treasury_transactions':
              return {
                insert: insertedTreasury,
              };
            case 'forex_gain_loss_entries':
              return {
                insert: insertedForex,
              };
            case 'bank_accounts':
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { current_balance: 5000 }, error: null }),
                  }),
                }),
                update: vi.fn().mockReturnValue({
                  eq: updatedAccount,
                }),
              };
            default:
              return {};
          }
        }),
      } as any;

      const result = await processFIFOPayment(mockSupabase, {
        clientId: 5,
        amount: 1500,
        currency: 'EUR',
        paymentMethod: 'bank_transfer',
        bankAccountId: 3,
        settlementRate: 11.00, // Gain of (11.00 - 10.85) * 1500 = 225 MAD
      });

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe(701);
      expect(result.totalAllocated).toBe(1500);
      expect(result.unallocatedCredit).toBe(0);
      expect(result.affectedInvoicesCount).toBe(1);
      expect(result.allocations[0].newStatus).toBe('paid');

      // Verify invoice update
      expect(updatedInvoice).toHaveBeenCalledWith('id', 101);

      // Verify allocations table insertion
      expect(insertedAllocations).toHaveBeenCalledWith([
        expect.objectContaining({
          payment_id: 701,
          invoice_id: 101,
          allocated_amount: 1500,
        }),
      ]);

      // Verify treasury deposit with type 'client_payment'
      expect(insertedTreasury).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'client_payment',
          amount: 1500,
          currency: 'EUR',
          bank_account_id: 3,
        })
      );

      // Verify Forex Gain was recorded
      expect(result.forexEntries).toBeDefined();
      expect(result.forexEntries?.[0].type).toBe('gain');
      expect(result.forexEntries?.[0].amount).toBe(225);
    });

    it('previewFIFOAllocation should calculate allocation without performing any DB queries', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 1,
          invoice_number: 'PREV-1',
          total_amount: 1000,
          paid_amount: 200,
          status: 'partially_paid',
          issue_date: '2026-03-01',
          currency: 'MAD',
        },
      ];

      const preview = previewFIFOAllocation(invoices, 500);
      expect(preview.totalAllocated).toBe(500);
      expect(preview.allocations[0].remainingDue).toBe(300);
      expect(preview.allocations[0].newStatus).toBe('partially_paid');
    });

    it('should generate unallocatedCredit and creditNotePayload on overpayment in calculateFIFOAllocation', () => {
      const invoices: FIFOInvoiceInput[] = [
        {
          id: 1,
          invoice_number: 'INV-1',
          total_amount: 3000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-04-01',
          currency: 'MAD',
        },
      ];

      const result = calculateFIFOAllocation(invoices, 5000);
      expect(result.totalAllocated).toBe(3000);
      expect(result.unallocatedCredit).toBe(2000);
      expect(result.creditNotePayload).toBeDefined();
      expect(result.creditNotePayload?.amount).toBe(2000);
      expect(result.creditNotePayload?.currency).toBe('MAD');
    });

    it('should record unallocated credit in payments and client_credit_balances on overpayment in processFIFOPayment', async () => {
      const mockInvoices = [
        {
          id: 50,
          invoice_number: 'INV-50',
          total_amount: 4000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-05-01',
          currency: 'MAD',
        },
      ];

      const insertedPayment = { id: 888 };
      const insertedCreditBalance = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 777 }, error: null }),
        }),
      });
      const insertedPaymentMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertedPayment, error: null }),
        }),
      });
      const insertedTreasury = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 999 }, error: null }),
        }),
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          switch (table) {
            case 'invoices':
              return {
                select: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: mockInvoices, error: null }),
                      }),
                    }),
                  }),
                }),
                update: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            case 'payments':
              return {
                insert: insertedPaymentMock,
              };
            case 'client_credit_balances':
              return {
                insert: insertedCreditBalance,
              };
            case 'payment_invoice_allocations':
              return {
                insert: vi.fn().mockResolvedValue({ error: null }),
              };
            case 'treasury_transactions':
              return {
                insert: insertedTreasury,
              };
            default:
              return {};
          }
        }),
      } as any;

      const result = await processFIFOPayment(mockSupabase, {
        clientId: 12,
        amount: 6000, // 4000 due + 2000 overpayment
        currency: 'MAD',
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      expect(result.totalAllocated).toBe(4000);
      expect(result.unallocatedCredit).toBe(2000);
      expect(result.creditBalanceId).toBe(777);

      // Verify payments table got unallocated_amount: 2000
      expect(insertedPaymentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 12,
          amount: 6000,
          unallocated_amount: 2000,
        })
      );

      // Verify client_credit_balances got created
      expect(insertedCreditBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 12,
          payment_id: 888,
          amount: 2000,
          remaining_amount: 2000,
          status: 'active',
        })
      );
    });

    it('should record dual treasury transaction for forex loss when settlement rate is lower', async () => {
      const mockInvoices = [
        {
          id: 60,
          invoice_number: 'INV-EUR-LOSS',
          total_amount: 1000,
          paid_amount: 0,
          status: 'unpaid',
          issue_date: '2026-06-01',
          currency: 'EUR',
          exchange_rate: 10.90,
        },
      ];

      const insertedPayment = { id: 991 };
      const insertedTreasury = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 555 }, error: null }),
        }),
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          switch (table) {
            case 'invoices':
              return {
                select: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: mockInvoices, error: null }),
                      }),
                    }),
                  }),
                }),
                update: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              };
            case 'payments':
              return {
                insert: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: insertedPayment, error: null }),
                  }),
                }),
              };
            case 'payment_invoice_allocations':
              return {
                insert: vi.fn().mockResolvedValue({ error: null }),
              };
            case 'treasury_transactions':
              return {
                insert: insertedTreasury,
              };
            case 'forex_gain_loss_entries':
              return {
                insert: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { id: 333 }, error: null }),
                  }),
                }),
              };
            default:
              return {};
          }
        }),
      } as any;

      const result = await processFIFOPayment(mockSupabase, {
        clientId: 20,
        amount: 1000,
        currency: 'EUR',
        paymentMethod: 'bank_transfer',
        settlementRate: 10.70, // Loss: 1000 * (10.70 - 10.90) = -200 MAD
      });

      expect(result.success).toBe(true);
      expect(result.forexEntries?.[0].type).toBe('loss');
      expect(result.forexEntries?.[0].amount).toBe(200);

      // Verify dual entry in treasury_transactions for forex_loss
      expect(insertedTreasury).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'forex_loss',
          amount: 200,
          currency: 'MAD',
        })
      );
    });
  });
});

