import * as XLSX from 'xlsx';

export type ImportRow = Record<string, unknown>;

export interface BulkImportResult {
  success: boolean;
  totalRows: number;
  validRows: ImportRow[];
  invalidRows: { row: number; errors: string[]; data: ImportRow }[];
  headers: string[];
}

export interface ValidationOptions {
  requiredFields: string[];
  fieldValidators?: Record<string, (value: unknown) => string | null>;
  headerAliases?: Record<string, string[]>;
}

const normalizeHeader = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  return String(value).trim();
};

const resolveFieldName = (rawHeader: string, aliases?: Record<string, string[]>): string | null => {
  const normalized = rawHeader.toLowerCase();
  if (aliases) {
    for (const [canonical, variants] of Object.entries(aliases)) {
      const all = [canonical.toLowerCase(), ...variants.map((v) => v.toLowerCase())];
      if (all.includes(normalized)) return canonical;
    }
  }
  return normalized || null;
};

export const parseExcelFile = (file: File): Promise<BulkImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result as string, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          return resolve({
            success: false,
            totalRows: 0,
            validRows: [],
            invalidRows: [],
            headers: [],
          });
        }
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
          raw: false,
        });

        const headers = Object.keys(jsonData[0] || {}).map(normalizeHeader);
        resolve({
          success: true,
          totalRows: jsonData.length,
          validRows: jsonData,
          invalidRows: [],
          headers,
        });
      } catch {
        reject(new Error('فشل في قراءة الملف. يرجى التأكد من صيغة الملف (Excel/CSV).'));
      }
    };
    reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة الملف.'));
    reader.readAsBinaryString(file);
  });
};

export const validateRows = (
  rows: ImportRow[],
  options: ValidationOptions
): BulkImportResult => {
  const { requiredFields, fieldValidators = {}, headerAliases = {} } = options;
  const validRows: ImportRow[] = [];
  const invalidRows: { row: number; errors: string[]; data: ImportRow }[] = [];
  const canonicalHeaders = Object.keys(headerAliases);

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const normalizedRow: ImportRow = {};
    const errors: string[] = [];
    const seenCanonical = new Set<string>();

    for (const [key, value] of Object.entries(rawRow)) {
      const rawHeader = normalizeHeader(key);
      if (!rawHeader) continue;
      const canonical = resolveFieldName(rawHeader, headerAliases);
      if (!canonical || seenCanonical.has(canonical)) continue;
      seenCanonical.add(canonical);
      normalizedRow[canonical] = normalizeCellValue(value);
    }

    for (const field of requiredFields) {
      const value = normalizedRow[field];
      if (!value || String(value).trim() === '') {
        const aliases = headerAliases[field] || [];
        const display = [field, ...aliases].filter(Boolean).join(' / ');
        errors.push(`الحقل المطلوب "${display}" فارغ`);
      }
    }

    for (const [field, validator] of Object.entries(fieldValidators)) {
      const value = normalizedRow[field];
      if (value && String(value).trim() !== '') {
        const issue = validator(value);
        if (issue) errors.push(issue);
      }
    }

    if (errors.length > 0) {
      invalidRows.push({ row: rowNumber, errors, data: normalizedRow });
    } else {
      validRows.push(normalizedRow);
    }
  });

  return {
    success: invalidRows.length === 0,
    totalRows: rows.length,
    validRows,
    invalidRows,
    headers: canonicalHeaders,
  };
};

export const validateMoroccanPlate = (value: unknown): string | null => {
  const plate = String(value).trim();
  if (!plate) return null;
  if (!/^\d{1,6}-\d{1,4}-[A-Za-z]{1,3}$/.test(plate)) {
    return 'صيغة لوحة التسجيل غير صحيحة. استخدم الصيغة: 12345-67-89';
  }
  return null;
};

export const validateICE = (value: unknown): string | null => {
  const ice = String(value).trim();
  if (!ice) return null;
  const digits = ice.replace(/\s/g, '');
  if (!/^\d{15}$/.test(digits)) {
    return 'رقم ICE يجب أن يتكون من 15 رقماً بالضبط';
  }
  return null;
};

export const validateEmail = (value: unknown): string | null => {
  const email = String(value).trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'عنوان البريد الإلكتروني غير صحيح';
  }
  return null;
};

export const validatePhone = (value: unknown): string | null => {
  const phone = String(value).trim();
  if (!phone) return null;
  if (!/^\+?[0-9\s-]{7,20}$/.test(phone)) {
    return 'رقم الهاتف غير صحيح';
  }
  return null;
};
