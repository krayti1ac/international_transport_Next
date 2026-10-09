/**
 * Trans Bodanon TMS — European Tolls & Eurovignette Engine Types
 * Compliant with DKV Box Europe, Telepass EU, AS 24 Pass,
 * Spanish Via-T, French Télépéage, German LKW-Maut, and Northern Eurovignettes.
 */

export type TollSystem =
  | 'via_t'          // Spain (Autopistas / Telepeaje)
  | 'telepeage'      // France (Autoroutes / Télépéage Liber-T / TIS-PL)
  | 'lkw_maut'       // Germany (Toll Collect / LKW-Maut)
  | 'eurovignette'   // Netherlands, Belgium (Flanders/Wallonia vignette), Denmark, Sweden, Luxembourg
  | 'viapass'        // Belgium Kilometric Charge
  | 'cemavat'        // Portugal EasyToll / Via Verde
  | 'generic_toll';

export type TollProvider =
  | 'dkv'
  | 'telepass'
  | 'as24'
  | 'eurotoll'
  | 'totalenergies_pass'
  | 'manual'
  | 'generic';

export type TollCountryCode =
  | 'ES' // Spain
  | 'FR' // France
  | 'DE' // Germany
  | 'NL' // Netherlands
  | 'BE' // Belgium
  | 'LU' // Luxembourg
  | 'DK' // Denmark
  | 'SE' // Sweden
  | 'PT' // Portugal
  | 'IT' // Italy
  | 'MA' // Morocco
  | 'MR' // Mauritania
  | 'SN'; // Senegal

export type TollVehicleClass =
  | 'class_2'         // Medium commercial (2 axles, GVW > 3.5t)
  | 'class_3'         // Heavy commercial (2-3 axles, height > 3m)
  | 'class_4'         // International Articulated TIR (>= 4 axles, height >= 3m, GVW > 32t)
  | 'euro_vi_heavy';  // Euro VI Heavy Semi-trailer (40t)

export type TollReconciliationStatus =
  | 'matched'           // Toll matched with valid active trip and GPS corridor
  | 'discrepancy'       // Amount, date, or vehicle variance found
  | 'unmatched'         // No corresponding trip order linked yet
  | 'flagged_leakage';  // Potential fuel/toll leakage or off-route unauthorized swipe

export type VatRecoveryStatus =
  | 'pending'    // Awaiting tax reclamation submission
  | 'submitted'  // Transmitted to EU Tax Agency under 8th/13th VAT Directive
  | 'refunded'   // Recovered and credited to treasury
  | 'rejected'   // Disallowed by foreign tax office
  | 'exempt';    // Zero VAT (e.g. Eurovignette or public concession exemption)

/**
 * Standard Statutory VAT Rates across European Transit Corridors
 */
export const STANDARD_COUNTRY_TOLL_VAT_RATES: Record<TollCountryCode, number> = {
  ES: 0.21,  // Spain IVA 21%
  FR: 0.20,  // France TVA 20%
  DE: 0.19,  // Germany MwSt 19% (Maut has special mixed structure, standard VAT 19%)
  IT: 0.22,  // Italy IVA 22%
  PT: 0.23,  // Portugal IVA 23%
  BE: 0.21,  // Belgium TVA 21%
  NL: 0.21,  // Netherlands BTW 21%
  LU: 0.17,  // Luxembourg TVA 17%
  DK: 0.25,  // Denmark Moms 25%
  SE: 0.25,  // Sweden Moms 25%
  MA: 0.20,  // Morocco TVA 20%
  MR: 0.16,  // Mauritania TVA 16%
  SN: 0.18,  // Senegal TVA 18%
};

/**
 * Major European Freight Motorways & Typical Heavy TIR Toll Coefficients (EUR / km)
 */
export interface HighwayConcessionInfo {
  code: string;
  name: string;
  country: TollCountryCode;
  concessionaire: string;
  defaultSystem: TollSystem;
  typicalRatePerKmEur: number;
}

export const MAJOR_EUROPEAN_HIGHWAYS: Record<string, HighwayConcessionInfo> = {
  'AP-7': {
    code: 'AP-7',
    name: 'Autopista del Mediterráneo',
    country: 'ES',
    concessionaire: 'Abertis / Autopistas',
    defaultSystem: 'via_t',
    typicalRatePerKmEur: 0.18,
  },
  'A-4': {
    code: 'A-4',
    name: 'Autovía del Sur (Andalucía - Madrid)',
    country: 'ES',
    concessionaire: 'Ministerio de Transportes (Public / Free)',
    defaultSystem: 'via_t',
    typicalRatePerKmEur: 0.00,
  },
  'A-2': {
    code: 'A-2',
    name: 'Autovía del Nordeste (Madrid - Zaragoza - BCN)',
    country: 'ES',
    concessionaire: 'Ministerio de Transportes',
    defaultSystem: 'via_t',
    typicalRatePerKmEur: 0.00,
  },
  'C-32': {
    code: 'C-32',
    name: 'Túneles del Garraf / Corredor Barcelona',
    country: 'ES',
    concessionaire: 'Aucat',
    defaultSystem: 'via_t',
    typicalRatePerKmEur: 0.42,
  },
  'A9': {
    code: 'A9',
    name: 'La Catalane (Le Perthus - Montpellier - Orange)',
    country: 'FR',
    concessionaire: 'VINCI Autoroutes (ASF)',
    defaultSystem: 'telepeage',
    typicalRatePerKmEur: 0.29,
  },
  'A7': {
    code: 'A7',
    name: 'Autoroute du Soleil (Lyon - Marseille)',
    country: 'FR',
    concessionaire: 'VINCI Autoroutes (ASF)',
    defaultSystem: 'telepeage',
    typicalRatePerKmEur: 0.28,
  },
  'A10': {
    code: 'A10',
    name: "L'Aquitaine (Bordeaux - Tours - Paris)",
    country: 'FR',
    concessionaire: 'Cofiroute / VINCI',
    defaultSystem: 'telepeage',
    typicalRatePerKmEur: 0.31,
  },
  'A63': {
    code: 'A63',
    name: 'Autoroute des Landes (Biriatou - Bordeaux)',
    country: 'FR',
    concessionaire: 'Atlandes / ASF',
    defaultSystem: 'telepeage',
    typicalRatePerKmEur: 0.26,
  },
  'A1_MA': {
    code: 'A1',
    name: 'Autoroute Tanger - Rabat',
    country: 'MA',
    concessionaire: 'ADM (Autoroutes du Maroc)',
    defaultSystem: 'generic_toll',
    typicalRatePerKmEur: 0.08,
  },
  'A3_MA': {
    code: 'A3',
    name: 'Autoroute Casablanca - Agadir',
    country: 'MA',
    concessionaire: 'ADM (Autoroutes du Maroc)',
    defaultSystem: 'generic_toll',
    typicalRatePerKmEur: 0.07,
  },
};

/**
 * Raw parsed transaction line from DKV, Telepass, or AS 24 export
 */
export interface RawTollTransaction {
  rawTransactionId: string;
  cardOrObuId: string;
  truckPlate: string;
  provider: TollProvider;
  tollSystem: TollSystem;
  countryCode: TollCountryCode;
  highwayCode?: string;
  entryGate?: string;
  exitGate: string;
  entryTime?: string;
  exitTime: string;
  distanceKm?: number;
  vehicleClass?: TollVehicleClass;
  axlesCount?: number;
  gvwTonnes?: number;
  netAmountEur: number;
  vatRate: number;
  vatAmountEur: number;
  grossAmountEur: number;
}

/**
 * Trip Toll Expense Record (Database representation)
 */
export interface TripTollExpense {
  id: number;
  company_id?: number | null;
  trip_id?: number | null;
  truck_id?: number | null;
  invoice_batch_id?: number | null;
  
  toll_system: TollSystem;
  country_code: TollCountryCode;
  provider: TollProvider;
  card_or_obu_id?: string | null;
  entry_gate?: string | null;
  exit_gate: string;
  highway_code?: string | null;
  entry_time?: string | null;
  exit_time: string;
  distance_km?: number | null;
  
  vehicle_class: TollVehicleClass;
  axles_count: number;
  gvw_tonnes: number;
  
  net_amount_eur: number;
  vat_rate: number;
  vat_amount_eur: number;
  gross_amount_eur: number;
  exchange_rate_to_mad: number;
  gross_amount_mad: number;
  
  vat_recoverable: boolean;
  vat_recovery_status: VatRecoveryStatus;
  reconciliation_status: TollReconciliationStatus;
  reconciliation_notes?: string | null;
  gps_verified: boolean;
  
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  
  // Joined or resolved fields for UI display
  trip_code?: string;
  truck_plate?: string;
  driver_name?: string;
}

/**
 * Toll Card Provider Invoice Batch
 */
export interface TollCardInvoiceBatch {
  id: number;
  company_id?: number | null;
  provider: TollProvider;
  invoice_number: string;
  invoice_date: string;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  total_net_eur: number;
  total_vat_eur: number;
  total_gross_eur: number;
  currency: string;
  total_transactions_count: number;
  matched_transactions_count: number;
  total_vat_recoverable_eur: number;
  reconciliation_status: 'pending' | 'partially_reconciled' | 'reconciled' | 'discrepancies_found';
  source_file_name?: string | null;
  source_file_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Detailed Country Aggregation
 */
export interface TollCountryBreakdown {
  countryCode: TollCountryCode;
  countryName: string;
  transactionsCount: number;
  totalNetEur: number;
  totalVatEur: number;
  totalGrossEur: number;
  recoverableVatEur: number;
  averageRatePerKmEur?: number;
}

/**
 * Provider Aggregation
 */
export interface TollProviderBreakdown {
  provider: TollProvider;
  transactionsCount: number;
  totalGrossEur: number;
  matchedCount: number;
  leakageCount: number;
}

/**
 * High-Level Toll Financial & Operational Summary
 */
export interface TollReconciliationSummary {
  totalGrossEur: string;
  totalNetEur: string;
  totalVatEur: string;
  recoverableVatEur: string;
  totalGrossMad: string;
  
  totalTransactions: number;
  matchedTransactions: number;
  discrepanciesCount: number;
  leakageCount: number;
  matchRatePercentage: string; // e.g. "94.5%"
  
  countryBreakdown: TollCountryBreakdown[];
  providerBreakdown: TollProviderBreakdown[];
}

/**
 * Trip Candidate Match Parameter
 */
export interface TripMatchCandidate {
  id: number;
  trip_code?: string;
  truck_id?: number;
  truck_plate?: string;
  departure_date?: string;
  arrival_date?: string;
  route?: string;
  driver_name?: string;
  status?: string;
}

