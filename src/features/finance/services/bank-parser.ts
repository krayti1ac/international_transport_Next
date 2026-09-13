import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ParsedBankRow {
  date: string; // YYYY-MM-DD
  amount: number; // Positive = credit/deposit, Negative = debit/withdrawal
  reference?: string;
  description?: string;
  currency: string;
  balance?: number;
  raw?: Record<string, unknown>;
}

export interface ParseBankStatementResult {
  success: boolean;
  rows: ParsedBankRow[];
  format: 'csv' | 'ofx';
  totalCredit: string;
  totalDebit: string;
  error?: string;
}

/**
 * Detect delimiter for CSV (comma, semicolon, or tab)
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;

  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  return ',';
}

/**
 * Parse a line considering quotes
 */
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"(.*)"$/, '$1'));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"(.*)"$/, '$1'));
  return result;
}

/**
 * Detect transaction currency from text tokens
 */
function detectCurrency(text: string, defaultCurrency: string = 'MAD'): string {
  const upper = text.toUpperCase();
  if (upper.includes('EUR') || upper.includes('EURO') || upper.includes('EUROS') || upper.includes('€')) return 'EUR';
  if (upper.includes('USD') || upper.includes('DOLLAR') || upper.includes('$')) return 'USD';
  if (upper.includes('MAD') || upper.includes('DIRHAM') || upper.includes('DHS')) return 'MAD';
  return defaultCurrency;
}

type DecimalInstance = InstanceType<typeof Decimal>;

/**
 * Parse numeric amount safely using Decimal.js
 * Handles Moroccan/French formats (e.g. 1 250,50 or 1.250,50) and Standard (1,250.50)
 */
function parseNumericAmount(amountStr: string): DecimalInstance | null {
  if (!amountStr) return null;
  let cleaned = amountStr.trim().replace(/\s+/g, '');

  // Detect whether comma is the decimal separator
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // 1.250,50 -> 1250.50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,250.50 -> 1250.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 1250,50 -> 1250.50
    cleaned = cleaned.replace(',', '.');
  }

  // Remove any remaining invalid characters except digits, minus, and dot
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');

  try {
    const dec = new Decimal(cleaned);
    return dec.isNaN() ? null : dec;
  } catch {
    return null;
  }
}

/**
 * Parse localized date into ISO YYYY-MM-DD
 */
function parseDateString(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  const trimmed = dateStr.trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const matchDmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (matchDmy) {
    const day = matchDmy[1].padStart(2, '0');
    const month = matchDmy[2].padStart(2, '0');
    let year = matchDmy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Pattern: YYYY/MM/DD or YYYY-MM-DD
  const matchYmd = trimmed.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (matchYmd) {
    const year = matchYmd[1];
    const month = matchYmd[2].padStart(2, '0');
    const day = matchYmd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback to JS Date if possible
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parse CSV Bank Statement
 */
export function parseCsvStatement(csvText: string): ParsedBankRow[] {
  // Strip UTF-8 BOM if present
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(cleanText);
  const header = parseDelimitedLine(lines[0], delimiter).map((col) => col.toLowerCase().trim());

  // Find column indices
  const colIdx = {
    date: header.findIndex((h) => /\b(date|date_operation|date_valeur|date_op|dt)\b/i.test(h)),
    desc: header.findIndex((h) => /\b(description|libelle|narration|details|memo|motif|operation|nature)\b/i.test(h)),
    ref: header.findIndex((h) => /\b(reference|ref|num|trx|id|cheque|numero|num_piece)\b/i.test(h)),
    amount: header.findIndex((h) => /\b(amount|montant|valeur|solde_mvt)\b/i.test(h)),
    debit: header.findIndex((h) => /\b(debit|deb|retrait|sortie)\b/i.test(h)),
    credit: header.findIndex((h) => /\b(credit|cred|depot|entree|versement)\b/i.test(h)),
    balance: header.findIndex((h) => /\b(balance|solde|nouveau_solde)\b/i.test(h)),
  };

  const rows: ParsedBankRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseDelimitedLine(lines[i], delimiter);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const rawDate = colIdx.date >= 0 ? cols[colIdx.date] : cols[0];
    const parsedDate = parseDateString(rawDate || '');

    const desc = colIdx.desc >= 0 ? cols[colIdx.desc] : '';
    const ref = colIdx.ref >= 0 ? cols[colIdx.ref] : undefined;

    let finalAmount: DecimalInstance | null = null;

    // Separate Debit and Credit columns takes precedence if present
    if (colIdx.debit >= 0 || colIdx.credit >= 0) {
      const debitStr = colIdx.debit >= 0 ? cols[colIdx.debit] : '';
      const creditStr = colIdx.credit >= 0 ? cols[colIdx.credit] : '';

      const debitVal = parseNumericAmount(debitStr);
      const creditVal = parseNumericAmount(creditStr);

      if (creditVal && creditVal.greaterThan(0)) {
        finalAmount = creditVal;
      } else if (debitVal && debitVal.greaterThan(0)) {
        finalAmount = debitVal.negated();
      } else if (creditVal && !creditVal.isZero()) {
        finalAmount = creditVal;
      } else if (debitVal && !debitVal.isZero()) {
        finalAmount = debitVal.negated();
      }
    }

    // Single Amount column fallback
    if (finalAmount === null && colIdx.amount >= 0) {
      finalAmount = parseNumericAmount(cols[colIdx.amount]);
    }

    // If still null, try finding any numeric column in the row
    if (finalAmount === null) {
      for (let c = 0; c < cols.length; c++) {
        if (c === colIdx.date) continue;
        const testVal = parseNumericAmount(cols[c]);
        if (testVal !== null && !testVal.isZero()) {
          finalAmount = testVal;
          break;
        }
      }
    }

    if (finalAmount === null || finalAmount.isZero()) continue;

    const currency = detectCurrency(desc + ' ' + (lines[i] || ''));
    let balanceNum: number | undefined = undefined;
    if (colIdx.balance >= 0) {
      const balDec = parseNumericAmount(cols[colIdx.balance]);
      if (balDec) balanceNum = balDec.toNumber();
    }

    rows.push({
      date: parsedDate,
      amount: finalAmount.toNumber(),
      reference: ref ? ref.trim() : undefined,
      description: desc ? desc.trim() : undefined,
      currency,
      balance: balanceNum,
      raw: { lineIndex: i, rawLine: lines[i] },
    });
  }

  return rows;
}

/**
 * Parse OFX (Open Financial Exchange 1.0 / 2.0) Bank Statement
 */
export function parseOfxStatement(ofxText: string): ParsedBankRow[] {
  const rows: ParsedBankRow[] = [];

  // Extract currency if present
  const curMatch = ofxText.match(/<CURDEF>([A-Z]{3})/i);
  const fileCurrency = curMatch ? curMatch[1].toUpperCase() : 'MAD';

  // Extract all <STMTTRN> blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let trnMatch: RegExpExecArray | null;

  while ((trnMatch = trnRegex.exec(ofxText)) !== null) {
    const block = trnMatch[1];

    const getTagValue = (tagName: string): string => {
      const match = block.match(new RegExp(`<${tagName}>([^<\r\n]+)`, 'i'));
      return match ? match[1].trim() : '';
    };

    const trnType = getTagValue('TRNTYPE').toUpperCase();
    const dtPosted = getTagValue('DTPOSTED');
    const trnAmtStr = getTagValue('TRNAMT');
    const fitId = getTagValue('FITID');
    const name = getTagValue('NAME');
    const memo = getTagValue('MEMO');
    const checkNum = getTagValue('CHECKNUM');

    if (!trnAmtStr) continue;

    const amtDec = parseNumericAmount(trnAmtStr);
    if (!amtDec || amtDec.isZero()) continue;

    // Parse date from YYYYMMDDHHMMSS or YYYYMMDD
    let isoDate = new Date().toISOString().split('T')[0];
    const dateMatch = dtPosted.match(/^(\d{4})(\d{2})(\d{2})/);
    if (dateMatch) {
      isoDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }

    // Description composition
    const descParts = [name, memo].filter(Boolean);
    const description = descParts.join(' - ') || trnType;

    rows.push({
      date: isoDate,
      amount: amtDec.toNumber(),
      reference: checkNum || fitId || undefined,
      description,
      currency: fileCurrency,
      raw: { trnType, fitId, checkNum },
    });
  }

  // If no closing </STMTTRN> (SGML style without closing tags)
  if (rows.length === 0 && /<STMTTRN>/i.test(ofxText)) {
    const rawBlocks = ofxText.split(/<STMTTRN>/i).slice(1);
    for (const block of rawBlocks) {
      const getTagValue = (tagName: string): string => {
        const match = block.match(new RegExp(`<${tagName}>([^<\r\n]+)`, 'i'));
        return match ? match[1].trim() : '';
      };

      const dtPosted = getTagValue('DTPOSTED');
      const trnAmtStr = getTagValue('TRNAMT');
      const fitId = getTagValue('FITID');
      const name = getTagValue('NAME');
      const memo = getTagValue('MEMO');
      const checkNum = getTagValue('CHECKNUM');

      if (!trnAmtStr) continue;
      const amtDec = parseNumericAmount(trnAmtStr);
      if (!amtDec || amtDec.isZero()) continue;

      let isoDate = new Date().toISOString().split('T')[0];
      const dateMatch = dtPosted.match(/^(\d{4})(\d{2})(\d{2})/);
      if (dateMatch) {
        isoDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }

      const description = [name, memo].filter(Boolean).join(' - ');

      rows.push({
        date: isoDate,
        amount: amtDec.toNumber(),
        reference: checkNum || fitId || undefined,
        description: description || 'OFX Transaction',
        currency: fileCurrency,
        raw: { fitId, checkNum },
      });
    }
  }

  return rows;
}

/**
 * Universal Bank Statement Parser Dispatcher
 */
export function parseBankStatement(fileContent: string, fileName?: string): ParseBankStatementResult {
  if (!fileContent || !fileContent.trim()) {
    return {
      success: false,
      rows: [],
      format: 'csv',
      totalCredit: '0.00',
      totalDebit: '0.00',
      error: 'ملف الكشف البنكي فارغ',
    };
  }

  const isOfx =
    (fileName && /\.(ofx|qfx)$/i.test(fileName)) ||
    /<OFX>|<OFXHEADER>|<STMTTRN>/i.test(fileContent);

  const format: 'csv' | 'ofx' = isOfx ? 'ofx' : 'csv';
  const rows = isOfx ? parseOfxStatement(fileContent) : parseCsvStatement(fileContent);

  if (rows.length === 0) {
    return {
      success: false,
      rows: [],
      format,
      totalCredit: '0.00',
      totalDebit: '0.00',
      error: 'لم يتم العثور على أي معاملات بنكية صالحة في الملف المرفوع',
    };
  }

  let creditSum = new Decimal(0);
  let debitSum = new Decimal(0);

  for (const r of rows) {
    const amt = new Decimal(r.amount);
    if (amt.greaterThan(0)) {
      creditSum = creditSum.plus(amt);
    } else {
      debitSum = debitSum.plus(amt.abs());
    }
  }

  return {
    success: true,
    rows,
    format,
    totalCredit: creditSum.toFixed(2),
    totalDebit: debitSum.toFixed(2),
  };
}
