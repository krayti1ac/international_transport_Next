/**
 * Trans Bodanon TMS — Green Freight & ESG Carbon Footprint Types
 * Standards: GLEC Framework v3.0 | ISO 14083 | EU CBAM Aligned
 */

import type Decimal from 'decimal.js';

export type DecimalValue = number | string | InstanceType<typeof Decimal>;

export type TruckEuroClass = 'euro_5' | 'euro_6' | 'electric_hybrid';

export type CarbonEfficiencyRating = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * GLEC Framework v3.0 Official Standard Emission Factors (gCO2e / t-km)
 * WTW: Well-to-Wheel (Full Life Cycle: Extraction, Refining, Transport + Combustion)
 * TTW: Tank-to-Wheel (Direct Tailpipe Combustion)
 */
export interface GledEmissionFactors {
  // Road Freight (>32t articulated truck with temperature controlled reefer)
  roadWtwEuro6: string; // 95.40 gCO2e / t-km
  roadWtwEuro5: string; // 108.20 gCO2e / t-km
  roadWtwElectricHybrid: string; // 42.00 gCO2e / t-km

  // Maritime Ro-Ro Ferry (Short-Sea Mediterranean Corridor: Tanger Med <-> Algeciras/Motril)
  ferryWtwRoRo: string; // 52.10 gCO2e / t-km

  // Diesel Reefer Auxiliary Unit
  reeferLitersPerHour: string; // 2.50 L/h
  dieselWtwKgPerLiter: string; // 3.24 kgCO2e / L (Well-to-Wheel)
  dieselTtwKgPerLiter: string; // 2.68 kgCO2e / L (Tank-to-Wheel)

  // TTW / WTW ratio for road transport
  roadTtwRatio: string; // 0.81 (approx 81% of WTW is direct tailpipe)
}

export const GLEC_V3_FACTORS: GledEmissionFactors = {
  roadWtwEuro6: '95.40',
  roadWtwEuro5: '108.20',
  roadWtwElectricHybrid: '42.00',
  ferryWtwRoRo: '52.10',
  reeferLitersPerHour: '2.50',
  dieselWtwKgPerLiter: '3.24',
  dieselTtwKgPerLiter: '2.68',
  roadTtwRatio: '0.81',
};

export interface CarbonCalculationInput {
  cargoWeightTons: DecimalValue; // Cargo weight in metric tons
  roadDistanceKm: DecimalValue; // Driven overland distance in km
  ferryDistanceKm?: DecimalValue; // Maritime ferry crossing distance in km (default 0)
  truckEuroClass?: TruckEuroClass; // default euro_6
  isReefer?: boolean; // default true
  reeferHours?: DecimalValue; // Total operating hours of the cooling unit (default 0)
  customFactors?: Partial<GledEmissionFactors>;
}

export interface CarbonFootprintResult {
  cargoWeightTons: string;
  roadDistanceKm: string;
  ferryDistanceKm: string;
  totalDistanceKm: string;
  tonKilometers: string; // t-km (Weight * Total Distance)

  // Well-to-Wheel (WTW) breakdown in kg CO2e
  roadWtwEmissionsKg: string;
  ferryWtwEmissionsKg: string;
  reeferWtwEmissionsKg: string;
  totalWtwEmissionsKg: string;

  // Tank-to-Wheel (TTW) breakdown in kg CO2e (Direct tailpipe for CBAM reporting)
  totalTtwEmissionsKg: string;

  // Carbon Intensity Metric
  emissionsIntensityGPerTkm: string; // gCO2e / t-km

  // Multimodal Ecological Comparison (Vs Counterfactual All-Road)
  baselineAllRoadEmissionsKg: string;
  emissionsSavedKg: string;
  emissionsSavingsPercentage: string;

  // Efficiency Rating
  efficiencyRating: CarbonEfficiencyRating;
  ratingDescription: string;
  glecFrameworkVersion: string;
}

export interface GreenFreightCertificate {
  certificateId: string;
  certificateHash: string; // HMAC-SHA256 Cryptographic Seal
  issuedAt: string;
  tripId: number;
  cmrNumber?: string;
  route: string;
  clientName?: string;
  clientCountry?: string;
  vehiclePlate?: string;
  results: CarbonFootprintResult;
  standardsCompliance: {
    glecVersion: string;
    iso14083Compliant: boolean;
    euCbamAligned: boolean;
    ghgProtocolScope: 'Scope 3 (Category 4 / Upstream Transport & Distribution)';
  };
}

