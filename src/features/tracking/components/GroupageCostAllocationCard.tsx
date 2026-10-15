'use client';

/**
 * Trans Bodanon TMS — Groupage Cost Allocation & Split-Billing Card
 * Visualizes consignment profitability, allocated operating costs, and batch invoicing.
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileText,
  Ship,
  Fuel,
  Receipt,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type {
  GroupageTripPnlSummary,
  CostAllocationMode,
} from '../types/groupage-split-billing.types';
import {
  allocateGroupageCostsAction,
  generateConsignmentInvoicesAction,
} from '../services/groupage-split-billing.actions';

interface GroupageCostAllocationCardProps {
  tripId: number;
  initialSummary?: GroupageTripPnlSummary | null;
  onRefresh?: () => void;
}

export function GroupageCostAllocationCard({
  tripId,
  initialSummary,
  onRefresh,
}: GroupageCostAllocationCardProps) {
  const t = useTranslations('groupageSplitBilling');
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<GroupageTripPnlSummary | null>(initialSummary || null);
  const [allocationMode, setAllocationMode] = useState<CostAllocationMode>(
    summary?.allocationMode || 'chargeable_weight'
  );

  // Cost edit fields
  const [fuelCost, setFuelCost] = useState<number>(summary?.operatingCosts.fuelCost ?? 3500);
  const [ferryCost, setFerryCost] = useState<number>(summary?.operatingCosts.ferryCost ?? 7000);
  const [tollsCost, setTollsCost] = useState<number>(summary?.operatingCosts.tollsCost ?? 1800);
  const [customsCost, setCustomsCost] = useState<number>(summary?.operatingCosts.customsCost ?? 1200);
  const [driverCost, setDriverCost] = useState<number>(summary?.operatingCosts.driverCost ?? 2500);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRecalculate = (modeToUse = allocationMode) => {
    startTransition(async () => {
      setFeedback(null);
      const res = await allocateGroupageCostsAction({
        tripId,
        allocationMode: modeToUse,
        fuelCost,
        ferryCost,
        tollsCost,
        customsCost,
        driverCost,
      });

      if (res.success && res.data) {
        setSummary(res.data);
        setFeedback({ type: 'success', message: t('allocationUpdatedSuccess') });
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || t('allocationFailed') });
      }
    });
  };

  const handleModeChange = (newMode: CostAllocationMode) => {
    setAllocationMode(newMode);
    handleRecalculate(newMode);
  };

  const handleBatchInvoice = (specificConsignmentId?: string) => {
    startTransition(async () => {
      setFeedback(null);
      const res = await generateConsignmentInvoicesAction({
        tripId,
        consignmentIds: specificConsignmentId ? [specificConsignmentId] : undefined,
        paymentDueDays: 30,
      });

      if (res.success && res.data) {
        setFeedback({
          type: 'success',
          message: `${t('invoicesGeneratedSuccess')} (${res.data.generatedInvoicesCount})`,
        });
        // Refresh allocation view
        handleRecalculate();
      } else {
        setFeedback({ type: 'error', message: res.error || t('invoiceGenerationFailed') });
      }
    });
  };

  const totalCosts = summary?.operatingCosts.totalSharedCost ?? fuelCost + ferryCost + tollsCost + customsCost + driverCost;
  const currency = summary?.currency || 'MAD';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('cardTitle')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('cardSubtitle')}
          </p>
        </div>

        {/* Allocation Mode Switch */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => handleModeChange('chargeable_weight')}
            disabled={isPending}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              allocationMode === 'chargeable_weight'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            {t('modeChargeableWeight')}
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('ldm')}
            disabled={isPending}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              allocationMode === 'ldm'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            {t('modeLdm')}
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`my-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-5">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t('kpiTotalRevenue')}
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {(summary?.totalRevenue ?? 0).toLocaleString()} {currency}
          </span>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t('kpiSharedCost')}
          </span>
          <span className="text-xl font-black text-slate-700 dark:text-slate-200">
            {totalCosts.toLocaleString()} {currency}
          </span>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t('kpiNetProfit')}
          </span>
          <div className="flex items-center gap-1.5">
            {(summary?.totalNetProfit ?? 0) >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
            <span
              className={`text-xl font-black ${
                (summary?.totalNetProfit ?? 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {(summary?.totalNetProfit ?? 0).toLocaleString()} {currency}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t('kpiProfitMargin')}
          </span>
          <div className="flex items-center justify-between">
            <span
              className={`text-xl font-black ${
                (summary?.overallProfitMarginPct ?? 0) >= 20
                  ? 'text-emerald-600'
                  : (summary?.overallProfitMarginPct ?? 0) >= 0
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}
            >
              {summary?.overallProfitMarginPct ?? 0}%
            </span>
            <span className="text-xs text-slate-400">
              {summary?.invoicedCount || 0}/{summary?.consignmentsCount || 0} {t('invoicedBadge')}
            </span>
          </div>
        </div>
      </div>

      {/* Shared Cost Controls Drawer */}
      <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-blue-500" />
            {t('operatingCostsBreakdownTitle')}
          </span>
          <button
            type="button"
            onClick={() => handleRecalculate()}
            disabled={isPending}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t('recalculateBtn')}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1 flex items-center gap-1">
              <Fuel className="w-3 h-3 text-amber-500" />
              {t('fuelCostLabel')}
            </label>
            <input
              type="number"
              min={0}
              value={fuelCost}
              onChange={(e) => setFuelCost(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1 flex items-center gap-1">
              <Ship className="w-3 h-3 text-cyan-500" />
              {t('ferryCostLabel')}
            </label>
            <input
              type="number"
              min={0}
              value={ferryCost}
              onChange={(e) => setFerryCost(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">
              {t('tollsCostLabel')}
            </label>
            <input
              type="number"
              min={0}
              value={tollsCost}
              onChange={(e) => setTollsCost(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">
              {t('customsCostLabel')}
            </label>
            <input
              type="number"
              min={0}
              value={customsCost}
              onChange={(e) => setCustomsCost(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">
              {t('driverCostLabel')}
            </label>
            <input
              type="number"
              min={0}
              value={driverCost}
              onChange={(e) => setDriverCost(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono"
            />
          </div>
        </div>
      </div>

      {/* Batch Invoicing Bar */}
      <div className="flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3 rounded-lg mb-5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-900 dark:text-emerald-300">
            {t('batchInvoicingSubtitle', {
              uninvoiced: (summary?.consignmentsCount || 0) - (summary?.invoicedCount || 0),
            })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleBatchInvoice()}
          disabled={isPending || ((summary?.consignmentsCount || 0) - (summary?.invoicedCount || 0) === 0)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
          {t('generateAllInvoicesBtn')}
        </button>
      </div>

      {/* Consignments Allocation Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-start text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-3 text-start">{t('colConsignment')}</th>
              <th className="py-2.5 px-3 text-center">{t('colShareRatio')}</th>
              <th className="py-2.5 px-3 text-end">{t('colFreightRevenue')}</th>
              <th className="py-2.5 px-3 text-end">{t('colAllocatedCost')}</th>
              <th className="py-2.5 px-3 text-end">{t('colNetMargin')}</th>
              <th className="py-2.5 px-3 text-center">{t('colInvoice')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {summary?.items && summary.items.length > 0 ? (
              summary.items.map((item) => (
                <tr key={item.consignmentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-3 font-sans">
                    <span className="font-bold text-slate-900 dark:text-white block font-mono">
                      {item.consignmentReference}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {item.clientName} — {item.cargoDescription}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {item.shareRatioPct}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {allocationMode === 'chargeable_weight'
                        ? `${item.chargeableWeightKg.toLocaleString()} kg`
                        : `${item.ldmMeters} LDM`}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-end font-bold text-slate-900 dark:text-white">
                    {item.revenue.toLocaleString()} {item.currency}
                  </td>

                  <td className="py-3 px-3 text-end font-medium text-slate-600 dark:text-slate-300">
                    {item.allocatedCost.toLocaleString()} {item.currency}
                  </td>

                  <td className="py-3 px-3 text-end">
                    <span
                      className={`font-bold block ${
                        item.isProfitable
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {item.netMargin.toLocaleString()} {item.currency}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        item.isProfitable
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {item.profitMarginPct}%
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center font-sans">
                    {item.isInvoiced ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-md text-[11px] font-mono">
                        <CheckCircle className="w-3 h-3 text-blue-500" />
                        {item.invoiceNumber}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBatchInvoice(item.consignmentId)}
                        disabled={isPending}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold rounded-md transition-all"
                      >
                        {t('generateInvoiceBtn')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                  {t('noConsignmentsForAllocation')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

