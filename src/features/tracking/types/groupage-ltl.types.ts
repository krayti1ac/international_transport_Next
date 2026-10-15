/**
 * Trans Bodanon TMS — Groupage & LTL Multi-Consignment Engine Types
 * Standards: Euro-Pallet (120x80cm = 0.4 LDM), Industrial Pallet (120x100cm = 0.5 LDM)
 * European Standard Semi-Trailer Capacity: 13.60 LDM / 24,000 Kg / 90.00 m³
 * Strictly enforced with Decimal.js for financial and loading metric precision.
 */

import { z } from 'zod';

export type PalletType = 'euro' | 'industrial' | 'custom' | 'bulk';

export type ConsignmentStatus =
  | 'manifested'
  | 'loaded'
  | 'in_transit'
  | 'customs_cleared'
  | 'delivered'
  | 'signed_epod';

export const LTL_TRAILER_STANDARDS = {
  MAX_TRAILER_LDM: 13.6, // Standard 13.6m Mega / Semi-remorque
  MAX_PAYLOAD_KG: 24000, // Standard max payload legal weight
  MAX_VOLUME_M3: 90.0, // Standard refrigerated/dry trailer volume
  EURO_PALLET_LDM: 0.4, // 120cm x 80cm
  INDUSTRIAL_PALLET_LDM: 0.5, // 120cm x 100cm
  VOLUMETRIC_RATIO_KG_PER_M3: 333, // 1 m³ = 333 kg
  LDM_EQUIVALENT_KG: 1850, // 1 LDM = 1850 kg
} as const;

export interface TripConsignment {
  id: string;
  companyId?: number | null;
  tripId: number;
  consignmentReference: string;
  clientId?: number | string | null;
  clientName: string;
  senderName?: string | null;
  senderAddress?: string | null;
  receiverName?: string | null;
  receiverAddress?: string | null;
  loadingCity: string;
  loadingCountry: string;
  deliveryCity: string;
  deliveryCountry: string;
  cargoDescription: string;
  isTemperatureControlled: boolean;
  targetTemperatureC?: number | null;
  palletCount: number;
  palletType: PalletType;
  isStackable: boolean;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  ldmMeters: number;
  volumeM3: number;
  grossWeightKg: number;
  chargeableWeightKg: number;
  freightPrice: number;
  currency: string;
  cmrNumber?: string | null;
  customsMrn?: string | null;
  status: ConsignmentStatus;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoicedAt?: string | null;
  allocatedCost?: number;
  netMargin?: number;
  profitMarginPct?: number;
  costAllocationMode?: string;
  dropSequence?: number;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  deliveryDockName?: string | null;
  epodSignerName?: string | null;
  epodSignerRole?: string | null;
  epodSignatureUrl?: string | null;
  epodPhotoUrl?: string | null;
  epodGpsLat?: number | null;
  epodGpsLng?: number | null;
  epodSignedAt?: string | null;
  epodHmacHash?: string | null;
  trackingToken?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrailerCapacityUtilization {
  totalLdm: number;
  maxLdm: number;
  ldmUtilizationPct: number;
  totalGrossWeightKg: number;
  maxWeightKg: number;
  weightUtilizationPct: number;
  totalVolumeM3: number;
  maxVolumeM3: number;
  volumeUtilizationPct: number;
  totalPallets: number;
  totalFreightRevenue: number;
  currency: string;
  isOverloaded: boolean;
  isOverLdm: boolean;
  consignmentsCount: number;
}

export const createLtlConsignmentSchema = z.object({
  tripId: z.number().int().positive(),
  clientName: z.string().min(1),
  clientId: z.union([z.number(), z.string()]).optional().nullable(),
  senderName: z.string().optional().nullable(),
  senderAddress: z.string().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverAddress: z.string().optional().nullable(),
  loadingCity: z.string().min(1).default('Tanger'),
  loadingCountry: z.string().default('MA'),
  deliveryCity: z.string().min(1).default('Madrid'),
  deliveryCountry: z.string().default('ES'),
  cargoDescription: z.string().min(1),
  isTemperatureControlled: z.boolean().default(false),
  targetTemperatureC: z.number().optional().nullable(),
  palletCount: z.number().int().min(1).default(1),
  palletType: z.enum(['euro', 'industrial', 'custom', 'bulk']).default('euro'),
  isStackable: z.boolean().default(false),
  lengthCm: z.number().min(0).optional().nullable(),
  widthCm: z.number().min(0).optional().nullable(),
  heightCm: z.number().min(0).optional().nullable(),
  grossWeightKg: z.number().min(0).default(500),
  freightPrice: z.number().min(0).default(3500),
  currency: z.string().default('MAD'),
  customsMrn: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateLtlConsignmentInput = z.input<typeof createLtlConsignmentSchema>;
export type CreateLtlConsignmentValidated = z.infer<typeof createLtlConsignmentSchema>;

export const updateConsignmentStatusSchema = z.object({
  consignmentId: z.string().min(1),
  status: z.enum([
    'manifested',
    'loaded',
    'in_transit',
    'customs_cleared',
    'delivered',
    'signed_epod',
  ]),
  notes: z.string().optional(),
});

export type UpdateConsignmentStatusInput = z.infer<typeof updateConsignmentStatusSchema>;

