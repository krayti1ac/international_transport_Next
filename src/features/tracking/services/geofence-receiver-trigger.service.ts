/**
 * Trans Bodanon TMS — Auto-Geofence Traccar Webhook to Targeted Receiver Dispatch Engine
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP Guidelines (2013/C 343/01)
 * Automatically triggers WhatsApp GDP compliance certificate delivery to designated cargo receivers
 * upon vehicle entry into client warehouses or unloading geofence zones.
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  TargetedReceiverDispatcherService,
  type DispatchReceiverCertificateResult,
} from './targeted-receiver-dispatcher.service';
import { generateCompartmentGdpCertificateAction } from './multi-temp-certificate.actions';
import type { TargetedReceiverCertificatePayload } from '@/features/whatsapp/services/whatsapp-targeted-receiver-templates';
import type { WhatsAppLocale } from '@/features/whatsapp/types/whatsapp.types';

// In-memory idempotency cache to prevent duplicate arrival dispatches per trip & zone
const GEOFENCE_ARRIVAL_DISPATCH_CACHE = new Map<string, number>();
const GEOFENCE_COOLDOWN_MS = 60 * 60 * 1000; // 1-hour cooldown per trip and zone

export interface EvaluateGeofenceReceiverArrivalParams {
  truckId: number;
  latitude: number;
  longitude: number;
  zoneName?: string;
  zoneId?: number | string;
  zoneType?: string;
  timestamp?: string;
  forceBypassCooldown?: boolean;
}

export interface GeofenceReceiverArrivalResult {
  triggered: boolean;
  tripId?: number;
  truckPlate?: string;
  zoneName?: string;
  dispatchedCount: number;
  results: DispatchReceiverCertificateResult[];
  error?: string;
}

export class GeofenceReceiverTriggerService {
  /**
   * Resets geofence arrival cooldown (for test suites or operational reset)
   */
  public static resetArrivalCooldown(key?: string): void {
    if (key) {
      GEOFENCE_ARRIVAL_DISPATCH_CACHE.delete(key);
    } else {
      GEOFENCE_ARRIVAL_DISPATCH_CACHE.clear();
    }
  }

  /**
   * Evaluates if a geofence arrival matches an unloading destination and triggers receiver notifications
   */
  public static async evaluateGeofenceReceiverArrival(
    params: EvaluateGeofenceReceiverArrivalParams
  ): Promise<GeofenceReceiverArrivalResult> {
    try {
      const supabase = await createClient();

      // 1. Find active trip for this truck
      const { data: activeTrip, error: tripErr } = await supabase
        .from('trip_orders')
        .select(`
          id,
          trip_number,
          cmr_number,
          truck_id,
          trailer_id,
          client_id,
          client_import_id,
          status,
          destination_city,
          truck:trucks(plate_number),
          trailer:trailers(id, plate_number),
          client:clients!trip_orders_client_id_fkey(name, phone, client_type),
          client_import:clients!trip_orders_client_import_id_fkey(name, phone, client_type)
        `)
        .eq('truck_id', params.truckId)
        .in('status', ['in_transit', 'loading', 'customs_export', 'delivered'])
        .order('departure_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tripErr || !activeTrip) {
        return {
          triggered: false,
          dispatchedCount: 0,
          results: [],
        };
      }

      const tripId = activeTrip.id;
      const truckPlate =
        (activeTrip.truck as any)?.plate_number || `TRK-${params.truckId}`;
      const trailerId =
        activeTrip.trailer_id || (activeTrip.trailer as any)?.id;

      if (!trailerId) {
        return {
          triggered: false,
          tripId,
          truckPlate,
          dispatchedCount: 0,
          results: [],
          error: 'لا توجد مقطورة مبردة مرتبطة بهذه الرحلة',
        };
      }

      // 2. Verify if geofence qualifies as an unloading or customer site
      const zoneType = (params.zoneType || '').toLowerCase();
      const zoneName = params.zoneName || 'رصيف المستلم / منطقة التفريغ';
      const isUnloadingZone =
        zoneType.includes('unload') ||
        zoneType.includes('customer') ||
        zoneType.includes('warehouse') ||
        zoneType.includes('delivery') ||
        zoneType.includes('destination') ||
        zoneType === 'client_site' ||
        zoneName.toLowerCase().includes('muelle') ||
        zoneName.toLowerCase().includes('quai') ||
        zoneName.toLowerCase().includes('déchargement') ||
        zoneName.toLowerCase().includes('descarga') ||
        zoneName.toLowerCase().includes('تفريغ') ||
        zoneName.toLowerCase().includes('مستودع') ||
        zoneName.toLowerCase().includes('merc'); // e.g. Mercamadrid, Mercado

      if (!isUnloadingZone && !params.forceBypassCooldown) {
        return {
          triggered: false,
          tripId,
          truckPlate,
          zoneName,
          dispatchedCount: 0,
          results: [],
        };
      }

      // 3. Retrieve active compartment profiles for this trailer
      const { data: compartments, error: compErr } = await supabase
        .from('reefer_compartment_profiles')
        .select('*')
        .eq('trailer_id', trailerId)
        .eq('is_active', true)
        .order('compartment_code', { ascending: true });

      if (compErr || !compartments || compartments.length === 0) {
        return {
          triggered: false,
          tripId,
          truckPlate,
          zoneName,
          dispatchedCount: 0,
          results: [],
          error: 'لا توجد حجرات تبريد نشطة مسجلة لهذه المقطورة',
        };
      }

      // 4. Resolve designated receiver information (from client or client_import)
      const rawClientImport = Array.isArray(activeTrip.client_import)
        ? activeTrip.client_import[0]
        : activeTrip.client_import;
      const rawClient = Array.isArray(activeTrip.client)
        ? activeTrip.client[0]
        : activeTrip.client;
      const primaryClient = rawClientImport || rawClient;
      const receiverName = (primaryClient as any)?.name || 'مستلم الشحنة المعتمد';
      const receiverPhone = (primaryClient as any)?.phone || '';

      if (!receiverPhone) {
        return {
          triggered: false,
          tripId,
          truckPlate,
          zoneName,
          dispatchedCount: 0,
          results: [],
          error: 'رقم هاتف مستلم الشحنة غير مسجل في ملف العميل',
        };
      }

      // Determine receiver locale based on country code or destination
      let locale: WhatsAppLocale = 'ar';
      if (receiverPhone.startsWith('+34') || receiverPhone.startsWith('34') || activeTrip.destination_city?.toLowerCase().includes('madrid') || activeTrip.destination_city?.toLowerCase().includes('spain') || activeTrip.destination_city?.toLowerCase().includes('espagne')) {
        locale = 'es';
      } else if (receiverPhone.startsWith('+33') || receiverPhone.startsWith('33') || receiverPhone.startsWith('+221') || activeTrip.destination_city?.toLowerCase().includes('perpignan') || activeTrip.destination_city?.toLowerCase().includes('france')) {
        locale = 'fr';
      }

      const results: DispatchReceiverCertificateResult[] = [];

      // 5. Generate certificates and dispatch per active compartment
      for (const comp of compartments) {
        const idempotencyKey = `arrival_${tripId}_${params.zoneId || zoneName}_${comp.compartment_code}`;
        const lastSent = GEOFENCE_ARRIVAL_DISPATCH_CACHE.get(idempotencyKey);
        const now = Date.now();

        if (!params.forceBypassCooldown && lastSent && now - lastSent < GEOFENCE_COOLDOWN_MS) {
          continue;
        }

        // Generate official GDP certificate payload
        const certRes = await generateCompartmentGdpCertificateAction({
          compartmentId: comp.id,
          trailerId,
          tripId,
          locale,
        });

        if (!certRes.success || !certRes.payload) {
          continue;
        }

        const certPayload = certRes.payload;

        const targetedPayload: TargetedReceiverCertificatePayload = {
          receiverName,
          receiverPhone,
          compartmentCode: certPayload.compartmentCode,
          compartmentName: certPayload.compartmentName,
          cargoCategory: certPayload.cargoCategory,
          trailerPlate: certPayload.trailerPlate,
          tripNumber: certPayload.tripNumber,
          cmrNumber: certPayload.cmrNumber,
          clientName: certPayload.clientName,
          setpointTempC: certPayload.setpointTempC,
          mktTempC: certPayload.mktTempC,
          avgSupplyTempC: certPayload.avgSupplyAirTempC,
          avgReturnTempC: certPayload.avgReturnAirTempC,
          status: certPayload.status,
          complianceScore: certPayload.complianceScore,
          verificationHash: certPayload.verificationHash,
          verificationUrl: certPayload.verificationUrl,
          arrivalLocationName: zoneName,
          isGeofenceTriggered: true,
          issuedAt: certPayload.issuedAt,
        };

        const dispatchRes = await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
          payload: targetedPayload,
          locale,
          forceBypassCooldown: params.forceBypassCooldown,
          tripId,
        });

        if (dispatchRes.success) {
          GEOFENCE_ARRIVAL_DISPATCH_CACHE.set(idempotencyKey, now);
        }

        results.push(dispatchRes);
      }

      // 6. Security Audit Log
      if (results.length > 0) {
        await recordAuditLog({
          entityType: 'geofence_arrival',
          entityId: String(tripId),
          actionType: 'whatsapp_notification',
          reason: `بث تلقائي لشهادات تبريد الحجرات فور دخول الشاحنة إلى نطاق ${zoneName}`,
          newData: {
            event: 'AUTO_GEOFENCE_RECEIVER_DISPATCH',
            tripId,
            truckPlate,
            zoneName,
            dispatchedCount: results.filter((r) => r.success).length,
            receivers: results.map((r) => ({
              compartment: r.compartmentCode,
              phone: r.phone,
              success: r.success,
              skippedCooldown: r.skippedCooldown,
            })),
          },
        }).catch((err) => console.warn('[Audit Log Warning]:', err));
      }

      return {
        triggered: results.length > 0,
        tripId,
        truckPlate,
        zoneName,
        dispatchedCount: results.filter((r) => r.success && !r.skippedCooldown).length,
        results,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع أثناء معالجة وصول السياج الجغرافي';
      return {
        triggered: false,
        dispatchedCount: 0,
        results: [],
        error: msg,
      };
    }
  }
}
