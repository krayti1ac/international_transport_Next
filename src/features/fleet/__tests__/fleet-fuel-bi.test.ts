import { describe, it, expect } from 'vitest';
import { FleetFuelAnalyticsService } from '../services/fleet-fuel-analytics.service';

describe('Fleet Fuel & Telematics BI Analytics Engine (Track B)', () => {
  describe('1. Tractor vs. Reefer Auxiliary Engine Fuel Split (Decimal.js)', () => {
    it('separates primary tractor fuel from Thermo King / Carrier Transicold reefer burn with strict Decimal precision', () => {
      // Total fuel: 948.40 L over a trip where Thermo King ran 48 hours at 3.05 L/h = 146.40 L
      // Expected Tractor fuel = 948.40 - 146.40 = 802.00 L
      const split = FleetFuelAnalyticsService.calculateTractorReeferSplit({
        totalFuelLiters: '948.40',
        isReeferTrip: true,
        reeferBrand: 'thermo_king',
        reeferOperatingHours: '48.00',
        reeferBurnRateLPerHour: '3.05',
        reeferBaselineLPerHour: '3.20',
      });

      expect(split.reeferLiters).toBe('146.40');
      expect(split.tractorLiters).toBe('802.00');
      expect(split.totalLiters).toBe('948.40');
      expect(split.tractorSharePct).toBe('84.56');
      expect(split.reeferSharePct).toBe('15.44');
      expect(split.reeferBrand).toBe('thermo_king');
    });

    it('allocates 100% of fuel to tractor engine for non-reefer dry cargo trips', () => {
      const split = FleetFuelAnalyticsService.calculateTractorReeferSplit({
        totalFuelLiters: '650.00',
        isReeferTrip: false,
      });

      expect(split.tractorLiters).toBe('650.00');
      expect(split.reeferLiters).toBe('0.00');
      expect(split.tractorSharePct).toBe('100.00');
      expect(split.reeferSharePct).toBe('0.00');
      expect(split.reeferBrand).toBe('none');
    });
  });

  describe('2. CAN-Bus Odometer & Fuel Efficiency Evaluation (CPK MAD/EUR & Savings/Waste)', () => {
    it('calculates tractor L/100km, CPK in MAD/EUR, and positive financial savings when burning below baseline', () => {
      // Distance: 2640 km, Baseline: 32.50 L/100km => Expected Tractor Liters = 858.00 L
      // Total CAN-Bus Liters = 948.40 L, Reefer = 146.40 L => Actual Tractor Liters = 802.00 L (30.38 L/100km)
      // Saved Liters = 858.00 - 802.00 = 56.00 L * 13.20 MAD/L = +739.20 MAD savings
      const row = FleetFuelAnalyticsService.evaluateTruckDriverEfficiency({
        truckId: 101,
        plateNumber: '48291-A-1',
        truckModel: 'Volvo FH16 540',
        driverId: 201,
        driverName: 'Youssef Ait Baha',
        corridorCode: 'MA-ES-FR',
        corridorName: 'Europe Corridor',
        isReeferTrip: true,
        reeferBrand: 'thermo_king',
        odometerDistanceKm: '2640.00',
        canBusTotalFuelLiters: '948.40',
        ocrReceiptsTotalLiters: '948.40',
        reeferOperatingHours: '48.00',
        reeferBurnRateLPerHour: '3.05',
        baselineLPer100Km: '32.50',
        fuelCostMad: '5280.00',
        fuelCostEur: '680.00', // 680 * 10.85 = 7378.00 MAD => Total = 12658.00 MAD
        exchangeRateEurToMad: '10.85',
        averageDieselPriceMad: '13.20',
      });

      expect(row.actualTractorLPer100Km).toBe('30.38');
      expect(row.combinedLPer100Km).toBe('35.92');
      expect(row.varianceLPer100Km).toBe('-2.12');
      expect(row.totalCostMad).toBe('12658.00');
      expect(row.costPerKmMad).toBe('4.795');
      expect(row.costPerKmEur).toBe('0.442');
      expect(row.financialSavingsOrWasteMad).toBe('739.20');
      expect(row.grade).toBe('A+');
    });
  });

  describe('3. Forensic OCR Receipt vs. GPS Coordinates & CAN-Bus Tank Level Verification', () => {
    it('flags gps_station_mismatch when truck GPS is far from gas station coordinates at refuel time', () => {
      const alert = FleetFuelAnalyticsService.auditOcrFuelReceiptAgainstTelematics({
        receiptId: 'REC-001',
        truckId: 103,
        plateNumber: '19540-D-40',
        driverId: 203,
        driverName: 'Said Bouazzaoui',
        stationName: 'Petrom Larache Autoroute',
        currency: 'MAD',
        receiptLiters: '450.00',
        receiptTotalAmount: '5940.00',
        receiptTimestamp: '2026-10-14T22:15:00Z',
        stationLat: 35.1833,
        stationLng: -6.15,
        truckGpsLat: 35.0211, // ~18.5 km away
        truckGpsLng: -6.1985,
        truckGpsTimestamp: '2026-10-14T22:18:00Z',
        canBusTankLevelBeforeLiters: '180.00',
        canBusTankLevelAfterLiters: '585.00', // 405 L observed vs 450 L claimed (45 L gap)
        tankCapacityLiters: '1100.00',
        ocrConfidenceScore: 95,
      });

      expect(alert).not.toBeNull();
      expect(alert?.anomalyType).toBe('gps_station_mismatch');
      expect(alert?.severity).toBe('critical');
      expect(Number(alert?.gpsDistanceDeviationKm)).toBeGreaterThan(15);
      expect(alert?.discrepancyLiters).toBe('45.00');
      expect(alert?.financialImpactMad).toBe('594.00'); // 45 L * 13.20 MAD/L
    });

    it('flags consumption_variance when OCR receipt liters exceed CAN-Bus tank level rise by > 15L at matching GPS', () => {
      const alert = FleetFuelAnalyticsService.auditOcrFuelReceiptAgainstTelematics({
        receiptId: 'REC-002',
        truckId: 102,
        plateNumber: '71904-B-33',
        driverId: 202,
        driverName: 'Abderrahim Mansouri',
        stationName: 'Afriquia Guerguerat',
        currency: 'MAD',
        receiptLiters: '620.00',
        receiptTotalAmount: '8184.00',
        receiptTimestamp: '2026-10-13T14:40:00Z',
        stationLat: 21.4332,
        stationLng: -16.9622,
        truckGpsLat: 21.4334,
        truckGpsLng: -16.9623,
        truckGpsTimestamp: '2026-10-13T14:41:00Z',
        canBusTankLevelBeforeLiters: '210.00',
        canBusTankLevelAfterLiters: '765.00', // 555 L observed => 65 L missing
        tankCapacityLiters: '1200.00',
        ocrConfidenceScore: 92,
      });

      expect(alert).not.toBeNull();
      expect(alert?.anomalyType).toBe('consumption_variance');
      expect(alert?.severity).toBe('critical');
      expect(alert?.discrepancyLiters).toBe('65.00');
      expect(alert?.financialImpactMad).toBe('858.00'); // 65 L * 13.20 MAD
    });

    it('flags manual_ocr_review when OCR confidence is below 75%', () => {
      const alert = FleetFuelAnalyticsService.auditOcrFuelReceiptAgainstTelematics({
        receiptId: 'REC-003',
        truckId: 101,
        plateNumber: '48291-A-1',
        driverId: 201,
        driverName: 'Youssef Ait Baha',
        stationName: 'Repsol Algeciras',
        currency: 'EUR',
        exchangeRateToMad: '10.85',
        receiptLiters: '480.00',
        receiptTotalAmount: '696.00',
        receiptTimestamp: '2026-10-15T09:10:00Z',
        stationLat: 36.1408,
        stationLng: -5.4562,
        truckGpsLat: 36.1409,
        truckGpsLng: -5.4561,
        truckGpsTimestamp: '2026-10-15T09:11:00Z',
        canBusTankLevelBeforeLiters: '300.00',
        canBusTankLevelAfterLiters: '779.00',
        tankCapacityLiters: '1200.00',
        ocrConfidenceScore: 64,
      });

      expect(alert).not.toBeNull();
      expect(alert?.anomalyType).toBe('manual_ocr_review');
      expect(alert?.financialImpactMad).toBe('7551.60'); // 696 EUR * 10.85
    });

    it('returns null when GPS matches, CAN-Bus tank level matches OCR, and OCR confidence is high', () => {
      const alert = FleetFuelAnalyticsService.auditOcrFuelReceiptAgainstTelematics({
        receiptId: 'REC-CLEAN',
        truckId: 101,
        plateNumber: '48291-A-1',
        driverId: 201,
        driverName: 'Youssef Ait Baha',
        stationName: 'TotalEnergies Tanger Med',
        currency: 'MAD',
        receiptLiters: '500.00',
        receiptTotalAmount: '6600.00',
        receiptTimestamp: '2026-10-15T12:00:00Z',
        stationLat: 35.8856,
        stationLng: -5.5034,
        truckGpsLat: 35.8858,
        truckGpsLng: -5.5035,
        truckGpsTimestamp: '2026-10-15T12:02:00Z',
        canBusTankLevelBeforeLiters: '200.00',
        canBusTankLevelAfterLiters: '696.00', // Within 4L tolerance
        tankCapacityLiters: '1200.00',
        ocrConfidenceScore: 96,
      });

      expect(alert).toBeNull();
    });
  });

  describe('4. Multi-Currency Breakdown & Full Fleet BI Dashboard Aggregation', () => {
    it('builds complete dashboard summary with leaderboard rankings, MAD/EUR shares, and anomaly counts', () => {
      const dashboard = FleetFuelAnalyticsService.buildFleetFuelBiDashboard({
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        exchangeRateEurToMad: '10.85',
        truckTrips: [
          {
            truckId: 101,
            plateNumber: '48291-A-1',
            truckModel: 'Volvo FH16',
            driverId: 201,
            driverName: 'Youssef Ait Baha',
            corridorCode: 'MA-ES-FR',
            corridorName: 'Europe Corridor',
            isReeferTrip: true,
            reeferBrand: 'thermo_king',
            odometerDistanceKm: '2640.00',
            canBusTotalFuelLiters: '948.40',
            ocrReceiptsTotalLiters: '948.40',
            reeferOperatingHours: '48.00',
            reeferBurnRateLPerHour: '3.05',
            baselineLPer100Km: '32.50',
            fuelCostMad: '5280.00',
            fuelCostEur: '680.00',
          },
          {
            truckId: 103,
            plateNumber: '19540-D-40',
            truckModel: 'Actros MP5',
            driverId: 203,
            driverName: 'Said Bouazzaoui',
            corridorCode: 'DOMESTIC-MA',
            corridorName: 'Domestic Corridor',
            isReeferTrip: false,
            odometerDistanceKm: '1000.00',
            canBusTotalFuelLiters: '360.00',
            ocrReceiptsTotalLiters: '390.00',
            baselineLPer100Km: '32.00',
            fuelCostMad: '4752.00',
            fuelCostEur: '0.00',
          },
        ],
        receiptAudits: [],
      });

      expect(dashboard.activeTrucksCount).toBe(2);
      expect(dashboard.totalDistanceKm).toBe('3640.00');
      expect(dashboard.totalFuelLiters).toBe('1308.40');
      expect(dashboard.totalReeferLiters).toBe('146.40');
      expect(dashboard.totalTractorLiters).toBe('1162.00');
      expect(dashboard.leaderboard[0].truckId).toBe(101);
      expect(dashboard.leaderboard[0].rank).toBe(1);
      expect(dashboard.leaderboard[1].rank).toBe(2);
      expect(dashboard.currencyBreakdown.eurTotalCostInEur).toBe('680.00');
      expect(dashboard.currencyBreakdown.eurTotalCostInMad).toBe('7378.00');
    });
  });
});

