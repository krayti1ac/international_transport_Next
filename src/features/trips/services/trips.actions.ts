'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedCompanyId } from '@/lib/rbac.server';
import { dispatchTripLifecycleNotifications } from './notification-dispatcher';
import { validateTripTransition } from './trip-state-machine';
import { computeTruckTireWear } from '@/features/predictive/services/fleet-predictive.service';
import { recordAuditLog } from '@/lib/audit.server';
import { revalidatePath } from 'next/cache';
import type { TripOrder, Driver, Truck, Trailer, DeliverySignature } from '@/types/database';

export async function createTripOrder(data: Partial<TripOrder>) {
  try {
    const companyId = await getAuthenticatedCompanyId(data.company_id);
    const supabase = await createClient();
    const payload = {
      ...data,
      company_id: companyId,
    };
    const { data: result, error } = await supabase
      .from('trip_orders')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: result as TripOrder };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create trip order';
    return { success: false, error: message };
  }
}

export async function updateTripStatus(tripId: number, newStatus: string) {
  try {
    const supabase = await createClient();

    // 1. جلب بيانات الرحلة الحالية
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: 'الرحلة غير موجودة في النظام.' };
    }

    // 2. جلب بيانات السائق، الشاحنة، المقطورة، التوقيع الرقمي، السلف، وسجل الرحلات لحساب TWI
    const [driverRes, truckRes, trailerRes, podRes, advanceRes, pastTripsRes] = await Promise.all([
      trip.driver_id
        ? supabase.from('drivers').select('*').eq('id', trip.driver_id).maybeSingle()
        : Promise.resolve({ data: null }),
      trip.truck_id
        ? supabase.from('trucks').select('*').eq('id', trip.truck_id).maybeSingle()
        : Promise.resolve({ data: null }),
      trip.trailer_id
        ? supabase.from('trailers').select('*').eq('id', trip.trailer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('delivery_signatures')
        .select('*')
        .eq('trip_order_id', tripId)
        .maybeSingle(),
      trip.driver_id
        ? supabase.from('advances').select('status').eq('driver_id', trip.driver_id)
        : Promise.resolve({ data: [] }),
      trip.truck_id
        ? supabase
            .from('trip_orders')
            .select('*')
            .eq('truck_id', trip.truck_id)
            .in('status', ['in_transit', 'delivered', 'settled', 'closed'])
        : Promise.resolve({ data: [] }),
    ]);

    let truckTwi: number | undefined = undefined;
    if (truckRes.data && pastTripsRes.data && pastTripsRes.data.length > 0) {
      try {
        const twiResult = computeTruckTireWear(truckRes.data as Truck, pastTripsRes.data as any);
        truckTwi = twiResult.twiPercentage;
      } catch {
        // Fallback gracefully if calculation fails
      }
    }

    const allAdvancesSettled =
      !advanceRes.data || advanceRes.data.length === 0
        ? true
        : (advanceRes.data as Array<{ status: string }>).every((a) => a.status === 'settled');

    // 3. تشغيل فحص محرك الحالة (State Machine Guard)
    // 3. تشغيل فحص محرك الحالة (State Machine Guard) مع قفل TWI الإلزامي
    const validation = validateTripTransition(trip.status, newStatus, {
      trip: trip as TripOrder,
      driver: (driverRes.data as Driver) || null,
      truck: (truckRes.data as Truck) || null,
      trailer: (trailerRes.data as Trailer) || null,
      deliveryProof: (podRes.data as DeliverySignature) || null,
      hasSettlementClosed: allAdvancesSettled,
      truckTwiPercentage: truckTwi,
    });

    if (!validation.valid) {
      return { success: false, error: validation.error, code: validation.code };
    }

    // 4. تنفيذ التحديث الآمن بعد اجتياز الفحص
    const { data: result, error: updateErr } = await supabase
      .from('trip_orders')
      .update({ status: newStatus })
      .eq('id', tripId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 5. إطلاق الإشعارات والتنبيهات
    const eventType = newStatus === 'in_transit' ? 'trip_dispatched' : 'status_update';
    dispatchTripLifecycleNotifications(tripId, eventType).catch((err) =>
      console.warn('Status notification trigger error:', err)
    );

    // 6. تسجيل حركة التدقيق الأمني
    await recordAuditLog({
      entityType: 'trip_orders',
      entityId: tripId,
      actionType: 'update',
      reason: `تغيير حالة الرحلة من [${trip.status}] إلى [${newStatus}] عبر State Machine`,
      oldData: { status: trip.status },
      newData: { status: newStatus },
    });

    revalidatePath('/trips');
    revalidatePath(`/trips/${tripId}`);

    return { success: true, data: result as TripOrder };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update trip status';
    return { success: false, error: message };
  }
}
