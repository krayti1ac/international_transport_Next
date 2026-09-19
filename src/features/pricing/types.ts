export type CargoType = 'dry_box' | 'reefer_temperature_controlled' | 'mega_curtain' | 'hazardous_adr';

export type FerryRouteKey =
  | 'tanger_med_algeciras'
  | 'tanger_med_motril'
  | 'nador_almeria'
  | 'none_land_africa';

export type PricingCorridorType = 'european_maritime' | 'african_overland';

export interface CorridorPreset {
  id: string;
  nameAr: string;
  nameFr: string;
  originCity: string;
  destCity: string;
  distanceKm: number;
  moroccoKm: number;
  europeKm: number;
  africaKm?: number;
  corridorType?: PricingCorridorType;
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
  africaKm?: number;
  corridorType?: PricingCorridorType;
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
  fuelCostAfricaMad?: string;
  fuelTotalMad: string;
  fuelTotalEur: string;
  fuelTotalMru?: string;
  fuelTotalXof?: string;
  ferryCrossingCostMad: string;
  ferryCrossingCostEur: string;
  africanBorderFeesMad?: string;
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
  totalDirectCostMru?: string;
  totalDirectCostXof?: string;
}

export interface PricingTier {
  nameAr: string;
  nameFr: string;
  descriptionAr: string;
  descriptionFr: string;
  priceMad: string;
  priceEur: string;
  priceMru?: string;
  priceXof?: string;
  profitAmountMad: string;
  profitAmountEur: string;
  profitAmountMru?: string;
  profitAmountXof?: string;
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
  corridorType: PricingCorridorType;
  totalDistanceKm: number;
  moroccoKm: number;
  europeKm: number;
  africaKm?: number;
  exchangeRate: number;
  seasonalityIndex: number;
  seasonalityImpactPercent: number;
  seasonalityReasonAr: string;
  seasonalityReasonFr: string;
  deadheadRiskPercent: number;
  smartBunkeringSavingsMad: string;
  smartBunkeringSavingsEur: string;
  smartBunkeringSavingsMru?: string;
  smartBunkeringSavingsXof?: string;
  bunkeringAdviceAr: string;
  bunkeringAdviceFr: string;
  breakdown: PricingCostBreakdown;
  tiers: {
    floor: PricingTier;
    spot: PricingTier;
    expressPremium: PricingTier;
  };
}

export const CORRIDOR_PRESETS: CorridorPreset[] = [
  // European Maritime Corridor (شمالاً عبر الموانئ والعبّارات)
  {
    id: 'agadir_perpignan',
    nameAr: 'أكادير ⟵ بربينيان (منتجات فلاحية مبردة)',
    nameFr: 'Agadir ⟵ Perpignan (Primeurs Frigo)',
    originCity: 'Agadir',
    destCity: 'Perpignan',
    distanceKm: 2450,
    moroccoKm: 820,
    europeKm: 1630,
    corridorType: 'european_maritime',
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'reefer_temperature_controlled',
  },
  {
    id: 'casablanca_paris',
    nameAr: 'الدار البيضاء ⟵ باريس (صناعات ومعدات)',
    nameFr: 'Casablanca ⟵ Paris (Industriel & Équipements)',
    originCity: 'Casablanca',
    destCity: 'Paris',
    distanceKm: 2320,
    moroccoKm: 340,
    europeKm: 1980,
    corridorType: 'european_maritime',
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'dry_box',
  },
  {
    id: 'tanger_madrid',
    nameAr: 'طنجة ⟵ مدريد (شحن سريع ومكوكات)',
    nameFr: 'Tanger ⟵ Madrid (Navette Express)',
    originCity: 'Tanger',
    destCity: 'Madrid',
    distanceKm: 750,
    moroccoKm: 50,
    europeKm: 700,
    corridorType: 'european_maritime',
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'mega_curtain',
  },
  {
    id: 'nador_barcelona',
    nameAr: 'الناظور ⟵ برشلونة (تصدير كيميائي / ADR)',
    nameFr: 'Nador ⟵ Barcelone (Chimique / ADR)',
    originCity: 'Nador',
    destCity: 'Barcelona',
    distanceKm: 1280,
    moroccoKm: 60,
    europeKm: 1220,
    corridorType: 'european_maritime',
    ferryRoute: 'nador_almeria',
    defaultCargo: 'hazardous_adr',
  },
  {
    id: 'marrakech_lyon',
    nameAr: 'مراكش ⟵ ليون (منسوجات وسلع عامة)',
    nameFr: 'Marrakech ⟵ Lyon (Textile & Général)',
    originCity: 'Marrakech',
    destCity: 'Lyon',
    distanceKm: 2380,
    moroccoKm: 580,
    europeKm: 1800,
    corridorType: 'european_maritime',
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'dry_box',
  },

  // African Overland Corridor (جنوباً عبر معبر الكركارات وموريتانيا 100% بري)
  {
    id: 'agadir_nouakchott',
    nameAr: 'أكادير ⟵ نواكشوط (موريتانيا - خضار ومواد تموينية)',
    nameFr: 'Agadir ⟵ Nouakchott (Mauritanie - Primeurs & Vivres)',
    originCity: 'Agadir',
    destCity: 'Nouakchott',
    distanceKm: 1980,
    moroccoKm: 1430,
    europeKm: 0,
    africaKm: 550,
    corridorType: 'african_overland',
    ferryRoute: 'none_land_africa',
    defaultCargo: 'reefer_temperature_controlled',
  },
  {
    id: 'casablanca_dakar',
    nameAr: 'الدار البيضاء ⟵ داكار (السنغال - سلع عامة وصناعية)',
    nameFr: 'Casablanca ⟵ Dakar (Sénégal - Fret Général & Industriel)',
    originCity: 'Casablanca',
    destCity: 'Dakar',
    distanceKm: 3150,
    moroccoKm: 1900,
    europeKm: 0,
    africaKm: 1250,
    corridorType: 'african_overland',
    ferryRoute: 'none_land_africa',
    defaultCargo: 'dry_box',
  },
  {
    id: 'dakhla_nouadhibou',
    nameAr: 'الداخلة ⟵ نواديبو (تبادل حدودي وأسماك مبردة)',
    nameFr: 'Dakhla ⟵ Nouadhibou (Échanges Frontaliers & Marée)',
    originCity: 'Dakhla',
    destCity: 'Nouadhibou',
    distanceKm: 460,
    moroccoKm: 400,
    europeKm: 0,
    africaKm: 60,
    corridorType: 'african_overland',
    ferryRoute: 'none_land_africa',
    defaultCargo: 'reefer_temperature_controlled',
  },
];
