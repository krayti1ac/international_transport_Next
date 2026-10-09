import type { TachographActivityType } from './tachograph.types';

/**
 * معايير SAE J1939 القياسية لرسالة TCO1 (Tachograph PGN 65138)
 * SPN 1612: Driver 1 Working State
 * 00 = Rest / Break
 * 01 = Available / Short Stop
 * 10 = Work / Other Work
 * 11 = Drive
 */
export type FmsTco1DriverWorkingState = '00' | '01' | '10' | '11';

export interface FmsTachographRawPacket {
  vehicleId: string;
  driverCardId?: string;
  driverWorkingState: FmsTco1DriverWorkingState; // SPN 1612
  tachographVehicleSpeedKmh: number;            // SPN 1615
  timestamp: string;                            // ISO 8601
  rawPayloadHex?: string;
  sourceDevice: 'teltonika' | 'queclink' | 'fms_standard';
}

export interface FmsTachographSyncResult {
  vehicleId: string;
  driverId: string;
  activityType: TachographActivityType;
  speedKmh: number;
  isAutoSpeedOverride: boolean;
  timestamp: string;
  logId?: string;
}

