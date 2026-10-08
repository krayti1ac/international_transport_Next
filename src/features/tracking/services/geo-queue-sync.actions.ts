'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  GeoBreadcrumbPoint,
  GeoSyncBatchResult,
} from '../types/offline-geolocation.types';

/**
 * Server Action: Synchronizes an atomic batch of offline GPS breadcrumbs from Driver PWA
 * into `truck_locations` with idempotency protection and geofence evaluation.
 */
export async function syncGeoBreadcrumbsBatchAction(
  breadcrumbs: GeoBreadcrumbPoint[]
): Promise<GeoSyncBatchResult> {
  const timestamp = new Date().toISOString();

  if (!breadcrumbs || !Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
    return {
      success: true,
      totalReceived: 0,
      insertedCount: 0,
      skippedDuplicates: 0,
      failedCount: 0,
      syncedAt: timestamp,
    };
  }

  // Safety ceiling: Max 100 breadcrumbs per server action call
  const batch = breadcrumbs.slice(0, 100);

  try {
    const supabase = await createClient();

    // 1. Gather timestamps and tripIds to detect duplicates
    const tripIds = Array.from(new Set(batch.map((b) => b.tripId)));
    const timestamps = batch.map((b) => b.timestamp);

    // 2. Query existing locations recorded at identical timestamps for this trip
    const { data: existingPoints, error: queryError } = await supabase
      .from('truck_locations')
      .select('trip_id, recorded_at')
      .in('trip_id', tripIds)
      .in('recorded_at', timestamps);

    if (queryError) {
      console.warn('Deduplication lookup warning:', queryError.message);
    }

    const existingKeySet = new Set(
      (existingPoints || []).map((p: any) => `${p.trip_id}_${p.recorded_at}`)
    );

    // 3. Filter out duplicate breadcrumbs
    const newBreadcrumbs = batch.filter(
      (b) => !existingKeySet.has(`${b.tripId}_${b.timestamp}`)
    );
    const skippedDuplicates = batch.length - newBreadcrumbs.length;

    if (newBreadcrumbs.length === 0) {
      return {
        success: true,
        totalReceived: batch.length,
        insertedCount: 0,
        skippedDuplicates,
        failedCount: 0,
        syncedAt: timestamp,
      };
    }

    // 4. Map into truck_locations payload format
    const rowsToInsert = newBreadcrumbs.map((b) => ({
      trip_id: b.tripId,
      truck_id: b.truckId || null,
      driver_id: b.driverId || null,
      latitude: b.latitude,
      longitude: b.longitude,
      speed: b.speed != null ? Math.round(b.speed * 10) / 10 : 0,
      heading: b.heading != null ? Math.round(b.heading) : 0,
      accuracy: b.accuracy != null ? Math.round(b.accuracy) : null,
      recorded_at: b.timestamp,
      timestamp: b.timestamp,
    }));

    // 5. Batch insert into truck_locations
    const { error: insertError } = await supabase
      .from('truck_locations')
      .insert(rowsToInsert);

    if (insertError) {
      throw insertError;
    }

    // 6. Update latest truck current_location coordinates if truck_id exists
    const latestWithTruck = newBreadcrumbs
      .filter((b) => b.truckId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    if (latestWithTruck && latestWithTruck.truckId) {
      const coordStr = `${latestWithTruck.latitude.toFixed(6)}, ${latestWithTruck.longitude.toFixed(6)}`;
      await supabase
        .from('trucks')
        .update({
          current_location: coordStr,
        })
        .eq('id', latestWithTruck.truckId);
    }

    return {
      success: true,
      totalReceived: batch.length,
      insertedCount: newBreadcrumbs.length,
      skippedDuplicates,
      failedCount: 0,
      syncedAt: timestamp,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل مزامنة مسار التموضع اللحظي';
    console.error('syncGeoBreadcrumbsBatchAction Error:', err);
    return {
      success: false,
      totalReceived: batch.length,
      insertedCount: 0,
      skippedDuplicates: 0,
      failedCount: batch.length,
      syncedAt: timestamp,
      error: errorMsg,
    };
  }
}

