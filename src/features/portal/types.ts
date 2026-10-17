import type { Client, TripOrder, Invoice, DeliverySignature, Truck, Driver, BookingRequest } from '@/types/database';

export interface PortalTripItem extends TripOrder {
  truck?: Truck | null;
  driver?: Driver | null;
  deliveryProof?: DeliverySignature | null;
  cargo_type?: string | null;
  cargo_description?: string | null;
  current_temperature?: number | null;
  target_temperature?: number | null;
  destination?: string | null;
}

export interface PortalFinancialStats {
  totalInvoiced: string;
  totalPaid: string;
  totalRemaining: string;
  currency: string;
  activeShipmentsCount: number;
  deliveredShipmentsCount: number;
  totalShipmentsCount: number;
}

export interface ClientPortalData {
  client: Client;
  trips: PortalTripItem[];
  invoices: Invoice[];
  bookings: BookingRequest[];
  stats: PortalFinancialStats;
}

export interface PortalLookupResult {
  success: boolean;
  data?: ClientPortalData;
  error?: string;
}

export interface CreateBookingInput {
  clientId?: number;
  routeFrom: string;
  routeTo: string;
  corridorType?: 'european_maritime' | 'african_overland';
  cargoType: 'fresh_produce' | 'frozen_fish' | 'general_cargo' | 'pharmaceuticals';
  trailerType: 'frigo' | 'bache' | 'box' | 'container';
  targetTemperature?: number | null;
  weightTons?: number | null;
  pickupDate: string;
  deliveryDeadline?: string | null;
  pickupAddress?: string | null;
  pickupGpsUrl?: string | null;
  deliveryAddress?: string | null;
  deliveryGpsUrl?: string | null;
  specialInstructions?: string | null;
  locale?: 'ar' | 'fr' | 'es';
  adminOverrideApproved?: boolean;
}

export interface CreateBookingResult {
  success: boolean;
  booking?: BookingRequest;
  error?: string;
  bookingFrozen?: boolean;
  blockingDocuments?: string[];
  overdueConsolidatedMad?: string;
  clientPviScore?: string;
}

export interface PortalInstantQuoteInput {
  clientId: number;
  clientName?: string;
  routeFrom: string;
  routeTo: string;
  roadDistanceKm: number;
  ferryDistanceKm?: number;
  cargoType: 'fresh_produce' | 'frozen_fish' | 'general_cargo' | 'pharmaceuticals';
  trailerType: 'frigo' | 'bache' | 'box' | 'container';
  weightTons: number;
  currency?: 'EUR' | 'MAD';
  exchangeRateEurToMad?: string;
  creditLimitMad?: string;
}

export interface PortalInstantQuoteEvaluation {
  quoteReference: string;
  routeFrom: string;
  routeTo: string;
  corridorType: 'european_maritime' | 'african_overland';
  currency: 'EUR' | 'MAD';
  baseRoadFreight: string;
  ferryCrossingSurcharge: string;
  reeferColdChainSurcharge: string;
  customsClearanceFee: string;
  totalHtAmount: string;
  vatRatePct: string;
  taxExemptionClause: string;
  totalTtcAmount: string;
  totalConsolidatedMad: string;
  clientPviScore: string;
  currentOpenExposureMad: string;
  creditLimitMad: string;
  projectedExposureMad: string;
  remainingCreditHeadroomMad: string;
  isCreditApproved: boolean;
  isFrozenByDunningStage4: boolean;
  blockingReason?: string;
}

export interface ClientTripCompleteDossier {
  dossierReference: string;
  generatedAt: string;
  tripId: number;
  clientId: number;
  clientName: string;
  route: string;
  zeroInternalCostLeakageVerified: boolean;
  invoiceSummary: {
    invoiceNumber: string;
    issueDate: string;
    totalTtc: string;
    paidAmount: string;
    remainingAmount: string;
    currency: string;
    taxExemptionAttestation: string;
    qrVerificationHash: string;
  };
  eCmrDocument: {
    cmrNumber: string;
    originCity: string;
    destinationCity: string;
    exporterName: string;
    truckPlate: string;
    driverName: string;
    grossWeightTons: string;
    conventionClause: string;
  };
  ePodCertificate: {
    status: 'signed_verified' | 'pending_delivery';
    receiverName: string;
    deliveredAt: string;
    deliveryGpsCoordinates: string;
    hmacSha256ForensicSignature: string;
  };
  carbonAuditCertificate: {
    standard: 'GLEC Framework v3.0 / ISO 14083 / EU CBAM';
    distanceKm: string;
    cargoWeightTons: string;
    tonKilometers: string;
    wtwEmissionsKgCo2e: string;
    intensityGCo2ePerTkm: string;
    reeferShareKgCo2e: string;
  };
}




