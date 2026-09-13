export type TelematicsAlertType =
  | 'FUEL_THEFT_DETECTED'
  | 'COOLANT_OVERHEATING'
  | 'EXCESSIVE_IDLING'
  | 'HARSH_DRIVING_OVERSPEED'
  | 'REEFER_TEMP_BREACH';

export type AlertSeverity = 'critical' | 'warning' | 'info';

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
}

export interface TelematicsAlert {
  id: string;
  truck_plate: string;
  alert_type: TelematicsAlertType;
  severity: AlertSeverity;
  title: string;
  title_fr: string;
  description: string;
  description_fr: string;
  timestamp: string;
  metrics: {
    speed_kmh?: number;
    fuel_level_percent?: number;
    fuel_drop_liters?: string;
    coolant_temp_c?: number;
    engine_rpm?: number;
    reefer_temp_c?: number;
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
  engine_health: 'healthy' | 'warning' | 'critical';
  active_alerts: TelematicsAlert[];
}

