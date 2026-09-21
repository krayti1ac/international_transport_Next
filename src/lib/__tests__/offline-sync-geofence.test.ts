import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveToOfflineQueue,
  getOfflineQueue,
  getOfflineQueueCount,
  clearOfflineQueue,
  processOfflineQueue,
  saveDriverTaskToOfflineQueue,
  getDriverTasksOfflineQueue,
  getDriverTasksQueueCount,
  clearDriverTasksQueue,
  processDriverTasksOfflineQueue,
  savePodSignatureToOfflineQueue,
  clearPodSignaturesQueue,
  processPodSignaturesOfflineQueue,
} from '@/lib/offline-sync';
import {
  evaluatePortGeofences,
  resetAlertCooldown,
  STRATEGIC_PORT_ZONES,
} from '@/features/tracking/services/port-geofence.actions';
import { updateTripStatus } from '@/features/trips/services/trips.actions';

// ---------------------------------------------------------------------------
// 1. In-Memory IndexedDB Mock for Vitest Node Environment
// ---------------------------------------------------------------------------
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

vi.stubGlobal('indexedDB', mockIndexedDB);
vi.stubGlobal('window', {
  indexedDB: mockIndexedDB,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});
vi.stubGlobal('atob', (b64: string) => Buffer.from(b64, 'base64').toString('binary'));

// ---------------------------------------------------------------------------
// 2. Mock Supabase Browser Client (for Offline Sync)
// ---------------------------------------------------------------------------
const mockStorageUpload = vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.storage/test.jpg' } });
const mockMaintenanceInsert = vi.fn().mockResolvedValue({ error: null });
const mockMaintenanceSelect = vi.fn();
const mockTripOrdersSelect = vi.fn();
const mockTripOrdersUpdate = vi.fn();
const mockSignaturesSelect = vi.fn();
const mockSignaturesInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: (table: string) => {
      if (table === 'truck_maintenance') {
        return {
          select: mockMaintenanceSelect,
          insert: mockMaintenanceInsert,
        };
      }
      if (table === 'trip_orders') {
        return {
          select: mockTripOrdersSelect,
          update: mockTripOrdersUpdate,
        };
      }
      if (table === 'delivery_signatures') {
        return {
          select: mockSignaturesSelect,
          insert: mockSignaturesInsert,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
      };
    },
  }),
}));

// ---------------------------------------------------------------------------
// 3. Mock Supabase Server Client & External Services (for Geofence Actions)
// ---------------------------------------------------------------------------
const mockServerTripSelect = vi.fn();
const mockServerTruckSelect = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'trip_orders') {
        return {
          select: mockServerTripSelect,
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'trucks') {
        return {
          select: mockServerTruckSelect,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
      };
    },
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppCloudMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/features/trips/services/notification-dispatcher', () => ({
  dispatchTripLifecycleNotifications: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/features/trips/services/trips.actions', () => ({
  updateTripStatus: vi.fn().mockResolvedValue({ success: true }),
}));

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------
describe('Epic 3: Offline PWA, IndexedDB v2 Sync Engine & Telematics Geofencing', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetAlertCooldown();
    await clearOfflineQueue();
    await clearDriverTasksQueue();
    await clearPodSignaturesQueue();
  });

  describe('3.1 Append-Only Fuel Receipts Idempotency', () => {
    it('generates an idempotency_key if omitted and avoids duplicate queueing', async () => {
      const receipt1 = await saveToOfflineQueue({
        truck_id: 10,
        amount: 850,
        currency: 'MAD',
        date: '2026-10-14',
        notes: 'تعبئة وقود المحطة الأولى',
      });

      expect(receipt1.idempotency_key).toBeDefined();
      expect(receipt1.idempotency_key).toContain('fuel_10_850_2026-10-14');

      // Attempting to queue with the exact same idempotency_key returns existing item
      const receipt2 = await saveToOfflineQueue({
        truck_id: 10,
        amount: 850,
        currency: 'MAD',
        date: '2026-10-14',
        notes: 'محاولة تكرار لنفس الإيصال',
        idempotency_key: receipt1.idempotency_key,
      });

      expect(receipt2.id).toBe(receipt1.id);
      expect(await getOfflineQueueCount()).toBe(1);
    });

    it('deduplicates based on receipt_number when present', async () => {
      const receipt1 = await saveToOfflineQueue({
        truck_id: 12,
        amount: 500,
        currency: 'MAD',
        date: '2026-10-14',
        notes: 'إيصال ورقي رقم 98765',
        receipt_number: 'REC-98765',
      });

      const receipt2 = await saveToOfflineQueue({
        truck_id: 12,
        amount: 500,
        currency: 'MAD',
        date: '2026-10-14',
        notes: 'إعادة إدخال لنفس رقم الإيصال',
        receipt_number: 'REC-98765',
      });

      expect(receipt2.id).toBe(receipt1.id);
      expect(await getOfflineQueueCount()).toBe(1);
    });

    it('gracefully suppresses duplicate server insertions when already synced (Append-Only idempotency)', async () => {
      // Mock that truck_maintenance ALREADY has this record on the server
      mockMaintenanceSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 401, amount: 950 }],
                error: null,
              }),
            }),
          }),
        }),
      });

      await saveToOfflineQueue({
        truck_id: 14,
        amount: 950,
        currency: 'MAD',
        date: '2026-10-14',
        notes: 'إيصال مسجل مسبقاً',
        idempotency_key: 'fuel_existing_record_key',
      });

      expect(await getOfflineQueueCount()).toBe(1);

      const syncResult = await processOfflineQueue();

      expect(syncResult.successCount).toBe(1);
      expect(syncResult.failCount).toBe(0);
      // truck_maintenance insert should NOT be called because it already exists on server
      expect(mockMaintenanceInsert).not.toHaveBeenCalled();
      // IndexedDB queue should be cleared
      expect(await getOfflineQueueCount()).toBe(0);
    });

    it('inserts new fuel receipt into truck_maintenance when not previously synced', async () => {
      // Mock that truck_maintenance has NO matching record
      mockMaintenanceSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      await saveToOfflineQueue({
        truck_id: 15,
        amount: 1200,
        currency: 'MAD',
        date: '2026-10-14',
        notes: 'إيصال ديزل جديد',
        idempotency_key: 'fuel_new_receipt_001',
      });

      const syncResult = await processOfflineQueue();

      expect(syncResult.successCount).toBe(1);
      expect(syncResult.failCount).toBe(0);
      expect(mockMaintenanceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          truck_id: 15,
          amount: 1200,
          currency: 'MAD',
          notes: expect.stringContaining('fuel_new_receipt_001'),
        })
      );
      expect(await getOfflineQueueCount()).toBe(0);
    });
  });

  describe('3.2 Last-Write-Wins (LWW) Conflict Resolution for Driver Tasks', () => {
    it('discards stale driver task when server updated_at is newer than client timestamp', async () => {
      const clientTime = '2026-10-14T08:00:00.000Z';
      const serverTime = '2026-10-14T08:30:00.000Z'; // Server is 30 mins newer (e.g. dispatcher update)

      mockTripOrdersSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 701,
              status: 'customs_export',
              updated_at: serverTime,
            },
            error: null,
          }),
        }),
      });

      await saveDriverTaskToOfflineQueue({
        trip_id: 701,
        status: 'in_transit',
        idempotency_key: 'task_lww_stale_1',
      });

      // Manually set timestamp to clientTime
      const queue = await getDriverTasksOfflineQueue();
      queue[0].timestamp = clientTime;

      const syncResult = await processDriverTasksOfflineQueue();

      // Task was handled/discarded cleanly
      expect(syncResult.successCount).toBe(1);
      expect(syncResult.failCount).toBe(0);
      // Database update should NOT have occurred, preserving dispatcher state
      expect(mockTripOrdersUpdate).not.toHaveBeenCalled();
      // Purged from offline queue
      expect(await getDriverTasksQueueCount()).toBe(0);
    });

    it('applies driver task update when client timestamp is newer than server updated_at', async () => {
      const serverTime = '2026-10-14T09:00:00.000Z';
      const clientTime = '2026-10-14T09:15:00.000Z'; // Driver update is 15 mins newer

      mockTripOrdersSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 702,
              status: 'in_transit',
              updated_at: serverTime,
            },
            error: null,
          }),
        }),
      });

      mockTripOrdersUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await saveDriverTaskToOfflineQueue({
        trip_id: 702,
        status: 'customs_export',
        idempotency_key: 'task_lww_fresh_1',
      });

      const queue = await getDriverTasksOfflineQueue();
      queue[0].timestamp = clientTime;

      const syncResult = await processDriverTasksOfflineQueue();

      expect(syncResult.successCount).toBe(1);
      expect(syncResult.failCount).toBe(0);
      expect(mockTripOrdersUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'customs_export',
          updated_at: expect.any(String),
        })
      );
      expect(await getDriverTasksQueueCount()).toBe(0);
    });
  });

  describe('3.3 Proof of Delivery (e-POD) Sync & Delivered Transition', () => {
    it('transitions trip order to "delivered" status and stores signature and CMR URLs', async () => {
      mockSignaturesSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      mockTripOrdersUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await savePodSignatureToOfflineQueue({
        trip_id: 888,
        signed_by: 'Consignee Receiver Ahmed',
        signature_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        cmr_image_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        leg: 'export',
        idempotency_key: 'pod_sync_test_888',
        signed_at: '2026-10-14T10:00:00.000Z',
      });

      const syncResult = await processPodSignaturesOfflineQueue();

      expect(syncResult.successCount).toBe(1);
      expect(syncResult.failCount).toBe(0);
      expect(mockSignaturesInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          trip_order_id: 888,
          signed_by: 'Consignee Receiver Ahmed',
        })
      );
      // Status must transition to 'delivered' (State Machine compliance)
      expect(mockTripOrdersUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          cmr_export_url: expect.stringContaining('https://test.storage/'),
        })
      );
    });
  });

  describe('3.4 Telematics Geofencing & Automated State Machine Transitions', () => {
    it('has Tanger Med radius set to 5.0 km per operational specifications', () => {
      const tangerMed = STRATEGIC_PORT_ZONES.find((z) => z.id === 'port_tanger_med');
      expect(tangerMed).toBeDefined();
      expect(tangerMed?.radiusKm).toBe(5.0);
    });

    it('automates transition to "customs_export" via updateTripStatus when entering Tanger Med', async () => {
      // Mock active trip in transit
      mockServerTripSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 991,
                    cmr_number: 'CMR-TANGER-01',
                    route: 'Casablanca -> Algeciras',
                    status: 'in_transit',
                    truck_id: 201,
                  },
                }),
              }),
            }),
          }),
        }),
      });

      // Truck enters Tanger Med coordinates (35.885, -5.505)
      const res = await evaluatePortGeofences({
        truckId: 201,
        truckPlate: '99887-A-1',
        latitude: 35.885,
        longitude: -5.505,
      });

      expect(res.event).toBe('enter');
      expect(res.matchedZone?.id).toBe('port_tanger_med');
      expect(res.alertDispatched).toBe(true);

      // Verify that updateTripStatus was invoked with 'customs_export'
      expect(updateTripStatus).toHaveBeenCalledWith(991, 'customs_export');
    });

    it('automates transition back to "in_transit" via updateTripStatus when exiting port geofence', async () => {
      // 1. Enter first to establish cache presence
      mockServerTripSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 992,
                    status: 'customs_export',
                    truck_id: 202,
                  },
                }),
              }),
            }),
          }),
        }),
      });

      await evaluatePortGeofences({
        truckId: 202,
        truckPlate: '22334-B-26',
        latitude: 21.3656, // Inside Guerguerat
        longitude: -16.9583,
      });

      // Clear previous calls from enter
      vi.mocked(updateTripStatus).mockClear();

      // 2. Exit event (out in the open desert heading towards Mauritania)
      const exitRes = await evaluatePortGeofences({
        truckId: 202,
        truckPlate: '22334-B-26',
        latitude: 21.2000, // Outside Guerguerat 5km radius
        longitude: -16.9583,
      });

      expect(exitRes.event).toBe('exit');
      expect(exitRes.alertDispatched).toBe(true);

      // State machine transition back to 'in_transit'
      expect(updateTripStatus).toHaveBeenCalledWith(992, 'in_transit');
    });
  });
});

