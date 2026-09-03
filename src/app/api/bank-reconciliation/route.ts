import { NextRequest, NextResponse } from 'next/server';
import { autoReconcileBankStatement, getUnreconciledTransactions } from '@/features/finance/services/bank_reconciliation.actions';
import type { BankStatementRow } from '@/features/finance/services/bank_reconciliation.actions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, bankAccountId } = body;

    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json({ error: 'csvData must be an array of bank statement rows' }, { status: 400 });
    }
    if (!bankAccountId) {
      return NextResponse.json({ error: 'bankAccountId is required' }, { status: 400 });
    }

    const result = await autoReconcileBankStatement(csvData as BankStatementRow[], Number(bankAccountId));
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await getUnreconciledTransactions();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result.transactions || []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
