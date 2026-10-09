/**
 * Tire Fleet Management, Tread Wear Telematics & Axle Lifecycle Types
 * Trans Bodanon TMS - Heavy-Duty Tire Assets & TPMS Intelligence
 */

export type AxleLayoutType = '4x2' | '6x2' | '6x4' | 'tri_axle_trailer';

export type TireAxlePosition =
  // Steer Axle (Truck)
  | '1L'
  | '1R'
  // Drive Axle 1 (Truck - Duals: Left Outer/Inner, Right Inner/Outer)
  | '2LO'
  | '2LI'
  | '2RI'
  | '2RO'
  // Drive Axle 2 or Tag/Lift Axle (Truck)
  | '3LO'
  | '3LI'
  | '3RI'
  | '3RO'
  | '3L'
  | '3R'
  // Trailer Tri-Axle
  | 'T1L'
  | 'T1R'
  | 'T2L'
  | 'T2R'
  | 'T3L'
  | 'T3R';

export type TireStatus = 'mounted' | 'in_stock' | 'scrapped' | 'retreaded';

export type TireConditionHealth = 'optimal' | 'good' | 'warning' | 'critical' | 'legal_limit';

export type TpmsAlertFlag =
  | 'normal'
  | 'low_pressure'
  | 'critical_low_pressure'
  | 'high_pressure'
  | 'overheating'
  | 'slow_leak';

export interface TireWearMetrics {
  accumulated_km: number;
  worn_depth_mm: string;
  wear_rate_mm_per_10k_km: string;
  remaining_usable_depth_mm: string;
  projected_remaining_km: number;
  tire_cpk_mad: string;
  health_condition: TireConditionHealth;
  rotation_recommended: boolean;
  rotation_reason?: string;
}

export interface TireSensorTelematicsLog {
  id: string;
  company_id: number | string;
  tire_id: string;
  truck_id?: number | null;
  trailer_id?: number | null;
  pressure_bar: string;
  temperature_c: string;
  tread_depth_mm?: string | null;
  battery_level_pct?: number | null;
  alert_flags: TpmsAlertFlag[];
  recorded_at: string;
}

export interface FleetTire {
  id: string;
  company_id: number | string;
  serial_number: string;
  brand: string;
  model?: string | null;
  size: string;
  dot_code?: string | null;
  vehicle_type: 'truck' | 'trailer';
  truck_id?: number | null;
  trailer_id?: number | null;
  axle_position: TireAxlePosition;
  initial_tread_depth_mm: string;
  current_tread_depth_mm: string;
  purchase_cost_mad: string;
  installed_km: number;
  current_km: number;
  status: TireStatus;
  installed_at?: string | null;
  last_inspected_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  truck?: {
    id: number;
    plate_number: string;
    model?: string | null;
  };
  trailer?: {
    id: number;
    plate_number: string;
  };
  latest_telematics?: TireSensorTelematicsLog;
  metrics?: TireWearMetrics;
}

export interface FleetTireSummary {
  total_tires_active: number;
  average_tread_depth_mm: string;
  tires_below_safety_threshold: number;
  tires_at_legal_limit: number;
  active_tpms_alerts_count: number;
  fleet_average_tire_cpk_mad: string;
  total_projected_tire_replacement_budget_mad: string;
}

export interface DualTirePairEvaluation {
  axle: string;
  outer_position: TireAxlePosition;
  inner_position: TireAxlePosition;
  outer_tire?: FleetTire;
  inner_tire?: FleetTire;
  depth_delta_mm: string;
  is_mismatched: boolean;
  warning_message_ar?: string;
  warning_message_fr?: string;
  warning_message_es?: string;
}
