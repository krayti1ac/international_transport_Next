'use client';

/**
 * Trans Bodanon TMS — Bank Remittance Bordereau Modal
 * Interactive selection, live Decimal.js discount calculations, and official Moroccan banking remittance generator.
 */

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText,
  Printer,
  X,
  Building2,
  CheckCircle2,
  AlertCircle,
  Percent,
  Coins,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Download,
  Code2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { CommercialBill } from '../types/commercial-bills.types';
import type {
  BordereauType,
  RemittanceBordereau,
  BordereauBillItem,
} from '../types/remittance-bordereau.types';
import { calculateBordereauFinancials } from '../services/remittance-bordereau-pdf.service';
import {
  generateRemittanceBordereauAction,
  exportBordereauEdiAction,
} from '../services/remittance-bordereau.actions';

interface RemittanceBordereauModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBills: CommercialBill[];
  bankAccounts: Array<{ id: number; bank_name?: string; account_number?: string; name?: string }>;
  onSuccess: (bordereau: RemittanceBordereau, html: string) => void;
}

export function RemittanceBordereauModal({
  isOpen,
  onClose,
  selectedBills,
  bankAccounts,
  onSuccess,
}: RemittanceBordereauModalProps) {
  const t = useTranslations('commercialBills');
  const tb = useTranslations('remittanceBordereau');
  const { toast } = useToast();

  const [bordereauType, setBordereauType] = useState<BordereauType>('encaissement');
  const [bankAccountId, setBankAccountId] = useState<number>(bankAccounts[0]?.id || 1);
  const [discountRate, setDiscountRate] = useState<string>('5.50');
  const [bankCommission, setBankCommission] = useState<string>('50.00');
  const [remittanceDate, setRemittanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    bordereau: RemittanceBordereau;
    html: string;
  } | null>(null);

  // Map commercial bills to BordereauBillItem for calculation
  const billItems: BordereauBillItem[] = useMemo(() => {
    return selectedBills.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      billType: b.billType,
      clientName: b.clientName,
      issuerName: b.issuerName,
      drawerBankName: b.drawerBankName || 'Banque',
      drawerBankRib: b.drawerBankRib || '—',
      issueDate: b.issueDate,
      dueDate: b.dueDate,
      faceValue: Number(b.faceValue),
    }));
  }, [selectedBills]);

  // Live financial calculations via Decimal.js
  const liveFinancials = useMemo(() => {
    const rate = parseFloat(discountRate) || 0;
    const comm = parseFloat(bankCommission) || 0;
    return calculateBordereauFinancials(billItems, bordereauType, rate, comm, remittanceDate);
  }, [billItems, bordereauType, discountRate, bankCommission, remittanceDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBills.length === 0) {
      toast({
        title: tb('noBillsSelectedTitle'),
        description: tb('noBillsSelectedDesc'),
        variant: 'destructive',
      });
      return;
    }

    if (!bankAccountId) {
      toast({
        title: tb('noBankSelectedTitle'),
        description: tb('noBankSelectedDesc'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await generateRemittanceBordereauAction({
        bordereauType,
        bankAccountId,
        billIds: selectedBills.map((b) => b.id),
        discountRate: bordereauType === 'escompte' ? parseFloat(discountRate) || 0 : 0,
        bankCommission: bordereauType === 'escompte' ? parseFloat(bankCommission) || 0 : 0,
        remittanceDate,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.bordereau && res.html) {
        setGeneratedResult({ bordereau: res.bordereau, html: res.html });
        onSuccess(res.bordereau, res.html);
        toast({
          title: tb('generationSuccessTitle'),
          description: tb('generationSuccessDesc', { ref: res.bordereau.bordereauNumber }),
        });
      } else {
        toast({
          title: tb('generationErrorTitle'),
          description: res.error || tb('generationErrorDefault'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tb('generationErrorDefault');
      toast({
        title: tb('generationErrorTitle'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!generatedResult) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatedResult.html);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  const handleExportEdi = async (format: 'simt' | 'xml') => {
    if (!generatedResult) return;
    try {
      const res = await exportBordereauEdiAction(
        generatedResult.bordereau.id,
        format,
        generatedResult.bordereau
      );
      if (res.success && res.content && res.filename) {
        const blob = new Blob([res.content], {
          type: res.mimeType || 'text/plain;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: tb('ediExportSuccessTitle'),
          description: tb('ediExportSuccessDesc', { filename: res.filename }),
        });
      } else {
        toast({
          title: tb('generationErrorTitle'),
          description: res.error || tb('generationErrorDefault'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: tb('generationErrorTitle'),
        description: err instanceof Error ? err.message : tb('generationErrorDefault'),
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setGeneratedResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleReset}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  {tb('modalTitle')}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {tb('modalSubtitle')}
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {generatedResult ? (
          /* SUCCESS VIEW WITH PRINT & EDI ACTIONS */
          <div className="py-6 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {tb('bordereauCreatedTitle')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {tb('bordereauCreatedSubtitle')}
              </p>
              <div className="mt-3 inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-full text-blue-700 dark:text-blue-300 font-mono font-bold text-sm">
                {generatedResult.bordereau.bordereauNumber}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-start text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-500">{tb('bankAccountLabel')}:</span>
                <span className="font-semibold">{generatedResult.bordereau.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{tb('billsCountLabel')}:</span>
                <span className="font-semibold">{generatedResult.bordereau.billsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{tb('totalFaceValueLabel')}:</span>
                <span className="font-bold text-blue-600">
                  {generatedResult.bordereau.totalFaceValue.toLocaleString('fr-MA', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  MAD
                </span>
              </div>
              {generatedResult.bordereau.bordereauType === 'escompte' && (
                <div className="flex justify-between text-emerald-600 font-bold border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span>{tb('netProceedsLabel')}:</span>
                  <span>
                    {generatedResult.bordereau.estimatedNetProceeds.toLocaleString('fr-MA', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    MAD
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2.5 pt-2">
              <Button
                onClick={handlePrint}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 font-bold"
              >
                <Printer className="w-4 h-4" />
                {tb('printBordereauButton')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportEdi('simt')}
                className="gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
              >
                <Download className="w-4 h-4" />
                {tb('exportSimtBtn')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportEdi('xml')}
                className="gap-1.5 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold"
              >
                <Code2 className="w-4 h-4" />
                {tb('exportXmlBtn')}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                {tb('closeButton')}
              </Button>
            </div>
          </div>
        ) : (
          /* FORM SUBMISSION VIEW */
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            {/* 1. Bordereau Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                {tb('remittanceTypeLabel')} *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBordereauType('encaissement')}
                  className={`p-3.5 rounded-xl border text-start transition-all ${
                    bordereauType === 'encaissement'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm">{tb('typeEncaissement')}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {tb('typeEncaissementDesc')}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBordereauType('escompte')}
                  className={`p-3.5 rounded-xl border text-start transition-all ${
                    bordereauType === 'escompte'
                      ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm flex items-center justify-between">
                    <span>{tb('typeEscompte')}</span>
                    <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700">
                      360j
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {tb('typeEscompteDesc')}
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Bank Account and Remittance Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {tb('targetBankAccount')} *
                </label>
                <select
                  required
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name || 'Banque'} — {acc.name || acc.account_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {tb('remittanceDate')} *
                </label>
                <input
                  type="date"
                  required
                  value={remittanceDate}
                  onChange={(e) => setRemittanceDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium"
                >
                </input>
              </div>
            </div>

            {/* 3. Discount Parameters (Only if Escompte) */}
            {bordereauType === 'escompte' && (
              <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-800 dark:text-purple-300">
                  <Percent className="w-4 h-4" />
                  {tb('discountParametersTitle')}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {tb('discountRatePercent')} (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountRate}
                      onChange={(e) => setDiscountRate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {tb('bankCommissionFixed')} (MAD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bankCommission}
                      onChange={(e) => setBankCommission(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Selected Bills Summary & Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {tb('selectedBillsList')} ({selectedBills.length})
                </label>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                  Total: {liveFinancials.totalFaceValue.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[11px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3 text-start">{t('billNumberLabel')}</th>
                      <th className="py-2 px-3 text-start">{t('clientLabel')}</th>
                      <th className="py-2 px-3 text-start">{t('drawerBankLabel')}</th>
                      <th className="py-2 px-3 text-start">{t('dueDateLabel')}</th>
                      <th className="py-2 px-3 text-end">{t('nominalAmountLabel')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {bill.billNumber}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[140px]">{bill.clientName}</td>
                        <td className="py-2 px-3 text-slate-500">{bill.drawerBankName || '—'}</td>
                        <td className="py-2 px-3 font-semibold">{bill.dueDate}</td>
                        <td className="py-2 px-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                          {bill.faceValue.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Live Financial Totals Breakdown */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{tb('totalGrossNominal')}:</span>
                <span className="font-mono font-bold">
                  {liveFinancials.totalFaceValue.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </span>
              </div>
              {bordereauType === 'escompte' && (
                <>
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>{tb('estimatedAgiosHT')}:</span>
                    <span className="font-mono">
                      -{liveFinancials.estimatedAgios.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>{tb('estimatedBankVAT')} (10%):</span>
                    <span className="font-mono">
                      -{liveFinancials.estimatedVat.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-200 dark:border-slate-700 pt-1.5 text-sm">
                    <span>{tb('netExpectedLiquidity')}:</span>
                    <span className="font-mono">
                      {liveFinancials.estimatedNetProceeds.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Submit & Cancel */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleReset} disabled={isSubmitting}>
                {tb('cancelButton')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || selectedBills.length === 0}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <ShieldCheck className="w-4 h-4" />
                {isSubmitting ? tb('submittingButton') : tb('generateSubmitButton')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

