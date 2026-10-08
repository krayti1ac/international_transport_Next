/**
 * Normalizes and formats international phone numbers:
 * - Strips all non-digit and non-plus characters
 * - Normalizes Moroccan local prefixes (06..., 07..., 05... -> 212...)
 * - Handles leading +, 00, or raw digits
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  else if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  else if (cleaned.startsWith('0')) cleaned = '212' + cleaned.substring(1);
  return cleaned;
}

