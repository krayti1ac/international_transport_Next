import type {
  GeoBreadcrumbPoint,
  AutonomousTrackingConfig,
} from '@/features/tracking/types/offline-geolocation.types';
import { DEFAULT_TRACKING_CONFIG } from '@/features/tracking/types/offline-geolocation.types';

export const GEO_DB_NAME = 'transbodanon_driver_geo_db';
export const GEO_DB_VERSION = 1;
export const GEO_QUEUE_STORE = 'geo_breadcrumbs_queue';

// In-memory fallback cache for Node.js / SSR / Unit testing environments
const inMemoryBreadcrumbsStore: Map<string, GeoBreadcrumbPoint> = new Map();
let inMemoryLastPoint: GeoBreadcrumbPoint | null = null;

/**
 * Calculates great-circle distance between two geographic coordinates using Haversine formula (in meters).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Opens or initializes the Driver Autonomous Geolocation IndexedDB Database.
 */
export function openDriverGeoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is unavailable in this environment'));
    }

    const request = indexedDB.open(GEO_DB_NAME, GEO_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(GEO_QUEUE_STORE)) {
        const store = db.createObjectStore(GEO_QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open driver geo database'));
  });
}

/**
 * Enqueues a geographic breadcrumb point with Deadband distance & Pruning Guard.
 * Returns true if enqueued, false if skipped by deadband filter.
 */
export async function enqueueBreadcrumb(
  point: GeoBreadcrumbPoint,
  config: AutonomousTrackingConfig = DEFAULT_TRACKING_CONFIG
): Promise<boolean> {
  // 1. Accuracy Guard: Discard points with excessive GPS error (> 100m)
  if (point.accuracy && point.accuracy > config.maxAccuracyThresholdMeters) {
    return false;
  }

  // 2. Deadband Distance Guard: Compare with last recorded point
  const lastPoint = await getLastRecordedBreadcrumb();
  if (lastPoint) {
    const distanceMeters = calculateHaversineDistance(
      lastPoint.latitude,
      lastPoint.longitude,
      point.latitude,
      point.longitude
    );

    const isVerySlow = !point.speed || point.speed < 5;
    // If movement is within deadband noise threshold and stationary, skip writing
    if (distanceMeters < config.deadbandDistanceMeters && isVerySlow) {
      return false;
    }
  }

  // 3. Fallback for non-browser / test environments
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    // Prune if limit reached
    if (inMemoryBreadcrumbsStore.size >= config.maxBreadcrumbsQueueSize) {
      const oldestKey = inMemoryBreadcrumbsStore.keys().next().value;
      if (oldestKey) inMemoryBreadcrumbsStore.delete(oldestKey);
    }
    inMemoryBreadcrumbsStore.set(point.id, point);
    inMemoryLastPoint = point;
    return true;
  }

  // 4. IndexedDB Execution
  const db = await openDriverGeoDB();

  // Pruning Guard: Ensure queue does not exceed max capacity
  const count = await getPendingBreadcrumbsCount();
  if (count >= config.maxBreadcrumbsQueueSize) {
    await pruneOldBreadcrumbs(Math.max(1, Math.floor(config.maxBreadcrumbsQueueSize * 0.1)));
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(GEO_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(GEO_QUEUE_STORE);
    const req = store.put(point);

    req.onsuccess = () => {
      inMemoryLastPoint = point;
      resolve(true);
    };
    req.onerror = () => reject(req.error || new Error('Failed to enqueue breadcrumb'));
  });
}

/**
 * Retrieves the latest recorded breadcrumb point.
 */
export async function getLastRecordedBreadcrumb(): Promise<GeoBreadcrumbPoint | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return inMemoryLastPoint;
  }

  try {
    const db = await openDriverGeoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(GEO_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(GEO_QUEUE_STORE);

      if (typeof store.index !== 'function') {
        resolve(inMemoryLastPoint);
        return;
      }

      const index = store.index('timestamp');
      const req = index.openCursor(null, 'prev'); // Latest first

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          resolve(cursor.value as GeoBreadcrumbPoint);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(inMemoryLastPoint);
    });
  } catch {
    return inMemoryLastPoint;
  }
}

/**
 * Retrieves pending (unsynced) breadcrumbs up to the specified limit.
 */
export async function getPendingBreadcrumbs(limit = 50): Promise<GeoBreadcrumbPoint[]> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    const all = Array.from(inMemoryBreadcrumbsStore.values()).filter((p) => !p.synced);
    return all.slice(0, limit);
  }

  try {
    const db = await openDriverGeoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(GEO_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(GEO_QUEUE_STORE);

      if (typeof store.index !== 'function') {
        if (typeof store.getAll === 'function') {
          const req = store.getAll();
          req.onsuccess = () => {
            const all = ((req.result as GeoBreadcrumbPoint[]) || []).filter((p) => !p.synced);
            resolve(all.slice(0, limit));
          };
          req.onerror = () => resolve(Array.from(inMemoryBreadcrumbsStore.values()).slice(0, limit));
          return;
        }
        resolve(Array.from(inMemoryBreadcrumbsStore.values()).slice(0, limit));
        return;
      }

      const index = store.index('timestamp');
      const req = index.openCursor();
      const results: GeoBreadcrumbPoint[] = [];

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && results.length < limit) {
          const item = cursor.value as GeoBreadcrumbPoint;
          if (!item.synced) {
            results.push(item);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error || new Error('Failed to retrieve pending breadcrumbs'));
    });
  } catch (err) {
    console.error('Error fetching pending breadcrumbs:', err);
    return [];
  }
}

/**
 * Returns total count of pending breadcrumbs in the local queue.
 */
export async function getPendingBreadcrumbsCount(): Promise<number> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Array.from(inMemoryBreadcrumbsStore.values()).filter((p) => !p.synced).length;
  }

  try {
    const db = await openDriverGeoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(GEO_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(GEO_QUEUE_STORE);
      const req = store.count();

      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Removes successfully synchronized breadcrumbs by IDs.
 */
export async function removeBreadcrumbs(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;

  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    for (const id of ids) {
      inMemoryBreadcrumbsStore.delete(id);
    }
    return;
  }

  const db = await openDriverGeoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GEO_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(GEO_QUEUE_STORE);

    for (const id of ids) {
      store.delete(id);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete breadcrumbs'));
  });
}

/**
 * Prunes the oldest N breadcrumbs to enforce the memory ceiling.
 */
export async function pruneOldBreadcrumbs(countToPrune = 500): Promise<number> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    let pruned = 0;
    for (const key of inMemoryBreadcrumbsStore.keys()) {
      if (pruned >= countToPrune) break;
      inMemoryBreadcrumbsStore.delete(key);
      pruned++;
    }
    return pruned;
  }

  const db = await openDriverGeoDB();
  return new Promise((resolve) => {
    const tx = db.transaction(GEO_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(GEO_QUEUE_STORE);

    if (typeof store.index !== 'function') {
      resolve(0);
      return;
    }

    const index = store.index('timestamp');
    const req = index.openCursor();
    let pruned = 0;

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && pruned < countToPrune) {
        cursor.delete();
        pruned++;
        cursor.continue();
      } else {
        resolve(pruned);
      }
    };
    req.onerror = () => resolve(0);
  });
}

/**
 * Clears all items from the driver geo queue.
 */
export async function clearBreadcrumbsQueue(): Promise<void> {
  inMemoryBreadcrumbsStore.clear();
  inMemoryLastPoint = null;

  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDriverGeoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GEO_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(GEO_QUEUE_STORE);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to clear breadcrumbs store'));
  });
}

