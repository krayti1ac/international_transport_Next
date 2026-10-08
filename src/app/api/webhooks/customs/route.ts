import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import type { InboundCustomsWebhookPayload, PortNetBadrStatus } from '@/features/customs/types/customs-mtls.types';

export const dynamic = 'force-dynamic';

/**
 * Inbound Customs Webhook Endpoint (ADII BADR & PortNet Morocco)
 * Receives asynchronous clearance notifications, MRN assignments,
 * inspection channel routing, and BAE (Bon à Enlever) authorizations.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate incoming webhook if secret is configured
    const expectedSecret = process.env.CUSTOMS_WEBHOOK_SECRET;
    if (expectedSecret) {
      const headerSecret =
        request.headers.get('x-customs-secret') ||
        request.headers.get('x-webhook-token') ||
        request.headers.get('authorization')?.replace('Bearer ', '');

      const querySecret = request.nextUrl.searchParams.get('token');

      if (headerSecret !== expectedSecret && querySecret !== expectedSecret) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid customs webhook secret' },
          { status: 401 }
        );
      }
    }

    // 2. Parse JSON payload
    const body = (await request.json()) as InboundCustomsWebhookPayload;

    if (!body || !body.referenceNumber) {
      return NextResponse.json(
        { error: 'Bad Request: Missing referenceNumber or payload' },
        { status: 400 }
      );
    }

    const {
      gateway = 'badr',
      declarationType = 'DUM',
      referenceNumber,
      mrn,
      declarationNumber,
      status,
      inspectionChannel,
      baeNumber,
      baeDate,
      liquidationAmountMad,
      remarks,
    } = body;

    let supabase: any = null;
    try {
      supabase = await createClient();
    } catch (e) {
      console.warn('Customs webhook: Supabase client initialization error', e);
    }

    let matchedTripId: number | null = null;
    let submissionRecordId: number | null = null;

    if (supabase) {
      // 3. Find existing customs_submissions entry
      const { data: submission } = await supabase
        .from('customs_submissions')
        .select('id, trip_id, status, response_payload')
        .or(`reference_number.eq.${referenceNumber}${mrn ? `,mrn_number.eq.${mrn}` : ''}`)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (submission) {
        submissionRecordId = submission.id;
        matchedTripId = submission.trip_id;

        // Map status to database status column constraint
        let dbStatus: 'submitted' | 'accepted' | 'rejected' | 'pending' = 'submitted';
        if (status === 'CLEARED_BAE' || status === 'ACCEPTED') {
          dbStatus = 'accepted';
        } else if (status === 'REJECTED') {
          dbStatus = 'rejected';
        } else if (status === 'INSPECTION_REQUIRED') {
          dbStatus = 'pending';
        }

        const updatedResponsePayload = {
          ...(typeof submission.response_payload === 'object' ? submission.response_payload : {}),
          webhookCallback: body,
          updatedViaWebhookAt: new Date().toISOString(),
        };

        await supabase
          .from('customs_submissions')
          .update({
            status: dbStatus,
            mrn_number: mrn || undefined,
            accepted_at: dbStatus === 'accepted' ? new Date().toISOString() : undefined,
            response_payload: updatedResponsePayload,
            error_message: status === 'REJECTED' ? remarks || 'Refusé par la douane' : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submission.id);
      }

      // 4. If trip ID is not found through submission, try regex extraction
      if (!matchedTripId) {
        const match = referenceNumber.match(/TRIP[-_]?(\d+)/i) || referenceNumber.match(/(\d{2,6})/);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed)) {
            matchedTripId = parsed;
          }
        }
      }

      // 5. Update trip_orders table if trip ID resolved
      if (matchedTripId) {
        const tripUpdateFields: Record<string, unknown> = {
          customs_status: status,
        };

        if (mrn) tripUpdateFields.customs_mrn = mrn;
        if (declarationNumber) tripUpdateFields.customs_declaration_number = declarationNumber;
        if (inspectionChannel) tripUpdateFields.customs_channel = inspectionChannel;
        if (baeNumber) tripUpdateFields.customs_bae_number = baeNumber;
        if (baeDate) {
          tripUpdateFields.customs_bae_date = baeDate;
        } else if (status === 'CLEARED_BAE') {
          tripUpdateFields.customs_bae_date = new Date().toISOString();
        }

        await supabase
          .from('trip_orders')
          .update(tripUpdateFields)
          .eq('id', matchedTripId);
      }
    }

    // 6. Record sovereign audit trail
    await recordAuditLog({
      entityType: 'customs_submissions',
      entityId: referenceNumber,
      actionType: 'customs_push',
      reason: `Customs Webhook: ${gateway.toUpperCase()} ${declarationType} -> ${status} (Channel: ${inspectionChannel || 'N/A'}, MRN: ${mrn || 'N/A'})`,
      newData: {
        gateway,
        declarationType,
        status,
        inspectionChannel,
        mrn,
        baeNumber,
        matchedTripId,
        liquidationAmountMad,
      },
    });

    return NextResponse.json({
      success: true,
      processed: true,
      referenceNumber,
      status,
      tripId: matchedTripId,
      submissionId: submissionRecordId,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal customs webhook processing failure';
    console.error('Customs Webhook Error:', err);
    return NextResponse.json(
      { error: errorMsg, success: false },
      { status: 500 }
    );
  }
}

/**
 * Health check & discovery endpoint for BADR / PortNet webhooks
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    endpoint: '/api/webhooks/customs',
    gateways: ['BADR (ADII Morocco)', 'PortNet Guichet Unique'],
    protocols: ['mTLS X.509', 'W3C XML-DSig RSA-SHA256', 'EDI Webhook'],
    timestamp: new Date().toISOString(),
  });
}

