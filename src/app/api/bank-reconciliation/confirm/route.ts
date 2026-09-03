import { NextRequest, NextResponse } from 'next/server';
import { confirmBankReconciliation } from '@/features/finance/services/bank_reconciliation.actions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, bankStatementRef } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    const result = await confirmBankReconciliation(Number(transactionId), bankStatementRef || 'bank_reconciled_via_ui');
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
