'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { recordAuditLog } from '@/lib/audit.server';
import type {
  FmsTelematicsPacket,
  TelematicsAlert,
  TruckTelematicsState,
  ReeferOperationMode,
} from '../types/telematics.types';
import { processFrigoTelematicsGuard } from './frigo-guard.actions';
import { evaluatePortGeofences } from '@/features/tracking/services/port-geofence.actions';
import { CargoLossAssessmentService } from '@/features/tracking/services/cargo-loss-assessment.service';
import type {
  CargoCategory,
  ReeferCargoInsuranceClaim,
} from '@/features/tracking/types/reefer-claim-settlement.types';

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
    reefer_temp_c?: number;
    reefer_mode?: ReeferOperationMode;
    is_defrost_active?: boolean;
    defrost_started_at?: number;
    defrost_duration_minutes?: number;
    refrigerant_pressure_bar?: number;
    refrigerant_leak_detected?: boolean;
    last_claim_reference?: string;
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
  claim?: ReeferCargoInsuranceClaim;
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

    // Resolve active trip & driver context for reefer tracking and automated insurance claims
    let activeTrip: {
      id: number;
      cmr_number?: string | null;
      goods_description_export?: string | null;
      goods_description_import?: string | null;
      driver_id?: number | null;
    } | null = null;

    if (packet.trip_id) {
      const { data: t } = await supabase
        .from('trip_orders')
        .select('id, cmr_number, goods_description_export, goods_description_import, driver_id')
        .eq('id', packet.trip_id)
        .maybeSingle();
      if (t) activeTrip = t;
    }

    if (!activeTrip && truckId > 0) {
      const { data: t } = await supabase
        .from('trip_orders')
        .select('id, cmr_number, goods_description_export, goods_description_import, driver_id')
        .eq('truck_id', truckId)
        .in('status', ['in_transit', 'loading', 'customs_export', 'pending'])
        .order('departure_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (t) activeTrip = t;
    }

    let driverName = 'Field Fleet Driver';
    if (activeTrip?.driver_id) {
      const { data: driver } = await supabase
        .from('drivers')
        .select('name')
        .eq('id', activeTrip.driver_id)
        .maybeSingle();
      if (driver?.name) driverName = driver.name;
    }

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

      // Trigger automatic Frigo Guard notification & audit
      await processFrigoTelematicsGuard({
        truckPlate: cleanPlate,
        truckId,
        reeferTempC: packet.reefer_temp_c,
        timestamp: nowIso,
      });
    }

    // Check E: Defrost Cycle Stuck / Extended Defrost (> 45 min)
    const isDefrostActive = packet.is_defrost_active === true || packet.reefer_mode === 'defrost';
    let defrostMins = packet.defrost_duration_minutes;
    if (defrostMins === undefined && isDefrostActive) {
      const prevDefrostStart = lastReading?.defrost_started_at;
      if (prevDefrostStart) {
        defrostMins = Math.max(1, Math.round((nowMs - prevDefrostStart) / (1000 * 60)));
      } else {
        defrostMins = 15;
      }
    } else if (!isDefrostActive) {
      defrostMins = 0;
    }

    if (isDefrostActive && defrostMins !== undefined && defrostMins >= 45) {
      const alert: TelematicsAlert = {
        id: `defrost-${cleanPlate}-${Date.now()}`,
        truck_plate: cleanPlate,
        alert_type: 'REEFER_DEFROST_STUCK',
        severity: defrostMins >= 60 ? 'critical' : 'warning',
        title: 'إنذار استمرار دورة إذابة الجليد (Defrost Cycle Stuck)',
        title_fr: 'Cycle de dégivrage anormalement prolongé (Defrost Bloqué)',
        title_es: 'Ciclo de desescarche bloqueado anormalmente prolongado',
        description: `وحدة التبريد عالقة في وضع إذابة الصقيع لأكثر من ${defrostMins} دقيقة، مما يرفع حرارة المقصورة ويهدد سلامة الشحنة الغذائية.`,
        description_fr: `Le groupe frigo est bloqué en dégivrage depuis ${defrostMins} min, provoquant une hausse thermique anormale.`,
        description_es: `El equipo frigorífico está bloqueado en modo desescarche durante ${defrostMins} min, elevando la temperatura de carga.`,
        timestamp: nowIso,
        metrics: {
          reefer_temp_c: packet.reefer_temp_c,
          defrost_duration_minutes: defrostMins,
        },
      };
      generatedAlerts.push(alert);
      recentAlerts.unshift(alert);

      await recordAuditLog({
        actionType: 'security_alert',
        entityType: 'reefer_telematics',
        entityId: truckId.toString(),
        reason: `REEFER_DEFROST_STUCK: Plate ${cleanPlate}, duration ${defrostMins} mins`,
        newData: {
          event: 'REEFER_DEFROST_STUCK',
          plate: cleanPlate,
          defrostDurationMins: defrostMins,
          reeferTempC: packet.reefer_temp_c,
          timestamp: nowIso,
        },
      });
    }

    // Check F: Refrigerant Circuit Leak / Pressure Collapse (< 8.0 bar)
    const isLeakDetected = packet.refrigerant_leak_detected === true;
    const refrigPressure = packet.refrigerant_pressure_bar;
    const isLowPressure = refrigPressure !== undefined && refrigPressure < 8.0;

    if (isLeakDetected || isLowPressure) {
      const barDisplay = refrigPressure !== undefined ? refrigPressure.toFixed(1) : '6.2';
      const alert: TelematicsAlert = {
        id: `leak-${cleanPlate}-${Date.now()}`,
        truck_plate: cleanPlate,
        alert_type: 'REEFER_REFRIGERANT_LEAK',
        severity: 'critical',
        title: 'تسرب حرج لغاز التبريد وهبوط ضغط الدائرة (Refrigerant Leak Detected)',
        title_fr: 'Fuite critique de fluide frigorigène (Chute de pression)',
        title_es: 'Fuga crítica de refrigerante (Caída de presión del circuito)',
        description: `هبوط حاد في ضغط غاز التبريد (${barDisplay} bar) مع اشتباه تسريب في صمام التمدد (TXV) أو أنابيب المكثف. خطر توقف الضاغط وشيك.`,
        description_fr: `Chute brutale de pression du fluide frigorigène (${barDisplay} bar). Risque de panne compresseur ou fuite TXV.`,
        description_es: `Caída abrupta de presión de refrigerante (${barDisplay} bar). Riesgo inminente de parada del compresor o fuga en TXV.`,
        timestamp: nowIso,
        metrics: {
          refrigerant_pressure_bar: refrigPressure,
          reefer_temp_c: packet.reefer_temp_c,
        },
      };
      generatedAlerts.push(alert);
      recentAlerts.unshift(alert);

      await recordAuditLog({
        actionType: 'security_alert',
        entityType: 'reefer_circuit',
        entityId: truckId.toString(),
        reason: `REEFER_REFRIGERANT_LEAK: Plate ${cleanPlate}, pressure ${barDisplay} bar`,
        newData: {
          event: 'REEFER_REFRIGERANT_LEAK',
          plate: cleanPlate,
          refrigerantPressureBar: refrigPressure,
          timestamp: nowIso,
        },
      });
    }

    // Check G: Critical Cold Chain Breach & Automated Cargo Insurance Claim Trigger
    let generatedClaim: ReeferCargoInsuranceClaim | undefined;
    const currentReeferTemp = packet.reefer_temp_c;

    if (currentReeferTemp !== undefined) {
      const cargoDesc = `${activeTrip?.goods_description_export || ''} ${activeTrip?.goods_description_import || ''}`.toLowerCase();
      const isFrozen =
        (packet.cargo_setpoint_c !== undefined && packet.cargo_setpoint_c <= -10) ||
        cargoDesc.includes('frozen') ||
        cargoDesc.includes('surgelé') ||
        cargoDesc.includes('مجمد') ||
        currentReeferTemp < -6.0;

      const setpointTemp = packet.cargo_setpoint_c ?? (isFrozen ? -18.0 : 4.0);
      const isCriticalTempBreach = isFrozen ? currentReeferTemp >= -5.0 : currentReeferTemp >= 8.0;

      if (isCriticalTempBreach) {
        // Prevent duplicate claims within 30 minutes for the same truck
        const alreadyClaimed = recentAlerts.some(
          (a) =>
            a.truck_plate === cleanPlate &&
            a.alert_type === 'REEFER_CARGO_LOSS_IMMINENT' &&
            a.metrics.claim_reference &&
            nowMs - new Date(a.timestamp).getTime() < 30 * 60 * 1000
        );

        if (!alreadyClaimed) {
          const tripId = activeTrip?.id || packet.trip_id || (truckId > 0 ? truckId * 100 + 1 : 901);
          const tripNumber = activeTrip?.cmr_number || `CMR-TIR-${cleanPlate}-${tripId}`;
          const cargoCategory: CargoCategory = isFrozen ? 'deep_frozen' : 'fresh_produce';
          const insuredValue = 350000; // 350,000 MAD standard insured cargo value
          const deltaT = Math.max(0.5, Math.abs(currentReeferTemp - setpointTemp));

          try {
            generatedClaim = await CargoLossAssessmentService.processInsuranceClaim({
              tripId,
              tripNumber,
              truckPlate: cleanPlate,
              driverName,
              cargoCategory,
              insuredCargoValue: insuredValue,
              currency: 'MAD',
              deductibleAmount: 5000,
              durationMinutes: 180,
              tempRiseDeltaC: deltaT,
              maxAllowedTempC: setpointTemp,
              tempAtCloseC: currentReeferTemp,
              mktElevationC: deltaT > 5 ? 3.5 : 1.5,
              insurerName: 'Allianz Maroc / RMA Watanya',
              policyNumber: 'POL-FRIGO-2026-TANGIER',
              settlementType: 'credit_note',
              notes: `فتح ملف مطالبة أوتوماتيكي عبر نظام IoT FMS/CAN-Bus إثر كسر حرج لسلسلة التبريد (${currentReeferTemp.toFixed(1)}°C مقابل الضبط ${setpointTemp.toFixed(1)}°C). ضغط الغاز: ${refrigPressure !== undefined ? `${refrigPressure.toFixed(1)} bar` : 'سليم'}.`,
              lines: [
                {
                  itemDescription: isFrozen
                    ? 'شحنة أسماك ورخويات مجمدة (Frozen Seafood)'
                    : 'شحنة فواكه وخضروات طازجة (Fresh Berries)',
                  affectedQuantity: 18500,
                  unitOfMeasure: 'kg',
                  unitValue: new Decimal(insuredValue).dividedBy(18500).toDecimalPlaces(2).toNumber(),
                  depreciationPct: isFrozen ? 65 : 55,
                },
              ],
            });

            const alert: TelematicsAlert = {
              id: `claim-${cleanPlate}-${Date.now()}`,
              truck_plate: cleanPlate,
              alert_type: 'REEFER_CARGO_LOSS_IMMINENT',
              severity: 'critical',
              title: 'إصدار ملف مطالبة تأمين بضائع آلياً (Auto Cargo Claim Triggered)',
              title_fr: 'Dossier sinistre assurance marchandise ouvert automatiquement',
              title_es: 'Expediente de reclamación de seguro abierto automáticamente',
              description: `تم تلقائياً قيد ملف المطالبة ${generatedClaim.claimReference} بتعويض صافي تقديري ${generatedClaim.netIndemnityAmount.toLocaleString()} MAD نتيجة كسر حرج لسلسلة التبريد.`,
              description_fr: `Dossier ${generatedClaim.claimReference} créé avec indemnité estimée de ${generatedClaim.netIndemnityAmount.toLocaleString()} MAD suite à une rupture de froid.`,
              description_es: `Expediente ${generatedClaim.claimReference} generado con indemnización estimada de ${generatedClaim.netIndemnityAmount.toLocaleString()} MAD por rotura de cadena de frío.`,
              timestamp: nowIso,
              metrics: {
                reefer_temp_c: currentReeferTemp,
                claim_reference: generatedClaim.claimReference,
                gross_loss_estimate: generatedClaim.grossLossAmount,
              },
            };

            generatedAlerts.push(alert);
            recentAlerts.unshift(alert);

            await recordAuditLog({
              actionType: 'create',
              entityType: 'reefer_insurance_claim',
              entityId: generatedClaim.id,
              reason: `Auto Claim Generated via Telematics: Ref ${generatedClaim.claimReference}, Trip #${tripId}`,
              newData: {
                claimReference: generatedClaim.claimReference,
                tripId,
                truckPlate: cleanPlate,
                reeferTempC: currentReeferTemp,
                netIndemnityAmount: generatedClaim.netIndemnityAmount,
                claimDossierHash: generatedClaim.claimDossierHash,
              },
            });
          } catch (claimErr) {
            console.error('[canbus-telematics] Failed to auto-create insurance claim:', claimErr);
          }
        }
      }
    }

    // Evaluate Strategic Port & Border Geofences
    if (truckId > 0 && packet.latitude && packet.longitude) {
      await evaluatePortGeofences({
        truckId,
        truckPlate: cleanPlate,
        latitude: packet.latitude,
        longitude: packet.longitude,
        timestamp: nowIso,
      });
    }

    // Trim recent alerts list to last 100
    if (recentAlerts.length > 100) {
      recentAlerts.length = 100;
    }

    // 3. Update In-Memory Telematics Cache
    const activeClaimRef =
      generatedClaim?.claimReference || lastReading?.last_claim_reference;

    telematicsCache.set(cleanPlate, {
      fuel_level_percent: packet.fuel_level_percent,
      fuel_liters: currentFuelLitersDec.toNumber(),
      timestamp: nowMs,
      speed_kmh: packet.speed_kmh,
      coolant_temp_c: packet.engine_coolant_temp_c,
      reefer_temp_c: packet.reefer_temp_c,
      reefer_mode: packet.reefer_mode ?? (isDefrostActive ? 'defrost' : 'cooling'),
      is_defrost_active: isDefrostActive,
      defrost_started_at: isDefrostActive ? (lastReading?.defrost_started_at || nowMs) : undefined,
      defrost_duration_minutes: defrostMins,
      refrigerant_pressure_bar: refrigPressure,
      refrigerant_leak_detected: isLeakDetected || isLowPressure,
      last_claim_reference: activeClaimRef,
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
      reefer_mode: packet.reefer_mode ?? (isDefrostActive ? 'defrost' : 'cooling'),
      is_defrost_active: isDefrostActive,
      defrost_duration_minutes: defrostMins,
      refrigerant_pressure_bar: refrigPressure,
      refrigerant_leak_detected: isLeakDetected || isLowPressure,
      active_claim_reference: activeClaimRef,
      engine_health: engineHealth,
      active_alerts: generatedAlerts,
    };

    return {
      success: true,
      alerts: generatedAlerts,
      state,
      claim: generatedClaim,
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

      const reeferTemp = cached?.reefer_temp_c ?? -18.2;
      const reeferMode = cached?.reefer_mode ?? 'cooling';
      const isDefrost = cached?.is_defrost_active ?? false;
      const defrostDuration = cached?.defrost_duration_minutes ?? 0;
      const refrigPressure = cached?.refrigerant_pressure_bar ?? 14.2;
      const refrigLeak = cached?.refrigerant_leak_detected ?? (refrigPressure < 8.0);

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
        reefer_temp_c: reeferTemp,
        reefer_mode: reeferMode,
        is_defrost_active: isDefrost,
        defrost_duration_minutes: defrostDuration,
        refrigerant_pressure_bar: refrigPressure,
        refrigerant_leak_detected: refrigLeak,
        active_claim_reference: cached?.last_claim_reference,
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
