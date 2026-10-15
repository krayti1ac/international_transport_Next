/**
 * Trans Bodanon TMS — AI Transport Order & Packing List Parser Types
 * Multi-Language AI Document Extraction (Arabic, French, Spanish, English)
 * Strict Decimal.js calculations for volumetric weight and Loading Meters (LDM).
 */

import { z } from 'zod';
import type { PalletType } from './groupage-ltl.types';

export type ShippingDocumentType =
  | 'packing_list'
  | 'proforma_invoice'
  | 'transport_order'
  | 'customs_dum'
  | 'commercial_invoice'
  | 'unknown';

export interface ExtractedConsignmentItem {
  id: string; // temporary client-side ID
  clientName: string;
  clientId?: number | string | null;
  senderName: string;
  senderAddress?: string | null;
  receiverName: string;
  receiverAddress?: string | null;
  loadingCity: string;
  loadingCountry: string;
  deliveryCity: string;
  deliveryCountry: string;
  cargoDescription: string;
  hsCode?: string | null;
  isTemperatureControlled: boolean;
  targetTemperatureC?: number | null;
  palletCount: number;
  palletType: PalletType;
  isStackable: boolean;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  grossWeightKg: number;
  freightPrice: number;
  currency: string;
  customsMrn?: string | null;
  notes?: string | null;
  confidence: number;
  calculatedMetrics: {
    ldmMeters: number;
    volumeM3: number;
    chargeableWeightKg: number;
  };
}

export interface PackingListParseResult {
  success: boolean;
  documentType: ShippingDocumentType;
  confidenceScore: number;
  totalPalletsExtracted: number;
  totalWeightKgExtracted: number;
  totalLdmExtracted: number;
  items: ExtractedConsignmentItem[];
  aiModelUsed: string;
  rawSummary: string;
  warnings: string[];
  error?: string;
}

export interface PackingListParsingLog {
  id: string;
  companyId?: number | null;
  tripId?: number | null;
  fileName: string;
  fileSizeBytes?: number | null;
  fileMimeType?: string | null;
  documentType: ShippingDocumentType;
  extractedConsignmentsCount: number;
  confidenceScore: number;
  aiModelUsed?: string | null;
  extractedData: ExtractedConsignmentItem[];
  status: 'pending' | 'parsed' | 'converted' | 'failed';
  errorMessage?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const parseShippingDocumentInputSchema = z.object({
  base64Data: z.string().min(1, 'Document data is required'),
  mimeType: z.enum([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
  ]),
  fileName: z.string().min(1, 'File name is required'),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  tripId: z.number().int().positive().optional().nullable(),
  targetCurrency: z.string().default('MAD'),
});

export type ParseShippingDocumentInput = z.input<typeof parseShippingDocumentInputSchema>;
export type ParseShippingDocumentValidated = z.infer<typeof parseShippingDocumentInputSchema>;

export const batchCreateConsignmentsFromAiSchema = z.object({
  tripId: z.number().int().positive('Trip ID is required'),
  items: z.array(
    z.object({
      clientName: z.string().min(1, 'Client name is required'),
      clientId: z.union([z.number(), z.string()]).optional().nullable(),
      senderName: z.string().optional().nullable(),
      senderAddress: z.string().optional().nullable(),
      receiverName: z.string().optional().nullable(),
      receiverAddress: z.string().optional().nullable(),
      loadingCity: z.string().min(1).default('Tanger'),
      loadingCountry: z.string().default('MA'),
      deliveryCity: z.string().min(1).default('Madrid'),
      deliveryCountry: z.string().default('ES'),
      cargoDescription: z.string().min(1, 'Cargo description is required'),
      hsCode: z.string().optional().nullable(),
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
      sourceDocumentName: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ).min(1, 'At least one consignment item must be selected'),
  sourceDocumentName: z.string().optional().nullable(),
  parsingLogId: z.string().optional().nullable(),
});

export type BatchCreateConsignmentsFromAiInput = z.input<typeof batchCreateConsignmentsFromAiSchema>;
export type BatchCreateConsignmentsFromAiValidated = z.infer<typeof batchCreateConsignmentsFromAiSchema>;
