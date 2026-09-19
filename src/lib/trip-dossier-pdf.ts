import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { calculateTripFinancials, type TripFinancialSummary } from '@/lib/profitability';
import { generateDeliverySignatureHash } from '@/lib/signature-crypto';
import { buildCMRVerificationUrl } from '@/lib/cmr-qr';
import TripDossierPdfTemplate from '@/components/pdf/TripDossierPdfTemplate';
import type {
  TripOrder,
  Client,
  Driver,
  Truck,
  Trailer,
  DeliverySignature,
  Company,
  TruckMaintenance,
  Advance,
  FinePenalty,
  FerryExpense,
} from '@/types/database';

export interface TripDossierData {
  trip: TripOrder;
  company: Company | null;
  clientExport: Client | null;
  clientImport: Client | null;
  driver: Driver | null;
  truck: Truck | null;
  trailer: Trailer | null;
  deliveryProof: DeliverySignature | null;
  qrCodeBase64: string;
  integrityHash: string;
  financialSummary: TripFinancialSummary;
  generatedAt: string;
  locale?: 'ar' | 'fr' | 'es';
}

export async function getTripDossierData(
  tripId: number,
  locale: 'ar' | 'fr' | 'es' = 'ar'
): Promise<{
  success: boolean;
  data?: TripDossierData;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', tripId)
      .single<TripOrder>();

    if (tripErr || !trip) {
      return { success: false, error: 'الرحلة المطلوبة غير موجودة في النظام' };
    }

    const [
      compRes,
      cExpRes,
      cImpRes,
      drvRes,
      trkRes,
      trlRes,
      podRes,
      advRes,
      fuelRes,
      finesRes,
      ferryRes,
    ] = await Promise.all([
      trip.company_id
        ? supabase.from('companies').select('*').eq('id', trip.company_id).single()
        : Promise.resolve({ data: null }),
      trip.client_id
        ? supabase.from('clients').select('*').eq('id', trip.client_id).single()
        : Promise.resolve({ data: null }),
      trip.client_import_id
        ? supabase.from('clients').select('*').eq('id', trip.client_import_id).single()
        : Promise.resolve({ data: null }),
      trip.driver_id
        ? supabase.from('drivers').select('*').eq('id', trip.driver_id).single()
        : Promise.resolve({ data: null }),
      trip.truck_id
        ? supabase.from('trucks').select('*').eq('id', trip.truck_id).single()
        : Promise.resolve({ data: null }),
      trip.trailer_id
        ? supabase.from('trailers').select('*').eq('id', trip.trailer_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from('delivery_signatures')
        .select('*')
        .eq('trip_order_id', tripId)
        .maybeSingle<DeliverySignature>(),
      trip.driver_id
        ? supabase.from('advances').select('*').eq('driver_id', trip.driver_id)
        : Promise.resolve({ data: [] }),
      trip.truck_id
        ? supabase.from('truck_maintenance').select('*').eq('truck_id', trip.truck_id)
        : Promise.resolve({ data: [] }),
      supabase.from('fine_penalties').select('*').eq('trip_order_id', tripId),
      supabase.from('ferry_expenses').select('*').eq('trip_order_id', tripId),
    ]);

    const fuelRecords = ((fuelRes.data || []) as Array<{ expense_type?: string; type?: string }>).filter((r) => {
      const expType = (r.expense_type || r.type || '').toLowerCase();
      return !expType || expType === 'fuel' || expType === 'carburant' || expType === 'gasoil';
    });

    const financialSummary = calculateTripFinancials({
      trip,
      advances: (advRes.data as Advance[]) || [],
      fuelRecords: (fuelRecords as unknown as TruckMaintenance[]) || [],
      fines: (finesRes.data as FinePenalty[]) || [],
      ferries: (ferryRes.data as FerryExpense[]) || [],
      driverName: drvRes.data?.name,
      truckPlate: trkRes.data?.plate_number,
    });

    const deliveryProof = podRes.data || null;

    let integrityHash = 'NO_POD_REGISTERED';
    if (deliveryProof) {
      integrityHash = generateDeliverySignatureHash({
        tripOrderId: trip.id,
        recipientName: deliveryProof.signed_by,
        signedAt: deliveryProof.signed_at,
        latitude: deliveryProof.latitude,
        longitude: deliveryProof.longitude,
        signatureUrl: deliveryProof.signature_url,
      });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';
    const verifyUrl = buildCMRVerificationUrl(trip.id, origin);
    const verifyPayload = `e-ARCHIVE|TRIP:${trip.id}|HASH:${integrityHash.substring(0, 16)}|URL:${verifyUrl}`;
    const qrCodeBase64 = await QRCode.toDataURL(verifyPayload, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return {
      success: true,
      data: {
        trip,
        company: (compRes.data as Company) || null,
        clientExport: (cExpRes.data as Client) || null,
        clientImport: (cImpRes.data as Client) || null,
        driver: (drvRes.data as Driver) || null,
        truck: (trkRes.data as Truck) || null,
        trailer: (trlRes.data as Trailer) || null,
        deliveryProof,
        qrCodeBase64,
        integrityHash,
        financialSummary,
        generatedAt: new Date().toISOString(),
        locale,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تجميع ملف الأرشيف';
    return { success: false, error: message };
  }
}

export function buildTripDossierHtml(d: TripDossierData): string {
  const staticHtml = renderToStaticMarkup(React.createElement(TripDossierPdfTemplate, { data: d }));
  return `<!DOCTYPE html>${staticHtml}`;
}
