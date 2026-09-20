import * as XLSX from 'xlsx';
import {
  validateICE,
  validateMoroccanPlate,
  type ValidationResult,
} from '@/lib/validators/morocco-business';
import {
  sanitizeRowByEntity,
} from '@/lib/data-sanitizer';

export type BulkImportEntityType =
  | 'client'
  | 'truck'
  | 'trailer'
  | 'driver'
  | 'trip'
  | 'provider'
  | 'treasury';

export { validateICE, validateMoroccanPlate };
export const validatePlateNumber = validateMoroccanPlate;
export type { ValidationResult };

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

export const ENTITY_REQUIRED_FIELDS: Record<BulkImportEntityType, readonly string[]> = {
  client: ['name', 'phone', 'ice'],
  truck: ['plate_number', 'model'],
  trailer: ['plate_number', 'model'],
  driver: ['name', 'phone', 'license'],
  trip: ['departure_date', 'price'],
  provider: ['name', 'type'],
  treasury: ['type', 'amount', 'currency'],
};

export const FIELD_ALIASES: Record<string, string[]> = {
  plate_number: ['plate_number', 'plate', 'matricule', 'immatriculation', 'لوحة', 'رقم اللوحة', 'رقم_اللوحة', 'matrícula', 'placa'],
  model: ['model', 'modele', 'موديل', 'طراز', 'الموديل', 'modelo'],
  status: ['status', 'حالة', 'état', 'الحالة', 'estado'],
  weight_capacity: ['weight_capacity', 'poids', 'حمولة', 'capacite', 'الحمولة', 'الحمولة_طن', 'capacidad'],
  fuel_consumption_rate: ['fuel_consumption_rate', 'consommation', 'معدل_استهلاك_الوقود', 'استهلاك الوقود', 'consumo'],
  name: ['name', 'nom', 'اسم', 'client_name', 'company_name', 'اسم العميل', 'اسم_العميل', 'اسم_المورد', 'اسم المورد', 'nombre', 'raison sociale'],
  phone: ['phone', 'telephone', 'tel', 'هاتف', 'téléphone', 'رقم الهاتف', 'رقم_الهاتف', 'الهاتف', 'teléfono'],
  email: ['email', 'mail', 'بريد', 'البريد', 'البريد_الإلكتروني', 'البريد الإلكتروني', 'correo'],
  city: ['city', 'ville', 'مدينة', 'city_name', 'المدينة', 'ciudad'],
  address: ['address', 'adresse', 'عنوان', 'العنوان', 'العنوان_الكامل', 'dirección', 'direccion'],
  ice: ['ice', 'identifiant', 'رقم التعريف الضريبي', 'ice_number', 'رقم_ice', 'معرف الشركة', 'identifiant fiscal'],
  client_type: ['client_type', 'tipo_cliente', 'نوع العميل', 'نوع_العميل'],
  currency: ['currency', 'devise', 'عملة', 'العملة', 'moneda'],
  is_active: ['is_active', 'active', 'نشط', 'actif', 'activo'],
  // Driver aliases
  license: ['license', 'permis', 'رقم_الرخصة', 'رقم الرخصة', 'رخصة القيادة', 'numero_permis', 'licencia'],
  base_salary: ['base_salary', 'الراتب_الأساسي', 'الراتب الأساسي', 'salaire_base', 'salary', 'sueldo', 'راتب'],
  bonus_percentage: ['bonus_percentage', 'نسبة_العمولة', 'نسبة العمولة', 'commission', 'bonus', 'porcentaje_comision'],
  visa_number: ['visa_number', 'رقم_التأشيرة_شنغن', 'رقم التأشيرة شنغن', 'visa_schengen', 'schengen_visa', 'visa'],
  african_visa_number: ['african_visa_number', 'تأشيرة_إفريقيا', 'تأشيرة إفريقيا', 'visa_afrique', 'african_visa'],
  visa_type: ['visa_type', 'نوع_التأشيرة', 'نوع التأشيرة', 'tipo_visado', 'type_visa'],
  // Trip aliases
  route: ['route', 'مسار_الرحلة', 'مسار الرحلة', 'المسار', 'trajet', 'itinerario'],
  departure_date: ['departure_date', 'تاريخ_الانطلاق', 'تاريخ الانطلاق', 'date_depart', 'fecha_salida', 'date'],
  price: ['price', 'سعر_الرحلة', 'سعر الرحلة', 'السعر', 'prix', 'freight_price', 'precio'],
  cmr_number: ['cmr_number', 'رقم_CMR_تصدير', 'رقم CMR تصدير', 'رقم_cmr', 'cmr', 'numero_cmr'],
  truck_plate: ['truck_plate', 'لوحة_الشاحنة', 'لوحة الشاحنة', 'matricule_camion', 'placa_camion'],
  driver_name: ['driver_name', 'اسم_السائق', 'اسم السائق', 'nom_chauffeur', 'conductor'],
  client_name: ['client_name', 'اسم_العميل', 'اسم العميل', 'nom_client', 'cliente'],
  // Provider aliases
  type: ['type', 'نوع_الخدمة', 'نوع الخدمة', 'نوع_الحركة', 'نوع الحركة', 'type_service', 'service_type', 'tipo'],
  // Treasury aliases
  amount: ['amount', 'المبلغ', 'montant', 'monto', 'valeur'],
  description: ['description', 'البيان_والوصف', 'البيان والوصف', 'البيان', 'الوصف', 'libelle', 'concepto'],
  reference: ['reference', 'المرجع', 'piece_ref', 'ref', 'referencia'],
};

export function normalizeFieldName(name: string): string {
  const normalized = name.toLowerCase().trim().replace(/[\s_-]+/g, '_');
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (canonical === normalized || aliases.some(alias => alias.toLowerCase().replace(/[\s_-]+/g, '_') === normalized)) {
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

export function validateBulkRows(
  rows: Record<string, any>[],
  entityType: BulkImportEntityType
): BulkImportResult {
  const requiredFields = ENTITY_REQUIRED_FIELDS[entityType] || [];

  const validRows: BulkImportRow[] = [];
  const invalidRows: BulkImportRow[] = [];

  for (const row of rows) {
    const rowIndex = row._rowIndex ?? 0;
    let normalizedRow: Record<string, any> = { ...row };
    delete normalizedRow._rowIndex;

    // تجاهل الصفوف الإرشادية التي تحتوي على (مثال)
    const isSampleRow = Object.values(normalizedRow).some(
      val => typeof val === 'string' && (val.includes('(مثال)') || val.includes('(Exemple)') || val.includes('(Ejemplo)'))
    );
    if (isSampleRow) {
      continue;
    }

    // تطبيق التطهير والتجميل التلقائي
    normalizedRow = sanitizeRowByEntity(normalizedRow, entityType);

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const field of requiredFields) {
      const value = normalizedRow[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push(`الحقل "${field}" مطلوب`);
      }
    }

    const plate = normalizedRow.plate_number || normalizedRow.plate || normalizedRow.truck_plate || '';
    if (plate && String(plate).trim() !== '' && (entityType === 'truck' || entityType === 'trailer')) {
      const plateValidation = validatePlateNumber(String(plate).trim());
      if (!plateValidation.valid) {
        errors.push(plateValidation.message || 'لوحة المركبة غير صحيحة');
      }
    }

    const ice = normalizedRow.ice || normalizedRow.identifiant || '';
    if ((entityType === 'client' || entityType === 'provider') && ice && String(ice).trim() !== '') {
      const iceValidation = validateICE(String(ice).trim());
      if (!iceValidation.valid) {
        errors.push(iceValidation.message || 'رقم ICE غير صحيح');
      }
    }

    // إعداد القيم الافتراضية
    if ((entityType === 'truck' || entityType === 'trailer') && (!normalizedRow.status || String(normalizedRow.status).trim() === '')) {
      warnings.push('حقل "status" فارغ، سيتم تعيين القيمة الافتراضية "active"');
      normalizedRow.status = 'active';
    }

    if (entityType === 'driver' && (!normalizedRow.status || String(normalizedRow.status).trim() === '')) {
      normalizedRow.status = 'active';
    }

    if (entityType === 'trip' && (!normalizedRow.status || String(normalizedRow.status).trim() === '')) {
      normalizedRow.status = 'completed';
    }

    if (entityType === 'client' && (!normalizedRow.client_type || String(normalizedRow.client_type).trim() === '')) {
      warnings.push('حقل "client_type" فارغ، سيتم تعيين القيمة الافتراضية "export"');
      normalizedRow.client_type = 'export';
    }

    if (entityType === 'treasury' && (!normalizedRow.currency || String(normalizedRow.currency).trim() === '')) {
      normalizedRow.currency = 'MAD';
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

/**
 * توليد نماذج Excel ذكية مع الصف الإرشادي التوضيحي الملون للكيانات السبعة
 */
export function generateSmartExcelTemplate(entityType: BulkImportEntityType): void {
  let headers: string[] = [];
  let exampleRow: Record<string, any> = {};
  let colWidths: { wch: number }[] = [];

  switch (entityType) {
    case 'client':
      headers = ['اسم_العميل', 'رقم_الهاتف', 'البريد_الإلكتروني', 'المدينة', 'العنوان', 'ICE', 'نوع_العميل', 'العملة'];
      exampleRow = {
        'اسم_العميل': 'شركة الأطلس للتصدير SARL (مثال)',
        'رقم_الهاتف': '0661234567',
        'البريد_الإلكتروني': 'contact@atlas.ma',
        'المدينة': 'طنجة',
        'العنوان': 'المنطقة الحرة كزناية',
        'ICE': '001928374000082',
        'نوع_العميل': 'export',
        'العملة': 'MAD',
      };
      colWidths = [{ wch: 28 }, { wch: 18 }, { wch: 25 }, { wch: 16 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 12 }];
      break;

    case 'driver':
      headers = ['اسم_السائق', 'رقم_الهاتف', 'رقم_الرخصة', 'الراتب_الأساسي', 'نسبة_العمولة', 'نوع_التأشيرة', 'رقم_التأشيرة_شنغن', 'تأشيرة_إفريقيا'];
      exampleRow = {
        'اسم_السائق': 'محمد العلمي (مثال)',
        'رقم_الهاتف': '0661223344',
        'رقم_الرخصة': 'B/C/EC-48201',
        'الراتب_الأساسي': '6500',
        'نسبة_العمولة': '5',
        'نوع_التأشيرة': 'schengen',
        'رقم_التأشيرة_شنغن': 'V-ESP-2026-99',
        'تأشيرة_إفريقيا': '',
      };
      colWidths = [{ wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 15 }, { wch: 16 }, { wch: 22 }, { wch: 20 }];
      break;

    case 'trip':
      headers = ['مسار_الرحلة', 'تاريخ_الانطلاق', 'سعر_الرحلة', 'العملة', 'رقم_CMR_تصدير', 'لوحة_الشاحنة', 'اسم_السائق', 'اسم_العميل'];
      exampleRow = {
        'مسار_الرحلة': 'طنجة -> الجزيرة الخضراء -> مدريد (مثال)',
        'تاريخ_الانطلاق': '2026-09-20',
        'سعر_الرحلة': '32000',
        'العملة': 'MAD',
        'رقم_CMR_تصدير': 'CMR-EXP-00105',
        'لوحة_الشاحنة': '12345-A-40',
        'اسم_السائق': 'محمد العلمي',
        'اسم_العميل': 'شركة الأطلس للتصدير',
      };
      colWidths = [{ wch: 36 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 25 }];
      break;

    case 'provider':
      headers = ['اسم_المورد', 'نوع_الخدمة', 'رقم_الهاتف', 'المدينة', 'العنوان', 'ICE'];
      exampleRow = {
        'اسم_المورد': 'محطة وقود أفريقيا طنجة المتوسط (مثال)',
        'نوع_الخدمة': 'fuel',
        'رقم_الهاتف': '0539934010',
        'المدينة': 'طنجة',
        'العنوان': 'ميناء طنجة المتوسط',
        'ICE': '001594830000012',
      };
      colWidths = [{ wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 22 }];
      break;

    case 'treasury':
      headers = ['نوع_الحركة', 'المبلغ', 'العملة', 'البيان_والوصف', 'المرجع', 'التاريخ_المرجعي'];
      exampleRow = {
        'نوع_الحركة': 'deposit',
        'المبلغ': '150000',
        'العملة': 'MAD',
        'البيان_والوصف': 'رصيد افتتاحي تأسيسي للصندوق الرئيسي (مثال)',
        'المرجع': 'OP-BAL-2026',
        'التاريخ_المرجعي': '2026-01-01',
      };
      colWidths = [{ wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 36 }, { wch: 18 }, { wch: 18 }];
      break;

    case 'truck':
      headers = ['رقم_اللوحة', 'الموديل', 'الحالة', 'الحمولة_طن', 'معدل_استهلاك_الوقود'];
      exampleRow = {
        'رقم_اللوحة': '12345-أ-40 (مثال)',
        'الموديل': 'Volvo FH 500 Euro 6',
        'الحالة': 'active',
        'الحمولة_طن': '25',
        'معدل_استهلاك_الوقود': '34.5',
      };
      colWidths = [{ wch: 20 }, { wch: 26 }, { wch: 15 }, { wch: 15 }, { wch: 22 }];
      break;

    case 'trailer':
      headers = ['رقم_اللوحة', 'الموديل', 'الحالة'];
      exampleRow = {
        'رقم_اللوحة': 'REM-8921-MA (مثال)',
        'الموديل': 'Schmitz Cargobull Frigo',
        'الحالة': 'active',
      };
      colWidths = [{ wch: 22 }, { wch: 26 }, { wch: 15 }];
      break;
  }

  const worksheet = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
  worksheet['!cols'] = colWidths;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `نموذج_${entityType}`);
  XLSX.writeFile(workbook, `نموذج_استيراد_${entityType}.xlsx`);
}

export const downloadSampleExcel = generateSmartExcelTemplate;
