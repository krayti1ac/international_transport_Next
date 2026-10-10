'use client';

/**
 * Trans Bodanon TMS — Reefer Cargo Loss & Insurance Claim Settlement View
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import React, { useState, useTransition, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldAlert,
  ShieldCheck,
  Calculator,
  FileText,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type {
  CargoCategory,
  CargoDepreciationResult,
  ClaimStatus,
  ReeferCargoInsuranceClaim,
  SettlementType,
} from '../types/reefer-claim-settlement.types';
import {
  calculateCargoLossEstimateAction,
  createInsuranceClaimAction,
  fetchReeferClaimsAction,
  updateClaimStatusAction,
} from '../services/reefer-claim.actions';

interface ReeferInsuranceClaimSettlementViewProps {
  initialClaims?: ReeferCargoInsuranceClaim[];
}

export function ReeferInsuranceClaimSettlementView({
  initialClaims = [],
}: ReeferInsuranceClaimSettlementViewProps) {
  const t = useTranslations('reeferClaims');
  const tCommon = useTranslations('common');
  const { dir } = useLanguage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [claims, setClaims] = useState<ReeferCargoInsuranceClaim[]>(initialClaims);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCalculator, setShowCalculator] = useState<boolean>(false);

  // Calculator Form State
  const [calcCategory, setCalcCategory] = useState<CargoCategory>('fresh_produce');
  const [calcDuration, setCalcDuration] = useState<number>(32);
  const [calcDeltaT, setCalcDeltaT] = useState<number>(5.6);
  const [calcCloseTemp, setCalcCloseTemp] = useState<number>(9.1);
  const [calcMaxTemp, setCalcMaxTemp] = useState<number>(6.0);
  const [calcInsuredValue, setCalcInsuredValue] = useState<number>(145000);
  const [calcDeductible, setCalcDeductible] = useState<number>(5000);
  const [calcTripId, setCalcTripId] = useState<number>(8840);
  const [calcTruckPlate, setCalcTruckPlate] = useState<string>('67890-A-40');
  const [calcDriverName, setCalcDriverName] = useState<string>('Mohamed El Idrissi');
  const [calcAnnexId, setCalcAnnexId] = useState<string>('ANNEX-8840-A1');
  const [calcSettlementType, setCalcSettlementType] = useState<SettlementType>('credit_note');

  // Real-time calculation estimate preview
  const [estimateResult, setEstimateResult] = useState<CargoDepreciationResult | null>(null);

  // Financial KPIs
  const kpis = useMemo(() => {
    const totalCount = claims.length;
    const grossTotal = claims.reduce((acc, c) => acc + c.grossLossAmount, 0);
    const netTotal = claims.reduce((acc, c) => acc + c.netIndemnityAmount, 0);
    const settledTotal = claims
      .filter((c) => c.claimStatus === 'settled')
      .reduce((acc, c) => acc + c.netIndemnityAmount, 0);
    const pendingCount = claims.filter(
      (c) => c.claimStatus === 'under_review' || c.claimStatus === 'draft'
    ).length;

    return { totalCount, grossTotal, netTotal, settledTotal, pendingCount };
  }, [claims]);

  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      const matchCat = filterCategory === 'all' || c.cargoCategory === filterCategory;
      const matchStat = filterStatus === 'all' || c.claimStatus === filterStatus;
      return matchCat && matchStat;
    });
  }, [claims, filterCategory, filterStatus]);

  const runCalculationPreview = async () => {
    const res = await calculateCargoLossEstimateAction({
      cargoCategory: calcCategory,
      durationMinutes: calcDuration,
      tempRiseDeltaC: calcDeltaT,
      maxAllowedTempC: calcMaxTemp,
      tempAtCloseC: calcCloseTemp,
      insuredCargoValue: calcInsuredValue,
      deductibleAmount: calcDeductible,
    });

    if (res.success && res.data) {
      setEstimateResult(res.data);
    } else {
      toast({
        title: tCommon('error'),
        description: res.error || 'Failed to calculate estimate',
        variant: 'destructive',
      });
    }
  };

  const handleCreateClaim = async () => {
    startTransition(async () => {
      const res = await createInsuranceClaimAction({
        tripId: calcTripId,
        tripNumber: `TRIP-2026-${calcTripId}`,
        truckPlate: calcTruckPlate,
        driverName: calcDriverName,
        annexId: calcAnnexId,
        cargoCategory: calcCategory,
        insuredCargoValue: calcInsuredValue,
        currency: 'MAD',
        deductibleAmount: calcDeductible,
        durationMinutes: calcDuration,
        tempRiseDeltaC: calcDeltaT,
        maxAllowedTempC: calcMaxTemp,
        tempAtCloseC: calcCloseTemp,
        settlementType: calcSettlementType,
        insurerName: 'Allianz Maroc / RMA Watanya',
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      if (res.success && res.data) {
        setClaims((prev) => [res.data!, ...prev]);
        setShowCalculator(false);
        toast({
          title: t('claimCreatedSuccessTitle'),
          description: t('claimCreatedSuccessDesc'),
        });
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || 'Failed to create claim dossier',
          variant: 'destructive',
        });
      }
    });
  };

  const handleUpdateStatus = async (claimId: string, newStatus: ClaimStatus) => {
    startTransition(async () => {
      const res = await updateClaimStatusAction({
        claimId,
        status: newStatus,
        creditNoteNumber:
          newStatus === 'settled' ? `CN-2026-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
      });

      if (res.success && res.data) {
        setClaims((prev) => prev.map((c) => (c.id === claimId ? res.data! : c)));
        toast({
          title: t('statusUpdatedTitle'),
          description: t('statusUpdatedDesc'),
        });
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || 'Failed to update status',
          variant: 'destructive',
        });
      }
    });
  };

  const refreshClaims = () => {
    startTransition(async () => {
      const res = await fetchReeferClaimsAction();
      if (res.success && res.data) {
        setClaims(res.data.items);
      }
    });
  };

  const getStatusBadge = (status: ClaimStatus) => {
    switch (status) {
      case 'settled':
        return (
          <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" />
            {t('statusSettled')}
          </Badge>
        );
      case 'approved_by_insurer':
        return (
          <Badge className="bg-blue-600 text-white gap-1 text-[11px]">
            <ShieldCheck className="h-3 w-3" />
            {t('statusApproved')}
          </Badge>
        );
      case 'under_review':
        return (
          <Badge className="bg-amber-500 text-white gap-1 text-[11px]">
            <Clock className="h-3 w-3" />
            {t('statusUnderReview')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-rose-600 text-white gap-1 text-[11px]">
            <XCircle className="h-3 w-3" />
            {t('statusRejected')}
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="outline" className="gap-1 text-[11px]">
            <FileText className="h-3 w-3" />
            {t('statusDraft')}
          </Badge>
        );
    }
  };

  const getCategoryBadge = (cat: CargoCategory) => {
    switch (cat) {
      case 'pharma_cold':
        return <Badge className="bg-purple-600 text-white text-[10px]">GDP Pharma</Badge>;
      case 'deep_frozen':
        return <Badge className="bg-cyan-600 text-white text-[10px]">Frozen -20°C</Badge>;
      case 'fresh_produce':
        return <Badge className="bg-emerald-600 text-white text-[10px]">Fresh +4°C</Badge>;
      case 'meat_chilled':
        return <Badge className="bg-orange-600 text-white text-[10px]">Meat Chilled</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{cat}</Badge>;
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-amiri flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            <span>{t('viewTitle')}</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {t('viewSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setShowCalculator(true);
              runCalculationPreview();
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('newClaimBtn')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshClaims}
            disabled={isPending}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
            {t('refreshBtn')}
          </Button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border border-border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>{t('kpiTotalClaims')}</span>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono mt-1">
              {kpis.totalCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {kpis.pendingCount} {t('kpiPendingReview')}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border border-border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>{t('kpiGrossLoss')}</span>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
              {kpis.grossTotal.toLocaleString()} MAD
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {t('kpiEvaluatedLoss')}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border border-border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>{t('kpiSettledIndemnity')}</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {kpis.settledTotal.toLocaleString()} MAD
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {t('kpiPaidCreditNotes')}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border border-border shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>{t('kpiNetClaimable')}</span>
              <ShieldCheck className="h-4 w-4 text-blue-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {kpis.netTotal.toLocaleString()} MAD
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {t('kpiAfterDeductibles')}
          </CardContent>
        </Card>
      </div>

      {/* Filter and Claim List Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm md:text-base font-bold">
              {t('claimsTableTitle')} ({filteredClaims.length})
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs p-1.5 border rounded bg-background"
            >
              <option value="all">{t('filterAllCategories')}</option>
              <option value="fresh_produce">{t('catFresh')}</option>
              <option value="deep_frozen">{t('catFrozen')}</option>
              <option value="pharma_cold">{t('catPharma')}</option>
              <option value="meat_chilled">{t('catMeat')}</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs p-1.5 border rounded bg-background"
            >
              <option value="all">{t('filterAllStatuses')}</option>
              <option value="draft">{t('statusDraft')}</option>
              <option value="under_review">{t('statusUnderReview')}</option>
              <option value="approved_by_insurer">{t('statusApproved')}</option>
              <option value="settled">{t('statusSettled')}</option>
              <option value="rejected">{t('statusRejected')}</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredClaims.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              {t('noClaimsFound')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-4 hover:bg-muted/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs md:text-sm">
                        {claim.claimReference}
                      </span>
                      {getCategoryBadge(claim.cargoCategory)}
                      {getStatusBadge(claim.claimStatus)}
                      {claim.creditNoteNumber && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {claim.creditNoteNumber}
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                      <span>
                        {t('tripLabel')}: <strong className="text-foreground">{claim.tripNumber}</strong> ({claim.truckPlate})
                      </span>
                      <span>•</span>
                      <span>
                        {t('driverLabel')}: {claim.driverName}
                      </span>
                      {claim.annexId && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-primary font-medium">
                            {claim.annexId}
                          </span>
                        </>
                      )}
                    </div>

                    {claim.notes && (
                      <p className="text-[11px] text-muted-foreground/90 italic">
                        {claim.notes}
                      </p>
                    )}
                  </div>

                  {/* Financial Breakdown & Action Controls */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="text-end">
                      <div className="text-xs text-muted-foreground">
                        {t('grossLossLabel')}: <span className="font-mono line-through">{claim.grossLossAmount.toLocaleString()} MAD</span>
                      </div>
                      <div className="text-sm md:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {claim.netIndemnityAmount.toLocaleString()} {claim.currency}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {t('depreciationRate')}: {claim.depreciationRatePct}%
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {claim.claimStatus === 'under_review' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(claim.id, 'approved_by_insurer')}
                          disabled={isPending}
                          className="text-xs text-blue-600 border-blue-500/40 hover:bg-blue-500/10"
                        >
                          {t('approveBtn')}
                        </Button>
                      )}

                      {(claim.claimStatus === 'approved_by_insurer' ||
                        claim.claimStatus === 'under_review') && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(claim.id, 'settled')}
                          disabled={isPending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('settleCreditNoteBtn')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim Assessment Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Calculator className="h-5 w-5 text-rose-500" />
                {t('calcModalTitle')}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCalculator(false)}
                className="h-7 w-7 p-0"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('calcModalDesc')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-medium block mb-1">{t('calcCategoryLabel')}</label>
                <select
                  value={calcCategory}
                  onChange={(e) => setCalcCategory(e.target.value as CargoCategory)}
                  className="w-full p-2 border rounded bg-background"
                >
                  <option value="fresh_produce">{t('catFresh')}</option>
                  <option value="deep_frozen">{t('catFrozen')}</option>
                  <option value="pharma_cold">{t('catPharma')}</option>
                  <option value="meat_chilled">{t('catMeat')}</option>
                </select>
              </div>

              <div>
                <label className="font-medium block mb-1">{t('calcInsuredValueLabel')}</label>
                <Input
                  type="number"
                  value={calcInsuredValue}
                  onChange={(e) => setCalcInsuredValue(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">{t('calcDurationMinsLabel')}</label>
                <Input
                  type="number"
                  value={calcDuration}
                  onChange={(e) => setCalcDuration(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">{t('calcDeltaTLabel')}</label>
                <Input
                  type="number"
                  step="0.1"
                  value={calcDeltaT}
                  onChange={(e) => setCalcDeltaT(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">{t('calcCloseTempLabel')}</label>
                <Input
                  type="number"
                  step="0.1"
                  value={calcCloseTemp}
                  onChange={(e) => setCalcCloseTemp(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">{t('calcDeductibleLabel')}</label>
                <Input
                  type="number"
                  value={calcDeductible}
                  onChange={(e) => setCalcDeductible(Number(e.target.value))}
                  className="text-xs"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runCalculationPreview}
              className="w-full text-xs gap-1.5"
            >
              <Calculator className="h-3.5 w-3.5" />
              {t('runEstimateBtn')}
            </Button>

            {/* Live Calculation Result Preview */}
            {estimateResult && (
              <div className="p-3.5 rounded-lg border bg-muted/30 space-y-2 text-xs font-mono">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{t('depreciationRate')}:</span>
                  <span className={estimateResult.isTotalLoss ? 'text-rose-600' : 'text-amber-600'}>
                    {estimateResult.depreciationRatePct}% {estimateResult.isTotalLoss ? '(Total Loss)' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('grossLossLabel')}:</span>
                  <span className="text-rose-600">{estimateResult.grossLossAmount.toLocaleString()} MAD</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('deductibleLabel')}:</span>
                  <span>- {estimateResult.deductibleAmount.toLocaleString()} MAD</span>
                </div>
                <div className="flex justify-between pt-1 border-t font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  <span>{t('netIndemnityLabel')}:</span>
                  <span>{estimateResult.netIndemnityAmount.toLocaleString()} MAD</span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1 italic font-sans">
                  {estimateResult.explanation}
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCalculator(false)}
                className="text-xs"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleCreateClaim}
                disabled={isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
              >
                {isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {t('generateClaimDossierBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

