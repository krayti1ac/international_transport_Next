import Decimal from 'decimal.js';
import type {
  ParsedBankStatement,
  ParsedStatementTransaction,
  BankStatementFormat,
  DebitCreditMark,
  StatementBalance,
} from '../types/bank-statement.types';
import { parseCsvStatement, parseOfxStatement, type ParsedBankRow } from './bank-parser';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInstance = InstanceType<typeof Decimal>;

/**
 * Format two-digit year (YYMMDD) to full ISO date (YYYY-MM-DD)
 */
export function parseSwfDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 6) {
    return new Date().toISOString().split('T')[0];
  }
  const yy = parseInt(dateStr.slice(0, 2), 10);
  const mm = dateStr.slice(2, 4);
  const dd = dateStr.slice(4, 6);
  // Assume 2000s for 00-79, 1900s for 80-99
  const yyyy = yy < 80 ? 2000 + yy : 1900 + yy;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Safe amount parsing using Decimal.js
 * Handles comma as decimal separator (standard in SWIFT MT940 & CAMT)
 */
export function parseDecimalAmount(amountStr: string): DecimalInstance {
  if (!amountStr) return new Decimal(0);
  const cleaned = amountStr.trim().replace(/\s+/g, '').replace(',', '.');
  try {
    return new Decimal(cleaned);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Extract tag value from MT940 text blocks
 */
function extractMt940TagBlocks(content: string): { tag: string; value: string }[] {
  const blocks: { tag: string; value: string }[] = [];
  // Split lines while preserving order
  const lines = content.split(/\r?\n/);
  let currentTag = '';
  let currentValueLines: string[] = [];

  for (const line of lines) {
    // Check if line starts with a tag like :20:, :28C:, :60F:, :61:, :86:, :62F:
    const tagMatch = line.match(/^:([0-9]{2}[A-Z]?):(.*)$/);
    if (tagMatch) {
      if (currentTag) {
        blocks.push({ tag: currentTag, value: currentValueLines.join('\n').trim() });
      }
      currentTag = tagMatch[1];
      currentValueLines = [tagMatch[2]];
    } else if (currentTag) {
      // Continuation line (especially common in :86: and :61:)
      if (!line.startsWith('-}') && !line.startsWith('-$')) {
        currentValueLines.push(line);
      }
    }
  }

  if (currentTag) {
    blocks.push({ tag: currentTag, value: currentValueLines.join('\n').trim() });
  }

  return blocks;
}

/**
 * Parse single balance tag like :60F: or :62F:
 * Format: (C|D)YYMMDD[CCY]AMOUNT (Amount has comma separator)
 */
function parseBalanceTag(val: string, fallbackCurrency: string = 'MAD'): StatementBalance | undefined {
  if (!val) return undefined;
  const match = val.match(/^([CD])(\d{6})([A-Z]{3})([0-9,.]+)/i);
  if (!match) return undefined;

  const mark = match[1].toUpperCase() === 'C' ? 'credit' : 'debit';
  const isoDate = parseSwfDate(match[2]);
  const currency = match[3].toUpperCase() || fallbackCurrency;
  const amountDec = parseDecimalAmount(match[4]);

  return {
    date: isoDate,
    amount: amountDec.toFixed(2),
    currency,
    type: mark,
  };
}

/**
 * Parse SWIFT MT940 statement line :61:
 */
interface Parsed61Line {
  valueDate: string;
  entryDate?: string;
  isCredit: boolean;
  amountDec: DecimalInstance;
  transactionCode: string;
  reference?: string;
  bankReference?: string;
}

function parse61Line(val: string): Parsed61Line | null {
  // Typical MT940 line 61:
  // 2610081008CR45000,00NTRFNONREF//INV-FA-2026-089
  // 261008C45000,00NTRFNONREF//20261008001
  // 261008D1250,50NCHQ123456//
  const regex = /^(\d{6})(\d{4})?(C|D|RC|RD)([A-Z])?([0-9,.]+)([A-Z0-9]{4})([^/\r\n]+)?(?:\/\/([^\r\n]+))?/;
  const match = val.match(regex);

  if (!match) {
    // Fallback regex for loose implementations
    const fallbackMatch = val.match(/^(\d{6})(?:(\d{4}))?([CD]|RC|RD)([0-9,.]+)(?:[A-Z0-9]{3,4})?(.*?)(?:\/\/([^\r\n]+))?$/i);
    if (!fallbackMatch) return null;

    const valueDate = parseSwfDate(fallbackMatch[1]);
    const indicator = fallbackMatch[3].toUpperCase();
    const isCredit = indicator === 'C' || indicator === 'RC';
    const amountDec = parseDecimalAmount(fallbackMatch[4]);
    return {
      valueDate,
      isCredit,
      amountDec,
      transactionCode: 'TRF',
      reference: fallbackMatch[5]?.trim() || undefined,
      bankReference: fallbackMatch[6]?.trim() || undefined,
    };
  }

  const valueDate = parseSwfDate(match[1]);
  const entryDate = match[2] ? parseSwfDate(`${match[1].slice(0, 2)}${match[2]}`) : undefined;
  const mark = match[3].toUpperCase();
  // RC = reversal of debit (acts as credit), RD = reversal of credit (acts as debit)
  const isCredit = mark === 'C' || mark === 'RC';
  const amountDec = parseDecimalAmount(match[5]);
  const transactionCode = match[6];
  const reference = match[7]?.trim();
  const bankReference = match[8]?.trim();

  return {
    valueDate,
    entryDate,
    isCredit,
    amountDec,
    transactionCode,
    reference: reference && reference !== 'NONREF' ? reference : undefined,
    bankReference,
  };
}

/**
 * Parse SWIFT MT940 format bank statements
 * Compatible with Moroccan banks (Attijariwafa Bank, BCP, BMCE BOA, SGMB) & European banks
 */
export function parseSwiftMt940(content: string): ParsedBankStatement {
  if (!content || !content.trim()) {
    return {
      success: false,
      format: 'mt940',
      currency: 'MAD',
      rows: [],
      totalCredit: '0.00',
      totalDebit: '0.00',
      transactionCount: 0,
      error: 'محتوى ملف MT940 فارغ',
    };
  }

  const blocks = extractMt940TagBlocks(content);
  if (blocks.length === 0) {
    return {
      success: false,
      format: 'mt940',
      currency: 'MAD',
      rows: [],
      totalCredit: '0.00',
      totalDebit: '0.00',
      transactionCount: 0,
      error: 'لم يتم العثور على وسوم SWIFT MT940 صالحة في الملف',
    };
  }

  let statementRef: string | undefined;
  let accountId: string | undefined;
  let statementNum: string | undefined;
  let fileCurrency = 'MAD';
  let openingBal: StatementBalance | undefined;
  let closingBal: StatementBalance | undefined;

  const rows: ParsedStatementTransaction[] = [];
  let current61: Parsed61Line | null = null;
  let totalCredit = new Decimal(0);
  let totalDebit = new Decimal(0);
  let txIndex = 1;

  for (let i = 0; i < blocks.length; i++) {
    const { tag, value } = blocks[i];

    if (tag === '20') {
      statementRef = value;
    } else if (tag === '25') {
      accountId = value.replace(/\s+/g, '');
    } else if (tag === '28C' || tag === '28') {
      statementNum = value;
    } else if (tag === '60F' || tag === '60M') {
      openingBal = parseBalanceTag(value, fileCurrency);
      if (openingBal) fileCurrency = openingBal.currency;
    } else if (tag === '61') {
      // If we had a previous 61 without an 86 tag, flush it now
      if (current61) {
        const signedDec = current61.isCredit ? current61.amountDec : current61.amountDec.negated();
        if (current61.isCredit) {
          totalCredit = totalCredit.plus(current61.amountDec);
        } else {
          totalDebit = totalDebit.plus(current61.amountDec);
        }

        rows.push({
          id: `MT940-${statementRef || 'TX'}-${txIndex++}`,
          statementType: 'mt940',
          date: current61.entryDate || current61.valueDate,
          valueDate: current61.valueDate,
          amount: signedDec.toNumber(),
          amountDecimal: signedDec.toFixed(2),
          currency: fileCurrency,
          reference: current61.reference,
          bankReference: current61.bankReference,
          description: current61.bankReference || current61.reference || 'Virement bancaire',
          transactionCode: current61.transactionCode,
        });
      }

      current61 = parse61Line(value);
    } else if (tag === '86' && current61) {
      // Narrative / Remittance attached to current 61
      const remittance = value.replace(/\r?\n/g, ' ').trim();
      const signedDec = current61.isCredit ? current61.amountDec : current61.amountDec.negated();

      if (current61.isCredit) {
        totalCredit = totalCredit.plus(current61.amountDec);
      } else {
        totalDebit = totalDebit.plus(current61.amountDec);
      }

      // Check for Moroccan ICE (9 to 15 digits)
      const iceMatch = remittance.match(/ICE\s*[:#]?\s*(\d{9,15})/i);
      const partnerIce = iceMatch ? iceMatch[1] : undefined;

      // Extract invoice reference if present in description
      const invMatch = remittance.match(/(?:FA|FAC|INV)[-_ ]\d{4}[-_ ]\d+/i) || remittance.match(/(?:FA|FAC)[-_ ]\d+/i);
      const invoiceRef = invMatch ? invMatch[0].replace(/\s+/g, '-') : undefined;

      rows.push({
        id: `MT940-${statementRef || 'TX'}-${txIndex++}`,
        statementType: 'mt940',
        date: current61.entryDate || current61.valueDate,
        valueDate: current61.valueDate,
        amount: signedDec.toNumber(),
        amountDecimal: signedDec.toFixed(2),
        currency: fileCurrency,
        reference: invoiceRef || current61.reference,
        bankReference: current61.bankReference,
        description: remittance || current61.bankReference || current61.reference || 'Transaction MT940',
        remittanceInfo: remittance,
        partnerIce,
        transactionCode: current61.transactionCode,
      });

      current61 = null;
    } else if (tag === '62F' || tag === '62M') {
      closingBal = parseBalanceTag(value, fileCurrency);
      if (closingBal) fileCurrency = closingBal.currency;
    }
  }

  // Flush any lingering 61 tag
  if (current61) {
    const signedDec = current61.isCredit ? current61.amountDec : current61.amountDec.negated();
    if (current61.isCredit) {
      totalCredit = totalCredit.plus(current61.amountDec);
    } else {
      totalDebit = totalDebit.plus(current61.amountDec);
    }

    rows.push({
      id: `MT940-${statementRef || 'TX'}-${txIndex++}`,
      statementType: 'mt940',
      date: current61.entryDate || current61.valueDate,
      valueDate: current61.valueDate,
      amount: signedDec.toNumber(),
      amountDecimal: signedDec.toFixed(2),
      currency: fileCurrency,
      reference: current61.reference,
      bankReference: current61.bankReference,
      description: current61.bankReference || current61.reference || 'Virement bancaire',
      transactionCode: current61.transactionCode,
    });
  }

  return {
    success: rows.length > 0,
    format: 'mt940',
    statementReference: statementRef,
    accountIdentification: accountId,
    statementNumber: statementNum,
    currency: fileCurrency,
    openingBalance: openingBal,
    closingBalance: closingBal,
    rows,
    totalCredit: totalCredit.toFixed(2),
    totalDebit: totalDebit.toFixed(2),
    transactionCount: rows.length,
    error: rows.length === 0 ? 'لم يتم العثور على أي حركات بنكية صالحة في ملف MT940' : undefined,
  };
}

/**
 * Universal XML tag value extractor (No browser DOMParser dependency required)
 */
function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Extract attribute value from tag
 */
function extractXmlAttr(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s+[^>]*)?\\s+${attr}=["']([^"']+)["']`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Parse ISO 20022 CAMT.053 XML Bank Statements
 * Standard for European SEPA banks and international transport settlements
 */
export function parseCamt053Xml(xmlContent: string): ParsedBankStatement {
  if (!xmlContent || !xmlContent.trim()) {
    return {
      success: false,
      format: 'camt053',
      currency: 'EUR',
      rows: [],
      totalCredit: '0.00',
      totalDebit: '0.00',
      transactionCount: 0,
      error: 'محتوى ملف CAMT.053 فارغ',
    };
  }

  // Extract statement block
  const stmtBlock = extractXmlTag(xmlContent, 'Stmt') || xmlContent;
  const statementId = extractXmlTag(stmtBlock, 'Id') || extractXmlTag(xmlContent, 'MsgId');
  const iban = extractXmlTag(stmtBlock, 'IBAN') || extractXmlTag(stmtBlock, 'Othr');

  // Extract Account Currency
  let statementCurrency = extractXmlTag(stmtBlock, 'Ccy') || 'EUR';

  // Balances
  let openingBalance: StatementBalance | undefined;
  let closingBalance: StatementBalance | undefined;

  const balBlocks = stmtBlock.match(/<Bal>[\s\S]*?<\/Bal>/gi) || [];
  for (const b of balBlocks) {
    const code = extractXmlTag(b, 'Cd') || extractXmlTag(b, 'Prtry');
    const amtStr = extractXmlTag(b, 'Amt');
    const ccy = extractXmlAttr(b, 'Amt', 'Ccy') || statementCurrency;
    const cdtDbt = extractXmlTag(b, 'CdtDbtInd');
    const dateMatch = b.match(/(\d{4}-\d{2}-\d{2})/);
    const dt = dateMatch ? dateMatch[1] : '';

    if (amtStr) {
      const dec = parseDecimalAmount(amtStr);
      const balObj: StatementBalance = {
        date: dt || new Date().toISOString().split('T')[0],
        amount: dec.toFixed(2),
        currency: ccy,
        type: cdtDbt.toUpperCase().startsWith('C') ? 'credit' : 'debit',
      };
      if (code === 'OPBD' || code === 'PRCD') {
        openingBalance = balObj;
        statementCurrency = ccy;
      } else if (code === 'CLBD' || code === 'CLAV') {
        closingBalance = balObj;
        statementCurrency = ccy;
      }
    }
  }

  // Entry items (<Ntry>)
  const ntryBlocks = stmtBlock.match(/<Ntry>[\s\S]*?<\/Ntry>/gi) || [];
  const rows: ParsedStatementTransaction[] = [];
  let totalCredit = new Decimal(0);
  let totalDebit = new Decimal(0);
  let entryIndex = 1;

  for (const ntry of ntryBlocks) {
    const amtStr = extractXmlTag(ntry, 'Amt');
    if (!amtStr) continue;

    const entryCcy = extractXmlAttr(ntry, 'Amt', 'Ccy') || statementCurrency;
    const cdtDbtInd = extractXmlTag(ntry, 'CdtDbtInd').toUpperCase();
    const isCredit = cdtDbtInd === 'CRDT';

    const amtDec = parseDecimalAmount(amtStr);
    const signedDec = isCredit ? amtDec : amtDec.negated();

    if (isCredit) {
      totalCredit = totalCredit.plus(amtDec);
    } else {
      totalDebit = totalDebit.plus(amtDec);
    }

    const bookgDt = extractXmlTag(ntry, 'BookgDt');
    const bookgIso = extractXmlTag(bookgDt, 'Dt') || extractXmlTag(bookgDt, 'DtTm')?.split('T')[0];

    const valDt = extractXmlTag(ntry, 'ValDt');
    const valIso = extractXmlTag(valDt, 'Dt') || extractXmlTag(valDt, 'DtTm')?.split('T')[0];

    // Details within <TxDtls> or direct in entry
    const endToEndId = extractXmlTag(ntry, 'EndToEndId');
    const acctSvcrRef = extractXmlTag(ntry, 'AcctSvcrRef');
    const ustrd = extractXmlTag(ntry, 'Ustrd');
    const debtorName = extractXmlTag(ntry, 'Dbtr');
    const dbtrNm = debtorName ? extractXmlTag(debtorName, 'Nm') : '';
    const creditorName = extractXmlTag(ntry, 'Cdtr');
    const cdtrNm = creditorName ? extractXmlTag(creditorName, 'Nm') : '';
    const txCode = extractXmlTag(ntry, 'Cd');

    const partnerName = isCredit ? dbtrNm : cdtrNm;
    const narrative = [ustrd, partnerName, endToEndId].filter(Boolean).join(' - ');

    // Extract invoice number if present
    const invMatch = (ustrd + ' ' + endToEndId).match(/(?:FA|FAC|INV)[-_ ]\d{4}[-_ ]\d+/i) ||
                     (ustrd + ' ' + endToEndId).match(/(?:FA|FAC)[-_ ]\d+/i);
    const invoiceRef = invMatch ? invMatch[0].replace(/\s+/g, '-') : undefined;

    // Extract ICE
    const iceMatch = (ustrd + ' ' + endToEndId).match(/ICE\s*[:#]?\s*(\d{9,15})/i);
    const partnerIce = iceMatch ? iceMatch[1] : undefined;

    rows.push({
      id: `CAMT053-${statementId || 'ENTRY'}-${entryIndex++}`,
      statementType: 'camt053',
      date: bookgIso || valIso || new Date().toISOString().split('T')[0],
      valueDate: valIso || bookgIso,
      amount: signedDec.toNumber(),
      amountDecimal: signedDec.toFixed(2),
      currency: entryCcy,
      reference: invoiceRef || (endToEndId !== 'NOTPROVIDED' ? endToEndId : undefined) || acctSvcrRef || undefined,
      bankReference: acctSvcrRef || undefined,
      endToEndId: endToEndId !== 'NOTPROVIDED' ? endToEndId : undefined,
      description: narrative || 'Virement bancaire SEPA CAMT.053',
      remittanceInfo: ustrd || undefined,
      partnerName: partnerName || undefined,
      partnerIce,
      transactionCode: txCode || 'PMNT',
    });
  }

  return {
    success: rows.length > 0,
    format: 'camt053',
    statementReference: statementId,
    accountIdentification: iban,
    currency: statementCurrency,
    openingBalance,
    closingBalance,
    rows,
    totalCredit: totalCredit.toFixed(2),
    totalDebit: totalDebit.toFixed(2),
    transactionCount: rows.length,
    error: rows.length === 0 ? 'لم يتم العثور على أي قيود صالحة في ملف CAMT.053' : undefined,
  };
}

/**
 * Universal Bank Statement Parser Dispatcher
 * Seamlessly detects and parses:
 * - SWIFT MT940 (.sta, .mt940, .swift, .txt)
 * - ISO 20022 CAMT.053 (.xml, .camt)
 * - OFX / QFX (.ofx, .qfx)
 * - CSV statements (.csv)
 */
export function parseBankStatementUnified(
  content: string,
  fileName?: string
): ParsedBankStatement {
  if (!content || !content.trim()) {
    return {
      success: false,
      format: 'csv',
      currency: 'MAD',
      rows: [],
      totalCredit: '0.00',
      totalDebit: '0.00',
      transactionCount: 0,
      error: 'ملف الكشف البنكي فارغ',
    };
  }

  const clean = content.trim();

  // 1. Check CAMT.053 XML
  const isCamt =
    (fileName && /\.(xml|camt|camt053)$/i.test(fileName)) ||
    clean.includes('camt.053') ||
    clean.includes('camt.054') ||
    clean.includes('<BkToCstmrStmt>') ||
    clean.includes('<BkToCstmrDbtCdtNtfctn>');

  if (isCamt) {
    return parseCamt053Xml(clean);
  }

  // 2. Check SWIFT MT940
  const isMt940 =
    (fileName && /\.(sta|mt940|swift)$/i.test(fileName)) ||
    (clean.includes(':20:') && (clean.includes(':61:') || clean.includes(':25:')));

  if (isMt940) {
    return parseSwiftMt940(clean);
  }

  // 3. Check OFX
  const isOfx =
    (fileName && /\.(ofx|qfx)$/i.test(fileName)) ||
    /<OFX>|<OFXHEADER>|<STMTTRN>/i.test(clean);

  if (isOfx) {
    const ofxRows = parseOfxStatement(clean);
    let totalCredit = new Decimal(0);
    let totalDebit = new Decimal(0);

    const convertedRows: ParsedStatementTransaction[] = ofxRows.map((r, idx) => {
      const amtDec = new Decimal(r.amount);
      if (amtDec.greaterThan(0)) {
        totalCredit = totalCredit.plus(amtDec);
      } else {
        totalDebit = totalDebit.plus(amtDec.abs());
      }

      return {
        id: `OFX-${idx + 1}`,
        statementType: 'ofx',
        date: r.date,
        amount: amtDec.toNumber(),
        amountDecimal: amtDec.toFixed(2),
        currency: r.currency || 'MAD',
        reference: r.reference,
        description: r.description || 'OFX Transaction',
        raw: r.raw,
      };
    });

    return {
      success: convertedRows.length > 0,
      format: 'ofx',
      currency: convertedRows[0]?.currency || 'MAD',
      rows: convertedRows,
      totalCredit: totalCredit.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      transactionCount: convertedRows.length,
      error: convertedRows.length === 0 ? 'لم يتم العثور على أي معاملات في ملف OFX' : undefined,
    };
  }

  // 4. Fallback to CSV
  const csvRows = parseCsvStatement(clean);
  let totalCredit = new Decimal(0);
  let totalDebit = new Decimal(0);

  const convertedRows: ParsedStatementTransaction[] = csvRows.map((r, idx) => {
    const amtDec = new Decimal(r.amount);
    if (amtDec.greaterThan(0)) {
      totalCredit = totalCredit.plus(amtDec);
    } else {
      totalDebit = totalDebit.plus(amtDec.abs());
    }

    return {
      id: `CSV-${idx + 1}`,
      statementType: 'csv',
      date: r.date,
      amount: amtDec.toNumber(),
      amountDecimal: amtDec.toFixed(2),
      currency: r.currency || 'MAD',
      reference: r.reference,
      description: r.description || 'CSV Transaction',
      raw: r.raw,
    };
  });

  return {
    success: convertedRows.length > 0,
    format: 'csv',
    currency: convertedRows[0]?.currency || 'MAD',
    rows: convertedRows,
    totalCredit: totalCredit.toFixed(2),
    totalDebit: totalDebit.toFixed(2),
    transactionCount: convertedRows.length,
    error: convertedRows.length === 0 ? 'لم يتم العثور على أي معاملات صالحة في ملف CSV' : undefined,
  };
}

/**
 * Adapter to convert ParsedStatementTransaction to legacy ParsedBankRow
 */
export function statementRowsToLegacyBankRows(rows: ParsedStatementTransaction[]): ParsedBankRow[] {
  return rows.map((r) => ({
    date: r.date,
    amount: r.amount,
    reference: r.reference,
    description: r.description,
    currency: r.currency,
    balance: r.balance,
    raw: r.raw,
  }));
}
