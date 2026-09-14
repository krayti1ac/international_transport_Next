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
import { Printer, MessageCircle, Search, FileText, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { Invoice, Client } from '@/types/database';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';
import { InvoicePrintModal } from '@/components/invoice-print-modal';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface ClientInvoicesTabProps {
  invoices: Invoice[];
  client: Client;
}

export function ClientInvoicesTab({ invoices, client }: ClientInvoicesTabProps) {
  const { t, dir } = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoiceToPrint, setSelectedInvoiceToPrint] = useState<Invoice | null>(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search filter
      const matchesSearch =
        !search ||
        (inv.invoice_number && inv.invoice_number.toLowerCase().includes(search.toLowerCase())) ||
        inv.id.toString().includes(search);

      // Status filter
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

  const generateWhatsAppLink = (invoice: Invoice, dueAmount: InstanceType<typeof Decimal>) => {
    if (!client.phone) return null;
    const phoneClean = client.phone.replace(/[^\d+]/g, '').replace(/^00/, '').replace(/^0/, '212');
    const invNum = invoice.invoice_number || `#${invoice.id}`;
    const curr = invoice.currency || client.currency || 'MAD';
    const dueFormatted = dueAmount.toFixed(2);
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

  return (
    <div className="space-y-4">
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
                const whatsappUrl = generateWhatsAppLink(inv, due);

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

