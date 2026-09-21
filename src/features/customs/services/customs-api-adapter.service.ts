import Decimal from 'decimal.js';
import crypto from 'crypto';
import type { PortNetPayloadData } from './portnet-xml';
import type {
  CustomsApiMode,
  PortNetApiConfig,
  TirEpdConfig,
  TirEpdPayloadData,
  CustomsApiResponse,
  TirEpdCustomsOffice,
} from '../types/customs-adapter.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Default Customs Offices
export const STANDARD_CUSTOMS_OFFICES: Record<string, TirEpdCustomsOffice> = {
  tanger_med: { code: 'MA003100', name: 'Tanger Med Port', country: 'MA' },
  guerguerat: { code: 'MA004900', name: 'Guerguerat Border Post', country: 'MA' },
  algeciras: { code: 'ES001100', name: 'Algeciras Puerto', country: 'ES' },
  rosso: { code: 'MR002100', name: 'Rosso Ferry Terminal', country: 'MR' },
  dakar: { code: 'SN001000', name: 'Dakar Port Commercial', country: 'SN' },
};

/**
 * Resolves current Customs API mode: 'sandbox' (default) or 'production'
 */
export function getCustomsApiMode(): CustomsApiMode {
  return (process.env.CUSTOMS_API_MODE as CustomsApiMode) || 'sandbox';
}

/**
 * Builds structured TIR-EPD payload from Trip Order record.
 */
export function buildTirEpdPayloadFromTrip(trip: any): TirEpdPayloadData {
  const tripId = trip.id || 1;
  const isEuro = trip.corridor_type === 'european_maritime';

  const departureOffice = isEuro
    ? STANDARD_CUSTOMS_OFFICES.tanger_med
    : STANDARD_CUSTOMS_OFFICES.guerguerat;

  const destinationOffice = isEuro
    ? STANDARD_CUSTOMS_OFFICES.algeciras
    : STANDARD_CUSTOMS_OFFICES.dakar;

  const grossWeightDec = new Decimal(
    trip.weight_export || trip.weight_import || 22000
  );

  const carnetTirNumber =
    trip.cmr_number || `TIR-MA-2026-${String(tripId).padStart(5, '0')}`;
  const voucherNumber = `VC-${tripId}-01`;
  const sealNumber = `SEAL-MA-${String(tripId).padStart(6, '0')}`;

  return {
    carnetTirNumber,
    voucherNumber,
    tirHolderCode: process.env.TIR_HOLDER_CODE || 'MA/042/2026',
    operationType: 'EXIT',
    departureOffice,
    destinationOffice,
    carrier: {
      name: 'TRANS BODANON SARL',
      ice: '001928374650001',
      address: 'Zone Franche Logistique, Tanger Med, Maroc',
    },
    transportMeans: {
      truckPlate: trip.truck?.plate_number || '10101-A-40',
      truckNationality: 'MA',
      trailerPlate: trip.trailer?.plate_number || 'REM-1001-MA',
      trailerNationality: 'MA',
      driverName: trip.driver?.name || 'Abdelkarim El Khamlichi',
      driverPassport: trip.driver?.passport_number || 'PA901245',
      driverNationality: 'MA',
    },
    cargo: {
      description: trip.goods_description_export || 'Poissons Congelés Frigo TIR',
      grossWeightKg: Math.round(grossWeightDec.toNumber()),
      sealNumber,
      packagesCount: 1200,
      containerNumber: trip.trailer?.plate_number,
    },
    metadata: {
      tripId,
      referenceNumber: `TIR-EPD-${tripId}-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Direct API Adapter for PortNet / Tanger Med Pre-Gate Pass.
 */
export async function submitToPortNetApi(
  payload: PortNetPayloadData,
  customConfig?: Partial<PortNetApiConfig>
): Promise<CustomsApiResponse> {
  const mode = customConfig?.mode || getCustomsApiMode();
  const timestamp = new Date().toISOString();
  const refNum = payload.referenceNumber;

  if (mode === 'sandbox') {
    // Simulated realistic response from PortNet Sandbox Gateway
    const mockMrn = `26MA${Date.now().toString().slice(-10)}G`;
    const mockBarcode = `https://portnet.ma/barcode/gatepass?ref=${refNum}&mrn=${mockMrn}`;

    return {
      success: true,
      gateway: 'portnet',
      mode: 'sandbox',
      referenceNumber: refNum,
      customsRegistrationNumber: mockMrn,
      barcode: mockBarcode,
      status: 'accepted',
      messageAr: 'تم قبول الإشعار المسبق بنجاح في بيئة PortNet (وضع التجربة الآمن)',
      messageFr: 'Préavis accepté avec succès sur PortNet (Mode Sandbox)',
      timestamp,
      rawResponse: {
        code: '200_OK',
        status: 'ACCEPTED',
        mrn: mockMrn,
        gatePassStatus: 'READY_FOR_ENTRY',
        terminal: 'Tanger Med Port Pass',
      },
    };
  }

  // Production Mode: Performs live HTTPS request with API Key and mTLS
  try {
    const apiUrl = customConfig?.apiUrl || process.env.PORTNET_API_URL || 'https://api.portnet.ma/v2/pre-gate-pass';
    const apiKey = customConfig?.apiKey || process.env.PORTNET_API_KEY || '';
    const clientId = customConfig?.clientId || process.env.PORTNET_CLIENT_ID || '';

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PortNet-ClientId': clientId,
        'X-PortNet-ApiKey': apiKey,
        'X-PortNet-Signature': crypto
          .createHmac('sha256', apiKey)
          .update(JSON.stringify(payload))
          .digest('hex'),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `PortNet API error HTTP ${res.status}`);
    }

    return {
      success: true,
      gateway: 'portnet',
      mode: 'production',
      referenceNumber: refNum,
      customsRegistrationNumber: data.mrn,
      barcode: data.barcodeUrl,
      status: 'accepted',
      messageAr: 'تم تسجيل الشحنة واعتماد الإشعار المسبق رسمياً عبر PortNet',
      messageFr: 'Déclaration enregistrée et validée officiellement sur PortNet',
      timestamp,
      rawResponse: data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل التخاطب مع بوابة PortNet';
    return {
      success: false,
      gateway: 'portnet',
      mode: 'production',
      referenceNumber: refNum,
      status: 'rejected',
      messageAr: `رفض الطلب: ${errorMsg}`,
      messageFr: `Échec PortNet : ${errorMsg}`,
      timestamp,
      error: errorMsg,
    };
  }
}

/**
 * Direct API Adapter for IRU TIR-EPD International Customs Gateway.
 */
export async function submitToTirEpdApi(
  payload: TirEpdPayloadData,
  customConfig?: Partial<TirEpdConfig>
): Promise<CustomsApiResponse> {
  const mode = customConfig?.mode || getCustomsApiMode();
  const timestamp = new Date().toISOString();
  const refNum = payload.metadata.referenceNumber;

  if (mode === 'sandbox') {
    // Simulated realistic response from IRU TIR-EPD Sandbox Gateway
    const mockEpdTransactionId = `EPD-MA-2026-${payload.metadata.tripId.toString().padStart(6, '0')}`;
    const mockTirBarcode = `https://tirepd.iru.org/qr?ref=${mockEpdTransactionId}`;

    return {
      success: true,
      gateway: 'tir_epd',
      mode: 'sandbox',
      referenceNumber: refNum,
      customsRegistrationNumber: mockEpdTransactionId,
      barcode: mockTirBarcode,
      status: 'accepted',
      messageAr: 'تم إرسال التصريح الإلكتروني المسبق بنجاح إلى شبكة TIR-EPD الدولية (Sandbox)',
      messageFr: 'Déclaration EPD transmise avec succès au réseau TIR-EPD IRU (Sandbox)',
      timestamp,
      rawResponse: {
        code: 'IRU_200_ACCEPTED',
        epdId: mockEpdTransactionId,
        departureValidation: 'PASSED',
        destinationValidation: 'PASSED',
        sealVerified: true,
      },
    };
  }

  // Production Mode: Performs live REST request to IRU TIR-EPD
  try {
    const apiUrl = customConfig?.apiUrl || process.env.TIR_EPD_API_URL || 'https://api.tirepd.iru.org/v1/declarations';
    const clientId = customConfig?.clientId || process.env.TIR_EPD_CLIENT_ID || '';
    const clientSecret = customConfig?.clientSecret || process.env.TIR_EPD_CLIENT_SECRET || '';

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `TIR-EPD API error HTTP ${res.status}`);
    }

    return {
      success: true,
      gateway: 'tir_epd',
      mode: 'production',
      referenceNumber: refNum,
      customsRegistrationNumber: data.epdReference,
      barcode: data.barcodeUrl,
      status: 'accepted',
      messageAr: 'تم تسجيل التصريح الإلكتروني المسبق دولياً لدى الاتحاد الدولي IRU',
      messageFr: 'Déclaration EPD validée officiellement auprès de l’IRU',
      timestamp,
      rawResponse: data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل التخاطب مع بوابة TIR-EPD';
    return {
      success: false,
      gateway: 'tir_epd',
      mode: 'production',
      referenceNumber: refNum,
      status: 'rejected',
      messageAr: `رفض التصريح الدولي: ${errorMsg}`,
      messageFr: `Échec TIR-EPD : ${errorMsg}`,
      timestamp,
      error: errorMsg,
    };
  }
}

