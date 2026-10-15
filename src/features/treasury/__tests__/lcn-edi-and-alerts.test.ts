import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  amountToSimtCentimes,
  generateSimtLcnEdiFile,
  generateIso20022LcnXml,
  buildCommercialBillWhatsAppAlert,
} from '../services/lcn-edi-and-alerts.service';
import { exportBordereauEdiAction } from '../services/remittance-bordereau.actions';
import {
  createCommercialBillAction,
  bounceCommercialBillAction,
  sendCommercialBillWhatsAppAlertAction,
  clearCommercialBillsCache,
} from '../services/commercial-bills.actions';
import type { RemittanceBordereau } from '../types/remittance-bordereau.types';
import type { CommercialBill } from '../types/commercial-bills.types';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null, error: { code: '42P01', message: 'Offline' } })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    })),
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn(async () => undefined),
}));

const sampleBordereau: RemittanceBordereau = {
  id: '99999999-1111-2222-3333-444444444444',
  bordereauNumber: 'BRD-ESC-2026-8821',
  bordereauType: 'escompte',
  bankAccountId: 1,
  bankAccountName: 'Attijariwafa Bank Corporate',
  bankName: 'Attijariwafa Bank',
  bankRib: '007640000123456789012345',
  totalFaceValue: 185000.75,
  billsCount: 2,
  estimatedAgios: 1450.25,
  estimatedVat: 145.03,
  estimatedNetProceeds: 183405.47,
  discountRate: 5.5,
  bankCommission: 50,
  remittanceDate: '2026-10-16',
  securityHash: 'A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90',
  createdAt: '2026-10-16T10:00:00.000Z',
  companyInfo: {
    name: 'TRANS BODANON SARL AU',
    ice: '003291823000045',
  },
  bills: [
    {
      id: 'bill-1',
      billNumber: 'LCN-9001',
      billType: 'lcn_promissory_note',
      clientName: 'ATLAS FRUITS EXPORT',
      drawerBankName: 'Banque Populaire',
      drawerBankRib: '101780000987654321098765',
      issueDate: '2026-10-01',
      dueDate: '2026-12-15',
      faceValue: 120000.5,
      daysToMaturity: 60,
      estimatedAgios: 950.15,
    },
    {
      id: 'bill-2',
      billNumber: 'CHQ-4412',
      billType: 'cheque',
      clientName: 'AGRO Souss SARL',
      drawerBankName: 'BMCE Bank of Africa',
      drawerBankRib: '011810000112233445566778',
      issueDate: '2026-10-05',
      dueDate: '2026-11-30',
      faceValue: 65000.25,
      daysToMaturity: 45,
      estimatedAgios: 500.1,
    },
  ],
};

describe('LCN Electronic Teletransmission (SIMT / ISO 20022 XML) & WhatsApp Alerts Engine', () => {
  beforeEach(async () => {
    await clearCommercialBillsCache();
  });

  it('converts MAD amounts to 15-digit zero-padded SIMT centimes using Decimal.js without float drift', () => {
    expect(amountToSimtCentimes(120000.5, 15)).toBe('000000012000050');
    expect(amountToSimtCentimes(19.99, 15)).toBe('000000000001999');
    expect(amountToSimtCentimes(0.1 + 0.2, 15)).toBe('000000000000030');
  });

  it('generates valid 160-character fixed-width Bank Al-Maghrib SIMT LCN records', () => {
    const simt = generateSimtLcnEdiFile(sampleBordereau);

    expect(simt.filename).toBe('SIMT_LCN_BRD-ESC-2026-8821.simt');
    expect(simt.recordCount).toBe(4); // 1 header ('03') + 2 details ('06') + 1 footer ('08')
    expect(simt.totalCentimes).toBe('000000018500075');
    expect(simt.securityHash).toHaveLength(64);

    const lines = simt.content.split('\r\n');
    expect(lines).toHaveLength(4);

    // Every single line in SIMT must be strictly 160 characters
    for (const line of lines) {
      expect(line.length).toBe(160);
    }

    // Header starts with 03 + 061 (escompte) + 20261016
    expect(lines[0].startsWith('0306120261016007')).toBe(true);
    // Detail 1 starts with 06000001LCNLCN-9001
    expect(lines[1].startsWith('06000001LCNLCN-9001')).toBe(true);
    // Detail 2 starts with 06000002CHQCHQ-4412
    expect(lines[2].startsWith('06000002CHQCHQ-4412')).toBe(true);
    // Footer starts with 08000002000000018500075
    expect(lines[3].startsWith('08000002000000018500075')).toBe(true);
  });

  it('generates valid ISO 20022 pain.008.001.02 XML for Moroccan corporate e-banking portals', () => {
    const xmlRes = generateIso20022LcnXml(sampleBordereau);

    expect(xmlRes.filename).toBe('ISO20022_LCN_BRD-ESC-2026-8821.xml');
    expect(xmlRes.controlSum).toBe('185000.75');
    expect(xmlRes.content).toContain('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">');
    expect(xmlRes.content).toContain('<MsgId>BRD-ESC-2026-8821</MsgId>');
    expect(xmlRes.content).toContain('<CtrlSum>185000.75</CtrlSum>');
    expect(xmlRes.content).toContain('<InstdAmt Ccy="MAD">120000.50</InstdAmt>');
    expect(xmlRes.content).toContain('<InstdAmt Ccy="MAD">65000.25</InstdAmt>');
    expect(xmlRes.content).toContain('<Prtry>SIMT_LCN_ESCOMPTE</Prtry>');
    expect(xmlRes.content).toContain(sampleBordereau.securityHash);
  });

  it('exports SIMT and ISO 20022 XML via exportBordereauEdiAction server action', async () => {
    const simtActionRes = await exportBordereauEdiAction(
      sampleBordereau.id,
      'simt',
      sampleBordereau
    );
    expect(simtActionRes.success).toBe(true);
    expect(simtActionRes.filename).toBe('SIMT_LCN_BRD-ESC-2026-8821.simt');
    expect(simtActionRes.content?.split('\r\n')).toHaveLength(4);

    const xmlActionRes = await exportBordereauEdiAction(
      sampleBordereau.id,
      'xml',
      sampleBordereau
    );
    expect(xmlActionRes.success).toBe(true);
    expect(xmlActionRes.filename).toBe('ISO20022_LCN_BRD-ESC-2026-8821.xml');
    expect(xmlActionRes.content).toContain('<CstmrDrctDbtInitn>');
  });

  it('builds trilingual (AR/FR/ES) WhatsApp maturity reminders and bounced bill alerts with exact Decimal.js claim totals', () => {
    const sampleBill: CommercialBill = {
      id: 'bill-test-99',
      billType: 'lcn_promissory_note',
      billNumber: 'LCN-7755',
      clientName: 'MAROC AGRI EXPORT',
      drawerBankName: 'CIH Bank',
      drawerBankRib: '310780000123456789012345',
      faceValue: 45000.5,
      currency: 'MAD',
      issueDate: '2026-09-15',
      dueDate: '2026-10-20',
      status: 'bounced_unpaid',
      discountFee: 0,
      bounceReason: 'Provision insuffisante',
      bounceDate: '2026-10-21',
      bounceFee: 250.75,
      allocatedInvoiceIds: [],
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-10-21T00:00:00Z',
    };

    const reminderAr = buildCommercialBillWhatsAppAlert(sampleBill, 'maturity_reminder', 'ar');
    expect(reminderAr.totalClaimableAmount).toBe(45000.5);
    expect(reminderAr.message).toContain('LCN-7755');
    expect(reminderAr.message).toContain('45000.50 MAD');

    const reminderFr = buildCommercialBillWhatsAppAlert(sampleBill, 'maturity_reminder', 'fr');
    expect(reminderFr.message).toContain("RAPPEL D'ÉCHÉANCE");
    expect(reminderFr.message).toContain('45000.50 MAD');

    const bounceEs = buildCommercialBillWhatsAppAlert(sampleBill, 'bounced_alert', 'es');
    expect(bounceEs.totalClaimableAmount).toBe(45251.25); // 45000.50 + 250.75 via Decimal.js
    expect(bounceEs.message).toContain('ALERTA DE IMPAGO');
    expect(bounceEs.message).toContain('45251.25 MAD');
  });

  it('dispatches proactive WhatsApp alert via sendCommercialBillWhatsAppAlertAction', async () => {
    const created = await createCommercialBillAction({
      billType: 'lcn_promissory_note',
      billNumber: 'LCN-WA-2026',
      clientName: 'TANGER FRESH LOGISTICS',
      drawerBankName: 'Attijariwafa Bank',
      faceValue: 75000,
      dueDate: '2026-11-10',
    });
    expect(created.success).toBe(true);
    const billId = created.data!.id;

    // Bounce bill with 180 MAD bank rejection fee
    await bounceCommercialBillAction({
      billId,
      bounceReason: 'Compte clôturé',
      bounceFee: 180,
    });

    const waRes = await sendCommercialBillWhatsAppAlertAction({
      billId,
      recipientPhone: '212661234567',
      alertType: 'bounced_alert',
      locale: 'fr',
    });

    expect(waRes.success).toBe(true);
    expect(waRes.totalClaimableAmount).toBe(75180);
    expect(waRes.messageText).toContain('LCN-WA-2026');
    expect(waRes.messageText).toContain('75180.00 MAD');
    expect(waRes.whatsappLink).toContain('https://wa.me/212661234567');
  });
});

