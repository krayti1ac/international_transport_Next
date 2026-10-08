export type FuelCardProvider =
  | 'afriquia'
  | 'totalenergies'
  | 'shell'
  | 'ola_energy'
  | 'winxo'
  | 'petrom'
  | 'generic';

export type ReconciliationStatus =
  | 'matched'
  | 'variance'
  | 'ghost_refuel'
  | 'duplicate_swipe'
  | 'overfill_fraud'
  | 'unmatched_card'
  | 'unmatched_receipt';

export interface FuelCardTransactionRaw {
  transactionId: string;
  cardNumber: string;
  cardHolder?: string;
  truckPlate: string;
  timestamp: string; // ISO date-time or YYYY-MM-DD HH:mm
  stationName: string;
  stationCity?: string;
  fuelType: string; // e.g. Diesel 10 ppm, Gasoil, AdBlue
  liters: number;
  unitPrice: number;
  totalAmount: number;
  vatAmount?: number;
  currency: string; // MAD, EUR, XOF
  odometerKm?: number;
}

export interface FieldFuelReceiptMatch {
  receiptId: number;
  truckId: number;
  truckPlate: string;
  driverName?: string;
  tripId?: number;
  receiptDate: string;
  receiptLiters: number;
  receiptAmount: number;
  stationName?: string;
  currency?: string;
}

export type FuelAnomalyCategory =
  | 'location_mismatch'
  | 'overfill_exceeded'
  | 'volume_variance'
  | 'price_variance'
  | 'date_skew'
  | 'duplicate_swipe'
  | 'missing_field_receipt';

export interface ReconciliationAnomaly {
  category: FuelAnomalyCategory;
  severity: 'warning' | 'critical';
  titleAr: string;
  titleFr: string;
  titleEs: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEs: string;
  varianceLiters?: number;
  varianceAmount?: number;
  distanceKm?: number;
}

export interface ReconciledFuelEntry {
  id: string;
  provider: FuelCardProvider;
  cardTransaction: FuelCardTransactionRaw;
  matchedReceipt?: FieldFuelReceiptMatch;
  status: ReconciliationStatus;
  confidenceScore: number; // 0 - 100
  volumeVarianceLiters: number; // card.liters - receipt.liters
  financialVarianceMad: number; // card.amount - receipt.amount (in MAD)
  stationDistanceToGpsKm?: number;
  gpsVerificationStatus: 'verified' | 'suspicious' | 'no_gps_data';
  anomalies: ReconciliationAnomaly[];
  reconciledAt: string;
}

export interface ProviderReconciliationStats {
  provider: FuelCardProvider;
  totalCount: number;
  matchedCount: number;
  fraudCount: number;
  totalAmountMad: number;
}

export interface FuelReconciliationSummary {
  totalCardTransactions: number;
  totalMatched: number;
  totalVariance: number;
  totalFraudSuspected: number;
  totalCardAmountMad: number;
  totalReceiptAmountMad: number;
  netDiscrepancyMad: number;
  reconciliationRate: number; // % 0 - 100
  providerBreakdown: ProviderReconciliationStats[];
  generatedAt: string;
}

export interface ReconcileStatementInput {
  provider?: FuelCardProvider;
  rawCsvContent?: string;
  transactions?: FuelCardTransactionRaw[];
  companyId?: string;
}

