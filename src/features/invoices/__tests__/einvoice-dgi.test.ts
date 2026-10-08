import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import type { Invoice, Client, TripOrder } from '@/types/database';
import {
  buildEInvoiceDocumentFromTripInvoice,
  generateUbl21Xml,
  DEFAULT_TRANS_BODANON_SUPPLIER,
} from '../services/ubl-generator.service';
import {
  buildCanonicalInvoiceString,
  generateSha256Digest,
  generateHmacSignature,
  buildDgiQrPayload,
  generateCryptographicTaxSeal,
  verifyTaxSealIntegrity,
  DGI_ARTICLE_92_NOTICE,
} from '../services/cryptographic-tax-seal.service';
import {
  sealInvoiceInVault,
  getVaultRecord,
  listVaultRecords,
  verifyVaultRecordIntegrity,
  generateDgiComplianceReport,
} from '../services/fiscal-vault.service';

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppCloudMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-dgi-101' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('E-Invoicing & DGI Tax Compliance Engine (ISO/IEC 19845 UBL 2.1)', () => {
  const mockInvoice: Invoice = {
    id: 42,
    company_id: 1,
    client_id: '101',
    invoice_number: 'FAC-2026-0042',
    total_amount: '32000.00',
    ht_amount: '32000.00',
    ttc_amount: '32000.00',
    paid_amount: '10000.00',
    currency: 'MAD',
    status: 'partially_paid',
    issue_date: '2026-10-25',
    due_date: '2026-11-25',
    input_mode: 'auto',
    trip_order_id: 901,
  };

  const mockClient: Client = {
    id: 101,
    name: 'AGRI-EXPORT NORD SARL',
    ice: '001928374000082',
    phone: '+212 539 94 12 30',
    email: 'compta@agri-export.ma',
    address: 'Zone Franche de Tanger, Lot 45',
    city: 'Tanger',
    currency: 'MAD',
    client_type: 'export',
    is_active: true,
    invoice_with_tva: false,
    shipping_address_line1: 'Zone Franche de Tanger, Lot 45',
    shipping_address_line2: '',
    shipping_address_line3: '',
    shipping_address_line4: '',
    shipping_city: 'Tanger',
    shipping_postal_code: '90000',
    shipping_country: 'Morocco',
    billing_address_line1: 'Zone Franche de Tanger, Lot 45',
    billing_address_line2: '',
    billing_address_line3: '',
    billing_address_line4: '',
    billing_city: 'Tanger',
    billing_postal_code: '90000',
    billing_country: 'Morocco',
    created_at: '2026-01-01',
  };

  const mockTrip: TripOrder = {
    id: 901,
    route: 'Tanger Med -> Algeciras',
    corridor_type: 'european_maritime',
    price: 32000,
    price_export: 32000,
    price_type: 'MAD',
    departure_date: '2026-10-25',
    status: 'delivered',
    created_at: '2026-10-20',
    client_id: 101,
    cmr_export_number: 'CMR-EXP-2026-0042',
    ferry_cost: 4600,
  };

  describe('1. Financial Precision & Article 92-I-10° CGI VAT Exemption', () => {
    it('calculates totals with Decimal.js ensuring exact line extension and payable amount', async () => {
      const doc = await buildEInvoiceDocumentFromTripInvoice({
        invoice: mockInvoice,
        client: mockClient,
        trip: mockTrip,
      });

      expect(doc.totals.lineExtensionAmount).toBe('32000.00');
      expect(doc.totals.taxExclusiveAmount).toBe('32000.00');
      expect(doc.totals.taxTotalAmount).toBe('0.00');
      expect(doc.totals.taxInclusiveAmount).toBe('32000.00');
      expect(doc.totals.paidAmount).toBe('10000.00');
      expect(doc.totals.payableAmount).toBe('22000.00');
      expect(doc.documentCurrencyCode).toBe('MAD');
    });

    it('enforces Category E (Exempt) and 0% rate under Article 92-I-10° du CGI', async () => {
      const doc = await buildEInvoiceDocumentFromTripInvoice({
        invoice: mockInvoice,
        client: mockClient,
        trip: mockTrip,
      });

      expect(doc.items[0].taxCategoryCode).toBe('E');
      expect(doc.items[0].taxRatePercent).toBe('0.00');
      expect(doc.items[0].taxAmount).toBe('0.00');
      expect(doc.items[0].exemptionReasonCode).toBe('CGI-92-I-10');
      expect(doc.items[0].cmrReference).toBe('CMR-EXP-2026-0042');

      // Trilingual legal notices
      expect(doc.seal.legalNoticeAr).toContain('92-I-10°');
      expect(doc.seal.legalNoticeFr).toContain('92-I-10°');
      expect(doc.seal.legalNoticeEs).toContain('92-I-10°');
    });
  });

  describe('2. UBL 2.1 XML Document Structure & Compliance', () => {
    it('generates valid UBL 2.1 XML with mandatory party identifiers (ICE, IF, RC, CNSS)', async () => {
      const doc = await buildEInvoiceDocumentFromTripInvoice({
        invoice: mockInvoice,
        client: mockClient,
        trip: mockTrip,
      });

      const xml = doc.xmlContent;
      expect(xml).toContain('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
      expect(xml).toContain('<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:dgi.gov.ma:einvoicing:1.0</cbc:CustomizationID>');
      expect(xml).toContain('<cbc:ID>FAC-2026-0042</cbc:ID>');
      expect(xml).toContain('<cbc:DocumentCurrencyCode>MAD</cbc:DocumentCurrencyCode>');

      // Supplier details (Trans Bodanon)
      expect(xml).toContain('<cbc:Name>TRANS BODANON SARL</cbc:Name>');
      expect(xml).toContain('<cbc:CompanyID>002345678000091</cbc:CompanyID>'); // ICE
      expect(xml).toContain('RC: 10452 Tanger | IF: 45892014 | CNSS: 7890123');

      // Customer details (Client)
      expect(xml).toContain('<cbc:Name>AGRI-EXPORT NORD SARL</cbc:Name>');
      expect(xml).toContain('<cbc:CompanyID>001928374000082</cbc:CompanyID>'); // Client ICE

      // Tax Category & Exemption
      expect(xml).toContain('<cbc:TaxExemptionReasonCode>CGI-92-I-10</cbc:TaxExemptionReasonCode>');
      expect(xml).toContain('<cbc:TaxAmount currencyID="MAD">0.00</cbc:TaxAmount>');

      // SHA-256 seal embedded in XML
      expect(xml).toContain(doc.seal.sha256Digest);
      expect(xml).toContain('<cbc:DocumentTypeCode>DGI-DIGITAL-SEAL</cbc:DocumentTypeCode>');
    });
  });

  describe('3. Cryptographic Tax Seal & QR Payload Generator', () => {
    it('produces deterministic SHA-256 hash and HMAC signature from canonical string', () => {
      const payload = {
        invoiceId: 42,
        invoiceNumber: 'FAC-2026-0042',
        sellerIce: '002345678000091',
        buyerIce: '001928374000082',
        issueTimestamp: '2026-10-25T12:00:00',
        currency: 'MAD',
        totalHt: '32000.00',
        totalTva: '0.00',
        totalTtc: '32000.00',
        isArticle92Exempt: true,
      };

      const canonical1 = buildCanonicalInvoiceString(payload);
      const canonical2 = buildCanonicalInvoiceString(payload);
      expect(canonical1).toBe(canonical2);

      const hash1 = generateSha256Digest(canonical1);
      const hash2 = generateSha256Digest(canonical2);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // Valid SHA-256 Hex

      const hmac = generateHmacSignature(hash1);
      expect(hmac).toHaveLength(64);
    });

    it('generates DGI QR payload and QR code data URI image', async () => {
      const seal = await generateCryptographicTaxSeal({
        invoiceId: 42,
        invoiceNumber: 'FAC-2026-0042',
        sellerIce: '002345678000091',
        buyerIce: '001928374000082',
        issueTimestamp: '2026-10-25T12:00:00',
        currency: 'MAD',
        totalHt: '32000.00',
        totalTva: '0.00',
        totalTtc: '32000.00',
        isArticle92Exempt: true,
      });

      expect(seal.qrPayloadRaw).toContain('DGI|002345678000091|001928374000082|FAC-2026-0042');
      expect(seal.qrPayloadRaw).toContain('ART92_EXEMPT');
      expect(seal.qrCodeDataUri).toMatch(/^data:image\/png;base64,/);
      expect(seal.verificationUrl).toContain('verify=FAC-2026-0042');
    });

    it('detects tampering when any monetary centime is altered in the payload', () => {
      const originalPayload = {
        invoiceId: 42,
        invoiceNumber: 'FAC-2026-0042',
        sellerIce: '002345678000091',
        buyerIce: '001928374000082',
        issueTimestamp: '2026-10-25T12:00:00',
        currency: 'MAD',
        totalHt: '32000.00',
        totalTva: '0.00',
        totalTtc: '32000.00',
      };

      const canonical = buildCanonicalInvoiceString(originalPayload);
      const originalDigest = generateSha256Digest(canonical);
      const originalHmac = generateHmacSignature(originalDigest);

      // 1. Untampered check
      const validCheck = verifyTaxSealIntegrity(originalPayload, originalDigest, originalHmac);
      expect(validCheck.isValid).toBe(true);
      expect(validCheck.tamperedFields).toHaveLength(0);

      // 2. Tampered amount (+0.01 MAD)
      const tamperedPayload = {
        ...originalPayload,
        totalHt: '32000.01',
        totalTtc: '32000.01',
      };
      const tamperedCheck = verifyTaxSealIntegrity(tamperedPayload, originalDigest, originalHmac);
      expect(tamperedCheck.isValid).toBe(false);
      expect(tamperedCheck.tamperedFields).toContain('amounts_or_identifiers_mismatch');
      expect(tamperedCheck.tamperedFields).toContain('digital_signature_invalid');
    });
  });

  describe('4. Tamper-Evident Fiscal Vault & Anti-Fraud Forensic Audit', () => {
    it('seals invoice in vault and verifies compliance without alterations', async () => {
      const doc = await buildEInvoiceDocumentFromTripInvoice({
        invoice: mockInvoice,
        client: mockClient,
        trip: mockTrip,
      });

      const vaultRecord = await sealInvoiceInVault({
        invoiceId: mockInvoice.id,
        invoiceNumber: mockInvoice.invoice_number,
        sellerIce: doc.supplier.ice,
        buyerIce: doc.customer.ice,
        issueDate: doc.issueDate,
        currency: doc.documentCurrencyCode,
        totalHt: doc.totals.taxExclusiveAmount,
        totalTtc: doc.totals.taxInclusiveAmount,
        seal: doc.seal,
        ublXmlContent: doc.xmlContent,
      });

      expect(vaultRecord.invoiceNumber).toBe('FAC-2026-0042');
      expect(vaultRecord.complianceStatus).toBe('compliant');
      expect(vaultRecord.tamperCount).toBe(0);

      // Verification should succeed
      const audit = verifyVaultRecordIntegrity('FAC-2026-0042', {
        totalHt: '32000.00',
        totalTtc: '32000.00',
        currency: 'MAD',
        buyerIce: '001928374000082',
      });

      expect(audit.isCompliant).toBe(true);
      expect(audit.status).toBe('compliant');
      expect(audit.tamperedFields).toHaveLength(0);
    });

    it('flags tampered status and records audit infraction if live invoice data is altered', async () => {
      const audit = verifyVaultRecordIntegrity('FAC-2026-0042', {
        totalHt: '35000.00', // Modified without authorization!
        totalTtc: '35000.00',
        currency: 'MAD',
      });

      expect(audit.isCompliant).toBe(false);
      expect(audit.status).toBe('tampered');
      expect(audit.record?.tamperCount).toBeGreaterThan(0);
      expect(audit.tamperedFields.some((f) => f.includes('total_ht_mismatch'))).toBe(true);
    });

    it('generates aggregated DGI Compliance Report with accurate counts and ratios', () => {
      const report = generateDgiComplianceReport('2026-Q4');
      expect(report.totalInvoicesCount).toBeGreaterThan(0);
      expect(new Decimal(report.totalHtMad).toNumber()).toBeGreaterThan(0);
      expect(new Decimal(report.totalVatExemptMad).toNumber()).toBeGreaterThan(0);
      expect(report.period).toBe('2026-Q4');
    });
  });
});

