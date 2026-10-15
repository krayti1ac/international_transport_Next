'use client';

/**
 * Trans Bodanon TMS — Commercial Bill Lifecycle Action Modal
 * Handles Bank Remittance, Real Value Clearing (FIFO), and Unpaid Rejections.
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  Send,
  CheckCircle,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import type { CommercialBill } from '../types/commercial-bills.types';
import {
  remitCommercialBillAction,
  clearCommercialBillAction,
  bounceCommercialBillAction,
} from '../services/commercial-bills.actions';

interface BillLifecycleModalProps {
  bill: CommercialBill;
  actionType: 'remit' | 'clear' | 'bounce';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedBill: CommercialBill) => void;
  bankAccounts?: Array<{ id: number; bank_name?: string; account_number?: string }>;
}

export function BillLifecycleModal({
  bill,
  actionType,
  isOpen,
  onClose,
  onSuccess,
  bankAccounts = [],
}: BillLifecycleModalProps) {
  const t = useTranslations('commercialBills');
  const [isPending, startTransition] = useTransition();

  // Remit state
  const [operationType, setOperationType] = useState<'collection' | 'discount'>('collection');
  const [remittanceReference, setRemittanceReference] = useState(
    () => `BORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`
  );
  const [bankAccountId, setBankAccountId] = useState<number | ''>(
    bankAccounts[0]?.id || ''
  );
  const [discountFee, setDiscountFee] = useState<number | ''>(0);

  // Clear state
  const [clearedDate, setClearedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [clearedAmount, setClearedAmount] = useState<number>(bill.faceValue);
  const [triggerFifoAllocation, setTriggerFifoAllocation] = useState(true);

  // Bounce state
  const [bounceDate, setBounceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bounceReason, setBounceReason] = useState('Défaut de provision (Sans provision)');
  const [bounceFee, setBounceFee] = useState<number | ''>(150); // Typical rejection fee

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      if (actionType === 'remit') {
        const res = await remitCommercialBillAction({
          billId: bill.id,
          operationType,
          remittanceReference: remittanceReference.trim(),
          bankAccountId: typeof bankAccountId === 'number' ? bankAccountId : null,
          discountFee: Number(discountFee) || 0,
        });
        if (res.success && res.data) {
          onSuccess(res.data);
          onClose();
        } else {
          setErrorMsg(res.error || t('remitError'));
        }
      } else if (actionType === 'clear') {
        const res = await clearCommercialBillAction({
          billId: bill.id,
          clearedDate,
          clearedAmount: Number(clearedAmount) || bill.faceValue,
          bankAccountId: typeof bankAccountId === 'number' ? bankAccountId : null,
          triggerFifoAllocation,
        });
        if (res.success && res.data) {
          onSuccess(res.data);
          onClose();
        } else {
          setErrorMsg(res.error || t('clearError'));
        }
      } else if (actionType === 'bounce') {
        const res = await bounceCommercialBillAction({
          billId: bill.id,
          bounceDate,
          bounceReason: bounceReason.trim(),
          bounceFee: Number(bounceFee) || 0,
          reverseSettlement: true,
        });
        if (res.success && res.data) {
          onSuccess(res.data);
          onClose();
        } else {
          setErrorMsg(res.error || t('bounceError'));
        }
      }
    });
  };

  const getTitle = () => {
    switch (actionType) {
      case 'remit':
        return t('remitModalTitle');
      case 'clear':
        return t('clearModalTitle');
      case 'bounce':
        return t('bounceModalTitle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                actionType === 'remit'
                  ? 'bg-blue-600/10 text-blue-600'
                  : actionType === 'clear'
                  ? 'bg-emerald-600/10 text-emerald-600'
                  : 'bg-rose-600/10 text-rose-600'
              }`}
            >
              {actionType === 'remit' && <Send className="w-5 h-5" />}
              {actionType === 'clear' && <CheckCircle className="w-5 h-5" />}
              {actionType === 'bounce' && <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{getTitle()}</h3>
              <p className="text-xs text-slate-500 font-mono">
                {bill.billType.toUpperCase()} #{bill.billNumber} — {bill.faceValue.toLocaleString()}{' '}
                {bill.currency}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900">
              {errorMsg}
            </div>
          )}

          {/* Action-Specific Form Fields */}
          {actionType === 'remit' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {t('remitTypeLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperationType('collection')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition ${
                      operationType === 'collection'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t('remitForCollection')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationType('discount')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition ${
                      operationType === 'discount'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t('remitForDiscount')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {t('remittanceRefLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={remittanceReference}
                  onChange={(e) => setRemittanceReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>

              {operationType === 'discount' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('discountFeeLabel')} ({bill.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountFee}
                    onChange={(e) =>
                      setDiscountFee(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}
            </>
          )}

          {actionType === 'clear' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('clearedDateLabel')}
                  </label>
                  <input
                    type="date"
                    required
                    value={clearedDate}
                    onChange={(e) => setClearedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('clearedAmountLabel')} ({bill.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={clearedAmount}
                    onChange={(e) => setClearedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-emerald-300 text-emerald-700"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerFifoAllocation}
                    onChange={(e) => setTriggerFifoAllocation(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>{t('triggerFifoAllocationHint')}</span>
                </label>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 ms-5">
                  {t('fifoExplanation')}
                </p>
              </div>
            </>
          )}

          {actionType === 'bounce' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('bounceDateLabel')}
                  </label>
                  <input
                    type="date"
                    required
                    value={bounceDate}
                    onChange={(e) => setBounceDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t('bounceFeeLabel')} ({bill.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bounceFee}
                    onChange={(e) =>
                      setBounceFee(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-xs font-bold font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-rose-300 text-rose-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {t('bounceReasonLabel')} *
                </label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                >
                  <option value="Défaut de provision (Sans provision)">Défaut de provision (Sans provision)</option>
                  <option value="Signature non conforme ou manquante">Signature non conforme ou manquante</option>
                  <option value="Opposition pour perte ou vol">Opposition pour perte ou vol</option>
                  <option value="Compte clôturé ou bloqué">Compte clôturé ou bloqué</option>
                  <option value="Vices de forme / Date expirée">Vices de forme / Date expirée</option>
                  <option value="Autre motif">Autre motif</option>
                </select>
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
                ⚠️ {t('bounceWarning')}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition ${
                actionType === 'remit'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : actionType === 'clear'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('processing')}</span>
                </>
              ) : (
                <span>{t('confirmActionBtn')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

