import type {
  GeoBreadcrumbPoint,
  TrackingMovementState,
  AutonomousTrackingConfig,
  AutonomousTrackerStatus,
} from '../types/offline-geolocation.types';
import { DEFAULT_TRACKING_CONFIG } from '../types/offline-geolocation.types';
import {
  enqueueBreadcrumb,
  getPendingBreadcrumbsCount,
  getLastRecordedBreadcrumb,
} from '@/lib/offline/driver-geo-db';

type StatusListener = (status: AutonomousTrackerStatus) => void;

class AutonomousGeoTrackerService {
  private activeTripId: number | null = null;
  private activeTruckId: number | null = null;
  private activeDriverId: number | null = null;
  private config: AutonomousTrackingConfig = DEFAULT_TRACKING_CONFIG;

  private isRunning = false;
  private currentState: TrackingMovementState = 'idle';
  private watchId: number | null = null;
  private nextIntervalTimer: NodeJS.Timeout | null = null;

  private lastPosition: GeolocationPosition | null = null;
  private lastRecordedAt: string | undefined;
  private currentBatteryLevel: number | undefined;
  private isCharging = false;

  private listeners: Set<StatusListener> = new Set();

  constructor() {
    this.initBatteryMonitoring();
    this.initNetworkMonitoring();
  }

  private async initBatteryMonitoring() {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.currentBatteryLevel = Math.round(battery.level * 100);
        this.isCharging = battery.charging;

        battery.addEventListener('levelchange', () => {
          this.currentBatteryLevel = Math.round(battery.level * 100);
          this.notifyListeners();
        });
        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.notifyListeners();
        });
      } catch {
        // Battery API not permitted or unavailable
      }
    }
  }

  private initNetworkMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notifyListeners();
      });
      window.addEventListener('offline', () => {
        this.notifyListeners();
      });
    }
  }

  /**
   * Evaluates the movement state based on GPS speed (in km/h).
   */
  public evaluateMovementState(speedKmh?: number | null): TrackingMovementState {
    if (speedKmh == null || isNaN(speedKmh) || speedKmh < 5) {
      return 'stationary';
    }
    if (speedKmh > 40) {
      return 'moving_fast';
    }
    return 'moving_slow';
  }

  /**
   * Computes the adaptive interval duration based on state and battery level.
   */
  public computeNextIntervalMs(state: TrackingMovementState): number {
    let baseInterval = this.config.stationaryIntervalMs;

    if (state === 'moving_fast') {
      baseInterval = this.config.fastIntervalMs;
    } else if (state === 'moving_slow') {
      baseInterval = this.config.slowIntervalMs;
    }

    // Critical Battery Saver Guard: If battery < 15% and not charging in remote desert, double the sleep interval
    if (this.currentBatteryLevel !== undefined && this.currentBatteryLevel < 15 && !this.isCharging) {
      baseInterval = baseInterval * 2;
    }

    return baseInterval;
  }

  /**
   * Starts autonomous background GPS tracking for a driver trip.
   */
  public async startTracking(
    tripId: number,
    options?: {
      truckId?: number | null;
      driverId?: number | null;
      config?: Partial<AutonomousTrackingConfig>;
    }
  ): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      console.warn('Geolocation is not supported in this browser/device');
      return false;
    }

    this.activeTripId = tripId;
    this.activeTruckId = options?.truckId || null;
    this.activeDriverId = options?.driverId || null;
    if (options?.config) {
      this.config = { ...this.config, ...options.config };
    }

    this.isRunning = true;
    this.currentState = 'stationary';

    // 1. Initial capture
    this.captureAndScheduleNext();

    // 2. Set high accuracy location watcher
    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.lastPosition = position;
          const speedKmh = position.coords.speed != null ? position.coords.speed * 3.6 : undefined;
          this.currentState = this.evaluateMovementState(speedKmh);
          this.notifyListeners();
        },
        (error) => {
          console.warn('Autonomous GPS watch warning:', error.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 20000,
        }
      );
    } catch (err) {
      console.error('Failed to start geolocation watch:', err);
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Stops autonomous tracking.
   */
  public stopTracking(): void {
    this.isRunning = false;
    this.currentState = 'idle';

    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.nextIntervalTimer) {
      clearTimeout(this.nextIntervalTimer);
      this.nextIntervalTimer = null;
    }

    this.notifyListeners();
  }

  /**
   * Captures position immediately, enqueues breadcrumb, and schedules next sampling.
   */
  public async captureAndScheduleNext(): Promise<void> {
    if (!this.isRunning || !this.activeTripId) return;

    if (this.lastPosition) {
      await this.recordPosition(this.lastPosition);
    } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          this.lastPosition = pos;
          await this.recordPosition(pos);
        },
        () => {
          // Non-blocking error
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }

    // Schedule next cycle adaptively
    const delayMs = this.computeNextIntervalMs(this.currentState);
    if (this.nextIntervalTimer) clearTimeout(this.nextIntervalTimer);

    this.nextIntervalTimer = setTimeout(() => {
      this.captureAndScheduleNext();
    }, delayMs);
  }

  /**
   * Records a position reading into the offline queue.
   */
  public async recordPosition(pos: GeolocationPosition): Promise<boolean> {
    if (!this.activeTripId) return false;

    const coords = pos.coords;
    const timestamp = new Date(pos.timestamp || Date.now()).toISOString();
    const speedKmh = coords.speed != null ? coords.speed * 3.6 : undefined;
    const state = this.evaluateMovementState(speedKmh);

    const breadcrumb: GeoBreadcrumbPoint = {
      id: `pt_${this.activeTripId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tripId: this.activeTripId,
      truckId: this.activeTruckId,
      driverId: this.activeDriverId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      speed: speedKmh,
      heading: coords.heading != null ? coords.heading : undefined,
      altitude: coords.altitude != null ? coords.altitude : undefined,
      batteryLevel: this.currentBatteryLevel,
      isCharging: this.isCharging,
      state,
      timestamp,
      idempotencyKey: `geo_${this.activeTripId}_${timestamp}`,
      synced: false,
    };

    const enqueued = await enqueueBreadcrumb(breadcrumb, this.config);
    if (enqueued) {
      this.lastRecordedAt = timestamp;
      this.notifyListeners();
    }
    return enqueued;
  }

  /**
   * Returns current tracking status for UI components.
   */
  public async getStatus(): Promise<AutonomousTrackerStatus> {
    const queueCount = await getPendingBreadcrumbsCount();
    const lastPoint = await getLastRecordedBreadcrumb();

    return {
      isActive: this.isRunning,
      currentState: this.currentState,
      pendingQueueCount: queueCount,
      lastRecordedAt: this.lastRecordedAt || lastPoint?.timestamp,
      lastCoordinates: lastPoint
        ? { latitude: lastPoint.latitude, longitude: lastPoint.longitude }
        : this.lastPosition
        ? { latitude: this.lastPosition.coords.latitude, longitude: this.lastPosition.coords.longitude }
        : undefined,
      batteryLevel: this.currentBatteryLevel,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };
  }

  /**
   * Subscribes a listener to status updates.
   */
  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    this.getStatus().then((s) => listener(s));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners(): Promise<void> {
    if (this.listeners.size === 0) return;
    const status = await this.getStatus();
    this.listeners.forEach((l) => l(status));
  }
}

// Singleton export
export const autonomousGeoTracker = new AutonomousGeoTrackerService();

