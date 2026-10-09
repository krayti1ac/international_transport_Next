/**
 * SAE J1939 / J2012 / OBD-II Diagnostic & Predictive Maintenance Types
 * Trans Bodanon TMS - Heavy-Duty Fleet Telemetry Radar
 */

export type DtcStandard = 'SAE_J1939' | 'SAE_J2012' | 'OBD_II';

export type DtcCategory = 'powertrain' | 'chassis' | 'body' | 'network';

export type DtcSeverity = 'critical' | 'moderate' | 'minor' | 'informational';

export type UrgencyLevel = 'immediate_stop' | 'within_24h' | 'next_scheduled_service' | 'low_priority';

export type DiagnosticEventStatus = 'active' | 'investigating' | 'resolved' | 'ignored';

export type RecommendationStatus = 'pending' | 'scheduled' | 'completed' | 'dismissed';

export interface SparePartItem {
  code: string;
  name: string;
  estimated_cost_mad: string;
  quantity: number;
}

export interface FreezeFrameData {
  engine_rpm?: number;
  coolant_temp_c?: number;
  oil_pressure_kpa?: number;
  vehicle_speed_kmh?: number;
  fuel_rail_pressure_bar?: number;
  intake_air_temp_c?: number;
  battery_voltage?: number;
  def_adblue_level_pct?: number;
  ambient_temp_c?: number;
  engine_load_pct?: number;
}

export interface StandardDtcProfile {
  code: string;
  standard: DtcStandard;
  category: DtcCategory;
  severity: DtcSeverity;
  urgency: UrgencyLevel;
  name_ar: string;
  name_fr: string;
  name_es: string;
  name_en: string;
  description_ar: string;
  description_fr: string;
  description_es: string;
  description_en: string;
  symptom_ar: string;
  symptom_fr: string;
  symptom_es: string;
  action_ar: string;
  action_fr: string;
  action_es: string;
  estimated_labor_hours: number;
  estimated_parts_cost_mad: string;
  estimated_breakdown_cost_mad: string;
  required_spare_parts: SparePartItem[];
  affected_systems: string[];
}

export interface FleetObdDiagnosticEvent {
  id: string;
  company_id: number | string;
  truck_id: number;
  driver_id?: string | null;
  trip_id?: number | null;
  dtc_code: string;
  dtc_standard: DtcStandard;
  category: DtcCategory;
  severity: DtcSeverity;
  description: string;
  mil_status: boolean;
  freeze_frame_data: FreezeFrameData;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  location_name?: string | null;
  status: DiagnosticEventStatus;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
  updated_at: string;
  truck?: {
    id: number;
    plate_number: string;
    model?: string | null;
    brand?: string | null;
  };
  driver?: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
  };
}

export interface PredictiveMaintenanceRecommendation {
  id: string;
  company_id: number | string;
  truck_id: number;
  diagnostic_event_id?: string | null;
  urgency: UrgencyLevel;
  health_index_score: string;
  breakdown_risk_probability: string;
  recommended_action: string;
  required_spare_parts: SparePartItem[];
  estimated_labor_hours: string;
  estimated_cost_mad: string;
  estimated_breakdown_cost_mad: string;
  estimated_savings_mad: string;
  target_corridor?: string | null;
  status: RecommendationStatus;
  maintenance_schedule_id?: number | null;
  created_at: string;
  updated_at: string;
  truck?: {
    id: number;
    plate_number: string;
    model?: string | null;
  };
}

export interface HighRiskTruckAlert {
  truck_id: number;
  plate_number: string;
  model?: string | null;
  health_index: string;
  risk_pct: string;
  top_fault: string;
  severity: DtcSeverity;
  urgency: UrgencyLevel;
  active_faults_count: number;
}

export interface FleetHealthSummary {
  total_trucks_scanned: number;
  average_fleet_health_index: string;
  critical_faults_count: number;
  moderate_faults_count: number;
  minor_faults_count: number;
  trucks_at_breakdown_risk: number;
  total_projected_proactive_cost_mad: string;
  total_projected_breakdown_cost_mad: string;
  total_net_savings_mad: string;
  high_risk_trucks: HighRiskTruckAlert[];
}
