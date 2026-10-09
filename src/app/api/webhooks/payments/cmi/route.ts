import { NextRequest, NextResponse } from 'next/server';
import { confirmOnlinePaymentAction } from '@/features/payments/services/payments.actions';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const oid = formData.get('oid') as string;
    const amount = formData.get('amount') as string;
    const procReturnCode = formData.get('ProcReturnCode') as string;
    const transId = (formData.get('TransId') as string) || `CMI-${Date.now()}`;

    // CMI Return Code '00' means successful authorization
    if (procReturnCode === '00' && oid) {
      await confirmOnlinePaymentAction({
        token: oid,
        gateway: 'cmi',
        transactionReference: transId,
        paidAmount: amount || '0.00',
        currency: 'MAD',
      });

      // CMI server expects 'ACTION=POSTAUTH' response
      return new NextResponse('ACTION=POSTAUTH', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new NextResponse('ACTION=FAILURE', {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'CMI webhook error';
    return new NextResponse(`ERROR: ${msg}`, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  // Client redirection after 3DS authentication
  return NextResponse.json({
    message: status === 'ok' ? 'CMI Payment Authorized' : 'CMI Payment Failed or Cancelled',
    status,
  });
}

