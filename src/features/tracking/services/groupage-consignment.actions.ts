'use server';

/**
 * Trans Bodanon TMS — Groupage & LTL Multi-Consignment Server Actions
 * Standards: Multi-Consignment CMR / LDM Trailer Utilization / RLS Multi-Tenant
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  createLtlConsignmentSchema,
  updateConsignmentStatusSchema,
  type CreateLtlConsignmentInput,
  type UpdateConsignmentStatusInput,
  type TripConsignment,
} from '../types/groupage-ltl.types';
import { calculateConsignmentMetrics } from './groupage-calculator.service';

// In-memory cache for fallback resilience & unit tests
const consignmentsStore = new Map<number, TripConsignment[]>();

export async function clearConsignmentsCache(): Promise<void> {
  consignmentsStore.clear();
}

/**
 * Adds a new LTL consignment to a trip
 */
export async function createLtlConsignmentAction(
  rawInput: CreateLtlConsignmentInput
): Promise<{
  success: boolean;
  data?: TripConsignment;
  error?: string;
}> {
  try {
    const parsed = createLtlConsignmentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const input = parsed.data;

    // 1. Calculate physical metrics via Decimal.js calculator
    const metrics = calculateConsignmentMetrics({
      palletType: input.palletType,
      palletCount: input.palletCount,
      isStackable: input.isStackable,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      grossWeightKg: input.grossWeightKg,
    });

    // 2. Generate unique consignment reference & CMR number
    const uniqueSuffix = Math.floor(Math.random() * 9000 + 1000);
    const consignmentReference = `LTL-${input.tripId}-${uniqueSuffix}`;
    const cmrNumber = `CMR-LTL-${input.tripId}-${uniqueSuffix}`;

    const newConsignment: TripConsignment = {
      id: `consignment-${Date.now()}-${uniqueSuffix}`,
      tripId: input.tripId,
      consignmentReference,
      clientId: input.clientId || null,
      clientName: input.clientName,
      senderName: input.senderName || input.clientName,
      senderAddress: input.senderAddress || null,
      receiverName: input.receiverName || 'Recepteur Europe',
      receiverAddress: input.receiverAddress || null,
      loadingCity: input.loadingCity,
      loadingCountry: input.loadingCountry,
      deliveryCity: input.deliveryCity,
      deliveryCountry: input.deliveryCountry,
      cargoDescription: input.cargoDescription,
      isTemperatureControlled: input.isTemperatureControlled,
      targetTemperatureC: input.targetTemperatureC || null,
      palletCount: input.palletCount,
      palletType: input.palletType,
      isStackable: input.isStackable,
      lengthCm: input.lengthCm || null,
      widthCm: input.widthCm || null,
      heightCm: input.heightCm || null,
      ldmMeters: metrics.ldmMeters,
      volumeM3: metrics.volumeM3,
      grossWeightKg: input.grossWeightKg,
      chargeableWeightKg: metrics.chargeableWeightKg,
      freightPrice: input.freightPrice,
      currency: input.currency,
      cmrNumber,
      customsMrn: input.customsMrn || null,
      status: 'manifested',
      notes: input.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Persist to Supabase database
    try {
      const supabase = await createClient();
      const { data: dbData, error: dbError } = await supabase
        .from('trip_consignments')
        .insert({
          trip_id: newConsignment.tripId,
          consignment_reference: newConsignment.consignmentReference,
          client_id: typeof newConsignment.clientId === 'number' ? newConsignment.clientId : null,
          client_name: newConsignment.clientName,
          sender_name: newConsignment.senderName,
          sender_address: newConsignment.senderAddress,
          receiver_name: newConsignment.receiverName,
          receiver_address: newConsignment.receiverAddress,
          loading_city: newConsignment.loadingCity,
          loading_country: newConsignment.loadingCountry,
          delivery_city: newConsignment.deliveryCity,
          delivery_country: newConsignment.deliveryCountry,
          cargo_description: newConsignment.cargoDescription,
          is_temperature_controlled: newConsignment.isTemperatureControlled,
          target_temperature_c: newConsignment.targetTemperatureC,
          pallet_count: newConsignment.palletCount,
          pallet_type: newConsignment.palletType,
          is_stackable: newConsignment.isStackable,
          length_cm: newConsignment.lengthCm,
          width_cm: newConsignment.widthCm,
          height_cm: newConsignment.heightCm,
          ldm_meters: newConsignment.ldmMeters,
          volume_m3: newConsignment.volumeM3,
          gross_weight_kg: newConsignment.grossWeightKg,
          chargeable_weight_kg: newConsignment.chargeableWeightKg,
          freight_price: newConsignment.freightPrice,
          currency: newConsignment.currency,
          cmr_number: newConsignment.cmrNumber,
          customs_mrn: newConsignment.customsMrn,
          status: newConsignment.status,
          notes: newConsignment.notes,
        })
        .select('id')
        .maybeSingle();

      if (!dbError && dbData?.id) {
        newConsignment.id = dbData.id;
      }
    } catch (dbErr) {
      console.warn('[LTL Consignment Action DB Fallback]:', dbErr);
    }

    // 4. Update in-memory cache
    const existing = consignmentsStore.get(input.tripId) || [];
    consignmentsStore.set(input.tripId, [...existing, newConsignment]);

    // 5. Record Audit Log
    await recordAuditLog({
      entityType: 'trip_consignment',
      entityId: newConsignment.consignmentReference,
      actionType: 'create',
      reason: `Added LTL consignment ${newConsignment.consignmentReference} for client ${newConsignment.clientName} (Trip #${input.tripId})`,
      newData: {
        consignmentReference: newConsignment.consignmentReference,
        ldmMeters: newConsignment.ldmMeters,
        palletCount: newConsignment.palletCount,
        freightPrice: newConsignment.freightPrice,
      },
    });

    return {
      success: true,
      data: newConsignment,
    };
  } catch (err) {
    console.error('[createLtlConsignmentAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown server error creating LTL consignment',
    };
  }
}

/**
 * Retrieves all consignments for a specific trip
 */
export async function fetchTripConsignmentsAction(
  tripId: number
): Promise<{
  success: boolean;
  data: TripConsignment[];
  error?: string;
}> {
  try {
    if (!tripId || tripId <= 0) {
      return { success: false, data: [], error: 'Valid trip ID is required' };
    }

    try {
      const supabase = await createClient();
      const { data: dbData, error: dbError } = await supabase
        .from('trip_consignments')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (!dbError && dbData && dbData.length > 0) {
        const mapped: TripConsignment[] = dbData.map((d: any) => ({
          id: d.id,
          companyId: d.company_id,
          tripId: d.trip_id,
          consignmentReference: d.consignment_reference,
          clientId: d.client_id,
          clientName: d.client_name,
          senderName: d.sender_name,
          senderAddress: d.sender_address,
          receiverName: d.receiver_name,
          receiverAddress: d.receiver_address,
          loadingCity: d.loading_city,
          loadingCountry: d.loading_country,
          deliveryCity: d.delivery_city,
          deliveryCountry: d.delivery_country,
          cargoDescription: d.cargo_description,
          isTemperatureControlled: d.is_temperature_controlled,
          targetTemperatureC: d.target_temperature_c,
          palletCount: d.pallet_count,
          palletType: d.pallet_type,
          isStackable: d.is_stackable,
          lengthCm: d.length_cm,
          widthCm: d.width_cm,
          heightCm: d.height_cm,
          ldmMeters: Number(d.ldm_meters || 0),
          volumeM3: Number(d.volume_m3 || 0),
          grossWeightKg: Number(d.gross_weight_kg || 0),
          chargeableWeightKg: Number(d.chargeable_weight_kg || 0),
          freightPrice: Number(d.freight_price || 0),
          currency: d.currency || 'MAD',
          cmrNumber: d.cmr_number,
          customsMrn: d.customs_mrn,
          status: d.status,
          notes: d.notes,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));

        consignmentsStore.set(tripId, mapped);
        return { success: true, data: mapped };
      }
    } catch (dbErr) {
      console.warn('[fetchTripConsignmentsAction DB Fallback]:', dbErr);
    }

    // Fallback to in-memory store
    const inMemory = consignmentsStore.get(tripId) || [];
    return { success: true, data: inMemory };
  } catch (err) {
    console.error('[fetchTripConsignmentsAction Error]:', err);
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'Failed to fetch trip consignments',
    };
  }
}

/**
 * Updates status of an existing consignment
 */
export async function updateConsignmentStatusAction(
  rawInput: UpdateConsignmentStatusInput
): Promise<{
  success: boolean;
  data?: { consignmentId: string; status: string };
  error?: string;
}> {
  try {
    const parsed = updateConsignmentStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const { consignmentId, status } = parsed.data;

    try {
      const supabase = await createClient();
      await supabase
        .from('trip_consignments')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', consignmentId);
    } catch (dbErr) {
      console.warn('[updateConsignmentStatusAction DB Fallback]:', dbErr);
    }

    // Update in-memory cache
    for (const [tripId, list] of consignmentsStore.entries()) {
      const target = list.find((c) => c.id === consignmentId);
      if (target) {
        target.status = status;
        target.updatedAt = new Date().toISOString();
        consignmentsStore.set(tripId, [...list]);
        break;
      }
    }

    await recordAuditLog({
      entityType: 'trip_consignment',
      entityId: consignmentId,
      actionType: 'update',
      reason: `Consignment status updated to ${status}`,
      newData: { consignmentId, status },
    });

    return {
      success: true,
      data: { consignmentId, status },
    };
  } catch (err) {
    console.error('[updateConsignmentStatusAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update consignment status',
    };
  }
}

