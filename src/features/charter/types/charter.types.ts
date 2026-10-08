/**
 * Trans Bodanon TMS — Charter & Subcontractor Fleet Exchange Data Contracts
 * Defines types for Subcontractors, Charter Orders, Compliance Checks, Brokerage Margins, and e-POD Tokens.
 */

export type SubcontractorComplianceStatus = 'compliant' | 'warning' | 'expired' | 'pending';

export type CharterOrderStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'SETTLED'
  | 'CANCELLED';

export type SubcontractorTruckType = 'refrigerated' | 'tautliner' | 'box' | 'flatbed' | 'container_carrier';

export interface SubcontractorCarrier {
  id: string | number;
  companyName: string;
  ice: string; // 15 digits
  identifiantFiscal?: string;
  registreCommerce?: string;
  cnss?: string;
  phone: string;
  email?: string;
  contactPerson?: string;
  address: string;
  city: string;
  country: 'MA' | 'ES' | 'FR' | 'SN' | 'MR';
  rating: number; // 1 to 5
  cmrInsurancePolicyNumber: string;
  cmrInsuranceExpiryDate: string; // YYYY-MM-DD
  internationalTransportLicenseNumber: string;
  internationalTransportLicenseExpiryDate: string; // YYYY-MM-DD
  bankRib?: string;
  paymentTermsDays: 15 | 30 | 45 | 60;
  isBlacklisted: boolean;
  complianceStatus: SubcontractorComplianceStatus;
  activeTrucksCount: number;
  createdAt: string;
}

export interface SubcontractorTruck {
  id: string | number;
  carrierId: string | number;
  carrierName: string;
  plateNumber: string; // e.g., '12345-A-26'
  truckType: SubcontractorTruckType;
  maxPayloadTons: number;
  hasReeferUnit: boolean;
  carteGriseExpiryDate: string; // YYYY-MM-DD
  technicalInspectionExpiryDate: string; // YYYY-MM-DD
  atpCertificateExpiryDate?: string; // YYYY-MM-DD (Frigo ATP)
  isAvailable: boolean;
  complianceStatus: SubcontractorComplianceStatus;
}

export interface SubcontractorDriver {
  id: string | number;
  carrierId: string | number;
  name: string;
  phone: string;
  cinNationalId: string;
  licenseNumber: string;
  licenseExpiryDate: string; // YYYY-MM-DD
  passportNumber?: string;
  passportExpiryDate?: string; // YYYY-MM-DD
  schengenVisaExpiryDate?: string; // YYYY-MM-DD
  complianceStatus: SubcontractorComplianceStatus;
}

export interface BrokerageMarginBreakdown {
  shipperAgreedRate: string;         // What client pays Trans Bodanon (MAD/EUR)
  subcontractorBuyRate: string;      // What Trans Bodanon pays Subcontractor (MAD/EUR)
  extraReinvoicedExpenses: string;   // Port/Ferry/Tolls (MAD/EUR)
  grossBrokerageMargin: string;      // shipperAgreedRate - subcontractorBuyRate
  brokerageMarginPercent: string;    // (grossMargin / shipperAgreedRate) * 100
  currency: string;                  // MAD, EUR, USD
  isProfitable: boolean;
  negativeMarginAlert: boolean;
  marginSafetyLevel: 'optimum' | 'moderate' | 'hazard_negative';
}

export interface DocumentComplianceReport {
  isFullyCompliant: boolean;
  status: SubcontractorComplianceStatus;
  expiredDocuments: string[];
  expiringSoonDocuments: string[]; // Within 15 days
  blockingIssues: string[];
  carrierChecked: string;
}

export interface CharterOrder {
  id: string;
  orderNumber: string; // e.g. CHT-2026-0104
  tripOrderId?: number;
  originCity: string;
  destinationCity: string;
  corridor: 'european_maritime' | 'african_overland' | 'domestic';
  loadingDate: string;
  deliveryDate: string;
  cargoDescription: string;
  cargoWeightKg: number;
  carrier: SubcontractorCarrier;
  truck: SubcontractorTruck;
  driver: SubcontractorDriver;
  margin: BrokerageMarginBreakdown;
  status: CharterOrderStatus;
  cmrNumber: string;
  
  // External e-POD Magic Link Fields
  epodMagicToken?: string;
  epodMagicLink?: string;
  epodExpiresAt?: string;
  epodSubmittedAt?: string;
  epodReceiverName?: string;
  epodReceiverSignatureUrl?: string;
  epodDeliveryLatitude?: number;
  epodDeliveryLongitude?: number;
  epodNotes?: string;
  epodHmacSeal?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateCharterOrderInput {
  originCity: string;
  destinationCity: string;
  corridor: 'european_maritime' | 'african_overland' | 'domestic';
  loadingDate: string;
  deliveryDate: string;
  cargoDescription: string;
  cargoWeightKg: number;
  shipperAgreedRate: string;
  subcontractorBuyRate: string;
  extraReinvoicedExpenses?: string;
  currency: string;
  carrierId: string | number;
  truckId: string | number;
  driverId: string | number;
  cmrNumber?: string;
  tripOrderId?: number;
}

export interface ExternalEpodSubmissionInput {
  token: string;
  orderNumber: string;
  receiverName: string;
  signatureBase64: string;
  photoUrls?: string[];
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface ExternalEpodResult {
  success: boolean;
  orderNumber?: string;
  hmacSeal?: string;
  submittedAt?: string;
  error?: string;
}

