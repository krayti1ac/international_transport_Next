'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import Decimal from 'decimal.js';
import type { Invoice } from '@/types/database';
import {
  Receipt,
} from 'lucide-react';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface TripInvoicesTabProps {
  invoices: Invoice[];
}

export function TripInvoicesTab({ invoices }: TripInvoicesTabProps) {
  const { t, dir } = useLanguage();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          label: t('مدفوعة بالكامل', 'Payée en totalité'),
          className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25',
        };
      case 'partially_paid':
        return {
          label: t('مدفوعة جزئياً', 'Partiellement payée'),
          className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25',
        };
      case 'unpaid':
        return {
          label: t('غير مدفوعة', 'Non payée'),
          className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/25',
        };
      case 'overdue':
        return {
          label: t('متأخرة', 'En retard'),
          className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/25',
        };
      default:
        return {
          label: status,
          className: 'bg-muted text-muted-foreground border-border',
        };
    }
  };

  const totalInvoices = invoices.reduce((acc, inv) => acc.plus(new Decimal(inv.total_amount || 0)), new Decimal(0));
  const totalPaid = invoices.reduce((acc, inv) => acc.plus(new Decimal(inv.paid_amount || 0)), new Decimal(0));
  const totalOutstanding = totalInvoices.minus(totalPaid);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <span>{t('فواتير مرتبطة بهذه الرحلة', 'Factures liées à cette mission')}</span>
            <Badge variant="outline" className="text-xs font-mono">
              {invoices.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {invoices.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">
              {t('لا توجد فواتير مرتبطة بهذه الرحلة حالياً.', 'Aucune facture liée à cette mission pour le moment.')}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-border">
                  <CardContent className="p-3">
                    <span className="text-[11px] text-muted-foreground">{t('إجمالي الفواتير', 'Total facturé')}</span>
                    <p className="text-lg font-black font-mono text-foreground">{formatCurrency(totalInvoices.toNumber(), 'MAD')}</p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3">
                    <span className="text-[11px] text-muted-foreground">{t('المحصل', 'Encaissé')}</span>
                    <p className="text-lg font-black font-mono text-emerald-600">{formatCurrency(totalPaid.toNumber(), 'MAD')}</p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3">
                    <span className="text-[11px] text-muted-foreground">{t('المتبقي', 'Reste à encaisser')}</span>
                    <p className="text-lg font-black font-mono text-rose-600">{formatCurrency(totalOutstanding.toNumber(), 'MAD')}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="divide-y divide-border/60">
                {invoices.map((inv) => {
                  const statusBadge = getStatusBadge(inv.status);
                  const paidDec = new Decimal(inv.paid_amount || 0);
                  const totalDec = new Decimal(inv.total_amount || 0);
                  const remaining = totalDec.minus(paidDec);

                  return (
                    <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{inv.invoice_number}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {t('إصدار:', 'Date facture :')}{' '}
                            {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR') : '—'}
                            {inv.due_date && (
                              <>
                                <span className="mx-1">•</span>
                                {t('استحقاق:', 'Échéance :')}{' '}
                                {new Date(inv.due_date).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <p className="text-sm font-black font-mono text-foreground">{formatCurrency(totalDec.toNumber(), inv.currency || 'MAD')}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {t('المدفوع:', 'Payé :')} {formatCurrency(paidDec.toNumber(), inv.currency || 'MAD')}
                            {remaining.gt(0) && (
                              <span className="text-rose-600 font-semibold"> • {t('متبقي:', 'Reste :')} {formatCurrency(remaining.toNumber(), inv.currency || 'MAD')}</span>
                            )}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
