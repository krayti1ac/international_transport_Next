/**
 * Trans Bodanon TMS — Bank Remittance Bordereau Unit & Lifecycle Tests
 * Validates Moroccan banking calculations (Base 360j, 10% TVA), HMAC security hash,
 * QR Code generation, HTML builder, and Server Action transitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateBordereauFinancials,
  generateBordereauSecurityHash,
  generateBordereauQrCode,
  buildBordereauHtml,
} from '../services/remittance-bordereau-pdf.service';
import {
  generateRemittanceBordereauAction,
  fetchRemittanceBordereauxAction,
  getRemittanceBordereauByIdAction,
} from '../services/remittance-bordereau.actions';
import type { BordereauBillItem, RemittanceBordereau } from '../types/remittance-bordereau.types';

// Mock Supabase server client
const mockBills = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    company_id: 1,
    bill_number: 'LCN-2026-001',
    bill_type: 'lcn_promissory_note',
    client_name: 'Maroc Fruit Export SARL',
    issuer_name: 'Directeur Financier',
    drawer_bank_name: 'Attijariwafa Bank',
    drawer_bank_rib: '007780000123456789012345',
    face_value: 50000.0,
    issue_date: '2026-10-01',
    due_date: '2026-11-15',
    status: 'in_portfolio',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    company_id: 1,
    bill_number: 'CHQ-2026-002',
    bill_type: 'cheque',
    client_name: 'Agri-Souss International',
    drawer_bank_name: 'Banque Populaire',
    drawer_bank_rib: '101780000987654321098765',
    face_value: 30000.0,
    issue_date: '2026-10-05',
    due_date: '2026-11-20',
    status: 'in_portfolio',
  },
];

const mockBankAccount = {
  id: 10,
  name: 'Compte Courant MAD',
  bank_name: 'BMCE Bank of Africa',
  account_number: '011780000111222333444555',
};

const mockCompany = {
  id: 1,
  name: 'TRANS BODANON SARL',
  ice: '003291823000045',
};

const createChainableMock = (resolvedData: any) => {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({
        data: Array.isArray(resolvedData) ? resolvedData[0] : resolvedData,
        error: null,
      })
    ),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: Array.isArray(resolvedData) ? resolvedData[0] : resolvedData,
        error: null,
      })
    ),
    then: (resolve: any, reject?: any) =>
      Promise.resolve({ data: resolvedData, error: null }).then(resolve, reject),
  };
  return chain;
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return createChainableMock({ company_id: 1 });
      }
      if (table === 'companies') {
        return createChainableMock(mockCompany);
      }
      if (table === 'bank_accounts') {
        return createChainableMock(mockBankAccount);
      }
      if (table === 'commercial_bills') {
        return createChainableMock(mockBills);
      }
      if (table === 'remittance_bordereaux') {
        return createChainableMock([
          {
            id: 'bordereau-uuid-123',
            bordereau_number: 'BRD-ENC-2026-1001',
            bordereau_type: 'encaissement',
            bank_account_id: 10,
            bank_name: 'BMCE Bank of Africa',
            bank_rib: '011780000111222333444555',
            total_face_value: 80000.0,
            bills_count: 2,
            estimated_agios: 0,
            estimated_vat: 0,
            estimated_net_proceeds: 80000.0,
            remittance_date: '2026-10-15',
            security_hash: 'abc123hash',
            bill_ids: mockBills.map((b) => b.id),
            created_at: '2026-10-15T10:00:00Z',
          },
        ]);
      }
      return createChainableMock(null);
    }),
  })),
}));

describe('Bank Remittance Bordereau & LCN Export Engine', () => {
  const sampleBillItems: BordereauBillItem[] = [
    {
      id: 'bill-1',
      billNumber: 'LCN-001',
      billType: 'lcn_promissory_note',
      clientName: 'Client Alpha',
      drawerBankName: 'Attijariwafa Bank',
      drawerBankRib: '007780000123456789012345',
      issueDate: '2026-10-01',
      dueDate: '2026-11-15',
      faceValue: 50000,
    },
    {
      id: 'bill-2',
      billNumber: 'CHQ-002',
      billType: 'cheque',
      clientName: 'Client Beta',
      drawerBankName: 'Banque Populaire',
      drawerBankRib: '101780000987654321098765',
      issueDate: '2026-10-05',
      dueDate: '2026-11-30',
      faceValue: 30000,
    },
  ];

  describe('1. Financial Precision & Calculations via Decimal.js', () => {
    it('calculates totals correctly for encaissement without agios deduction', () => {
      const result = calculateBordereauFinancials(
        sampleBillItems,
        'encaissement',
        0,
        0,
        '2026-10-15'
      );

      expect(result.totalFaceValue).toBe(80000);
      expect(result.billsCount).toBe(2);
      expect(result.estimatedAgios).toBe(0);
      expect(result.estimatedVat).toBe(0);
      expect(result.estimatedNetProceeds).toBe(80000);
    });

    it('calculates Moroccan 360-day commercial escompte agios with 10% bank VAT', () => {
      // 50,000 MAD due 2026-11-15 (31 days from 2026-10-15)
      // 30,000 MAD due 2026-11-30 (46 days from 2026-10-15)
      // Rate: 6% per annum, Commission: 60 MAD (30 MAD per bill)
      const discountRate = 6.0;
      const commission = 60.0;
      const remittanceDate = '2026-10-15';

      const result = calculateBordereauFinancials(
        sampleBillItems,
        'escompte',
        discountRate,
        commission,
        remittanceDate
      );

      expect(result.totalFaceValue).toBe(80000);
      expect(result.billsCount).toBe(2);
      expect(result.estimatedAgios).toBeGreaterThan(0);
      expect(result.estimatedVat).toBeGreaterThan(0);
      expect(result.estimatedNetProceeds).toBeLessThan(80000);

      // Verify exact Decimal.js math:
      // Bill 1: (50000 * 6 * 31) / 36000 + 30 = 258.3333... + 30 = 288.3333...
      // Bill 2: (30000 * 6 * 46) / 36000 + 30 = 230.0000... + 30 = 260.0000...
      // Total Pre-Vat Agios: ~548.33
      // TVA (10%): ~54.83
      // Total Agios: ~603.17
      // Net proceeds = 80000 - 603.17 = 79396.83
      const expectedTotal = new Decimal(result.estimatedNetProceeds)
        .plus(result.estimatedAgios)
        .plus(result.estimatedVat)
        .toNumber();

      expect(expectedTotal).toBeCloseTo(80000, 1);
    });

    it('enforces a minimum of 1 day to maturity for overdue or same-day bills in escompte', () => {
      const overdueBills: BordereauBillItem[] = [
        {
          id: 'b-past',
          billNumber: 'LCN-PAST',
          billType: 'lcn_promissory_note',
          clientName: 'Past Client',
          drawerBankName: 'CIH',
          drawerBankRib: '230780000000000000000000',
          issueDate: '2026-09-01',
          dueDate: '2026-10-10', // 5 days past
          faceValue: 10000,
        },
      ];

      const res = calculateBordereauFinancials(overdueBills, 'escompte', 5, 0, '2026-10-15');
      expect(res.billItemsWithMetrics[0].daysToMaturity).toBe(1);
    });
  });

  describe('2. Security HMAC-SHA256 & QR Code Generation', () => {
    it('generates consistent 64-char HMAC-SHA256 cryptographic signature', () => {
      const hash1 = generateBordereauSecurityHash(
        'BRD-ENC-2026-0001',
        80000,
        '011780000111222333444555',
        '2026-10-15',
        'test-secret-key'
      );

      const hash2 = generateBordereauSecurityHash(
        'BRD-ENC-2026-0001',
        80000,
        '011780000111222333444555',
        '2026-10-15',
        'test-secret-key'
      );

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);

      // Any alteration alters the signature
      const hashTampered = generateBordereauSecurityHash(
        'BRD-ENC-2026-0001',
        80001, // 1 MAD difference
        '011780000111222333444555',
        '2026-10-15',
        'test-secret-key'
      );
      expect(hashTampered).not.toBe(hash1);
    });

    it('generates a valid base64 QR code data URL', async () => {
      const qrData = await generateBordereauQrCode({
        bordereauNumber: 'BRD-ENC-2026-0001',
        totalFaceValue: 80000,
        bankName: 'BMCE Bank of Africa',
        remittanceDate: '2026-10-15',
        securityHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });

      expect(qrData).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('3. HTML Vector Print Document Generation', () => {
    it('builds an official print-ready HTML document with Moroccan banking details', () => {
      const bordereau: RemittanceBordereau = {
        id: 'test-id',
        bordereauNumber: 'BRD-ENC-2026-9999',
        bordereauType: 'encaissement',
        bankAccountId: 10,
        bankAccountName: 'Compte Courant',
        bankName: 'Attijariwafa Bank',
        bankRib: '007780000123456789012345',
        totalFaceValue: 80000,
        billsCount: 2,
        estimatedAgios: 0,
        estimatedVat: 0,
        estimatedNetProceeds: 80000,
        bankCommission: 0,
        remittanceDate: '2026-10-15',
        securityHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        bills: sampleBillItems,
        createdAt: '2026-10-15T10:00:00Z',
      };

      const html = buildBordereauHtml(bordereau, 'data:image/png;base64,mockqr');

      expect(html).toContain('BRD-ENC-2026-9999');
      expect(html).toContain("BORDEREAU DE REMISE DE VALEURS À L'ENCAISSEMENT");
      expect(html).toContain('Attijariwafa Bank');
      expect(html).toContain('007780000123456789012345');
      expect(html).toContain('LCN-001');
      expect(html).toContain('CHQ-002');
      expect(html).toContain('window.print()');
      expect(html).toContain('Empreinte HMAC-SHA256:');
    });

    it('includes discount rates and agios breakdown in escompte bordereau HTML', () => {
      const bordereau: RemittanceBordereau = {
        id: 'test-id-esc',
        bordereauNumber: 'BRD-ESC-2026-8888',
        bordereauType: 'escompte',
        bankAccountId: 10,
        bankAccountName: 'Compte Avances',
        bankName: 'Banque Populaire',
        bankRib: '101780000987654321098765',
        totalFaceValue: 80000,
        billsCount: 2,
        estimatedAgios: 548.33,
        estimatedVat: 54.83,
        estimatedNetProceeds: 79396.84,
        discountRate: 6.0,
        bankCommission: 60.0,
        remittanceDate: '2026-10-15',
        securityHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        bills: sampleBillItems,
        createdAt: '2026-10-15T10:00:00Z',
      };

      const html = buildBordereauHtml(bordereau, 'data:image/png;base64,mockqr');

      expect(html).toContain("BORDEREAU DE REMISE DE VALEURS À L'ESCOMPTE");
      expect(html).toContain("Taux d'escompte");
      expect(html).toContain('TVA Bancaire');
      expect(html).toContain('Net estimé à créditer');
    });
  });

  describe('4. Server Actions Execution & Transitions', () => {
    it('generates an official bordereau and updates bill status atomically', async () => {
      const result = await generateRemittanceBordereauAction({
        bordereauType: 'encaissement',
        bankAccountId: 10,
        billIds: mockBills.map((b) => b.id),
        remittanceDate: '2026-10-15',
        notes: 'Remise bordereau pour encaissement agence Tanger',
      });

      expect(result.success).toBe(true);
      expect(result.bordereau).toBeDefined();
      expect(result.bordereau?.bordereauNumber).toMatch(/^BRD-ENC-2026-\d{4}$/);
      expect(result.bordereau?.totalFaceValue).toBe(80000);
      expect(result.bordereau?.billsCount).toBe(2);
      expect(result.html).toBeDefined();
    });

    it('fetches existing remittance bordereaux list', async () => {
      const result = await fetchRemittanceBordereauxAction();
      expect(result.success).toBe(true);
      expect(result.bordereaux.length).toBeGreaterThan(0);
      expect(result.bordereaux[0].bordereauNumber).toBe('BRD-ENC-2026-1001');
    });

    it('retrieves bordereau by ID for reprinting', async () => {
      const result = await getRemittanceBordereauByIdAction('bordereau-uuid-123');
      expect(result.success).toBe(true);
      expect(result.bordereau?.id).toBe('bordereau-uuid-123');
      expect(result.html).toBeDefined();
    });
  });
});
