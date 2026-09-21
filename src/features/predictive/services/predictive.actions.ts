'use server';

import { createClient } from '@/lib/supabase/server';
import { computeFleetPredictiveHealth } from './fleet-predictive.service';
import {
  computeClientPaymentVelocities,
  computeCashFlowProjections,
  type PaymentAllocationRecord,
} from './cashflow-predictive.service';
import type { PredictiveDashboardData } from '../types/predictive-engine.types';
import type { Truck, Trailer, Invoice, Client, TreasuryTransaction, TruckMaintenance } from '@/types/database';
import type { RawTripOrderWithRelations } from '@/features/analytics/services/corridor-comparison.service';

export async function getPredictiveEngineDataAction(): Promise<{
  success: boolean;
  data?: PredictiveDashboardData;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Query required tables in parallel
    const [
      trucksRes,
      trailersRes,
      tripsRes,
      maintenanceRes,
      invoicesRes,
      clientsRes,
      treasuryRes,
      allocationsRes,
    ] = await Promise.all([
      supabase.from('trucks').select('*').order('id', { ascending: true }),
      supabase.from('trailers').select('*').order('id', { ascending: true }),
      supabase.from('trip_orders').select('*').order('departure_date', { ascending: false }),
      supabase.from('truck_maintenance').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name', { ascending: true }),
      supabase.from('treasury_transactions').select('type, amount, currency, created_at'),
      supabase.from('payment_invoice_allocations').select('id, payment_id, invoice_id, allocated_amount, created_at'),
    ]);

    if (tripsRes.error) {
      return { success: false, error: tripsRes.error.message };
    }

    const trucks = (trucksRes.data || []) as Truck[];
    const trailers = (trailersRes.data || []) as Trailer[];
    const trips = (tripsRes.data || []) as RawTripOrderWithRelations[];
    const maintenance = (maintenanceRes.data || []) as TruckMaintenance[];
    const invoices = (invoicesRes.data || []) as Invoice[];
    const clients = (clientsRes.data || []) as Client[];
    const treasury = (treasuryRes.data || []) as TreasuryTransaction[];
    const allocations = (allocationsRes.data || []) as PaymentAllocationRecord[];

    // 1. Compute Fleet Predictive Health
    const fleetHealth = computeFleetPredictiveHealth(trucks, trailers, trips, maintenance);

    // 2. Compute Client Payment Velocities (PVI)
    const clientVelocities = computeClientPaymentVelocities(clients, invoices, allocations);

    // 3. Compute 30 / 60 / 90 Days Cash Flow Horizons
    const cashFlowProjections = computeCashFlowProjections(
      treasury,
      invoices,
      clientVelocities,
      trips
    );

    const result: PredictiveDashboardData = {
      generatedAt: new Date().toISOString(),
      fleetHealth,
      clientVelocities,
      cashFlowProjections,
    };

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch predictive engine data';
    return { success: false, error: message };
  }
}

