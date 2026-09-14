'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { calculateDistance } from '@/lib/geofence';
import { recordAuditLog } from '@/lib/audit.server';
import type { TruckLocationHistory, TruckMaintenance } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Known highway transit fuel stations along Morocco-Spain international freight corridors
const CORRIDOR_FUEL_STATIONS: Record<string, { name: string; lat: number; lng: number; country: 'MA' | 'ES' | 'FR' }> = {
  // Morocco TIR Corridor
  tanger_med_afriquia: { name: 'Afriquia Tanger Med Port', lat: 35.885, lng: -5.505, country: 'MA' },
  tanger_med_total: { name: 'TotalEnergies Tanger Med', lat: 35.882, lng: -5.512, country: 'MA' },
  tanger_autoroute_shell: { name: 'Shell Tanger Ville A1', lat: 35.725, lng: -5.815, country: 'MA' },
  larache_aire: { name: 'Afriquia Aire de Repos Larache A1', lat: 35.195, lng: -6.155, country: 'MA' },
  kenitra_nord: { name: 'TotalEnergies Kenitra Nord A1', lat: 34.295, lng: -6.575, country: 'MA' },
  casablanca_ain_sebaa: { name: 'Shell Casablanca Ain Sebaa', lat: 33.605, lng: -7.535, country: 'MA' },
  berrechid_aire: { name: 'Afriquia Berrechid A3', lat: 33.275, lng: -7.585, country: 'MA' },
  settat_aire: { name: 'TotalEnergies Settat A3', lat: 33.005, lng: -7.625, country: 'MA' },
  marrakech_palmeraie: { name: 'Shell Marrakech Palmeraie A3', lat: 31.695, lng: -8.015, country: 'MA' },
  agadir_port: { name: 'Afriquia Agadir Port', lat: 30.435, lng: -9.615, country: 'MA' },
  nador_port: { name: 'TotalEnergies Nador Port Beni Enzar', lat: 35.265, lng: -2.935, country: 'MA' },

  // Spain TIR Corridor
  algeciras_repsol: { name: 'Repsol Puerto de Algeciras', lat: 36.185, lng: -5.465, country: 'ES' },
  algeciras_cepsa: { name: 'Cepsa Los Barrios Algeciras', lat: 36.181, lng: -5.492, country: 'ES' },
  san_roque_valcarce: { name: 'Valcarce San Roque Red TIR', lat: 36.205, lng: -5.415, country: 'ES' },
  antequera_bp: { name: 'BP Antequera A-92', lat: 37.025, lng: -4.565, country: 'ES' },
  bailen_repsol: { name: 'Repsol Bailén Cruce A-4', lat: 38.095, lng: -3.775, country: 'ES' },
  valdemoro_cepsa: { name: 'Cepsa Valdemoro Madrid A-4', lat: 40.185, lng: -3.685, country: 'ES' },
  zaragoza_plaza: { name: 'Repsol PLAZA Zaragoza A-2', lat: 41.635, lng: -0.995, country: 'ES' },
  barcelona_zona_franca: { name: 'Galp Barcelona Zona Franca', lat: 41.345, lng: 2.135, country: 'ES' },
  la_jonquera_red_tortuga: { name: 'Red Tortuga La Jonquera Frontière', lat: 42.415, lng: 2.875, country: 'ES' },
  irun_andamur: { name: 'Andamur Irun Frontière AP-8', lat: 43.345, lng: -1.795, country: 'ES' },
};

export interface FuelAuditInput {
  receiptId?: number;
  truckId: number;
  liters: number;
  amount: number;
  currency?: string;
  date: string; // YYYY-MM-DD
  stationName?: string;
  stationLat?: number;
  stationLng?: number;
  odometerKm?: number;
  prevOdometerKm?: number;
  distanceTraveledKm?: number;
}

export type FuelAnomalyType =
  | 'LOCATION_MISMATCH'
  | 'TANK_OVERFILL'
  | 'EXCESSIVE_CONSUMPTION'
  | 'ABNORMAL_PRICE'
  | 'SUSPICIOUS_DATE'
  | 'INSUFFICIENT_GPS_DATA';

export interface FuelAuditAnomaly {
  type: FuelAnomalyType;
  severity: 'critical' | 'high' | 'medium';
  titleAr: string;
  titleFr: string;
  descriptionAr: string;
  descriptionFr: string;
  details: string;
}

export interface FuelAuditResult {
  isClean: boolean;
  trustScore: number; // 0 to 100
  rating: 'trustworthy' | 'warning' | 'fraud_suspected';
  anomalies: FuelAuditAnomaly[];
  distanceToTruckKm?: number;
  stationMatchedName?: string;
  calculatedConsumptionRate?: number; // L / 100 km
  standardConsumptionRate: number; // L / 100 km
  maxTankCapacityLiters: number;
  pricePerLiter?: number;
  auditedAt: string;
}

/**
 * Match a station text string to the corridor fuel stations catalog
 */
function resolveStationCoordinates(stationText?: string): { name: string; lat: number; lng: number } | null {
  if (!stationText) return null;
  const lower = stationText.toLowerCase();

  for (const [, st] of Object.entries(CORRIDOR_FUEL_STATIONS)) {
    const stNameLower = st.name.toLowerCase();
    const keywords = stNameLower.split(/[\s,/-]+/).filter((k) => k.length >= 4);

    let matchCount = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) matchCount++;
    }

    if (matchCount >= 2 || (keywords.length > 0 && lower.includes(keywords[0]) && lower.includes(st.country.toLowerCase()))) {
      return { name: st.name, lat: st.lat, lng: st.lng };
    }
  }

  // Common city / checkpoint heuristics
  if (lower.includes('tanger med') || lower.includes('tangermed')) {
    return CORRIDOR_FUEL_STATIONS.tanger_med_afriquia;
  }
  if (lower.includes('algeciras') || lower.includes('algésiras')) {
    return CORRIDOR_FUEL_STATIONS.algeciras_repsol;
  }
  if (lower.includes('larache')) {
    return CORRIDOR_FUEL_STATIONS.larache_aire;
  }
  if (lower.includes('kenitra')) {
    return CORRIDOR_FUEL_STATIONS.kenitra_nord;
  }
  if (lower.includes('la jonquera') || lower.includes('jonquera')) {
    return CORRIDOR_FUEL_STATIONS.la_jonquera_red_tortuga;
  }
  if (lower.includes('irun')) {
    return CORRIDOR_FUEL_STATIONS.irun_andamur;
  }
  if (lower.includes('bailen') || lower.includes('bailén')) {
    return CORRIDOR_FUEL_STATIONS.bailen_repsol;
  }

  return null;
}

/**
 * Core Fraud & Geolocation Anomaly Detection Algorithm
 */
export async function auditFuelReceipt(input: FuelAuditInput): Promise<FuelAuditResult> {
  const supabase = await createClient();

  const anomalies: FuelAuditAnomaly[] = [];
  let scoreDeduction = 0;

  // 1. Fetch Truck specs (Tank capacity, standard fuel rate)
  const { data: truck, error: truckErr } = await supabase
    .from('trucks')
    .select('id, plate_number, model, fuel_consumption_rate, weight_capacity')
    .eq('id', input.truckId)
    .single();

  const standardRate = truck?.fuel_consumption_rate ? Number(truck.fuel_consumption_rate) : 36.0;
  // Standard TIR tractor dual tank capacity is 850L (safe physical ceiling: 950L)
  const maxTankCapacity = 900;

  const litersDec = new Decimal(input.liters || 0);
  const amountDec = new Decimal(input.amount || 0);

  // 2. Check Tank Capacity Violation
  if (litersDec.greaterThan(maxTankCapacity)) {
    const excess = litersDec.minus(maxTankCapacity).toNumber();
    scoreDeduction += 50;
    anomalies.push({
      type: 'TANK_OVERFILL',
      severity: 'critical',
      titleAr: 'تجاوز السعة الميكانيكية القصوى لخزان الشاحنة',
      titleFr: 'Dépassement de la capacité maximale du réservoir',
      descriptionAr: `الكمية المسجلة (${litersDec.toFixed(0)} لتر) تتجاوز أقصى سعة ممكنة لخزان الشاحنة (${maxTankCapacity} لتر) بفارق ${excess.toFixed(0)} لتر.`,
      descriptionFr: `La quantité (${litersDec.toFixed(0)} L) dépasse la capacité maximale du réservoir (${maxTankCapacity} L) de ${excess.toFixed(0)} L.`,
      details: `Refueled: ${litersDec.toFixed(1)}L | Max Tank: ${maxTankCapacity}L`,
    });
  }

  // 3. Price per Liter Sanity Check
  let pricePerLiter: number | undefined;
  if (litersDec.greaterThan(0) && amountDec.greaterThan(0)) {
    const priceDec = amountDec.dividedBy(litersDec);
    pricePerLiter = priceDec.toNumber();

    // Normal diesel price range:
    // Morocco: 10 to 18 MAD/L
    // Europe: 1.2 to 2.2 EUR/L (13 to 24 MAD/L)
    const cur = input.currency || 'MAD';
    if (cur === 'MAD') {
      if (priceDec.lessThan(8) || priceDec.greaterThan(22)) {
        scoreDeduction += 15;
        anomalies.push({
          type: 'ABNORMAL_PRICE',
          severity: 'medium',
          titleAr: 'سعر لتر الوقود خارج النطاق السعري الطبيعي',
          titleFr: 'Prix au litre de carburant anormal',
          descriptionAr: `سعر اللتر المحسوب هو ${priceDec.toFixed(2)} درهم/لتر وهو خارج النطاق السعري المعتمد (10 - 18 درهم).`,
          descriptionFr: `Prix au litre calculé (${priceDec.toFixed(2)} MAD/L) hors fourchette normale.`,
          details: `Price/L: ${priceDec.toFixed(2)} ${cur}`,
        });
      }
    } else if (cur === 'EUR') {
      if (priceDec.lessThan(1.0) || priceDec.greaterThan(2.5)) {
        scoreDeduction += 15;
        anomalies.push({
          type: 'ABNORMAL_PRICE',
          severity: 'medium',
          titleAr: 'سعر لتر الوقود بالأورو خارج النطاق المعتاد',
          titleFr: 'Prix au litre en EUR anormal',
          descriptionAr: `سعر اللتر المحسوب هو ${priceDec.toFixed(2)} أورو/لتر.`,
          descriptionFr: `Prix au litre calculé (${priceDec.toFixed(2)} EUR/L) hors fourchette normale.`,
          details: `Price/L: ${priceDec.toFixed(2)} ${cur}`,
        });
      }
    }
  }

  // 4. Geolocation & Geofence Matching
  let stationCoords: { name: string; lat: number; lng: number } | null = null;
  if (input.stationLat && input.stationLng) {
    stationCoords = {
      name: input.stationName || 'محطة محددة بالإحداثيات',
      lat: input.stationLat,
      lng: input.stationLng,
    };
  } else if (input.stationName) {
    stationCoords = resolveStationCoordinates(input.stationName);
  }

  let distanceToTruckKm: number | undefined;

  if (stationCoords) {
    // Fetch truck location history around the receipt date (+/- 36 hours)
    const receiptDate = new Date(input.date);
    const windowStart = new Date(receiptDate.getTime() - 36 * 3600 * 1000).toISOString();
    const windowEnd = new Date(receiptDate.getTime() + 36 * 3600 * 1000).toISOString();

    const { data: locations } = await supabase
      .from('truck_locations')
      .select('*')
      .eq('truck_id', input.truckId)
      .gte('recorded_at', windowStart)
      .lte('recorded_at', windowEnd);

    const locList = (locations || []) as TruckLocationHistory[];

    if (locList.length > 0) {
      let minDistance = Number.POSITIVE_INFINITY;
      for (const loc of locList) {
        if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
          const dist = calculateDistance(stationCoords.lat, stationCoords.lng, loc.latitude, loc.longitude);
          if (dist < minDistance) {
            minDistance = dist;
          }
        }
      }

      if (Number.isFinite(minDistance)) {
        distanceToTruckKm = Math.round(minDistance * 10) / 10;

        // Safety threshold: 15 km
        if (distanceToTruckKm > 15) {
          scoreDeduction += 45;
          anomalies.push({
            type: 'LOCATION_MISMATCH',
            severity: 'critical',
            titleAr: 'اشتباه تباين جغرافي (المحطة بعيدة عن مسار الشاحنة)',
            titleFr: 'Anomalie de géolocalisation (Station éloignée)',
            descriptionAr: `أقرب نقطة سجلتها الشاحنة كانت على بعد ${distanceToTruckKm} كم من محطة الوقود المذكورة (${stationCoords.name}).`,
            descriptionFr: `Le camion était à ${distanceToTruckKm} km de la station indiquée (${stationCoords.name}) lors du plein.`,
            details: `Min Distance: ${distanceToTruckKm} km (Limit: 15 km) | Station: ${stationCoords.name}`,
          });
        }
      }
    } else {
      // No GPS points in window
      anomalies.push({
        type: 'INSUFFICIENT_GPS_DATA',
        severity: 'medium',
        titleAr: 'لا توجد بيانات GPS كافية للشاحنة في تاريخ الوصل',
        titleFr: 'Données GPS insuffisantes pour la date du reçu',
        descriptionAr: 'تعذر التحقق من التواجد المكاني للشاحنة لعدم توفر سجلات تتبع في هذا التاريخ.',
        descriptionFr: 'Impossible de vérifier la présence du camion faute de données télématiques à cette date.',
        details: `No GPS points between ${windowStart.slice(0, 10)} and ${windowEnd.slice(0, 10)}`,
      });
      scoreDeduction += 10;
    }
  }

  // 5. Consumption Rate Deviation
  let calculatedConsumptionRate: number | undefined;
  let distanceKm = input.distanceTraveledKm;
  if (!distanceKm && input.odometerKm && input.prevOdometerKm && input.odometerKm > input.prevOdometerKm) {
    distanceKm = input.odometerKm - input.prevOdometerKm;
  }

  if (distanceKm && distanceKm > 50 && litersDec.greaterThan(0)) {
    const distDec = new Decimal(distanceKm);
    const rateDec = litersDec.dividedBy(distDec).times(100);
    calculatedConsumptionRate = rateDec.toNumber();

    const stdDec = new Decimal(standardRate);
    const deviationPercent = rateDec.minus(stdDec).dividedBy(stdDec).times(100).toNumber();

    if (deviationPercent > 25) {
      scoreDeduction += 30;
      anomalies.push({
        type: 'EXCESSIVE_CONSUMPTION',
        severity: 'high',
        titleAr: 'معدل استهلاك وقود مرتفع جداً مقارنة بمعيار الشاحنة',
        titleFr: 'Consommation de carburant excessivement élevée',
        descriptionAr: `معدل الحرق المسجل (${rateDec.toFixed(1)} لتر/100كم) يفوق المعيار القياسي (${standardRate} لتر/100كم) بنسبة +${deviationPercent.toFixed(1)}%.`,
        descriptionFr: `Consommation calculée (${rateDec.toFixed(1)} L/100km) supérieure à la norme (${standardRate} L/100km) de +${deviationPercent.toFixed(1)}%.`,
        details: `Rate: ${rateDec.toFixed(1)} L/100km | Standard: ${standardRate} L/100km (+${deviationPercent.toFixed(1)}%)`,
      });
    } else if (deviationPercent < -30) {
      scoreDeduction += 15;
      anomalies.push({
        type: 'EXCESSIVE_CONSUMPTION',
        severity: 'medium',
        titleAr: 'معدل استهلاك منخفض بشكل غير طبيعي (بيانات ناقصة)',
        titleFr: 'Consommation anormalement basse (Données incomplètes)',
        descriptionAr: `معدل الحرق المسجل (${rateDec.toFixed(1)} لتر/100كم) أقل بكثير من المعيار الطبيعي (${deviationPercent.toFixed(1)}%).`,
        descriptionFr: `Consommation anormalement basse (${rateDec.toFixed(1)} L/100km).`,
        details: `Rate: ${rateDec.toFixed(1)} L/100km | Deviation: ${deviationPercent.toFixed(1)}%`,
      });
    }
  }

  // Calculate final Trust Score (0 to 100)
  const trustScore = Math.max(0, Math.min(100, 100 - scoreDeduction));

  const rating: FuelAuditResult['rating'] =
    trustScore >= 80 ? 'trustworthy' : trustScore >= 50 ? 'warning' : 'fraud_suspected';

  const isClean = anomalies.length === 0 && trustScore >= 80;

  // 6. If fraud suspected or severe anomaly, record security audit log
  if (rating === 'fraud_suspected' && input.receiptId) {
    await recordAuditLog({
      entityType: 'fuel_receipt',
      entityId: input.receiptId,
      actionType: 'security_alert',
      reason: `اشتباه احتيال وتلاعب في وصل الوقود (درجة الموثوقية ${trustScore}%): ${anomalies.map((a) => a.titleAr).join(' • ')}`,
      newData: {
        receiptId: input.receiptId,
        truckId: input.truckId,
        plateNumber: truck?.plate_number,
        liters: input.liters,
        amount: input.amount,
        trustScore,
        distanceToTruckKm,
        anomalies,
      },
    });
  }

  return {
    isClean,
    trustScore,
    rating,
    anomalies,
    distanceToTruckKm,
    stationMatchedName: stationCoords?.name,
    calculatedConsumptionRate: calculatedConsumptionRate ? Math.round(calculatedConsumptionRate * 10) / 10 : undefined,
    standardConsumptionRate: standardRate,
    maxTankCapacityLiters: maxTankCapacity,
    pricePerLiter: pricePerLiter ? Math.round(pricePerLiter * 100) / 100 : undefined,
    auditedAt: new Date().toISOString(),
  };
}

/**
 * Audit an existing saved fuel receipt from truck_maintenance
 */
export async function auditSavedFuelReceipt(receiptId: number): Promise<FuelAuditResult | null> {
  try {
    const supabase = await createClient();
    const { data: receipt, error } = await supabase
      .from('truck_maintenance')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (error || !receipt) return null;

    // Extract station and liters from notes or description if not stored separately
    let stationName = receipt.provider_name || '';
    let liters = Number(receipt.amount || 0);

    const notesStr = `${receipt.notes || ''} ${receipt.description || ''}`;
    const stationMatch = notesStr.match(/المحطة:\s*([^\n\r]+)/i);
    if (stationMatch) stationName = stationMatch[1].trim();

    const litersMatch = notesStr.match(/الكمية:\s*([\d.]+)\s*L/i);
    if (litersMatch) liters = parseFloat(litersMatch[1]);

    const receiptDate = receipt.maintenance_date || receipt.date || receipt.created_at || new Date().toISOString().split('T')[0];

    return await auditFuelReceipt({
      receiptId: receipt.id,
      truckId: receipt.truck_id,
      liters,
      amount: Number(receipt.amount || 0),
      currency: receipt.currency || 'MAD',
      date: receiptDate.slice(0, 10),
      stationName,
    });
  } catch (err) {
    console.error('Failed to audit saved fuel receipt:', err);
    return null;
  }
}

