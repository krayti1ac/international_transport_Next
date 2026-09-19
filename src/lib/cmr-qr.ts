import QRCode from 'qrcode';
import type { TripOrder, Client, Driver, Truck, Trailer } from '@/types/database';

export interface CMRQrPayloadInput {
  trip: TripOrder;
  client?: Client;
  clientImport?: Client;
  driver?: Driver;
  truck?: Truck;
  trailer?: Trailer;
  baseUrl?: string;
}

export function buildCMRVerificationUrl(tripId: number, baseUrl?: string): string {
  const host = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const cleanHost = host ? host.replace(/\/+$/, '') : '';
  return `${cleanHost}/track/${tripId}`;
}

export function buildCMRQrSummaryText(params: CMRQrPayloadInput): string {
  const { trip, client, driver, truck, trailer, baseUrl } = params;
  const cmrExport = trip.cmr_export_number || trip.cmr_number || `CMR-EXP-${trip.id}`;
  const cmrImport = trip.cmr_import_number || 'N/A';
  const internalId = trip.id;
  const truckPlate = truck?.plate_number || 'N/A';
  const trailerPlate = trailer?.plate_number || 'N/A';
  const driverName = driver?.name || 'N/A';
  const driverLicense = driver?.license || (driver as { license_number?: string } | undefined)?.license_number || 'N/A';
  const clientName = client?.name || 'N/A';
  const destination = trip.route_export || trip.route || 'N/A';
  const departureDate = trip.departure_date || 'N/A';
  const trackingUrl = buildCMRVerificationUrl(trip.id, baseUrl);

  return `e-CMR|ID:${internalId}|CMR_EXP:${cmrExport}|CMR_IMP:${cmrImport}|TRUCK:${truckPlate}|TRAILER:${trailerPlate}|DRIVER:${driverName}|LICENSE:${driverLicense}|CLIENT:${clientName}|DEST:${destination}|DATE:${departureDate}|VERIFY:${trackingUrl}`;
}

export async function generateCMRQrCodeBase64(
  urlOrPayload: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  try {
    return await QRCode.toDataURL(urlOrPayload, {
      width: options?.width || 240,
      margin: options?.margin ?? 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate e-CMR QR Code:', err);
    return '';
  }
}
