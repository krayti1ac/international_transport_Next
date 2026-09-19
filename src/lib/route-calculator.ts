import Decimal from 'decimal.js';
import { calculateDistance } from '@/lib/geofence';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FerryPort {
  id: string;
  name: string;
  nameFr: string;
  country: 'MA' | 'ES';
  latitude: number;
  longitude: number;
}

export const FERRY_PORTS: Record<string, FerryPort> = {
  tangerMed: {
    id: 'tangerMed',
    name: 'ميناء طنجة المتوسط (Tanger Med)',
    nameFr: 'Port Tanger Med',
    country: 'MA',
    latitude: 35.8883,
    longitude: -5.5033,
  },
  algeciras: {
    id: 'algeciras',
    name: 'ميناء الجزيرة الخضراء (Algeciras)',
    nameFr: "Port d'Algésiras",
    country: 'ES',
    latitude: 36.1333,
    longitude: -5.4417,
  },
  almeria: {
    id: 'almeria',
    name: 'ميناء ألميريا (Almería)',
    nameFr: "Port d'Almería",
    country: 'ES',
    latitude: 36.8340,
    longitude: -2.4637,
  },
  motril: {
    id: 'motril',
    name: 'ميناء موتريل (Motril)',
    nameFr: 'Port de Motril',
    country: 'ES',
    latitude: 36.7214,
    longitude: -3.5222,
  },
};

// Strategic African Overland Gateway
export const EL_GUERGUERAT_BORDER = {
  id: 'el_guerguerat',
  name: 'معبر الكركارات الحدودي (El Guerguerat)',
  nameFr: 'Poste Frontière El Guerguerat',
  nameEs: 'Paso Fronterizo El Guerguerat',
  country: 'MA',
  latitude: 21.3656,
  longitude: -16.9583,
};

// Default constants for European maritime corridor
export const DEFAULT_FERRY_TICKET_COST = 4500.00; // MAD (الباخرة / العبارة)
export const DEFAULT_TRIPTIK_COST = 500.00; // MAD (التريبتك / دفتر المرور الجمركي)
export const DEFAULT_TRANSIT_ALMERIA_COST = 1200.00; // MAD (ترانزيت ألميريا / الجزيرة الخضراء)
export const DEFAULT_MARSA_MAROC_COST = 800.00; // MAD (مناولة مرسى المغرب / رسوم الموانئ)
export const DEFAULT_TOTAL_PORT_FEES = 7000.00; // MAD (مجموع الرسوم المينائية القياسية: 4,500 + 500 + 1,200 + 800)

// Default constants for African overland corridor
export const DEFAULT_GUERGUERAT_BORDER_FEE = 1500.00; // MAD (رسوم التخليص الحدودي بالكركارات)
export const DEFAULT_MAURITANIA_TRANSIT_FEE = 2500.00; // MAD (رسوم الترانزيت ودفتر المرور الموريتاني)
export const DEFAULT_ECOWAS_INSURANCE_FEE = 800.00; // MAD (تأمين البطاقة البنية Carte Brune / غرب إفريقيا)
export const DEFAULT_TOTAL_AFRICAN_BORDER_FEES = 4800.00; // MAD (1,500 + 2,500 + 800)

export const DEFAULT_TRUCK_FUEL_RATE = 36.00; // 36% / 36 L/100km
export const DEFAULT_FUEL_PRICE_PER_LITER = 13.00; // MAD / Liter
export const ROAD_CURVATURE_FACTOR = 1.22; // Road network actual distance multiplier over Haversine straight line

export function isMoroccoLocation(lat: number, lng: number): boolean {
  return lat >= 21.3 && lat <= 35.95 && lng >= -17.5 && lng <= -1.0;
}

export function isEuropeLocation(lat: number, lng?: number): boolean {
  return lat >= 36.0 && (lng === undefined || (lng >= -25.0 && lng <= 45.0));
}

export function isWestAfricaLocation(lat: number, lng: number): boolean {
  // Mauritania, Senegal, Mali, Guinea, etc. south of 21.3°N
  return lat < 21.3 && lat >= 4.0 && lng >= -18.5 && lng <= 5.0;
}

export type InternationalCorridor = 'european_maritime' | 'african_overland' | 'domestic';

export interface RouteBreakdown {
  corridorType: InternationalCorridor;
  isCrossStrait: boolean;
  isAfricanOverland: boolean;
  roadDistanceKm: number;
  ferryDistanceKm: number;
  totalDistanceKm: number;
  moroccoRoadKm: number;
  europeRoadKm: number;
  africaRoadKm: number;
  moroccanPort: FerryPort | null;
  spanishPort: FerryPort | null;
  borderCrossingPoint: typeof EL_GUERGUERAT_BORDER | null;
  fuelConsumptionLiters: number;
  fuelCost: number;
  ferryCost: number;
  triptikCost: number;
  transitAlmeriaCost: number;
  marsaMarocCost: number;
  guergueratBorderCost: number;
  mauritaniaTransitCost: number;
  ecowasInsuranceCost: number;
  customsCost: number;
  otherExpenses: number;
  totalFreightCost: number;
}

export interface CalculateRouteOptions {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  fuelConsumptionRate?: number; // e.g. 36.0 L/100km
  fuelPricePerLiter?: number; // e.g. 13.0 MAD
  customsCost?: number;
  otherExpenses?: number;
  ferryCost?: number;
  triptikCost?: number;
  transitAlmeriaCost?: number;
  marsaMarocCost?: number;
  guergueratBorderCost?: number;
  mauritaniaTransitCost?: number;
  ecowasInsuranceCost?: number;
  forceFerry?: boolean;
  forceAfricanCorridor?: boolean;
}

/**
 * Calculates complete international route breakdown between loading & unloading coordinates.
 * Seamlessly differentiates between:
 * 1. European Maritime Corridor (Tanger Med ferry crossing, Gibraltar strait, engine off during sailing)
 * 2. African Overland Corridor (El Guerguerat border crossing, Mauritania/Senegal, 100% continuous diesel burning)
 * 3. Domestic / Inland Moroccan Routes
 */
export function calculateInternationalRoute(options: CalculateRouteOptions): RouteBreakdown {
  const {
    originLat,
    originLng,
    destLat,
    destLng,
    fuelConsumptionRate = DEFAULT_TRUCK_FUEL_RATE,
    fuelPricePerLiter = DEFAULT_FUEL_PRICE_PER_LITER,
    customsCost = 0,
    otherExpenses = 0,
    ferryCost: customFerryCost,
    triptikCost: customTriptikCost,
    transitAlmeriaCost: customTransitCost,
    marsaMarocCost: customMarsaCost,
    guergueratBorderCost: customGuergueratCost,
    mauritaniaTransitCost: customMauritaniaCost,
    ecowasInsuranceCost: customEcowasCost,
    forceFerry = false,
    forceAfricanCorridor = false,
  } = options;

  const originInMorocco = isMoroccoLocation(originLat, originLng);
  const destInMorocco = isMoroccoLocation(destLat, destLng);
  const originInEurope = isEuropeLocation(originLat, originLng);
  const destInEurope = isEuropeLocation(destLat, destLng);
  const originInWestAfrica = isWestAfricaLocation(originLat, originLng);
  const destInWestAfrica = isWestAfricaLocation(destLat, destLng);

  // Corridor determination
  const isAfricanOverland =
    forceAfricanCorridor ||
    (!forceFerry &&
      ((originInMorocco && destInWestAfrica) ||
        (originInWestAfrica && destInMorocco) ||
        (originInWestAfrica && destInWestAfrica)));

  const isCrossStrait =
    !isAfricanOverland &&
    (forceFerry || (originInMorocco && destInEurope) || (originInEurope && destInMorocco));

  let corridorType: InternationalCorridor = 'domestic';
  if (isCrossStrait) {
    corridorType = 'european_maritime';
  } else if (isAfricanOverland) {
    corridorType = 'african_overland';
  }

  let moroccoRoadKm = 0;
  let europeRoadKm = 0;
  let africaRoadKm = 0;
  let ferryDistanceKm = 0;
  let moroccanPort: FerryPort | null = null;
  let spanishPort: FerryPort | null = null;
  let borderCrossingPoint: typeof EL_GUERGUERAT_BORDER | null = null;

  if (isCrossStrait) {
    moroccanPort = FERRY_PORTS.tangerMed;

    // Pick closest Spanish port between Algeciras and Almeria
    const distToAlgeciras = calculateDistance(destLat, destLng, FERRY_PORTS.algeciras.latitude, FERRY_PORTS.algeciras.longitude);
    const distToAlmeria = calculateDistance(destLat, destLng, FERRY_PORTS.almeria.latitude, FERRY_PORTS.almeria.longitude);
    spanishPort = distToAlmeria < distToAlgeciras ? FERRY_PORTS.almeria : FERRY_PORTS.algeciras;

    const moroccoLocation = originInMorocco ? { lat: originLat, lng: originLng } : { lat: destLat, lng: destLng };
    const europeLocation = originInEurope ? { lat: originLat, lng: originLng } : { lat: destLat, lng: destLng };

    // 1. Moroccan Road Leg (Origin/Dest to Tanger Med Port)
    const directMoroccoLeg = calculateDistance(moroccoLocation.lat, moroccoLocation.lng, moroccanPort.latitude, moroccanPort.longitude);
    moroccoRoadKm = Math.round(directMoroccoLeg * ROAD_CURVATURE_FACTOR * 10) / 10;

    // 2. Maritime Ferry Crossing (Tanger Med to Algeciras/Almeria Port) - Truck engine off!
    const maritimeLeg = calculateDistance(moroccanPort.latitude, moroccanPort.longitude, spanishPort.latitude, spanishPort.longitude);
    ferryDistanceKm = Math.round(maritimeLeg * 10) / 10;

    // 3. European Road Leg (Algeciras/Almeria Port to Europe Destination/Origin)
    const directEuropeLeg = calculateDistance(spanishPort.latitude, spanishPort.longitude, europeLocation.lat, europeLocation.lng);
    europeRoadKm = Math.round(directEuropeLeg * ROAD_CURVATURE_FACTOR * 10) / 10;
  } else if (isAfricanOverland) {
    // African Overland Corridor via El Guerguerat (100% road driving, no ferry)
    borderCrossingPoint = EL_GUERGUERAT_BORDER;

    const moroccoLocation = originInMorocco ? { lat: originLat, lng: originLng } : { lat: destLat, lng: destLng };
    const africaLocation = originInWestAfrica ? { lat: originLat, lng: originLng } : { lat: destLat, lng: destLng };

    // 1. Moroccan Road Leg to El Guerguerat
    const distToGuerguerat = calculateDistance(
      moroccoLocation.lat,
      moroccoLocation.lng,
      borderCrossingPoint.latitude,
      borderCrossingPoint.longitude
    );
    moroccoRoadKm = Math.round(distToGuerguerat * ROAD_CURVATURE_FACTOR * 10) / 10;

    // 2. Sub-Saharan African Road Leg from El Guerguerat to Destination (Nouadhibou, Nouakchott, Dakar, etc.)
    const distFromGuerguerat = calculateDistance(
      borderCrossingPoint.latitude,
      borderCrossingPoint.longitude,
      africaLocation.lat,
      africaLocation.lng
    );
    africaRoadKm = Math.round(distFromGuerguerat * ROAD_CURVATURE_FACTOR * 10) / 10;

    ferryDistanceKm = 0;
  } else {
    // Single country / inland road trip
    const directLeg = calculateDistance(originLat, originLng, destLat, destLng);
    const totalRoad = Math.round(directLeg * ROAD_CURVATURE_FACTOR * 10) / 10;
    if (originInMorocco) {
      moroccoRoadKm = totalRoad;
    } else if (originInEurope) {
      europeRoadKm = totalRoad;
    } else {
      africaRoadKm = totalRoad;
    }
  }

  const roadDistanceKm = Math.round((moroccoRoadKm + europeRoadKm + africaRoadKm) * 10) / 10;
  const totalDistanceKm = Math.round((roadDistanceKm + ferryDistanceKm) * 10) / 10;

  // Strict Decimal.js calculations
  const roadDistDec = new Decimal(roadDistanceKm);
  const rateDec = new Decimal(fuelConsumptionRate);
  const pricePerLiterDec = new Decimal(fuelPricePerLiter);
  const customsDec = new Decimal(customsCost || 0);
  const otherDec = new Decimal(otherExpenses || 0);

  // Fuel is burned ONLY on road driving distance (in Africa, 100% of the journey is road driving)
  const fuelConsumptionLitersDec = roadDistDec.dividedBy(100).times(rateDec);
  const fuelCostDec = fuelConsumptionLitersDec.times(pricePerLiterDec);

  // Maritime crossing fees (Only for European maritime corridor)
  const ferryCostDec = isCrossStrait
    ? new Decimal(customFerryCost !== undefined ? customFerryCost : DEFAULT_FERRY_TICKET_COST)
    : new Decimal(customFerryCost !== undefined ? customFerryCost : 0);

  const triptikCostDec = isCrossStrait
    ? new Decimal(customTriptikCost !== undefined ? customTriptikCost : DEFAULT_TRIPTIK_COST)
    : new Decimal(customTriptikCost !== undefined ? customTriptikCost : 0);

  const transitAlmeriaCostDec = isCrossStrait
    ? new Decimal(customTransitCost !== undefined ? customTransitCost : DEFAULT_TRANSIT_ALMERIA_COST)
    : new Decimal(customTransitCost !== undefined ? customTransitCost : 0);

  const marsaMarocCostDec = isCrossStrait
    ? new Decimal(customMarsaCost !== undefined ? customMarsaCost : DEFAULT_MARSA_MAROC_COST)
    : new Decimal(customMarsaCost !== undefined ? customMarsaCost : 0);

  // African Overland Crossing Fees
  const guergueratBorderCostDec = isAfricanOverland
    ? new Decimal(customGuergueratCost !== undefined ? customGuergueratCost : DEFAULT_GUERGUERAT_BORDER_FEE)
    : new Decimal(0);

  const mauritaniaTransitCostDec = isAfricanOverland
    ? new Decimal(customMauritaniaCost !== undefined ? customMauritaniaCost : DEFAULT_MAURITANIA_TRANSIT_FEE)
    : new Decimal(0);

  const ecowasInsuranceCostDec = isAfricanOverland
    ? new Decimal(customEcowasCost !== undefined ? customEcowasCost : DEFAULT_ECOWAS_INSURANCE_FEE)
    : new Decimal(0);

  const totalFreightCostDec = fuelCostDec
    .plus(ferryCostDec)
    .plus(triptikCostDec)
    .plus(transitAlmeriaCostDec)
    .plus(marsaMarocCostDec)
    .plus(guergueratBorderCostDec)
    .plus(mauritaniaTransitCostDec)
    .plus(ecowasInsuranceCostDec)
    .plus(customsDec)
    .plus(otherDec);

  return {
    corridorType,
    isCrossStrait,
    isAfricanOverland,
    roadDistanceKm,
    ferryDistanceKm,
    totalDistanceKm,
    moroccoRoadKm,
    europeRoadKm,
    africaRoadKm,
    moroccanPort,
    spanishPort,
    borderCrossingPoint,
    fuelConsumptionLiters: parseFloat(fuelConsumptionLitersDec.toFixed(2)),
    fuelCost: parseFloat(fuelCostDec.toFixed(2)),
    ferryCost: parseFloat(ferryCostDec.toFixed(2)),
    triptikCost: parseFloat(triptikCostDec.toFixed(2)),
    transitAlmeriaCost: parseFloat(transitAlmeriaCostDec.toFixed(2)),
    marsaMarocCost: parseFloat(marsaMarocCostDec.toFixed(2)),
    guergueratBorderCost: parseFloat(guergueratBorderCostDec.toFixed(2)),
    mauritaniaTransitCost: parseFloat(mauritaniaTransitCostDec.toFixed(2)),
    ecowasInsuranceCost: parseFloat(ecowasInsuranceCostDec.toFixed(2)),
    customsCost: parseFloat(customsDec.toFixed(2)),
    otherExpenses: parseFloat(otherDec.toFixed(2)),
    totalFreightCost: parseFloat(totalFreightCostDec.toFixed(2)),
  };
}
