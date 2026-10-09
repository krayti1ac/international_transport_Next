import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { ReeferOemAdapterService } from '../services/reefer-oem-adapter.service';
import type {
  CarrierDataColdPayload,
  ThermoKingTracKingPayload,
} from '../types/reefer-cloud-gateway.types';
import {
  CARRIER_DATACOLD_ALARM_CATALOG,
  THERMO_KING_ALARM_CATALOG,
} from '../types/reefer-cloud-gateway.types';

describe('Trans Bodanon TMS — Refrigeration OEM Cloud Telematics Gateway (Carrier & Thermo King)', () => {
  // 1. Carrier Transicold DataCOLD Normalization
  describe('1. Carrier Transicold DataCOLD Adapter', () => {
    it('normalizes a Carrier Vector 1550 DataCOLD packet with multi-probe temperatures', () => {
      const payload: CarrierDataColdPayload = {
        serialNumber: 'CT-VEC-88391',
        unitModel: 'Vector 1550',
        timestamp: '2026-10-09T20:50:00Z',
        probes: {
          supplyAirTemp: 2.1,
          returnAirTemp: 4.4,
          defrostCoilTemp: 0.5,
          ambientTemp: 28.2,
        },
        setpoint: 4.0,
        operationMode: 'cooling',
        engineStatus: 'high_speed',
        doorStatus: {
          doorOpen: false,
          doorSensorActive: true,
        },
        fuel: {
          tankPercent: 85,
          fuelLevelLiters: 170.0,
          estimatedBurnRateLph: 2.35,
        },
        alarms: ['AL01'],
        location: {
          latitude: 31.7917,
          longitude: -7.0926,
          speedKmH: 80,
        },
      };

      const result = ReeferOemAdapterService.normalizeCarrierPayload(payload, 101);

      expect(result.oemBrand).toBe('carrier_transicold');
      expect(result.serialNumber).toBe('CT-VEC-88391');
      expect(result.tripId).toBe(101);
      expect(result.telemetryLog.supplyAirTemp).toBe(2.1);
      expect(result.telemetryLog.returnAirTemp).toBe(4.4);
      expect(result.telemetryLog.ambientTemp).toBe(28.2);
      expect(result.telemetryLog.compressorStatus).toBe('running');
      expect(result.telemetryLog.doorOpenSensor).toBe(false);
      expect(result.telemetryLog.dieselBurnRateLph).toBe(2.35);

      // Verify Alarm Parsing
      expect(result.parsedAlarms.length).toBe(1);
      expect(result.parsedAlarms[0].code).toBe('AL01');
      expect(result.parsedAlarms[0].severity).toBe('warning');
      expect(result.parsedAlarms[0].labelAr).toContain('انخفاض مستوى وقود الديزل');
    });

    it('identifies critical shutdown Carrier alarms requiring immediate stop', () => {
      const payload: CarrierDataColdPayload = {
        serialNumber: 'CT-VEC-999',
        timestamp: '2026-10-09T21:00:00Z',
        probes: {
          supplyAirTemp: 14.5,
          returnAirTemp: 16.0,
        },
        setpoint: 4.0,
        operationMode: 'off',
        engineStatus: 'off',
        doorStatus: { doorOpen: true, doorSensorActive: true },
        fuel: { fuelLevelLiters: 40 },
        alarms: ['AL12', 'AL20'], // High discharge pressure & supply probe error
      };

      const result = ReeferOemAdapterService.normalizeCarrierPayload(payload);

      expect(result.telemetryLog.compressorStatus).toBe('off');
      expect(result.parsedAlarms.length).toBe(2);

      const criticalAlarms = result.parsedAlarms.filter((a) => a.requiresImmediateStop);
      expect(criticalAlarms.length).toBe(2);
      expect(criticalAlarms.some((a) => a.code === 'AL12')).toBe(true);
      expect(criticalAlarms.some((a) => a.code === 'AL20')).toBe(true);
    });
  });

  // 2. Thermo King TracKing Normalization
  describe('2. Thermo King TracKing Adapter', () => {
    it('normalizes a Thermo King Advancer A-400 TracKing packet with OptiTemp and engine hours', () => {
      const payload: ThermoKingTracKingPayload = {
        vinOrTrailerId: 'TK-ADV-7740',
        dateTimeUtc: '2026-10-09T20:55:00Z',
        temperatures: {
          dischargeAirTemp: -22.5,
          returnAirTemp: -20.2,
          ambientTemp: 26.0,
          evaporatorTemp: -24.0,
        },
        tempSetpoint: -20.0,
        controlMode: 'continuous',
        powerSource: 'diesel_engine',
        engineTotalHours: 4210.5,
        fuel: {
          fuelLevelPercent: 78,
          fuelVolumeLiters: 156.0,
          fuelConsumptionRateLph: 2.15,
        },
        doorState: {
          rearDoorOpen: false,
        },
        activeAlarms: [
          {
            alarmCode: 61,
            alarmDescription: 'Low Battery Voltage',
            alarmSeverity: 'check',
          },
        ],
        gps: {
          lat: 34.020882,
          lon: -6.84165,
          speed: 85,
        },
      };

      const result = ReeferOemAdapterService.normalizeThermoKingPayload(payload, 202);

      expect(result.oemBrand).toBe('thermo_king');
      expect(result.serialNumber).toBe('TK-ADV-7740');
      expect(result.tripId).toBe(202);
      expect(result.telemetryLog.supplyAirTemp).toBe(-22.5);
      expect(result.telemetryLog.returnAirTemp).toBe(-20.2);
      expect(result.telemetryLog.compressorStatus).toBe('running');
      expect(result.totalEngineHours).toBe(4210.5);

      // Verify Alarm Translation
      expect(result.parsedAlarms.length).toBe(1);
      expect(result.parsedAlarms[0].code).toBe('TK61');
      expect(result.parsedAlarms[0].labelAr).toContain('انخفاض بطارية');
    });

    it('correctly maps cycle sentry and defrost modes for Thermo King', () => {
      const payload: ThermoKingTracKingPayload = {
        vinOrTrailerId: 'TK-CYCLE-1',
        dateTimeUtc: '2026-10-09T21:05:00Z',
        temperatures: {
          dischargeAirTemp: 3.5,
          returnAirTemp: 4.0,
        },
        tempSetpoint: 4.0,
        controlMode: 'cycle_sentry',
        powerSource: 'diesel_engine',
        fuel: { fuelVolumeLiters: 120 },
        doorState: { rearDoorOpen: true },
      };

      const result = ReeferOemAdapterService.normalizeThermoKingPayload(payload);

      expect(result.telemetryLog.compressorStatus).toBe('cycle_sentry');
      expect(result.telemetryLog.doorOpenSensor).toBe(true);
    });
  });

  // 3. Decimal.js Fuel Burn Rate Calculation
  describe('3. Decimal.js Fuel Burn Rate Calculation', () => {
    it('calculates consumption rate with 2 decimal places precision', () => {
      const rate = ReeferOemAdapterService.calculateFuelBurnRate({
        startLiters: 180.0,
        endLiters: 169.5, // 10.5 liters consumed
        elapsedHours: 5,  // in 5 hours = 2.10 L/hr
      });

      expect(rate).toBe(2.1);
    });

    it('handles negative or invalid elapsed hours safely without NaN', () => {
      const rateZero = ReeferOemAdapterService.calculateFuelBurnRate({
        startLiters: 150,
        endLiters: 150,
        elapsedHours: 0,
      });

      expect(rateZero).toBe(2.1);

      const rateNegative = ReeferOemAdapterService.calculateFuelBurnRate({
        startLiters: 150,
        endLiters: 160, // Refueling event
        elapsedHours: 2,
      });

      expect(rateNegative).toBe(0.5); // Minimum fallback
    });
  });

  // 4. Auto-detection & Smart Parsing
  describe('4. Smart Payload Auto-Detection', () => {
    it('auto-detects Carrier payload by presence of probes and serialNumber', () => {
      const carrierRaw = {
        serialNumber: 'CARRIER-TEST',
        probes: { supplyAirTemp: 4.0, returnAirTemp: 4.5 },
        setpoint: 4.0,
        operationMode: 'cooling',
        engineStatus: 'high_speed',
        doorStatus: { doorOpen: false },
        fuel: {},
      };

      const res = ReeferOemAdapterService.parseRawWebhookPayload(carrierRaw);
      expect(res.oemBrand).toBe('carrier_transicold');
    });

    it('auto-detects Thermo King payload by presence of temperatures and vinOrTrailerId', () => {
      const tkRaw = {
        vinOrTrailerId: 'TK-TEST',
        temperatures: { dischargeAirTemp: 4.0, returnAirTemp: 4.5 },
        tempSetpoint: 4.0,
        controlMode: 'continuous',
        powerSource: 'diesel_engine',
        fuel: {},
        doorState: { rearDoorOpen: false },
      };

      const res = ReeferOemAdapterService.parseRawWebhookPayload(tkRaw);
      expect(res.oemBrand).toBe('thermo_king');
    });

    it('throws descriptive error on unrecognized OEM format', () => {
      expect(() => {
        ReeferOemAdapterService.parseRawWebhookPayload({ unknownKey: 123 });
      }).toThrow('Unrecognized refrigeration OEM format');
    });
  });
});

