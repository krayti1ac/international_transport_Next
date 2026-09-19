import * as XLSX from 'xlsx';
import {
  validateICEField,
  validateMoroccanPlateField,
  validateEmailField,
  validatePhoneField,
  type ValidationResult,
} from '@/lib/validators/morocco-business';

export type ImportRow = Record<string, unknown>;

export interface BulkImportResult {
  success: boolean;
  totalRows: number;
  validRows: ImportRow[];
  invalidRows: { row: number; errors: string[]; data: ImportRow }[];
  headers: string[];
}

export type FieldValidatorResult = string | null | ValidationResult;
export type FieldValidator = (value: unknown) => FieldValidatorResult;

export interface ValidationOptions {
  requiredFields: string[];
  fieldValidators?: Record<string, FieldValidator>;
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
        if (typeof issue === 'string') {
          errors.push(issue);
        } else if (issue && typeof issue === 'object' && !issue.valid) {
          errors.push(issue.message || `قيمة الحقل "${field}" غير صالحة`);
        }
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

export const validateMoroccanPlate = validateMoroccanPlateField;
export const validateICE = validateICEField;
export const validateEmail = validateEmailField;
export const validatePhone = validatePhoneField;
