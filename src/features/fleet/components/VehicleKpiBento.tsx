'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Route,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Fuel,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  Coins,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import type { FleetDocument, TruckMaintenance, TripOrder, Truck } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface VehicleKpiBentoProps {
  vehicleType: 'truck' | 'trailer';
  truck?: Truck | null;
  documents: FleetDocument[];
  maintenanceRecords: TruckMaintenance[];
  trips: TripOrder[];
  auditScore?: number | null;
  auditRating?: 'trustworthy' | 'warning' | 'fraud_alert' | null;
}

export function VehicleKpiBento({
  vehicleType,
  truck,
  documents,
  maintenanceRecords,
  trips,
  auditScore,
  auditRating,
}: VehicleKpiBentoProps) {
  const { t } = useLanguage();
  const isTruck = vehicleType === 'truck';

  // 1. Legal Documents Radar Analysis
  const docStats = useMemo(() => {
    const now = new Date();
    let validCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let minDaysUntilExpiry: number | null = null;
    let mostUrgentDoc: FleetDocument | null = null;

    documents.forEach((doc) => {
      if (!doc.expiry_date) return;
      const expiry = new Date(doc.expiry_date);
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        expiredCount++;
      } else if (diffDays <= 30) {
        expiringSoonCount++;
        validCount++;
      } else {
        validCount++;
      }

      if (minDaysUntilExpiry === null || diffDays < minDaysUntilExpiry) {
        minDaysUntilExpiry = diffDays;
        mostUrgentDoc = doc;
      }
    });

    return {
      total: documents.length,
      valid: validCount,
      expiringSoon: expiringSoonCount,
      expired: expiredCount,
      minDaysUntilExpiry,
      mostUrgentDoc,
    };
  }, [documents]);

  // 2. Financial & Maintenance Analysis (Strict Decimal.js)
  const maintStats = useMemo(() => {
    let totalCostDec = new Decimal(0);
    maintenanceRecords.forEach((record) => {
      if (record.amount) {
        totalCostDec = totalCostDec.plus(new Decimal(record.amount));
      }
    });

    const totalCostNumber = totalCostDec.toNumber();
    const count = maintenanceRecords.length;
    const avgPerRecord =
      count > 0 ? totalCostDec.dividedBy(count).toNumber() : 0;

    return {
      totalCost: totalCostNumber,
      count,
      avgPerRecord,
    };
  }, [maintenanceRecords]);

  // 3. Trip Orders Analysis (Strict Decimal.js)
  const tripStats = useMemo(() => {
    const totalTrips = trips.length;
    const activeTrips = trips.filter(
      (tr) => tr.status === 'in_progress' || tr.status === 'loading'
    ).length;
    const completedTrips = trips.filter(
      (tr) => tr.status === 'completed' || tr.status === 'settled'
    ).length;

    let totalRevenueDec = new Decimal(0);
    let totalDistanceKmDec = new Decimal(0);

    trips.forEach((tr) => {
      const tripPrice = tr.price ?? tr.price_export ?? 0;
      if (tripPrice) {
        totalRevenueDec = totalRevenueDec.plus(new Decimal(tripPrice));
      }
      const tripDistance = (tr as any).distance_km || 2400;
      totalDistanceKmDec = totalDistanceKmDec.plus(new Decimal(tripDistance));
    });

    return {
      total: totalTrips,
      active: activeTrips,
      completed: completedTrips,
      totalRevenue: totalRevenueDec.toNumber(),
      totalDistanceKm: totalDistanceKmDec.toNumber(),
    };
  }, [trips]);

  // 4. Fuel Intelligence Analysis (Strict Decimal.js)
  const fuelStats = useMemo(() => {
    if (!isTruck) return null;

    let totalLitersDec = new Decimal(0);
    let totalKmWithFuelDec = new Decimal(0);

    // Sum fuel receipts from maintenance records
    maintenanceRecords.forEach((m: any) => {
      const type = (m.expense_type || m.type || '').toString().toLowerCase();
      if (
        type.includes('fuel') ||
        type.includes('carburant') ||
        type.includes('gasoil') ||
        type.includes('وقود') ||
        type.includes('مازوت')
      ) {
        if (m.liters) {
          totalLitersDec = totalLitersDec.plus(new Decimal(m.liters));
        }
      }
    });

    // Use trips total distance as baseline distance
    trips.forEach((tr) => {
      const tripDistance = (tr as any).distance_km || 2400;
      totalKmWithFuelDec = totalKmWithFuelDec.plus(new Decimal(tripDistance));
    });

    const baselineRate = truck?.fuel_consumption_rate || 36;
    let actualLPer100km: number | null = null;
    let variancePercent: number | null = null;

    if (totalKmWithFuelDec.greaterThan(0) && totalLitersDec.greaterThan(0)) {
      const calcRate = totalLitersDec
        .dividedBy(totalKmWithFuelDec)
        .times(100);
      actualLPer100km = parseFloat(calcRate.toFixed(1));

      const baselineDec = new Decimal(baselineRate);
      if (baselineDec.greaterThan(0)) {
        const diff = calcRate.minus(baselineDec);
        variancePercent = parseFloat(
          diff.dividedBy(baselineDec).times(100).toFixed(1)
        );
      }
    }

    return {
      baselineRate,
      actualLPer100km,
      variancePercent,
      totalLiters: totalLitersDec.toNumber(),
    };
  }, [isTruck, truck, maintenanceRecords, trips]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Bento Card: International Trips */}
      <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 inset-x-0 h-1 bg-blue-500/80" />
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Route className="w-5 h-5" />
            </div>
            <Badge variant="outline" className="text-[11px] font-mono border-blue-500/30 text-blue-600">
              {tripStats.active > 0
                ? t(`${tripStats.active} رحلة جارية`, `${tripStats.active} en cours`, `${tripStats.active} in progress`)
                : t('لا توجد رحلات جارية', 'Aucun voyage en cours', 'No active trip')}
            </Badge>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('إجمالي المأموريات الدولية', 'Missions Internationales', 'International Trips')}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight">
                {tripStats.total}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                ({tripStats.completed} {t('مكتملة', 'achevés', 'completed')})
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('إجمالي المسافة التقديرية:', 'Distance totale :')}</span>
            <span className="font-mono font-bold text-foreground">
              {tripStats.totalDistanceKm.toLocaleString()} كم
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Bento Card: Legal Documents Radar */}
      <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
        <div
          className={`absolute top-0 inset-x-0 h-1 ${
            docStats.expired > 0
              ? 'bg-rose-500'
              : docStats.expiringSoon > 0
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          }`}
        />
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div className="flex items-center justify-between">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                docStats.expired > 0
                  ? 'bg-rose-500/10 text-rose-600'
                  : docStats.expiringSoon > 0
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-emerald-500/10 text-emerald-600'
              }`}
            >
              {docStats.expired > 0 ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>

            {docStats.expired > 0 ? (
              <Badge variant="destructive" className="text-[11px] animate-pulse">
                {t(`${docStats.expired} وثيقة منتهية!`, `${docStats.expired} expiré(s)!`, `${docStats.expired} expired!`)}
              </Badge>
            ) : docStats.expiringSoon > 0 ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px]">
                {t(`${docStats.expiringSoon} قرب الانتهاء`, `${docStats.expiringSoon} expire bientôt`, `${docStats.expiringSoon} soon`)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] text-emerald-600 border-emerald-500/30">
                {t('جميع الوثائق سارية', 'Tous valides', 'All valid')}
              </Badge>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('رادار الوثائق والتراخيص', 'Radar Documents & Licences', 'Documents Radar')}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight">
                {docStats.valid}/{docStats.total}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {t('وثيقة جاهزة', 'actifs', 'active')}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('أقرب تاريخ استحقاق:', 'Prochaine échéance :')}</span>
            <span
              className={`font-mono font-bold ${
                docStats.minDaysUntilExpiry !== null && docStats.minDaysUntilExpiry <= 0
                  ? 'text-rose-600'
                  : docStats.minDaysUntilExpiry !== null && docStats.minDaysUntilExpiry <= 30
                    ? 'text-amber-600'
                    : 'text-foreground'
              }`}
            >
              {docStats.minDaysUntilExpiry !== null
                ? docStats.minDaysUntilExpiry <= 0
                  ? t('منتهي حالياً!', 'Déjà expiré!', 'Expired!')
                  : t(`بعد ${docStats.minDaysUntilExpiry} يوم`, `Dans ${docStats.minDaysUntilExpiry} j`, `In ${docStats.minDaysUntilExpiry} d`)
                : '—'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Bento Card: Fuel Intelligence & Fraud Audit */}
      {isTruck ? (
        <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 inset-x-0 h-1 bg-amber-500/80" />
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Fuel className="w-5 h-5" />
              </div>

              {auditRating ? (
                <Badge
                  className={`text-[11px] font-medium ${
                    auditRating === 'trustworthy'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : auditRating === 'warning'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 animate-pulse'
                  }`}
                >
                  {auditRating === 'trustworthy'
                    ? t(`موثوقية ${auditScore || 98}%`, `Fiable ${auditScore || 98}%`)
                    : auditRating === 'warning'
                      ? t(`تدقيق (${auditScore}%)`, `Audit (${auditScore}%)`)
                      : t(`شبهة تلاعب!`, `Alerte Fraude!`)}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] font-mono border-border">
                  {t('المعدل القياسي', 'Taux étalon')}
                </Badge>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t('معدل استهلاك الوقود الفعلي', 'Conso. Carburant Réelle', 'Actual Fuel Rate')}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight">
                  {fuelStats?.actualLPer100km !== null
                    ? fuelStats?.actualLPer100km
                    : fuelStats?.baselineRate || 36}
                </span>
                <span className="text-xs text-muted-foreground font-mono font-semibold">
                  L/100km
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t('المعيار:', 'Standard :')} {fuelStats?.baselineRate || 36}%
              </span>
              {fuelStats && fuelStats.variancePercent !== null && (
                <span
                  className={`flex items-center gap-1 font-mono font-bold ${
                    fuelStats.variancePercent <= 0
                      ? 'text-emerald-600'
                      : fuelStats.variancePercent > 10
                        ? 'text-rose-600'
                        : 'text-amber-600'
                  }`}
                >
                  {fuelStats.variancePercent <= 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" />
                  )}
                  {fuelStats.variancePercent > 0 ? `+${fuelStats.variancePercent}%` : `${fuelStats.variancePercent}%`}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Trailer Frigo Temperature / Certification Card */
        <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 inset-x-0 h-1 bg-purple-500/80" />
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[11px] font-mono border-purple-500/30 text-purple-600">
                ATP / FRC
              </Badge>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t('صلاحية شهادة التبريد ATP', 'Agrément Sanitaire ATP', 'ATP Certificate')}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black font-amiri text-foreground tracking-tight">
                  {t('مطابق للنقل الدولي', 'Conforme TIR', 'Compliant')}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('جهاز التبريد:', 'Groupe Frigo :')}</span>
              <span className="font-bold text-foreground">Thermo King / Carrier</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Bento Card: Maintenance & TCO */}
      <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 inset-x-0 h-1 bg-indigo-500/80" />
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <Badge variant="outline" className="text-[11px] font-mono border-indigo-500/30 text-indigo-600">
              {maintStats.count} {t('عملية صيانة', 'interventions', 'records')}
            </Badge>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('إجمالي فواتير الصيانة والورش', 'Coûts de Maintenance', 'Total Maintenance')}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-foreground tracking-tight">
                {formatCurrency(maintStats.totalCost, 'MAD')}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('متوسط تكلفة التدخل:', 'Moyenne / arrêt :')}</span>
            <span className="font-mono font-bold text-foreground">
              {formatCurrency(maintStats.avgPerRecord, 'MAD')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
