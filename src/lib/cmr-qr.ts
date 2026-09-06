import QRCode from 'qrcode';
import type { TripOrder, Client, Driver, Truck, Trailer } from '@/types/database';

export interface CMRQrPayloadInput {
  trip: TripOrder;
  client?: Client;
  driver?: Driver;
  truck?: Truck;
  trailer?: Trailer;
  baseUrl?: string;
}

export function buildCMRVerificationUrl(tripId: number, baseUrl?: string): string {
  const host = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${host}/track/${tripId}`;
}

export function buildCMRQrSummaryText(params: CMRQrPayloadInput): string {
  const { trip, client, driver, truck, trailer } = params;
  const cmrNum = trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`;
  const route = trip.route_export || trip.route || 'N/A';
  const truckPlate = truck?.plate_number || 'N/A';
  const trailerPlate = trailer?.plate_number || 'N/A';
  const driverName = driver?.name || 'N/A';
  const clientName = client?.name || 'N/A';
  const date = trip.departure_date || 'N/A';

  return `e-CMR:${cmrNum}|ID:${trip.id}|Date:${date}|Route:${route}|Truck:${truckPlate}|Trailer:${trailerPlate}|Driver:${driverName}|Client:${clientName}`;
}

export async function generateCMRQrCodeBase64(urlOrPayload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(urlOrPayload, {
      width: 180,
      margin: 1,
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
