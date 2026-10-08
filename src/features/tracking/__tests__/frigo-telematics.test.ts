import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateFrigoSDI,
  parseFrigoTelemetryPacket,
  REEFER_STANDARD_ALARMS,
} from '../services/frigo-telematics-parser.service';
import { normalizeGPSPayload } from '@/app/api/webhooks/gps/route';

describe('Frigo IoT & Telematics Ingestion Engine', () => {
  describe('Brand Normalization and Optimal Decoding', () => {
    it('should correctly identify Carrier Transicold from model or brand name', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 101,
        truckPlate: '12345-A-1',
        model: 'Carrier Vector 1550 Multitemp',
        currentTemp: -18.2,
        targetTemp: -18.0,
        suctionPressureBar: 1.85,
        dischargePressureBar: 16.5,
        backupBatteryVdc: 12.6,
      });

      expect(packet.unitBrand).toBe('carrier');
      expect(packet.pressureStatus).toBe('optimal');
      expect(packet.batteryStatus).toBe('good');
      expect(packet.defrostStatus).toBe('idle');
      expect(packet.sdiScore).toBe(100);
      expect(packet.sdiStatus).toBe('optimal');
      expect(packet.anomalies.length).toBe(0);
    });

    it('should correctly identify Thermo King from model or brand name', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 102,
        truckPlate: '67890-B-2',
        model: 'Thermo King SLXi 400 Whisper Pro',
        currentTemp: 4.1,
        targetTemp: 4.0,
        suctionPressureBar: 2.1,
        dischargePressureBar: 15.8,
        backupBatteryVdc: 12.5,
      });

      expect(packet.unitBrand).toBe('thermo_king');
      expect(packet.pressureStatus).toBe('optimal');
      expect(packet.sdiStatus).toBe('optimal');
      expect(packet.sdiScore).toBe(100);
    });
  });

  describe('Refrigerant Pressure & Leak Detection', () => {
    it('should detect refrigerant leak when suction pressure drops below 0.9 Bar', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 103,
        truckPlate: '33445-C-3',
        unitBrand: 'carrier',
        currentTemp: -15.0,
        targetTemp: -18.0,
        suctionPressureBar: 0.65, // Severe drop
        dischargePressureBar: 8.5, // Low discharge
        alarmCodes: ['AL_01'],
      });

      expect(packet.pressureStatus).toBe('critical');
      const leakAnomaly = packet.anomalies.find((a) => a.type === 'refrigerant_leak');
      expect(leakAnomaly).toBeDefined();
      expect(leakAnomaly?.severity).toBe('critical');
      expect(packet.alarms.some((a) => a.code === 'AL_01')).toBe(true);
      expect(packet.sdiScore).toBeLessThan(85);
    });

    it('should compute compression ratio accurately with Decimal.js', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 104,
        suctionPressureBar: 2.0,
        dischargePressureBar: 16.0,
      });

      // 16.0 / 2.0 = 8.0
      expect(packet.compressionRatio).toBe(8.0);
    });
  });

  describe('Defrost Cycle & Overrun Timeout Monitoring', () => {
    it('should flag normal active defrost under 30 minutes', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 105,
        defrostActive: true,
        defrostDurationMin: 18,
        defrostCoilTemp: 6.5,
      });

      expect(packet.defrostActive).toBe(true);
      expect(packet.defrostStatus).toBe('active_normal');
      expect(packet.anomalies.some((a) => a.type === 'defrost_overrun')).toBe(false);
    });

    it('should trigger warning when defrost exceeds 30 minutes', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 106,
        defrostActive: true,
        defrostDurationMin: 35,
        defrostCoilTemp: 9.0,
      });

      expect(packet.defrostStatus).toBe('overrun_warning');
      const overrunAnomaly = packet.anomalies.find((a) => a.type === 'defrost_overrun');
      expect(overrunAnomaly).toBeDefined();
      expect(overrunAnomaly?.severity).toBe('warning');
    });

    it('should trigger critical anomaly when defrost exceeds 45 minutes', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 107,
        defrostActive: true,
        defrostDurationMin: 50,
        alarmCodes: ['AL_64'],
      });

      expect(packet.defrostStatus).toBe('overrun_critical');
      const overrunAnomaly = packet.anomalies.find((a) => a.type === 'defrost_overrun');
      expect(overrunAnomaly).toBeDefined();
      expect(overrunAnomaly?.severity).toBe('critical');
      expect(packet.alarms.some((a) => a.code === 'AL_64')).toBe(true);
    });
  });

  describe('Electrical Battery Voltage Monitoring', () => {
    it('should flag low battery when voltage drops below 11.8V', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 108,
        backupBatteryVdc: 11.5,
      });

      expect(packet.batteryStatus).toBe('low');
      const battAnomaly = packet.anomalies.find((a) => a.type === 'low_battery');
      expect(battAnomaly).toBeDefined();
      expect(battAnomaly?.severity).toBe('warning');
    });

    it('should flag critical battery when voltage drops below 11.2V', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 109,
        backupBatteryVdc: 10.8,
        alarmCodes: ['TK_61'],
      });

      expect(packet.batteryStatus).toBe('critical');
      const battAnomaly = packet.anomalies.find((a) => a.type === 'low_battery');
      expect(battAnomaly).toBeDefined();
      expect(battAnomaly?.severity).toBe('critical');
      expect(packet.sdiScore).toBeLessThan(75);
    });
  });

  describe('Stability Degradation Index (SDI) Calculation', () => {
    it('should compute exact penalties using Decimal.js without floating point errors', () => {
      const result = calculateFrigoSDI({
        tempDeviation: new Decimal(2.5), // 1.5°C excess * 8 = 12 penalty
        suctionPressure: new Decimal(2.0),
        dischargePressure: new Decimal(16.0),
        defrostActive: false,
        defrostDurationMin: 0,
        batteryVdc: new Decimal(12.5),
        operatingMode: 'continuous',
      });

      // 100 - 12 = 88
      expect(result.sdiScore).toBe(88.0);
      expect(result.status).toBe('optimal');
    });

    it('should drop SDI to critical when multiple severe faults accumulate', () => {
      const result = calculateFrigoSDI({
        tempDeviation: new Decimal(5.0), // Excess 4°C * 8 = 32 penalty
        suctionPressure: new Decimal(0.7), // Low pressure = 25 penalty
        dischargePressure: new Decimal(8.5),
        defrostActive: true,
        defrostDurationMin: 48, // Overrun > 45 min = 30 penalty
        batteryVdc: new Decimal(11.0), // Critical battery = 30 penalty
        operatingMode: 'continuous',
      });

      // Total penalties: 32 + 25 + 30 + 30 = 117 -> capped at 0
      expect(result.sdiScore).toBe(0);
      expect(result.status).toBe('critical');
    });
  });

  describe('Alarm Code Catalog & Trilingual Diagnostics', () => {
    it('should include full trilingual descriptions and remedies for Carrier alarms', () => {
      const alarm = REEFER_STANDARD_ALARMS.AL_01;
      expect(alarm.brand).toBe('carrier');
      expect(alarm.severity).toBe('critical');
      expect(alarm.descriptionAr).toContain('انخفاض ضغط السحب');
      expect(alarm.descriptionFr).toContain('Basse pression aspiration');
      expect(alarm.descriptionEs).toContain('Baja presión de aspiración');
      expect(alarm.remedyAr).toBeDefined();
      expect(alarm.remedyFr).toBeDefined();
      expect(alarm.remedyEs).toBeDefined();
    });

    it('should include full trilingual descriptions and remedies for Thermo King alarms', () => {
      const alarm = REEFER_STANDARD_ALARMS.TK_04;
      expect(alarm.brand).toBe('thermo_king');
      expect(alarm.severity).toBe('critical');
      expect(alarm.descriptionAr).toContain('انحراف قراءة حساس حرارة الهواء');
      expect(alarm.descriptionFr).toContain('Dérive capteur température');
      expect(alarm.descriptionEs).toContain('Desviación del sensor');
    });

    it('should gracefully handle unknown alarm codes as technical warning', () => {
      const packet = parseFrigoTelemetryPacket({
        truckId: 110,
        unitBrand: 'thermo_king',
        alarmCodes: ['CUSTOM_999'],
      });

      expect(packet.alarms.length).toBe(1);
      expect(packet.alarms[0].code).toBe('CUSTOM_999');
      expect(packet.alarms[0].severity).toBe('warning');
      expect(packet.alarms[0].descriptionAr).toContain('CUSTOM_999');
    });
  });

  describe('GPS Webhook Normalization with Frigo IoT Attributes', () => {
    it('should extract Frigo IoT properties from nested Traccar attributes', () => {
      const normalized = normalizeGPSPayload({
        truck_id: 201,
        position: {
          latitude: 30.4278,
          longitude: -9.5981,
          speed: 65,
          course: 180,
          accuracy: 5,
          fixTime: '2026-10-08T12:00:00Z',
          attributes: {
            ignition: true,
            temp1: -19.4,
            target_temp: -19.4,
            suction_pressure: 1.88,
            discharge_pressure: 16.4,
            defrost: false,
            battery_v: 12.6,
            reefer_mode: 'continuous',
            unit_brand: 'carrier',
            model: 'Vector 1550',
          },
        },
      });

      expect(normalized.truckId).toBe(201);
      expect(normalized.frigoTemperature).toBe(-19.4);
      expect(normalized.frigoIoT).toBeDefined();
      expect(normalized.frigoIoT?.unitBrand).toBe('carrier');
      expect(normalized.frigoIoT?.suctionPressureBar).toBe(1.88);
      expect(normalized.frigoIoT?.dischargePressureBar).toBe(16.4);
      expect(normalized.frigoIoT?.sdiScore).toBe(100);
      expect(normalized.frigoIoT?.sdiStatus).toBe('optimal');
    });
  });
});
