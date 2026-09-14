'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import type { TripFinancialSummary } from '@/lib/profitability';
import type { TripOrder } from '@/types/database';
import Decimal from 'decimal.js';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Fuel,
  Wallet,
  Ship,
  AlertTriangle,
  Receipt,
  Percent,
  CheckCircle2,
  Gauge,
} from 'lucide-react';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface TripProfitabilityTabProps {
  financials: TripFinancialSummary | null;
  trip: TripOrder;
}

export function TripProfitabilityTab({ financials, trip }: TripProfitabilityTabProps) {
  const { t } = useLanguage();

  if (!financials) {
    return (
      <Card className="rounded-2xl border-border bg-card p-12 text-center text-muted-foreground">
        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-semibold">
          {t('جاري احتساب التحليل المالي للرحلة...', 'Calcul de rentabilité en cours...')}
        </p>
      </Card>
    );
  }

  const isProfitable = financials.netProfit > 0;
  const marginDec = new Decimal(financials.profitMarginPercentage);

  return (
    <div className="space-y-6">
      {/* 1. Executive P&L KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="rounded-2xl border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('إجمالي إيراد الرحلة (ذهاب + عودة)', 'Revenu Total Fret')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-foreground mt-2">
            {formatCurrency(financials.revenue, trip.price_type || 'MAD')}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
            <span>{t('تصدير:', 'Export :')} {formatCurrency(financials.priceExport || 0, 'MAD')}</span>
            <span>{t('استيراد:', 'Import :')} {formatCurrency(financials.priceImport || 0, 'MAD')}</span>
          </div>
        </Card>

        {/* Operating Expenses */}
        <Card className="rounded-2xl border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('إجمالي المصروفات الميدانية', 'Total Dépenses Trajet')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-2">
            -{formatCurrency(financials.totalExpenses, 'MAD')}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
            {t('وقود، سلف، عبارة، وغرامات', 'Carburant, avances, ferry')}
          </p>
        </Card>

        {/* Net Profit */}
        <Card
          className={`rounded-2xl border p-5 ${
            isProfitable
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-rose-500/30 bg-rose-500/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('صافي الربح الفعلي الميداني', 'Marge Nette Réelle')}
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isProfitable
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : 'bg-rose-500/15 text-rose-600'
              }`}
            >
              {isProfitable ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
          <p
            className={`text-2xl font-black font-mono mt-2 ${
              isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            {formatCurrency(financials.netProfit, 'MAD')}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold mt-2 pt-2 border-t border-border/50">
            <span className={isProfitable ? 'text-emerald-600' : 'text-rose-600'}>
              {isProfitable ? t('مأمورية رابحة', 'Mission Rentable') : t('عجز مالي', 'Déficit')}
            </span>
          </div>
        </Card>

        {/* Profit Margin % */}
        <Card className="rounded-2xl border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('نسبة هامش الربح', 'Taux de Marge')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-foreground mt-2">
            {financials.profitMarginPercentage}%
          </p>
          <div className="w-full bg-muted rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                marginDec.greaterThanOrEqualTo(25)
                  ? 'bg-emerald-500'
                  : marginDec.greaterThanOrEqualTo(10)
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, financials.profitMarginPercentage))}%` }}
            />
          </div>
        </Card>
      </div>

      {/* 2. Detailed Deductions Breakdown */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <span>{t('تفكيك النفقات والمصاريف المقتطعة من إيراد الرحلة', 'Ventilation des Dépenses Réelles')}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 space-y-3 text-sm">
          {/* Fuel */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Fuel className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  {t('مصاريف الوقود والمحطات (Carburant)', 'Dépenses Carburant')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {financials.litersPer100Km
                    ? `${t('معدل الاستهلاك:', 'Conso :')} ${financials.litersPer100Km} L/100km`
                    : t('مطابق لفواتير المحطات المسجلة للشاحنة', 'Factures carburant enregistrées')}
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
              -{formatCurrency(financials.fuelCost, 'MAD')}
            </span>
          </div>

          {/* Driver Advances */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  {t('سلف ومصروفات السائق على الطريق (Avances)', 'Avances Chauffeur')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('مصاريف الطريق، الإعاشة، ومصروفات المأمورية', 'Frais de route & indemnités chauffeur')}
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
              -{formatCurrency(financials.advancesCost, 'MAD')}
            </span>
          </div>

          {/* Ferry & Port Expenses */}
          {financials.ferryCost > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                  <Ship className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {t('تذاكر العبّارة ورسوم الموانئ والترانزيت (Ferry & Port)', 'Billets Ferry & Transit')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('التريبتك، مرسى المغرب، والعبور البحري', 'Triptyque, Marsa Maroc et ferry')}
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                -{formatCurrency(financials.ferryCost, 'MAD')}
              </span>
            </div>
          )}

          {/* Fines */}
          {financials.finesCost > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {t('الغرامات والمخالفات الميدانية (Amendes)', 'Amendes & Pénalités')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('مخالفات مسجلة على مسار الرحلة', 'Infractions enregistrées sur le trajet')}
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold text-rose-600">
                -{formatCurrency(financials.finesCost, 'MAD')}
              </span>
            </div>
          )}

          {/* Net Result Bar */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between mt-2">
            <span className="font-bold text-foreground text-sm">
              {t('الربح الصافي النهائي المحقق:', 'Résultat Net Définitif :')}
            </span>
            <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(financials.netProfit, 'MAD')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
