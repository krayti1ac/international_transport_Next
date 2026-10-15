'use client';

/**
 * Trans Bodanon TMS — New Commercial Bill / LCN Registration Modal
 * Trilingual form for checks, promissory notes, and bills of exchange with bank details.
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  User,
  Loader2,
  PlusCircle,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { BillType, CommercialBill } from '../types/commercial-bills.types';
import { createCommercialBillAction } from '../services/commercial-bills.actions';

interface NewCommercialBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBill: CommercialBill) => void;
}

const MOROCCAN_BANKS = [
  'Attijariwafa bank',
  'Banque Populaire (BCP)',
  'Bank of Africa (BMCE)',
  'CIH Bank',
  'Société Générale Maroc (SGMB)',
  'Crédit du Maroc (CDM)',
  'Crédit Agricole du Maroc (CAM)',
  'Al Barid Bank',
  'CFG Bank',
  'Autre banque internationale',
];

export function NewCommercialBillModal({
  isOpen,
  onClose,
  onSuccess,
}: NewCommercialBillModalProps) {
  const t = useTranslations('commercialBills');
  const [isPending, startTransition] = useTransition();

  const [billType, setBillType] = useState<BillType>('lcn_promissory_note');
  const [billNumber, setBillNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [issuerName, setIssuerName] = useState('');
  const [faceValue, setFaceValue] = useState<number | ''>('');
  const [currency, setCurrency] = useState('MAD');
  const [drawerBankName, setDrawerBankName] = useState(MOROCCAN_BANKS[0]);
  const [drawerBankRib, setDrawerBankRib] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billNumber.trim() || !clientName.trim() || !faceValue || Number(faceValue) <= 0 || !dueDate) {
      setErrorMsg(t('fillRequiredFields'));
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await createCommercialBillAction({
        billType,
        billNumber: billNumber.trim(),
        clientName: clientName.trim(),
        issuerName: issuerName.trim() || clientName.trim(),
        faceValue: Number(faceValue),
        currency,
        drawerBankName,
        drawerBankRib: drawerBankRib.trim() || null,
        issueDate,
        dueDate,
        notes: notes.trim() || null,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || t('createBillError'));
        return;
      }

      onSuccess(res.data);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('registerBillModalTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('registerBillModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Bill Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              {t('billTypeLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBillType('lcn_promissory_note')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition ${
                  billType === 'lcn_promissory_note'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('typeLcn')}
              </button>
              <button
                type="button"
                onClick={() => setBillType('cheque')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition ${
                  billType === 'cheque'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('typeCheque')}
              </button>
              <button
                type="button"
                onClick={() => setBillType('traite')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition ${
                  billType === 'traite'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('typeTraite')}
              </button>
            </div>
          </div>

          {/* Row 1: Bill Number & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('billNumberLabel')} *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. LCN-2026-8801 or 0894521"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('faceValueLabel')} *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={faceValue}
                  onChange={(e) => setFaceValue(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-bold font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Client & Issuer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('clientNameLabel')} *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Agro Export Souss"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('issuerNameLabel')}
              </label>
              <input
                type="text"
                placeholder={t('issuerPlaceholder')}
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Row 3: Bank & RIB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('drawerBankLabel')}
              </label>
              <select
                value={drawerBankName}
                onChange={(e) => setDrawerBankName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                {MOROCCAN_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('drawerRibLabel')} (RIB 24 chiffres)
              </label>
              <input
                type="text"
                maxLength={34}
                placeholder="e.g. 011 780 0000123456789012 34"
                value={drawerBankRib}
                onChange={(e) => setDrawerBankRib(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Row 4: Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('issueDateLabel')}
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t('dueDateLabel')} * (Date d&apos;échéance)
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {t('notesLabel')}
            </label>
            <textarea
              rows={2}
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('savingBill')}</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('saveBillBtn')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
