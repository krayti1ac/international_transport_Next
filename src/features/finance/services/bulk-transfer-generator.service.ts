/**
 * Trans Bodanon TMS — Bulk Wire Transfer & Banking Protocols Generator Service
 * ISO 20022 Pain.001.001.03 Credit Transfer & Moroccan Interbank Virement / LCN Engine
 */

import crypto from 'node:crypto';
import Decimal from 'decimal.js';
import type {
  BicValidationResult,
  GeneratedTransferFile,
  IbanValidationResult,
  MoroccanLcnOptions,
  RibValidationResult,
  SepaPain001Options,
} from '../types/bulk-transfer.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const MOROCCAN_BANK_CODES: Record<string, string> = {
  '007': 'Attijariwafa Bank',
  '011': 'Bank of Africa (BMCE)',
  '013': 'BMCI (BNP Paribas)',
  '021': 'Crédit du Maroc',
  '022': 'Société Générale Maroc (SGMB)',
  '101': 'Banque Populaire (BCP)',
  '181': 'Banque Centrale Populaire',
  '190': 'Banque Populaire Régionale',
  '230': 'CFG Bank',
  '310': 'CIH Bank',
  '350': 'Al Barid Bank',
  '019': 'Arab Bank Maroc',
  '027': 'Citibank Maghreb',
};

export class BulkTransferGeneratorService {
  /**
   * خوارزمية فحص الحساب المغربي (RIB Modulo 97 Check) لضمان سلامة الـ 24 رقماً
   * Formula: Key = 97 - ((RIB_1..22 * 100) % 97)
   */
  public static validateMoroccanRib(rawRib: string): RibValidationResult {
    if (!rawRib) {
      return { isValid: false, error: 'رقم الحساب البنكي (RIB) فارغ' };
    }

    const cleaned = rawRib.replace(/\D/g, '');
    if (cleaned.length !== 24) {
      return {
        isValid: false,
        error: `طول رقم الحساب غير صحيح (${cleaned.length} رقماً، المطلوب 24 رقماً)`,
      };
    }

    const bankCode = cleaned.slice(0, 3);
    const branchCode = cleaned.slice(3, 6);
    const accountNumber = cleaned.slice(6, 22);
    const actualKey = cleaned.slice(22, 24);
    const rib22 = cleaned.slice(0, 22);

    try {
      const num22 = BigInt(rib22);
      const remainder = Number((num22 * BigInt(100)) % BigInt(97));
      const calculatedKeyNum = remainder === 0 ? 97 : 97 - remainder;
      const calculatedKey = String(calculatedKeyNum).padStart(2, '0');

      const isValid = actualKey === calculatedKey;
      const bankName = MOROCCAN_BANK_CODES[bankCode] || 'بنك مغربي معتمد';

      return {
        isValid,
        bankCode,
        branchCode,
        accountNumber,
        checkKey: actualKey,
        calculatedKey,
        bankName,
        error: isValid ? undefined : `مفتاح الحساب غير متطابق (الموجود: ${actualKey}، المحسوب: ${calculatedKey})`,
      };
    } catch {
      return { isValid: false, error: 'فشل في الحساب الرياضي لمفتاح RIB' };
    }
  }

  /**
   * خوارزمية فحص الحساب الدولي (IBAN Modulo 97 Check - ISO 7064 Mod 97-10)
   */
  public static validateIban(rawIban: string): IbanValidationResult {
    if (!rawIban) {
      return { isValid: false, error: 'رقم IBAN فارغ' };
    }

    const cleaned = rawIban.replace(/[\s-]/g, '').toUpperCase();
    if (cleaned.length < 15 || cleaned.length > 34) {
      return {
        isValid: false,
        error: `طول رقم IBAN غير صحيح (${cleaned.length} حرفاً/رقماً)`,
      };
    }

    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) {
      return { isValid: false, error: 'تنسيق IBAN يحتوي على رموز غير مسموحة' };
    }

    const countryCode = cleaned.slice(0, 2);
    const checkDigits = cleaned.slice(2, 4);
    const bban = cleaned.slice(4);

    try {
      const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
      const digits = rearranged.replace(/[A-Z]/g, (ch) =>
        (ch.charCodeAt(0) - 55).toString()
      );

      const isValid = BigInt(digits) % BigInt(97) === BigInt(1);

      return {
        isValid,
        countryCode,
        checkDigits,
        bban,
        error: isValid ? undefined : 'مفتاح التحقق من IBAN غير سليم (Modulo 97)',
      };
    } catch {
      return { isValid: false, error: 'فشل في التحقق الحسابي من IBAN' };
    }
  }

  /**
   * التحقق من سلامة رمز BIC / SWIFT البنكي الدولي (ISO 9362)
   */
  public static validateBic(rawBic?: string): BicValidationResult {
    if (!rawBic) {
      return { isValid: false, error: 'رمز BIC/SWIFT فارغ' };
    }

    const cleaned = rawBic.replace(/[\s-]/g, '').toUpperCase();
    const bicRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

    if (!bicRegex.test(cleaned)) {
      return {
        isValid: false,
        error: 'صيغة BIC/SWIFT غير مطابقة للمعايير الدولية (8 أو 11 حرفاً)',
      };
    }

    return {
      isValid: true,
      bankCode: cleaned.slice(0, 4),
      countryCode: cleaned.slice(4, 6),
      locationCode: cleaned.slice(6, 8),
      branchCode: cleaned.length === 11 ? cleaned.slice(8, 11) : 'XXX',
    };
  }

  /**
   * توليد ملف تحويلات SEPA القياسي (ISO 20022 Pain.001.001.03)
   */
  public static generateSepaPain001Xml(options: SepaPain001Options): GeneratedTransferFile {
    const currency = options.currency || 'EUR';
    let totalSum = new Decimal(0);

    for (const item of options.items) {
      totalSum = totalSum.plus(new Decimal(item.amount));
    }

    const ctrlSum = totalSum.toFixed(2);
    const nbOfTxs = options.items.length;
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const cleanBatchRef = options.batchReference.replace(/[^A-Za-z0-9_-]/g, '');

    const debtorIbanClean = options.debtorIban.replace(/[\s-]/g, '').toUpperCase();
    const debtorBicClean = options.debtorBic.replace(/[\s-]/g, '').toUpperCase();

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const txXmlParts: string[] = [];

    for (const item of options.items) {
      const itemAmount = new Decimal(item.amount).toFixed(2);
      const cleanIban = item.bankIban.replace(/[\s-]/g, '').toUpperCase();
      const cleanBic = item.bankBic?.replace(/[\s-]/g, '').toUpperCase();

      txXmlParts.push(`      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(item.endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${currency}">${itemAmount}</InstdAmt>
        </Amt>
        ${
          cleanBic
            ? `<CdtrAgt>
          <FinInstnId>
            <BIC>${cleanBic}</BIC>
          </FinInstnId>
        </CdtrAgt>`
            : `<CdtrAgt>
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>
        </CdtrAgt>`
        }
        <Cdtr>
          <Nm>${escapeXml(item.recipientName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${cleanIban}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(item.remittanceInformation)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`);
    }

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${cleanBatchRef}</MsgId>
      <CreDtTm>${nowIso}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(options.initiatorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${cleanBatchRef}-PMT-01</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${options.executionDate}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(options.debtorName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${debtorIbanClean}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${debtorBicClean}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
${txXmlParts.join('\n')}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

    const fileName = `SEPA_${cleanBatchRef}_${options.executionDate}.xml`;
    const checksumSha256 = this.calculateFileChecksum(xmlContent);

    return {
      fileName,
      fileContent: xmlContent,
      formatType: 'pain_001_001_03',
      mimeType: 'application/xml',
      transactionsCount: nbOfTxs,
      totalAmount: totalSum.toNumber(),
      currency,
      checksumSha256,
    };
  }

  /**
   * توليد ملف التنسيق البنكي المغربي الثابت (Moroccan Interbank Flat File - LCN / Virement de Masse)
   */
  public static generateMoroccanLcnFlatFile(options: MoroccanLcnOptions): GeneratedTransferFile {
    let totalSum = new Decimal(0);
    for (const item of options.items) {
      totalSum = totalSum.plus(new Decimal(item.amount));
    }

    const nbOfTxs = options.items.length;
    const cleanSourceRib = options.sourceRib.replace(/\D/g, '').padEnd(24, '0').slice(0, 24);
    const sourceBankCode = cleanSourceRib.slice(0, 3);
    const sourceAccount = cleanSourceRib.slice(6, 22);
    const dateFormatted = options.executionDate.replace(/-/g, ''); // YYYYMMDD
    const totalCentimes = totalSum.times(100).toFixed(0);

    const cleanBatchRef = options.batchReference.replace(/[^A-Za-z0-9_-]/g, '');

    // Header Record (Type 03)
    const headerLine = [
      '03',
      sourceBankCode.padEnd(3, ' '),
      dateFormatted.padEnd(8, ' '),
      sourceAccount.padEnd(16, ' '),
      String(nbOfTxs).padStart(6, '0'),
      totalCentimes.padStart(12, '0'),
      cleanBatchRef.padEnd(16, ' ').slice(0, 16),
      (options.companyIce || '').padEnd(15, ' ').slice(0, 15),
      ''.padEnd(44, ' '),
    ].join('');

    // Detail Records (Type 06)
    const detailLines: string[] = [];
    for (let i = 0; i < options.items.length; i++) {
      const item = options.items[i];
      const cleanBeneficiaryRib = item.bankRib.replace(/\D/g, '').padEnd(24, '0').slice(0, 24);
      const itemCentimes = new Decimal(item.amount).times(100).toFixed(0);
      const beneficiaryName = item.recipientName.padEnd(30, ' ').slice(0, 30);
      const e2eRef = item.endToEndId.padEnd(16, ' ').slice(0, 16);
      const motif = item.remittanceInformation.padEnd(30, ' ').slice(0, 30);

      const line = [
        '06',
        cleanBeneficiaryRib,
        beneficiaryName,
        itemCentimes.padStart(12, '0'),
        e2eRef,
        motif,
        String(i + 1).padStart(6, '0'),
      ].join('');

      detailLines.push(line);
    }

    // Trailer Record (Type 08)
    const trailerLine = [
      '08',
      String(nbOfTxs).padStart(6, '0'),
      totalCentimes.padStart(12, '0'),
      ''.padEnd(102, ' '),
    ].join('');

    const flatContent = [headerLine, ...detailLines, trailerLine].join('\r\n');
    const fileName = `LCN_VIREMENT_${cleanBatchRef}_${options.executionDate}.txt`;
    const checksumSha256 = this.calculateFileChecksum(flatContent);

    return {
      fileName,
      fileContent: flatContent,
      formatType: 'moroccan_lcn_virement',
      mimeType: 'text/plain',
      transactionsCount: nbOfTxs,
      totalAmount: totalSum.toNumber(),
      currency: 'MAD',
      checksumSha256,
    };
  }

  /**
   * توليد ملف CSV المعتمد لدى البنوك المغربية (Attijari Entreprises, BCP Direct, BMCE)
   */
  public static generateMoroccanBankingCsv(options: MoroccanLcnOptions): GeneratedTransferFile {
    let totalSum = new Decimal(0);
    for (const item of options.items) {
      totalSum = totalSum.plus(new Decimal(item.amount));
    }

    const nbOfTxs = options.items.length;
    const cleanBatchRef = options.batchReference.replace(/[^A-Za-z0-9_-]/g, '');

    const header = [
      'N° Ordre',
      'Nom Bénéficiaire',
      'RIB Bénéficiaire (24 Chiffres)',
      'Banque Bénéficiaire',
      'Montant (MAD)',
      'Référence Virement',
      'Motif / Remise',
      'Date Exécution',
    ]
      .map((col) => `"${col}"`)
      .join(';');

    const rows: string[] = [];

    for (let i = 0; i < options.items.length; i++) {
      const item = options.items[i];
      const cleanRib = item.bankRib.replace(/\D/g, '');
      const bankCode = cleanRib.slice(0, 3);
      const bankName = MOROCCAN_BANK_CODES[bankCode] || 'Autre Banque';
      const itemAmount = new Decimal(item.amount).toFixed(2);

      const row = [
        `"${i + 1}"`,
        `"${item.recipientName.replace(/"/g, '""')}"`,
        `"${cleanRib}"`,
        `"${bankName}"`,
        `"${itemAmount}"`,
        `"${item.endToEndId.replace(/"/g, '""')}"`,
        `"${item.remittanceInformation.replace(/"/g, '""')}"`,
        `"${options.executionDate}"`,
      ].join(';');

      rows.push(row);
    }

    const footer = [
      '"TOTAL"',
      `"${nbOfTxs} Opérations"`,
      '""',
      '""',
      `"${totalSum.toFixed(2)}"`,
      '""',
      '""',
      '""',
    ].join(';');

    const csvContent = [header, ...rows, footer].join('\r\n');
    const fileName = `VIREMENT_MASSE_${cleanBatchRef}_${options.executionDate}.csv`;
    const checksumSha256 = this.calculateFileChecksum(csvContent);

    return {
      fileName,
      fileContent: csvContent,
      formatType: 'csv_banking',
      mimeType: 'text/csv',
      transactionsCount: nbOfTxs,
      totalAmount: totalSum.toNumber(),
      currency: 'MAD',
      checksumSha256,
    };
  }

  /**
   * احتساب بصمة التشفير الرقمي SHA-256 للملف للتأكد من سلامته وعدم التلاعب به
   */
  public static calculateFileChecksum(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
