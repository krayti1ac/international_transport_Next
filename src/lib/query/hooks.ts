'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import Decimal from 'decimal.js';
import type {
  User,
  TripOrder,
  Client,
  Driver,
  Truck,
  Trailer,
  Advance,
  TransportRoute,
  BankAccount,
  CashBox,
  TreasuryTransaction,
  Invoice,
} from '@/types/database';
import {
  DEFAULT_TRIPS,
  DEFAULT_CLIENTS,
  DEFAULT_DRIVERS,
  DEFAULT_TRUCKS,
  DEFAULT_TRAILERS,
  DEFAULT_CASH_BOXES,
  DEFAULT_ROUTES,
  DEFAULT_BANK_ACCOUNTS,
  DEFAULT_INVOICES,
  fallbackArray,
} from '@/lib/default-data';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return profile as User | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// -------------------------------------------------------------
// 1. Dashboard / Reports Query
// -------------------------------------------------------------
export interface DashboardRecentTrip {
  id: number;
  route: string;
  price: number;
  status: string;
  departure_date: string;
  cmr_number?: string;
  driver?: { name: string } | null;
  truck?: { plate_number: string } | null;
  client?: { name: string } | null;
}

export interface DashboardData {
  stats: {
    totalTrips: number;
    activeTrips: number;
    completedTrips: number;
    totalRevenueMAD: number;
    totalRevenueEUR: number;
    totalClients: number;
    totalTrucks: number;
    maintenanceTrucks: number;
    pendingSettlements: number;
  };
  statusDistribution: { name: string; value: number; color: string }[];
  recentTrips: DashboardRecentTrip[];
  monthlyRevenueData: { month: string; revenue: number; trips: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  delivered: '#10b981',
  in_transit: '#3b82f6',
  in_progress: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  loaded: '#8b5cf6',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'مكتملة',
  delivered: 'تم التسليم',
  in_transit: 'في الطريق',
  in_progress: 'قيد التنفيذ',
  loaded: 'تم التحميل',
  pending: 'معلقة / مجدولة',
  cancelled: 'ملغاة',
};

export function useDashboardDataQuery() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      const supabase = createClient();
      const [
        tripsCountRes,
        activeTripsRes,
        clientsRes,
        trucksRes,
        invoicesRes,
        recentTripsRes,
        allTripsRes,
        settlementsRes,
      ] = await Promise.all([
        supabase.from('trip_orders').select('id', { count: 'exact', head: true }),
        supabase.from('trip_orders').select('id', { count: 'exact', head: true }).in('status', ['in_transit', 'in_progress', 'loaded']),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('trucks').select('id, status', { count: 'exact' }),
        supabase.from('invoices').select('total_amount, currency, created_at'),
        supabase
          .from('trip_orders')
          .select(`
            id, route, price, status, departure_date, cmr_number,
            driver:drivers(name),
            truck:trucks(plate_number),
            client:clients(name)
          `)
          .order('id', { ascending: false })
          .limit(6),
        supabase.from('trip_orders').select('status, departure_date, price'),
        supabase.from('driver_advances').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      // Calculate Revenues with Decimal.js
      let revMAD = new Decimal(0);
      let revEUR = new Decimal(0);
      (invoicesRes.data as { total_amount?: string | number | null; currency?: string | null; created_at?: string | null }[] | null)?.forEach((inv) => {
        const amt = new Decimal(inv.total_amount || 0);
        if (inv.currency === 'EUR') {
          revEUR = revEUR.plus(amt);
        } else {
          revMAD = revMAD.plus(amt);
        }
      });

      const revenueMAD = revMAD.toNumber();
      const revenueEUR = revEUR.toNumber();

      // Calculate status distribution
      const statusCounts: Record<string, number> = {};
      (allTripsRes.data as { status?: string | null; departure_date?: string | null; price?: number | null }[] | null)?.forEach((trip) => {
        const s = trip.status || 'pending';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      const dist = Object.entries(statusCounts).map(([statusKey, count]) => ({
        name: STATUS_LABELS[statusKey] || statusKey,
        value: count,
        color: STATUS_COLORS[statusKey] || '#94a3b8',
      }));

      // Calculate monthly revenue
      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const monthlyMap: Record<number, { revenue: InstanceType<typeof Decimal>; trips: number }> = {};

      (invoicesRes.data as { total_amount?: string | number | null; created_at?: string | null }[] | null)?.forEach((inv) => {
        if (inv.created_at) {
          const m = new Date(inv.created_at).getMonth();
          if (!monthlyMap[m]) monthlyMap[m] = { revenue: new Decimal(0), trips: 0 };
          monthlyMap[m].revenue = monthlyMap[m].revenue.plus(new Decimal(inv.total_amount || 0));
        }
      });

      (allTripsRes.data as { departure_date?: string | null }[] | null)?.forEach((trip) => {
        if (trip.departure_date) {
          const m = new Date(trip.departure_date).getMonth();
          if (!monthlyMap[m]) monthlyMap[m] = { revenue: new Decimal(0), trips: 0 };
          monthlyMap[m].trips += 1;
        }
      });

      const currentMonth = new Date().getMonth();
      const chartData = [];
      for (let i = Math.max(0, currentMonth - 5); i <= currentMonth; i++) {
        chartData.push({
          month: months[i] || `شهر ${i + 1}`,
          revenue: Math.round(monthlyMap[i]?.revenue ? monthlyMap[i].revenue.toNumber() : (i === currentMonth ? revenueMAD : 0)),
          trips: monthlyMap[i]?.trips || (i === currentMonth ? (tripsCountRes.count || 0) : 0),
        });
      }

      const trucksList = trucksRes.data || [];
      const maintCount = trucksList.filter((t: { status?: string }) => t.status === 'maintenance' || t.status === 'inactive').length;

      return {
        stats: {
          totalTrips: tripsCountRes.count || 0,
          activeTrips: activeTripsRes.count || 0,
          completedTrips: (tripsCountRes.count || 0) - (activeTripsRes.count || 0),
          totalRevenueMAD: revenueMAD,
          totalRevenueEUR: revenueEUR,
          totalClients: clientsRes.count || 0,
          totalTrucks: trucksRes.count || trucksList.length || 0,
          maintenanceTrucks: maintCount,
          pendingSettlements: settlementsRes && 'count' in settlementsRes ? (settlementsRes.count || 0) : 0,
        },
        statusDistribution: dist.length > 0 ? dist : [{ name: 'رحلات مسجلة', value: tripsCountRes.count || 1, color: '#3b82f6' }],
        recentTrips: (recentTripsRes.data as unknown as DashboardRecentTrip[]) || [],
        monthlyRevenueData: chartData.length > 0 ? chartData : [{ month: 'الشهر الحالي', revenue: revenueMAD, trips: tripsCountRes.count || 0 }],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// -------------------------------------------------------------
// 2. Trips Hub Query
// -------------------------------------------------------------
export interface TripsHubData {
  trips: TripOrder[];
  clients: Client[];
  drivers: Driver[];
  trucks: Truck[];
  trailers: Trailer[];
  advances: Advance[];
  cashBoxes: { id: number; name: string }[];
  transportRoutes: TransportRoute[];
}

export function useTripsHubDataQuery() {
  return useQuery<TripsHubData>({
    queryKey: ['trips-hub-data'],
    queryFn: async () => {
      const supabase = createClient();
      const [
        tripsRes,
        clientsRes,
        driversRes,
        trucksRes,
        trailersRes,
        advancesRes,
        cashBoxesRes,
        routesRes,
      ] = await Promise.all([
        supabase.from('trip_orders').select('*').order('id', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('trucks').select('*').order('plate_number'),
        supabase.from('trailers').select('*').order('plate_number'),
        supabase.from('advances').select('*').order('date', { ascending: false }),
        supabase.from('cash_boxes').select('id, name').order('id'),
        supabase.from('transport_routes').select('*').order('created_at', { ascending: false }),
      ]);

      return {
        trips: fallbackArray(tripsRes.data, DEFAULT_TRIPS),
        clients: fallbackArray(clientsRes.data, DEFAULT_CLIENTS),
        drivers: fallbackArray(driversRes.data, DEFAULT_DRIVERS),
        trucks: fallbackArray(trucksRes.data, DEFAULT_TRUCKS),
        trailers: fallbackArray(trailersRes.data, DEFAULT_TRAILERS),
        advances: advancesRes.data || [],
        cashBoxes: fallbackArray(cashBoxesRes.data, DEFAULT_CASH_BOXES),
        transportRoutes: fallbackArray(routesRes.data, DEFAULT_ROUTES),
      };
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// -------------------------------------------------------------
// 3. Fleet Data Query
// -------------------------------------------------------------
export interface FleetData {
  trucks: Truck[];
  drivers: Driver[];
  trailers: Trailer[];
}

export function useFleetDataQuery() {
  return useQuery<FleetData>({
    queryKey: ['fleet-data'],
    queryFn: async () => {
      const supabase = createClient();
      const [trucksRes, driversRes, trailersRes] = await Promise.all([
        supabase.from('trucks').select('*').order('plate_number'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('trailers').select('*').order('plate_number'),
      ]);

      return {
        trucks: fallbackArray(trucksRes.data, DEFAULT_TRUCKS),
        drivers: fallbackArray(driversRes.data, DEFAULT_DRIVERS),
        trailers: fallbackArray(trailersRes.data, DEFAULT_TRAILERS),
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// -------------------------------------------------------------
// 4. Treasury Data Query
// -------------------------------------------------------------
export interface TreasuryData {
  transactions: TreasuryTransaction[];
  bankAccounts: BankAccount[];
  cashBoxes: CashBox[];
}

export function useTreasuryDataQuery() {
  return useQuery<TreasuryData>({
    queryKey: ['treasury-data'],
    queryFn: async () => {
      const supabase = createClient();
      const [transactionsRes, bankAccountsRes, cashBoxesRes] = await Promise.all([
        supabase.from('treasury_transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('*').order('id', { ascending: true }),
        supabase.from('cash_boxes').select('*').order('id', { ascending: true }),
      ]);

      return {
        transactions: transactionsRes.data || [],
        bankAccounts: fallbackArray(bankAccountsRes.data, DEFAULT_BANK_ACCOUNTS),
        cashBoxes: fallbackArray(cashBoxesRes.data, DEFAULT_CASH_BOXES),
      };
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// -------------------------------------------------------------
// 5. Clients Data Query
// -------------------------------------------------------------
export function useClientsDataQuery() {
  return useQuery<Client[]>({
    queryKey: ['clients-data'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return fallbackArray(data, DEFAULT_CLIENTS);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// -------------------------------------------------------------
// 6. Invoices Data Query
// -------------------------------------------------------------
export interface InvoicesData {
  invoices: Invoice[];
  clients: Client[];
  trips: TripOrder[];
  bankAccounts: BankAccount[];
  cashBoxes: CashBox[];
}

export function useInvoicesDataQuery() {
  return useQuery<InvoicesData>({
    queryKey: ['invoices-data'],
    queryFn: async () => {
      const supabase = createClient();
      const [invoicesRes, clientsRes, tripsRes, banksRes, cashBoxesRes] = await Promise.all([
        supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('trip_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('*').order('name'),
        supabase.from('cash_boxes').select('*').order('name'),
      ]);

      return {
        invoices: fallbackArray(invoicesRes.data, DEFAULT_INVOICES),
        clients: fallbackArray(clientsRes.data, DEFAULT_CLIENTS),
        trips: fallbackArray(tripsRes.data, DEFAULT_TRIPS),
        bankAccounts: fallbackArray(banksRes.data, DEFAULT_BANK_ACCOUNTS),
        cashBoxes: fallbackArray(cashBoxesRes.data, DEFAULT_CASH_BOXES),
      };
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

