import { createClient } from '@/lib/supabase/browser';

export interface QueuedReceipt {
  id: string;
  truck_id: number | null;
  amount: number;
  currency: string;
  date: string;
  notes: string;
  imageDataBase64?: string;
  fileName?: string;
  timestamp: string;
  idempotency_key?: string;
  receipt_number?: string;
}

export interface QueuedPodSignature {
  id: string;
  trip_id: number;
  signed_by: string;
  signature_base64: string;
  cmr_image_base64?: string;
  latitude?: number;
  longitude?: number;
  signed_at: string;
  leg?: 'export' | 'import';
  idempotency_key: string;
  timestamp: string;
  retryCount?: number;
  lastError?: string;
}

export interface QueuedDriverTask {
  id: string;
  trip_id: number;
  status: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  idempotency_key: string;
  timestamp: string;
  retryCount?: number;
  lastError?: string;
}

export const DB_NAME = 'transbodanon_offline_db';
export const DB_VERSION = 2;
export const STORE_NAME = 'fuel_receipts_queue';
export const POD_STORE_NAME = 'pod_signatures_queue';
export const DRIVER_TASKS_STORE_NAME = 'driver_tasks_queue';
export const LEGACY_STORAGE_KEY = 'offline_fuel_receipts_queue';

/**
 * Converts a base64 or data URL string to a standard Blob.
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let j = 0; j < byteCharacters.length; j++) {
    byteNumbers[j] = byteCharacters.charCodeAt(j);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Opens and initializes the IndexedDB database for offline storage (Receipts, POD Signatures, Driver Tasks).
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Fuel Receipts store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('truck_id', 'truck_id', { unique: false });
        store.createIndex('idempotency_key', 'idempotency_key', { unique: false });
      }

      // 2. Proof of Delivery (POD) Signatures queue
      if (!db.objectStoreNames.contains(POD_STORE_NAME)) {
        const podStore = db.createObjectStore(POD_STORE_NAME, { keyPath: 'id' });
        podStore.createIndex('trip_id', 'trip_id', { unique: false });
        podStore.createIndex('timestamp', 'timestamp', { unique: false });
        podStore.createIndex('idempotency_key', 'idempotency_key', { unique: false });
      }

      // 3. Driver Tasks queue
      if (!db.objectStoreNames.contains(DRIVER_TASKS_STORE_NAME)) {
        const taskStore = db.createObjectStore(DRIVER_TASKS_STORE_NAME, { keyPath: 'id' });
        taskStore.createIndex('trip_id', 'trip_id', { unique: false });
        taskStore.createIndex('timestamp', 'timestamp', { unique: false });
        taskStore.createIndex('idempotency_key', 'idempotency_key', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB database'));
    };
  });
}

/**
 * Seamlessly migrates legacy localStorage queue to IndexedDB to prevent data loss.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    const legacyQueue: QueuedReceipt[] = JSON.parse(raw);
    if (Array.isArray(legacyQueue) && legacyQueue.length > 0) {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const item of legacyQueue) {
          if (item && item.id) {
            store.put(item);
          }
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Migration transaction aborted'));
      });
    }

    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to migrate offline queue from localStorage:', err);
  }
}

async function ensureMigrated(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      await migrateFromLocalStorage();
    }
  } catch {
    // Ignore localStorage access restrictions
  }
}

/* =========================================================================
   1. Fuel Receipts Queue Management
   ========================================================================= */

/**
 * Retrieves all pending offline receipts from IndexedDB.
 */
export async function getOfflineQueue(): Promise<QueuedReceipt[]> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return [];

  try {
    await ensureMigrated();
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as QueuedReceipt[]) || []);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to read offline queue'));
      };
    });
  } catch (err) {
    console.error('Error reading offline receipts queue:', err);
    return [];
  }
}

/**
 * Fast count of pending offline receipts without loading full Base64 images into memory.
 */
export async function getOfflineQueueCount(): Promise<number> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return 0;

  try {
    await ensureMigrated();
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result || 0);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to count offline receipts'));
      };
    });
  } catch {
    return 0;
  }
}

/**
 * Persists a new receipt into IndexedDB with payload size validation and idempotency verification.
 * If an item with the same idempotency_key or receipt_number already exists, returns the existing record without duplicate insertion.
 */
export async function saveToOfflineQueue(
  item: Omit<QueuedReceipt, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<QueuedReceipt> {
  await ensureMigrated();

  // Generate deterministic/unique idempotency key if not provided
  const idempotencyKey =
    item.idempotency_key ||
    `fuel_${item.truck_id ?? 'no_truck'}_${item.amount}_${item.date}_${Math.random().toString(36).substring(2, 8)}`;

  // Deduplication check: check if same receipt or idempotency key is already queued
  const existingQueue = await getOfflineQueue();
  const existing = existingQueue.find(
    (q) =>
      (q.idempotency_key && q.idempotency_key === idempotencyKey) ||
      (item.receipt_number && q.receipt_number && q.receipt_number === item.receipt_number)
  );
  if (existing) {
    return existing;
  }

  const newItem: QueuedReceipt = {
    ...item,
    id: item.id || `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: item.timestamp || new Date().toISOString(),
    idempotency_key: idempotencyKey,
  };

  // Pre-storage payload sanity check (warn if uncompressed image exceeds 10MB)
  if (item.imageDataBase64 && item.imageDataBase64.length > 10 * 1024 * 1024) {
    console.warn('Warning: High payload size for queued offline receipt image (>10MB). Image compression recommended.');
  }

  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return newItem;
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(newItem);

    request.onsuccess = () => {
      resolve(newItem);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to save receipt to IndexedDB'));
    };
  });
}

/**
 * Deletes a single synced receipt from IndexedDB by ID.
 */
export async function removeOfflineReceipt(id: string): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`Failed to remove receipt ${id}`));
  });
}

/**
 * Clears all receipts from the offline IndexedDB store.
 */
export async function clearOfflineQueue(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to clear offline queue'));
  });
}

/**
 * Synchronous legacy fallback helper for backward compatibility.
 * @deprecated Use async `getOfflineQueue()` instead.
 */
export function getOfflineQueueSync(): QueuedReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Synchronizes offline receipts with Supabase Storage and `truck_maintenance` table.
 * Deletes successfully synced items individually to prevent race conditions.
 */
export async function processOfflineQueue(
  onProgress?: (remaining: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { successCount: 0, failCount: 0 };

  const supabase = createClient();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      // 1. Append-Only Idempotency Guard:
      // Verify if a record with the same truck, amount, and date already exists in truck_maintenance
      if (item.truck_id) {
        try {
          const maintenanceTable = supabase.from('truck_maintenance') as any;
          if (typeof maintenanceTable.select === 'function') {
            const { data: existingRecords } = await maintenanceTable
              .select('id')
              .eq('truck_id', item.truck_id)
              .eq('amount', item.amount)
              .eq('date', item.date)
              .limit(1);

            if (existingRecords && existingRecords.length > 0) {
              // Record already exists on server: safely remove from offline queue without duplicate insertion
              await removeOfflineReceipt(item.id);
              successCount++;
              if (onProgress) {
                onProgress(queue.length - (i + 1), queue.length);
              }
              continue;
            }
          }
        } catch {
          // If query fails, proceed to regular insert
        }
      }

      let publicImageUrl = '';

      if (item.imageDataBase64 && item.fileName) {
        const blob = base64ToBlob(item.imageDataBase64, 'image/jpeg');
        const uploadRes = await supabase.storage.from('fuel-receipts').upload(item.fileName, blob);
        if (!uploadRes.error) {
          const urlRes = supabase.storage.from('fuel-receipts').getPublicUrl(item.fileName);
          publicImageUrl = urlRes.data.publicUrl;
        }
      }

      const noteParts = [
        item.notes,
        item.receipt_number ? `رقم الإيصال: ${item.receipt_number}` : null,
        item.idempotency_key ? `مفتاح المطابقة: ${item.idempotency_key}` : null,
        publicImageUrl ? `رابط الإيصال: ${publicImageUrl}` : null,
      ].filter(Boolean);
      const finalNotes = noteParts.join('\n\n');

      const { error } = await supabase.from('truck_maintenance').insert({
        truck_id: item.truck_id,
        type: 'fuel',
        expense_type: 'fuel',
        amount: item.amount,
        currency: item.currency || 'MAD',
        date: item.date,
        maintenance_date: item.date || new Date().toISOString(),
        notes: finalNotes,
        description: finalNotes,
        payment_method: 'cash',
      });

      if (error) throw error;

      // Successfully saved to Supabase: atomically remove from IndexedDB
      await removeOfflineReceipt(item.id);
      successCount++;
    } catch (err) {
      console.error('فشل مزامنة عنصر غير متصل:', err);
      failCount++;
    }

    if (onProgress) {
      onProgress(queue.length - (i + 1), queue.length);
    }
  }

  return { successCount, failCount };
}

/* =========================================================================
   2. Proof of Delivery (POD) Signatures Queue Management
   ========================================================================= */

/**
 * Retrieves all pending offline POD signatures from IndexedDB.
 */
export async function getPodSignaturesOfflineQueue(): Promise<QueuedPodSignature[]> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return [];

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(POD_STORE_NAME)) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(POD_STORE_NAME, 'readonly');
      const store = tx.objectStore(POD_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as QueuedPodSignature[]) || []);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to read offline POD signatures queue'));
      };
    });
  } catch (err) {
    console.error('Error reading offline POD signatures queue:', err);
    return [];
  }
}

/**
 * Fast count of pending offline POD signatures.
 */
export async function getPodSignaturesQueueCount(): Promise<number> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return 0;

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(POD_STORE_NAME)) return 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(POD_STORE_NAME, 'readonly');
      const store = tx.objectStore(POD_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result || 0);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to count offline POD signatures'));
      };
    });
  } catch {
    return 0;
  }
}

/**
 * Persists a POD signature into IndexedDB with idempotency verification.
 * If an item with the same `idempotency_key` already exists, returns the existing record without duplicate insertion.
 */
export async function savePodSignatureToOfflineQueue(
  item: Omit<QueuedPodSignature, 'id' | 'timestamp'>
): Promise<QueuedPodSignature> {
  // Check for duplicate submission via idempotency key
  if (item.idempotency_key) {
    const existingQueue = await getPodSignaturesOfflineQueue();
    const existing = existingQueue.find((q) => q.idempotency_key === item.idempotency_key);
    if (existing) {
      return existing;
    }
  }

  const newItem: QueuedPodSignature = {
    ...item,
    id: `pod_queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    retryCount: item.retryCount || 0,
  };

  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return newItem;
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(POD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(POD_STORE_NAME);
    const request = store.add(newItem);

    request.onsuccess = () => {
      resolve(newItem);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to save POD signature to IndexedDB'));
    };
  });
}

/**
 * Deletes a single synced POD signature from IndexedDB by ID.
 */
export async function removePodSignatureOffline(id: string): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDB();
  if (!db.objectStoreNames.contains(POD_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(POD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(POD_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`Failed to remove POD signature ${id}`));
  });
}

/**
 * Clears all POD signatures from the offline IndexedDB store.
 */
export async function clearPodSignaturesQueue(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDB();
  if (!db.objectStoreNames.contains(POD_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(POD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(POD_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to clear offline POD queue'));
  });
}

/**
 * Synchronizes pending POD signatures with Supabase Storage and `delivery_signatures` / `trip_orders`.
 * Deletes successfully synced items individually to prevent race conditions.
 */
export async function processPodSignaturesOfflineQueue(
  onProgress?: (remaining: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  const queue = await getPodSignaturesOfflineQueue();
  if (queue.length === 0) return { successCount: 0, failCount: 0 };

  const supabase = createClient();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      const timestamp = Date.now();
      const signatureFileName = `signature-${item.trip_id}-${timestamp}.png`;
      const cmrFileName = `cmr-${item.trip_id}-${timestamp}.jpg`;

      // 1. Upload signature image to delivery-proofs bucket
      const sigBlob = base64ToBlob(item.signature_base64, 'image/png');
      const sigUpload = await supabase.storage
        .from('delivery-proofs')
        .upload(signatureFileName, sigBlob, { contentType: 'image/png', upsert: true });

      if (sigUpload.error) throw sigUpload.error;

      const { data: { publicUrl: signatureUrl } } = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(signatureFileName);

      // 2. Upload CMR image if present
      let cmrUrl: string | undefined;
      if (item.cmr_image_base64) {
        const cmrBlob = base64ToBlob(item.cmr_image_base64, 'image/jpeg');
        const cmrUpload = await supabase.storage
          .from('delivery-proofs')
          .upload(cmrFileName, cmrBlob, { contentType: 'image/jpeg', upsert: true });

        if (cmrUpload.error) throw cmrUpload.error;

        const { data: { publicUrl } } = supabase.storage
          .from('delivery-proofs')
          .getPublicUrl(cmrFileName);
        cmrUrl = publicUrl;
      }

      // 3. Insert into delivery_signatures table if not already existing
      let shouldInsertSignature = true;
      const sigTable = supabase.from('delivery_signatures') as any;
      if (typeof sigTable.select === 'function') {
        try {
          const { data: existingSig } = await sigTable
            .select('id')
            .eq('trip_order_id', item.trip_id)
            .maybeSingle();
          if (existingSig) {
            shouldInsertSignature = false;
          }
        } catch {
          // If query fails, continue to insert
        }
      }

      if (shouldInsertSignature) {
        const { error: insertError } = await supabase
          .from('delivery_signatures')
          .insert({
            trip_order_id: item.trip_id,
            signature_url: signatureUrl,
            cmr_image_url: cmrUrl,
            signed_by: item.signed_by,
            signed_at: item.signed_at || new Date().toISOString(),
            latitude: item.latitude,
            longitude: item.longitude,
          });

        if (insertError) throw insertError;
      }

      // 4. Update trip order status to 'delivered' and attach CMR URLs
      const updateData: Record<string, unknown> = {
        status: 'delivered',
        updated_at: new Date().toISOString(),
      };
      if (cmrUrl) {
        if (item.leg === 'export') {
          updateData.cmr_export_url = cmrUrl;
        } else {
          updateData.cmr_import_url = cmrUrl;
        }
      }

      const { error: updateError } = await supabase
        .from('trip_orders')
        .update(updateData)
        .eq('id', item.trip_id);

      if (updateError) throw updateError;

      // 5. Successfully synced: remove from IndexedDB
      await removePodSignatureOffline(item.id);
      successCount++;
    } catch (err) {
      console.error('فشل مزامنة إثبات التسليم (POD):', err);
      failCount++;
    }

    if (onProgress) {
      onProgress(queue.length - (i + 1), queue.length);
    }
  }

  return { successCount, failCount };
}

/* =========================================================================
   3. Driver Tasks Queue Management
   ========================================================================= */

/**
 * Retrieves all pending offline driver task updates from IndexedDB.
 */
export async function getDriverTasksOfflineQueue(): Promise<QueuedDriverTask[]> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return [];

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(DRIVER_TASKS_STORE_NAME)) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRIVER_TASKS_STORE_NAME, 'readonly');
      const store = tx.objectStore(DRIVER_TASKS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as QueuedDriverTask[]) || []);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to read offline driver tasks queue'));
      };
    });
  } catch (err) {
    console.error('Error reading offline driver tasks queue:', err);
    return [];
  }
}

/**
 * Fast count of pending offline driver tasks.
 */
export async function getDriverTasksQueueCount(): Promise<number> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return 0;

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(DRIVER_TASKS_STORE_NAME)) return 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRIVER_TASKS_STORE_NAME, 'readonly');
      const store = tx.objectStore(DRIVER_TASKS_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result || 0);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to count offline driver tasks'));
      };
    });
  } catch {
    return 0;
  }
}

/**
 * Persists a driver task update into IndexedDB with idempotency verification.
 */
export async function saveDriverTaskToOfflineQueue(
  item: Omit<QueuedDriverTask, 'id' | 'timestamp'>
): Promise<QueuedDriverTask> {
  if (item.idempotency_key) {
    const existingQueue = await getDriverTasksOfflineQueue();
    const existing = existingQueue.find((q) => q.idempotency_key === item.idempotency_key);
    if (existing) {
      return existing;
    }
  }

  const newItem: QueuedDriverTask = {
    ...item,
    id: `task_queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    retryCount: item.retryCount || 0,
  };

  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return newItem;
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRIVER_TASKS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(DRIVER_TASKS_STORE_NAME);
    const request = store.add(newItem);

    request.onsuccess = () => {
      resolve(newItem);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to save driver task to IndexedDB'));
    };
  });
}

/**
 * Deletes a single synced driver task from IndexedDB by ID.
 */
export async function removeDriverTaskOffline(id: string): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDB();
  if (!db.objectStoreNames.contains(DRIVER_TASKS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRIVER_TASKS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(DRIVER_TASKS_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`Failed to remove driver task ${id}`));
  });
}

/**
 * Clears all driver tasks from the offline IndexedDB store.
 */
export async function clearDriverTasksQueue(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openDB();
  if (!db.objectStoreNames.contains(DRIVER_TASKS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRIVER_TASKS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(DRIVER_TASKS_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to clear offline driver tasks queue'));
  });
}

/**
 * Synchronizes offline driver tasks with `trip_orders` using Last-Write-Wins (LWW) conflict resolution.
 * If server `updated_at` is newer than the client `timestamp`, the stale offline task is discarded
 * and the authoritative server state is retained.
 */
export async function processDriverTasksOfflineQueue(): Promise<{ successCount: number; failCount: number }> {
  const queue = await getDriverTasksOfflineQueue();
  if (queue.length === 0) return { successCount: 0, failCount: 0 };

  const supabase = createClient();
  let successCount = 0;
  let failCount = 0;

  for (const item of queue) {
    try {
      // 1. Last-Write-Wins (LWW) Conflict Resolution:
      // Verify if server state was updated after the driver's queued offline action
      let shouldDiscardStale = false;
      const tripOrdersTable = supabase.from('trip_orders') as any;
      if (typeof tripOrdersTable.select === 'function') {
        try {
          const { data: serverTrip } = await tripOrdersTable
            .select('id, status, updated_at')
            .eq('id', item.trip_id)
            .maybeSingle();

          if (serverTrip && serverTrip.updated_at) {
            const serverTime = new Date(serverTrip.updated_at).getTime();
            const clientTime = new Date(item.timestamp).getTime();
            if (serverTime > clientTime) {
              // Server has a more recent update than this offline action: discard stale item
              shouldDiscardStale = true;
              console.warn(
                `[LWW Conflict] Discarding stale driver task for trip #${item.trip_id}. Server updated_at (${serverTrip.updated_at}) > Client timestamp (${item.timestamp})`
              );
            }
          }
        } catch {
          // If query fails, fall back to applying update
        }
      }

      if (shouldDiscardStale) {
        await removeDriverTaskOffline(item.id);
        successCount++;
        continue;
      }

      // 2. Client update is current or newer: apply to trip_orders
      const { error } = await supabase
        .from('trip_orders')
        .update({
          status: item.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.trip_id);

      if (error) throw error;

      await removeDriverTaskOffline(item.id);
      successCount++;
    } catch (err) {
      console.error('فشل مزامنة مرحلة الرحلة:', err);
      failCount++;
    }
  }

  return { successCount, failCount };
}

/* =========================================================================
   4. Aggregate Offline Queues Utilities
   ========================================================================= */

/**
 * Returns total count of all pending offline actions across all stores.
 */
export async function getTotalOfflineQueueCount(): Promise<number> {
  const [receipts, pods, tasks] = await Promise.all([
    getOfflineQueueCount(),
    getPodSignaturesQueueCount(),
    getDriverTasksQueueCount(),
  ]);
  return receipts + pods + tasks;
}

/**
 * Triggers complete synchronization across all offline queues.
 */
export async function processAllOfflineQueues(
  onProgress?: (totalRemaining: number) => void
): Promise<{
  receipts: { successCount: number; failCount: number };
  pods: { successCount: number; failCount: number };
  tasks: { successCount: number; failCount: number };
}> {
  const [receiptsRes, podsRes, tasksRes] = await Promise.all([
    processOfflineQueue(),
    processPodSignaturesOfflineQueue(),
    processDriverTasksOfflineQueue(),
  ]);

  if (onProgress) {
    const remaining = await getTotalOfflineQueueCount();
    onProgress(remaining);
  }

  return {
    receipts: receiptsRes,
    pods: podsRes,
    tasks: tasksRes,
  };
}
