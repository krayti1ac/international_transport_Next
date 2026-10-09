import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  FuelTelematicsBiService,
  CORRIDOR_DEFAULTS,
} from '../services/fuel-telematics-bi.service';

describe('Fleet Fuel & Telematics BI Analytics Engine (Sahara & EU Corridors)', () => {
  describe('1. Fuel Efficiency & Cost Per Kilometer (CPK) Formulas', () => {
    it('should calculate L/100km accurately with strict Decimal.js precision', () => {
      // 8085 L consumed over 24,500 km = 33.00 L/100km
      const lPer100 = FuelTelematicsBiService.calculateLPer100Km(8085, 24500);
      expect(lPer100).toBe(33.0);

      // Handle zero or negative distance safely without throwing
      expect(FuelTelematicsBiService.calculateLPer100Km(500, 0)).toBe(0);
      expect(FuelTelematicsBiService.calculateLPer100Km(500, -100)).toBe(0);
    });

    it('should calculate Fuel CPK in MAD without floating point drift', () => {
      // 109,147.50 MAD over 24,500 km = 4.455 MAD/km
      const cpk = FuelTelematicsBiService.calculateFuelCpk(109147.5, 24500);
      expect(cpk).toBe(4.455);

      expect(FuelTelematicsBiService.calculateFuelCpk(1000, 0)).toBe(0);
    });
  });

  describe('2. Driver Eco-Driving Score & Behavioral Deductions', () => {
    it('should award 100 points and Elite (A+) tier to a driver with zero violations', () => {
      const driver = FuelTelematicsBiService.calculateDriverEcoScore({
        driverId: 1,
        driverName: 'Ahmed Benali',
        totalDistanceKm: 5000,
        totalFuelLiters: 1650, // 33.0 L/100km (under baseline 33.5)
        fuelCostMad: 22275,
        baselineLPer100Km: 33.5,
        overspeedCount: 0,
        hardAccelerationCount: 0,
        hardBrakingCount: 0,
        excessiveIdleHours: 0,
      });

      expect(driver.score).toBe(100);
      expect(driver.tier).toBe('elite');
      expect(driver.actualLPer100Km).toBe(33.0);
      expect(driver.deductions.overspeed).toBe(0);
      expect(driver.deductions.variance).toBe(0);
    });

    it('should apply accurate point deductions for telematics violations', () => {
      // 2 overspeed (-6), 3 hard accel (-6), 1 hard brake (-2) = total -14 -> score = 86 (Optimal A)
      const driver = FuelTelematicsBiService.calculateDriverEcoScore({
        driverId: 2,
        driverName: 'Mohamed Amrani',
        totalDistanceKm: 4000,
        totalFuelLiters: 1320, // 33.0 L/100km
        fuelCostMad: 17820,
        baselineLPer100Km: 33.5,
        overspeedCount: 2,
        hardAccelerationCount: 3,
        hardBrakingCount: 1,
      });

      expect(driver.deductions.overspeed).toBe(6);
      expect(driver.deductions.acceleration).toBe(6);
      expect(driver.deductions.braking).toBe(2);
      expect(driver.score).toBe(86);
      expect(driver.tier).toBe('optimal');
    });

    it('should penalize excess fuel consumption (> 5% above corridor baseline)', () => {
      // Baseline 32.5, Actual 38.0 (+16.9% variance)
      // excess = 11.9% -> deduction = round(11.9 * 1.5) = 18 clamped to max 15
      const driver = FuelTelematicsBiService.calculateDriverEcoScore({
        driverId: 3,
        driverName: 'High Burn Driver',
        totalDistanceKm: 1000,
        totalFuelLiters: 380, // 38.0 L/100km
        fuelCostMad: 5130,
        baselineLPer100Km: 32.5,
        overspeedCount: 4, // -12
        hardAccelerationCount: 3, // -6
        hardBrakingCount: 2, // -4
      });

      expect(driver.deductions.variance).toBe(15); // Max variance deduction
      expect(driver.score).toBe(100 - (12 + 6 + 4 + 15)); // 63
      expect(driver.tier).toBe('under_review');
    });

    it('should clamp scores strictly between 0 and 100', () => {
      const terribleDriver = FuelTelematicsBiService.calculateDriverEcoScore({
        driverId: 4,
        driverName: 'Reckless Driver',
        totalDistanceKm: 1000,
        totalFuelLiters: 500,
        fuelCostMad: 6750,
        baselineLPer100Km: 30.0,
        overspeedCount: 40, // -120 pts
      });

      expect(terribleDriver.score).toBe(0);
      expect(terribleDriver.tier).toBe('under_review');
    });
  });

  describe('3. Strategic Corridors Benchmarking (Sahara vs EU)', () => {
    it('should evaluate corridor variances and assign statuses', () => {
      const trips = [
        {
          corridorCode: 'MA-ES-FR',
          corridorName: 'European Corridor',
          distanceKm: 10000,
          fuelLiters: 3200, // 32.0 L/100km vs baseline 32.5 (-1.54% variance)
          fuelCostMad: 43200,
        },
        {
          corridorCode: 'MA-MR-SN',
          corridorName: 'Sahara Corridor',
          distanceKm: 10000,
          fuelLiters: 4000, // 40.0 L/100km vs baseline 35.8 (+11.73% variance)
          fuelCostMad: 54000,
        },
      ];

      const benchmarks = FuelTelematicsBiService.evaluateCorridors(trips);

      expect(benchmarks.length).toBe(2);

      const eu = benchmarks.find((b) => b.corridorCode === 'MA-ES-FR');
      expect(eu).toBeDefined();
      expect(eu?.actualLPer100Km).toBe(32.0);
      expect(eu?.status).toBe('optimal');

      const sahara = benchmarks.find((b) => b.corridorCode === 'MA-MR-SN');
      expect(sahara).toBeDefined();
      expect(sahara?.actualLPer100Km).toBe(40.0);
      expect(sahara?.variancePct).toBeGreaterThan(8);
      expect(sahara?.status).toBe('high_burn');
    });
  });

  describe('4. Geo Fuel Clusters & Threat Hotspot Mapping', () => {
    it('should aggregate legitimate stations and classify theft risk levels', () => {
      const stations = [
        {
          id: 1,
          stationName: 'Afriquia Tanger Med',
          city: 'Tanger',
          latitude: 35.88,
          longitude: -5.5,
          liters: 10000,
          totalCostMad: 135000,
          date: '2026-10-08',
        },
      ];

      const thefts = [
        {
          id: 'th-1',
          locationName: 'Berrechid Rest Stop',
          latitude: 33.26,
          longitude: -7.58,
          lossLiters: 95, // >= 80 L -> critical
          lossMad: 1330,
          createdAt: '2026-10-08T03:00:00Z',
        },
        {
          id: 'th-2',
          locationName: 'Larache Exit',
          latitude: 35.18,
          longitude: -6.15,
          lossLiters: 25, // < 30 L -> medium
          lossMad: 350,
          createdAt: '2026-10-06T01:00:00Z',
        },
      ];

      const clusters = FuelTelematicsBiService.clusterGeoLocations(stations, thefts);

      expect(clusters.length).toBe(3);

      const st = clusters.find((c) => c.type === 'refuel_station');
      expect(st?.riskLevel).toBe('low');
      expect(st?.totalVolumeLiters).toBe(10000);

      const th1 = clusters.find((c) => c.id === 'theft_th-1');
      expect(th1?.riskLevel).toBe('critical');

      const th2 = clusters.find((c) => c.id === 'theft_th-2');
      expect(th2?.riskLevel).toBe('medium');
    });
  });

  describe('5. Fleet BI Summary Aggregation & Leaderboard Ranking', () => {
    it('should rank drivers in order of Eco-Score and calculate fleet averages', () => {
      const drivers = [
        {
          driverId: 10,
          driverName: 'Driver Ten',
          totalDistanceKm: 2000,
          totalFuelLiters: 700,
          fuelCostMad: 9450,
          overspeedCount: 5, // Score lower
        },
        {
          driverId: 20,
          driverName: 'Driver Twenty (Pro)',
          totalDistanceKm: 2000,
          totalFuelLiters: 650,
          fuelCostMad: 8775,
          overspeedCount: 0, // Score 100
        },
      ];

      const summary = FuelTelematicsBiService.generateFleetBiSummary({
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        driversTelemetry: drivers,
        corridorsTrips: [],
        fuelStations: [],
        theftIncidents: [
          {
            id: 1,
            latitude: 33.0,
            longitude: -7.0,
            lossLiters: 50,
            lossMad: 700,
            createdAt: '2026-10-05',
          },
        ],
        activeVehiclesCount: 2,
      });

      expect(summary.totalDistanceKm).toBe(4000);
      expect(summary.totalFuelConsumedLiters).toBe(1350);
      expect(summary.preventedTheftLossMad).toBe(700);

      // Leaderboard ranking
      expect(summary.driverRankings[0].driverId).toBe(20);
      expect(summary.driverRankings[0].rank).toBe(1);
      expect(summary.driverRankings[1].driverId).toBe(10);
      expect(summary.driverRankings[1].rank).toBe(2);
    });
  });
});

