import { NextRequest, NextResponse } from 'next/server';
import { confirmOnlinePaymentAction } from '@/features/payments/services/payments.actions';
import type { PaymentCurrency } from '@/features/payments/types/payment-gateway.types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let event: Record<string, unknown>;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = event.type as string;

    // Handle checkout session or payment intent success
    if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
      const dataObj = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
      const metadata = (dataObj?.metadata as Record<string, string>) || {};
      const token = metadata.token;
      const transactionRef = (dataObj?.id as string) || `STRIPE-${Date.now()}`;
      const amountReceived = dataObj?.amount_received
        ? (Number(dataObj.amount_received) / 100).toFixed(2)
        : dataObj?.amount
          ? (Number(dataObj.amount) / 100).toFixed(2)
          : '0.00';
      const currency = ((dataObj?.currency as string) || 'EUR').toUpperCase() as PaymentCurrency;

      if (token) {
        await confirmOnlinePaymentAction({
          token,
          gateway: 'stripe',
          transactionReference: transactionRef,
          paidAmount: amountReceived,
          currency,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe webhook error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

