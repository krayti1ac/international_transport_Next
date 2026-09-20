export interface StrategicPortZone {
  id: string;
  name: string;
  name_ar: string;
  name_fr: string;
  name_es: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  zoneType: 'seaport' | 'border_crossing' | 'customs_hub' | 'logistics_platform';
}

/**
 * مصفوفة الموانئ البحرية والمعابر الحدودية الاستراتيجية (الممر الأوروبي والإفريقي)
 */
export const STRATEGIC_PORT_ZONES: StrategicPortZone[] = [
  // 1. الموانئ البحرية الأوروبية (European Maritime Corridor)
  {
    id: 'port_tanger_med',
    name: 'Tanger Med Port',
    name_ar: 'ميناء طنجة المتوسط',
    name_fr: 'Port Tanger Med',
    name_es: 'Puerto Tánger Med',
    latitude: 35.885,
    longitude: -5.505,
    radiusKm: 3.5,
    zoneType: 'seaport',
  },
  {
    id: 'port_algeciras',
    name: 'Algeciras Port',
    name_ar: 'ميناء الجزيرة الخضراء',
    name_fr: 'Port d’Algésiras',
    name_es: 'Puerto de Algeciras',
    latitude: 36.132,
    longitude: -5.438,
    radiusKm: 3.0,
    zoneType: 'seaport',
  },
  {
    id: 'port_almeria',
    name: 'Almería Port',
    name_ar: 'ميناء ألميريا',
    name_fr: 'Port d’Almería',
    name_es: 'Puerto de Almería',
    latitude: 36.834,
    longitude: -2.4637,
    radiusKm: 3.0,
    zoneType: 'seaport',
  },
  {
    id: 'port_motril',
    name: 'Motril Port',
    name_ar: 'ميناء موتريل',
    name_fr: 'Port de Motril',
    name_es: 'Puerto de Motril',
    latitude: 36.7214,
    longitude: -3.5222,
    radiusKm: 3.0,
    zoneType: 'seaport',
  },
  {
    id: 'border_la_jonquera',
    name: 'La Jonquera Border',
    name_ar: 'معبر لا خونكيرا الحدودي (إسبانيا / فرنسا)',
    name_fr: 'Frontière La Jonquera (Espagne / France)',
    name_es: 'Frontera de La Jonquera (España / Francia)',
    latitude: 42.417,
    longitude: 2.879,
    radiusKm: 2.5,
    zoneType: 'border_crossing',
  },
  {
    id: 'border_irun',
    name: 'Irún Border',
    name_ar: 'معبر إيرون الحدودي (إسبانيا / فرنسا)',
    name_fr: 'Frontière d’Irún (Espagne / France)',
    name_es: 'Frontera de Irún (España / Francia)',
    latitude: 43.342,
    longitude: -1.789,
    radiusKm: 2.5,
    zoneType: 'border_crossing',
  },

  // 2. معابر ومحطات الممر الإفريقي البري (African Overland Trade Corridor)
  {
    id: 'border_guerguerat',
    name: 'El Guerguerat Border Crossing',
    name_ar: 'معبر الكركارات الحدودي (المغرب / موريتانيا)',
    name_fr: 'Poste Frontière El Guerguerat (Maroc / Mauritanie)',
    name_es: 'Paso Fronterizo El Guerguerat (Marruecos / Mauritania)',
    latitude: 21.3656,
    longitude: -16.9583,
    radiusKm: 5.0,
    zoneType: 'border_crossing',
  },
  {
    id: 'hub_nouadhibou',
    name: 'Nouadhibou Free Zone',
    name_ar: 'منطقة نواديبو الحرة (موريتانيا)',
    name_fr: 'Zone Franche de Nouadhibou (Mauritanie)',
    name_es: 'Zona Franca de Nouadhibou (Mauritania)',
    latitude: 20.9412,
    longitude: -17.0347,
    radiusKm: 4.0,
    zoneType: 'customs_hub',
  },
  {
    id: 'hub_nouakchott',
    name: 'Nouakchott Logistics Platform',
    name_ar: 'مركز نواكشوط اللوجستي وتفريغ الشاحنات (موريتانيا)',
    name_fr: 'Plateforme Logistique de Nouakchott (Mauritanie)',
    name_es: 'Centro Logístico de Nuakchot (Mauritania)',
    latitude: 18.0735,
    longitude: -15.9582,
    radiusKm: 5.0,
    zoneType: 'logistics_platform',
  },
  {
    id: 'border_rosso',
    name: 'Rosso River Border & Ferry Crossing',
    name_ar: 'معبر روصو الحدودي والعبارة النهرية (موريتانيا / السنغال)',
    name_fr: 'Poste Frontière et Bac de Rosso (Mauritanie / Sénégal)',
    name_es: 'Paso Fronterizo y Ferry de Rosso (Mauritania / Senegal)',
    latitude: 16.5133,
    longitude: -15.8083,
    radiusKm: 3.0,
    zoneType: 'border_crossing',
  },
  {
    id: 'port_dakar',
    name: 'Dakar Port & Distribution Warehouses',
    name_ar: 'ميناء ومستودعات توزيع دكار (السنغال)',
    name_fr: 'Port et Entrepôts Logistiques de Dakar (Sénégal)',
    name_es: 'Puerto y Almacenes de Dakar (Senegal)',
    latitude: 14.7167,
    longitude: -17.4677,
    radiusKm: 6.0,
    zoneType: 'seaport',
  },
];

// Deduplication guard: 30 minutes cooldown to avoid notification spam from boundary signal jitter
export const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

