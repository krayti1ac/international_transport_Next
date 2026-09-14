'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Printer,
  MessageCircle,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarDays,
} from 'lucide-react';
import type { Invoice, Client } from '@/types/database';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';
import { InvoicePrintModal } from '@/components/invoice-print-modal';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface ClientInvoicesTabProps {
  invoices: Invoice[];
  client: Client;
}

type AgingBucket = {
  label: string;
  minDays: number;
  maxDays: number | null;
  amount: InstanceType<typeof Decimal>;
  count: number;
};

export function ClientInvoicesTab({ invoices, client }: ClientInvoicesTabProps) {
  const { t, dir } = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoiceToPrint, setSelectedInvoiceToPrint] = useState<Invoice | null>(null);

  const today = useMemo(() => new Date(), []);

  const agingBuckets = useMemo(() => {
    const buckets: AgingBucket[] = [
      { label: t('حتى 30 يوم', 'Jusqu\'à 30 jours'), minDays: 0, maxDays: 30, amount: new Decimal(0), count: 0 },
      { label: t('31-60 يوم', '31-60 jours'), minDays: 31, maxDays: 60, amount: new Decimal(0), count: 0 },
      { label: t('61-90 يوم', '61-90 jours'), minDays: 61, maxDays: 90, amount: new Decimal(0), count: 0 },
      { label: t('أكثر من 90 يوم', 'Plus de 90 jours'), minDays: 91, maxDays: null, amount: new Decimal(0), count: 0 },
    ];

    for (const inv of invoices) {
      const ttc = new Decimal(inv.ttc_amount || inv.total_amount || 0);
      const paid = new Decimal(inv.paid_amount || 0);
      const due = ttc.minus(paid);

      if (due.greaterThan(0) && (inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue')) {
        const dueDate = inv.due_date ? new Date(inv.due_date) : null;
        if (dueDate) {
          const diffTime = today.getTime() - dueDate.getTime();
          const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

          for (const bucket of buckets) {
            if (bucket.maxDays === null || diffDays <= bucket.maxDays) {
              if (diffDays >= bucket.minDays) {
                bucket.amount = bucket.amount.plus(due);
                bucket.count += 1;
                break;
              }
            }
          }
        }
      }
    }

    return buckets;
  }, [invoices, today, t]);

  const totalAgingAmount = useMemo(() => {
    return agingBuckets.reduce((sum, bucket) => sum.plus(bucket.amount), new Decimal(0));
  }, [agingBuckets]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        !search ||
        (inv.invoice_number && inv.invoice_number.toLowerCase().includes(search.toLowerCase())) ||
        inv.id.toString().includes(search);

      const matchesStatus =
        statusFilter === 'all' ||
        inv.status === statusFilter ||
        (statusFilter === 'pending_all' &&
          (inv.status === 'unpaid' || inv.status === 'partially_paid' || inv.status === 'overdue'));

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {t('مدفوعة بالكامل', 'Payée')}
          </Badge>
        );
      case 'partially_paid':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1">
            <Clock className="w-3 h-3" />
            {t('مدفوعة جزئياً', 'Partiellement payée')}
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1">
            <AlertTriangle className="w-3 h-3" />
            {t('متأخرة السداد', 'En retard')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-slate-600 dark:text-slate-400 gap-1">
            <FileText className="w-3 h-3" />
            {t('غير مدفوعة', 'Impayée')}
          </Badge>
        );
    }
  };

  const getAgingBadgeColor = (days: number) => {
    if (days <= 30) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    if (days <= 60) return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
    if (days <= 90) return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30';
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30';
  };

  const generateWhatsAppLink = (invoice: Invoice, dueAmount: number | string) => {
    if (!client.phone) return null;
    const phoneClean = client.phone.replace(/[^\d+]/g, '').replace(/^00/, '').replace(/^0/, '212');
    const invNum = invoice.invoice_number || `#${invoice.id}`;
    const curr = invoice.currency || client.currency || 'MAD';
    const dueFormatted = new Decimal(dueAmount).toFixed(2);
    const dueDate = invoice.due_date || invoice.issue_date || '';

    const message =
      dir === 'rtl'
        ? `السلام عليكم ${client.name}، نود تذكيركم بالفاتورة رقم ${invNum} بمبلغ متبقي ${dueFormatted} ${curr}${
            dueDate ? ` وتاريخ استحقاقها ${dueDate}` : ''
          }. شكراً لتعاونكم معنا.`
        : `Bonjour ${client.name}, nous vous rappelons que la facture N° ${invNum} d'un montant restant de ${dueFormatted} ${curr}${
            dueDate ? ` (échéance : ${dueDate})` : ''
          } est en attente de règlement. Merci.`;

    return `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
  };

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* FIFO Aging Summary */}
      {totalAgingAmount.greaterThan(0) && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {t('تحليل عمر الديون (FIFO Aging)', 'Analyse d\'âge des créances (FIFO)')}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrintStatement}
              className="h-7 px-2 text-[11px] gap-1.5 hover:bg-primary/10 hover:text-primary"
              title={t('طباعة كشف الحساب', 'Imprimer le relevé de compte')}
            >
              <Printer className="w-3 h-3" />
              <span className="hidden sm:inline">{t('طباعة الكشف', 'Imprimer')}</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {agingBuckets.map((bucket) => (
              <div
                key={bucket.label}
                className={`rounded-lg border p-3 text-center ${bucket.amount.greaterThan(0) ? 'bg-muted/30' : 'bg-muted/10 opacity-60'}`}
              >
                <p className="text-[11px] text-muted-foreground mb-1">{bucket.label}</p>
                <p className="text-sm font-black font-mono text-foreground">
                  {Number(bucket.amount.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-[10px] font-sans text-muted-foreground ms-1">
                    {invoices[0]?.currency || client.currency || 'MAD'}
                  </span>
                </p>
                {bucket.count > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {bucket.count} {t('فاتورة', 'facture(s)')}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('إجمالي الديون المتراكمة', 'Total créances en souffrance')}
            </span>
            <span className="text-sm font-black font-mono text-foreground">
              {Number(totalAgingAmount.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              {invoices[0]?.currency || client.currency || 'MAD'}
            </span>
          </div>
        </div>
      )}

      {/* Controls: Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('بحث برقم الفاتورة...', 'Rechercher par N° facture...')}
            className="ps-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t('تصفية الحالة:', 'Statut :')}
          </span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('جميع الفواتير', 'Toutes les factures')}</SelectItem>
              <SelectItem value="pending_all">{t('غير المسددة فقط', 'Impayées uniquement')}</SelectItem>
              <SelectItem value="overdue">{t('متأخرة السداد', 'En retard')}</SelectItem>
              <SelectItem value="partially_paid">{t('مدفوعة جزئياً', 'Partiellement payée')}</SelectItem>
              <SelectItem value="paid">{t('مدفوعة بالكامل', 'Payée')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            {t('لا توجد فواتير مطابقة لمعايير البحث', 'Aucune facture correspondant aux critères')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="py-3 px-4 font-semibold text-start">{t('رقم الفاتورة', 'N° Facture')}</th>
                <th className="py-3 px-4 font-semibold text-start">{t('تاريخ الإصدار', 'Date d\'émission')}</th>
                <th className="py-3 px-4 font-semibold text-start">{t('الاستحقاق', 'Échéance')}</th>
                <th className="py-3 px-4 font-semibold text-start">{t('عمر الفاتورة', 'Âge')}</th>
                <th className="py-3 px-4 font-semibold text-start">{t('المبلغ (TTC)', 'Montant TTC')}</th>
                <th className="py-3 px-4 font-semibold text-start">{t('المسدد', 'Réglé')}</th>
                <th className="py-3 px-4 font-semibold text-start">{t('المتبقي', 'Reste à payer')}</th>
                <th className="py-3 px-4 font-semibold text-start">{t('الحالة', 'Statut')}</th>
                <th className="py-3 px-4 font-semibold text-end">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((inv) => {
                const ttc = new Decimal(inv.ttc_amount || inv.total_amount || '0');
                const paid = new Decimal(inv.paid_amount || '0');
                const due = ttc.minus(paid);
                const curr = inv.currency || client.currency || 'MAD';
                const whatsappUrl = generateWhatsAppLink(inv, Number(due.toFixed(2)));

                let ageDays: number | null = null;
                let ageBadge: React.ReactNode = null;
                if (due.greaterThan(0) && inv.due_date) {
                  const dueDate = new Date(inv.due_date);
                  const diffTime = today.getTime() - dueDate.getTime();
                  ageDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                  if (ageDays > 0) {
                    ageBadge = (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${getAgingBadgeColor(ageDays)}`}
                      >
                        {ageDays} {t('يوم', 'j')}
                      </span>
                    );
                  } else if (inv.status === 'unpaid' || inv.status === 'partially_paid') {
                    ageBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border bg-muted text-muted-foreground">
                        {t('حتى الاستحقاق', 'À échéance')}
                      </span>
                    );
                  }
                }

                return (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground" dir="ltr">
                      {inv.invoice_number || `INV-${inv.id}`}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {inv.issue_date
                        ? new Date(inv.issue_date).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {inv.due_date
                        ? new Date(inv.due_date).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')
                        : '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{ageBadge || '-'}</td>
                    <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                      {Number(ttc.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {curr}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {Number(paid.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {curr}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                      {due.greaterThan(0) ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {Number(due.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {curr}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getInvoiceStatusBadge(inv.status)}</td>
                    <td className="py-3 px-4 text-end whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Print Invoice Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedInvoiceToPrint(inv)}
                          className="h-8 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                          title={t('طباعة الفاتورة', 'Imprimer la facture')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('طباعة', 'Imprimer')}</span>
                        </Button>

                        {/* WhatsApp Payment Reminder */}
                        {due.greaterThan(0) && whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 transition-colors"
                            title={t('إرسال تذكير سداد عبر WhatsApp', 'Rappel de paiement WhatsApp')}
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">{t('تذكير واتساب', 'Rappel WA')}</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Print Modal */}
      {selectedInvoiceToPrint && (
        <InvoicePrintModal
          isOpen={!!selectedInvoiceToPrint}
          onClose={() => setSelectedInvoiceToPrint(null)}
          invoice={selectedInvoiceToPrint}
          client={client}
        />
      )}
    </div>
  );
}

