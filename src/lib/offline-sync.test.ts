import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create an in-memory IndexedDB mock for node environment testing
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
      if (!mockDatabaseInstance.objectStoreNames.contains('fuel_receipts_queue')) {
        req.triggerUpgrade(mockDatabaseInstance);
      }
      req.triggerSuccess(mockDatabaseInstance);
    }, 0);
    return req;
  },
};

const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => localStorageStore[key] || null,
  setItem: (key: string, val: string) => {
    localStorageStore[key] = val;
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
  clear: () => {
    for (const k of Object.keys(localStorageStore)) {
      delete localStorageStore[k];
    }
  },
};

// Setup globals before importing
vi.stubGlobal('window', {
  indexedDB: mockIndexedDB,
  localStorage: mockLocalStorage,
});
vi.stubGlobal('indexedDB', mockIndexedDB);
vi.stubGlobal('localStorage', mockLocalStorage);
vi.stubGlobal('atob', (b64: string) => Buffer.from(b64, 'base64').toString('binary'));

// Mock Supabase
const mockStorageUpload = vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.storage/test.jpg' } });
const mockInsert = vi.fn().mockResolvedValue({ error: null });

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
    }),
  }),
}));

describe('Offline Receipts Queue (IndexedDB)', () => {
  beforeEach(async () => {
    mockLocalStorage.clear();
    mockStorageUpload.mockClear();
    mockGetPublicUrl.mockClear();
    mockInsert.mockClear();

    const { clearOfflineQueue } = await import('@/lib/offline-sync');
    await clearOfflineQueue();
  });

  it('saves and retrieves items in IndexedDB queue', async () => {
    const { saveToOfflineQueue, getOfflineQueue, getOfflineQueueCount } = await import('@/lib/offline-sync');

    const receipt = await saveToOfflineQueue({
      truck_id: 12,
      amount: 450,
      currency: 'MAD',
      date: '2026-09-18',
      notes: 'تعبئة وقود محطة أفريقيا',
      imageDataBase64: 'data:image/jpeg;base64,dGVzdA==',
      fileName: 'offline-test.jpg',
    });

    expect(receipt.id).toBeDefined();
    expect(receipt.timestamp).toBeDefined();
    expect(receipt.amount).toBe(450);

    const count = await getOfflineQueueCount();
    expect(count).toBe(1);

    const queue = await getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].amount).toBe(450);
    expect(queue[0].truck_id).toBe(12);
  });

  it('removes a specific receipt from IndexedDB', async () => {
    const { saveToOfflineQueue, getOfflineQueueCount, removeOfflineReceipt } = await import('@/lib/offline-sync');

    const receipt1 = await saveToOfflineQueue({
      truck_id: 1,
      amount: 100,
      currency: 'MAD',
      date: '2026-09-18',
      notes: 'Receipt 1',
    });

    const receipt2 = await saveToOfflineQueue({
      truck_id: 2,
      amount: 200,
      currency: 'MAD',
      date: '2026-09-18',
      notes: 'Receipt 2',
    });

    expect(await getOfflineQueueCount()).toBe(2);

    await removeOfflineReceipt(receipt1.id);
    expect(await getOfflineQueueCount()).toBe(1);

    await removeOfflineReceipt(receipt2.id);
    expect(await getOfflineQueueCount()).toBe(0);
  });

  it('automatically migrates legacy localStorage queue to IndexedDB', async () => {
    const legacyItem = {
      id: 'legacy_123',
      truck_id: 5,
      amount: 750,
      currency: 'MAD',
      date: '2026-09-17',
      notes: 'إيصال قديم محفوظ في localStorage',
      timestamp: '2026-09-17T10:00:00.000Z',
    };

    mockLocalStorage.setItem('offline_fuel_receipts_queue', JSON.stringify([legacyItem]));

    const { getOfflineQueue, getOfflineQueueCount } = await import('@/lib/offline-sync');
    const queue = await getOfflineQueue();

    const migrated = queue.find((r) => r.id === 'legacy_123');
    expect(migrated).toBeDefined();
    expect(migrated?.amount).toBe(750);
    expect(await getOfflineQueueCount()).toBeGreaterThanOrEqual(1);

    // Legacy storage key should be deleted after migration
    expect(mockLocalStorage.getItem('offline_fuel_receipts_queue')).toBeNull();
  });

  it('processes offline queue and syncs with Supabase', async () => {
    const { saveToOfflineQueue, processOfflineQueue, getOfflineQueueCount } = await import('@/lib/offline-sync');

    await saveToOfflineQueue({
      truck_id: 8,
      amount: 600,
      currency: 'MAD',
      date: '2026-09-18',
      notes: 'إيصال المزامنة',
      imageDataBase64: 'data:image/jpeg;base64,dGVzdA==',
      fileName: 'sync-receipt.jpg',
    });

    expect(await getOfflineQueueCount()).toBe(1);

    let progressCalls = 0;
    const result = await processOfflineQueue((remaining, total) => {
      progressCalls++;
      expect(total).toBe(1);
    });

    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(0);
    expect(progressCalls).toBe(1);
    expect(mockStorageUpload).toHaveBeenCalledWith('sync-receipt.jpg', expect.any(Object));
    expect(mockInsert).toHaveBeenCalled();

    // After successful sync, the queue in IndexedDB should be empty
    expect(await getOfflineQueueCount()).toBe(0);
  });

  it('keeps failed items in IndexedDB for retry', async () => {
    mockInsert.mockRejectedValueOnce(new Error('Network insert error'));

    const { saveToOfflineQueue, processOfflineQueue, getOfflineQueueCount } = await import('@/lib/offline-sync');

    await saveToOfflineQueue({
      truck_id: 9,
      amount: 320,
      currency: 'MAD',
      date: '2026-09-18',
      notes: 'إيصال سيفشل',
    });

    const result = await processOfflineQueue();
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(1);

    // Failed item remains in the queue
    expect(await getOfflineQueueCount()).toBe(1);
  });
});
