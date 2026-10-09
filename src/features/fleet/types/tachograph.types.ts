/**
 * Trans Bodanon TMS — EU Regulation (EC) 561/2006 Tachograph Types
 * Regulates driving times, mandatory breaks, and rest periods for commercial road transport.
 */

import {
  TachographActivityType,
  TachographRadarStatus,
  TachographInfringementSeverity,
  DriverTachographLog,
  DriverComplianceSnapshot,
} from '@/types/database';

export type {
  TachographActivityType,
  TachographRadarStatus,
  TachographInfringementSeverity,
  DriverTachographLog,
  DriverComplianceSnapshot,
};

/**
 * Standard Thresholds according to EU Regulation (EC) No 561/2006
 */
export const TACHOGRAPH_REGULATION = {
  // Continuous Driving
  MAX_CONTINUOUS_DRIVE_MINUTES: 270, // 4 hours 30 minutes
  MANDATORY_BREAK_MINUTES: 45,       // 45 minutes uninterrupted
  SPLIT_BREAK_PART1_MINUTES: 15,     // At least 15 min first
  SPLIT_BREAK_PART2_MINUTES: 30,     // Followed by at least 30 min

  // Daily Driving
  STANDARD_DAILY_DRIVE_MINUTES: 540, // 9 hours
  EXTENDED_DAILY_DRIVE_MINUTES: 600, // 10 hours
  MAX_EXTENSIONS_PER_WEEK: 2,        // Max twice per calendar week

  // Daily Rest
  STANDARD_DAILY_REST_MINUTES: 660,  // 11 hours
  REDUCED_DAILY_REST_MINUTES: 540,   // 9 hours
  MAX_REDUCED_RESTS_PER_WEEK: 3,     // Max 3 times between weekly rest periods

  // Weekly & Fortnightly Driving
  MAX_WEEKLY_DRIVE_MINUTES: 3360,     // 56 hours
  MAX_FORTNIGHTLY_DRIVE_MINUTES: 5400, // 90 hours across 2 consecutive weeks

  // Radar Urgency Thresholds (minutes remaining)
  WARNING_THRESHOLD_MINUTES: 45,
  CRITICAL_THRESHOLD_MINUTES: 15,
} as const;

export interface TachographActivityInput {
  driver_id: number;
  trip_id?: number | null;
  truck_id?: number | null;
  activity_type: TachographActivityType;
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number;
  start_odometer?: number | null;
  end_odometer?: number | null;
  start_location?: string | null;
  end_location?: string | null;
  country_code?: string;
  card_insertion_status?: 'inserted' | 'manual_entry' | 'withdrawn';
  metadata?: Record<string, unknown>;
}

export interface InfringementReport {
  type: 'continuous_drive' | 'daily_drive' | 'insufficient_break' | 'weekly_drive' | 'fortnightly_drive';
  severity: TachographInfringementSeverity;
  description: string;
  excess_minutes: number;
  estimated_fine_eur: string; // Formatted with Decimal.js
}

export interface DriverComplianceStatusResult {
  driver_id: number;
  driver_name?: string;
  truck_plate?: string | null;
  current_activity: TachographActivityType;
  snapshot_timestamp: string;

  // Continuous Drive & Breaks
  continuous_drive_minutes: number;
  remaining_continuous_drive_minutes: number;
  accumulated_break_minutes: number;
  is_split_break_pending: boolean; // 15m completed, waiting for 30m

  // Daily Driving
  daily_drive_minutes: number;
  remaining_daily_drive_minutes: number;
  daily_drive_ceiling_minutes: number; // 540 or 600
  daily_10h_extensions_used_this_week: number;
  extensions_remaining_this_week: number;
  reduced_daily_rests_used_this_week: number;

  // Weekly & Fortnightly Driving
  weekly_drive_minutes: number;
  remaining_weekly_drive_minutes: number;
  fortnightly_drive_minutes: number;
  remaining_fortnightly_drive_minutes: number;

  // Radar State & Actions
  radar_status: TachographRadarStatus;
  infringement_severity: TachographInfringementSeverity;
  active_infringements: InfringementReport[];
  total_estimated_penalties_eur: string; // Calculated strictly via Decimal.js
  recommended_action: string;
  urgency_level: 'green' | 'yellow' | 'red' | 'critical_breach';
}

export interface FleetComplianceRadarSummary {
  total_monitored_drivers: number;
  compliant_count: number;
  warning_count: number;
  critical_urgency_count: number;
  violation_count: number;
  total_risk_exposure_eur: string; // Decimal.js
  drivers: DriverComplianceStatusResult[];
}

