import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeCorridorPnl,
  convertToMad,
  resolveCorridor,
  type RawPnlTripOrder,
  type RawPnlMaintenanceExpense,
  DEFAULT_CURRENCY_RATES,
} from '../services/corridor-pnl-calculator.service';

describe('Corridor P&L, CPK & Intelligence Engine (Strict Decimal.js)', () => {
  it('should accurately convert currencies to MAD without floating-point errors', () => {
    // EUR conversion: 1,000 EUR * 10.85 = 10,850 MAD
    const eurMad = convertToMad(1000, 'EUR', DEFAULT_CURRENCY_RATES);
    expect(eurMad.toString()).toBe('10850');

    // MRU conversion: 40,000 MRU * 0.25 = 10,000 MAD
    const mruMad = convertToMad(40000, 'MRU', DEFAULT_CURRENCY_RATES);
    expect(mruMad.toString()).toBe('10000');

    // XOF conversion: 1,000,000 XOF * 0.0165 = 16,500 MAD
    const xofMad = convertToMad(1000000, 'XOF', DEFAULT_CURRENCY_RATES);
    expect(xofMad.toString()).toBe('16500');

    // Base MAD returns identical
    const baseMad = convertToMad(45000, 'MAD', DEFAULT_CURRENCY_RATES);
    expect(baseMad.toString()).toBe('45000');
  });

  it('should resolve international corridor types based on route keywords', () => {
    expect(
      resolveCorridor({
        id: 1,
        company_id: 1,
        route: 'Agadir ➔ Guerguerat ➔ Dakar',
      } as RawPnlTripOrder)
    ).toBe('african_overland');

    expect(
      resolveCorridor({
        id: 2,
        company_id: 1,
        route: 'Tanger Med ➔ Algeciras ➔ Valencia',
      } as RawPnlTripOrder)
    ).toBe('european_maritime');

    expect(
      resolveCorridor({
        id: 3,
        company_id: 1,
        route: 'Casablanca ➔ Nouakchott Port',
      } as RawPnlTripOrder)
    ).toBe('african_overland');
  });

  it('should compute African Overland flagship Trip #272 with exact CPK and P&L metrics', () => {
    const mockTrip272: RawPnlTripOrder = {
      id: 272,
      company_id: 1,
      client_id: 114,
      truck_id: 62,
      driver_id: 57,
      route: 'أكادير (أنزا) ➔ معبر الكركارات ➔ دكار (مول 2)',
      price: 45000,
      price_export: 45000,
      price_import: 0,
      currency: 'MAD',
      departure_date: '2026-09-21',
      status: 'delivered',
      created_at: '2026-09-21T10:00:00Z',
      cmr_number: 'CMR-BK-2026-0042',
      road_distance_km: 2800,
      ferry_distance_km: 0,
      corridor_type: 'african_overland',
      ferry_cost: 3200, // River ferry Rosso
      weight: 24000, // 24 tons
      trucks: {
        id: 62,
        plate_number: '10101-أ-40',
        model: 'Volvo FH 500 Frigo',
        fuel_consumption_rate: 36.0,
      },
      drivers: {
        id: 57,
        name: 'عبد الكريم الخمليشي',
      },
    };

    const result = computeCorridorPnl([mockTrip272]);

    expect(result.africanOverland.totalTrips).toBe(1);
    expect(result.africanOverland.totalRevenueMad).toBe(45000.0);
    expect(result.africanOverland.totalKm).toBe(2800.0);

    // Fuel: 2800 km / 100 * 36 L/100km * 12.50 MAD = 12,600.00 MAD
    // Maintenance: 2800 km * 1.40 MAD/km = 3,920.00 MAD
    // River Ferry (Rosso): 3,200.00 MAD
    // Customs (Guerguerat): 2,500.00 MAD
    // Driver Mission Allowance: 6,500.00 MAD
    // ECOWAS Carte Brune & Insurance: 1,800.00 MAD
    // Total Operating Costs = 12600 + 3920 + 3200 + 2500 + 6500 + 1800 = 30,520.00 MAD
    expect(result.africanOverland.totalOperatingCostsMad).toBe(30520.0);

    // Net Profit = 45,000 - 30,520 = 14,480.00 MAD
    expect(result.africanOverland.netProfitMad).toBe(14480.0);

    // Net Margin % = (14480 / 45000) * 100 = 32.18%
    expect(result.africanOverland.netMarginPercent).toBe(32.18);

    // Total CPK = 30520 / 2800 = 10.90 MAD/km
    expect(result.africanOverland.costPerKmMad).toBe(10.9);

    // Total RPK = 45000 / 2800 = 16.07 MAD/km
    expect(result.africanOverland.revenuePerKmMad).toBe(16.07);

    // Net Profit Per KM (PPK) = 14480 / 2800 = 5.17 MAD/km
    expect(result.africanOverland.netProfitPerKmMad).toBe(5.17);

    // CPK Breakdown checks
    expect(result.africanOverland.cpkBreakdown.fuelCpk).toBe(4.5); // 12600 / 2800
    expect(result.africanOverland.cpkBreakdown.maintenanceCpk).toBe(1.4); // 3920 / 2800
    expect(result.africanOverland.cpkBreakdown.ferryTransitCpk).toBe(1.14); // 3200 / 2800
    expect(result.africanOverland.cpkBreakdown.customsCpk).toBe(0.89); // 2500 / 2800
    expect(result.africanOverland.cpkBreakdown.driverAllowanceCpk).toBe(2.32); // 6500 / 2800
    expect(result.africanOverland.cpkBreakdown.otherCpk).toBe(0.64); // 1800 / 2800

    // Ton-KM Checks: 24 tons * 2800 km = 67,200 t·km
    expect(result.africanOverland.totalTonKm).toBe(67200.0);
    // Cost per t·km: 30520 / 67200 = 0.45 MAD / t·km
    expect(result.africanOverland.costPerTonKmMad).toBe(0.45);
    // Revenue per t·km: 45000 / 67200 = 0.67 MAD / t·km
    expect(result.africanOverland.revenuePerTonKmMad).toBe(0.67);

    // Flagship Trip #272 Benchmark Recognition
    expect(result.benchmarkTrip272).toBeDefined();
    expect(result.benchmarkTrip272?.id).toBe(272);
    expect(result.benchmarkTrip272?.isBenchmarkTrip).toBe(true);
    expect(result.benchmarkTrip272?.cmrNumber).toBe('CMR-BK-2026-0042');
  });

  it('should compute European Maritime trip P&L with port and ferry parameters', () => {
    const mockEuroTrip: RawPnlTripOrder = {
      id: 201,
      company_id: 1,
      client_id: 101,
      truck_id: 61,
      driver_id: 56,
      route: 'Tanger Med ➔ Algeciras ➔ Perpignan',
      price: 52000,
      currency: 'MAD',
      departure_date: '2026-09-15',
      status: 'completed',
      created_at: '2026-09-15T08:00:00Z',
      cmr_number: 'CMR-EUR-2026-0101',
      road_distance_km: 1850,
      ferry_distance_km: 220,
      corridor_type: 'european_maritime',
      ferry_cost: 4500,
      triptik_cost: 500,
      transit_almeria_cost: 1200,
      marsa_maroc_cost: 800,
      cargo_weight: 22.0, // 22 tons
      trucks: {
        id: 61,
        plate_number: '20202-ب-50',
        model: 'Scania R450',
        fuel_consumption_rate: 34.0,
      },
      drivers: {
        id: 56,
        name: 'محمد التازي',
      },
    };

    const result = computeCorridorPnl([mockEuroTrip]);

    expect(result.europeanMaritime.totalTrips).toBe(1);
    expect(result.europeanMaritime.totalKm).toBe(2070.0); // 1850 + 220
    expect(result.europeanMaritime.totalRevenueMad).toBe(52000.0);

    // Fuel: 1850 / 100 * 34 * 12.50 = 7,862.50 MAD
    // Maintenance: 1850 * 1.40 = 2,590.00 MAD
    // Ferry + Triptik + Transit + Marsa Maroc = 4500 + 500 + 1200 + 800 = 7,000.00 MAD
    // Customs & Port: 600.00 MAD
    // Driver Allowance: 3,500.00 MAD
    // Tolls / Other: 600.00 MAD
    // Total Costs = 7862.50 + 2590 + 7000 + 600 + 3500 + 600 = 22,152.50 MAD
    expect(result.europeanMaritime.totalOperatingCostsMad).toBe(22152.5);

    // Net Profit = 52,000 - 22,152.50 = 29,847.50 MAD
    expect(result.europeanMaritime.netProfitMad).toBe(29847.5);

    // Net Margin % = (29847.5 / 52000) * 100 = 57.40%
    expect(result.europeanMaritime.netMarginPercent).toBe(57.4);

    // European CPK = 22152.5 / 2070 = 10.70 MAD/km
    expect(result.europeanMaritime.costPerKmMad).toBe(10.7);

    // European RPK = 52000 / 2070 = 25.12 MAD/km
    expect(result.europeanMaritime.revenuePerKmMad).toBe(25.12);
  });

  it('should detect CPK variance anomaly when trip cost exceeds corridor baseline by >15%', () => {
    // Normal baseline trip
    const normalTrip: RawPnlTripOrder = {
      id: 101,
      company_id: 1,
      truck_id: 10,
      driver_id: 1,
      route: 'Tanger Med ➔ Algeciras',
      price: 30000,
      road_distance_km: 1000,
      ferry_distance_km: 100,
      corridor_type: 'european_maritime',
      ferry_cost: 3000,
      status: 'completed',
      departure_date: '2026-09-01',
      trucks: { id: 10, plate_number: '11111-أ-10', fuel_consumption_rate: 34 },
      drivers: { id: 1, name: 'سائق عادي' },
    };

    // Abnormal trip with huge custom maintenance cost causing >15% overrun
    const abnormalTrip: RawPnlTripOrder = {
      id: 102,
      company_id: 1,
      truck_id: 11,
      driver_id: 2,
      route: 'Tanger Med ➔ Algeciras',
      price: 30000,
      road_distance_km: 1000,
      ferry_distance_km: 100,
      corridor_type: 'european_maritime',
      ferry_cost: 3000,
      status: 'completed',
      departure_date: '2026-09-02',
      trucks: { id: 11, plate_number: '22222-أ-10', fuel_consumption_rate: 34 },
      drivers: { id: 2, name: 'سائق متجاوز' },
    };

    const abnormalMaintenance: RawPnlMaintenanceExpense[] = [
      {
        id: 999,
        truck_id: 11,
        trip_order_id: 102,
        cost: 15000, // Massive emergency breakdown repair on this trip
        type: 'repair_engine',
        created_at: '2026-09-02',
      },
    ];

    const result = computeCorridorPnl([normalTrip, abnormalTrip], abnormalMaintenance);

    expect(result.anomalies.length).toBeGreaterThanOrEqual(1);
    const found = result.anomalies.find((a) => a.tripId === 102);
    expect(found).toBeDefined();
    expect(found?.severity).toBe('critical'); // Massive overrun > 30%
    expect(found?.primaryCostDriver).toBe('maintenance');
    expect(found?.primaryCostDriverLabelAr).toBe('تكاليف الصيانة والقطع');
  });

  it('should handle zero distance and zero revenue gracefully without throwing or NaN', () => {
    const emptyTrip: RawPnlTripOrder = {
      id: 999,
      company_id: 1,
      route: 'Canceled trip',
      price: 0,
      road_distance_km: 0,
      ferry_distance_km: 0,
      status: 'canceled',
    };

    const result = computeCorridorPnl([emptyTrip]);

    expect(result.africanOverland.totalTrips).toBe(1);
    expect(result.africanOverland.costPerKmMad).toBe(0);
    expect(result.africanOverland.revenuePerKmMad).toBe(0);
    expect(result.africanOverland.netMarginPercent).toBe(0);
    expect(result.africanOverland.costPerTonKmMad).toBe(0);
  });
});

