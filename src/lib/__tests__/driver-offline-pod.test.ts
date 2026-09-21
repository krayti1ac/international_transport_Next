import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  savePodSignatureToOfflineQueue,
  getPodSignaturesOfflineQueue,
  getPodSignaturesQueueCount,
  removePodSignatureOffline,
  clearPodSignaturesQueue,
  processPodSignaturesOfflineQueue,
  saveDriverTaskToOfflineQueue,
  getDriverTasksOfflineQueue,
  getDriverTasksQueueCount,
  removeDriverTaskOffline,
  clearDriverTasksQueue,
  processDriverTasksOfflineQueue,
  getTotalOfflineQueueCount,
  base64ToBlob,
} from '@/lib/offline-sync';
import {
  getAdaptiveCompressionSettings,
  compressImage,
} from '@/lib/image-compressor';

// In-Memory IndexedDB Mock for Vitest Node Environment
class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onupgradeneeded: ((event: any) => void) | null = null;

  triggerSuccess(result: any) {
    this.result = result;
    if (this.onsuccess) this.onsuccess({ target: this });
  }

  triggerError(err: any) {
    this.error = err;
    if (this.onerror) this.onerror({ target: this });
  }

  triggerUpgrade(db: any) {
    this.result = db;
    if (this.onupgradeneeded) this.onupgradeneeded({ target: this });
  }
}

class MockIDBStore {
  data: Map<string, any> = new Map();
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  createIndex() {}

  getAll() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(Array.from(this.data.values()));
    }, 0);
    return req;
  }

  count() {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(this.data.size);
    }, 0);
    return req;
  }

  add(item: any) {
    this.data.set(item.id, item);
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(item.id);
    }, 0);
    return req;
  }

  put(item: any) {
    this.data.set(item.id, item);
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(item.id);
    }, 0);
    return req;
  }

  delete(id: string) {
    this.data.delete(id);
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(undefined);
    }, 0);
    return req;
  }

  clear() {
    this.data.clear();
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(undefined);
    }, 0);
    return req;
  }
}

class MockIDBDatabase {
  stores: Map<string, MockIDBStore> = new Map();

  get objectStoreNames() {
    const keys = Array.from(this.stores.keys());
    return {
      contains: (name: string) => keys.includes(name),
    };
  }

  createObjectStore(name: string) {
    const store = new MockIDBStore(name);
    this.stores.set(name, store);
    return store;
  }

  transaction(storeName: string, _mode: string) {
    const store = this.stores.get(storeName) || this.createObjectStore(storeName);
    const tx = {
      objectStore: () => store,
      oncomplete: null as any,
      onerror: null as any,
      onabort: null as any,
    };
    setTimeout(() => {
      if (tx.oncomplete) tx.oncomplete();
    }, 0);
    return tx;
  }
}

const mockDatabaseInstance = new MockIDBDatabase();

const mockIndexedDB = {
  open: (_name: string, _version: number) => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      if (!mockDatabaseInstance.objectStoreNames.contains('pod_signatures_queue')) {
        req.triggerUpgrade(mockDatabaseInstance);
      }
      req.triggerSuccess(mockDatabaseInstance);
    }, 0);
    return req;
  },
};

// Setup Mock Globals
vi.stubGlobal('indexedDB', mockIndexedDB);
vi.stubGlobal('window', {
  indexedDB: mockIndexedDB,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});
vi.stubGlobal('atob', (b64: string) => Buffer.from(b64, 'base64').toString('binary'));

// Supabase mock handles
const mockStorageUpload = vi.fn().mockResolvedValue({ data: { path: 'proof.png' }, error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.storage/proof.png' } });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: () => ({
      insert: mockInsert,
      update: mockUpdate,
    }),
  }),
}));

describe('Driver Offline e-POD & Roaming Guard (IndexedDB & Image Compressor)', () => {
  beforeEach(async () => {
    mockStorageUpload.mockClear();
    mockGetPublicUrl.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();

    await clearPodSignaturesQueue();
    await clearDriverTasksQueue();
  });

  describe('1. IndexedDB pod_signatures_queue operations', () => {
    it('saves and retrieves a POD signature item in IndexedDB queue', async () => {
      const podItem = await savePodSignatureToOfflineQueue({
        trip_id: 101,
        signed_by: 'Ahmed Benali',
        signature_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        cmr_image_base64: 'data:image/jpeg;base64,dGVzdA==',
        latitude: 35.7595,
        longitude: -5.8340,
        signed_at: '2026-09-18T14:30:00.000Z',
        leg: 'export',
        idempotency_key: 'pod_101_export_ahmed',
      });

      expect(podItem.id).toBeDefined();
      expect(podItem.timestamp).toBeDefined();
      expect(podItem.trip_id).toBe(101);
      expect(podItem.signed_by).toBe('Ahmed Benali');
      expect(podItem.leg).toBe('export');

      const count = await getPodSignaturesQueueCount();
      expect(count).toBe(1);

      const queue = await getPodSignaturesOfflineQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].idempotency_key).toBe('pod_101_export_ahmed');
      expect(queue[0].latitude).toBe(35.7595);
    });

    it('enforces idempotency and prevents duplicate queue insertions', async () => {
      const firstSave = await savePodSignatureToOfflineQueue({
        trip_id: 202,
        signed_by: 'Carlos Mendoza',
        signature_base64: 'data:image/png;base64,sig1',
        signed_at: '2026-09-18T15:00:00.000Z',
        leg: 'import',
        idempotency_key: 'pod_202_import_unique_key',
      });

      // Attempt to save again with the exact same idempotency_key
      const duplicateSave = await savePodSignatureToOfflineQueue({
        trip_id: 202,
        signed_by: 'Carlos Mendoza',
        signature_base64: 'data:image/png;base64,sig2_modified',
        signed_at: '2026-09-18T15:05:00.000Z',
        leg: 'import',
        idempotency_key: 'pod_202_import_unique_key',
      });

      // Both should resolve to the same record
      expect(duplicateSave.id).toBe(firstSave.id);

      // Total count in queue must remain 1
      const count = await getPodSignaturesQueueCount();
      expect(count).toBe(1);
    });

    it('removes a single POD signature atomically by ID', async () => {
      const item1 = await savePodSignatureToOfflineQueue({
        trip_id: 301,
        signed_by: 'Recipient A',
        signature_base64: 'sigA',
        signed_at: new Date().toISOString(),
        idempotency_key: 'key_301',
      });

      const item2 = await savePodSignatureToOfflineQueue({
        trip_id: 302,
        signed_by: 'Recipient B',
        signature_base64: 'sigB',
        signed_at: new Date().toISOString(),
        idempotency_key: 'key_302',
      });

      expect(await getPodSignaturesQueueCount()).toBe(2);

      await removePodSignatureOffline(item1.id);
      expect(await getPodSignaturesQueueCount()).toBe(1);

      const remaining = await getPodSignaturesOfflineQueue();
      expect(remaining[0].id).toBe(item2.id);

      await removePodSignatureOffline(item2.id);
      expect(await getPodSignaturesQueueCount()).toBe(0);
    });
  });

  describe('2. Driver tasks queue operations', () => {
    it('saves, counts, and retrieves driver tasks with idempotency', async () => {
      const task = await saveDriverTaskToOfflineQueue({
        trip_id: 501,
        status: 'in_transit',
        notes: 'Passed Tangier Med port checkpoint',
        idempotency_key: 'task_501_in_transit',
      });

      expect(task.id).toBeDefined();
      expect(task.trip_id).toBe(501);
      expect(await getDriverTasksQueueCount()).toBe(1);

      // Duplicate idempotency check
      const dup = await saveDriverTaskToOfflineQueue({
        trip_id: 501,
        status: 'in_transit',
        notes: 'Duplicate check',
        idempotency_key: 'task_501_in_transit',
      });
      expect(dup.id).toBe(task.id);
      expect(await getDriverTasksQueueCount()).toBe(1);

      const list = await getDriverTasksOfflineQueue();
      expect(list.length).toBe(1);
      expect(list[0].status).toBe('in_transit');

      await removeDriverTaskOffline(task.id);
      expect(await getDriverTasksQueueCount()).toBe(0);
    });

    it('calculates total offline queue items across all stores', async () => {
      await savePodSignatureToOfflineQueue({
        trip_id: 701,
        signed_by: 'Driver 1',
        signature_base64: 'sig',
        signed_at: new Date().toISOString(),
        idempotency_key: 'k1',
      });

      await saveDriverTaskToOfflineQueue({
        trip_id: 702,
        status: 'arrived_customs',
        idempotency_key: 'k2',
      });

      const total = await getTotalOfflineQueueCount();
      expect(total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Offline synchronization pipeline with Supabase', () => {
    it('processes queued POD signatures and uploads files to storage', async () => {
      await savePodSignatureToOfflineQueue({
        trip_id: 801,
        signed_by: 'Logistics Supervisor',
        signature_base64: 'data:image/png;base64,dGVzdHNpZw==',
        cmr_image_base64: 'data:image/jpeg;base64,dGVzdGNtcg==',
        latitude: 36.1408,
        longitude: -5.3536,
        signed_at: '2026-09-18T16:00:00.000Z',
        leg: 'export',
        idempotency_key: 'pod_801_sync',
      });

      expect(await getPodSignaturesQueueCount()).toBe(1);

      let progressCalls = 0;
      const result = await processPodSignaturesOfflineQueue((remaining, total) => {
        progressCalls++;
        expect(total).toBe(1);
      });

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(0);
      expect(progressCalls).toBe(1);

      // Storage upload should be called twice (signature + CMR)
      expect(mockStorageUpload).toHaveBeenCalledTimes(2);

      // Insert into delivery_signatures
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          trip_order_id: 801,
          signed_by: 'Logistics Supervisor',
          signature_url: 'https://test.storage/proof.png',
          latitude: 36.1408,
          longitude: -5.3536,
        })
      );

      // Trip orders table update
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          status: 'delivered',
          cmr_export_url: 'https://test.storage/proof.png',
        })
      );

      // Queue is cleared after success
      expect(await getPodSignaturesQueueCount()).toBe(0);
    });

    it('keeps failed POD items in IndexedDB when network error occurs', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Network connection timeout'));

      await savePodSignatureToOfflineQueue({
        trip_id: 901,
        signed_by: 'Mustafa',
        signature_base64: 'sig_data',
        signed_at: new Date().toISOString(),
        idempotency_key: 'fail_test_key',
      });

      const res = await processPodSignaturesOfflineQueue();
      expect(res.successCount).toBe(0);
      expect(res.failCount).toBe(1);

      // Item must remain in queue for subsequent retry
      expect(await getPodSignaturesQueueCount()).toBe(1);
    });

    it('processes queued driver task updates', async () => {
      await saveDriverTaskToOfflineQueue({
        trip_id: 999,
        status: 'completed',
        idempotency_key: 'task_sync_999',
      });

      const res = await processDriverTasksOfflineQueue();
      expect(res.successCount).toBe(1);
      expect(res.failCount).toBe(0);
      expect(await getDriverTasksQueueCount()).toBe(0);
    });
  });

  describe('4. Adaptive roaming & network quality image compressor', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      // Re-stub base globals
      vi.stubGlobal('indexedDB', mockIndexedDB);
      vi.stubGlobal('window', {
        indexedDB: mockIndexedDB,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      vi.stubGlobal('atob', (b64: string) => Buffer.from(b64, 'base64').toString('binary'));
    });

    it('activates roaming/weak network profile when saveData is true', () => {
      vi.stubGlobal('navigator', {
        connection: {
          saveData: true,
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
        },
      });

      const settings = getAdaptiveCompressionSettings();
      expect(settings.isRoamingOrWeak).toBe(true);
      expect(settings.quality).toBe(0.5);
      expect(settings.maxWidth).toBe(800);
      expect(settings.maxHeight).toBe(800);
    });

    it('activates roaming/weak network profile on 2G or 3G networks', () => {
      vi.stubGlobal('navigator', {
        connection: {
          saveData: false,
          effectiveType: '2g',
          downlink: 0.3,
          rtt: 800,
        },
      });

      const settings2G = getAdaptiveCompressionSettings();
      expect(settings2G.isRoamingOrWeak).toBe(true);
      expect(settings2G.quality).toBe(0.5);
      expect(settings2G.maxWidth).toBe(800);

      vi.stubGlobal('navigator', {
        connection: {
          saveData: false,
          effectiveType: '3g',
          downlink: 1.0,
          rtt: 400,
        },
      });

      const settings3G = getAdaptiveCompressionSettings();
      expect(settings3G.isRoamingOrWeak).toBe(true);
      expect(settings3G.quality).toBe(0.5);
      expect(settings3G.maxWidth).toBe(800);
    });

    it('activates high-speed profile on fast Wi-Fi and 4G', () => {
      vi.stubGlobal('navigator', {
        connection: {
          saveData: false,
          effectiveType: '4g',
          downlink: 25,
          rtt: 35,
        },
      });

      const settingsFast = getAdaptiveCompressionSettings();
      expect(settingsFast.isRoamingOrWeak).toBe(false);
      expect(settingsFast.quality).toBe(0.75);
      expect(settingsFast.maxWidth).toBe(1280);
      expect(settingsFast.maxHeight).toBe(1280);
    });

    it('falls back safely when navigator.connection is not supported', () => {
      vi.stubGlobal('navigator', {});

      const settingsFallback = getAdaptiveCompressionSettings();
      expect(settingsFallback.isRoamingOrWeak).toBe(false);
      expect(settingsFallback.quality).toBe(0.75);
      expect(settingsFallback.maxWidth).toBe(1280);
    });

    it('correctly converts base64 strings to Blobs', () => {
      const blob = base64ToBlob('dGVzdA==', 'image/jpeg');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('safely handles compressImage for files in non-DOM environments', async () => {
      const file = new File(['dummy-content'], 'test.txt', { type: 'text/plain' });
      const result = await compressImage(file);
      expect(result).toBe(file);
    });
  });
});
