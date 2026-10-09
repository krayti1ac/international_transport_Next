/**
 * Trans Bodanon TMS — Certified Safe Truck Parking Areas (EU SSTPA & Overland Corridors)
 * Comprehensive catalogue and geospatial utilities for commercial driver mandatory rest.
 */

export type CorridorType =
  | 'mediterranean_ap7_a9'
  | 'atlantic_a1_ap1'
  | 'african_rn1'
  | 'morocco_a1_a3';

export type SecurityLevel = 'gold' | 'silver' | 'bronze' | 'secure_hub';

export type ParkingAmenity =
  | 'fuel'
  | 'reefer_plug'
  | 'cctv_security'
  | 'restaurant'
  | 'shower'
  | 'fenced'
  | 'customs_agent';

export interface SafeTruckParkingArea {
  id: string;
  name: string;
  corridor: CorridorType;
  highway: string;
  country: 'ES' | 'FR' | 'MA' | 'MR' | 'SN';
  city: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  securityLevel: SecurityLevel;
  totalCapacitySpots: number;
  amenities: ParkingAmenity[];
  contactPhone?: string;
}

/**
 * Predefined database of certified safe truck parking areas along European and African trade corridors
 */
export const CERTIFIED_SAFE_PARKING_AREAS: SafeTruckParkingArea[] = [
  // --- 1. SPANISH MEDITERRANEAN CORRIDOR (AP-7 / A-7) ---
  {
    id: 'es-jonquera-ap7',
    name: 'Área de Servicio La Jonquera (AP-7)',
    corridor: 'mediterranean_ap7_a9',
    highway: 'AP-7 km 6',
    country: 'ES',
    city: 'La Jonquera (Girona)',
    latitude: 42.4172,
    longitude: 2.8794,
    googleMapsUrl: 'https://maps.google.com/?q=42.4172,2.8794',
    securityLevel: 'gold',
    totalCapacitySpots: 450,
    amenities: ['fuel', 'reefer_plug', 'cctv_security', 'restaurant', 'shower', 'fenced'],
    contactPhone: '+34972554100',
  },
  {
    id: 'es-vilamalla-cimalsa',
    name: 'Truck Park CIMALSA Vilamalla (AP-7)',
    corridor: 'mediterranean_ap7_a9',
    highway: 'AP-7 Salida 4',
    country: 'ES',
    city: 'Vilamalla (Girona)',
    latitude: 42.2155,
    longitude: 2.9733,
    googleMapsUrl: 'https://maps.google.com/?q=42.2155,2.9733',
    securityLevel: 'gold',
    totalCapacitySpots: 140,
    amenities: ['cctv_security', 'fenced', 'shower', 'reefer_plug'],
    contactPhone: '+34902300062',
  },
  {
    id: 'es-montseny-ap7',
    name: 'Área de Servicio Montseny (AP-7)',
    corridor: 'mediterranean_ap7_a9',
    highway: 'AP-7 km 117',
    country: 'ES',
    city: 'Llinars del Vallès (Barcelona)',
    latitude: 41.6375,
    longitude: 2.4011,
    googleMapsUrl: 'https://maps.google.com/?q=41.6375,2.4011',
    securityLevel: 'silver',
    totalCapacitySpots: 180,
    amenities: ['fuel', 'cctv_security', 'restaurant', 'shower', 'reefer_plug'],
    contactPhone: '+34938411200',
  },
  {
    id: 'es-andamur-lorca',
    name: 'Área de Servicio Andamur Lorca (A-7)',
    corridor: 'mediterranean_ap7_a9',
    highway: 'A-7 km 582',
    country: 'ES',
    city: 'Lorca (Murcia)',
    latitude: 37.6711,
    longitude: -1.7012,
    googleMapsUrl: 'https://maps.google.com/?q=37.6711,-1.7012',
    securityLevel: 'gold',
    totalCapacitySpots: 200,
    amenities: ['fuel', 'reefer_plug', 'cctv_security', 'restaurant', 'shower', 'fenced'],
    contactPhone: '+34968461800',
  },
  {
    id: 'es-algeciras-fantasio',
    name: 'Área de Servicio El Fantasio (Algeciras)',
    corridor: 'mediterranean_ap7_a9',
    highway: 'A-381 km 84',
    country: 'ES',
    city: 'Los Barrios / Algeciras (Cádiz)',
    latitude: 36.1852,
    longitude: -5.4983,
    googleMapsUrl: 'https://maps.google.com/?q=36.1852,-5.4983',
    securityLevel: 'gold',
    totalCapacitySpots: 250,
    amenities: ['fuel', 'cctv_security', 'restaurant', 'shower', 'customs_agent', 'fenced'],
    contactPhone: '+34956675000',
  },

  // --- 2. FRENCH CORRIDOR (A9 / A63 / PARIS) ---
  {
    id: 'fr-village-catalan-a9',
    name: 'Aire du Village Catalan (A9)',
    corridor: 'mediterranean_ap7_a9',
    highway: 'A9 km 285',
    country: 'FR',
    city: 'Perpignan (Pyrénées-Orientales)',
    latitude: 42.6041,
    longitude: 2.8687,
    googleMapsUrl: 'https://maps.google.com/?q=42.6041,2.8687',
    securityLevel: 'gold',
    totalCapacitySpots: 220,
    amenities: ['fuel', 'reefer_plug', 'cctv_security', 'restaurant', 'shower', 'fenced'],
    contactPhone: '+33468541200',
  },
  {
    id: 'fr-narbonne-a9',
    name: 'Centre Routier Narbonne Vinassan (A9)',
    corridor: 'mediterranean_ap7_a9',
    highway: 'A9 km 238',
    country: 'FR',
    city: 'Narbonne (Aude)',
    latitude: 43.1974,
    longitude: 3.0315,
    googleMapsUrl: 'https://maps.google.com/?q=43.1974,3.0315',
    securityLevel: 'silver',
    totalCapacitySpots: 160,
    amenities: ['fuel', 'cctv_security', 'restaurant', 'shower', 'fenced'],
    contactPhone: '+33468412000',
  },
  {
    id: 'fr-bordeaux-cestas-a63',
    name: 'Aire de Bordeaux Cestas (A63)',
    corridor: 'atlantic_a1_ap1',
    highway: 'A63 km 18',
    country: 'FR',
    city: 'Cestas (Gironde)',
    latitude: 44.7431,
    longitude: -0.6842,
    googleMapsUrl: 'https://maps.google.com/?q=44.7431,-0.6842',
    securityLevel: 'silver',
    totalCapacitySpots: 190,
    amenities: ['fuel', 'cctv_security', 'restaurant', 'shower', 'reefer_plug'],
    contactPhone: '+33556781200',
  },

  // --- 3. MOROCCO HIGHWAY CORRIDOR (A1 / A3 / A7) ---
  {
    id: 'ma-tanger-med-village',
    name: 'Tanger Med Truck Hub (Zone Franche)',
    corridor: 'morocco_a1_a3',
    highway: 'N16 / Tanger Med Port',
    country: 'MA',
    city: 'Ksar El Majaz (Tanger)',
    latitude: 35.8887,
    longitude: -5.5113,
    googleMapsUrl: 'https://maps.google.com/?q=35.8887,-5.5113',
    securityLevel: 'gold',
    totalCapacitySpots: 500,
    amenities: ['cctv_security', 'customs_agent', 'fuel', 'shower', 'restaurant', 'fenced', 'reefer_plug'],
    contactPhone: '+212539337000',
  },
  {
    id: 'ma-larache-a1',
    name: 'Aire de Repos Larache (Autoroute A1)',
    corridor: 'morocco_a1_a3',
    highway: 'A1 km 86',
    country: 'MA',
    city: 'Larache',
    latitude: 35.1834,
    longitude: -6.1558,
    googleMapsUrl: 'https://maps.google.com/?q=35.1834,-6.1558',
    securityLevel: 'silver',
    totalCapacitySpots: 120,
    amenities: ['fuel', 'restaurant', 'shower', 'cctv_security'],
    contactPhone: '+212539912000',
  },
  {
    id: 'ma-bouznika-a1',
    name: 'Aire de Repos Bouznika (Autoroute A1)',
    corridor: 'morocco_a1_a3',
    highway: 'A1 km 45',
    country: 'MA',
    city: 'Bouznika (Casablanca-Rabat)',
    latitude: 33.7891,
    longitude: -7.1623,
    googleMapsUrl: 'https://maps.google.com/?q=33.7891,-7.1623',
    securityLevel: 'silver',
    totalCapacitySpots: 150,
    amenities: ['fuel', 'restaurant', 'shower', 'cctv_security', 'reefer_plug'],
    contactPhone: '+212537622000',
  },
  {
    id: 'ma-agadir-primeurs',
    name: 'Hub Logistique Agadir Primeurs',
    corridor: 'morocco_a1_a3',
    highway: 'N1 / Zone Industrielle Ait Melloul',
    country: 'MA',
    city: 'Agadir (Souss-Massa)',
    latitude: 30.3421,
    longitude: -9.4975,
    googleMapsUrl: 'https://maps.google.com/?q=30.3421,-9.4975',
    securityLevel: 'gold',
    totalCapacitySpots: 300,
    amenities: ['fuel', 'reefer_plug', 'cctv_security', 'shower', 'fenced'],
    contactPhone: '+212528241000',
  },

  // --- 4. AFRICAN OVERLAND TRADE CORRIDOR (RN1 / GUERGUERAT) ---
  {
    id: 'ma-guerguerat-buffer',
    name: 'Guerguerat Secure Overland Station',
    corridor: 'african_rn1',
    highway: 'RN1 PK 55 Post-Frontière',
    country: 'MA',
    city: 'Guerguerat (Sahara)',
    latitude: 21.4285,
    longitude: -16.9612,
    googleMapsUrl: 'https://maps.google.com/?q=21.4285,-16.9612',
    securityLevel: 'gold',
    totalCapacitySpots: 200,
    amenities: ['fuel', 'customs_agent', 'cctv_security', 'fenced', 'shower'],
    contactPhone: '+212528892000',
  },
  {
    id: 'mr-nouadhibou-pk40',
    name: 'Nouadhibou Overland Logistic Hub',
    corridor: 'african_rn1',
    highway: 'Route Nouadhibou PK 40',
    country: 'MR',
    city: 'Nouadhibou (Mauritanie)',
    latitude: 20.9412,
    longitude: -17.0345,
    googleMapsUrl: 'https://maps.google.com/?q=20.9412,-17.0345',
    securityLevel: 'secure_hub',
    totalCapacitySpots: 150,
    amenities: ['fuel', 'customs_agent', 'shower', 'fenced'],
  },
  {
    id: 'mr-nouakchott-hub',
    name: 'Nouakchott International Truck Stop',
    corridor: 'african_rn1',
    highway: 'RN1 Entrée Nord',
    country: 'MR',
    city: 'Nouakchott (Mauritanie)',
    latitude: 18.0858,
    longitude: -15.9785,
    googleMapsUrl: 'https://maps.google.com/?q=18.0858,-15.9785',
    securityLevel: 'secure_hub',
    totalCapacitySpots: 180,
    amenities: ['fuel', 'shower', 'restaurant', 'cctv_security', 'fenced'],
  },
  {
    id: 'sn-rosso-terminal',
    name: 'Rosso Senegal Border Crossing Area',
    corridor: 'african_rn1',
    highway: 'N2 Rosso Border',
    country: 'SN',
    city: 'Rosso (Sénégal)',
    latitude: 16.5098,
    longitude: -15.8076,
    googleMapsUrl: 'https://maps.google.com/?q=16.5098,-15.8076',
    securityLevel: 'secure_hub',
    totalCapacitySpots: 120,
    amenities: ['customs_agent', 'fuel', 'shower', 'fenced'],
  },
];

/**
 * Calculates Great-Circle distance using Haversine formula (km)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Finds the nearest certified safe truck parking area given coordinates and optional corridor filter
 */
export function findNearestSafeParking(
  lat: number,
  lon: number,
  preferredCorridor?: CorridorType
): { parking: SafeTruckParkingArea; distanceKm: number } | null {
  const candidates = preferredCorridor
    ? CERTIFIED_SAFE_PARKING_AREAS.filter((p) => p.corridor === preferredCorridor)
    : CERTIFIED_SAFE_PARKING_AREAS;

  if (candidates.length === 0) return null;

  let closest: SafeTruckParkingArea = candidates[0];
  let minDistance = calculateHaversineDistanceKm(lat, lon, closest.latitude, closest.longitude);

  for (let i = 1; i < candidates.length; i++) {
    const p = candidates[i];
    const dist = calculateHaversineDistanceKm(lat, lon, p.latitude, p.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closest = p;
    }
  }

  return { parking: closest, distanceKm: minDistance };
}

