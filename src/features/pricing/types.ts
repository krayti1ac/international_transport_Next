export type CargoType = 'dry_box' | 'reefer_temperature_controlled' | 'mega_curtain' | 'hazardous_adr';

export type FerryRouteKey = 'tanger_med_algeciras' | 'tanger_med_motril' | 'nador_almeria';

export interface CorridorPreset {
  id: string;
  nameAr: string;
  nameFr: string;
  originCity: string;
  destCity: string;
  distanceKm: number;
  moroccoKm: number;
  europeKm: number;
  ferryRoute: FerryRouteKey;
  defaultCargo: CargoType;
}

export interface DynamicPricingParams {
  originCity: string;
  destinationCity: string;
  cargoType: CargoType;
  roadDistanceKm?: number;
  moroccoKm?: number;
  europeKm?: number;
  ferryRoute?: FerryRouteKey;
  targetMarginPercent?: number; // Default: 22%
  departureMonth?: number; // 1-12
  reeferSetpointTemp?: number; // Celsius (e.g. -20 for frozen, 4 for fresh produce)
  weightTons?: number; // Default: 22
  includeReturnCushion?: boolean; // Cushion for empty backhaul return
  exchangeRateEurToMad?: number; // Default: 10.90
}

export interface PricingCostBreakdown {
  fuelCostMoroccoMad: string;
  fuelCostEuropeMad: string;
  fuelTotalMad: string;
  fuelTotalEur: string;
  ferryCrossingCostMad: string;
  ferryCrossingCostEur: string;
  tollCostMoroccoMad: string;
  tollCostEuropeMad: string;
  tollsTotalMad: string;
  tollsTotalEur: string;
  driverAllowancesMad: string;
  driverAllowancesEur: string;
  reeferRunningCostMad: string;
  customsPortFeesMad: string;
  overheadBufferMad: string;
  deadheadCushionMad: string;
  totalDirectCostMad: string;
  totalDirectCostEur: string;
}

export interface PricingTier {
  nameAr: string;
  nameFr: string;
  descriptionAr: string;
  descriptionFr: string;
  priceMad: string;
  priceEur: string;
  profitAmountMad: string;
  profitAmountEur: string;
  marginPercent: number;
  isRecommended?: boolean;
  highlightColor: 'slate' | 'emerald' | 'indigo';
}

export interface DynamicPricingQuote {
  id: string;
  generatedAt: string;
  originCity: string;
  destinationCity: string;
  cargoType: CargoType;
  totalDistanceKm: number;
  moroccoKm: number;
  europeKm: number;
  exchangeRate: number;
  seasonalityIndex: number;
  seasonalityImpactPercent: number;
  seasonalityReasonAr: string;
  seasonalityReasonFr: string;
  deadheadRiskPercent: number;
  smartBunkeringSavingsMad: string;
  smartBunkeringSavingsEur: string;
  bunkeringAdviceAr: string;
  bunkeringAdviceFr: string;
  breakdown: PricingCostBreakdown;
  tiers: {
    floor: PricingTier;
    spot: PricingTier;
    expressPremium: PricingTier;
  };
}

