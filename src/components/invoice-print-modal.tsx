'use client';

import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import type { Invoice, Client } from '@/types/database';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  client?: Client;
}

export function InvoicePrintModal({ isOpen, onClose, invoice, client }: InvoiceModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const ht = parseFloat(invoice.ht_amount || invoice.total_amount || '0');
  const tva = parseFloat(invoice.tva_amount || '0');
  const total = parseFloat(invoice.ttc_amount || invoice.total_amount || '0');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-3xl w-full my-8 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden" data-print-hidden>
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            طباعة الفاتورة / حفظ PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible" dir="rtl" data-print-p-0 data-print-overflow-visible>
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div>
              <h2 className="text-2xl font-bold font-amiri text-primary">شركة النقل الدولي السريع</h2>
              <p className="text-xs text-slate-500 mt-1">خدمات النقل الدولي واللوجستيات عبر القارات</p>
              <p className="text-xs text-slate-500">المملكة المغربية</p>
            </div>
            <div className="text-left" dir="ltr">
              <h1 className="text-2xl font-black text-slate-800">FACTURE / فاتورة</h1>
              <p className="text-sm font-mono font-bold text-slate-600 mt-1">N°: {invoice.invoice_number || `INV-${invoice.id}`}</p>
              <p className="text-xs text-slate-500">Date: {invoice.issue_date || new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6 text-sm">
            <div>
              <h3 className="font-bold text-slate-700 mb-2">بيانات العميل (Client):</h3>
              <p className="font-semibold text-slate-900">{client?.name || `عميل #${invoice.client_id}`}</p>
              {client?.ice && <p className="text-slate-600">ICE: {client.ice}</p>}
              <p className="text-slate-600">{client?.address || client?.city || 'المغرب'}</p>
              <p className="text-slate-600">{client?.phone}</p>
            </div>
            <div className="text-left" dir="ltr">
              <h3 className="font-bold text-slate-700 mb-2">Payment Details:</h3>
              <p><span className="text-slate-500">Due Date:</span> {invoice.due_date || 'Upon Receipt'}</p>
              <p><span className="text-slate-500">Currency:</span> {invoice.currency || 'MAD'}</p>
              <p><span className="text-slate-500">Status:</span> <span className="font-bold uppercase">{invoice.status}</span></p>
            </div>
          </div>

          <table className="w-full text-right border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-slate-300 text-sm text-slate-700 bg-slate-100">
                <th className="p-3">الوصف (Désignation)</th>
                <th className="p-3 text-center">المسار (Route)</th>
                <th className="p-3 text-left">المبلغ الصافي (HT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              <tr>
                <td className="p-3">خدمات الشحن والنقل الدولي للبضائع</td>
                <td className="p-3 text-center">{invoice.route || 'شحن دولي'}</td>
                <td className="p-3 text-left font-mono">{ht.toFixed(2)} {invoice.currency}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">المبلغ الإجمالي HT:</span>
                <span className="font-mono">{ht.toFixed(2)} {invoice.currency}</span>
              </div>
              {invoice.tva_rate && (
                <div className="flex justify-between">
                  <span className="text-slate-600">الضريبة TVA ({invoice.tva_rate}%):</span>
                  <span className="font-mono">{tva.toFixed(2)} {invoice.currency}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-300 pt-2 font-bold text-base text-primary">
                <span>المجموع الإجمالي TTC:</span>
                <span className="font-mono">{total.toFixed(2)} {invoice.currency}</span>
              </div>
            </div>
          </div>

          {invoice.bank_info_text && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-900 mb-6">
              <p className="font-bold mb-1">معلومات التحويل البنكي:</p>
              <p>{invoice.bank_info_text}</p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            شكراً لتعاملكم معنا • وثيقة تجارية نظامية صادرة إلكترونياً
          </div>
        </div>
      </div>
    </div>
  );
}
