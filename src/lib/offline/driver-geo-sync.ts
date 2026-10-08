import {
  getPendingBreadcrumbs,
  getPendingBreadcrumbsCount,
  removeBreadcrumbs,
} from './driver-geo-db';
import { syncGeoBreadcrumbsBatchAction } from '@/features/tracking/services/geo-queue-sync.actions';
import type { GeoSyncBatchResult } from '@/features/tracking/types/offline-geolocation.types';

let isSyncingGeoQueue = false;

/**
 * Synchronizes pending offline GPS breadcrumbs from IndexedDB in chunks to Supabase.
 * Returns progress summary.
 */
export async function flushOfflineGeoBreadcrumbs(
  batchSize = 50
): Promise<{
  totalSynced: number;
  totalFailed: number;
  remaining: number;
}> {
  if (isSyncingGeoQueue) {
    const remaining = await getPendingBreadcrumbsCount();
    return { totalSynced: 0, totalFailed: 0, remaining };
  }

  // Network check: Only abort if running in browser and explicitly offline
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false) {
    const remaining = await getPendingBreadcrumbsCount();
    return { totalSynced: 0, totalFailed: 0, remaining };
  }

  isSyncingGeoQueue = true;
  let totalSynced = 0;
  let totalFailed = 0;

  try {
    let pending = await getPendingBreadcrumbs(batchSize);

    while (pending.length > 0) {
      const result: GeoSyncBatchResult = await syncGeoBreadcrumbsBatchAction(pending);

      if (result.success) {
        const syncedIds = pending.map((p) => p.id);
        await removeBreadcrumbs(syncedIds);
        totalSynced += result.insertedCount + result.skippedDuplicates;
      } else {
        totalFailed += pending.length;
        // Break to avoid infinite loop on network/server errors
        break;
      }

      // Read next chunk
      pending = await getPendingBreadcrumbs(batchSize);
    }
  } catch (err) {
    console.error('Error during flushOfflineGeoBreadcrumbs:', err);
  } finally {
    isSyncingGeoQueue = false;
  }

  const remaining = await getPendingBreadcrumbsCount();
  return { totalSynced, totalFailed, remaining };
}

/**
 * Initializes automatic background synchronization on network reconnect.
 */
export function initAutonomousGeoSyncListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    flushOfflineGeoBreadcrumbs();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
