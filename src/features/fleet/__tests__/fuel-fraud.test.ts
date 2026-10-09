import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  AntiSiphoningDetectorService,
  calculateHaversineDistanceKm,
} from '../services/anti-siphoning-detector.service';
import type {
  AntiSiphoningDetectionInput,
  TelematicsFuelDataPoint,
  FuelReceiptData,
  TruckFuelConfig,
} from '../types/fuel-fraud.types';

describe('Intelligent Fuel Fraud & Anti-Siphoning Detection Engine', () => {
  const baseTruckConfig: TruckFuelConfig = {
    truckId: 501,
    plateNumber: '72819-B-26',
    tankCapacityLiters: 800,
    standardRateL100km: 33.0,
    fuelPricePerLiterMad: 14.2,
  };

  describe('1. Great-Circle Haversine Distance', () => {
    it('calculates geographic distance accurately between two GPS points', () => {
      // Tanger Med (35.885, -5.505) to Larache A1 (35.195, -6.155)
      const distKm = calculateHaversineDistanceKm(35.885, -5.505, 35.195, -6.155);
      expect(distKm).toBeGreaterThan(90);
      expect(distKm).toBeLessThan(105);
    });

    it('returns zero or negligible distance for identical or adjacent points', () => {
      const distKm = calculateHaversineDistanceKm(33.5731, -7.5898, 33.5731, -7.5898);
      expect(distKm).toBe(0);
    });
  });

  describe('2. Anti-Siphoning Trigger (Rapid Fuel Drop in Stationary / Engine OFF)', () => {
    it('detects illegal fuel siphoning when fuel drops > 15L within 10 min while stationary', () => {
      const now = Date.now();
      const dataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: new Date(now - 8 * 60 * 1000).toISOString(),
          fuelLevelLiters: 500,
          speedKmh: 0,
          engineStatus: 'OFF',
          latitude: 35.73,
          longitude: -5.82,
        },
        // 35 Liters drained in 5 minutes with engine OFF
        {
          timestamp: new Date(now - 3 * 60 * 1000).toISOString(),
          fuelLevelLiters: 465,
          speedKmh: 0,
          engineStatus: 'OFF',
          latitude: 35.73,
          longitude: -5.82,
        },
      ];

      const input: AntiSiphoningDetectionInput = {
        truckConfig: baseTruckConfig,
        dataPoints,
      };

      const result = AntiSiphoningDetectorService.analyzeFuelFraud(input);

      expect(result.isClean).toBe(false);
      expect(result.incidents.length).toBe(1);

      const siphoning = result.incidents[0];
      expect(siphoning.incidentType).toBe('rapid_siphoning');
      expect(siphoning.detectedLossLiters).toBe(35);
      expect(siphoning.financialLossMad).toBe(
        Number(new Decimal(35).times(14.2).toFixed(2))
      );
      expect(siphoning.confidenceScore).toBeGreaterThanOrEqual(90);
      expect(result.receiptsLegitimacyScore).toBeLessThan(100);
    });

    it('flags siphoning as critical severity when drop exceeds 50 Liters', () => {
      const now = Date.now();
      const dataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: new Date(now - 6 * 60 * 1000).toISOString(),
          fuelLevelLiters: 600,
          speedKmh: 0,
          engineStatus: 'OFF',
        },
        {
          timestamp: new Date(now - 1 * 60 * 1000).toISOString(),
          fuelLevelLiters: 520, // 80 Liters drained!
          speedKmh: 0,
          engineStatus: 'OFF',
        },
      ];

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig,
        dataPoints,
      });

      expect(result.incidents[0].incidentType).toBe('rapid_siphoning');
      expect(result.incidents[0].severity).toBe('critical');
      expect(result.incidents[0].detectedLossLiters).toBe(80);
    });

    it('does NOT flag legitimate highway fuel burn when truck is in motion at highway speed', () => {
      const now = Date.now();
      const dataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: new Date(now - 9 * 60 * 1000).toISOString(),
          fuelLevelLiters: 500,
          speedKmh: 85,
          engineStatus: 'ON',
        },
        {
          timestamp: new Date(now - 1 * 60 * 1000).toISOString(),
          fuelLevelLiters: 480, // 20L burned over 12km at high speed with heavy load
          speedKmh: 82,
          engineStatus: 'ON',
        },
      ];

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig,
        dataPoints,
      });

      const siphoning = result.incidents.find((i) => i.incidentType === 'rapid_siphoning');
      expect(siphoning).toBeUndefined();
    });
  });

  describe('3. Tank Capacity Overflow Guard', () => {
    it('detects ghost overfilling when receipt volume exceeds truck physical tank capacity', () => {
      const receipt: FuelReceiptData = {
        receiptId: 'REC-001',
        liters: 950, // Tank capacity is 800L
        unitPrice: 14.5,
        totalAmount: 13775,
        currency: 'MAD',
        stationName: 'Afriquia Tanger Ville',
        timestamp: new Date().toISOString(),
      };

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig, // capacity: 800
        dataPoints: [],
        receipts: [receipt],
      });

      expect(result.isClean).toBe(false);
      const overflow = result.incidents.find((i) => i.incidentType === 'tank_overflow');
      expect(overflow).toBeDefined();
      expect(overflow?.severity).toBe('critical');
      expect(overflow?.detectedLossLiters).toBe(150); // 950 - 800 = 150
      expect(overflow?.financialLossMad).toBe(
        Number(new Decimal(150).times(14.5).toFixed(2))
      );
    });
  });

  describe('4. Ghost Refueling & Inflow Inflation Guard', () => {
    it('flags receipt when no fuel inflow at all entered the truck tank in telematics window', () => {
      const now = Date.now();
      const receiptTime = new Date(now).toISOString();

      const receipt: FuelReceiptData = {
        receiptId: 'REC-GHOST-1',
        liters: 300,
        unitPrice: 14.0,
        totalAmount: 4200,
        currency: 'MAD',
        stationName: 'TotalEnergies Kenitra',
        timestamp: receiptTime,
      };

      // Telemetry shows constant 200L (no fuel added)
      const dataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
          fuelLevelLiters: 200,
          speedKmh: 0,
          engineStatus: 'OFF',
        },
        {
          timestamp: new Date(now + 10 * 60 * 1000).toISOString(),
          fuelLevelLiters: 200,
          speedKmh: 0,
          engineStatus: 'OFF',
        },
      ];

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig,
        dataPoints,
        receipts: [receipt],
      });

      const ghost = result.incidents.find((i) => i.incidentType === 'ghost_refueling');
      expect(ghost).toBeDefined();
      expect(ghost?.severity).toBe('critical');
      expect(ghost?.detectedLossLiters).toBe(300);
      expect(ghost?.financialLossMad).toBe(4200);
    });

    it('flags receipt inflation when billed liters exceed actual sensor inflow by > 12%', () => {
      const now = Date.now();
      const receiptTime = new Date(now).toISOString();

      const receipt: FuelReceiptData = {
        receiptId: 'REC-INFLATED-2',
        liters: 500, // Billed 500L
        unitPrice: 14.0,
        totalAmount: 7000,
        currency: 'MAD',
        stationName: 'Shell Casablanca Ain Sebaa',
        timestamp: receiptTime,
      };

      // Telemetry shows only 350L entered tank (discrepancy 150L = 30% > 12%)
      const dataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
          fuelLevelLiters: 100,
          speedKmh: 0,
          engineStatus: 'OFF',
        },
        {
          timestamp: new Date(now + 5 * 60 * 1000).toISOString(),
          fuelLevelLiters: 450, // Inflow: 450 - 100 = 350L
          speedKmh: 0,
          engineStatus: 'OFF',
        },
      ];

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig,
        dataPoints,
        receipts: [receipt],
      });

      const inflated = result.incidents.find((i) => i.incidentType === 'ghost_refueling');
      expect(inflated).toBeDefined();
      expect(inflated?.severity).toBe('high');
      expect(inflated?.detectedLossLiters).toBe(150); // 500 - 350 = 150
      expect(inflated?.financialLossMad).toBe(2100); // 150 * 14.0
    });
  });

  describe('5. Geofence Distance Mismatch Guard (> 500m)', () => {
    it('flags receipt when distance between truck and billed station exceeds 500 meters', () => {
      const now = Date.now();
      const receiptTime = new Date(now).toISOString();

      const receipt: FuelReceiptData = {
        receiptId: 'REC-GEO-01',
        liters: 250,
        unitPrice: 14.2,
        totalAmount: 3550,
        currency: 'MAD',
        stationName: 'Afriquia Tanger Med Port',
        stationLatitude: 35.885,
        stationLongitude: -5.505,
        timestamp: receiptTime,
      };

      // Truck actual location was in Larache (35.195, -6.155) ~ 95 km away
      const dataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: receiptTime,
          fuelLevelLiters: 400,
          speedKmh: 0,
          engineStatus: 'OFF',
          latitude: 35.195,
          longitude: -6.155,
        },
      ];

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig,
        dataPoints,
        receipts: [receipt],
      });

      const geofence = result.incidents.find((i) => i.incidentType === 'geofence_mismatch');
      expect(geofence).toBeDefined();
      expect(geofence?.severity).toBe('critical'); // > 5km is critical
      expect(geofence?.detectedLossLiters).toBe(250);
      expect(geofence?.financialLossMad).toBe(3550);
    });

    it('does NOT flag geofence mismatch when truck is genuinely at the station (< 500m)', () => {
      const now = Date.now();
      const receiptTime = new Date(now).toISOString();

      const receipt: FuelReceiptData = {
        receiptId: 'REC-CLEAN-01',
        liters: 200,
        unitPrice: 14.2,
        totalAmount: 2840,
        currency: 'MAD',
        stationName: 'Afriquia Tanger Med Port',
        stationLatitude: 35.885,
        stationLongitude: -5.505,
        timestamp: receiptTime,
      };

      // Truck is 150 meters away at the truck pumps
      const dataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
          fuelLevelLiters: 200,
          speedKmh: 0,
          engineStatus: 'OFF',
          latitude: 35.884,
          longitude: -5.506,
        },
        {
          timestamp: new Date(now + 5 * 60 * 1000).toISOString(),
          fuelLevelLiters: 400, // 200L inflow matches receipt
          speedKmh: 0,
          engineStatus: 'OFF',
          latitude: 35.884,
          longitude: -5.506,
        },
      ];

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig,
        dataPoints,
        receipts: [receipt],
      });

      expect(result.isClean).toBe(true);
      expect(result.incidents.length).toBe(0);
      expect(result.receiptsLegitimacyScore).toBe(100);
      expect(result.overallRiskScore).toBe(0);
    });
  });

  describe('6. Full Legitimate Trip Scenario', () => {
    it('returns perfect 100% score and clean status for compliant fuel activity', () => {
      const now = Date.now();
      const cleanDataPoints: TelematicsFuelDataPoint[] = [
        {
          timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
          fuelLevelLiters: 500,
          speedKmh: 80,
          engineStatus: 'ON',
          odometerKm: 120000,
        },
        {
          timestamp: new Date(now - 30 * 60 * 1000).toISOString(),
          fuelLevelLiters: 485,
          speedKmh: 80,
          engineStatus: 'ON',
          odometerKm: 120050,
        },
      ];

      const result = AntiSiphoningDetectorService.analyzeFuelFraud({
        truckConfig: baseTruckConfig,
        dataPoints: cleanDataPoints,
      });

      expect(result.isClean).toBe(true);
      expect(result.overallRiskScore).toBe(0);
      expect(result.receiptsLegitimacyScore).toBe(100);
      expect(result.totalLossLiters).toBe(0);
      expect(result.totalLossMad).toBe(0);
    });
  });
});

