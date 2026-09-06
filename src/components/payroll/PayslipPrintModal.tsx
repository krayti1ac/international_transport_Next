'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import type { Driver, TripOrder, Advance, FinePenalty } from '@/types/database';
import { formatCurrency } from '@/lib/forex';

import { useLanguage } from '@/components/language-provider';

interface PayslipPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver;
  trips: TripOrder[];
  advances: Advance[];
  fines: FinePenalty[];
  baseSalary: number;
  bonusPercentage: number;
  totalBonus: number;
  totalAdvances: number;
  totalFines: number;
  netPay: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  paymentDate?: string;
}

export function PayslipPrintModal({
  isOpen,
  onClose,
  driver,
  trips,
  advances,
  fines,
  baseSalary,
  bonusPercentage,
  totalBonus,
  totalAdvances,
  totalFines,
  netPay,
  currency,
  periodStart,
  periodEnd,
  paymentDate,
}: PayslipPrintModalProps) {
  const { t, dir, locale } = useLanguage();
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const periodLabel = new Date(periodStart).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-MA', {
    month: 'long',
    year: 'numeric',
  });

  const paymentLabel = paymentDate
    ? new Date(paymentDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-MA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-MA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto" dir={dir}>
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-3xl w-full my-8 flex flex-col max-h-[90vh]">
        {/* Header Controls */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden" data-print-hidden>
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            {t('طباعة / تحميل PDF', 'Imprimer / Télécharger PDF')}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Printable Area */}
        <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible" ref={printAreaRef} data-print-p-0 data-print-overflow-visible>
          <div className="border-2 border-slate-900 p-6 text-sm leading-relaxed font-sans" dir={dir}>
            {/* Company Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
              <h1 className="text-2xl font-black tracking-wider text-slate-900 font-amiri">
                TRANS BODANON
              </h1>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {t('خدمات النقل الدولي واللوجستيات', 'INTERNATIONAL LOGISTICS & TRANSPORT')}
              </p>
              <p className="text-xs text-slate-600">
                {t('ميناء طنجة المتوسط، المغرب | contact@transbodanon.com', 'Tanger Med, Maroc | contact@transbodanon.com')}
              </p>
            </div>

            {/* Document Title */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-2 inline-block">
                {locale === 'fr' ? 'Fiche de Paie / Payslip' : 'قسيمة الراتب / Fiche de Paie'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {t('الفترة: ', 'Période : ')}{periodLabel}
              </p>
            </div>

            {/* Driver Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-slate-800 p-3">
                <span className="font-bold text-[10px] text-slate-500 uppercase block mb-2">
                  {t('بيانات السائق / Employé', 'Informations Conducteur / Employé')}
                </span>
                <p className="font-bold text-base">{driver.name}</p>
                <p className="text-xs text-slate-600">{t('رقم الرخصة: ', 'Permis : ')}{driver.license}</p>
                <p className="text-xs text-slate-600">{t('الهاتف: ', 'Tél : ')}{driver.phone}</p>
                {driver.visa_number && (
                  <p className="text-xs text-slate-600">{t('التأشيرة: ', 'Visa : ')}{driver.visa_number}</p>
                )}
              </div>
              <div className="border border-slate-800 p-3">
                <span className="font-bold text-[10px] text-slate-500 uppercase block mb-2">
                  {t('تفاصيل الصرف / Paiement', 'Détails du Paiement')}
                </span>
                <p className="text-xs text-slate-600">
                  <span className="font-medium">{t('بداية الفترة: ', 'Début période : ')}</span>{new Date(periodStart).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-MA')}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-medium">{t('نهاية الفترة: ', 'Fin période : ')}</span>{new Date(periodEnd).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-MA')}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-medium">{t('تاريخ الصرف: ', 'Date de paiement : ')}</span>{paymentLabel}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-medium">{t('العملة: ', 'Devise : ')}</span>{currency}
                </p>
              </div>
            </div>

            {/* Salary Breakdown */}
            <div className="border border-slate-800 mb-6">
              <div className="bg-slate-100 p-2 border-b border-slate-300">
                <span className="font-bold text-xs text-slate-700 uppercase">
                  {t('تفاصيل الراتب / Détail de Paie', 'Salary Breakdown / Détail de Paie')}
                </span>
              </div>
              <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600 text-xs">
                    <th className="p-2 w-8">#</th>
                    <th className="p-2">{t('الوصف / Description', 'Description')}</th>
                    <th className={`p-2 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('المبلغ / Montant', 'Amount')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-mono">1</td>
                    <td className="p-2">
                      <span className="font-medium">{t('الراتب الأساسي', 'Salaire de base')}</span>
                      <br />
                      <span className="text-slate-500">{t('Base Salary / Salaire de base', 'Base Salary')}</span>
                    </td>
                    <td className={`p-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono font-bold`}>
                      {formatCurrency(baseSalary, currency)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-2 font-mono">2</td>
                    <td className="p-2">
                      <span className="font-medium">{t('عمولات الرحلات', 'Primes sur trajets')} ({bonusPercentage}%)</span>
                      <br />
                      <span className="text-slate-500"> {t(`مكافأة (${trips.length} رحلة)`, `Primes sur trajets (${trips.length} trajets)`)}</span>
                    </td>
                    <td className={`p-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono font-bold text-emerald-700`}>
                      +{formatCurrency(totalBonus, currency)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-mono">3</td>
                    <td className="p-2">
                      <span className="font-medium">{t('اقتطاع السلف', 'Avances et retenues')}</span>
                      <br />
                      <span className="text-slate-500"> {t(`السلف المسددة (${advances.length})`, `Avances déduites (${advances.length})`)}</span>
                    </td>
                    <td className={`p-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono font-bold text-rose-700`}>
                      -{formatCurrency(totalAdvances, currency)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-2 font-mono">4</td>
                    <td className="p-2">
                      <span className="font-medium">{t('المخالفات والغرامات', 'Amendes et pénalités')}</span>
                      <br />
                      <span className="text-slate-500"> {t(`الغرامات المقتطعة (${fines.length})`, `Pénalités appliquées (${fines.length})`)}</span>
                    </td>
                    <td className={`p-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono font-bold text-rose-700`}>
                      -{formatCurrency(totalFines, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Trips Detail */}
            {trips.length > 0 && (
              <div className="border border-slate-800 mb-6">
                <div className="bg-slate-100 p-2 border-b border-slate-300">
                  <span className="font-bold text-xs text-slate-700 uppercase">
                    {t('الرحلات المساهمة في المكافأة / Trajets de la période', 'Trips Contributing to Bonus / Trajets de la période')}
                  </span>
                </div>
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse text-xs`}>
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600">
                      <th className="p-2">{t('رقم الرحلة', 'Trip ID')}</th>
                      <th className="p-2">{t('المسار', 'Route')}</th>
                      <th className="p-2">{t('التاريخ', 'Date')}</th>
                      <th className="p-2">{t('الحالة', 'Status')}</th>
                      <th className={`p-2 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('الإيراد', 'Revenu')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip, idx) => (
                      <tr key={trip.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2 font-mono">#{trip.id}</td>
                        <td className="p-2">{trip.route}</td>
                        <td className="p-2">{trip.departure_date}</td>
                        <td className="p-2 capitalize">
                          {trip.status === 'completed' ? t('مكتملة', 'Terminé') : trip.status}
                        </td>
                        <td className={`p-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono`}>
                          {formatCurrency(trip.price, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Net Pay */}
            <div className="border-2 border-slate-900 p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <p className="font-bold text-lg">{t('صافي الراتب المستحق / Salaire Net', 'Net Salary / Salaire Net')}</p>
                <p className="text-xs text-slate-300">
                  {t('الأساسي + المكافآت - السلف - الغرامات', 'Base + Primes - Avances - Pénalités')}
                </p>
              </div>
              <div className="text-2xl font-mono font-black">
                {formatCurrency(netPay, currency)}
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-4 mt-6 border border-slate-800 p-3">
              <div className="border-r border-slate-300 pr-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">
                  {t('توقيع المشغل / Employeur', 'Signature Employeur')}
                </span>
                <div className="h-12 mt-2 border-b border-dashed border-slate-300"></div>
              </div>
              <div className="border-r border-slate-300 px-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">
                  {t('توقيع السائق / Chauffeur', 'Signature Chauffeur')}
                </span>
                <div className="h-12 mt-2 border-b border-dashed border-slate-300"></div>
              </div>
              <div className="pl-2">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">
                  {t('التاريخ والختم / Cachet', 'Date & Cachet')}
                </span>
                <div className="h-12 mt-2 border-b border-dashed border-slate-300"></div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-4 text-[10px] text-slate-400">
              <p>{t('شركة ترانس بودانون للنقل الدولي | ميناء طنجة المتوسط، المغرب', 'Trans Bodanon International Logistics | Tanger Med, Morocco')}</p>
              <p>{t('هذه الوثيقة مستخرجة آلياً ولا تتطلب توقيعاً يدوياً لأغراض المعالجة المحاسبية', 'Ce document est généré automatiquement pour le traitement de la paie.')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
