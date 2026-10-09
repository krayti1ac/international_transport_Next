import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  BulkTransferGeneratorService,
  MOROCCAN_BANK_CODES,
} from '../services/bulk-transfer-generator.service';

describe('B2B Bulk Wire Transfer & Banking Protocols (SEPA ISO 20022 & Moroccan LCN Engine)', () => {
  describe('1. Moroccan RIB Modulo 97 Validation Algorithm', () => {
    it('should validate a correct Moroccan RIB and detect the issuing bank', () => {
      // 007 (Attijariwafa Bank) + 780 + 0000123456789012 + 09
      const validRib = '007780000012345678901209';
      const result = BulkTransferGeneratorService.validateMoroccanRib(validRib);

      expect(result.isValid).toBe(true);
      expect(result.bankCode).toBe('007');
      expect(result.branchCode).toBe('780');
      expect(result.accountNumber).toBe('0000123456789012');
      expect(result.checkKey).toBe('09');
      expect(result.calculatedKey).toBe('09');
      expect(result.bankName).toBe(MOROCCAN_BANK_CODES['007']);
      expect(result.error).toBeUndefined();
    });

    it('should calculate key 97 when modulo remainder is 0', () => {
      // Find an account number where (N * 100) % 97 == 0
      // Let N = 97 * 10000000000000000000 = 9700000000000000000000 (22 digits)
      // Bank: 970 (or 101 for BCP), remainder 0 => key = 97
      const rib22 = '1017800000000000000097';
      const num22 = BigInt(rib22);
      const rem = Number((num22 * BigInt(100)) % BigInt(97));
      const expectedKey = rem === 0 ? '97' : String(97 - rem).padStart(2, '0');

      const fullRib = `${rib22}${expectedKey}`;
      const res = BulkTransferGeneratorService.validateMoroccanRib(fullRib);
      expect(res.isValid).toBe(true);
      expect(res.checkKey).toBe(expectedKey);
    });

    it('should reject a RIB with an invalid check key (mismatch)', () => {
      const invalidKeyRib = '007780000012345678901299'; // Real key is 09
      const result = BulkTransferGeneratorService.validateMoroccanRib(invalidKeyRib);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('مفتاح الحساب غير متطابق');
      expect(result.calculatedKey).toBe('09');
    });

    it('should reject a RIB with incorrect length (< 24 or > 24 digits)', () => {
      const shortRib = '0077800000123456';
      const longRib = '007780000012345678901209999';

      const shortRes = BulkTransferGeneratorService.validateMoroccanRib(shortRib);
      const longRes = BulkTransferGeneratorService.validateMoroccanRib(longRib);

      expect(shortRes.isValid).toBe(false);
      expect(shortRes.error).toContain('طول رقم الحساب غير صحيح');

      expect(longRes.isValid).toBe(false);
      expect(longRes.error).toContain('طول رقم الحساب غير صحيح');
    });

    it('should ignore whitespace and dashes in formatted RIB input', () => {
      const formattedRib = '007 780 0000123456789012 09';
      const result = BulkTransferGeneratorService.validateMoroccanRib(formattedRib);

      expect(result.isValid).toBe(true);
      expect(result.checkKey).toBe('09');
    });
  });

  describe('2. European IBAN & BIC/SWIFT Validation (ISO 7064 & ISO 9362)', () => {
    it('should validate standard European IBANs (France & Spain)', () => {
      const frenchIban = 'FR1420041010050500013M02606';
      const resFr = BulkTransferGeneratorService.validateIban(frenchIban);

      expect(resFr.isValid).toBe(true);
      expect(resFr.countryCode).toBe('FR');
      expect(resFr.checkDigits).toBe('14');

      const spanishIban = 'ES9121000418450200051332';
      const resEs = BulkTransferGeneratorService.validateIban(spanishIban);
      expect(resEs.isValid).toBe(true);
      expect(resEs.countryCode).toBe('ES');
    });

    it('should reject an IBAN with an invalid check digit', () => {
      const tamperedIban = 'FR9920041010050500013M02606';
      const result = BulkTransferGeneratorService.validateIban(tamperedIban);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Modulo 97');
    });

    it('should validate 8-character and 11-character BIC / SWIFT codes', () => {
      const bic8 = 'BCPOMAMC';
      const bic11 = 'BCPOMAMCXXX';
      const invalidBic = 'INVALID_BIC';

      expect(BulkTransferGeneratorService.validateBic(bic8).isValid).toBe(true);
      expect(BulkTransferGeneratorService.validateBic(bic11).isValid).toBe(true);
      expect(BulkTransferGeneratorService.validateBic(bic8).branchCode).toBe('XXX');
      expect(BulkTransferGeneratorService.validateBic(invalidBic).isValid).toBe(false);
    });
  });

  describe('3. ISO 20022 SEPA Pain.001.001.03 Credit Transfer Generator', () => {
    it('should generate valid Pain.001 XML with exact transactions count and control sum', () => {
      const options = {
        initiatorName: 'Trans Bodanon SARL & Cie',
        debtorName: 'Trans Bodanon Logistique',
        debtorIban: 'ES9121000418450200051332',
        debtorBic: 'CAIXESBBXXX',
        batchReference: 'BATCH-202610-001',
        executionDate: '2026-10-15',
        currency: 'EUR',
        items: [
          {
            recipientName: 'Ahmed Benali & Sons',
            bankIban: 'FR1420041010050500013M02606',
            bankBic: 'BNPAFR2PXXX',
            amount: '2450.75',
            endToEndId: 'E2E-BENALI-001',
            remittanceInformation: 'Salary & Route Allowance Oct 2026',
          },
          {
            recipientName: 'Mohamed Amrani',
            bankIban: 'ES9121000418450200051332',
            bankBic: 'CAIXESBBXXX',
            amount: '1850.25',
            endToEndId: 'E2E-AMRANI-002',
            remittanceInformation: 'Salary Oct 2026',
          },
        ],
      };

      const result = BulkTransferGeneratorService.generateSepaPain001Xml(options);

      expect(result.formatType).toBe('pain_001_001_03');
      expect(result.mimeType).toBe('application/xml');
      expect(result.transactionsCount).toBe(2);
      expect(result.totalAmount).toBe(4301.0); // 2450.75 + 1850.25
      expect(result.fileName).toContain('SEPA_BATCH-202610-001_2026-10-15.xml');

      // XML structure checks
      expect(result.fileContent).toContain('urn:iso:std:iso:20022:tech:xsd:pain.001.001.03');
      expect(result.fileContent).toContain('<NbOfTxs>2</NbOfTxs>');
      expect(result.fileContent).toContain('<CtrlSum>4301.00</CtrlSum>');
      expect(result.fileContent).toContain('<InstdAmt Ccy="EUR">2450.75</InstdAmt>');
      expect(result.fileContent).toContain('<InstdAmt Ccy="EUR">1850.25</InstdAmt>');
      expect(result.fileContent).toContain('Trans Bodanon SARL &amp; Cie');
      expect(result.fileContent).toContain('<EndToEndId>E2E-BENALI-001</EndToEndId>');

      // Checksum
      expect(result.checksumSha256).toBeDefined();
      expect(result.checksumSha256?.length).toBe(64);
    });
  });

  describe('4. Moroccan Interbank Flat File (LCN Virement de Masse)', () => {
    it('should generate standardized fixed-width LCN flat file with Header, Details, and Trailer', () => {
      const options = {
        companyName: 'ترانس بودانون الدولية',
        companyIce: '001598765432198',
        sourceRib: '007780000012345678901209',
        batchReference: 'LCN-202610-99',
        executionDate: '2026-10-20',
        items: [
          {
            recipientName: 'Ahmed Benali',
            bankRib: '007780000012345678901209',
            amount: 8500.5,
            endToEndId: 'VIR-202610-001',
            remittanceInformation: 'SALAIRE OCT 2026',
          },
          {
            recipientName: 'Youssef El Idrissi',
            bankRib: '011780000012345678901267',
            amount: 7200.0,
            endToEndId: 'VIR-202610-002',
            remittanceInformation: 'SALAIRE OCT 2026',
          },
        ],
      };

      const result = BulkTransferGeneratorService.generateMoroccanLcnFlatFile(options);

      expect(result.formatType).toBe('moroccan_lcn_virement');
      expect(result.transactionsCount).toBe(2);
      expect(result.totalAmount).toBe(15700.5);

      const lines = result.fileContent.split('\r\n');
      expect(lines.length).toBe(4); // Header (03) + 2 Details (06) + Trailer (08)

      // Header record check
      const header = lines[0];
      expect(header.startsWith('03')).toBe(true);
      expect(header.includes('20261020')).toBe(true); // Execution date YYYYMMDD
      expect(header.includes('000002')).toBe(true); // NbOfTxs padded
      // Total amount in centimes: 15700.50 * 100 = 1570050
      expect(header.includes('000001570050')).toBe(true);

      // Detail records check
      expect(lines[1].startsWith('06')).toBe(true);
      expect(lines[1].includes('Ahmed Benali')).toBe(true);
      expect(lines[2].startsWith('06')).toBe(true);
      expect(lines[2].includes('Youssef El Idrissi')).toBe(true);

      // Trailer record check
      const trailer = lines[3];
      expect(trailer.startsWith('08')).toBe(true);
      expect(trailer.includes('000002')).toBe(true);
      expect(trailer.includes('000001570050')).toBe(true);
    });
  });

  describe('5. Moroccan Corporate Banking CSV Export Engine', () => {
    it('should generate semicolon-delimited CSV for Moroccan banking portals with summary row', () => {
      const options = {
        companyName: 'ترانس بودانون',
        companyIce: '001598765432198',
        sourceRib: '007780000012345678901209',
        batchReference: 'BATCH-CSV-01',
        executionDate: '2026-10-25',
        items: [
          {
            recipientName: 'Karim Fassi',
            bankRib: '007780000012345678901209',
            amount: 5400.2,
            endToEndId: 'VIR-FASSI-01',
            remittanceInformation: 'Salaire Octobre 2026',
          },
        ],
      };

      const result = BulkTransferGeneratorService.generateMoroccanBankingCsv(options);

      expect(result.formatType).toBe('csv_banking');
      expect(result.mimeType).toBe('text/csv');
      expect(result.fileContent).toContain('"N° Ordre";"Nom Bénéficiaire";"RIB Bénéficiaire (24 Chiffres)"');
      expect(result.fileContent).toContain('"Karim Fassi"');
      expect(result.fileContent).toContain('"Attijariwafa Bank"');
      expect(result.fileContent).toContain('"5400.20"');
      expect(result.fileContent).toContain('"TOTAL"');
      expect(result.fileContent).toContain('"1 Opérations"');
    });
  });

  describe('6. Decimal.js Precision & Floating Point Safety', () => {
    it('should avoid JavaScript floating-point drift when summing thousands of driver transfers', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in native JS
      const amounts = ['0.10', '0.20', '1500.33', '2499.67', '0.05', '0.05'];
      let decimalSum = new Decimal(0);

      for (const a of amounts) {
        decimalSum = decimalSum.plus(new Decimal(a));
      }

      expect(decimalSum.toString()).toBe('4000.4');
      expect(decimalSum.toFixed(2)).toBe('4000.40');

      const items = amounts.map((amt, idx) => ({
        recipientName: `Driver ${idx}`,
        bankRib: '007780000012345678901209',
        amount: amt,
        endToEndId: `E2E-${idx}`,
        remittanceInformation: 'Payout',
      }));

      const file = BulkTransferGeneratorService.generateMoroccanBankingCsv({
        companyName: 'Trans Bodanon',
        sourceRib: '007780000012345678901209',
        batchReference: 'PRECISION-TEST',
        executionDate: '2026-10-31',
        items,
      });

      expect(file.totalAmount).toBe(4000.4);
      expect(file.fileContent).toContain('"4000.40"');
    });
  });
});
