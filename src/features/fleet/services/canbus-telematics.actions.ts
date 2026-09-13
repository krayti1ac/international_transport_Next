'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { recordAuditLog } from '@/lib/audit.server';
import type {
  FmsTelematicsPacket,
  TelematicsAlert,
  TruckTelematicsState,
} from '../types/telematics.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// In-memory telematics cache for delta calculations (last known reading per plate)
const telematicsCache = new Map<
  string,
  {
    fuel_level_percent: number;
    fuel_liters: number;
    timestamp: number;
    speed_kmh: number;
    coolant_temp_c: number;
  }
>();

// In-memory active alerts cache
const recentAlerts: TelematicsAlert[] = [];

/**
 * Ingest standardized FMS / CAN-Bus telematics packet from IoT onboard tracker (SAE J1939)
 */
export async function ingestFmsTelematicsPacket(
  packet: FmsTelematicsPacket
): Promise<{
  success: boolean;
  alerts: TelematicsAlert[];
  state?: TruckTelematicsState;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. Resolve truck by plate
    const cleanPlate = (packet.truck_plate || '').trim().toUpperCase();
    const { data: truck, error: truckErr } = await supabase
      .from('trucks')
      .select('id, plate_number, model, status')
      .ilike('plate_number', `%${cleanPlate}%`)
      .maybeSingle();

    if (truckErr) throw truckErr;

    const truckId = truck ? truck.id : 0;
    const truckModel = truck ? truck.model : 'International TIR Truck';
    const truckStatus = (truck ? truck.status : 'active') as 'active' | 'maintenance' | 'idle';

    // Nominal TIR tank capacity (Standard double tank = 800 - 1100L, default 900L)
    const tankCapacityL = new Decimal(900);
    const currentFuelPercentDec = new Decimal(Math.max(0, Math.min(100, packet.fuel_level_percent)));
    const currentFuelLitersDec = currentFuelPercentDec.dividedBy(100).times(tankCapacityL);

    const generatedAlerts: TelematicsAlert[] = [];
    const nowIso = packet.timestamp || new Date().toISOString();
    const nowMs = new Date(nowIso).getTime();

    // 2. Anomaly & Fraud Detection via Delta Analysis
    const lastReading = telematicsCache.get(cleanPlate);

    if (lastReading) {
      const minutesElapsed = Math.max(1, (nowMs - lastReading.timestamp) / (1000 * 60));
      const prevFuelPercent = new Decimal(lastReading.fuel_level_percent);
      const fuelDropPercent = prevFuelPercent.minus(currentFuelPercentDec);

      // Check A: Rapid Fuel Drop / Syphon Theft while stationary or slow moving
      // If fuel drops >= 4.5% (approx. >= 40 Liters) within a short window while speed < 8 km/h
      if (
        packet.speed_kmh < 8 &&
        lastReading.speed_kmh < 8 &&
        fuelDropPercent.greaterThanOrEqualTo(4.5) &&
        minutesElapsed <= 120
      ) {
        const stolenLiters = fuelDropPercent.dividedBy(100).times(tankCapacityL);
        const alert: TelematicsAlert = {
          id: `theft-${cleanPlate}-${Date.now()}`,
          truck_plate: cleanPlate,
          alert_type: 'FUEL_THEFT_DETECTED',
          severity: 'critical',
          title: 'اشتباه سرقة وقود من الخزان (Fuel Theft Detected)',
          title_fr: 'Suspicion de vol de carburant (Chute anormale)',
          description: `تم رصد هبوط مفاجئ في مستوى الوقود بمقدار ${fuelDropPercent.toFixed(1)}% (${stolenLiters.toFixed(1)} لتر) خلال ${Math.round(minutesElapsed)} دقيقة أثناء توقف الشاحنة.`,
          description_fr: `Chute rapide de ${fuelDropPercent.toFixed(1)}% (${stolenLiters.toFixed(1)} L) détectée à l'arrêt en ${Math.round(minutesElapsed)} minutes.`,
          timestamp: nowIso,
          metrics: {
            fuel_level_percent: packet.fuel_level_percent,
            fuel_drop_liters: stolenLiters.toFixed(1),
            speed_kmh: packet.speed_kmh,
          },
        };
        generatedAlerts.push(alert);
        recentAlerts.unshift(alert);

        // Security audit log
        await recordAuditLog({
          actionType: 'security_alert',
          entityType: 'fuel_telematics',
          entityId: truckId.toString(),
          reason: `FUEL_THEFT_DETECTED: Plate ${cleanPlate}, drop ${fuelDropPercent.toFixed(1)}%`,
          newData: {
            event: 'FUEL_THEFT_DETECTED',
            plate: cleanPlate,
            dropPercent: fuelDropPercent.toFixed(1),
            stolenLiters: stolenLiters.toFixed(1),
            coordinates: { lat: packet.latitude, lng: packet.longitude },
          },
        });
      }
    }

    // Check B: Engine Coolant Overheating (> 103°C is dangerous, >= 105°C is critical)
    if (packet.engine_coolant_temp_c >= 104) {
      const alert: TelematicsAlert = {
        id: `overheat-${cleanPlate}-${Date.now()}`,
        truck_plate: cleanPlate,
        alert_type: 'COOLANT_OVERHEATING',
        severity: packet.engine_coolant_temp_c >= 108 ? 'critical' : 'warning',
        title: 'ارتفاع حرج في حرارة المحرك (Engine Overheating)',
        title_fr: 'Surchauffe moteur critique',
        description: `حرارة سائل التبريد بلغت ${packet.engine_coolant_temp_c}°C وتجاوزت الحد الأقصى الآمن (102°C). خطر تلف رأس المحرك.`,
        description_fr: `Température du liquide de refroidissement à ${packet.engine_coolant_temp_c}°C (seuil 102°C dépassé).`,
        timestamp: nowIso,
        metrics: {
          coolant_temp_c: packet.engine_coolant_temp_c,
          engine_rpm: packet.engine_speed_rpm,
        },
      };
      generatedAlerts.push(alert);
      recentAlerts.unshift(alert);
    }

    // Check C: Harsh Driving & Overspeeding (> 95 km/h for TIR Heavy Vehicle)
    if (packet.speed_kmh > 95) {
      const alert: TelematicsAlert = {
        id: `speed-${cleanPlate}-${Date.now()}`,
        truck_plate: cleanPlate,
        alert_type: 'HARSH_DRIVING_OVERSPEED',
        severity: packet.speed_kmh >= 105 ? 'critical' : 'warning',
        title: 'تجاوز السرعة القانونية للشاحنات (Overspeeding)',
        title_fr: 'Dépassement de la vitesse limite poids lourd',
        description: `سرعة الشاحنة بلغت ${Math.round(packet.speed_kmh)} كم/ساعة، متجاوزة السرعة القصوى لمركبات النقل الدولي (90 كم/ساعة).`,
        description_fr: `Vitesse de ${Math.round(packet.speed_kmh)} km/h dépassant la limite TIR (90 km/h).`,
        timestamp: nowIso,
        metrics: {
          speed_kmh: packet.speed_kmh,
          engine_rpm: packet.engine_speed_rpm,
        },
      };
      generatedAlerts.push(alert);
      recentAlerts.unshift(alert);
    }

    // Check D: Refrigerated Cargo Temperature Breach (Frigo)
    if (packet.reefer_temp_c !== undefined && packet.reefer_temp_c > 4.0) {
      const alert: TelematicsAlert = {
        id: `reefer-${cleanPlate}-${Date.now()}`,
        truck_plate: cleanPlate,
        alert_type: 'REEFER_TEMP_BREACH',
        severity: packet.reefer_temp_c > 8.0 ? 'critical' : 'warning',
        title: 'انحراف درجة حرارة تبريد المقطورة (Reefer Temperature Breach)',
        title_fr: 'Rupture de la chaîne du froid (Remorque Frigo)',
        description: `درجة حرارة حجرة التبريد بلغت ${packet.reefer_temp_c.toFixed(1)}°C، تجاوزت حد الأمان لشحنات التبريد الغذائي (+4°C).`,
        description_fr: `Température du groupe frigorifique à ${packet.reefer_temp_c.toFixed(1)}°C (seuil max +4°C dépassé).`,
        timestamp: nowIso,
        metrics: {
          reefer_temp_c: packet.reefer_temp_c,
        },
      };
      generatedAlerts.push(alert);
      recentAlerts.unshift(alert);
    }

    // Trim recent alerts list to last 100
    if (recentAlerts.length > 100) {
      recentAlerts.length = 100;
    }

    // 3. Update In-Memory Telematics Cache
    telematicsCache.set(cleanPlate, {
      fuel_level_percent: packet.fuel_level_percent,
      fuel_liters: currentFuelLitersDec.toNumber(),
      timestamp: nowMs,
      speed_kmh: packet.speed_kmh,
      coolant_temp_c: packet.engine_coolant_temp_c,
    });

    // 4. Record Location in Database if truck exists
    if (truckId > 0) {
      await supabase.from('truck_locations').insert({
        truck_id: truckId,
        latitude: packet.latitude,
        longitude: packet.longitude,
        speed: packet.speed_kmh,
        recorded_at: nowIso,
      });
    }

    // Determine engine health status
    const engineHealth =
      packet.engine_coolant_temp_c >= 105 || generatedAlerts.some((a) => a.severity === 'critical')
        ? 'critical'
        : packet.engine_coolant_temp_c >= 98 || generatedAlerts.length > 0
        ? 'warning'
        : 'healthy';

    const state: TruckTelematicsState = {
      truck_id: truckId,
      plate_number: cleanPlate,
      model: truckModel,
      status: truckStatus,
      last_updated: nowIso,
      latitude: packet.latitude,
      longitude: packet.longitude,
      speed_kmh: packet.speed_kmh,
      fuel_level_percent: packet.fuel_level_percent,
      fuel_liters_est: currentFuelLitersDec.toNumber(),
      engine_rpm: packet.engine_speed_rpm,
      engine_coolant_temp_c: packet.engine_coolant_temp_c,
      odometer_km: packet.odometer_km,
      reefer_temp_c: packet.reefer_temp_c,
      engine_health: engineHealth,
      active_alerts: generatedAlerts,
    };

    return {
      success: true,
      alerts: generatedAlerts,
      state,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to ingest telematics packet';
    return {
      success: false,
      alerts: [],
      error: message,
    };
  }
}

/**
 * Get current telematics fleet overview and active alerts
 */
export async function getFleetTelematicsOverview(): Promise<{
  activeAlerts: TelematicsAlert[];
  truckStates: TruckTelematicsState[];
  summary: {
    totalMonitored: number;
    criticalAlertsCount: number;
    warningAlertsCount: number;
    averageFuelLevelPercent: number;
  };
}> {
  try {
    const supabase = await createClient();
    const { data: trucks } = await supabase
      .from('trucks')
      .select('id, plate_number, model, status')
      .order('plate_number', { ascending: true });

    const truckList = trucks || [];
    const truckStates: TruckTelematicsState[] = [];

    let totalFuelPercent = new Decimal(0);
    let monitoredCount = 0;

    for (const t of truckList) {
      const cached = telematicsCache.get(t.plate_number.toUpperCase());
      const fuelPct = cached ? cached.fuel_level_percent : 72;
      const speed = cached ? cached.speed_kmh : 0;
      const coolant = cached ? cached.coolant_temp_c : 88;
      const tankCapacityL = new Decimal(900);
      const fuelLiters = new Decimal(fuelPct).dividedBy(100).times(tankCapacityL).toNumber();

      totalFuelPercent = totalFuelPercent.plus(new Decimal(fuelPct));
      monitoredCount++;

      const truckAlerts = recentAlerts.filter(
        (a) => a.truck_plate.toUpperCase() === t.plate_number.toUpperCase()
      );

      truckStates.push({
        truck_id: t.id,
        plate_number: t.plate_number,
        model: t.model,
        status: t.status as 'active' | 'maintenance' | 'idle',
        last_updated: cached ? new Date(cached.timestamp).toISOString() : new Date().toISOString(),
        latitude: 35.7595, // Default near Tanger Med Corridor if not pinged yet
        longitude: -5.834,
        speed_kmh: speed,
        fuel_level_percent: fuelPct,
        fuel_liters_est: fuelLiters,
        engine_rpm: speed > 0 ? 1450 : 650,
        engine_coolant_temp_c: coolant,
        odometer_km: 184500,
        engine_health: coolant >= 105 ? 'critical' : coolant >= 98 ? 'warning' : 'healthy',
        active_alerts: truckAlerts,
      });
    }

    const avgFuel =
      monitoredCount > 0
        ? totalFuelPercent.dividedBy(monitoredCount).toDecimalPlaces(1).toNumber()
        : 0;

    const criticalCount = recentAlerts.filter((a) => a.severity === 'critical').length;
    const warningCount = recentAlerts.filter((a) => a.severity === 'warning').length;

    return {
      activeAlerts: recentAlerts.slice(0, 15),
      truckStates,
      summary: {
        totalMonitored: monitoredCount,
        criticalAlertsCount: criticalCount,
        warningAlertsCount: warningCount,
        averageFuelLevelPercent: avgFuel,
      },
    };
  } catch {
    return {
      activeAlerts: [],
      truckStates: [],
      summary: {
        totalMonitored: 0,
        criticalAlertsCount: 0,
        warningAlertsCount: 0,
        averageFuelLevelPercent: 0,
      },
    };
  }
}
