import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeCorridorAnalytics,
  classifyFuelEfficiency,
  type RawTripOrderWithRelations,
} from '../services/corridor-comparison.service';

describe('Corridor P&L & Fuel Telematics Engine (Decimal.js)', () => {
  it('should accurately classify fuel efficiency without floating-point errors', () => {
    expect(classifyFuelEfficiency(new Decimal(30.5))).toBe('efficient');
    expect(classifyFuelEfficiency(new Decimal(31.99))).toBe('efficient');
    expect(classifyFuelEfficiency(new Decimal(34.0))).toBe('normal');
    expect(classifyFuelEfficiency(new Decimal(36.0))).toBe('normal');
    expect(classifyFuelEfficiency(new Decimal(38.01))).toBe('high_risk');
    expect(classifyFuelEfficiency(new Decimal(42.5))).toBe('high_risk');
  });

  it('should compute African Overland trip P&L with exact Decimal.js precision', () => {
    const mockAfricanTrip: RawTripOrderWithRelations = {
      id: 272,
      company_id: 1,
      client_id: 114,
      truck_id: 62,
      driver_id: 57,
      route: 'Agadir ➔ Dakar',
      price: 45000,
      price_export: 45000,
      price_import: 0,
      currency: 'MAD',
      departure_date: '2026-09-21',
      status: 'completed',
      created_at: '2026-09-21T10:00:00Z',
      cmr_number: 'CMR-BK-2026-0042',
      road_distance_km: 2800,
      ferry_distance_km: 0,
      corridor_type: 'african_overland',
      ferry_cost: 3200,
      trucks: {
        id: 62,
        plate_number: '10101-أ-40',
        model: 'Volvo FH 500',
        fuel_consumption_rate: 36.0,
      },
      drivers: {
        id: 57,
        name: 'عبد الكريم الخمليشي',
      },
    };

    const result = computeCorridorAnalytics([mockAfricanTrip]);

    expect(result.africanOverland.totalTrips).toBe(1);
    expect(result.africanOverland.totalRevenue).toBe(45000.0);
    // Fuel: 2800 / 100 * 36 * 12.5 = 12600.00
    expect(result.africanOverland.totalFuelCost).toBe(12600.0);
    expect(result.africanOverland.totalFuelLiters).toBe(1008.0);
    // Customs (2500) + River Ferry (3200) + Driver (6500) + Carte Brune (1800) + Fuel (12600) = 26600
    expect(result.africanOverland.totalDirectExpenses).toBe(26600.0);
    // Net profit = 45000 - 26600 = 18400
    expect(result.africanOverland.netProfit).toBe(18400.0);
    // Margin = (18400 / 45000) * 100 = 40.89%
    expect(result.africanOverland.profitMarginPercent).toBe(40.89);
    // Revenue per km = 45000 / 2800 = 16.07
    expect(result.africanOverland.revenuePerKm).toBe(16.07);
  });

  it('should compute European Maritime trip P&L and recognize port expenses', () => {
    const mockEuroTrip: RawTripOrderWithRelations = {
      id: 201,
      company_id: 1,
      client_id: 101,
      truck_id: 61,
      driver_id: 56,
      route: 'Tanger Med ➔ Algeciras ➔ Perpignan',
      price: 52000,
      price_export: 52000,
      price_import: 0,
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

    const result = computeCorridorAnalytics([mockEuroTrip]);

    expect(result.europeanMaritime.totalTrips).toBe(1);
    expect(result.europeanMaritime.totalRevenue).toBe(52000.0);
    // Road km = 1850, Ferry = 220, Total = 2070
    expect(result.europeanMaritime.totalDistanceKm).toBe(2070.0);
    // Fuel: 1850 / 100 * 34 * 12.5 = 7862.50
    expect(result.europeanMaritime.totalFuelCost).toBe(7862.5);
    // Ferry & Port: 4500 + 500 + 1200 + 800 = 7000
    expect(result.europeanMaritime.ferryOrTransitCost).toBe(7000.0);
    // Total expenses = 7862.5 + 7000 + 3500 (allowance) + 600 (tolls) = 18962.50
    expect(result.europeanMaritime.totalDirectExpenses).toBe(18962.5);
    // Net profit = 52000 - 18962.50 = 33037.50
    expect(result.europeanMaritime.netProfit).toBe(33037.5);
  });

  it('should detect fuel anomaly when actual consumption exceeds 38 L/100km', () => {
    const mockTrip: RawTripOrderWithRelations = {
      id: 301,
      company_id: 1,
      truck_id: 99,
      route: 'Agadir ➔ Nouakchott',
      price: 35000,
      road_distance_km: 2000,
      corridor_type: 'african_overland',
      status: 'completed',
      departure_date: '2026-09-10',
      created_at: '2026-09-10',
      trucks: {
        id: 99,
        plate_number: '99999-د-10',
        model: 'Mercedes Actros',
        fuel_consumption_rate: 41.5, // High burn rate > 38
      },
    };

    const result = computeCorridorAnalytics([mockTrip]);

    expect(result.fuelAnomalies.length).toBe(1);
    const anomaly = result.fuelAnomalies[0];
    expect(anomaly.truckId).toBe(99);
    expect(anomaly.actualConsumptionRate).toBe(41.5);
    expect(anomaly.status).toBe('high_risk');
    expect(anomaly.isAnomaly).toBe(true);
  });
});
