'use client';

/**
 * Trans Bodanon TMS — Automated Credit Note & General Ledger Reconciliation Modal
 * Accounting Standards: Moroccan PCM / Article 92-I-10° CGI / IFRS 15
 */

import React, { useState, useTransition, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Building,
  RefreshCw,
  Layers,
  Scale,
} from 'lucide-react';
import type { ReeferCargoInsuranceClaim } from '../types/reefer-claim-settlement.types';
import type {
  CreditNoteReason,
  ClaimReconciliationDetails,
} from '../types/claim-reconciliation.types';
import {
  calculateCreditNoteFinancials,
  generateDoubleEntryLedger,
} from '../services/claim-ledger.math';
import {
  reconcileClaimCreditNoteAction,
  rollbackClaimSettlementAction,
  getClaimReconciliationDetailsAction,
} from '../services/claim-ledger.actions';

interface ClaimCreditNoteModalProps {
  claim: ReeferCargoInsuranceClaim;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (details: ClaimReconciliationDetails) => void;
}

export function ClaimCreditNoteModal({
  claim,
  isOpen,
  onClose,
  onSuccess,
}: ClaimCreditNoteModalProps) {
  const t = useTranslations('claimReconciliation');
  const tCommon = useTranslations('common');
  const { dir } = useLanguage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form Fields
  const [clientName, setClientName] = useState<string>('Maroc Primeurs Export S.A.');
  const [creditNoteNumber, setCreditNoteNumber] = useState<string>(
    claim.creditNoteNumber || `AV-2026-${claim.tripId}-01`
  );
  const [originalInvoiceNumber, setOriginalInvoiceNumber] = useState<string>(
    `INV-2026-${claim.tripId}`
  );
  const [reason, setReason] = useState<CreditNoteReason>('cargo_thermal_excursion');
  const [tvaRatePct, setTvaRatePct] = useState<number>(0); // 0% default for Article 92-I-10°
  const [isTaxExempt, setIsTaxExempt] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>(
    'Exonération de TVA en vertu de l’article 92-I-10° du CGI (Transport International)'
  );

  // Rollback confirmation
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<boolean>(false);
  const [rollbackReason, setRollbackReason] = useState<string>('');

  // Result state
  const [reconciledDetails, setReconciledDetails] = useState<ClaimReconciliationDetails | null>(
    null
  );

  // Initial fetch if already settled
  React.useEffect(() => {
    if (claim.claimStatus === 'settled' && isOpen) {
      getClaimReconciliationDetailsAction(claim.id).then((res) => {
        if (res.success && res.data) {
          setReconciledDetails(res.data);
        }
      });
    }
  }, [claim.id, claim.claimStatus, isOpen]);

  // Live financial figures
  const financials = useMemo(() => {
    return calculateCreditNoteFinancials({
      netClaimAmount: claim.netIndemnityAmount,
      tvaRatePct,
      isTaxExempt,
    });
  }, [claim.netIndemnityAmount, tvaRatePct, isTaxExempt]);

  // Live double-entry ledger preview
  const ledgerPreview = useMemo(() => {
    return generateDoubleEntryLedger({
      creditNoteNumber,
      claimReference: claim.claimReference,
      clientName,
      currency: claim.currency,
      htAmount: financials.htAmount,
      tvaAmount: financials.tvaAmount,
      ttcAmount: financials.ttcAmount,
      insurerName: claim.insurerName,
      policyNumber: claim.policyNumber,
    });
  }, [creditNoteNumber, claim, clientName, financials]);

  if (!isOpen) return null;

  const handleConfirmReconciliation = () => {
    startTransition(async () => {
      const res = await reconcileClaimCreditNoteAction({
        claimId: claim.id,
        claimReference: claim.claimReference,
        tripId: claim.tripId,
        tripNumber: claim.tripNumber,
        clientId: 1,
        clientName,
        originalInvoiceNumber: originalInvoiceNumber || undefined,
        creditNoteNumber,
        reason,
        netClaimAmount: claim.netIndemnityAmount,
        currency: claim.currency,
        tvaRatePct,
        isTaxExempt,
        notes: notes || undefined,
        insurerName: claim.insurerName,
        policyNumber: claim.policyNumber,
      });

      if (res.success && res.data) {
        setReconciledDetails(res.data);
        toast({
          title: t('reconcileSuccessTitle'),
          description: t('reconcileSuccessDesc'),
        });
        if (onSuccess) onSuccess(res.data);
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || t('reconcileFailedDesc'),
          variant: 'destructive',
        });
      }
    });
  };

  const handleRollback = () => {
    if (!rollbackReason.trim()) {
      toast({
        title: tCommon('error'),
        description: t('rollbackReasonRequired'),
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const res = await rollbackClaimSettlementAction({
        claimId: claim.id,
        creditNoteNumber,
        reason: rollbackReason,
      });

      if (res.success) {
        setReconciledDetails(null);
        setShowRollbackConfirm(false);
        toast({
          title: t('rollbackSuccessTitle'),
          description: t('rollbackSuccessDesc'),
        });
        onClose();
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || t('rollbackFailedDesc'),
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        dir={dir}
        className="bg-background border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                {t('modalTitle')}
                <Badge variant="outline" className="font-mono text-xs">
                  {claim.claimReference}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">{t('modalSubtitle')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full hover:bg-muted"
          >
            ✕
          </Button>
        </div>

        {/* Claim Summary Strip */}
        <div className="p-3.5 rounded-xl border bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('tripLabel')}</span>
            <span className="font-semibold text-foreground">{claim.tripNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('clientLabel')}</span>
            <span className="font-semibold text-foreground">{clientName}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('netIndemnityLabel')}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
              {claim.netIndemnityAmount.toLocaleString()} {claim.currency}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('statusLabel')}</span>
            <Badge
              variant={claim.claimStatus === 'settled' ? 'default' : 'outline'}
              className="text-[10px]"
            >
              {claim.claimStatus === 'settled' ? t('settledBadge') : t('pendingReconciliationBadge')}
            </Badge>
          </div>
        </div>

        {/* Existing / Reconciled View */}
        {reconciledDetails && !showRollbackConfirm ? (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5" />
                <span>{t('reconciliationPostedTitle')}</span>
              </div>
              <Badge className="bg-emerald-600 font-mono text-xs">
                {reconciledDetails.creditNoteNumber}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-background/80 p-3 rounded-lg border">
              <div>
                <span className="text-muted-foreground">{t('creditNoteTotalLabel')}:</span>
                <span className="font-bold text-foreground font-mono block text-sm">
                  {reconciledDetails.ttcAmount.toLocaleString()} {reconciledDetails.currency}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('postedAtLabel')}:</span>
                <span className="text-foreground block font-mono text-[11px]">
                  {new Date(reconciledDetails.reconciledAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* General Ledger Preview */}
            <div className="space-y-1.5">
              <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                <Scale className="h-4 w-4 text-primary" />
                {t('ledgerEntriesTitle')} (PCM)
              </span>
              <div className="rounded-lg border overflow-hidden bg-background text-[11px]">
                <table className="w-full text-start border-collapse">
                  <thead className="bg-muted/40 font-semibold border-b">
                    <tr>
                      <th className="p-2 text-start">{t('accountCol')}</th>
                      <th className="p-2 text-start">{t('descCol')}</th>
                      <th className="p-2 text-end">{t('debitCol')}</th>
                      <th className="p-2 text-end">{t('creditCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {reconciledDetails.ledgerEntries.map((e) => (
                      <tr key={e.entryNumber}>
                        <td className="p-2 font-bold text-primary">{e.accountCode}</td>
                        <td className="p-2 text-muted-foreground font-sans truncate max-w-[180px]">
                          {e.description}
                        </td>
                        <td className="p-2 text-end text-emerald-600">
                          {e.debit > 0 ? `${e.debit.toLocaleString()} MAD` : '-'}
                        </td>
                        <td className="p-2 text-end text-blue-600">
                          {e.credit > 0 ? `${e.credit.toLocaleString()} MAD` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-emerald-500/20">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRollbackConfirm(true)}
                className="text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('rollbackBtn')}
              </Button>
              <Button size="sm" onClick={onClose} className="text-xs">
                {tCommon('close')}
              </Button>
            </div>
          </div>
        ) : showRollbackConfirm ? (
          /* Rollback Prompt */
          <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-destructive font-bold text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{t('rollbackConfirmTitle')}</span>
            </div>
            <p className="text-muted-foreground">{t('rollbackConfirmDesc')}</p>
            <div>
              <label className="font-medium block mb-1">{t('rollbackReasonLabel')}</label>
              <Input
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder={t('rollbackReasonPlaceholder')}
                className="text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRollbackConfirm(false)}
                className="text-xs"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRollback}
                disabled={isPending}
                className="text-xs gap-1"
              >
                {isPending && <RefreshCw className="h-3 w-3 animate-spin" />}
                {t('confirmRollbackBtn')}
              </Button>
            </div>
          </div>
        ) : (
          /* Form Controls */
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-medium block mb-1 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('clientNameLabel')}
                </label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium block mb-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('creditNoteNumberLabel')}
                </label>
                <Input
                  value={creditNoteNumber}
                  onChange={(e) => setCreditNoteNumber(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">{t('originalInvoiceLabel')}</label>
                <Input
                  value={originalInvoiceNumber}
                  onChange={(e) => setOriginalInvoiceNumber(e.target.value)}
                  placeholder="INV-2026-..."
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">{t('reasonLabel')}</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as CreditNoteReason)}
                  className="w-full p-2 border rounded-lg bg-background text-xs"
                >
                  <option value="cargo_thermal_excursion">{t('reasonExcursion')}</option>
                  <option value="dock_door_prolonged_exposure">{t('reasonDockExposure')}</option>
                  <option value="total_cargo_spoilage">{t('reasonTotalLoss')}</option>
                  <option value="commercial_goodwill_rebate">{t('reasonCommercialRebate')}</option>
                </select>
              </div>
            </div>

            {/* Tax Exemption & TVA Options */}
            <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">
                  {t('taxRegimeTitle')}
                </span>
                <Badge variant="outline" className="text-[10px] text-emerald-600">
                  Article 92-I-10° CGI
                </Badge>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="tvaGroup"
                    checked={isTaxExempt}
                    onChange={() => {
                      setIsTaxExempt(true);
                      setTvaRatePct(0);
                    }}
                    className="text-primary"
                  />
                  <span>{t('exempt0Pct')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="tvaGroup"
                    checked={!isTaxExempt}
                    onChange={() => {
                      setIsTaxExempt(false);
                      setTvaRatePct(20);
                    }}
                    className="text-primary"
                  />
                  <span>{t('standard20Pct')}</span>
                </label>
              </div>
            </div>

            {/* Real-time Financial Breakdown */}
            <div className="p-3.5 rounded-lg border bg-muted/20 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">{t('montantHt')}:</span>
                <span className="font-bold text-foreground">
                  {financials.htAmount.toLocaleString()} {claim.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">{t('montantTva')} ({tvaRatePct}%):</span>
                <span>{financials.tvaAmount.toLocaleString()} {claim.currency}</span>
              </div>
              <div className="flex justify-between pt-1 border-t font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                <span className="font-sans">{t('totalCreditNoteTtc')}:</span>
                <span>{financials.ttcAmount.toLocaleString()} {claim.currency}</span>
              </div>
            </div>

            {/* Dual-Entry Accounting Simulation */}
            <div className="space-y-1.5">
              <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                <Scale className="h-3.5 w-3.5 text-primary" />
                {t('ledgerPreviewTitle')}
              </span>
              <div className="rounded-lg border overflow-hidden bg-background text-[11px]">
                <table className="w-full text-start border-collapse">
                  <thead className="bg-muted/40 font-semibold border-b">
                    <tr>
                      <th className="p-2 text-start">{t('accountCol')}</th>
                      <th className="p-2 text-start">{t('descCol')}</th>
                      <th className="p-2 text-end">{t('debitCol')}</th>
                      <th className="p-2 text-end">{t('creditCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {ledgerPreview.ledgerEntries.map((e) => (
                      <tr key={e.entryNumber}>
                        <td className="p-2 font-bold text-primary">{e.accountCode}</td>
                        <td className="p-2 text-muted-foreground font-sans truncate max-w-[180px]">
                          {e.description}
                        </td>
                        <td className="p-2 text-end text-emerald-600">
                          {e.debit > 0 ? `${e.debit.toLocaleString()} MAD` : '-'}
                        </td>
                        <td className="p-2 text-end text-blue-600">
                          {e.credit > 0 ? `${e.credit.toLocaleString()} MAD` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                {tCommon('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmReconciliation}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                {isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Receipt className="h-3.5 w-3.5" />
                )}
                {t('confirmReconciliationBtn')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

