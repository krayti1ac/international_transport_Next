/**
 * Trans Bodanon TMS — Reefer OEM Cloud Telematics Adapter Service
 * Normalizes Carrier DataCOLD & Thermo King TracKing telematics to standard ReeferTelemetryLog
 * Enforces Decimal.js precision for fuel and operational hours calculations.
 */

import Decimal from 'decimal.js';
import type { ReeferTelemetryLog } from '../types/reefer-compliance.types';
import {
  type CarrierDataColdPayload,
  type ThermoKingTracKingPayload,
  type NormalizedReeferOemPacket,
  type ReeferOemAlarm,
  type ReeferOemBrand,
  CARRIER_DATACOLD_ALARM_CATALOG,
  THERMO_KING_ALARM_CATALOG,
} from '../types/reefer-cloud-gateway.types';

export class ReeferOemAdapterService {
  /**
   * 1. Calculate Fuel Burn Rate (Liters / Hour) with Decimal.js
   */
  public static calculateFuelBurnRate(params: {
    startLiters: number;
    endLiters: number;
    elapsedHours: number;
  }): number {
    if (params.elapsedHours <= 0) return 2.1; // Default nominal burn rate

    try {
      const consumed = new Decimal(params.startLiters).minus(params.endLiters);
      if (consumed.isNegative() || consumed.isZero()) return 0.5;

      const rate = consumed.dividedBy(new Decimal(params.elapsedHours));
      return rate.toDecimalPlaces(2).toNumber();
    } catch {
      return 2.1;
    }
  }

  /**
   * 2. Normalize Carrier Transicold DataCOLD / eSolutions Packet
   */
  public static normalizeCarrierPayload(
    payload: CarrierDataColdPayload,
    tripId?: string | number
  ): NormalizedReeferOemPacket {
    // Map operational modes to TMS compressor status
    let compressorStatus: 'running' | 'cycle_sentry' | 'defrost' | 'off' = 'running';
    let isDefrostActive = false;

    if (payload.operationMode === 'defrost') {
      compressorStatus = 'defrost';
      isDefrostActive = true;
    } else if (payload.operationMode === 'off' || payload.engineStatus === 'off') {
      compressorStatus = 'off';
    } else if (payload.engineStatus === 'low_speed' || payload.engineStatus === 'standby_electric') {
      compressorStatus = 'cycle_sentry';
    }

    // Resolve Carrier Alarms
    const parsedAlarms: ReeferOemAlarm[] = [];
    if (payload.alarms && Array.isArray(payload.alarms)) {
      for (const code of payload.alarms) {
        const cleanCode = code.toUpperCase().trim();
        const alarmDef = CARRIER_DATACOLD_ALARM_CATALOG[cleanCode];
        if (alarmDef) {
          parsedAlarms.push(alarmDef);
        } else {
          parsedAlarms.push({
            code: cleanCode,
            source: 'carrier_transicold',
            severity: 'warning',
            labelAr: `إنذار غير مدرج (${cleanCode})`,
            labelFr: `Alarme non cataloguée (${cleanCode})`,
            labelEs: `Alarma no catalogada (${cleanCode})`,
            requiresImmediateStop: false,
          });
        }
      }
    }

    const burnRate = payload.fuel.estimatedBurnRateLph
      ? new Decimal(payload.fuel.estimatedBurnRateLph).toDecimalPlaces(2).toNumber()
      : compressorStatus === 'running'
      ? 2.1
      : 0.8;

    const log: ReeferTelemetryLog = {
      id: `carrier_${payload.serialNumber}_${Date.now()}`,
      tripId: tripId || 0,
      supplyAirTemp: new Decimal(payload.probes.supplyAirTemp).toDecimalPlaces(2).toNumber(),
      returnAirTemp: new Decimal(payload.probes.returnAirTemp).toDecimalPlaces(2).toNumber(),
      ambientTemp: payload.probes.ambientTemp !== undefined
        ? new Decimal(payload.probes.ambientTemp).toDecimalPlaces(2).toNumber()
        : undefined,
      compressorStatus,
      isDefrostActive,
      doorOpenSensor: Boolean(payload.doorStatus.doorOpen),
      dieselFuelLevelLiters: payload.fuel.fuelLevelLiters !== undefined
        ? new Decimal(payload.fuel.fuelLevelLiters).toDecimalPlaces(1).toNumber()
        : undefined,
      dieselBurnRateLph: burnRate,
      latitude: payload.location?.latitude,
      longitude: payload.location?.longitude,
      isGeofenceSafe: true,
      recordedAt: payload.timestamp || new Date().toISOString(),
    };

    return {
      oemBrand: 'carrier_transicold',
      serialNumber: payload.serialNumber,
      tripId,
      telemetryLog: log,
      parsedAlarms,
      engineMode: payload.engineStatus,
      fuelLevelPercent: payload.fuel.tankPercent,
    };
  }

  /**
   * 3. Normalize Thermo King TracKing / OptiTemp Packet
   */
  public static normalizeThermoKingPayload(
    payload: ThermoKingTracKingPayload,
    tripId?: string | number
  ): NormalizedReeferOemPacket {
    let compressorStatus: 'running' | 'cycle_sentry' | 'defrost' | 'off' = 'running';
    let isDefrostActive = false;

    if (payload.controlMode === 'defrost') {
      compressorStatus = 'defrost';
      isDefrostActive = true;
    } else if (payload.controlMode === 'off') {
      compressorStatus = 'off';
    } else if (payload.controlMode === 'cycle_sentry') {
      compressorStatus = 'cycle_sentry';
    }

    // Resolve Thermo King Alarms
    const parsedAlarms: ReeferOemAlarm[] = [];
    if (payload.activeAlarms && Array.isArray(payload.activeAlarms)) {
      for (const item of payload.activeAlarms) {
        const rawCode = String(item.alarmCode).trim();
        const fullKey = rawCode.startsWith('TK') ? rawCode : `TK${rawCode}`;
        const alarmDef = THERMO_KING_ALARM_CATALOG[fullKey];

        if (alarmDef) {
          parsedAlarms.push(alarmDef);
        } else {
          parsedAlarms.push({
            code: fullKey,
            source: 'thermo_king',
            severity: item.alarmSeverity === 'shutdown' ? 'critical_shutdown' : 'warning',
            labelAr: item.alarmDescription || `إنذار ثيرمو كينغ (${fullKey})`,
            labelFr: item.alarmDescription || `Alarme Thermo King (${fullKey})`,
            labelEs: item.alarmDescription || `Alarma Thermo King (${fullKey})`,
            requiresImmediateStop: item.alarmSeverity === 'shutdown',
          });
        }
      }
    }

    const burnRate = payload.fuel.fuelConsumptionRateLph
      ? new Decimal(payload.fuel.fuelConsumptionRateLph).toDecimalPlaces(2).toNumber()
      : compressorStatus === 'running'
      ? 2.2
      : 0.9;

    const log: ReeferTelemetryLog = {
      id: `tk_${payload.vinOrTrailerId}_${Date.now()}`,
      tripId: tripId || 0,
      supplyAirTemp: new Decimal(payload.temperatures.dischargeAirTemp).toDecimalPlaces(2).toNumber(),
      returnAirTemp: new Decimal(payload.temperatures.returnAirTemp).toDecimalPlaces(2).toNumber(),
      ambientTemp: payload.temperatures.ambientTemp !== undefined
        ? new Decimal(payload.temperatures.ambientTemp).toDecimalPlaces(2).toNumber()
        : undefined,
      compressorStatus,
      isDefrostActive,
      doorOpenSensor: Boolean(payload.doorState.rearDoorOpen || payload.doorState.sideDoorOpen),
      dieselFuelLevelLiters: payload.fuel.fuelVolumeLiters !== undefined
        ? new Decimal(payload.fuel.fuelVolumeLiters).toDecimalPlaces(1).toNumber()
        : undefined,
      dieselBurnRateLph: burnRate,
      latitude: payload.gps?.lat,
      longitude: payload.gps?.lon,
      isGeofenceSafe: true,
      recordedAt: payload.dateTimeUtc || new Date().toISOString(),
    };

    return {
      oemBrand: 'thermo_king',
      serialNumber: payload.vinOrTrailerId,
      tripId,
      telemetryLog: log,
      parsedAlarms,
      engineMode: payload.controlMode,
      totalEngineHours: payload.engineTotalHours,
      fuelLevelPercent: payload.fuel.fuelLevelPercent,
    };
  }

  /**
   * 4. Smart Payload Auto-Detection & Parsing
   */
  public static parseRawWebhookPayload(
    raw: unknown,
    brandHint?: ReeferOemBrand,
    tripId?: string | number
  ): NormalizedReeferOemPacket {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid OEM payload: Body must be a JSON object');
    }

    const data = raw as Record<string, any>;

    // Auto-detect brand if not hinted
    const isCarrier = brandHint === 'carrier_transicold' || ('probes' in data && 'serialNumber' in data);
    const isThermoKing = brandHint === 'thermo_king' || ('vinOrTrailerId' in data || 'temperatures' in data);

    if (isCarrier) {
      return this.normalizeCarrierPayload(data as CarrierDataColdPayload, tripId);
    } else if (isThermoKing) {
      return this.normalizeThermoKingPayload(data as ThermoKingTracKingPayload, tripId);
    } else {
      throw new Error('Unrecognized refrigeration OEM format: Neither Carrier DataCOLD nor Thermo King TracKing matched.');
    }
  }
}

