'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Landmark, Wallet, FileText, Clock } from 'lucide-react';
import type { ClientPaymentHistoryItem } from '../../types/client-statement.types';
import { useLanguage } from '@/components/language-provider';

interface ClientPaymentsTabProps {
  payments: ClientPaymentHistoryItem[];
}

export function ClientPaymentsTab({ payments }: ClientPaymentsTabProps) {
  const { t, dir } = useLanguage();

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return (
          <Badge variant="outline" className="gap-1 font-normal text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
            <Landmark className="w-3 h-3" />
            {t('تحويل بنكي', 'Virement bancaire')}
          </Badge>
        );
      case 'check':
        return (
          <Badge variant="outline" className="gap-1 font-normal text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
            <FileText className="w-3 h-3" />
            {t('شيك بنكي', 'Chèque')}
          </Badge>
        );
      case 'cash':
        return (
          <Badge variant="outline" className="gap-1 font-normal text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            <Wallet className="w-3 h-3" />
            {t('نقداً (كاش)', 'Espèces')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {method}
          </Badge>
        );
    }
  };

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-xl border border-border text-muted-foreground">
        <Landmark className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">
          {t('لا توجد دفعات مقبوضة مسجلة لهذا العميل حتى الآن', 'Aucun paiement enregistré pour ce client pour le moment')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
        <table className="w-full text-xs text-start">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground">
              <th className="py-3 px-4 font-semibold text-start">{t('معرف الحركة', 'ID Paiement')}</th>
              <th className="py-3 px-4 font-semibold text-start">{t('تاريخ السداد', 'Date de règlement')}</th>
              <th className="py-3 px-4 font-semibold text-start">{t('طريقة الدفع', 'Mode de paiement')}</th>
              <th className="py-3 px-4 font-semibold text-start">{t('وجهة الإيداع', 'Compte / Caisse')}</th>
              <th className="py-3 px-4 font-semibold text-start">{t('المرجع / الشيك', 'Référence')}</th>
              <th className="py-3 px-4 font-semibold text-start">{t('الفواتير الموزع عليها (FIFO)', 'Factures réglées (FIFO)')}</th>
              <th className="py-3 px-4 font-semibold text-end">{t('مبلغ الدفعة', 'Montant')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => {
              return (
                <tr key={p.paymentId} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-foreground" dir="ltr">
                    #{p.paymentId}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 opacity-60" />
                      {new Date(p.createdAt).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{getMethodBadge(p.method)}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    {p.bankAccountName ? (
                      <span className="font-medium text-foreground">{p.bankAccountName}</span>
                    ) : (
                      <span>{t('صندوق الخزينة', 'Caisse')}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap" dir="ltr">
                    {p.reference || '-'}
                  </td>
                  <td className="py-3 px-4">
                    {p.allocations.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {p.allocations.map((alloc) => (
                          <span
                            key={alloc.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono border border-border/60"
                          >
                            <span className="font-bold text-foreground">{alloc.invoiceNumber}:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {alloc.allocatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {p.currency}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">{t('دفعة عامة غير مخصصة', 'Paiement non affecté')}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-sm">
                    +{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {p.currency}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
