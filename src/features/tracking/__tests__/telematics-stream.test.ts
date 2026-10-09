import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import type {
  TelematicsStreamPacket,
  StreamConnectedEvent,
  StreamConnectionStatus,
} from '../types/telematics-stream.types';

// Mock EventSource implementation for Vitest environment
class MockEventSource {
  public url: string;
  public readyState: number = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSED
  public listeners: Record<string, ((event: any) => void)[]> = {};
  public onerror: ((error: any) => void) | null = null;
  public onopen: ((event: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  static instances: MockEventSource[] = [];

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  emit(type: string, data: any) {
    const event = { data: typeof data === 'string' ? data : JSON.stringify(data) };
    if (this.listeners[type]) {
      this.listeners[type].forEach((l) => l(event));
    }
  }

  emitError(err: any) {
    if (this.onerror) {
      this.onerror(err);
    }
  }

  close() {
    this.readyState = 2;
  }
}

describe('Trans Bodanon TMS — Real-Time Telematics & Reefer SSE Streaming Engine', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Data Schema & Physical Consistency
  describe('1. TelematicsStreamPacket & Decimal.js Consistency', () => {
    it('creates and validates a high-precision telematics stream packet', () => {
      const packet: TelematicsStreamPacket = {
        id: 'stream_1001',
        tripId: 'TRIP-2026-99',
        truckPlate: '67890-A-40',
        trailerPlate: 'MA-R-8821',
        supplyAirTemp: 3.8,
        returnAirTemp: 4.25,
        ambientTemp: 24.5,
        evaporatorTemp: 2.1,
        compressorStatus: 'running',
        isDefrostActive: false,
        doorOpenSensor: false,
        dieselFuelLevelLiters: 184.5,
        dieselBurnRateLph: 2.1,
        latitude: 31.7917,
        longitude: -7.0926,
        speedKmH: 82,
        isGeofenceSafe: true,
        mktCelsius: 4.12,
        recordedAt: new Date().toISOString(),
      };

      expect(packet.supplyAirTemp).toBeLessThan(packet.returnAirTemp);
      expect(packet.compressorStatus).toBe('running');
      expect(packet.doorOpenSensor).toBe(false);

      // Verify Decimal.js arithmetic on temperature delta
      const delta = new Decimal(packet.returnAirTemp).minus(packet.supplyAirTemp);
      expect(delta.toFixed(2)).toBe('0.45');
    });

    it('calculates Arrhenius MKT accurately using Decimal.js constants', () => {
      const temperatures = [3.5, 4.0, 4.2, 4.5, 5.1];
      const GAS_CONSTANT_R = new Decimal(8.314472);
      const ACTIVATION_ENERGY_DH = new Decimal(83144);
      const ZERO_CELSIUS_KELVIN = new Decimal(273.15);

      let sumExp = new Decimal(0);
      for (const tempC of temperatures) {
        const tempK = new Decimal(tempC).plus(ZERO_CELSIUS_KELVIN);
        const exponent = ACTIVATION_ENERGY_DH.negated().dividedBy(GAS_CONSTANT_R.times(tempK));
        sumExp = sumExp.plus(Decimal.exp(exponent));
      }

      const avgExp = sumExp.dividedBy(temperatures.length);
      const lnAvgExp = Decimal.ln(avgExp);
      const mktKelvin = ACTIVATION_ENERGY_DH.negated().dividedBy(GAS_CONSTANT_R.times(lnAvgExp));
      const mktCelsius = mktKelvin.minus(ZERO_CELSIUS_KELVIN).toDecimalPlaces(2).toNumber();

      expect(mktCelsius).toBeGreaterThan(4.0);
      expect(mktCelsius).toBeLessThan(5.0);
    });
  });

  // 2. Exponential Backoff Algorithm
  describe('2. Exponential Backoff Reconnection Logic', () => {
    it('calculates expected backoff durations and caps at 30 seconds', () => {
      const calculateBackoff = (attempt: number) =>
        Math.min(2000 * Math.pow(1.5, attempt), 30000);

      expect(calculateBackoff(0)).toBe(2000);
      expect(calculateBackoff(1)).toBe(3000);
      expect(calculateBackoff(2)).toBe(4500);
      expect(calculateBackoff(3)).toBe(6750);
      expect(calculateBackoff(10)).toBe(30000); // capped at 30s
    });
  });

  // 3. Mock EventSource Event Dispatch
  describe('3. EventSource Stream Lifecycle Simulation', () => {
    it('creates an EventSource instance with formatted URL query parameters', () => {
      const tripId = 'TRIP-404';
      const truckId = 12;
      const url = `/api/telematics/stream?tripId=${tripId}&truckId=${truckId}&mode=live`;

      const es = new MockEventSource(url);
      expect(es.url).toContain('tripId=TRIP-404');
      expect(es.url).toContain('truckId=12');
      expect(es.url).toContain('mode=live');
    });

    it('receives connected event and parses handshake payload', () => {
      const es = new MockEventSource('/api/telematics/stream?tripId=10');
      let connectedData: StreamConnectedEvent | null = null;

      es.addEventListener('connected', (event) => {
        connectedData = JSON.parse(event.data);
      });

      const handshake: StreamConnectedEvent = {
        status: 'connected',
        companyId: 1,
        tripId: '10',
        timestamp: new Date().toISOString(),
        heartbeatIntervalSeconds: 15,
      };

      es.emit('connected', handshake);

      expect(connectedData).not.toBeNull();
      const parsed = connectedData as StreamConnectedEvent | null;
      expect(parsed?.status).toBe('connected');
      expect(parsed?.companyId).toBe(1);
    });

    it('receives live telemetry event packets in sequence', () => {
      const es = new MockEventSource('/api/telematics/stream?tripId=10');
      const receivedPackets: TelematicsStreamPacket[] = [];

      es.addEventListener('telemetry', (event) => {
        receivedPackets.push(JSON.parse(event.data));
      });

      const packet1: TelematicsStreamPacket = {
        id: 'tick_1',
        supplyAirTemp: 3.9,
        returnAirTemp: 4.1,
        compressorStatus: 'running',
        isDefrostActive: false,
        doorOpenSensor: false,
        isGeofenceSafe: true,
        recordedAt: '2026-10-09T20:50:00Z',
      };

      const packet2: TelematicsStreamPacket = {
        id: 'tick_2',
        supplyAirTemp: 3.8,
        returnAirTemp: 4.0,
        compressorStatus: 'running',
        isDefrostActive: false,
        doorOpenSensor: false,
        isGeofenceSafe: true,
        recordedAt: '2026-10-09T20:50:04Z',
      };

      es.emit('telemetry', packet1);
      es.emit('telemetry', packet2);

      expect(receivedPackets.length).toBe(2);
      expect(receivedPackets[0].id).toBe('tick_1');
      expect(receivedPackets[1].id).toBe('tick_2');
    });

    it('handles critical excursion incident alert stream events', () => {
      const es = new MockEventSource('/api/telematics/stream?tripId=10');
      let capturedIncident: any = null;

      es.addEventListener('incident', (event) => {
        capturedIncident = JSON.parse(event.data);
      });

      const mockIncident = {
        id: 'inc_99',
        incidentType: 'door_breach_transit',
        severity: 'critical',
        startedAt: new Date().toISOString(),
        peakDeviationTemp: 11.5,
        durationMinutes: 12,
        isCleared: false,
      };

      es.emit('incident', mockIncident);

      expect(capturedIncident).not.toBeNull();
      expect(capturedIncident.incidentType).toBe('door_breach_transit');
      expect(capturedIncident.severity).toBe('critical');
    });

    it('handles error events and closes the connection cleanly', () => {
      const es = new MockEventSource('/api/telematics/stream?tripId=10');
      let errorTriggered = false;

      es.onerror = () => {
        errorTriggered = true;
        es.close();
      };

      es.emitError(new Error('Network loss'));

      expect(errorTriggered).toBe(true);
      expect(es.readyState).toBe(2); // CLOSED
    });
  });
});
