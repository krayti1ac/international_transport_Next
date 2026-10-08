export type TrackingMovementState =
  | 'stationary' // Speed < 5 km/h (resting, customs queue, overnight stop)
  | 'moving_slow' // Speed 5 - 40 km/h (city traffic, port navigation, rough track)
  | 'moving_fast' // Speed > 40 km/h (highway, open desert highway)
  | 'idle'; // Tracking paused or inactive

export interface GeoBreadcrumbPoint {
  id: string; // Unique UUID / timestamp key
  tripId: number;
  truckId?: number | null;
  driverId?: number | null;
  latitude: number;
  longitude: number;
  accuracy?: number; // In meters
  speed?: number; // In km/h
  heading?: number; // 0 - 360 degrees
  altitude?: number; // In meters
  batteryLevel?: number; // 0 - 100 percentage
  isCharging?: boolean;
  state: TrackingMovementState;
  timestamp: string; // ISO 8601 string
  idempotencyKey: string; // `geo_${tripId}_${timestamp}`
  synced: boolean;
  retryCount?: number;
  lastError?: string;
}

export interface AutonomousTrackingConfig {
  fastIntervalMs: number; // Interval when speed > 40 km/h (default: 60,000ms / 1 min)
  slowIntervalMs: number; // Interval when speed 5-40 km/h (default: 180,000ms / 3 min)
  stationaryIntervalMs: number; // Interval when stationary (default: 600,000ms / 10 min)
  deadbandDistanceMeters: number; // Minimum distance displacement required (default: 15m)
  maxBreadcrumbsQueueSize: number; // Maximum queued points before pruning old ones (default: 5,000)
  batchSyncSize: number; // Max breadcrumbs sent per sync batch (default: 50)
  maxAccuracyThresholdMeters: number; // Discard GPS points with error > 100m (default: 100m)
}

export const DEFAULT_TRACKING_CONFIG: AutonomousTrackingConfig = {
  fastIntervalMs: 60 * 1000, // 1 min
  slowIntervalMs: 180 * 1000, // 3 min
  stationaryIntervalMs: 600 * 1000, // 10 min
  deadbandDistanceMeters: 15, // 15 meters
  maxBreadcrumbsQueueSize: 5000, // 5000 points
  batchSyncSize: 50, // 50 points per chunk
  maxAccuracyThresholdMeters: 100, // 100 meters
};

export interface GeoSyncBatchResult {
  success: boolean;
  totalReceived: number;
  insertedCount: number;
  skippedDuplicates: number;
  failedCount: number;
  syncedAt: string;
  error?: string;
}

export interface AutonomousTrackerStatus {
  isActive: boolean;
  currentState: TrackingMovementState;
  pendingQueueCount: number;
  lastRecordedAt?: string;
  lastCoordinates?: { latitude: number; longitude: number };
  batteryLevel?: number;
  isOnline: boolean;
}

