export type TelematicsAlertType =
  | 'FUEL_THEFT_DETECTED'
  | 'COOLANT_OVERHEATING'
  | 'EXCESSIVE_IDLING'
  | 'HARSH_DRIVING_OVERSPEED'
  | 'REEFER_TEMP_BREACH'
  | 'REEFER_DEFROST_STUCK'
  | 'REEFER_REFRIGERANT_LEAK'
  | 'REEFER_CARGO_LOSS_IMMINENT';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type ReeferOperationMode = 'cooling' | 'defrost' | 'heating' | 'standby' | 'off';

export interface FmsTelematicsPacket {
  imei?: string;
  truck_plate: string;
  timestamp?: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  fuel_level_percent: number; // 0 - 100%
  fuel_liters_remaining?: number;
  total_fuel_used_l?: number;
  engine_speed_rpm: number;
  engine_coolant_temp_c: number;
  engine_hours?: number;
  odometer_km: number;
  battery_voltage_v?: number;
  ambient_temp_c?: number;
  reefer_temp_c?: number; // درجة حرارة المقطورة المبردة (Frigo)
  reefer_mode?: ReeferOperationMode;
  is_defrost_active?: boolean;
  defrost_duration_minutes?: number;
  refrigerant_pressure_bar?: number;
  refrigerant_leak_detected?: boolean;
  cargo_setpoint_c?: number;
  trip_id?: number;
}

export interface TelematicsAlert {
  id: string;
  truck_plate: string;
  alert_type: TelematicsAlertType;
  severity: AlertSeverity;
  title: string;
  title_fr: string;
  title_es?: string;
  description: string;
  description_fr: string;
  description_es?: string;
  timestamp: string;
  metrics: {
    speed_kmh?: number;
    fuel_level_percent?: number;
    fuel_drop_liters?: string;
    coolant_temp_c?: number;
    engine_rpm?: number;
    reefer_temp_c?: number;
    defrost_duration_minutes?: number;
    refrigerant_pressure_bar?: number;
    claim_reference?: string;
    gross_loss_estimate?: number;
  };
}

export interface TruckTelematicsState {
  truck_id: number;
  plate_number: string;
  model: string;
  status: 'active' | 'maintenance' | 'idle';
  last_updated: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  fuel_level_percent: number;
  fuel_liters_est: number;
  engine_rpm: number;
  engine_coolant_temp_c: number;
  odometer_km: number;
  reefer_temp_c?: number;
  reefer_mode?: ReeferOperationMode;
  is_defrost_active?: boolean;
  defrost_duration_minutes?: number;
  refrigerant_pressure_bar?: number;
  refrigerant_leak_detected?: boolean;
  active_claim_reference?: string;
  engine_health: 'healthy' | 'warning' | 'critical';
  active_alerts: TelematicsAlert[];
}

