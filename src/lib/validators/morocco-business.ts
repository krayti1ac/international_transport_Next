/**
 * Moroccan Business & Vehicle Identifiers Validation
 * وحدة التحقق الموحدة لمعايير المقاولات والمركبات بالمملكة المغربية
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * التحقق الصارم من المعرف الموحد للمقاولة بالمغرب (ICE)
 * يتكون من 15 رقماً بالضبط بعد إزالة المسافات
 */
export function validateICE(ice: unknown): ValidationResult {
  if (ice === null || ice === undefined || String(ice).trim() === '') {
    return { valid: false, message: 'رقم ICE مطلوب' };
  }

  const cleaned = String(ice).trim().replace(/\s+/g, '');

  // المعرف الموحد للمقاولة يتكون من 15 رقماً بالضبط
  if (!/^\d{15}$/.test(cleaned)) {
    return {
      valid: false,
      message: 'رقم ICE غير صحيح. يجب أن يتكون من 15 رقماً بالضبط (مثال: 001928374000082)',
    };
  }

  return { valid: true };
}

/**
 * الأنماط المعتمدة للوحات التسجيل بالمملكة المغربية
 * 1. اللوحة المغربية القياسية: 12345-أ-6 أو 12345-A-6 أو 12345 | أ | 6
 * 2. لوحات المقطورات وشبه المقطورات: REM-8921-MA أو R-12345-A أو م-12345-6
 * 3. اللوحات المؤقتة والخاصة: 12345-WW أو 12345-A
 */
const MOROCCAN_PLATE_PATTERNS = [
  // صيغة قياسية: [1-6 أرقام] [فاصل] [حرف عربي أو لاتيني 1-3] [فاصل] [1-3 أرقام كود الإقليم]
  /^\d{1,6}\s*[-/| ]\s*([\u0600-\u06FF]|[A-Za-z]{1,3})\s*[-/| ]\s*\d{1,3}$/,
  // صيغة المقطورات: REM-1234-MA / R-12345-A / م-12345-6
  /^(REM|rem|R|r|م|مقطورة)\s*[-/| ]\s*\d{1,6}\s*[-/| ]\s*([\u0600-\u06FF]|[A-Za-z0-9]{1,3})$/i,
  // صيغة من جزأين (تسجيل مؤقت WW أو تسجيل ثنائي): 12345-WW / 12345-A / 12345-أ
  /^\d{1,6}\s*[-/| ]\s*([\u0600-\u06FF]|[A-Za-z]{1,4})$/,
];

/**
 * التحقق من صيغة لوحة تسجيل المركبات المغربية
 */
export function validateMoroccanPlate(plate: unknown): ValidationResult {
  if (plate === null || plate === undefined || String(plate).trim() === '') {
    return { valid: false, message: 'رقم لوحة التسجيل مطلوب' };
  }

  const trimmed = String(plate).trim();

  const isValid = MOROCCAN_PLATE_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (!isValid) {
    return {
      valid: false,
      message: 'صيغة لوحة التسجيل غير صحيحة. استخدم الصيغة المغربية المعتمدة (مثال: 12345-أ-6 أو 12345-A-6 أو REM-8921-MA)',
    };
  }

  return { valid: true };
}

/**
 * التحقق من صحة البريد الإلكتروني
 */
export function validateEmail(email: unknown): ValidationResult {
  if (email === null || email === undefined || String(email).trim() === '') {
    return { valid: false, message: 'عنوان البريد الإلكتروني مطلوب' };
  }

  const trimmed = String(email).trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      message: 'عنوان البريد الإلكتروني غير صحيح (مثال: contact@company.ma)',
    };
  }

  return { valid: true };
}

/**
 * التحقق من صحة رقم الهاتف (مغربي أو دولي)
 */
export function validatePhone(phone: unknown): ValidationResult {
  if (phone === null || phone === undefined || String(phone).trim() === '') {
    return { valid: false, message: 'رقم الهاتف مطلوب' };
  }

  const trimmed = String(phone).trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (digitsOnly.length < 8 || digitsOnly.length > 15 || !/^\+?[0-9\s().-]{8,25}$/.test(trimmed)) {
    return {
      valid: false,
      message: 'رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف صالح (مثال: 0612345678 أو +212612345678)',
    };
  }

  return { valid: true };
}

/**
 * دوال تكييف للاستخدام مع معالجات الاستيراد (Field Validators)
 * تُرجع نص الخطأ إذا كانت القيمة غير صالحة، أو null إذا كانت صالحة
 * تتجاهل القيم الفارغة لأن التحقق من الحقول الإلزامية يتم بشكل منفصل
 */
export function validateICEField(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const res = validateICE(value);
  return res.valid ? null : (res.message || 'رقم ICE غير صحيح');
}

export function validateMoroccanPlateField(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const res = validateMoroccanPlate(value);
  return res.valid ? null : (res.message || 'صيغة لوحة التسجيل غير صحيحة');
}

export function validateEmailField(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const res = validateEmail(value);
  return res.valid ? null : (res.message || 'عنوان البريد الإلكتروني غير صحيح');
}

export function validatePhoneField(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const res = validatePhone(value);
  return res.valid ? null : (res.message || 'رقم الهاتف غير صحيح');
}

