'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Receipt,
  Landmark,
  FileText,
  TrendingUp,
  Percent,
  Coins,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { CurrencyKpiBreakdown } from '../types/client-statement.types';

interface ClientKpiBentoProps {
  kpisByCurrency: Record<string, CurrencyKpiBreakdown>;
  activeCurrencies: string[];
  defaultCurrency?: string;
}

export function ClientKpiBento({
  kpisByCurrency,
  activeCurrencies,
  defaultCurrency = 'MAD',
}: ClientKpiBentoProps) {
  const { t } = useLanguage();
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    activeCurrencies[0] || defaultCurrency
  );

  const activeStats = kpisByCurrency[selectedCurrency] ||
    kpisByCurrency[defaultCurrency] || {
      currency: selectedCurrency,
      totalInvoiced: '0.00',
      totalPaid: '0.00',
      totalDue: '0.00',
      recoveryRate: '100.0%',
      invoiceCount: 0,
      unpaidCount: 0,
    };

  const recoveryNum = parseFloat(activeStats.recoveryRate) || 0;

  return (
    <div className="space-y-4">
      {/* Currency Switcher if multiple currencies exist */}
      {activeCurrencies.length > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2 bg-muted/40 p-2.5 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Coins className="w-4 h-4 text-primary" />
            <span>{t('عزل عملات الفوترة المحاسبية:', 'Isolation des devises comptables :')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {activeCurrencies.map((curr) => {
              const isSelected = selectedCurrency === curr;
              const stats = kpisByCurrency[curr];
              return (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrency(curr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  <span>{curr}</span>
                  <span className="ms-1.5 opacity-70">
                    ({stats?.invoiceCount || 0} {t('فاتورة', 'fac')})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Invoiced */}
        <Card className="relative overflow-hidden border border-border bg-gradient-to-br from-card to-blue-500/5 hover:border-blue-500/40 transition-colors shadow-2xs">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-blue-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-500" />
                {t('إجمالي الفواتير الصادرة', 'Total Facturé (TTC)')}
              </span>
              <Badge variant="outline" className="font-mono text-[11px] border-blue-200 text-blue-700 dark:text-blue-300">
                {activeStats.invoiceCount} {t('فاتورة', 'factures')}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black font-mono tracking-tight text-foreground">
                {Number(activeStats.totalInvoiced).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-sans font-bold text-muted-foreground ms-1.5">{selectedCurrency}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('المستحقات الإجمالية الشاملة للضريبة', 'Montant TTC global exigible')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. Total Collected */}
        <Card className="relative overflow-hidden border border-border bg-gradient-to-br from-card to-emerald-500/5 hover:border-emerald-500/40 transition-colors shadow-2xs">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-emerald-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-500" />
                {t('إجمالي المبالغ المحصلة', 'Total Encaissé')}
              </span>
              <Badge variant="outline" className="font-mono text-[11px] border-emerald-200 text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="w-3 h-3 me-1" />
                {t('تم التسديد', 'Réglé')}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                {Number(activeStats.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-sans font-bold text-muted-foreground ms-1.5">{selectedCurrency}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('المقبوضات المحولة للخزينة والبنوك', 'Encaissements validés en trésorerie')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. Outstanding Balance */}
        <Card className="relative overflow-hidden border border-border bg-gradient-to-br from-card to-rose-500/5 hover:border-rose-500/40 transition-colors shadow-2xs">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-rose-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-500" />
                {t('الديون المتبقية القائمة', 'Créances Restantes')}
              </span>
              <Badge
                variant={activeStats.unpaidCount > 0 ? 'destructive' : 'secondary'}
                className="font-mono text-[11px]"
              >
                {activeStats.unpaidCount} {t('غير مسددة', 'impayées')}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
                {Number(activeStats.totalDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-sans font-bold text-muted-foreground ms-1.5">{selectedCurrency}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('الرصيد المدين القائم قيد التحصيل', 'Solde débiteur à recouvrer')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Recovery Rate */}
        <Card className="relative overflow-hidden border border-border bg-gradient-to-br from-card to-amber-500/5 hover:border-amber-500/40 transition-colors shadow-2xs">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-500" />
                {t('نسبة الاسترداد والتحصيل', 'Taux de Recouvrement')}
              </span>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                {activeStats.recoveryRate}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black font-mono tracking-tight text-foreground">
                {activeStats.recoveryRate}
              </p>
              <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    recoveryNum >= 80
                      ? 'bg-emerald-500'
                      : recoveryNum >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, recoveryNum))}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

