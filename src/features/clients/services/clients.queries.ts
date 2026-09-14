'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Client, Invoice, TripOrder, BankAccount, CashBox } from '@/types/database';
import type {
  ClientStatementData,
  CurrencyKpiBreakdown,
  ClientPaymentHistoryItem,
  ClientTripWithDetails,
} from '../types/client-statement.types';
import Decimal from 'decimal.js';
import { DEFAULT_BANK_ACCOUNTS, DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: number) => [...clientKeys.details(), id] as const,
  statement: (id: number, startDate?: string, endDate?: string) =>
    [...clientKeys.detail(id), 'statement', { startDate, endDate }] as const,
};

export function useClients() {
  return useQuery({
    queryKey: clientKeys.lists(),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientDetails(id: number) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('*, bank_accounts(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as (Client & { bank_accounts: BankAccount | null });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

interface RawPaymentAllocation {
  id: number;
  payment_id: number;
  invoice_id: number;
  allocated_amount: number;
  created_at: string;
  payments: {
    id: number;
    amount: number;
    currency?: string;
    method?: string;
    status?: string;
    reference?: string | null;
    notes?: string | null;
    created_at?: string;
    bank_account_id?: string | null;
  } | null;
}

export function useClientStatement(id: number, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: clientKeys.statement(id, startDate, endDate),
    queryFn: async (): Promise<ClientStatementData> => {
      const supabase = createClient();

      // 1. Fetch Client
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('*, bank_accounts(*)')
        .eq('id', id)
        .single();

      if (clientErr || !client) throw clientErr || new Error('العميل غير موجود');

      // 2. Fetch Invoices with date filter if supplied
      let invQuery = supabase
        .from('invoices')
        .select('*')
        .eq('client_id', id.toString())
        .order('issue_date', { ascending: false });

      if (startDate) invQuery = invQuery.gte('issue_date', startDate);
      if (endDate) invQuery = invQuery.lte('issue_date', endDate);

      // 3. Fetch Trips with date filter
      let tripsQuery = supabase
        .from('trip_orders')
        .select('*')
        .or(`client_id.eq.${id},client_import_id.eq.${id}`)
        .order('departure_date', { ascending: false });

      if (startDate) tripsQuery = tripsQuery.gte('departure_date', startDate);
      if (endDate) tripsQuery = tripsQuery.lte('departure_date', endDate);

      // 4. Fetch Bank Accounts, Cash Boxes, Drivers, Trucks
      const [invRes, tripsRes, banksRes, cashRes, driversRes, trucksRes] = await Promise.all([
        invQuery,
        tripsQuery,
        supabase.from('bank_accounts').select('*').eq('is_active', true),
        supabase.from('cash_boxes').select('*'),
        supabase.from('drivers').select('id, name'),
        supabase.from('trucks').select('id, plate_number, model'),
      ]);

      const invoices: Invoice[] = invRes.data || [];
      const rawTrips: TripOrder[] = tripsRes.data || [];
      const bankAccounts: BankAccount[] = fallbackArray(banksRes.data, DEFAULT_BANK_ACCOUNTS);
      const cashBoxes: CashBox[] = fallbackArray(cashRes.data, DEFAULT_CASH_BOXES);

      const driverMap = new Map((driversRes.data || []).map((d: { id: number; name: string }) => [d.id, d.name]));
      const truckMap = new Map(
        (trucksRes.data || []).map((t: { id: number; plate_number: string; model: string }) => [
          t.id,
          { plate: t.plate_number, model: t.model },
        ])
      );

      // Map Trips
      const trips: ClientTripWithDetails[] = rawTrips.map((trip) => {
        const isExport = trip.client_id === id;
        const truckInfo = trip.truck_id ? truckMap.get(trip.truck_id) : undefined;
        return {
          ...trip,
          isExport,
          driverName: trip.driver_id ? driverMap.get(trip.driver_id) : undefined,
          truckPlate: truckInfo?.plate,
          truckModel: truckInfo?.model,
        };
      });

      // 5. Fetch Payment Allocations for these invoices
      const invoiceIds = invoices.map((inv) => inv.id);
      let allocations: RawPaymentAllocation[] = [];
      if (invoiceIds.length > 0) {
        const { data: allocData } = await supabase
          .from('payment_invoice_allocations')
          .select(`
            id,
            payment_id,
            invoice_id,
            allocated_amount,
            created_at,
            payments (
              id,
              amount,
              currency,
              method,
              status,
              reference,
              notes,
              created_at,
              bank_account_id
            )
          `)
          .in('invoice_id', invoiceIds)
          .order('created_at', { ascending: false });

        allocations = (allocData || []) as unknown as RawPaymentAllocation[];
      }

      // Group allocations into unique PaymentHistoryItems
      const paymentsMap = new Map<number, ClientPaymentHistoryItem>();
      const invoiceNumMap = new Map(invoices.map((i) => [i.id, i.invoice_number || `INV-${i.id}`]));

      for (const alloc of allocations) {
        const p = alloc.payments;
        if (!p) continue;
        const pId = p.id;

        if (!paymentsMap.has(pId)) {
          const bankAcc = bankAccounts.find((b) => b.id.toString() === p.bank_account_id);
          paymentsMap.set(pId, {
            paymentId: p.id,
            amount: Number(p.amount || 0),
            currency: p.currency || client.currency || 'MAD',
            method: p.method || 'bank_transfer',
            status: p.status || 'completed',
            reference: p.reference,
            notes: p.notes,
            createdAt: p.created_at || alloc.created_at,
            bankAccountId: p.bank_account_id,
            bankAccountName: bankAcc?.name,
            allocations: [],
          });
        }

        const paymentItem = paymentsMap.get(pId)!;
        paymentItem.allocations.push({
          id: alloc.id,
          invoiceId: alloc.invoice_id,
          invoiceNumber: invoiceNumMap.get(alloc.invoice_id) || `#${alloc.invoice_id}`,
          allocatedAmount: Number(alloc.allocated_amount || 0),
        });
      }

      const payments = Array.from(paymentsMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // 6. Strict Decimal.js calculations with Currency Isolation (MAD / EUR)
      const currencyMap: Record<
        string,
        {
          totalInvoiced: InstanceType<typeof Decimal>;
          totalPaid: InstanceType<typeof Decimal>;
          invoiceCount: number;
          unpaidCount: number;
        }
      > = {};

      const defaultCurr = (client.currency || 'MAD').toUpperCase();
      currencyMap[defaultCurr] = {
        totalInvoiced: new Decimal(0),
        totalPaid: new Decimal(0),
        invoiceCount: 0,
        unpaidCount: 0,
      };

      for (const inv of invoices) {
        const curr = (inv.currency || defaultCurr).toUpperCase();
        if (!currencyMap[curr]) {
          currencyMap[curr] = {
            totalInvoiced: new Decimal(0),
            totalPaid: new Decimal(0),
            invoiceCount: 0,
            unpaidCount: 0,
          };
        }

        const ttc = new Decimal(inv.ttc_amount || inv.total_amount || 0);
        const paid = new Decimal(inv.paid_amount || 0);

        currencyMap[curr].totalInvoiced = currencyMap[curr].totalInvoiced.plus(ttc);
        currencyMap[curr].totalPaid = currencyMap[curr].totalPaid.plus(paid);
        currencyMap[curr].invoiceCount += 1;

        if (inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue') {
          currencyMap[curr].unpaidCount += 1;
        }
      }

      const kpisByCurrency: Record<string, CurrencyKpiBreakdown> = {};
      const activeCurrencies: string[] = [];

      for (const [curr, stats] of Object.entries(currencyMap)) {
        if (stats.invoiceCount > 0 || curr === defaultCurr) {
          activeCurrencies.push(curr);
          const totalDue = stats.totalInvoiced.minus(stats.totalPaid);
          const recoveryRate = stats.totalInvoiced.greaterThan(0)
            ? stats.totalPaid.dividedBy(stats.totalInvoiced).times(100).toFixed(1)
            : '100.0';

          kpisByCurrency[curr] = {
            currency: curr,
            totalInvoiced: stats.totalInvoiced.toFixed(2),
            totalPaid: stats.totalPaid.toFixed(2),
            totalDue: totalDue.greaterThan(0) ? totalDue.toFixed(2) : '0.00',
            recoveryRate: `${recoveryRate}%`,
            invoiceCount: stats.invoiceCount,
            unpaidCount: stats.unpaidCount,
          };
        }
      }

      return {
        client,
        invoices,
        payments,
        trips,
        bankAccounts,
        cashBoxes,
        kpisByCurrency,
        activeCurrencies,
      };
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}
