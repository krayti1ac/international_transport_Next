/**
 * Trans Bodanon TMS — Refrigeration OEM Cloud Webhook Ingestion Route
 * Endpoint: POST /api/webhooks/reefer-oem
 * Ingests live telemetry packets from Carrier Transicold eSolutions & Thermo King TracKing
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestReeferOemPacketAction } from '@/features/tracking/services/reefer-cloud.actions';
import type { ReeferOemBrand } from '@/features/tracking/types/reefer-cloud-gateway.types';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const secretHeader = request.headers.get('x-oem-secret');
    const expectedSecret = process.env.REEFER_OEM_WEBHOOK_SECRET;

    // Optional secret key validation if configured
    if (expectedSecret) {
      const isBearerValid = authHeader === `Bearer ${expectedSecret}`;
      const isHeaderValid = secretHeader === expectedSecret;
      if (!isBearerValid && !isHeaderValid) {
        return NextResponse.json({ error: 'Unauthorized: Invalid OEM telematics secret' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const brandParam = searchParams.get('brand') as ReeferOemBrand | null;
    const tripIdParam = searchParams.get('tripId');
    const tripId = tripIdParam ? parseInt(tripIdParam, 10) : undefined;

    const body = await request.json();

    if (Array.isArray(body)) {
      const results = [];
      let totalIncidents = 0;

      for (const item of body) {
        const res = await ingestReeferOemPacketAction(item, brandParam || undefined, tripId);
        results.push(res);
        if (res.incidentCreated) {
          totalIncidents += 1;
        }
      }

      return NextResponse.json({
        success: true,
        processedCount: results.length,
        incidentsCount: totalIncidents,
        results,
      });
    } else {
      const res = await ingestReeferOemPacketAction(body, brandParam || undefined, tripId);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        processedCount: 1,
        incidentCreated: res.incidentCreated,
        incidentId: res.incidentId,
        normalized: res.normalized,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error processing OEM reefer webhook';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

