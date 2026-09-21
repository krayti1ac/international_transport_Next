import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface SanitizedClientRow {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  ice: string;
  client_type: 'export' | 'import';
  currency: 'MAD' | 'EUR' | 'USD' | 'MRU' | 'XOF';
}

export interface SanitizedVehicleRow {
  plate_number: string;
  model: string;
  status: 'active' | 'maintenance' | 'inactive';
  weight_capacity?: number;
  fuel_consumption_rate?: number;
}

export interface SanitizedDriverRow {
  name: string;
  phone: string;
  license: string;
  base_salary: number;
  bonus_percentage: number;
  status: string;
  visa_type?: 'schengen' | 'african_transit' | 'both' | string;
  visa_number?: string;
  african_visa_number?: string;
}

export interface SanitizedTripRow {
  route: string;
  departure_date: string;
  price: number;
  currency: string;
  cmr_number?: string;
  truck_plate?: string;
  driver_name?: string;
  client_name?: string;
  status: string;
}

export interface SanitizedProviderRow {
  name: string;
  type: string;
  phone?: string;
  city?: string;
  address?: string;
  ice?: string;
  email?: string;
}

export interface SanitizedTreasuryRow {
  type: string;
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  created_at?: string;
}

/**
 * 1. تطهير وتنقية معرّف المقاولة بالمغرب (ICE)
 * إزالة الفراغات والشرطات والنقاط وأي أحرف غير رقمية ليبقى 15 رقماً ناصعاً
 */
export function sanitizeICE(raw?: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  // إزالة كافة الأحرف غير الرقمية (مسافات، فواصل، شرطات)
  return str.replace(/\D/g, '');
}

/**
 * 2. تطهير وتوحيد لوحة ترقيم الشاحنات والمقطورات المغربية
 * يحوّل صيغ مثل: "12345/A/40" أو "12345 | أ | 40" إلى "12345-أ-40" أو "12345-A-40"
 * ويوحّد لوحات المقطورات مثل "REM 8921 MA" إلى "REM-8921-MA"
 */
export function sanitizeMoroccanPlate(raw?: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (!str) return '';

  // إزالة الكشيدة أو التطويل العربي (مثل هـ تصبح ه)
  str = str.replace(/\u0640/g, '');

  // استبدال الشرائح المائلة والخطوط العمودية والشرطات السفلية بشرطة عادية
  str = str.replace(/[\/|\\_]+/g, '-');
  
  // استبدال المسافات حول الشرطات
  str = str.replace(/\s*-\s*/g, '-');

  // معالجة اللوحات المكتوبة بمسافات فقط (مثل: "12345 أ 40" أو "12345 A 40")
  const spaceStandardPattern = /^(\d{1,6})\s+([\u0600-\u06FF]|[A-Za-z]{1,4})\s+(\d{1,3})$/;
  if (spaceStandardPattern.test(str)) {
    str = str.replace(spaceStandardPattern, '$1-$2-$3');
  }

  // معالجة لوحات المقطورات المكتوبة بمسافات (مثل: "REM 8921 MA" أو "R 12345 A")
  const trailerSpacePattern = /^(REM|rem|R|r|م|مقطورة)\s+(\d{1,6})\s+([\u0600-\u06FF]|[A-Za-z0-9]{1,3})$/i;
  if (trailerSpacePattern.test(str)) {
    str = str.replace(trailerSpacePattern, '$1-$2-$3').toUpperCase();
  }

  // تنظيف المسافات المتبقية والشرطات المتتالية
  str = str.replace(/-+/g, '-').replace(/\s+/g, ' ').trim();

  return str;
}

/**
 * 3. تطهير أرقام الهواتف وتحويلها إلى الصيغة الدولية القياسية
 * يحوّل 0612345678 أو 0522... إلى +212... تلقائياً
 */
export function sanitizePhoneNumber(raw?: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim().replace(/[^\d+]/g, '');
  if (!str) return '';

  // معالجة البادئة 00 وتحويلها إلى +
  if (str.startsWith('00')) {
    str = '+' + str.substring(2);
  } else if (str.startsWith('0') && !str.startsWith('+')) {
    // رقم محلي مغربي مثل 06... أو 05...
    str = '+212' + str.substring(1);
  } else if (!str.startsWith('+') && str.length === 9) {
    // رقم بدون الصفر المبدئي مثل 612345678
    str = '+212' + str;
  }

  return str;
}

/**
 * 4. تطهير الأرقام والأسعار المالية بدقة Decimal.js لمنع الفاصلة العائمة
 */
export function sanitizeNumeric(raw?: unknown, fallback = 0): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  try {
    const str = String(raw).trim();
    if (!str) return fallback;

    // إزالة المسافات الداخلية لتسهيل المعالجة
    let cleaned = str.replace(/\s+/g, '');

    // إذا كانت الفاصلة مستخدمة كفاصلة عشرية (مثال: 34,5 أو 34,50)
    if (/^[-+]?\d+,\d{1,2}([^\d]|$)/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.');
    } else {
      // الفاصلة مستخدمة كفاصل للآلاف (مثال: 25,000)
      cleaned = cleaned.replace(/,/g, '');
    }

    // استخراج أول تعبير عددي صالح فقط متجاهلاً الأرقام في الوحدات اللاحقة مثل /100km
    const match = cleaned.match(/[-+]?\d*\.?\d+/);
    if (!match || match[0] === '' || match[0] === '-' || match[0] === '.') return fallback;

    const dec = new Decimal(match[0]);
    return dec.isFinite() ? dec.toNumber() : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 5. تطهير صف العميل تلقائياً
 */
export function sanitizeClientRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };

  if ('ice' in result || 'identifiant' in result) {
    const rawIce = result.ice ?? result.identifiant;
    result.ice = sanitizeICE(rawIce);
  }

  if ('phone' in result || 'telephone' in result || 'tel' in result) {
    const rawPhone = result.phone ?? result.telephone ?? result.tel;
    result.phone = sanitizePhoneNumber(rawPhone);
  }

  if ('name' in result && typeof result.name === 'string') {
    result.name = result.name.trim().replace(/\s+/g, ' ');
  }

  if ('email' in result && typeof result.email === 'string') {
    result.email = result.email.trim().toLowerCase();
  }

  if ('city' in result && typeof result.city === 'string') {
    result.city = result.city.trim();
  }

  if ('address' in result && typeof result.address === 'string') {
    result.address = result.address.trim();
  }

  return result;
}

/**
 * 6. تطهير صف المركبة (شاحنة أو مقطورة) تلقائياً
 */
export function sanitizeVehicleRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };

  if ('plate_number' in result || 'plate' in result || 'matricule' in result || 'immatriculation' in result) {
    const rawPlate = result.plate_number ?? result.plate ?? result.matricule ?? result.immatriculation;
    result.plate_number = sanitizeMoroccanPlate(rawPlate);
  }

  if ('model' in result && typeof result.model === 'string') {
    result.model = result.model.trim();
  }

  if ('status' in result && typeof result.status === 'string') {
    result.status = result.status.trim();
  }

  if ('weight_capacity' in result) {
    result.weight_capacity = sanitizeNumeric(result.weight_capacity, 0);
  }

  if ('fuel_consumption_rate' in result) {
    result.fuel_consumption_rate = sanitizeNumeric(result.fuel_consumption_rate, 36);
  }

  return result;
}

/**
 * 7. تطهير شامل عام للصفوف بناءً على نوع الكيان
 * 7. تطهير صف السائق تلقائياً
 */
export function sanitizeDriverRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };

  if ('phone' in result || 'telephone' in result || 'tel' in result) {
    const rawPhone = result.phone ?? result.telephone ?? result.tel;
    result.phone = sanitizePhoneNumber(rawPhone);
  }

  if ('name' in result && typeof result.name === 'string') {
    result.name = result.name.trim().replace(/\s+/g, ' ');
  }

  if ('license' in result && typeof result.license === 'string') {
    result.license = result.license.trim();
  }

  if ('base_salary' in result) {
    result.base_salary = sanitizeNumeric(result.base_salary, 0);
  }

  if ('bonus_percentage' in result) {
    result.bonus_percentage = sanitizeNumeric(result.bonus_percentage, 0);
  }

  if ('status' in result && typeof result.status === 'string') {
    result.status = result.status.trim();
  }

  if ('visa_number' in result && typeof result.visa_number === 'string') {
    result.visa_number = result.visa_number.trim();
  }

  if ('african_visa_number' in result && typeof result.african_visa_number === 'string') {
    result.african_visa_number = result.african_visa_number.trim();
  }

  return result;
}

/**
 * 8. تطهير صف الرحلة تلقائياً
 */
export function sanitizeTripRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };

  if ('price' in result) {
    result.price = sanitizeNumeric(result.price, 0);
  }

  if ('truck_plate' in result || 'plate_number' in result) {
    const rawPlate = result.truck_plate ?? result.plate_number;
    result.truck_plate = sanitizeMoroccanPlate(rawPlate);
  }

  if ('route' in result && typeof result.route === 'string') {
    result.route = result.route.trim();
  }

  if ('departure_date' in result && typeof result.departure_date === 'string') {
    result.departure_date = result.departure_date.trim();
  }

  if ('cmr_number' in result && typeof result.cmr_number === 'string') {
    result.cmr_number = result.cmr_number.trim();
  }

  if ('currency' in result && typeof result.currency === 'string') {
    result.currency = result.currency.trim().toUpperCase();
  }

  return result;
}

/**
 * 9. تطهير صف المورد تلقائياً
 */
export function sanitizeProviderRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };

  if ('ice' in result || 'identifiant' in result) {
    const rawIce = result.ice ?? result.identifiant;
    result.ice = sanitizeICE(rawIce);
  }

  if ('phone' in result || 'telephone' in result || 'tel' in result) {
    const rawPhone = result.phone ?? result.telephone ?? result.tel;
    result.phone = sanitizePhoneNumber(rawPhone);
  }

  if ('name' in result && typeof result.name === 'string') {
    result.name = result.name.trim().replace(/\s+/g, ' ');
  }

  if ('type' in result && typeof result.type === 'string') {
    result.type = result.type.trim().toLowerCase();
  }

  if ('city' in result && typeof result.city === 'string') {
    result.city = result.city.trim();
  }

  if ('address' in result && typeof result.address === 'string') {
    result.address = result.address.trim();
  }

  return result;
}

/**
 * 10. تطهير صف الخزينة تلقائياً
 */
export function sanitizeTreasuryRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };

  if ('amount' in result) {
    result.amount = sanitizeNumeric(result.amount, 0);
  }

  if ('type' in result && typeof result.type === 'string') {
    result.type = result.type.trim().toLowerCase();
  }

  if ('currency' in result && typeof result.currency === 'string') {
    result.currency = result.currency.trim().toUpperCase();
  }

  if ('description' in result && typeof result.description === 'string') {
    result.description = result.description.trim();
  }

  if ('reference' in result && typeof result.reference === 'string') {
    result.reference = result.reference.trim();
  }

  return result;
}

/**
 * 11. تطهير شامل عام للصفوف بناءً على نوع الكيان من الكيانات السبعة
 */
export function sanitizeRowByEntity(
  row: Record<string, unknown>,
  entityType: 'client' | 'truck' | 'trailer' | 'driver' | 'trip' | 'provider' | 'treasury' | string
): Record<string, unknown> {
  if (entityType === 'client' || entityType === 'clients') {
    return sanitizeClientRow(row);
  }
  if (entityType === 'truck' || entityType === 'trucks' || entityType === 'trailer' || entityType === 'trailers') {
    return sanitizeVehicleRow(row);
  }
  if (entityType === 'driver' || entityType === 'drivers') {
    return sanitizeDriverRow(row);
  }
  if (entityType === 'trip' || entityType === 'trips') {
    return sanitizeTripRow(row);
  }
  if (entityType === 'provider' || entityType === 'providers') {
    return sanitizeProviderRow(row);
  }
  if (entityType === 'treasury') {
    return sanitizeTreasuryRow(row);
  }
  return { ...row };
}
