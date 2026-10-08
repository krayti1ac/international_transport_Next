'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { parseFuelCardStatement } from './fuel-card-parser.service';
import {
  reconcileFuelCardTransactions,
  HIGHWAY_FUEL_STATIONS_GEO,
} from './fuel-fraud-reconciler.service';
import type {
  FuelCardProvider,
  FuelCardTransactionRaw,
  FieldFuelReceiptMatch,
  FuelReconciliationSummary,
  ReconciledFuelEntry,
  ReconcileStatementInput,
} from '../types/fuel-reconciliation.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ReconcileActionResult {
  success: boolean;
  summary?: FuelReconciliationSummary;
  entries?: ReconciledFuelEntry[];
  error?: string;
}

/**
 * Server Action: Reconciles uploaded digital fuel card statement against database receipts and GPS tracking
 */
export async function reconcileFuelCardStatementAction(
  input: ReconcileStatementInput
): Promise<ReconcileActionResult> {
  try {
    const supabase = await createClient();

    let transactions: FuelCardTransactionRaw[] = input.transactions || [];

    // Parse CSV if provided
    if (input.rawCsvContent) {
      const parsed = parseFuelCardStatement(input.rawCsvContent, input.provider);
      if (!parsed.success || parsed.transactions.length === 0) {
        return {
          success: false,
          error: parsed.errors.join(' | ') || 'فشل في استخراج معاملات كشف بطاقات الوقود',
        };
      }
      transactions = parsed.transactions;
    }

    if (transactions.length === 0) {
      return { success: false, error: 'لا توجد معاملات وقود للمعالجة' };
    }

    // 1. Fetch Field Fuel Receipts from truck_maintenance
    const { data: maintenanceRows, error: maintError } = await supabase
      .from('truck_maintenance')
      .select('id, truck_id, amount, date, maintenance_date, description, notes, provider_name, created_at')
      .order('created_at', { ascending: false })
      .limit(300);

    if (maintError) {
      console.warn('Failed to load truck maintenance fuel receipts:', maintError.message);
    }

    // 2. Fetch Active Trucks
    const { data: trucksData } = await supabase
      .from('trucks')
      .select('id, plate_number, fuel_consumption_rate, weight_capacity');

    const trucks = (trucksData || []).map((t) => ({
      id: t.id,
      plate_number: t.plate_number,
      fuel_consumption_rate: t.fuel_consumption_rate ? Number(t.fuel_consumption_rate) : 36.0,
      max_tank_capacity: 900,
    }));

    const truckMap = new Map<number, string>();
    trucks.forEach((t) => truckMap.set(t.id, t.plate_number));

    // Convert maintenance rows to FieldFuelReceiptMatch
    const fieldReceipts: FieldFuelReceiptMatch[] = (maintenanceRows || []).map((row) => {
      const desc = `${row.description || ''} ${row.notes || ''}`;
      // Extract liters from description if available e.g. "650 L" or "Plein 500L"
      const litersMatch = desc.match(/(\d+(?:\.\d+)?)\s*(?:l|litres|liters)/i);
      const receiptLiters = litersMatch ? parseFloat(litersMatch[1]) : parseFloat(new Decimal(row.amount).dividedBy(12.8).toFixed(1));

      return {
        receiptId: row.id,
        truckId: row.truck_id,
        truckPlate: truckMap.get(row.truck_id) || 'TRK-UNKNOWN',
        receiptDate: row.date || row.maintenance_date || row.created_at,
        receiptLiters,
        receiptAmount: Number(row.amount),
        stationName: row.provider_name || 'محطة معتمدة',
      };
    });

    // 3. Fetch Recent GPS Location Pings for proximity cross-check
    const { data: locationsData } = await supabase
      .from('truck_locations')
      .select('truck_id, latitude, longitude, timestamp, speed, recorded_at')
      .order('timestamp', { ascending: false })
      .limit(500);

    const gpsLocations = (locationsData || []).map((loc) => ({
      truckId: loc.truck_id,
      truckPlate: truckMap.get(loc.truck_id),
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.timestamp || loc.recorded_at || new Date().toISOString(),
      speed: loc.speed,
    }));

    // 4. Run Reconciliation Engine
    const { reconciledEntries, summary } = reconcileFuelCardTransactions({
      cardTransactions: transactions,
      fieldReceipts,
      gpsLocations,
      trucks,
    });

    // 5. Audit Logging for Critical Fraud Alerts (Ghost Refuel & Overfill)
    const criticalFraudEntries = reconciledEntries.filter(
      (e) => e.status === 'ghost_refuel' || e.status === 'overfill_fraud' || e.status === 'duplicate_swipe'
    );

    if (criticalFraudEntries.length > 0) {
      try {
        await recordAuditLog({
          entityType: 'fuel_fraud',
          entityId: `RECON-${Date.now()}`,
          actionType: 'security_alert',
          reason: `اكتشاف ${criticalFraudEntries.length} شبهة احتيال أو تزود وهمي بالوقود عبر مطابقة كشوفات البطاقات`,
          newData: {
            fraudCount: criticalFraudEntries.length,
            entries: criticalFraudEntries.map((e) => ({
              id: e.id,
              plate: e.cardTransaction.truckPlate,
              station: e.cardTransaction.stationName,
              status: e.status,
              distanceKm: e.stationDistanceToGpsKm,
              liters: e.cardTransaction.liters,
              amount: e.cardTransaction.totalAmount,
            })),
          },
        });
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
      }
    }

    return {
      success: true,
      summary,
      entries: reconciledEntries,
    };
  } catch (error: unknown) {
    console.error('Fuel card reconciliation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'خطأ غير متوقع أثناء مطابقة كشف الوقود',
    };
  }
}

/**
 * Server Action: Provides realistic simulated fuel card reconciliation data for pilot demonstration
 */
export async function getSimulatedFuelReconciliationAction(): Promise<ReconcileActionResult> {
  const simulatedCardTransactions: FuelCardTransactionRaw[] = [
    // 1. Matched Afriquia Transaction (Tanger Med)
    {
      transactionId: 'TX-AFR-001',
      cardNumber: '7082-9910-4401',
      cardHolder: 'كريم البوداني',
      truckPlate: '12345-A-1',
      timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      stationName: 'Afriquia Tanger Med Port',
      stationCity: 'Tanger Med',
      fuelType: 'Gasoil 10 ppm',
      liters: 650.0,
      unitPrice: 12.8,
      totalAmount: 8320.0,
      currency: 'MAD',
      odometerKm: 215400,
    },
    // 2. Variance Transaction (TotalEnergies Kenitra - Slight liter discrepancy)
    {
      transactionId: 'TX-TOT-002',
      cardNumber: '5041-3312-8820',
      cardHolder: 'محمد الصادقي',
      truckPlate: '67890-B-2',
      timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
      stationName: 'TotalEnergies Kenitra Nord A1',
      stationCity: 'Kenitra',
      fuelType: 'Total Excellium Diesel',
      liters: 450.0,
      unitPrice: 13.1,
      totalAmount: 5895.0,
      currency: 'MAD',
      odometerKm: 340120,
    },
    // 3. Ghost Refueling Fraud (Shell Agadir Card swiped while Truck GPS was in Tanger Med)
    {
      transactionId: 'TX-SHL-003',
      cardNumber: '4120-0019-7754',
      cardHolder: 'عبد الكريم الخمليشي',
      truckPlate: '11223-D-7',
      timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      stationName: 'Shell Casablanca Ain Sebaa',
      stationCity: 'Casablanca',
      fuelType: 'Shell V-Power Diesel',
      liters: 550.0,
      unitPrice: 13.25,
      totalAmount: 7287.5,
      currency: 'MAD',
      odometerKm: 182300,
    },
    // 4. Overfill Mechanical Capacity Fraud (Afriquia Berrechid - 1,150L in 900L tank)
    {
      transactionId: 'TX-AFR-004',
      cardNumber: '7082-9910-5512',
      cardHolder: 'يوسف التازي',
      truckPlate: '44556-H-9',
      timestamp: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      stationName: 'Afriquia Berrechid A3',
      stationCity: 'Berrechid',
      fuelType: 'Gasoil 10 ppm',
      liters: 1150.0, // Exceeds max 900L
      unitPrice: 12.8,
      totalAmount: 14720.0,
      currency: 'MAD',
      odometerKm: 410900,
    },
    // 5. Duplicate Swipe (TotalEnergies Settat - swiped twice in 15 minutes)
    {
      transactionId: 'TX-TOT-005',
      cardNumber: '5041-3312-9931',
      cardHolder: 'حميد الوردي',
      truckPlate: '99887-J-3',
      timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      stationName: 'TotalEnergies Settat A3',
      stationCity: 'Settat',
      fuelType: 'Total Excellium Diesel',
      liters: 400.0,
      unitPrice: 13.1,
      totalAmount: 5240.0,
      currency: 'MAD',
      odometerKm: 295100,
    },
    {
      transactionId: 'TX-TOT-006',
      cardNumber: '5041-3312-9931',
      cardHolder: 'حميد الوردي',
      truckPlate: '99887-J-3',
      timestamp: new Date(Date.now() - 2 * 3600 * 1000 + 15 * 60 * 1000).toISOString(), // +15 min
      stationName: 'TotalEnergies Settat A3',
      stationCity: 'Settat',
      fuelType: 'Total Excellium Diesel',
      liters: 420.0,
      unitPrice: 13.1,
      totalAmount: 5502.0,
      currency: 'MAD',
      odometerKm: 295105,
    },
  ];

  const simulatedFieldReceipts: FieldFuelReceiptMatch[] = [
    {
      receiptId: 1001,
      truckId: 1,
      truckPlate: '12345-A-1',
      driverName: 'كريم البوداني',
      receiptDate: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      receiptLiters: 650.0,
      receiptAmount: 8320.0,
      stationName: 'Afriquia Tanger Med Port',
    },
    {
      receiptId: 1002,
      truckId: 2,
      truckPlate: '67890-B-2',
      driverName: 'محمد الصادقي',
      receiptDate: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
      receiptLiters: 425.0, // Variance of 25L compared to card 450L
      receiptAmount: 5567.5,
      stationName: 'TotalEnergies Kenitra',
    },
    {
      receiptId: 1003,
      truckId: 4,
      truckPlate: '44556-H-9',
      driverName: 'يوسف التازي',
      receiptDate: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      receiptLiters: 850.0,
      receiptAmount: 10880.0,
      stationName: 'Afriquia Berrechid',
    },
  ];

  // Simulated GPS pings
  const simulatedGpsLocations = [
    // Truck 1 was at Tanger Med (Verified)
    {
      truckPlate: '12345-A-1',
      latitude: 35.884,
      longitude: -5.506,
      timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      speed: 0,
    },
    // Truck 2 was at Kenitra (Verified)
    {
      truckPlate: '67890-B-2',
      latitude: 34.296,
      longitude: -6.574,
      timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
      speed: 0,
    },
    // Truck 3 was in Tanger Med (320 km away from Casablanca Ain Sebaa swipe -> Ghost Refuel)
    {
      truckPlate: '11223-D-7',
      latitude: 35.885,
      longitude: -5.505,
      timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      speed: 25,
    },
  ];

  const { reconciledEntries, summary } = reconcileFuelCardTransactions({
    cardTransactions: simulatedCardTransactions,
    fieldReceipts: simulatedFieldReceipts,
    gpsLocations: simulatedGpsLocations,
    trucks: [
      { id: 1, plate_number: '12345-A-1', max_tank_capacity: 900 },
      { id: 2, plate_number: '67890-B-2', max_tank_capacity: 900 },
      { id: 3, plate_number: '11223-D-7', max_tank_capacity: 900 },
      { id: 4, plate_number: '44556-H-9', max_tank_capacity: 900 },
      { id: 5, plate_number: '99887-J-3', max_tank_capacity: 900 },
    ],
  });

  return {
    success: true,
    summary,
    entries: reconciledEntries,
  };
}

