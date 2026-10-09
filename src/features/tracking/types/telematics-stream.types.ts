/**
 * Trans Bodanon TMS — Real-Time Telematics & Reefer Streaming Types
 * Server-Sent Events (SSE) Protocol Definitions
 */

import type { ReeferExcursionIncident, ReeferTelemetryLog } from './reefer-compliance.types';

export type StreamConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TelematicsStreamPacket {
  id: string;
  tripId?: string | number;
  truckId?: number;
  truckPlate?: string;
  trailerPlate?: string;
  supplyAirTemp: number;
  returnAirTemp: number;
  ambientTemp?: number;
  evaporatorTemp?: number;
  compressorStatus: 'running' | 'cycle_sentry' | 'defrost' | 'off';
  isDefrostActive: boolean;
  doorOpenSensor: boolean;
  dieselFuelLevelLiters?: number;
  dieselBurnRateLph?: number;
  latitude?: number;
  longitude?: number;
  speedKmH?: number;
  isGeofenceSafe: boolean;
  mktCelsius?: number;
  recordedAt: string;
}

export interface StreamConnectedEvent {
  status: 'connected';
  companyId: number;
  tripId?: string | number;
  truckId?: number;
  timestamp: string;
  heartbeatIntervalSeconds: number;
}

export interface StreamPingEvent {
  timestamp: string;
}

export interface UseTelematicsStreamOptions {
  tripId?: string | number;
  truckId?: number;
  enabled?: boolean;
  mode?: 'live' | 'simulated';
  onTelemetry?: (packet: TelematicsStreamPacket) => void;
  onIncident?: (incident: ReeferExcursionIncident) => void;
  onError?: (err: Event | Error) => void;
}

export interface UseTelematicsStreamResult {
  status: StreamConnectionStatus;
  latestPacket: TelematicsStreamPacket | null;
  history: TelematicsStreamPacket[];
  incidents: ReeferExcursionIncident[];
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
}

