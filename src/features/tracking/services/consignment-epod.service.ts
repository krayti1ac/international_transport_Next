/**
 * Trans Bodanon TMS — Consignment-Level e-POD Cryptographic & Routing Service
 * Standards: Forensic HMAC-SHA256 Delivery Seals & Multi-Drop Stop Sequencing
 */

import crypto from 'crypto';
import type { TripConsignment } from '../types/groupage-ltl.types';
import type { PublicConsignmentTrackingData } from '../types/consignment-epod.types';

const EPOD_HMAC_SECRET =
  process.env.EPOD_HMAC_SECRET || 'transbodanon-consignment-epod-hmac-seal-2026';

export interface ConsignmentEpodSealParams {
  consignmentReference: string;
  cmrNumber?: string | null;
  signerName: string;
  signerRole?: string | null;
  signedAt: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  signatureLength: number;
}

/**
 * Computes an HMAC-SHA256 forensic digital seal for proof of delivery
 */
export function generateConsignmentEpodHash(params: ConsignmentEpodSealParams): string {
  const canonicalString = [
    params.consignmentReference,
    params.cmrNumber || 'NO-CMR',
    params.signerName.trim().toUpperCase(),
    (params.signerRole || 'RECEIVER').trim().toUpperCase(),
    params.signedAt,
    params.gpsLat !== undefined && params.gpsLat !== null ? params.gpsLat.toFixed(5) : '0.00000',
    params.gpsLng !== undefined && params.gpsLng !== null ? params.gpsLng.toFixed(5) : '0.00000',
    params.signatureLength,
  ].join('|');

  return crypto
    .createHmac('sha256', EPOD_HMAC_SECRET)
    .update(canonicalString)
    .digest('hex');
}

/**
 * Verifies the integrity of a signed e-POD against its forensic HMAC-SHA256 hash
 */
export function verifyConsignmentEpodHash(
  params: ConsignmentEpodSealParams,
  expectedHash: string
): boolean {
  if (!expectedHash) return false;
  const computed = generateConsignmentEpodHash(params);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Orders consignments by drop sequence for delivery route navigation
 */
export function sortConsignmentsBySequence(
  consignments: TripConsignment[]
): TripConsignment[] {
  return [...consignments].sort((a, b) => {
    const seqA = a.dropSequence !== undefined && a.dropSequence !== null ? a.dropSequence : 999;
    const seqB = b.dropSequence !== undefined && b.dropSequence !== null ? b.dropSequence : 999;
    return seqA - seqB;
  });
}

/**
 * Builds isolated public tracking URL for a specific customer/consignment
 */
export function buildPublicConsignmentTrackingUrl(
  consignmentReference: string,
  trackingToken?: string | null
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
  const tokenParam = trackingToken ? `?token=${encodeURIComponent(trackingToken)}` : '';
  return `${baseUrl}/fleet/groupage/tracking/${encodeURIComponent(consignmentReference)}${tokenParam}`;
}

/**
 * Maps a TripConsignment to sanitized public tracking data, hiding other clients' cargo
 */
export function formatPublicTrackingData(
  consignment: TripConsignment
): PublicConsignmentTrackingData {
  const isVerified = Boolean(
    consignment.epodHmacHash &&
    consignment.epodSignedAt &&
    consignment.epodSignerName
  );

  return {
    consignmentReference: consignment.consignmentReference,
    clientName: consignment.clientName,
    status: consignment.status,
    cargoDescription: consignment.cargoDescription,
    palletCount: consignment.palletCount,
    palletType: consignment.palletType,
    grossWeightKg: consignment.grossWeightKg,
    loadingCity: consignment.loadingCity,
    loadingCountry: consignment.loadingCountry,
    deliveryCity: consignment.deliveryCity,
    deliveryCountry: consignment.deliveryCountry,
    deliveryDockName: consignment.deliveryDockName || null,
    cmrNumber: consignment.cmrNumber || null,
    customsMrn: consignment.customsMrn || null,
    isTemperatureControlled: consignment.isTemperatureControlled,
    targetTemperatureC: consignment.targetTemperatureC || null,
    epodSignedAt: consignment.epodSignedAt || null,
    epodSignerName: consignment.epodSignerName || null,
    epodSignerRole: consignment.epodSignerRole || null,
    epodHmacHash: consignment.epodHmacHash || null,
    epodSignatureUrl: consignment.epodSignatureUrl || null,
    epodPhotoUrl: consignment.epodPhotoUrl || null,
    epodGpsLat: consignment.epodGpsLat || null,
    epodGpsLng: consignment.epodGpsLng || null,
    invoiceNumber: consignment.invoiceNumber || null,
    totalAmount: consignment.freightPrice || null,
    currency: consignment.currency || 'MAD',
    isVerified,
  };
}

