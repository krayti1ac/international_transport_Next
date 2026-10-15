/**
 * Trans Bodanon TMS — Multi-Drop Sequencing & Consignment-Level e-POD Types
 * Standards: HMAC-SHA256 Cryptographic Verification, GPS Geolocation, Isolated Public Tracking
 */

import { z } from 'zod';

export const submitConsignmentEpodSchema = z.object({
  consignmentId: z.string().min(1, { message: 'Consignment ID is required' }),
  tripId: z.number().int().positive({ message: 'Valid trip ID is required' }),
  signerName: z.string().min(2, { message: 'Signer full name is required' }),
  signerRole: z.string().optional().default('Warehouse Receiver'),
  signatureBase64: z.string().min(10, { message: 'Digital signature is required' }),
  photoBase64: z.string().optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  triggerInstantInvoice: z.boolean().optional().default(true),
});

export type SubmitConsignmentEpodInput = z.input<typeof submitConsignmentEpodSchema>;
export type SubmitConsignmentEpodValidated = z.infer<typeof submitConsignmentEpodSchema>;

export const updateDropSequenceSchema = z.object({
  tripId: z.number().int().positive({ message: 'Valid trip ID is required' }),
  sequenceUpdates: z.array(
    z.object({
      consignmentId: z.string().min(1),
      dropSequence: z.number().int().positive(),
    })
  ).min(1, { message: 'At least one sequence update is required' }),
});

export type UpdateDropSequenceInput = z.input<typeof updateDropSequenceSchema>;

export interface PublicConsignmentTrackingData {
  consignmentReference: string;
  clientName: string;
  status: string;
  cargoDescription: string;
  palletCount: number;
  palletType: string;
  grossWeightKg: number;
  loadingCity: string;
  loadingCountry: string;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryDockName?: string | null;
  cmrNumber?: string | null;
  customsMrn?: string | null;
  isTemperatureControlled: boolean;
  targetTemperatureC?: number | null;
  epodSignedAt?: string | null;
  epodSignerName?: string | null;
  epodSignerRole?: string | null;
  epodHmacHash?: string | null;
  epodSignatureUrl?: string | null;
  epodPhotoUrl?: string | null;
  epodGpsLat?: number | null;
  epodGpsLng?: number | null;
  invoiceNumber?: string | null;
  totalAmount?: number | null;
  currency: string;
  isVerified: boolean;
}

