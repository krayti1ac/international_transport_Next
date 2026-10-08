import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';

// ---------------------------------------------------------------------------
// 1. In-Memory IndexedDB Mock for Vitest Environment
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
    const key = item.id !== undefined ? item.id : item.key;
    this.data.set(key, item);
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(key);
    }, 0);
    return req;
  }

  get(key: any) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.triggerSuccess(this.data.get(key) || null);
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
      const stores = [
        'fuel_receipts_queue',
        'pod_signatures_queue',
        'driver_tasks_queue',
        'cached_driver_trips',
        'checkpoints_queue',
        'cached_driver_documents',
      ];
      stores.forEach((storeName) => {
        if (!mockDatabaseInstance.objectStoreNames.contains(storeName)) {
          mockDatabaseInstance.createObjectStore(storeName);
        }
      });
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
// 2. Supabase & External Services Mocks
// ---------------------------------------------------------------------------
const mockStorageUpload = vi.fn().mockResolvedValue({ data: { path: 'proof.png' }, error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.transbodanon.com/proof.png' } });
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

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppCloudMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-pilot-msg-01' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// 3. Import System Services Across All 6 Subsystems
// ---------------------------------------------------------------------------
// Phase 1: State Machine & Transition Guards
import {
  validateTripTransition,
  normalizeTripStage,
} from '@/features/trips/services/trip-state-machine';

// Phase 2: Mission Control & Telematics
import {
  evaluateThermalDeviation,
  evaluateDoorBreachRisk,
  resolveCurrentGeofenceZone,
  calculateColdChainIntegrityScore,
  generateIncidentAlerts,
} from '@/features/mission-control/services/mission-control.service';

// Phase 3: Customs & Port Gateways
import {
  escapeXml,
  validateMoroccanIce,
  buildPortNetXML,
  buildTirEpdXML,
  buildPortNetPayloadFromTripOrder,
  buildTirEpdPayloadFromTripOrder,
} from '@/features/customs/services/customs-payload-builder.service';
import {
  generateCustomsIdempotencyKey,
  verifyCustomsReadiness,
} from '@/features/customs/services/customs-submission.service';

// Phase 4: Driver Offline Mobile PWA & e-POD
import {
  saveCheckpointToOfflineQueue,
  getCheckpointsQueueCount,
  getCheckpointsOfflineQueue,
  clearCheckpointsQueue,
  savePodSignatureToOfflineQueue,
  getPodSignaturesQueueCount,
  clearPodSignaturesQueue,
  cacheDriverTripsOffline,
  getCachedDriverTripById,
  clearCachedDriverTrips,
  cacheDriverDocumentOffline,
  getCachedDriverDocumentOffline,
  getTotalOfflineQueueCount,
  processCheckpointsOfflineQueue,
  processPodSignaturesOfflineQueue,
  processAllOfflineQueues,
} from '@/lib/offline-sync';

// Phase 5: Automated Invoicing & Article 92 CGI Exemption
import {
  calculateTripInvoiceBreakdown,
  isInternationalTransport,
  INTERNATIONAL_VAT_EXEMPTION_CLAUSE,
} from '@/features/invoices/services/auto-invoicing.service';

// Phase 6: Accounting, ERP Export & Corridor P&L
import {
  buildTaxExemptionRegister,
  summarizeTaxCompliance,
  buildDumCustomsAuditRegister,
  calculateCorridorProfitability,
  formatSage100Export,
  formatOdooExport,
  formatCielComptaExport,
  formatDgiTaxRegisterCsv,
  formatCorridorPnlCsv,
} from '@/features/accounting/services/tax-compliance-export.service';
import type { JournalEntryLine } from '@/features/accounting/types';
import type { TripOrder, Driver, Truck, Trailer, Client, DeliverySignature } from '@/types/database';

// ---------------------------------------------------------------------------
// End-to-End Mission Pilot Test Suite
// ---------------------------------------------------------------------------
describe('Trans Bodanon TMS — End-to-End Mission Pilot Verification', () => {
  beforeEach(async () => {
    mockStorageUpload.mockClear();
    mockGetPublicUrl.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();

    await clearCheckpointsQueue();
    await clearPodSignaturesQueue();
    await clearCachedDriverTrips();
  });

  // =========================================================================
  // CORRIDOR 1: European Maritime Mission Pilot
  // Route: Tanger Med ➔ Algeciras ➔ Perpignan (France)
  // Cargo: Tomates Cerises Frigo (+4.0°C) | 22,400 kg | 35,000.00 MAD
  // =========================================================================
  describe('Mission Pilot A: European Maritime Corridor (Tanger Med ➔ Algeciras ➔ Perpignan)', () => {
    // Entities Setup
    const pilotTrip: TripOrder = {
      id: 8801,
      route: 'Tanger Med -> Algeciras -> Perpignan',
      corridor_type: 'european_maritime',
      price: 35000,
      price_export: 35000,
      price_type: 'MAD',
      departure_date: '2026-10-25',
      status: 'draft',
      created_at: '2026-10-20T08:00:00Z',
      client_id: 101,
      cmr_export_number: 'CMR-2026-8801',
      ferry_localizador: 'BALEARIA-LOC-8877',
      ferry_company: 'Balearia Ferries',
      ferry_cost: 6500,
      transit_almeria_cost: 800,
      marsa_maroc_cost: 1200,
      triptik_cost: 500,
      weight_export: 22400,
      goods_description_export: 'Tomates cerises fraîches sous température dirigée (+4.0°C)',
    };

    const pilotClient: Client = {
      id: 101,
      name: 'Atlas Primeurs Export SARL',
      phone: '+212528112233',
      email: 'logistique@atlasprimeurs.ma',
      ice: '001523456789012',
      address: 'Zone Agro-Industrielle Ait Melloul',
      city: 'Agadir',
      currency: 'MAD',
      invoice_with_tva: false,
      created_at: '2026-01-01',
      is_active: true,
      shipping_address_line1: 'Marché Saint-Charles, Perpignan',
      shipping_address_line2: '',
      shipping_address_line3: '',
      shipping_address_line4: '',
      shipping_city: 'Perpignan',
      shipping_postal_code: '66000',
      shipping_country: 'FR',
      billing_address_line1: 'Zone Agro-Industrielle',
      billing_address_line2: '',
      billing_address_line3: '',
      billing_address_line4: '',
      billing_city: 'Agadir',
      billing_postal_code: '80000',
      billing_country: 'MA',
    };

    const pilotTruck: Truck = {
      id: 501,
      plate_number: '12345-A-26',
      model: 'Volvo FH500 I-Save (Euro 6)',
      status: 'available',
      created_at: '2026-01-01',
    };

    const pilotTrailer: Trailer = {
      id: 601,
      plate_number: 'REM-9988-MA',
      model: 'Schmitz Cargobull SKO-COOL (Thermo King SLXi-400)',
      status: 'available',
      created_at: '2026-01-01',
    };

    const pilotDriver: Driver & { passport_number?: string; passport_expiry_date?: string } = {
      id: 701,
      name: 'سعيد التازي (Said El Tazi)',
      phone: '+212661000111',
      cin: 'KB123456',
      license: 'EC-998811',
      status: 'available',
      base_salary: 6000,
      bonus_percentage: 5,
      has_valid_visa: true, // Valid Schengen Visa
      passport_number: 'PA901245',
      passport_expiry_date: '2028-06-30',
      african_visa_number: undefined,
      african_visa_expiry_date: undefined,
    };

    // -----------------------------------------------------------------------
    // Milestone 1: Trip Assignment & Transition Guards
    // -----------------------------------------------------------------------
    it('Milestone 1: Enforces state machine transition guards and corridor visa requirements', () => {
      // 1.1 Draft status normalized
      expect(normalizeTripStage(pilotTrip.status)).toBe('draft');

      // 1.2 Assignment Guard: Block assignment if driver lacks Schengen visa
      const driverNoVisa: Driver = { ...pilotDriver, has_valid_visa: false };
      const guardNoVisa = validateTripTransition('draft', 'assigned', {
        trip: pilotTrip,
        truck: pilotTruck,
        trailer: pilotTrailer,
        driver: driverNoVisa,
      });
      expect(guardNoVisa.valid).toBe(false);
      expect(guardNoVisa.code).toBe('SCHENGEN_VISA_REQUIRED');

      // 1.3 Assignment Guard: Approve assignment when crew and fleet meet maritime requirements
      const guardValidAssign = validateTripTransition('draft', 'assigned', {
        trip: pilotTrip,
        truck: pilotTruck,
        trailer: pilotTrailer,
        driver: pilotDriver,
      });
      expect(guardValidAssign.valid).toBe(true);

      // 1.4 Transition to Loading
      const guardToLoading = validateTripTransition('assigned', 'loading', {
        trip: { ...pilotTrip, status: 'assigned' },
        truck: pilotTruck,
        driver: pilotDriver,
      });
      expect(guardToLoading.valid).toBe(true);

      // 1.5 Loading Guard: Block departure if weight is missing or zero
      const guardZeroWeight = validateTripTransition('loading', 'in_transit', {
        trip: { ...pilotTrip, status: 'loading', weight_export: 0 },
        truck: pilotTruck,
        driver: pilotDriver,
      });
      expect(guardZeroWeight.valid).toBe(false);
      expect(guardZeroWeight.code).toBe('INVALID_WEIGHT');

      // 1.6 Depart: Approve departure when cargo and weight are validated
      const guardToTransit = validateTripTransition('loading', 'in_transit', {
        trip: { ...pilotTrip, status: 'loading' },
        truck: pilotTruck,
        driver: pilotDriver,
      });
      expect(guardToTransit.valid).toBe(true);

      // 1.7 Illegal Stage Jump Guard: Block skipping from transit directly to closed
      const guardIllegalJump = validateTripTransition('in_transit', 'closed', {
        trip: { ...pilotTrip, status: 'in_transit' },
      });
      expect(guardIllegalJump.valid).toBe(false);
      expect(guardIllegalJump.code).toBe('ILLEGAL_STAGE_JUMP');
    });

    // -----------------------------------------------------------------------
    // Milestone 2: Telematics Radar & Cold Chain Deviation Engine
    // -----------------------------------------------------------------------
    it('Milestone 2: Evaluates cold chain thermal drift, geofence, and door security breaches', () => {
      // 2.1 Highway Cruising: Setpoint +4.0°C, Measured +4.2°C (Fresh produce tolerance <= 1.5°C)
      const cruiseThermal = evaluateThermalDeviation(4.2, 4.0, 'fresh_produce');
      expect(cruiseThermal.tempDeviation).toBe(0.2);
      expect(cruiseThermal.tempStatus).toBe('optimal');

      // 2.2 Door security check while cruising at 82 km/h
      const doorSecure = evaluateDoorBreachRisk(82, false);
      expect(doorSecure).toBe(false);

      // 2.3 Port Geofence Entry: Coords at Tanger Med Gate (35.887, -5.503)
      const portZone = resolveCurrentGeofenceZone(35.887, -5.503);
      expect(portZone).not.toBeNull();
      expect(portZone?.id).toBe('port_tanger_med');
      expect(portZone?.name_ar).toBe('ميناء طنجة المتوسط');

      // 2.4 Anomaly Simulation: Critical thermal drift (+9.5°C) and door opened while in motion (30 km/h)
      const criticalThermal = evaluateThermalDeviation(9.5, 4.0, 'fresh_produce');
      expect(criticalThermal.tempDeviation).toBe(5.5);
      expect(criticalThermal.tempStatus).toBe('critical_drift');

      const doorBreach = evaluateDoorBreachRisk(30, true);
      expect(doorBreach).toBe(true);

      // 2.5 Fleet Cold Chain Integrity Score (Decimal.js)
      const mockTelemetry = [
        { tempStatus: 'optimal', doorBreachRisk: false, reeferStatus: 'normal' },
        { tempStatus: 'optimal', doorBreachRisk: false, reeferStatus: 'normal' },
        { tempStatus: 'critical_drift', doorBreachRisk: true, reeferStatus: 'high_risk' },
      ] as any[];

      const integrityScore = calculateColdChainIntegrityScore(mockTelemetry);
      // Total 3 telemetry points:
      // Penalty: 1 critical_drift (+25) + 1 door breach (+15) + 1 high_risk (+10) = 50 total penalty
      // Average penalty = 50 / 3 = 16.67 => Score = Math.round(100 - 16.67) = 83%
      expect(integrityScore).toBe(83);

      // 2.6 Incident Alert Dispatch: Generates critical multi-channel alerts for drift & door breach
      const telemetryWithAnomaly = [
        {
          truckId: 501,
          truckPlate: '12345-A-26',
          tripId: 8801,
          cargoProfile: 'fresh_produce',
          currentTemp: 9.5,
          targetTemp: 4.0,
          tempDeviation: 5.5,
          tempStatus: 'critical_drift',
          doorBreachRisk: true,
          speed: 30,
          recordedAt: new Date().toISOString(),
          driverPhone: '+212661000111',
          driverName: 'Said El Tazi',
        },
      ] as any[];

      const incidentAlerts = generateIncidentAlerts(telemetryWithAnomaly);
      expect(incidentAlerts.length).toBeGreaterThanOrEqual(2);
      const driftAlert = incidentAlerts.find((a) => a.alertType === 'temp_drift');
      const doorAlert = incidentAlerts.find((a) => a.alertType === 'door_open_moving');
      expect(driftAlert).toBeDefined();
      expect(driftAlert?.severity).toBe('critical');
      expect(driftAlert?.titleAr).toContain('انحراف حراري حرج');
      expect(doorAlert).toBeDefined();
      expect(doorAlert?.severity).toBe('critical');
      expect(doorAlert?.titleAr).toContain('إنذار أمني');
    });

    // -----------------------------------------------------------------------
    // Milestone 3: Customs Gateway Declarations (PortNet & IRU TIR-EPD)
    // -----------------------------------------------------------------------
    it('Milestone 3: Validates Moroccan ICE, builds compliant PortNet & TIR-EPD XML, and generates MRN', () => {
      // 3.1 15-digit ICE Sanitization
      const iceValidation = validateMoroccanIce(pilotClient.ice);
      expect(iceValidation.isValid).toBe(true);
      expect(iceValidation.cleanedIce).toBe('001523456789012');

      // 3.2 PortNet Customs Readiness Verification
      const tripWithRelations = {
        ...pilotTrip,
        truck: pilotTruck,
        trailer: pilotTrailer,
        driver: pilotDriver,
        client: pilotClient,
      };

      const portNetReadiness = verifyCustomsReadiness(tripWithRelations, 'portnet');
      expect(portNetReadiness.isReady).toBe(true);
      expect(portNetReadiness.missingFields).toHaveLength(0);

      // 3.3 PortNet XML Payload Generation
      const portNetPayloadResult = buildPortNetPayloadFromTripOrder(tripWithRelations);
      expect(portNetPayloadResult.isValid).toBe(true);

      const portNetXml = buildPortNetXML(portNetPayloadResult.payload);
      expect(portNetXml).toContain('<PortNetDeclaration');
      expect(portNetXml).toContain('<Localizador>BALEARIA-LOC-8877</Localizador>');
      expect(portNetXml).toContain('<GrossWeight unit="KG">22400</GrossWeight>');
      expect(portNetXml).toContain('<ICE>001523456789012</ICE>');
      expect(portNetXml).toContain('<TruckPlate>12345-A-26</TruckPlate>');
      expect(portNetXml).toContain('<TrailerPlate>REM-9988-MA</TrailerPlate>');

      // 3.4 IRU TIR-EPD Payload & XML Generation
      const tirEpdReadiness = verifyCustomsReadiness(tripWithRelations, 'tir_epd');
      expect(tirEpdReadiness.isReady).toBe(true);

      const tirEpdPayloadResult = buildTirEpdPayloadFromTripOrder(tripWithRelations);
      expect(tirEpdPayloadResult.isValid).toBe(true);
      expect(tirEpdPayloadResult.payload.departureOffice.code).toBe('MA003100'); // Tanger Med Port
      expect(tirEpdPayloadResult.payload.destinationOffice.code).toBe('ES001100'); // Algeciras Port

      const tirEpdXml = buildTirEpdXML(tirEpdPayloadResult.payload);
      expect(tirEpdXml).toContain('<TirEpdDeclaration');
      expect(tirEpdXml).toContain('CustomsOfficeDeparture code="MA003100"');
      expect(tirEpdXml).toContain('CustomsOfficeDestination code="ES001100"');

      // 3.5 Idempotency Key Generation
      const idempotencyKey = generateCustomsIdempotencyKey(pilotTrip.id, 'portnet', '2026-10-25');
      expect(idempotencyKey).toBe('customs_8801_portnet_2026-10-25');
    });

    // -----------------------------------------------------------------------
    // Milestone 4: Field Execution & Driver Mobile PWA (Offline Desert Resilience)
    // -----------------------------------------------------------------------
    it('Milestone 4: Caches trip data offline, logs border checkpoints, records e-POD, and syncs upon reconnection', async () => {
      // 4.1 Cache trip in IndexedDB v3 for offline operation during sea crossing
      await cacheDriverTripsOffline([pilotTrip]);
      const cachedTrip = await getCachedDriverTripById(pilotTrip.id);
      expect(cachedTrip).not.toBeNull();
      expect(cachedTrip?.id).toBe(8801);
      expect(cachedTrip?.route).toContain('Tanger Med');

      // 4.2 Cache tactical documents (Driver Passport & Schengen Visa)
      await cacheDriverDocumentOffline('driver_passport_701', {
        document_type: 'passport',
        number: 'PA901245',
        holder_name: 'Said El Tazi',
        expiry_date: '2028-06-30',
      });
      const cachedDoc = await getCachedDriverDocumentOffline('driver_passport_701');
      expect(cachedDoc).not.toBeNull();
      expect(cachedDoc?.number).toBe('PA901245');

      // 4.3 Driver logs offline border checkpoint at Tanger Med Port Gate
      const checkpointItem = await saveCheckpointToOfflineQueue({
        trip_id: pilotTrip.id,
        checkpoint_type: 'tanger_med_port_gate',
        checkpoint_label: 'بوابة الدخول لميناء طنجة المتوسط',
        latitude: 35.885,
        longitude: -5.505,
        odometer_km: 145200,
        fuel_level_percent: 88,
        reefer_temperature: 4.1,
        idempotency_key: 'cp_8801_tanger_med_gate',
      });
      expect(checkpointItem.id).toBeDefined();
      expect(await getCheckpointsQueueCount()).toBe(1);

      // 4.4 Driver arrives at Perpignan & captures electronic POD
      const mockSignatureBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const queuedPod = await savePodSignatureToOfflineQueue({
        trip_id: pilotTrip.id,
        signed_by: 'Jean-Luc Dupont (Plateforme Saint-Charles)',
        signature_base64: mockSignatureBase64,
        cmr_image_base64: 'data:image/jpeg;base64,dGVzdENNUg==',
        latitude: 42.688,
        longitude: 2.875,
        signed_at: '2026-10-27T10:15:00.000Z',
        leg: 'export',
        idempotency_key: 'pod_8801_perpignan_signed',
      });
      expect(queuedPod.signed_by).toBe('Jean-Luc Dupont (Plateforme Saint-Charles)');
      expect(await getPodSignaturesQueueCount()).toBe(1);

      // 4.5 Verify total pending offline queue items
      const totalPending = await getTotalOfflineQueueCount();
      expect(totalPending).toBe(2); // 1 checkpoint + 1 POD

      // 4.6 Online Reconnection: Trigger queue flush
      const syncResult = await processAllOfflineQueues();
      expect(syncResult.checkpoints.successCount).toBe(1);
      expect(syncResult.pods.successCount).toBe(1);

      // Queues now empty
      expect(await getTotalOfflineQueueCount()).toBe(0);

      // 4.7 Delivery Transition Guard: Transition from in_transit to delivered
      const validDeliveryProof: DeliverySignature = {
        id: 1,
        trip_order_id: pilotTrip.id,
        signed_by: 'Jean-Luc Dupont',
        signature_url: 'https://cdn.transbodanon.com/proof.png',
        signed_at: '2026-10-27T10:15:00.000Z',
        latitude: 42.688,
        longitude: 2.875,
        created_at: '2026-10-27T10:15:00.000Z',
      };

      const guardToDelivered = validateTripTransition('in_transit', 'delivered', {
        trip: { ...pilotTrip, status: 'in_transit' },
        deliveryProof: validDeliveryProof,
      });
      expect(guardToDelivered.valid).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Milestone 5: Post-Delivery Auto-Invoicing & Article 92 CGI Exemption
    // -----------------------------------------------------------------------
    it('Milestone 5: Classifies international route and generates invoice with 0% TVA under Article 92 CGI', () => {
      // 5.1 International Freight Detection
      expect(isInternationalTransport(pilotTrip)).toBe(true);

      // 5.2 Deterministic Invoice Calculation via Decimal.js
      const customsProof = {
        mrn: '26MA003100DUM778899',
        seal_numbers: ['MA-DOUANE-881122', 'MA-DOUANE-881123'],
      };

      const breakdown = calculateTripInvoiceBreakdown(pilotTrip, pilotClient, customsProof);

      // Strict Decimal.js calculations
      expect(breakdown.isTaxExempt).toBe(true);
      expect(breakdown.tvaRate).toBe('0');
      expect(breakdown.tvaAmount).toBe('0.00');
      expect(breakdown.totalHt).toBe('35000.00');
      expect(breakdown.totalTtc).toBe('35000.00');
      expect(breakdown.taxExemptionClause).toBe(INTERNATIONAL_VAT_EXEMPTION_CLAUSE);

      // Embedded Customs & Ferry Audit Trails
      expect(breakdown.mrn).toBe('26MA003100DUM778899');
      expect(breakdown.scelleNumbers).toEqual(['MA-DOUANE-881122', 'MA-DOUANE-881123']);
      expect(breakdown.ferryBooking).toBe('BALEARIA-LOC-8877');
      expect(breakdown.cmrNumber).toBe('CMR-2026-8801');
      expect(breakdown.clientIce).toBe('001523456789012');
    });

    // -----------------------------------------------------------------------
    // Milestone 6: ERP Bridge, Accounting Equilibrium & Corridor P&L
    // -----------------------------------------------------------------------
    it('Milestone 6: Produces balanced Sage 100 entries, DGI tax register CSV, and evaluates Corridor P&L margin', () => {
      // 6.1 Generate Double-Entry Accounting Journal
      const journalEntries: JournalEntryLine[] = [
        {
          date: '2026-10-27',
          journalCode: 'VT',
          accountNumber: '34210000', // Compte Client
          auxiliaryAccount: '001523456789012',
          documentRef: 'FA-2026-8801',
          label: 'Facture FA-2026-8801 - Atlas Primeurs Export SARL',
          debit: 35000,
          credit: 0,
          currency: 'MAD',
        },
        {
          date: '2026-10-27',
          journalCode: 'VT',
          accountNumber: '71242000', // Prestations de transport international (Art 92 CGI)
          auxiliaryAccount: '',
          documentRef: 'FA-2026-8801',
          label: 'Transport TIR Tanger Med -> Perpignan - Exonere Art 92 CGI',
          debit: 0,
          credit: 35000,
          currency: 'MAD',
        },
      ];

      // Accounting Equilibrium Test: Total Debit == Total Credit
      const totalDebitDec = journalEntries.reduce((acc, curr) => acc.plus(curr.debit), new Decimal(0));
      const totalCreditDec = journalEntries.reduce((acc, curr) => acc.plus(curr.credit), new Decimal(0));
      expect(totalDebitDec.equals(totalCreditDec)).toBe(true);
      expect(totalDebitDec.toNumber()).toBe(35000);

      // 6.2 Format Sage 100 PNM Export
      const sageExport = formatSage100Export(journalEntries);
      const sageLines = sageExport.split('\r\n');
      expect(sageLines).toHaveLength(2);

      const debitLineParts = sageLines[0].split('\t');
      expect(debitLineParts[0]).toBe('VT');
      expect(debitLineParts[1]).toBe('20261027');
      expect(debitLineParts[2]).toBe('34210000');
      expect(debitLineParts[6]).toBe('D');
      expect(debitLineParts[7]).toBe('35000.00');

      const creditLineParts = sageLines[1].split('\t');
      expect(creditLineParts[2]).toBe('71242000');
      expect(creditLineParts[6]).toBe('C');
      expect(creditLineParts[7]).toBe('35000.00');

      // 6.2b Multi-Format ERP Exports (Odoo & Ciel Compta)
      const odooCsv = formatOdooExport(journalEntries);
      expect(odooCsv.startsWith('\uFEFF')).toBe(true);
      expect(odooCsv).toContain('34210000');
      expect(odooCsv).toContain('71242000');

      const cielCsv = formatCielComptaExport(journalEntries);
      expect(cielCsv.startsWith('\uFEFF')).toBe(true);
      expect(cielCsv).toContain('34210000;"FA-2026-8801"');
      expect(cielCsv).toContain('35000.00;0.00');

      // 6.3 Build DGI Tax Exemption Register & CSV Export
      const mockInvoices = [
        {
          id: 8801,
          invoice_number: 'FA-2026-8801',
          total_amount: '35000.00',
          ht_amount: '35000.00',
          tva_amount: '0.00',
          tva_rate: '0',
          client_id: '101',
          route: 'Tanger Med -> Algeciras -> Perpignan',
          issue_date: '2026-10-27',
          status: 'paid',
        },
      ];

      const clientsMap = new Map([
        ['101', { name: 'Atlas Primeurs Export SARL', ice: '001523456789012', if_number: '40123456' }],
      ]);

      const tripOrdersMap = new Map([
        ['8801', pilotTrip],
      ]);

      const taxLines = buildTaxExemptionRegister(mockInvoices, clientsMap, tripOrdersMap);
      expect(taxLines).toHaveLength(1);
      expect(taxLines[0].taxExemptionCode).toBe('ART_92_I_38_CGI');
      expect(taxLines[0].amountHtMAD).toBe(35000);
      expect(taxLines[0].tvaAmountMAD).toBe(0);

      const dgiCsv = formatDgiTaxRegisterCsv(taxLines);
      expect(dgiCsv).toContain('"FA-2026-8801";2026-10-27;"Atlas Primeurs Export SARL";"001523456789012"');
      expect(dgiCsv).toContain('"ART_92_I_38_CGI"');

      // 6.4 Multi-Corridor Profitability (Corridor P&L Analytics)
      const mockTripForPnl = {
        ...pilotTrip,
        fuel_cost: 8500, // 8,500 MAD fuel
      };

      const mockMaintenance = [
        { cost: 5000 }, // 60% allocated to maritime = 3,000 MAD
      ];

      const mockAdvances = [
        { driver_allowance: 4000, cmr_number: 'CMR-2026-8801' }, // 4,000 MAD allowance
      ];

      const pnlSummary = calculateCorridorProfitability([mockTripForPnl], mockMaintenance, mockAdvances);
      const maritimePnl = pnlSummary.corridors.find((c) => c.corridor === 'european_maritime');

      expect(maritimePnl).toBeDefined();
      expect(maritimePnl?.revenueMAD).toBe(35000);
      expect(maritimePnl?.fuelCostMAD).toBe(8500);
      expect(maritimePnl?.ferryTransitCostMAD).toBe(9000); // 6500 (ferry) + 800 (almeria) + 1200 (marsa) + 500 (triptik) = 9000
      expect(maritimePnl?.driverAllowancesMAD).toBe(4000);
      expect(maritimePnl?.maintenanceCostMAD).toBe(3000); // 5000 * 0.60 = 3000

      // Total Operating Cost = 8500 + 9000 + 4000 + 3000 = 24500 MAD
      expect(maritimePnl?.totalOperatingCostMAD).toBe(24500);
      // Gross Margin = 35000 - 24500 = 10500 MAD
      expect(maritimePnl?.grossMarginMAD).toBe(10500);
      // Margin % = (10500 / 35000) * 100 = 30.0%
      expect(maritimePnl?.grossMarginPercent).toBe(30);

      // Export Corridor P&L CSV
      const pnlCsv = formatCorridorPnlCsv(pnlSummary);
      expect(pnlCsv).toContain('Corridor_Logistique;Nombre_Voyages;Chiffre_Affaires_MAD');
      expect(pnlCsv).toContain('35000.00');

      // 6.5 Settle & Close Trip Lifecycle
      const guardToSettled = validateTripTransition('delivered', 'settled', {
        trip: { ...pilotTrip, status: 'delivered' },
        hasSettlementClosed: true,
      });
      expect(guardToSettled.valid).toBe(true);

      const guardToClosed = validateTripTransition('settled', 'closed', {
        trip: { ...pilotTrip, status: 'settled' },
      });
      expect(guardToClosed.valid).toBe(true);
    });
  });

  // =========================================================================
  // CORRIDOR 2: African Overland Trade Corridor Mission Pilot
  // Route: Agadir ➔ Guerguerat ➔ Rosso ➔ Dakar
  // Cargo: Sardines Congelées Frigo (-25.0°C) | 24,000 kg | 52,000.00 MAD
  // =========================================================================
  describe('Mission Pilot B: African Overland Corridor (Agadir ➔ Guerguerat ➔ Dakar)', () => {
    const africanTrip: TripOrder & { fuel_cost?: number } = {
      id: 9902,
      route: 'Agadir -> Guerguerat -> Rosso -> Dakar',
      corridor_type: 'african_overland',
      price: 52000,
      price_export: 52000,
      price_type: 'MAD',
      departure_date: '2026-10-28',
      status: 'draft',
      created_at: '2026-10-21T09:00:00Z',
      client_id: 202,
      cmr_export_number: 'CMR-AFR-2026-9902',
      weight_export: 24000,
      goods_description_export: 'Sardines congelées de l Atlantique (-25°C)',
      fuel_cost: 16000,
      ferry_cost: 0,
    };

    const africanDriver: Driver & { passport_number?: string } = {
      id: 702,
      name: 'عبد الكريم الخمليشي (Abdelkarim El Khamlichi)',
      phone: '+212662000222',
      cin: 'OD456789',
      license: 'EC-554433',
      status: 'available',
      base_salary: 6000,
      bonus_percentage: 5,
      has_valid_visa: false, // Schengen not required
      african_visa_number: 'AFR-VISA-SEN-9922',
      african_visa_expiry_date: '2027-12-31', // Valid African visa
      passport_number: 'PA778899',
    };

    const africanTruck: Truck = {
      id: 502,
      plate_number: '67890-B-26',
      model: 'Mercedes-Benz Actros 3345 6x4',
      status: 'available',
      created_at: '2026-01-01',
    };

    const africanClient: Client = {
      id: 202,
      name: 'Sahara Peche Export SARL',
      phone: '+212528998877',
      address: 'Port de Peche, Dakhla',
      city: 'Dakhla',
      email: 'contact@saharapeche.ma',
      ice: '002198765432100',
      currency: 'MAD',
      is_active: true,
      invoice_with_tva: false,
      created_at: '2026-01-01',
      shipping_address_line1: 'Port Autonome de Dakar',
      shipping_address_line2: '',
      shipping_address_line3: '',
      shipping_address_line4: '',
      shipping_city: 'Dakar',
      shipping_postal_code: '10000',
      shipping_country: 'SN',
      billing_address_line1: 'Port de Peche',
      billing_address_line2: '',
      billing_address_line3: '',
      billing_address_line4: '',
      billing_city: 'Dakhla',
      billing_postal_code: '73000',
      billing_country: 'MA',
    };

    it('Executes end-to-end African overland mission pipeline with desert checkpoints and Guerguerat geofencing', async () => {
      // 1. Crew & African Visa validation
      const guardAfricanAssignment = validateTripTransition('draft', 'assigned', {
        trip: africanTrip,
        truck: africanTruck,
        driver: africanDriver,
      });
      expect(guardAfricanAssignment.valid).toBe(true);

      // 2. Frozen Fish Cold Chain Monitoring (-25°C)
      const frozenCheck = evaluateThermalDeviation(-24.5, -25.0, 'frozen_fish');
      expect(frozenCheck.tempDeviation).toBe(0.5);
      expect(frozenCheck.tempStatus).toBe('optimal');

      // 3. Guerguerat Border Geofence Detection
      // Coordinates: 21.355, -16.951
      const guergueratZone = resolveCurrentGeofenceZone(21.355, -16.951);
      expect(guergueratZone).not.toBeNull();
      expect(guergueratZone?.id).toBe('border_guerguerat');
      expect(guergueratZone?.name_ar).toContain('الكركارات');

      // 4. Offline Checkpoints Logging across Desert Highway
      await saveCheckpointToOfflineQueue({
        trip_id: africanTrip.id,
        checkpoint_type: 'guerguerat_customs_entry',
        checkpoint_label: 'مدخل جمارك الكركرات',
        latitude: 21.353,
        longitude: -16.953,
        odometer_km: 189400,
        fuel_level_percent: 75,
        reefer_temperature: -24.8,
        idempotency_key: 'cp_9902_guerguerat_entry',
      });

      await saveCheckpointToOfflineQueue({
        trip_id: africanTrip.id,
        checkpoint_type: 'mauritania_pk55_entry',
        checkpoint_label: 'نقطة المراقبة PK55 موريتانيا',
        latitude: 21.310,
        longitude: -16.960,
        odometer_km: 189455,
        fuel_level_percent: 74,
        reefer_temperature: -24.7,
        idempotency_key: 'cp_9902_pk55_entry',
      });

      expect(await getCheckpointsQueueCount()).toBe(2);

      // Reconnection sync
      const cpSync = await processCheckpointsOfflineQueue();
      expect(cpSync.successCount).toBe(2);
      expect(await getCheckpointsQueueCount()).toBe(0);

      // 5. Customs Audit Register generation for Guerguerat Bureau (MA004900)
      const mockTripOrders = [
        {
          ...africanTrip,
          status: 'delivered',
        },
      ];

      const invoicesMap = new Map([
        ['9902', { invoice_number: 'FA-2026-9902', total_amount: 52000 }],
      ]);

      const clientsMap = new Map([
        ['202', { name: africanClient.name, ice: africanClient.ice }],
      ]);

      const customsSubmissionsMap = new Map([
        ['9902', { mrn: '26MA004900AFR8877', customs_office: 'MA004900 (Guerguerat)' }],
      ]);

      const auditLines = buildDumCustomsAuditRegister(
        mockTripOrders,
        invoicesMap,
        clientsMap,
        customsSubmissionsMap
      );

      expect(auditLines).toHaveLength(1);
      expect(auditLines[0].customsOffice).toBe('MA004900 (Guerguerat)');
      expect(auditLines[0].status).toBe('cleared');
      expect(auditLines[0].weightKg).toBe(24000);

      // 6. Invoicing with Article 92 CGI Exemption
      const breakdown = calculateTripInvoiceBreakdown(africanTrip, africanClient, {
        mrn: '26MA004900AFR8877',
        seal_numbers: ['MA-SEAL-9902-1'],
      });

      expect(breakdown.isTaxExempt).toBe(true);
      expect(breakdown.totalHt).toBe('52000.00');
      expect(breakdown.totalTtc).toBe('52000.00');
      expect(breakdown.tvaAmount).toBe('0.00');

      // 7. Overland Corridor P&L
      const mockMaintenance = [{ cost: 5000 }]; // 30% allocated to african = 1,500 MAD
      const mockAdvances = [{ driver_allowance: 7000, cmr_number: 'CMR-AFR-2026-9902' }];

      const pnl = calculateCorridorProfitability(
        [africanTrip],
        mockMaintenance,
        mockAdvances
      );

      const africanPnl = pnl.corridors.find((c) => c.corridor === 'african_overland');
      expect(africanPnl).toBeDefined();
      expect(africanPnl?.revenueMAD).toBe(52000);
      expect(africanPnl?.fuelCostMAD).toBe(16000);
      expect(africanPnl?.driverAllowancesMAD).toBe(7000);
      expect(africanPnl?.maintenanceCostMAD).toBe(1500); // 5000 * 0.30

      // Total Cost = 16000 + 7000 + 1500 = 24500 MAD
      expect(africanPnl?.totalOperatingCostMAD).toBe(24500);
      // Margin = 52000 - 24500 = 27500 MAD
      expect(africanPnl?.grossMarginMAD).toBe(27500);
      // Margin % = (27500 / 52000) * 100 = 52.88%
      expect(africanPnl?.grossMarginPercent).toBe(52.88);
    });
  });

  // =========================================================================
  // MISSION PILOT C: Unbroken Sequential Lifecycle Progression
  // draft ➔ assigned ➔ loading ➔ in_transit ➔ customs_export ➔ delivered ➔ settled ➔ closed
  // =========================================================================
  describe('Mission Pilot C: Full Pipeline Sequential State Machine Transition Verification', () => {
    it('progresses through the entire 7-stage international trip lifecycle seamlessly without guard violations', () => {
      const activeTrip: TripOrder = {
        id: 7700,
        route: 'Tanger Med -> Algeciras -> Paris Rungis',
        corridor_type: 'european_maritime',
        price: 42000,
        price_export: 42000,
        weight_export: 21500,
        goods_description_export: 'Avocats Hass & Fruits Rouges Frigo (+5°C)',
        status: 'draft',
        departure_date: '2026-10-30',
        created_at: '2026-10-25T10:00:00Z',
      };

      const activeDriver: Driver = {
        id: 11,
        name: 'كريم البوداني (Karim El Bodanon)',
        phone: '+212661998877',
        has_valid_visa: true,
        license: 'EC-12345',
        status: 'available',
        base_salary: 6000,
        bonus_percentage: 5,
      };

      const activeTruck: Truck = {
        id: 22,
        plate_number: '99000-A-40',
        model: 'Scania R500 V8',
        status: 'available',
        created_at: '2026-01-01',
      };

      const activeTrailer: Trailer = {
        id: 33,
        plate_number: 'REM-7711-MA',
        model: 'Lamberet Heavy Duty Reefer',
        status: 'available',
        created_at: '2026-01-01',
      };

      const activePod: DeliverySignature = {
        id: 99,
        trip_order_id: 7700,
        signed_by: 'Pierre Lefebvre (Rungis MIN)',
        signature_url: 'https://cdn.transbodanon.com/rungis_pod.png',
        signed_at: '2026-10-30T06:00:00Z',
        latitude: 48.749,
        longitude: 2.355,
        created_at: '2026-10-30T06:00:00Z',
      };

      // Step 1: Draft -> Assigned
      let res = validateTripTransition('draft', 'assigned', {
        trip: activeTrip,
        driver: activeDriver,
        truck: activeTruck,
        trailer: activeTrailer,
      });
      expect(res.valid).toBe(true);

      // Step 2: Assigned -> Loading
      res = validateTripTransition('assigned', 'loading', {
        trip: { ...activeTrip, status: 'assigned' },
        driver: activeDriver,
        truck: activeTruck,
      });
      expect(res.valid).toBe(true);

      // Step 3: Loading -> In_Transit
      res = validateTripTransition('loading', 'in_transit', {
        trip: { ...activeTrip, status: 'loading' },
        driver: activeDriver,
        truck: activeTruck,
      });
      expect(res.valid).toBe(true);

      // Step 4: In_Transit -> Customs_Export (Port Customs Staging)
      res = validateTripTransition('in_transit', 'customs_export', {
        trip: { ...activeTrip, status: 'in_transit' },
        driver: activeDriver,
        truck: activeTruck,
      });
      expect(res.valid).toBe(true);

      // Step 5: Customs_Export -> Delivered (Requires e-POD signature)
      res = validateTripTransition('customs_export', 'delivered', {
        trip: { ...activeTrip, status: 'customs_export' },
        deliveryProof: activePod,
      });
      expect(res.valid).toBe(true);

      // Step 6: Delivered -> Settled (Requires completed driver settlements)
      res = validateTripTransition('delivered', 'settled', {
        trip: { ...activeTrip, status: 'delivered' },
        hasSettlementClosed: true,
      });
      expect(res.valid).toBe(true);

      // Step 7: Settled -> Closed (Terminal State)
      res = validateTripTransition('settled', 'closed', {
        trip: { ...activeTrip, status: 'settled' },
      });
      expect(res.valid).toBe(true);
    });
  });
});
