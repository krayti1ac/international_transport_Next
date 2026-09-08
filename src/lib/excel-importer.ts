import * as XLSX from 'xlsx';

export interface ImportValidationResult<T> {
  validData: T[];
  errors: { row: number; reasons: string[] }[];
  totalRows: number;
}

export interface ImportedClient {
  name: string;
  ice_number?: string;
  client_type: 'export' | 'import' | 'both';
  currency: 'MAD' | 'EUR';
  address?: string;
  contact_number?: string;
}

export interface ImportedTruck {
  plate_number: string;
  brand?: string;
  model?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'in_transit';
}

// 1. قارئ الملفات العام (يستقبل File ويخرج JSON)
export async function readExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // تحويل البيانات إلى JSON متجاوزاً الأسطر الفارغة
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        resolve(jsonData);
      } catch {
        reject(new Error('فشل قراءة ملف الإكسيل. تأكد من صحة الصيغة (.xlsx أو .csv)'));
      }
    };
    reader.onerror = () => reject(new Error('خطأ في قراءة الملف'));
    reader.readAsArrayBuffer(file);
  });
}

// 2. مدقق ومترجم بيانات العملاء
export function validateClientsImport(rawData: Record<string, unknown>[]): ImportValidationResult<ImportedClient> {
  const validData: ImportedClient[] = [];
  const errors: { row: number; reasons: string[] }[] = [];

  rawData.forEach((row, index) => {
    const rowNum = index + 2; // +2 لأن الصف 1 هو العناوين و index يبدأ من 0
    const rowErrors: string[] = [];

    // دعم مرن للعناوين باللغات الثلاث
    const name = row['الاسم'] || row['Name'] || row['Nom'];
    const ice = row['ICE'] || row['رقم التعريف'] || row['Identifiant'];
    const type = row['النوع'] || row['Type'];
    const currency = row['العملة'] || row['Currency'] || row['Devise'];
    const address = row['العنوان'] || row['Address'] || row['Adresse'];
    const phone = row['الهاتف'] || row['Phone'] || row['Téléphone'];

    if (!name || String(name).trim() === '') {
      rowErrors.push('اسم العميل مفقود (Name is required)');
    }
    
    // فحص صارم لـ ICE المغربي (15 رقم متصل)
    if (ice && String(ice).trim() !== '') {
      const iceStr = String(ice).trim().replace(/\s/g, '');
      if (!/^\d{15}$/.test(iceStr)) {
        rowErrors.push(`رقم ICE غير صالح (${iceStr}). يجب أن يتكون من 15 رقماً بالضبط.`);
      }
    }

    // مطابقة نوع العميل
    let clientType: 'export' | 'import' | 'both' = 'both';
    const typeStr = String(type || '').toLowerCase();
    if (typeStr.includes('export') || typeStr.includes('تصدير')) clientType = 'export';
    else if (typeStr.includes('import') || typeStr.includes('استيراد')) clientType = 'import';

    // مطابقة العملة
    let clientCurrency: 'MAD' | 'EUR' = 'MAD';
    const currStr = String(currency || '').toUpperCase();
    if (currStr.includes('EUR') || currStr.includes('يورو') || currStr.includes('€')) clientCurrency = 'EUR';

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, reasons: rowErrors });
    } else {
      validData.push({
        name: String(name).trim(),
        ice_number: ice ? String(ice).trim().replace(/\s/g, '') : undefined,
        client_type: clientType,
        currency: clientCurrency,
        address: address ? String(address).trim() : undefined,
        contact_number: phone ? String(phone).trim() : undefined,
      });
    }
  });

  return { validData, errors, totalRows: rawData.length };
}

// 3. مدقق ومترجم بيانات الأسطول (الشاحنات)
export function validateTrucksImport(rawData: Record<string, unknown>[]): ImportValidationResult<ImportedTruck> {
  const validData: ImportedTruck[] = [];
  const errors: { row: number; reasons: string[] }[] = [];

  rawData.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors: string[] = [];

    const plate = row['رقم اللوحة'] || row['Plate'] || row['Matricule'];
    const brand = row['العلامة التجارية'] || row['Brand'] || row['Marque'];
    const model = row['الموديل'] || row['Model'] || row['Modèle'];
    const status = row['الحالة'] || row['Status'] || row['Statut'];

    if (!plate || String(plate).trim() === '') {
      rowErrors.push('رقم اللوحة مفقود (Plate number is required)');
    } else {
      const plateStr = String(plate).trim();
      if (plateStr.length < 4) {
        rowErrors.push('تنسيق رقم اللوحة قصير جداً أو غير صالح');
      }
    }

    // مطابقة حالة الشاحنة
    let truckStatus: 'active' | 'inactive' | 'maintenance' | 'in_transit' = 'active';
    const statStr = String(status || '').toLowerCase();
    if (statStr.includes('inactive') || statStr.includes('متوقف')) truckStatus = 'inactive';
    else if (statStr.includes('maintenance') || statStr.includes('صيانة') || statStr.includes('ورشة')) truckStatus = 'maintenance';
    else if (statStr.includes('transit') || statStr.includes('طريق') || statStr.includes('رحلة')) truckStatus = 'in_transit';

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, reasons: rowErrors });
    } else {
      validData.push({
        plate_number: String(plate).trim(),
        brand: brand ? String(brand).trim() : undefined,
        model: model ? String(model).trim() : undefined,
        status: truckStatus,
      });
    }
  });

  return { validData, errors, totalRows: rawData.length };
}

