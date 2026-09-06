import * as XLSX from 'xlsx';

export type BulkImportEntityType = 'truck' | 'trailer' | 'client';

export interface BulkImportRow {
  rowIndex: number;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
}

export interface BulkImportResult {
  validRows: BulkImportRow[];
  invalidRows: BulkImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
}

const TRUCK_REQUIRED_FIELDS = ['plate_number', 'model'] as const;
const TRAILER_REQUIRED_FIELDS = ['plate_number', 'model'] as const;
const CLIENT_REQUIRED_FIELDS = ['name', 'phone', 'ice'] as const;

const FIELD_ALIASES: Record<string, string[]> = {
  plate_number: ['plate_number', 'plate', 'matricule', 'immatriculation', 'لوحة', 'رقم اللوحة'],
  model: ['model', 'modele', 'موديل', 'طراز'],
  status: ['status', 'حالة', 'état'],
  weight_capacity: ['weight_capacity', 'poids', 'حمولة', 'capacite'],
  name: ['name', 'nom', 'اسم', 'client_name', 'company_name'],
  phone: ['phone', 'telephone', 'tel', 'هاتف', 'téléphone'],
  email: ['email', 'mail', 'بريد'],
  city: ['city', 'ville', 'مدينة', 'city_name'],
  address: ['address', 'adresse', 'عنوان'],
  ice: ['ice', 'identifiant', 'رقم التعريف الضريبي', 'ice_number'],
  client_type: ['client_type', 'type', 'نوع', 'client_type'],
  currency: ['currency', 'devise', 'عملة'],
  is_active: ['is_active', 'active', 'نشط', 'actif'],
};

export function normalizeFieldName(name: string): string {
  const normalized = name.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (canonical === normalized || aliases.some(alias => alias === normalized)) {
      return canonical;
    }
  }
  return normalized;
}

export function parseFileToRows(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Empty file'));
          return;
        }

        let rows: Record<string, any>[] = [];

        if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
          if (lines.length === 0) {
            reject(new Error('Empty CSV file'));
            return;
          }
          const headers = parseCSVLine(lines[0]);
          rows = lines.slice(1).map((line, idx) => {
            const values = parseCSVLine(line);
            const row: Record<string, any> = { _rowIndex: idx + 2 };
            headers.forEach((header, i) => {
              const normalizedHeader = normalizeFieldName(header);
              row[normalizedHeader] = values[i] !== undefined ? values[i].trim() : '';
            });
            return row;
          });
        } else {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
          rows = jsonData.map((row, idx) => {
            const normalizedRow: Record<string, any> = { _rowIndex: idx + 2 };
            for (const [key, value] of Object.entries(row)) {
              const normalizedKey = normalizeFieldName(key);
              normalizedRow[normalizedKey] = typeof value === 'string' ? value.trim() : value ?? '';
            }
            return normalizedRow;
          });
        }

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function validatePlateNumber(plate: string): { valid: boolean; message?: string } {
  if (!plate || plate.trim() === '') {
    return { valid: false, message: 'رقم اللوحة مطلوب' };
  }
  const trimmed = plate.trim();
  const moroccanPatterns = [
    /^\d{1,6}[- ]?[A-Za-z]{1,3}[- ]?\d{1,4}$/,
    /^[A-Za-z]{1,3}[- ]?\d{1,6}[- ]?[A-Za-z]{1,3}$/,
  ];
  const isValid = moroccanPatterns.some(pattern => pattern.test(trimmed)) || trimmed.length >= 4;
  if (!isValid) {
    return { valid: false, message: 'صيغة اللوحة غير صحيحة (مثال: 12345-A-123)' };
  }
  return { valid: true };
}

export function validateICE(ice: string): { valid: boolean; message?: string } {
  if (!ice || ice.trim() === '') {
    return { valid: false, message: 'رقم ICE مطلوب' };
  }
  const trimmed = ice.trim();
  const cleaned = trimmed.replace(/\s/g, '');
  if (!/^[A-Za-z0-9]{5,20}$/.test(cleaned)) {
    return { valid: false, message: 'رقم ICE غير صحيح (يجب أن يكون بين 5 و 20 حرفاً/رقماً)' };
  }
  return { valid: true };
}

export function validateBulkRows(
  rows: Record<string, any>[],
  entityType: BulkImportEntityType
): BulkImportResult {
  const requiredFields =
    entityType === 'truck'
      ? TRUCK_REQUIRED_FIELDS
      : entityType === 'trailer'
        ? TRAILER_REQUIRED_FIELDS
        : CLIENT_REQUIRED_FIELDS;

  const validRows: BulkImportRow[] = [];
  const invalidRows: BulkImportRow[] = [];

  for (const row of rows) {
    const rowIndex = row._rowIndex ?? 0;
    const normalizedRow: Record<string, any> = { ...row };
    delete normalizedRow._rowIndex;

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const field of requiredFields) {
      const value = normalizedRow[field];
      if (!value || String(value).trim() === '') {
        errors.push(`الحقل "${field}" مطلوب`);
      }
    }

    const plate = normalizedRow.plate_number || normalizedRow.plate || '';
    if (plate && String(plate).trim() !== '') {
      const plateValidation = validatePlateNumber(String(plate).trim());
      if (!plateValidation.valid) {
        errors.push(plateValidation.message || 'لوحة المركبة غير صحيحة');
      }
    }

    const ice = normalizedRow.ice || normalizedRow.identifiant || '';
    if (entityType === 'client' && ice && String(ice).trim() !== '') {
      const iceValidation = validateICE(String(ice).trim());
      if (!iceValidation.valid) {
        errors.push(iceValidation.message || 'رقم ICE غير صحيح');
      }
    }

    if (entityType === 'truck' && (!normalizedRow.status || String(normalizedRow.status).trim() === '')) {
      warnings.push('حقل "status" فارغ، سيتم تعيين القيمة الافتراضية "active"');
    }

    if (entityType === 'client' && (!normalizedRow.client_type || String(normalizedRow.client_type).trim() === '')) {
      warnings.push('حقل "client_type" فارغ، سيتم تعيين القيمة الافتراضية "export"');
    }

    const rowResult: BulkImportRow = {
      rowIndex,
      data: normalizedRow,
      errors,
      warnings,
    };

    if (errors.length > 0) {
      invalidRows.push(rowResult);
    } else {
      validRows.push(rowResult);
    }
  }

  return {
    validRows,
    invalidRows,
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
  };
}
