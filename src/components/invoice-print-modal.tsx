'use client';

import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import type { Invoice, Client } from '@/types/database';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  client?: Client;
}

export function InvoicePrintModal({ isOpen, onClose, invoice, client }: InvoiceModalProps) {
  const { t, dir, locale } = useLanguage();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const ht = new Decimal(invoice.ht_amount || invoice.total_amount || '0');
  const tva = new Decimal(invoice.tva_amount || '0');
  const total = new Decimal(invoice.ttc_amount || invoice.total_amount || '0');
  const currencyStr = invoice.currency || (locale === 'fr' ? 'MAD' : 'د.م.');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" dir={dir}>
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-3xl w-full my-8 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden" data-print-hidden>
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            {t('طباعة الفاتورة / حفظ PDF', 'Imprimer la facture / Enregistrer en PDF')}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible" dir={dir} data-print-p-0 data-print-overflow-visible>
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div>
              <h2 className="text-2xl font-bold font-amiri text-primary">
                {t('شركة النقل الدولي السريع', 'Société de Transport International Rapide')}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {t('خدمات النقل الدولي واللوجستيات عبر القارات', 'Services de transport international et logistique intercontinentale')}
              </p>
              <p className="text-xs text-slate-500">
                {t('المملكة المغربية', 'Royaume du Maroc')}
              </p>
            </div>
            <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
              <h1 className="text-2xl font-black text-slate-800">
                {locale === 'fr' ? 'FACTURE / فاتورة' : 'فاتورة / FACTURE'}
              </h1>
              <p className="text-sm font-mono font-bold text-slate-600 mt-1">
                N°: {invoice.invoice_number || `INV-${invoice.id}`}
              </p>
              <p className="text-xs text-slate-500">
                {t('التاريخ: ', 'Date : ')}{invoice.issue_date || new Date().toISOString().split('T')[0]}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6 text-sm">
            <div>
              <h3 className="font-bold text-slate-700 mb-2">{t('بيانات العميل (Client):', 'Informations Client :')}</h3>
              <p className="font-semibold text-slate-900">{client?.name || `${t('عميل', 'Client')} #${invoice.client_id}`}</p>
              {client?.ice && <p className="text-slate-600">ICE: {client.ice}</p>}
              <p className="text-slate-600">{client?.address || client?.city || t('المغرب', 'Maroc')}</p>
              <p className="text-slate-600">{client?.phone}</p>
            </div>
            <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
              <h3 className="font-bold text-slate-700 mb-2">{t('تفاصيل الدفع (Paiement):', 'Détails du Paiement :')}</h3>
              <p><span className="text-slate-500">{t('تاريخ الاستحقاق: ', 'Échéance : ')}</span>{invoice.due_date || t('عند الاستلام', 'À réception')}</p>
              <p><span className="text-slate-500">{t('العملة: ', 'Devise : ')}</span>{currencyStr}</p>
              <p>
                <span className="text-slate-500">{t('الحالة: ', 'Statut : ')}</span>
                <span className="font-bold uppercase">
                  {invoice.status === 'paid' ? t('مدفوعة', 'PAYÉE') :
                   invoice.status === 'overdue' ? t('متأخرة', 'EN RETARD') :
                   invoice.status === 'pending' || invoice.status === 'issued' ? t('قيد الانتظار', 'EN ATTENTE') :
                   invoice.status === 'cancelled' ? t('ملغاة', 'ANNULÉE') : invoice.status}
                </span>
              </p>
            </div>
          </div>

          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse mb-6`}>
            <thead>
              <tr className="border-b-2 border-slate-300 text-sm text-slate-700 bg-slate-100">
                <th className="p-3">{t('الوصف (Désignation)', 'Désignation')}</th>
                <th className="p-3 text-center">{t('المسار (Route)', 'Itinéraire')}</th>
                <th className={`p-3 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('المبلغ الصافي (HT)', 'Montant HT')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              <tr>
                <td className="p-3">{t('خدمات الشحن والنقل الدولي للبضائع', 'Services de transport et fret international de marchandises')}</td>
                <td className="p-3 text-center">{invoice.route || t('شحن دولي', 'Fret International')}</td>
                <td className={`p-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono`}>{ht.toFixed(2)} {currencyStr}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">{t('المبلغ الصافي HT:', 'Montant Net HT :')}</span>
                <span className="font-mono">{ht.toFixed(2)} {currencyStr}</span>
              </div>
              {invoice.tva_rate && (
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('ضريبة القيمة المضافة TVA', 'TVA')} ({invoice.tva_rate}%):</span>
                  <span className="font-mono">{tva.toFixed(2)} {currencyStr}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-300 pt-2 font-bold text-base text-primary">
                <span>{t('المجموع الإجمالي TTC:', 'Total TTC :')}</span>
                <span className="font-mono">{total.toFixed(2)} {currencyStr}</span>
              </div>
            </div>
          </div>

          {invoice.bank_info_text && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-900 mb-6">
              <p className="font-bold mb-1">{t('معلومات التحويل البنكي:', 'Coordonnées Bancaires :')}</p>
              <p>{invoice.bank_info_text}</p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            {t('شكراً لتعاملكم معنا • وثيقة تجارية نظامية صادرة إلكترونياً', 'Merci pour votre confiance • Document commercial officiel généré électroniquement')}
          </div>
        </div>
      </div>
    </div>
  );
}
