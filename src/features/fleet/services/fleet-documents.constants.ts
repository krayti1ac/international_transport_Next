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

export const DOCUMENT_TYPE_LABELS: Record<string, { label_ar: string; label_fr: string }> = {
  insurance: { label_ar: 'التأمين الدولي / المحلي', label_fr: 'Assurance' },
  technical_inspection: { label_ar: 'الفحص التقني', label_fr: 'Visite Technique' },
  grey_card: { label_ar: 'البطاقة الرمادية', label_fr: 'Carte Grise' },
  transport_license: { label_ar: 'رخصة النقل / CMR', label_fr: 'Autorisation de Transport' },
  atp_certificate: { label_ar: 'شهادة التبريد ATP', label_fr: 'Certificat ATP' },
  tachograph_calibration: { label_ar: 'معايرة التاكوغراف', label_fr: 'Tachygraphe' },
  other: { label_ar: 'وثيقة أخرى', label_fr: 'Autre Document' },
};

export const CORE_DOC_TYPES = [
  'insurance',
  'technical_inspection',
  'grey_card',
  'transport_license',
  'atp_certificate',
  'tachograph_calibration',
];
