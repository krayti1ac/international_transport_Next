'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Landmark,
  Truck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { useFiscalStore } from '@/lib/stores/fiscal-store';
import { PeriodFilterBar } from '@/components/PeriodFilterBar';
import { useClientStatement } from '../services/clients.queries';
import { ClientProfileHeader } from './ClientProfileHeader';
import { ClientKpiBento } from './ClientKpiBento';
import { ClientInvoicesTab } from './tabs/ClientInvoicesTab';
import { ClientPaymentsTab } from './tabs/ClientPaymentsTab';
import { ClientTripsTab } from './tabs/ClientTripsTab';
import { ClientStatementTab } from './tabs/ClientStatementTab';
import { FifoPaymentModal } from './FifoPaymentModal';
import { createClient } from '@/lib/supabase/client';

interface ClientDetailViewProps {
  clientId: number;
}

export function ClientDetailView({ clientId }: ClientDetailViewProps) {
  const { t, dir } = useLanguage();
  const [isFifoModalOpen, setIsFifoModalOpen] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const { startDate, endDate } = useFiscalStore();
  const supabase = useMemo(() => createClient(), []);

  const {
    data: statement,
    isLoading,
    isError,
    error,
    refetch,
  } = useClientStatement(clientId, startDate, endDate);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    channel = supabase
      .channel(`client-detail-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_invoice_allocations',
        },
        () => {
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_orders',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else {
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [clientId, refetch, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-muted-foreground gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">
          {t('جاري تحميل كشف الحساب والملف المحاسبي للعميل...', 'Chargement du relevé de compte client...')}
        </p>
      </div>
    );
  }

  if (isError || !statement?.client) {
    return (
      <div className="min-h-[350px] flex flex-col items-center justify-center text-rose-500 gap-3 p-6 text-center">
        <AlertCircle className="w-10 h-10" />
        <h3 className="text-lg font-bold">
          {t('تعذر تحميل بيانات العميل', 'Impossible de charger le dossier client')}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md">
          {error instanceof Error ? error.message : t('تأكد من صحة رقم العميل والاتصال بقاعدة البيانات', 'Vérifiez l\'identifiant client et la connexion')}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2 gap-2">
          <RefreshCw className="w-4 h-4" />
          <span>{t('إعادة المحاولة', 'Réessayer')}</span>
        </Button>
      </div>
    );
  }

  const { client, invoices, payments, trips, bankAccounts, cashBoxes, kpisByCurrency, activeCurrencies } =
    statement;

  const defaultCurrency = (client.currency || 'MAD').toUpperCase();
  const activeStats = kpisByCurrency[defaultCurrency] || Object.values(kpisByCurrency)[0];
  const totalDueAmount = activeStats?.totalDue || '0';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir={dir}>
      {/* Top Bar: Back to Clients Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('العودة إلى قائمة العملاء', 'Retour à la liste des clients')}</span>
        </Link>

        {isRealtimeConnected && (
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {t('مباشر', 'Temps réel')}
          </span>
        )}
      </div>

      {/* 1. Client Profile & Tax Header */}
      <ClientProfileHeader
        client={client}
        onOpenFifoModal={() => setIsFifoModalOpen(true)}
      />

      {/* 2. Fiscal Period Filter Bar */}
      <PeriodFilterBar onFilterChange={() => refetch()} />

      {/* 3. KPI Bento Grid with Decimal.js & Currency Isolation */}
      <ClientKpiBento
        kpisByCurrency={kpisByCurrency}
        activeCurrencies={activeCurrencies}
        defaultCurrency={defaultCurrency}
      />

      {/* 4. Operational Tabs (Invoices, Payments, Trips) */}
      <Tabs defaultValue="invoices" className="w-full space-y-4">
        <TabsList className="grid w-full sm:w-auto grid-cols-4 h-12 rounded-xl p-1 bg-muted/60 border border-border">
          <TabsTrigger value="invoices" className="rounded-lg text-xs sm:text-sm gap-2">
            <FileText className="w-4 h-4" />
            <span>{t('سجل الفواتير', 'Factures')}</span>
            <span className="font-mono text-[11px] opacity-75">({invoices.length})</span>
          </TabsTrigger>

          <TabsTrigger value="statement" className="rounded-lg text-xs sm:text-sm gap-2">
            <FileText className="w-4 h-4" />
            <span>{t('كشف الحساب', 'Relevé')}</span>
          </TabsTrigger>

          <TabsTrigger value="payments" className="rounded-lg text-xs sm:text-sm gap-2">
            <Landmark className="w-4 h-4" />
            <span>{t('سجل الدفعات المقبوضة', 'Paiements Reçus')}</span>
            <span className="font-mono text-[11px] opacity-75">({payments.length})</span>
          </TabsTrigger>

          <TabsTrigger value="trips" className="rounded-lg text-xs sm:text-sm gap-2">
            <Truck className="w-4 h-4" />
            <span>{t('سجل الشحنات والرحلات', 'Trajets & Fret')}</span>
            <span className="font-mono text-[11px] opacity-75">({trips.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="focus-visible:outline-hidden">
          <ClientInvoicesTab invoices={invoices} client={client} />
        </TabsContent>

        {/* Statement Tab */}
        <TabsContent value="statement" className="focus-visible:outline-hidden">
          <ClientStatementTab
            client={client}
            invoices={invoices}
            payments={payments}
            trips={trips}
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="focus-visible:outline-hidden">
          <ClientPaymentsTab payments={payments} />
        </TabsContent>

        {/* Trips Tab */}
        <TabsContent value="trips" className="focus-visible:outline-hidden">
          <ClientTripsTab trips={trips} currency={defaultCurrency} />
        </TabsContent>
      </Tabs>

      {/* 5. Instant FIFO Payment Modal */}
      {isFifoModalOpen && (
        <FifoPaymentModal
          isOpen={isFifoModalOpen}
          onClose={() => setIsFifoModalOpen(false)}
          onSuccess={() => refetch()}
          client={client}
          totalDue={totalDueAmount}
          bankAccounts={bankAccounts}
          cashBoxes={cashBoxes}
          activeCurrencies={activeCurrencies}
        />
      )}
    </div>
  );
}