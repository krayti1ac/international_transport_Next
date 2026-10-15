'use client';

/**
 * Trans Bodanon TMS — Commercial Bills & LCN Portfolio Dashboard Card
 * Real-time tracking of Promissory Notes (LCN), Checks, and Traites across Moroccan banking circuits.
 */

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  CreditCard,
  Plus,
  Search,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  Send,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type {
  CommercialBill,
  BillStatus,
  BillType,
  CommercialBillsSummary,
} from '../types/commercial-bills.types';
import {
  fetchCommercialBillsAction,
  getCommercialBillsSummaryAction,
} from '../services/commercial-bills.actions';
import { getMaturityUrgency } from '../services/commercial-bills-calc.service';
import { NewCommercialBillModal } from './NewCommercialBillModal';
import { BillLifecycleModal } from './BillLifecycleModal';
import { RemittanceBordereauModal } from './RemittanceBordereauModal';
import Decimal from 'decimal.js';

interface CommercialBillsPortfolioCardProps {
  initialBills?: CommercialBill[];
  bankAccounts?: Array<{ id: number; bank_name?: string; account_number?: string }>;
}

export function CommercialBillsPortfolioCard({
  initialBills = [],
  bankAccounts = [],
}: CommercialBillsPortfolioCardProps) {
  const t = useTranslations('commercialBills');
  const tb = useTranslations('remittanceBordereau');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [bills, setBills] = useState<CommercialBill[]>(initialBills);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<CommercialBillsSummary | null>(null);

  // Multi-selection state for bank remittance
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [showBordereauModal, setShowBordereauModal] = useState(false);

  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedBillForAction, setSelectedBillForAction] = useState<{
    bill: CommercialBill;
    actionType: 'remit' | 'clear' | 'bounce';
  } | null>(null);

  // Load data if empty
  const loadBills = () => {
    startTransition(async () => {
      const [billsRes, summaryRes] = await Promise.all([
        fetchCommercialBillsAction(),
        getCommercialBillsSummaryAction(),
      ]);

      if (billsRes.success && billsRes.data) {
        setBills(billsRes.data);
      }
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
    });
  };

  useEffect(() => {
    if (initialBills.length === 0) {
      loadBills();
    }
  }, [initialBills.length]);

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const s = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        b.billNumber.toLowerCase().includes(s) ||
        b.clientName.toLowerCase().includes(s) ||
        (b.drawerBankName && b.drawerBankName.toLowerCase().includes(s));
      return matchesStatus && matchesSearch;
    });
  }, [bills, statusFilter, searchQuery]);

  // Selection helpers for bank remittance bordereau
  const portfolioBills = useMemo(() => {
    return filteredBills.filter((b) => b.status === 'in_portfolio');
  }, [filteredBills]);

  const allPortfolioSelected = useMemo(() => {
    return (
      portfolioBills.length > 0 &&
      portfolioBills.every((b) => selectedBillIds.includes(b.id))
    );
  }, [portfolioBills, selectedBillIds]);

  const toggleSelectBill = (id: string) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPortfolio = () => {
    if (allPortfolioSelected) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(portfolioBills.map((b) => b.id));
    }
  };

  const selectedBillsForBordereau = useMemo(() => {
    return bills.filter((b) => selectedBillIds.includes(b.id));
  }, [bills, selectedBillIds]);

  const selectedTotalNominal = useMemo(() => {
    return selectedBillsForBordereau.reduce(
      (acc, b) => acc.plus(new Decimal(b.faceValue)),
      new Decimal(0)
    ).toNumber();
  }, [selectedBillsForBordereau]);

  const getStatusBadge = (status: BillStatus) => {
    switch (status) {
      case 'in_portfolio':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200">
            {t('statusInPortfolio')}
          </Badge>
        );
      case 'remitted_for_collection':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200">
            {t('statusRemitted')}
          </Badge>
        );
      case 'discounted':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200">
            {t('statusDiscounted')}
          </Badge>
        );
      case 'cleared':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200">
            {t('statusCleared')}
          </Badge>
        );
      case 'bounced_unpaid':
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200">
            {t('statusBounced')}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (dueDateStr: string, status: BillStatus) => {
    if (status === 'cleared' || status === 'cancelled') return null;
    const urgency = getMaturityUrgency(dueDateStr);
    switch (urgency) {
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="w-3 h-3" />
            {t('urgencyOverdue')}
          </span>
        );
      case 'due_today':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <Clock className="w-3 h-3" />
            {t('urgencyDueToday')}
          </span>
        );
      case 'due_soon':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            {t('urgencyDueSoon')}
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: BillType) => {
    switch (type) {
      case 'lcn_promissory_note':
        return <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">LCN</span>;
      case 'cheque':
        return <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">CHQ</span>;
      case 'traite':
        return <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">TRT</span>;
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>{t('portfolioCardTitle')}</span>
              <Badge variant="outline" className="font-mono text-xs ms-1">
                {bills.length} {t('billsCountUnit')}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {t('portfolioCardSubtitle')}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {selectedBillIds.length > 0 && (
              <Button
                size="sm"
                onClick={() => setShowBordereauModal(true)}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{tb('generateBordereauBtn')} ({selectedBillIds.length})</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={loadBills}
              disabled={isPending}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('refreshBtn')}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowNewModal(true)}
              className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('newBillBtn')}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* KPI Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* En Portefeuille */}
          <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20">
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              {t('kpiPortfolio')}
            </span>
            <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-1">
              {(summary?.totalPortfolioValue || 0).toLocaleString()} MAD
            </div>
            <span className="text-[10px] text-slate-500">
              {bills.filter((b) => b.status === 'in_portfolio').length} {t('billsUnit')}
            </span>
          </div>

          {/* Remis en Banque */}
          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {t('kpiRemitted')}
            </span>
            <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-1">
              {(summary?.totalRemittedValue || 0).toLocaleString()} MAD
            </div>
            <span className="text-[10px] text-slate-500">
              {bills.filter((b) => b.status === 'remitted_for_collection').length} {t('billsUnit')}
            </span>
          </div>

          {/* Escompté */}
          <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20">
            <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
              {t('kpiDiscounted')}
            </span>
            <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-1">
              {(summary?.totalDiscountedValue || 0).toLocaleString()} MAD
            </div>
            <span className="text-[10px] text-slate-500">
              {bills.filter((b) => b.status === 'discounted').length} {t('billsUnit')}
            </span>
          </div>

          {/* Encaissé */}
          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              {t('kpiCleared')}
            </span>
            <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-1">
              {(summary?.totalClearedValue || 0).toLocaleString()} MAD
            </div>
            <span className="text-[10px] text-slate-500">
              {bills.filter((b) => b.status === 'cleared').length} {t('billsUnit')}
            </span>
          </div>

          {/* Impayés / Rejets */}
          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20">
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              {t('kpiBounced')}
            </span>
            <div className="text-base font-extrabold font-mono text-rose-700 dark:text-rose-400 mt-1">
              {(summary?.totalBouncedValue || 0).toLocaleString()} MAD
            </div>
            <span className="text-[10px] text-rose-600 dark:text-rose-400">
              {bills.filter((b) => b.status === 'bounced_unpaid').length} {t('billsUnit')}
            </span>
          </div>

          {/* Échéances < 7j */}
          <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
            <span className="text-[11px] font-bold text-orange-800 dark:text-orange-300">
              {t('kpiDueSoon')}
            </span>
            <div className="text-base font-extrabold font-mono text-orange-800 dark:text-orange-300 mt-1">
              {summary?.dueWithin7DaysCount || 0} {t('billsUnit')}
            </div>
            <span className="text-[10px] text-orange-700 dark:text-orange-400">
              {(summary?.dueWithin7DaysValue || 0).toLocaleString()} MAD
            </span>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold w-full sm:w-auto">
            {[
              { key: 'all', label: t('tabAll') },
              { key: 'in_portfolio', label: t('tabPortfolio') },
              { key: 'remitted_for_collection', label: t('tabRemitted') },
              { key: 'discounted', label: t('tabDiscounted') },
              { key: 'cleared', label: t('tabCleared') },
              { key: 'bounced_unpaid', label: t('tabBounced') },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === tab.key
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-9 pe-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>

        {/* Batch Selection Banner */}
        {selectedBillIds.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-700 dark:text-blue-300">
                {tb('selectedBannerCount', { count: selectedBillIds.length })}
              </span>
              <span className="text-slate-400">|</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {tb('selectedBannerTotal')}: {selectedTotalNominal.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedBillIds([])}
                className="h-7 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                {tb('clearSelection')}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowBordereauModal(true)}
                className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <FileText className="w-3.5 h-3.5" />
                {tb('generateBordereauBtn')}
              </Button>
            </div>
          </div>
        )}

        {/* Bills Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
              <tr>
                <th className="w-8 py-2.5 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={allPortfolioSelected}
                    onChange={toggleSelectAllPortfolio}
                    disabled={portfolioBills.length === 0}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title={tb('selectAllPortfolio')}
                  />
                </th>
                <th className="py-2.5 px-3">{t('colTypeAndNumber')}</th>
                <th className="py-2.5 px-3">{t('colClientAndBank')}</th>
                <th className="py-2.5 px-3">{t('colFaceValue')}</th>
                <th className="py-2.5 px-3">{t('colDueDate')}</th>
                <th className="py-2.5 px-3">{t('colStatus')}</th>
                <th className="py-2.5 px-3 text-end">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  {/* Select Checkbox */}
                  <td className="py-3 px-3 text-center">
                    {bill.status === 'in_portfolio' ? (
                      <input
                        type="checkbox"
                        checked={selectedBillIds.includes(bill.id)}
                        onChange={() => toggleSelectBill(bill.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700 text-[10px]">—</span>
                    )}
                  </td>

                  {/* Type & Number */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {getTypeBadge(bill.billType)}
                      </span>
                      <div>
                        <div className="font-bold font-mono text-slate-800 dark:text-slate-100">
                          {bill.billNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(bill.issueDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Client & Bank */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {bill.clientName}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>{bill.drawerBankName || '—'}</span>
                    </div>
                  </td>

                  {/* Face Value */}
                  <td className="py-3 px-3 font-bold font-mono text-slate-900 dark:text-white">
                    {bill.faceValue.toLocaleString()} {bill.currency}
                  </td>

                  {/* Due Date & Urgency */}
                  <td className="py-3 px-3">
                    <div className="font-mono font-medium text-slate-700 dark:text-slate-300">
                      {new Date(bill.dueDate).toLocaleDateString()}
                    </div>
                    <div className="mt-0.5">
                      {getUrgencyBadge(bill.dueDate, bill.status)}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    {getStatusBadge(bill.status)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      {bill.status === 'in_portfolio' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedBillForAction({ bill, actionType: 'remit' })
                          }
                          className="h-7 text-[11px] px-2 text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-300"
                        >
                          <Send className="w-3 h-3 me-1" />
                          {t('remitBtn')}
                        </Button>
                      )}

                      {(bill.status === 'in_portfolio' ||
                        bill.status === 'remitted_for_collection' ||
                        bill.status === 'discounted') && (
                        <Button
                          size="sm"
                          onClick={() =>
                            setSelectedBillForAction({ bill, actionType: 'clear' })
                          }
                          className="h-7 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="w-3 h-3 me-1" />
                          {t('clearBtn')}
                        </Button>
                      )}

                      {(bill.status === 'remitted_for_collection' ||
                        bill.status === 'discounted') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedBillForAction({ bill, actionType: 'bounce' })
                          }
                          className="h-7 text-[11px] px-2 text-rose-700 border-rose-200 hover:bg-rose-50 dark:text-rose-300"
                        >
                          <AlertTriangle className="w-3 h-3 me-1" />
                          {t('bounceBtn')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t('noBillsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* New Bill Registration Modal */}
      {showNewModal && (
        <NewCommercialBillModal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          onSuccess={(newBill) => {
            setBills((prev) => [newBill, ...prev]);
            toast({
              title: t('billRegisteredTitle'),
              description: t('billRegisteredDesc', { number: newBill.billNumber }),
            });
            loadBills();
          }}
        />
      )}

      {/* Lifecycle Action Modal */}
      {selectedBillForAction && (
        <BillLifecycleModal
          bill={selectedBillForAction.bill}
          actionType={selectedBillForAction.actionType}
          isOpen={Boolean(selectedBillForAction)}
          onClose={() => setSelectedBillForAction(null)}
          onSuccess={(updated) => {
            setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            toast({
              title: t('billUpdatedTitle'),
              description: t('billUpdatedDesc', { number: updated.billNumber }),
            });
            loadBills();
          }}
          bankAccounts={bankAccounts}
        />
      )}

      {/* Remittance Bordereau Modal */}
      {showBordereauModal && (
        <RemittanceBordereauModal
          isOpen={showBordereauModal}
          onClose={() => setShowBordereauModal(false)}
          selectedBills={selectedBillsForBordereau}
          bankAccounts={bankAccounts}
          onSuccess={() => {
            setSelectedBillIds([]);
            loadBills();
          }}
        />
      )}
    </Card>
  );
}

