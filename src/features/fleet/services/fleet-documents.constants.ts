import type { FleetDocument } from '@/types/database';

export interface FleetMatrixRow {
  entity_id: number;
  entity_type: 'truck' | 'trailer';
  plate_number: string;
  model: string;
  status: string;
  is_active: boolean;
  documents: Record<string, FleetDocument | null>;
  overall_status: 'safe' | 'warning' | 'expired' | 'missing';
  urgent_count: number;
}

export const DOCUMENT_TYPE_LABELS: Record<string, { label_ar: string; label_fr: string; label_en: string }> = {
  insurance: { label_ar: 'التأمين الدولي / المحلي', label_fr: 'Assurance', label_en: 'Insurance' },
  technical_inspection: { label_ar: 'الفحص التقني', label_fr: 'Visite Technique', label_en: 'Technical Inspection' },
  grey_card: { label_ar: 'البطاقة الرمادية', label_fr: 'Carte Grise', label_en: 'Grey Card' },
  transport_license: { label_ar: 'رخصة النقل / CMR', label_fr: 'Autorisation de Transport', label_en: 'Transport License / CMR' },
  atp_certificate: { label_ar: 'شهادة التبريد ATP', label_fr: 'Certificat ATP', label_en: 'ATP Certificate' },
  tachograph_calibration: { label_ar: 'معايرة التاكوغراف', label_fr: 'Tachygraphe', label_en: 'Tachograph Calibration' },
  other: { label_ar: 'وثيقة أخرى', label_fr: 'Autre Document', label_en: 'Other Document' },

  assurance: { label_ar: 'التأمين الدولي / المحلي', label_fr: 'Assurance', label_en: 'Insurance' },
  visite_technique: { label_ar: 'الفحص التقني', label_fr: 'Visite Technique', label_en: 'Technical Inspection' },
  carte_grise: { label_ar: 'البطاقة الرمادية', label_fr: 'Carte Grise', label_en: 'Grey Card' },
  'التأمين': { label_ar: 'التأمين', label_fr: 'Assurance', label_en: 'Insurance' },
  '*التأمين': { label_ar: '*التأمين', label_fr: '*Assurance', label_en: '*Insurance' },
  'البطاقة الرمادية': { label_ar: 'البطاقة الرمادية', label_fr: 'Carte Grise', label_en: 'Grey Card' },
  '*البطاقة الرمادية': { label_ar: '*البطاقة الرمادية', label_fr: '*Carte Grise', label_en: '*Grey Card' },
  'الفحص التقني': { label_ar: 'الفحص التقني', label_fr: 'Visite Technique', label_en: 'Technical Inspection' },
  '*الفحص التقني': { label_ar: '*الفحص التقني', label_fr: '*Visite Technique', label_en: '*Technical Inspection' },
  'رخصة النقل': { label_ar: 'رخصة النقل / CMR', label_fr: 'Autorisation de Transport', label_en: 'Transport License / CMR' },
  '*رخصة النقل': { label_ar: '*رخصة النقل', label_fr: '*Autorisation de Transport', label_en: '*Transport License / CMR' },
};

export const DEFAULT_DOCUMENT_CATEGORIES: Array<{
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
  applicable_to: 'both' | 'truck' | 'trailer';
  is_active: boolean;
}> = [
  { id: 1, name: 'التأمين الدولي / المحلي', name_fr: 'Assurance', name_en: 'Insurance', applicable_to: 'both', is_active: true },
  { id: 2, name: 'الفحص التقني', name_fr: 'Visite Technique', name_en: 'Technical Inspection', applicable_to: 'both', is_active: true },
  { id: 3, name: 'البطاقة الرمادية', name_fr: 'Carte Grise', name_en: 'Grey Card', applicable_to: 'both', is_active: true },
  { id: 4, name: 'رخصة النقل / CMR', name_fr: 'Autorisation de Transport', name_en: 'Transport License / CMR', applicable_to: 'truck', is_active: true },
  { id: 5, name: 'شهادة التبريد ATP', name_fr: 'Certificat ATP', name_en: 'ATP Certificate', applicable_to: 'both', is_active: true },
  { id: 6, name: 'معايرة التاكوغراف', name_fr: 'Tachygraphe', name_en: 'Tachograph Calibration', applicable_to: 'truck', is_active: true },
  { id: 7, name: 'وثيقة أخرى', name_fr: 'Autre Document', name_en: 'Other Document', applicable_to: 'both', is_active: true },
];

export const CORE_DOC_TYPES = [
  'insurance',
  'technical_inspection',
  'grey_card',
  'transport_license',
  'atp_certificate',
  'tachograph_calibration',
];

/**
 * Resolves document type label safely from FleetDocument object or type string
 */
export function getDocumentTypeLabel(
  docOrType?: Partial<FleetDocument> | string | null,
  locale: 'ar' | 'fr' | 'en' = 'ar'
): string {
  if (!docOrType) {
    if (locale === 'fr') return 'Document';
    if (locale === 'en') return 'Document';
    return 'وثيقة';
  }

  const rawType =
    typeof docOrType === 'string'
      ? docOrType
      : (docOrType as Record<string, unknown>).doc_type?.toString() ||
        docOrType.document_type ||
        (docOrType as Record<string, unknown>).document_name?.toString() ||
        (docOrType as Record<string, unknown>).title?.toString() ||
        (docOrType as Record<string, unknown>).name?.toString() ||
        '';

  const trimmed = rawType.trim();
  if (!trimmed) {
    if (locale === 'fr') return 'Document';
    if (locale === 'en') return 'Document';
    return 'وثيقة';
  }

  if (DOCUMENT_TYPE_LABELS[trimmed]) {
    if (locale === 'fr') return DOCUMENT_TYPE_LABELS[trimmed].label_fr;
    if (locale === 'en') return DOCUMENT_TYPE_LABELS[trimmed].label_en;
    return DOCUMENT_TYPE_LABELS[trimmed].label_ar;
  }

  const cleanKey = trimmed.toLowerCase();
  if (DOCUMENT_TYPE_LABELS[cleanKey]) {
    if (locale === 'fr') return DOCUMENT_TYPE_LABELS[cleanKey].label_fr;
    if (locale === 'en') return DOCUMENT_TYPE_LABELS[cleanKey].label_en;
    return DOCUMENT_TYPE_LABELS[cleanKey].label_ar;
  }

  const defaultMatch = DEFAULT_DOCUMENT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === cleanKey || c.name_fr.toLowerCase() === cleanKey || c.name_en.toLowerCase() === cleanKey
  );
  if (defaultMatch) {
    if (locale === 'fr') return defaultMatch.name_fr;
    if (locale === 'en') return defaultMatch.name_en;
    return defaultMatch.name;
  }

  return trimmed;
}

export interface DocStatusDetails {
  status: 'safe' | 'warning' | 'expired' | 'missing';
  days: number;
  durationText: string;
  badgeLabel: string;
  cardClass: string;
  textClass: string;
  badgeClass: string;
  borderColor: string;
}

/**
 * Calculates days remaining/expired and returns formatted text & styling matching Flutter app
 */
export function getDocStatusDetails(
  expiryDate?: string | null,
  locale: 'ar' | 'fr' | 'en' = 'ar'
): DocStatusDetails {
  if (!expiryDate) {
    return {
      status: 'safe',
      days: 9999,
      durationText: locale === 'fr' ? 'Valide (sans date)' : locale === 'en' ? 'Valid (no expiry)' : 'ساري (بدون تاريخ انتهاء)',
      badgeLabel: locale === 'fr' ? 'Valide' : locale === 'en' ? 'Valid' : 'ساري',
      cardClass: 'bg-white dark:bg-[#11161d] border-slate-200 dark:border-border/50',
      textClass: 'text-slate-500 dark:text-slate-400 font-medium',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      borderColor: 'border-slate-200 dark:border-border/50',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return {
      status: 'expired',
      days: diffDays,
      durationText: locale === 'fr' ? `Expiré depuis ${daysAgo} jour(s)` : locale === 'en' ? `Expired ${daysAgo} day(s) ago` : `انتهت منذ ${daysAgo} يوم`,
      badgeLabel: locale === 'fr' ? 'Expiré' : locale === 'en' ? 'Expired' : 'منتهي',
      cardClass: 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50',
      textClass: 'text-rose-600 dark:text-rose-400 font-bold',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60',
      borderColor: 'border-rose-300 dark:border-rose-800/60',
    };
  }

  if (diffDays === 0) {
    return {
      status: 'warning',
      days: 0,
      durationText: locale === 'fr' ? "Expire aujourd'hui" : locale === 'en' ? "Expires today" : 'تنتهي اليوم',
      badgeLabel: locale === 'fr' ? "Aujourd'hui" : locale === 'en' ? 'Today' : 'اليوم',
      cardClass: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50',
      textClass: 'text-amber-600 dark:text-amber-400 font-bold',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60',
      borderColor: 'border-amber-300 dark:border-amber-800/60',
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'warning',
      days: diffDays,
      durationText: locale === 'fr' ? `Expire dans ${diffDays} jour(s)` : locale === 'en' ? `Expires in ${diffDays} day(s)` : `ينتهي خلال ${diffDays} يوم`,
      badgeLabel: locale === 'fr' ? `${diffDays} j` : locale === 'en' ? `${diffDays}d` : `${diffDays} يوم`,
      cardClass: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50',
      textClass: 'text-amber-600 dark:text-amber-400 font-bold',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60',
      borderColor: 'border-amber-300 dark:border-amber-800/60',
    };
  }

  return {
    status: 'safe',
    days: diffDays,
    durationText: locale === 'fr' ? `${diffDays} jours restants` : locale === 'en' ? `${diffDays} days remaining` : `متبقي ${diffDays} يوم`,
    badgeLabel: locale === 'fr' ? 'Valide' : locale === 'en' ? 'Valid' : 'ساري',
    cardClass: 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50',
    textClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60',
    borderColor: 'border-emerald-300 dark:border-emerald-800/60',
  };
}
