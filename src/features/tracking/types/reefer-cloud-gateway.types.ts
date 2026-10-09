/**
 * Trans Bodanon TMS — Carrier Transicold & Thermo King Cloud Gateway Types
 * Standardization & Translation Layer for Industrial Refrigeration Telematics (DataCOLD & TracKing)
 */

import type { ReeferTelemetryLog } from './reefer-compliance.types';

export type ReeferOemBrand = 'carrier_transicold' | 'thermo_king';

export type ReeferOemAlarmSeverity = 'info' | 'warning' | 'critical_shutdown';

export interface ReeferOemAlarm {
  code: string;
  source: ReeferOemBrand;
  severity: ReeferOemAlarmSeverity;
  labelAr: string;
  labelFr: string;
  labelEs: string;
  description?: string;
  requiresImmediateStop: boolean;
}

/**
 * 1. Carrier Transicold DataCOLD & eSolutions Telematics Packet Schema
 */
export interface CarrierDataColdPayload {
  serialNumber: string;
  unitModel?: string; // e.g. "Vector 1550", "Vector HE 19", "Supra 850"
  timestamp: string;
  probes: {
    supplyAirTemp: number; // T1 / Supply
    returnAirTemp: number; // T2 / Return
    defrostCoilTemp?: number; // T3 / Evaporator
    ambientTemp?: number; // T4 / Ambient
  };
  setpoint: number;
  operationMode: 'cooling' | 'heating' | 'defrost' | 'null' | 'off';
  engineStatus: 'high_speed' | 'low_speed' | 'standby_electric' | 'off';
  doorStatus: {
    doorOpen: boolean;
    doorSensorActive: boolean;
  };
  fuel: {
    tankPercent?: number;
    fuelLevelLiters?: number;
    estimatedBurnRateLph?: number;
  };
  alarms?: string[]; // e.g. ["AL01", "AL12", "AL31"]
  location?: {
    latitude?: number;
    longitude?: number;
    speedKmH?: number;
  };
}

/**
 * 2. Thermo King TracKing & OptiTemp Cloud Telematics Packet Schema
 */
export interface ThermoKingTracKingPayload {
  vinOrTrailerId: string;
  deviceImei?: string;
  reeferModel?: string; // e.g. "SLXi 400", "Advancer A-400", "Advancer A-500"
  dateTimeUtc: string;
  temperatures: {
    dischargeAirTemp: number; // Supply
    returnAirTemp: number; // Return
    ambientTemp?: number;
    evaporatorTemp?: number;
  };
  tempSetpoint: number;
  controlMode: 'continuous' | 'cycle_sentry' | 'defrost' | 'off';
  powerSource: 'diesel_engine' | 'electric_motor' | 'standby';
  engineTotalHours?: number;
  electricTotalHours?: number;
  fuel: {
    fuelLevelPercent?: number;
    fuelVolumeLiters?: number;
    fuelConsumptionRateLph?: number;
  };
  doorState: {
    rearDoorOpen: boolean;
    sideDoorOpen?: boolean;
  };
  optiSetProfile?: string;
  activeAlarms?: Array<{
    alarmCode: number | string;
    alarmDescription?: string;
    alarmSeverity?: 'log' | 'check' | 'shutdown';
  }>;
  gps?: {
    lat?: number;
    lon?: number;
    speed?: number;
  };
}

/**
 * Normalized Ingested Packet
 */
export interface NormalizedReeferOemPacket {
  oemBrand: ReeferOemBrand;
  serialNumber: string;
  tripId?: string | number;
  telemetryLog: ReeferTelemetryLog;
  parsedAlarms: ReeferOemAlarm[];
  engineMode: string;
  totalEngineHours?: number;
  fuelLevelPercent?: number;
}

/**
 * Catalog of Standard Carrier Transicold Alarm Codes
 */
export const CARRIER_DATACOLD_ALARM_CATALOG: Record<string, ReeferOemAlarm> = {
  AL01: {
    code: 'AL01',
    source: 'carrier_transicold',
    severity: 'warning',
    labelAr: 'انخفاض مستوى وقود الديزل في خزان التبريد',
    labelFr: 'Niveau bas de carburant groupe frigo',
    labelEs: 'Nivel bajo de combustible del equipo de frío',
    requiresImmediateStop: false,
  },
  AL03: {
    code: 'AL03',
    source: 'carrier_transicold',
    severity: 'critical_shutdown',
    labelAr: 'فشل إقلاع محرك الديزل للوحدة (Engine Crank Failure)',
    labelFr: 'Échec de démarrage du moteur diesel groupe',
    labelEs: 'Fallo de arranque del motor diésel',
    requiresImmediateStop: true,
  },
  AL12: {
    code: 'AL12',
    source: 'carrier_transicold',
    severity: 'critical_shutdown',
    labelAr: 'ضغط تفريغ مرتفع لغاز التبريد (High Discharge Pressure)',
    labelFr: 'Pression de refoulement frigo trop élevée',
    labelEs: 'Alta presión de descarga del refrigerante',
    requiresImmediateStop: true,
  },
  AL15: {
    code: 'AL15',
    source: 'carrier_transicold',
    severity: 'warning',
    labelAr: 'انخفاض جهد بطارية وحدة التبريد (Low Battery Voltage)',
    labelFr: 'Tension de batterie unité basse',
    labelEs: 'Tensión baja de batería de la unidad',
    requiresImmediateStop: false,
  },
  AL20: {
    code: 'AL20',
    source: 'carrier_transicold',
    severity: 'critical_shutdown',
    labelAr: 'عطل في حساس هواء الضخ (Supply Probe Error)',
    labelFr: 'Défaut sonde de soufflage (Supply Probe)',
    labelEs: 'Fallo de sonda de aire impulsado',
    requiresImmediateStop: true,
  },
  AL21: {
    code: 'AL21',
    source: 'carrier_transicold',
    severity: 'critical_shutdown',
    labelAr: 'عطل في حساس هواء الراجع (Return Probe Error)',
    labelFr: 'Défaut sonde de reprise (Return Probe)',
    labelEs: 'Fallo de sonda de aire de retorno',
    requiresImmediateStop: true,
  },
  AL31: {
    code: 'AL31',
    source: 'carrier_transicold',
    severity: 'warning',
    labelAr: 'تجاوز مهلة فتح باب المقطورة أثناء العمل',
    labelFr: 'Dépassement temporisation ouverture porte',
    labelEs: 'Tiempo de apertura de puerta excedido',
    requiresImmediateStop: false,
  },
};

/**
 * Catalog of Standard Thermo King TracKing Alarm Codes
 */
export const THERMO_KING_ALARM_CATALOG: Record<string, ReeferOemAlarm> = {
  TK10: {
    code: 'TK10',
    source: 'thermo_king',
    severity: 'critical_shutdown',
    labelAr: 'ضغط تفريغ المحرك مرتفع (High Discharge Pressure)',
    labelFr: 'Haute pression de refoulement TK',
    labelEs: 'Alta presión de descarga TK',
    requiresImmediateStop: true,
  },
  TK17: {
    code: 'TK17',
    source: 'thermo_king',
    severity: 'critical_shutdown',
    labelAr: 'المحرك لا يدور (Engine Failed to Crank)',
    labelFr: 'Moteur incapable de tourner au démarrage',
    labelEs: 'El motor no gira en el arranque',
    requiresImmediateStop: true,
  },
  TK20: {
    code: 'TK20',
    source: 'thermo_king',
    severity: 'critical_shutdown',
    labelAr: 'فشل تشغيل محرك الديزل (Engine Failed to Start)',
    labelFr: 'Échec de démarrage du moteur thermique',
    labelEs: 'Fallo de arranque del motor térmico',
    requiresImmediateStop: true,
  },
  TK31: {
    code: 'TK31',
    source: 'thermo_king',
    severity: 'warning',
    labelAr: 'فحص مروحة التبريد / سير الدفع (Check Unit Belts)',
    labelFr: 'Vérifier courroies de ventilation unité',
    labelEs: 'Comprobar correas de ventilación',
    requiresImmediateStop: false,
  },
  TK61: {
    code: 'TK61',
    source: 'thermo_king',
    severity: 'warning',
    labelAr: 'انخفاض بطارية الدائرة الإلكترونية (Low Battery Voltage)',
    labelFr: 'Tension de batterie trop basse',
    labelEs: 'Tensión de batería baja',
    requiresImmediateStop: false,
  },
  TK92: {
    code: 'TK92',
    source: 'thermo_king',
    severity: 'critical_shutdown',
    labelAr: 'خطأ قراءة مستشعر درجات الحرارة (Sensor Reading Error)',
    labelFr: 'Erreur lecture capteur de température',
    labelEs: 'Error de lectura de sensor de temperatura',
    requiresImmediateStop: true,
  },
  TK134: {
    code: 'TK134',
    source: 'thermo_king',
    severity: 'warning',
    labelAr: 'انخفاض وقود الديزل (Low Fuel Warning)',
    labelFr: 'Niveau bas de gazole TK',
    labelEs: 'Aviso de combustible bajo TK',
    requiresImmediateStop: false,
  },
};

