/**
 * Trans Bodanon TMS — Provider & Workshop Photos & Logos Management
 *
 * Dedicated helper for workshop/supplier avatars, presets for Moroccan & international
 * transport specialties (Roues/الروايد, Lames/ليباس, Ventouse/فانتوز, Moteur, Électricité,
 * Carburant, Frigo, Vidange, etc.), local storage caching, and deterministic matching.
 */

export interface PresetProviderPhoto {
  id: string;
  label: string;
  category: string;
  url: string;
}

// Crisp SVG Presets for Heavy Truck Workshops and Providers
export const PRESET_PROVIDER_PHOTOS: PresetProviderPhoto[] = [
  {
    id: 'roues-pneus',
    label: 'عجلات وبنشرات (الروايد)',
    category: 'tires',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3CradialGradient id='tire-bg' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23334155'/%3E%3Cstop offset='100%25' stop-color='%230f172a'/%3E%3C/radialGradient%3E%3ClinearGradient id='rim-metal' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23f59e0b'/%3E%3Cstop offset='100%25' stop-color='%23b45309'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23tire-bg)'/%3E%3Ccircle cx='100' cy='100' r='76' stroke='%23475569' stroke-width='14' stroke-dasharray='10 6' fill='none'/%3E%3Ccircle cx='100' cy='100' r='62' fill='%231e293b' stroke='%2364748b' stroke-width='4'/%3E%3Ccircle cx='100' cy='100' r='38' fill='url(%23rim-metal)'/%3E%3Ccircle cx='100' cy='100' r='20' fill='%230f172a'/%3E%3Ccircle cx='100' cy='100' r='10' fill='%23fef3c7'/%3E%3Ccircle cx='100' cy='72' r='4.5' fill='%23ffffff'/%3E%3Ccircle cx='100' cy='128' r='4.5' fill='%23ffffff'/%3E%3Ccircle cx='72' cy='100' r='4.5' fill='%23ffffff'/%3E%3Ccircle cx='128' cy='100' r='4.5' fill='%23ffffff'/%3E%3Ccircle cx='80' cy='80' r='4.5' fill='%23ffffff'/%3E%3Ccircle cx='120' cy='120' r='4.5' fill='%23ffffff'/%3E%3Ccircle cx='80' cy='120' r='4.5' fill='%23ffffff'/%3E%3Ccircle cx='120' cy='80' r='4.5' fill='%23ffffff'/%3E%3C/svg%3E",
  },
  {
    id: 'lames-suspension',
    label: 'لامات ونوابض (ليباس)',
    category: 'suspension',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='lame-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%231e3a8a'/%3E%3Cstop offset='100%25' stop-color='%230c1e47'/%3E%3C/linearGradient%3E%3ClinearGradient id='steel' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%2394a3b8'/%3E%3Cstop offset='50%25' stop-color='%23f1f5f9'/%3E%3Cstop offset='100%25' stop-color='%2364748b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23lame-bg)'/%3E%3Cpath d='M25 68 Q100 120 175 68' fill='none' stroke='url(%23steel)' stroke-width='11' stroke-linecap='round'/%3E%3Cpath d='M35 84 Q100 130 165 84' fill='none' stroke='url(%23steel)' stroke-width='10' stroke-linecap='round'/%3E%3Cpath d='M48 99 Q100 138 152 99' fill='none' stroke='url(%23steel)' stroke-width='9' stroke-linecap='round'/%3E%3Cpath d='M65 113 Q100 144 135 113' fill='none' stroke='url(%23steel)' stroke-width='8' stroke-linecap='round'/%3E%3Crect x='93' y='65' width='14' height='68' rx='3' fill='%23e2e8f0' stroke='%23334155' stroke-width='2'/%3E%3Ccircle cx='100' cy='82' r='4' fill='%23b45309'/%3E%3Ccircle cx='100' cy='116' r='4' fill='%23b45309'/%3E%3Ccircle cx='25' cy='68' r='6' fill='%23cbd5e1'/%3E%3Ccircle cx='175' cy='68' r='6' fill='%23cbd5e1'/%3E%3C/svg%3E",
  },
  {
    id: 'ventouse-tolerie',
    label: 'طولة وفانتوز (Débosselage)',
    category: 'bodywork',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='vent-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23065f46'/%3E%3Cstop offset='100%25' stop-color='%23022c22'/%3E%3C/linearGradient%3E%3ClinearGradient id='gold' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23fbbf24'/%3E%3Cstop offset='100%25' stop-color='%23d97706'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23vent-bg)'/%3E%3Cpath d='M40 145 C60 115 140 115 160 145' fill='none' stroke='%2334d399' stroke-width='6' stroke-linecap='round'/%3E%3Cellipse cx='100' cy='135' rx='36' ry='12' fill='%2310b981' opacity='0.8'/%3E%3Cpath d='M80 132 C85 95 115 95 120 132 Z' fill='url(%23gold)'/%3E%3Crect x='94' y='55' width='12' height='45' rx='4' fill='url(%23gold)'/%3E%3Cpath d='M65 55 C65 42 135 42 135 55' fill='none' stroke='url(%23gold)' stroke-width='10' stroke-linecap='round'/%3E%3Ccircle cx='100' cy='100' r='5' fill='%23ffffff'/%3E%3Cpath d='M140 70 L155 85 M155 70 L140 85' stroke='%23fef08a' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E",
  },
  {
    id: 'mecanique-moteur',
    label: 'ميكانيك ومحركات',
    category: 'workshop',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='mec-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%237c2d12'/%3E%3Cstop offset='100%25' stop-color='%23431407'/%3E%3C/linearGradient%3E%3ClinearGradient id='metal' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23f97316'/%3E%3Cstop offset='100%25' stop-color='%23ea580c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23mec-bg)'/%3E%3Cpath d='M60 70 H140 V130 H60 Z' rx='14' fill='%2327272a' stroke='url(%23metal)' stroke-width='6'/%3E%3Cpath d='M75 52 V70 M125 52 V70 M50 90 H60 M140 90 H150 M50 110 H60 M140 110 H150' stroke='url(%23metal)' stroke-width='6' stroke-linecap='round'/%3E%3Ccircle cx='100' cy='100' r='18' fill='url(%23metal)'/%3E%3Ccircle cx='100' cy='100' r='8' fill='%2318181b'/%3E%3Cpath d='M42 155 L65 132 M158 155 L135 132' stroke='%23cbd5e1' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E",
  },
  {
    id: 'electricite-diagnostic',
    label: 'كهرباء وتشخيص (Diagnostic)',
    category: 'electric',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='elec-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23581c87'/%3E%3Cstop offset='100%25' stop-color='%232e1065'/%3E%3C/linearGradient%3E%3ClinearGradient id='bolt' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23fde047'/%3E%3Cstop offset='100%25' stop-color='%23eab308'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23elec-bg)'/%3E%3Crect x='45' y='65' width='110' height='80' rx='12' fill='%231e1b4b' stroke='%23a855f7' stroke-width='5'/%3E%3Crect x='65' y='52' width='18' height='13' rx='3' fill='%23cbd5e1'/%3E%3Crect x='117' y='52' width='18' height='13' rx='3' fill='%23ef4444'/%3E%3Cpath d='M108 80 L88 108 H104 L96 132 L120 102 H102 Z' fill='url(%23bolt)'/%3E%3C/svg%3E",
  },
  {
    id: 'station-carburant',
    label: 'محطة وقود ومازوت (Gazole)',
    category: 'fuel',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='fuel-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230f766e'/%3E%3Cstop offset='100%25' stop-color='%23134e4a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23fuel-bg)'/%3E%3Crect x='52' y='55' width='60' height='95' rx='8' fill='%23ffffff'/%3E%3Crect x='62' y='68' width='40' height='30' rx='4' fill='%23042f2e'/%3E%3Cpath d='M112 85 C125 85 138 95 138 112 V142 C138 148 145 148 148 142 V95 C148 85 142 80 134 76 L124 70' fill='none' stroke='%23facc15' stroke-width='7' stroke-linecap='round'/%3E%3Ccircle cx='82' cy='122' r='8' fill='%230d9488'/%3E%3Cpath d='M82 118 L82 126 M78 122 L86 122' stroke='%23ffffff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E",
  },
  {
    id: 'frigo-thermo',
    label: 'تبريد الشاحنات (Frigo)',
    category: 'frigo',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='frigo-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230369a1'/%3E%3Cstop offset='100%25' stop-color='%23082f49'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23frigo-bg)'/%3E%3Cpath d='M100 45 V155 M45 100 H155 M60 60 L140 140 M140 60 L60 140' stroke='%2338bdf8' stroke-width='8' stroke-linecap='round'/%3E%3Cpath d='M100 65 L90 55 M100 65 L110 55 M100 135 L90 145 M100 135 L110 145 M65 100 L55 90 M65 100 L55 110 M135 100 L145 90 M135 100 L145 110' stroke='%23e0f2fe' stroke-width='6' stroke-linecap='round'/%3E%3Ccircle cx='100' cy='100' r='14' fill='%23ffffff'/%3E%3Ccircle cx='100' cy='100' r='6' fill='%230284c7'/%3E%3C/svg%3E",
  },
  {
    id: 'vidange-lubrifiants',
    label: 'تشحيم وتغيير الزيوت',
    category: 'oil',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='oil-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23854d0e'/%3E%3Cstop offset='100%25' stop-color='%23422006'/%3E%3C/linearGradient%3E%3ClinearGradient id='gold-drop' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23facc15'/%3E%3Cstop offset='100%25' stop-color='%23ca8a04'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23oil-bg)'/%3E%3Cpath d='M100 48 C85 75 62 110 62 135 C62 158 79 170 100 170 C121 170 138 158 138 135 C138 110 115 75 100 48 Z' fill='url(%23gold-drop)'/%3E%3Ccircle cx='85' cy='140' r='8' fill='%23fef08a' opacity='0.7'/%3E%3C/svg%3E",
  },
  {
    id: 'pieces-rechange',
    label: 'قطع غيار الشاحنات',
    category: 'parts',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='part-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23374151'/%3E%3Cstop offset='100%25' stop-color='%23111827'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23part-bg)'/%3E%3Ccircle cx='100' cy='100' r='55' fill='none' stroke='%23ef4444' stroke-width='12' stroke-dasharray='12 8'/%3E%3Ccircle cx='100' cy='100' r='38' fill='%231f2937' stroke='%23f87171' stroke-width='4'/%3E%3Ccircle cx='100' cy='100' r='18' fill='%23fca5a5'/%3E%3Ccircle cx='100' cy='100' r='8' fill='%23111827'/%3E%3C/svg%3E",
  },
  {
    id: 'lavage-camions',
    label: 'غسيل وتلميع الشاحنات',
    category: 'wash',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='wash-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230284c7'/%3E%3Cstop offset='100%25' stop-color='%230369a1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23wash-bg)'/%3E%3Ccircle cx='80' cy='75' r='22' fill='%23ffffff' opacity='0.8'/%3E%3Ccircle cx='125' cy='85' r='16' fill='%23ffffff' opacity='0.85'/%3E%3Ccircle cx='100' cy='120' r='28' fill='%23e0f2fe' opacity='0.9'/%3E%3Ccircle cx='65' cy='130' r='14' fill='%23bae6fd' opacity='0.75'/%3E%3Ccircle cx='135' cy='135' r='18' fill='%23bae6fd' opacity='0.75'/%3E%3C/svg%3E",
  },
  {
    id: 'ferry-maritime',
    label: 'ملاحة وعبّارات (Ferry)',
    category: 'ferry',
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='ferry-bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%231d4ed8'/%3E%3Cstop offset='100%25' stop-color='%231e3a8a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' rx='44' fill='url(%23ferry-bg)'/%3E%3Cpath d='M35 130 L55 85 H145 L165 130 Z' fill='%23ffffff'/%3E%3Crect x='70' y='60' width='60' height='25' rx='4' fill='%23f1f5f9'/%3E%3Crect x='92' y='42' width='16' height='18' rx='2' fill='%23ef4444'/%3E%3Cpath d='M25 145 C50 135 75 155 100 145 C125 135 150 155 175 145' fill='none' stroke='%2338bdf8' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E",
  },
];

const STORAGE_KEY = 'transbodanon_provider_photos_cache';
const UPDATE_EVENT = 'transbodanon_provider_photos_updated';

export function getProviderPhotoCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function cacheProviderPhoto(providerKey: string | number, photoUrl: string): void {
  if (typeof window === 'undefined' || !providerKey) return;
  try {
    const cache = getProviderPhotoCache();
    cache[String(providerKey)] = photoUrl;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { providerKey, photoUrl } }));
  } catch (err) {
    console.error('Failed to cache provider photo:', err);
  }
}

export function getProviderPhotoFromCache(providerKey: string | number): string | null {
  const cache = getProviderPhotoCache();
  return cache[String(providerKey)] || null;
}

/**
 * Deterministically match known provider names/types to appropriate preset avatars.
 */
export function resolveProviderPhoto(provider: {
  id?: number | string;
  name?: string;
  type?: string;
  logo_url?: string | null;
  photo_url?: string | null;
}): string | null {
  if (!provider) return null;

  // 1. Direct photo / logo URL on object
  if (provider.logo_url && provider.logo_url.trim() !== '') return provider.logo_url;
  if (provider.photo_url && provider.photo_url.trim() !== '') return provider.photo_url;

  // 2. Check local storage cache by ID
  if (provider.id) {
    const cached = getProviderPhotoFromCache(provider.id);
    if (cached) return cached;
  }

  // 3. Check local storage cache by name
  if (provider.name) {
    const cachedByName = getProviderPhotoFromCache(provider.name.trim().toLowerCase());
    if (cachedByName) return cachedByName;
  }

  // 4. Semantic matching by provider name / type
  const name = (provider.name || '').toLowerCase();
  const type = (provider.type || '').toLowerCase();

  // Pneus / الروايد (e.g. حفيض الروايد, Pneumatiques Maroc)
  if (
    name.includes('رويد') ||
    name.includes('روايد') ||
    name.includes('عجل') ||
    name.includes('pneu') ||
    name.includes('michelin') ||
    name.includes('bridgestone') ||
    type === 'tires'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'roues-pneus')?.url || null;
  }

  // Lames / ليباس / Ressorts (e.g. مصطفى ليباس)
  if (
    name.includes('ليباس') ||
    name.includes('لامات') ||
    name.includes('ressort') ||
    name.includes('lame') ||
    name.includes('suspension') ||
    type === 'suspension'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'lames-suspension')?.url || null;
  }

  // Ventouse / فانتوز / Tôlerie (e.g. جمال فانتوز)
  if (
    name.includes('فانتوز') ||
    name.includes('طول') ||
    name.includes('ventouse') ||
    name.includes('tôlerie') ||
    name.includes('tolerie') ||
    name.includes('peinture') ||
    name.includes('debosselage') ||
    type === 'bodywork'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'ventouse-tolerie')?.url || null;
  }

  // Frigo / Climatisation (e.g. Thermo King, Carrier)
  if (
    name.includes('thermo') ||
    name.includes('carrier') ||
    name.includes('frigo') ||
    name.includes('تبريد') ||
    name.includes('clima') ||
    type === 'frigo_maintenance' ||
    type === 'frigo'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'frigo-thermo')?.url || null;
  }

  // Ferry (e.g. FRS, Balearia, DFDS)
  if (
    name.includes('frs') ||
    name.includes('balearia') ||
    name.includes('dfds') ||
    name.includes('ferry') ||
    name.includes('باخرة') ||
    type === 'ferry'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'ferry-maritime')?.url || null;
  }

  // Carburant / Station (e.g. Afriquia, Shell, Total, Winxo)
  if (
    name.includes('وقود') ||
    name.includes('مازوت') ||
    name.includes('محطة') ||
    name.includes('afriquia') ||
    name.includes('shell') ||
    name.includes('total') ||
    name.includes('winxo') ||
    name.includes('petrol') ||
    type === 'fuel'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'station-carburant')?.url || null;
  }

  // Électricité / Diagnostic
  if (
    name.includes('كهرب') ||
    name.includes('diagnostic') ||
    name.includes('electric') ||
    name.includes('batterie') ||
    type === 'electric'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'electricite-diagnostic')?.url || null;
  }

  // Vidange / Huiles
  if (
    name.includes('زيت') ||
    name.includes('زيوت') ||
    name.includes('تشحيم') ||
    name.includes('vidange') ||
    name.includes('lubrifiant') ||
    type === 'oil'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'vidange-lubrifiants')?.url || null;
  }

  // Pièces de rechange
  if (
    name.includes('غيار') ||
    name.includes('قطع') ||
    name.includes('pieces') ||
    name.includes('rechange') ||
    type === 'parts'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'pieces-rechange')?.url || null;
  }

  // Heavy truck wash
  if (name.includes('غسيل') || name.includes('lavage') || type === 'wash') {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'lavage-camions')?.url || null;
  }

  // Workshop / Garage general
  if (
    name.includes('garage') ||
    name.includes('ورش') ||
    name.includes('atelier') ||
    name.includes('mecanic') ||
    name.includes('ميكانيك') ||
    type === 'workshop'
  ) {
    return PRESET_PROVIDER_PHOTOS.find((p) => p.id === 'mecanique-moteur')?.url || null;
  }

  return null;
}
