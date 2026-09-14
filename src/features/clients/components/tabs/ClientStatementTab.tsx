'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Printer, Download, Landmark, Calendar } from 'lucide-react';
import type { Client, Invoice } from '@/types/database';
import type {
  ClientPaymentHistoryItem,
  ClientTripWithDetails,
} from '../../types/client-statement.types';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface ClientStatementTabProps {
  client: Client;
  invoices: Invoice[];
  payments: ClientPaymentHistoryItem[];
  trips: ClientTripWithDetails[];
  startDate: string;
  endDate: string;
}

export function ClientStatementTab({
  client,
  invoices,
  payments,
  trips,
  startDate,
  endDate,
}: ClientStatementTabProps) {
  const { t, dir } = useLanguage();
  const currency = (client.currency || 'MAD').toUpperCase();

  const totalInvoiced = invoices.reduce(
    (sum, inv) => sum.plus(new Decimal(inv.ttc_amount || inv.total_amount || 0)),
    new Decimal(0)
  );

  const totalPaid = invoices.reduce(
    (sum, inv) => sum.plus(new Decimal(inv.paid_amount || 0)),
    new Decimal(0)
  );

  const totalDue = totalInvoiced.minus(totalPaid);

  const totalPaymentsReceived = payments.reduce(
    (sum, p) => sum.plus(new Decimal(p.amount || 0)),
    new Decimal(0)
  );

  const totalTripRevenue = trips.reduce((sum, trip) => {
    const price = trip.isExport ? trip.price_export || trip.price : trip.price_import || trip.price;
    return sum.plus(new Decimal(price || 0));
  }, new Decimal(0));

  const totalTripCosts = trips.reduce((sum, trip) => {
    const costs = [trip.ferry_cost, trip.triptik_cost, trip.transit_almeria_cost, trip.marsa_maroc_cost]
      .filter(Boolean)
      .reduce((s, c) => s.plus(new Decimal(c as number)), new Decimal(0));
    return sum.plus(costs);
  }, new Decimal(0));

  const totalTripProfit = totalTripRevenue.minus(totalTripCosts);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Statement Header */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-2xs print:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t('كشف حساب العميل', 'Relevé de compte client')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('الفترة:', 'Période:')} {formatDate(startDate)} - {formatDate(endDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
              title={t('طباعة الكشف', 'Imprimer le relevé')}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('طباعة', 'Imprimer')}</span>
            </Button>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-border/60">
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">{t('العميل:', 'Client:')}</p>
            <p className="text-sm font-bold text-foreground">{client.name}</p>
            {client.ice && <p className="text-xs text-muted-foreground font-mono">ICE: {client.ice}</p>}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">{t('العملة:', 'Devise:')}</p>
            <p className="text-sm font-bold text-foreground">{currency}</p>
            {client.phone && <p className="text-xs text-muted-foreground">{t('هاتف:', 'Tél:')} {client.phone}</p>}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg border border-border bg-blue-500/5">
            <p className="text-[11px] text-muted-foreground mb-1">{t('إجمالي الفواتير', 'Total Facturé')}</p>
            <p className="text-xl font-black font-mono text-foreground">
              {Number(totalInvoiced.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              {currency}
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-emerald-500/5">
            <p className="text-[11px] text-muted-foreground mb-1">{t('إجمالي المسدد', 'Total Réglé')}</p>
            <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {Number(totalPaid.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              {currency}
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-rose-500/5">
            <p className="text-[11px] text-muted-foreground mb-1">{t('الرصيد المستحق', 'Solde dû')}</p>
            <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
              {Number(totalDue.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              {currency}
            </p>
          </div>
        </div>

        {/* Tax & Operations Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border">
            <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              {t('الدفعات المقبوضة', 'Paiements Reçus')}
            </p>
            <p className="text-lg font-black font-mono text-foreground">
              {Number(totalPaymentsReceived.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              {currency}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {payments.length} {t('عملية سداد', 'opération(s)')}
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('الشحنات والرحلات', 'Trajets & Fret')}
            </p>
            <p className="text-lg font-black font-mono text-foreground">
              {Number(totalTripRevenue.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              {currency}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('صافي الربح:', 'Profit net:')}{' '}
              <span className={totalTripProfit.greaterThanOrEqualTo(0) ? 'text-emerald-600' : 'text-rose-600'}>
                {Number(totalTripProfit.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                {currency}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Recent Invoices Summary */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-2xs print:shadow-none">
        <h4 className="text-sm font-bold text-foreground mb-4">
          {t('ملخص الفواتير الأخيرة', 'Résumé des factures récentes')}
        </h4>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {t('لا توجد فواتير في هذه الفترة', 'Aucune facture dans cette période')}
          </p>
        ) : (
          <div className="space-y-2">
            {invoices.slice(0, 10).map((inv) => {
              const ttc = new Decimal(inv.ttc_amount || inv.total_amount || 0);
              const paid = new Decimal(inv.paid_amount || 0);
              const due = ttc.minus(paid);
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-foreground" dir="ltr">
                      {inv.invoice_number || `INV-${inv.id}`}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(inv.issue_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-mono text-foreground">
                      {Number(ttc.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {Number(paid.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {due.greaterThan(0) && (
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {Number(due.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
