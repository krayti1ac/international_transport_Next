/**
 * Dynamic Freight Pricing & Instant Quotation Engine — Type Definitions
 * Trans Bodanon TMS
 */

import type { CargoType, PricingCorridorType } from '../types';

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT_TO_CLIENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED';

export type PricingCurrency = 'MAD' | 'EUR' | 'MRU' | 'XOF';

export type PricingTierKey = 'floor' | 'spot' | 'expressPremium';

export interface QuotationCostBreakdown {
  baseCpkRateMad: string; // e.g. "9.85" MAD/km
  distanceKm: number;
  cpkDistanceCostMad: string; // distance * baseCpkRate
  fuelTotalCostMad: string;
  ferryAndTransitCostMad: string;
  tollsCostMad: string;
  driverAllowancesCostMad: string;
  reeferCostMad: string;
  overheadBufferMad: string;
  totalDirectCostMad: string;
  totalDirectCostSelectedCurrency: string;
  marginAmountSelectedCurrency: string;
  netFreightPriceSelectedCurrency: string;
}

export interface QuotationTierDetail {
  tierKey: PricingTierKey;
  nameAr: string;
  nameFr: string;
  nameEs: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEs: string;
  marginPercent: number;
  netPrice: string;
  totalPriceWithVat: string;
  isRecommended?: boolean;
}

export interface FreightQuotation {
  id: string;
  quotationNumber: string; // e.g. "QT-2026-TNG-0089"
  status: QuotationStatus;
  clientId?: string | number;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  originCity: string;
  destinationCity: string;
  corridorType: PricingCorridorType;
  totalDistanceKm: number;
  cargoType: CargoType;
  weightTons: number;
  targetMarginPercent: number;
  currency: PricingCurrency;
  exchangeRateToMad: string; // Rate used for conversion
  costBreakdown: QuotationCostBreakdown;
  selectedTier: PricingTierKey;
  tiers: Record<PricingTierKey, QuotationTierDetail>;
  finalPrice: string; // Formatted price in selected currency
  vatRatePercent: number; // 0% for international transit
  vatAmount: string; // "0.00"
  vatExemptionLegalNoticeAr: string;
  vatExemptionLegalNoticeFr: string;
  vatExemptionLegalNoticeEs: string;
  totalPriceWithVat: string;
  validUntil: string;
  convertedToTripId?: number;
  convertedAt?: string;
  convertedBy?: string;
  cmrNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationInput {
  clientId?: string | number;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  originCity: string;
  destinationCity: string;
  corridorType?: PricingCorridorType;
  cargoType: CargoType;
  weightTons?: number;
  roadDistanceKm?: number;
  targetMarginPercent?: number;
  currency?: PricingCurrency;
  selectedTier?: PricingTierKey;
  reeferSetpointTemp?: number;
  validityDays?: number;
}

export interface QuotationConversionResult {
  success: boolean;
  tripId: number;
  cmrNumber: string;
  quotationId: string;
  alreadyConverted: boolean;
  message: string;
}

