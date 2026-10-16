'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getSmartDunningDashboardAction,
  triggerSmartDunningEscalationAction,
} from '../services/smart-dunning-cashflow.actions';
import type {
  DunningEscalationStage,
  PaymentBehaviorTier,
  PviAdjustedReceivableItem,
  SmartDunningDashboardData,
} from '../types/smart-dunning-cashflow.types';

export function SmartDunningCashFlowView() {
  const t = useTranslations('smartDunning');
  const locale = useLocale() as 'ar' | 'fr' | 'es';
  const isRtl = locale === 'ar';
  const { toast } = useToast();

  const [dashboard, setDashboard] = useState<SmartDunningDashboardData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchedMap, setDispatchedMap] = useState<Record<string, string>>({});

  const loadDashboard = () => {
    startTransition(async () => {
      const res = await getSmartDunningDashboardAction();
      if (res.success) {
        setDashboard(res.data);
      }
    });
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const renderTierBadge = (tier: PaymentBehaviorTier) => {
    switch (tier) {
      case 'prompt_payer':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            {t('tierPrompt')}
          </Badge>
        );
      case 'on_time':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            {t('tierOnTime')}
          </Badge>
        );
      case 'slow_payer':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            {t('tierSlow')}
          </Badge>
        );
      case 'high_risk_delinquent':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            {t('tierHighRisk')}
          </Badge>
        );
    }
  };

  const renderStageBadge = (stage: DunningEscalationStage) => {
    switch (stage) {
      case 'gentle_reminder':
        return (
          <Badge variant="outline" className="border-sky-500/40 text-sky-700 dark:text-sky-300">
            {t('stageGentle')}
          </Badge>
        );
      case 'overdue_notice_1':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
            {t('stageNotice1')}
          </Badge>
        );
      case 'overdue_notice_2':
        return (
          <Badge variant="outline" className="border-orange-500/50 text-orange-700 dark:text-orange-300">
            {t('stageNotice2')}
          </Badge>
        );
      case 'final_legal_mise_en_demeure':
        return (
          <Badge className="bg-rose-600 text-white">
            <ShieldAlert className="w-3 h-3 me-1" />
            {t('stageLegal')}
          </Badge>
        );
    }
  };

  const handleDispatch = async (
    item: PviAdjustedReceivableItem,
    channels: Array<'whatsapp' | 'email'>
  ) => {
    setDispatchingId(`${item.id}-${channels.join('_')}`);
    try {
      const result = await triggerSmartDunningEscalationAction({
        receivableId: item.id,
        documentNumber: item.documentNumber,
        clientId: item.clientId,
        clientName: item.clientName,
        clientPhone: item.clientPhone,
        clientEmail: item.clientEmail,
        locale: item.preferredLocale || locale,
        escalationStage: item.escalationStage,
        remainingAmount: item.remainingAmount,
        currency: item.currency,
        contractualDueDate: item.contractualDueDate,
        daysOverdue: item.daysOverdue,
        channels,
      });

      if (result.success) {
        setDispatchedMap((prev) => ({
          ...prev,
          [item.id]: result.generatedMessage || '',
        }));
        toast({
          title: t('dispatchedToastTitle'),
          description: `${item.clientName} — ${item.documentNumber} (${result.generatedSubject || item.escalationStage})`,
        });
      }
    } finally {
      setDispatchingId(null);
    }
  };

  if (!dashboard) {
    return (
      <div className="py-16 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
        <p className="text-sm text-muted-foreground">{t('refreshBtn')}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-5 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-primary" />
            {t('title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs px-3 py-1">
            1 EUR = {dashboard.exchangeRateEurToMad} MAD
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={isPending}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            {t('refreshBtn')}
          </Button>
        </div>
      </div>

      {/* 4 Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('kpiConsolidatedReceivables')}</span>
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {dashboard.totalConsolidatedReceivablesMad} <span className="text-xs">MAD</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              MAD: {dashboard.totalOpenMad} | EUR: {dashboard.totalOpenEur} €
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('kpiFleetPvi')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {dashboard.fleetAveragePvi}x
            </div>
            <div className="text-[11px] text-muted-foreground">
              PVI = 1.00x (On-Time Benchmark)
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('kpi30DaysExpected')}</span>
              <CalendarClock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">
              {dashboard.expected30DaysPviMad} <span className="text-xs">MAD</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              60d: {dashboard.expected60DaysPviMad} | 90d: {dashboard.expected90DaysPviMad} MAD
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('kpiOverdueHighRisk')}</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {dashboard.totalOverdueConsolidatedMad} <span className="text-xs">MAD</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {dashboard.highRiskClientsCount} {t('tierHighRisk')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 30/60/90-Day Cash Flow Radar Chart + Aging Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t('chartCashFlowTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboard.cashFlowHorizons.map((h) => ({
                    name: h.label,
                    nominalMad: Number(h.nominalConsolidatedMad),
                    pviMad: Number(h.pviAdjustedConsolidatedMad),
                    lcnMad: Number(h.lcnExpectedMad),
                  }))}
                  margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="nominalMad"
                    name={t('legendNominalMad')}
                    fill="#94a3b8"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="pviMad"
                    name={t('legendPviMad')}
                    fill="#0ea5e9"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="lcnMad"
                    name={t('legendLcnMad')}
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Aging Buckets Breakdown */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              {t('agingBucketsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {dashboard.agingBuckets.map((b) => {
              const bucketLabel =
                locale === 'ar' ? b.labelAr : locale === 'es' ? b.labelEs : b.labelFr;
              return (
                <div key={b.bucket} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {bucketLabel} ({b.documentsCount})
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {b.consolidatedMad} MAD ({b.sharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        b.bucket === 'current'
                          ? 'bg-emerald-500'
                          : b.bucket === 'days_1_30'
                          ? 'bg-amber-500'
                          : b.bucket === 'days_31_60'
                          ? 'bg-orange-500'
                          : 'bg-rose-600'
                      }`}
                      style={{ width: `${Math.min(100, Number(b.sharePct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Client PVI Leaderboard */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            {t('clientPviLeaderboardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {dashboard.clientProfiles.map((client) => (
              <div
                key={client.clientId}
                className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-foreground line-clamp-1">
                    {client.clientName}
                  </span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    PVI {client.pviScore}x
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  {renderTierBadge(client.behaviorTier)}
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {client.averageActualDaysToPay}d / {client.agreedPaymentTermsDays}d
                  </span>
                </div>
                <div className="pt-1 border-t border-border/40 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Exposure:</span>
                  <span className="font-mono font-bold text-foreground">
                    {client.totalExposureConsolidatedMad} MAD
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Open Receivables & Automated Dunning Escalation Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            {t('receivablesTableTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="py-2.5 px-3 text-start font-medium">{t('colDocument')}</th>
                  <th className="py-2.5 px-3 text-start font-medium">{t('colClient')}</th>
                  <th className="py-2.5 px-3 text-start font-medium">{t('colPviTier')}</th>
                  <th className="py-2.5 px-3 text-start font-medium">{t('colDueVsExpected')}</th>
                  <th className="py-2.5 px-3 text-start font-medium">{t('colAgingStage')}</th>
                  <th className="py-2.5 px-3 text-end font-medium">{t('colRemainingAmount')}</th>
                  <th className="py-2.5 px-3 text-end font-medium">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {dashboard.receivables.map((item) => {
                  const isSent = Boolean(dispatchedMap[item.id]);
                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-foreground">
                          {item.documentNumber}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.documentType === 'lcn_bill'
                            ? t('docTypeLcn')
                            : t('docTypeInvoice')}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">{item.clientName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {item.clientPhone || item.clientEmail || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-3 space-y-1">
                        <div className="font-mono font-semibold text-foreground">
                          PVI: {item.clientPviScore}x
                        </div>
                        {renderTierBadge(item.behaviorTier)}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="text-muted-foreground">
                          Contract: {item.contractualDueDate}
                        </div>
                        <div className="text-sky-600 dark:text-sky-400 font-semibold">
                          PVI Est.: {item.pviAdjustedExpectedDate}
                        </div>
                      </td>
                      <td className="py-3 px-3 space-y-1">
                        <div className="font-mono text-[11px]">
                          {item.daysOverdue > 0
                            ? `+${item.daysOverdue}d overdue`
                            : `${item.daysOverdue}d (current)`}
                        </div>
                        {renderStageBadge(item.escalationStage)}
                      </td>
                      <td className="py-3 px-3 text-end font-mono">
                        <div className="font-bold text-foreground text-sm">
                          {item.remainingAmount} {item.currency}
                        </div>
                        {item.currency === 'EUR' && (
                          <div className="text-[11px] text-muted-foreground">
                            ≈ {item.remainingAmountConsolidatedMad} MAD
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-end">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[11px] gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                            disabled={dispatchingId !== null}
                            onClick={() => handleDispatch(item, ['whatsapp'])}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {t('dispatchWhatsAppBtn')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[11px] gap-1 border-sky-500/40 text-sky-700 dark:text-sky-300"
                            disabled={dispatchingId !== null}
                            onClick={() => handleDispatch(item, ['email'])}
                          >
                            <Mail className="w-3 h-3" />
                            {t('dispatchEmailBtn')}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-[11px] gap-1"
                            disabled={dispatchingId !== null}
                            onClick={() => handleDispatch(item, ['whatsapp', 'email'])}
                          >
                            {isSent ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            {t('dispatchBothBtn')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

