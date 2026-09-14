import type { Client, Invoice, TripOrder, BankAccount, CashBox } from '@/types/database';

export interface CurrencyKpiBreakdown {
  currency: string;
  totalInvoiced: string;
  totalPaid: string;
  totalDue: string;
  recoveryRate: string;
  invoiceCount: number;
  unpaidCount: number;
}

export interface ClientPaymentAllocationItem {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  allocatedAmount: number;
}

export interface ClientPaymentHistoryItem {
  paymentId: number;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  bankAccountId?: string | null;
  bankAccountName?: string | null;
  allocations: ClientPaymentAllocationItem[];
}

export interface ClientTripWithDetails extends TripOrder {
  driverName?: string;
  truckPlate?: string;
  truckModel?: string;
  isExport: boolean;
}

export interface ClientStatementData {
  client: Client;
  invoices: Invoice[];
  payments: ClientPaymentHistoryItem[];
  trips: ClientTripWithDetails[];
  bankAccounts: BankAccount[];
  cashBoxes: CashBox[];
  kpisByCurrency: Record<string, CurrencyKpiBreakdown>;
  activeCurrencies: string[];
}

