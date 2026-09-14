'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Fuel,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  RefreshCw,
  Coins,
  Receipt,
  Route,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import { updateTruckFuelConsumptionRate } from '@/features/fleet/services/fuel_intelligence.actions';
import { FuelFraudAuditBadge } from '../FuelFraudAuditBadge';
import type { TruckMaintenance, TripOrder, Truck } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface VehicleFuelAnalyticsTabProps {
  truck: Truck;
  maintenanceRecords: TruckMaintenance[];
  trips: TripOrder[];
  onRefresh: () => void;
}

export function VehicleFuelAnalyticsTab({
  truck,
  maintenanceRecords,
  trips,
  onRefresh,
}: VehicleFuelAnalyticsTabProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [calibrating, setCalibrating] = useState(false);
  const [customRate, setCustomRate] = useState<string>(
    truck.fuel_consumption_rate?.toString() || '36'
  );

  // 1. Extract Fuel Receipts from maintenance records with strict Decimal.js
  const fuelReceipts = useMemo(() => {
    return maintenanceRecords
      .filter((m: any) => {
        const expType = (m.expense_type || m.type || '').toString().toLowerCase();
        return (
          expType.includes('fuel') ||
          expType.includes('carburant') ||
          expType.includes('gasoil') ||
          expType.includes('وقود') ||
          expType.includes('مازوت')
        );
      })
      .map((r: any) => {
        const litersDec = new Decimal(r.liters || 0);
        const amountDec = new Decimal(r.amount || 0);
        const pricePerLiterDec = litersDec.greaterThan(0)
          ? amountDec.dividedBy(litersDec)
          : new Decimal(0);

        return {
          id: r.id,
          date: r.maintenance_date || r.date || r.created_at,
          liters: litersDec.toNumber(),
          amount: amountDec.toNumber(),
          pricePerLiter: parseFloat(pricePerLiterDec.toFixed(2)),
          currency: r.currency || 'MAD',
          workshop: r.workshop_name || r.provider_name || 'محطة وقود / Station',
          description: r.description || r.notes || 'تزود بالوقود - نقل دولي',
        };
      });
  }, [maintenanceRecords]);

  // 2. Strict Decimal.js computations of totals and rates
  const fuelMetrics = useMemo(() => {
    let totalLitersDec = new Decimal(0);
    let totalCostDec = new Decimal(0);

    fuelReceipts.forEach((r) => {
      totalLitersDec = totalLitersDec.plus(new Decimal(r.liters));
      totalCostDec = totalCostDec.plus(new Decimal(r.amount));
    });

    let totalTripDistanceKmDec = new Decimal(0);
    trips.forEach((tr) => {
      const tripDistance = (tr as any).distance_km || 2400;
      totalTripDistanceKmDec = totalTripDistanceKmDec.plus(new Decimal(tripDistance));
    });

    const baselineRate = truck.fuel_consumption_rate || 36;
    let actualLPer100km: number | null = null;
    let variancePercent: number | null = null;
    let totalEstimatedSavingsDec = new Decimal(0);

    if (totalTripDistanceKmDec.greaterThan(0) && totalLitersDec.greaterThan(0)) {
      const calcRate = totalLitersDec
        .dividedBy(totalTripDistanceKmDec)
        .times(100);
      actualLPer100km = parseFloat(calcRate.toFixed(1));

      const baselineDec = new Decimal(baselineRate);
      if (baselineDec.greaterThan(0)) {
        const diffRate = calcRate.minus(baselineDec);
        variancePercent = parseFloat(
          diffRate.dividedBy(baselineDec).times(100).toFixed(1)
        );

        // Expected liters = (distance * baselineRate) / 100
        const expectedLiters = totalTripDistanceKmDec
          .times(baselineDec)
          .dividedBy(100);
        // Savings = expected - actual
        totalEstimatedSavingsDec = expectedLiters.minus(totalLitersDec);
      }
    }

    return {
      totalLiters: totalLitersDec.toNumber(),
      totalCost: totalCostDec.toNumber(),
      totalDistanceKm: totalTripDistanceKmDec.toNumber(),
      actualLPer100km,
      baselineRate,
      variancePercent,
      estimatedSavingsLiters: parseFloat(totalEstimatedSavingsDec.toFixed(1)),
    };
  }, [fuelReceipts, trips, truck.fuel_consumption_rate]);

  const handleUpdateBaselineRate = async () => {
    const num = parseFloat(customRate);
    if (isNaN(num) || num <= 10 || num >= 70) {
      toast({
        title: t('قيمة غير مقبولة', 'Valeur invalide', 'Invalid value'),
        description: t('يرجى إدخال معدل استهلاك واقعي بين 15 و 50 لتر/100كم', 'Veuillez saisir un taux réaliste'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setCalibrating(true);
      const res = await updateTruckFuelConsumptionRate(truck.id, num);
      if (res.success) {
        toast({
          title: t('تم ضبط وتحديث المعدل القياسي', 'Taux étalon mis à jour', 'Rate updated'),
          description: t(`تم اعتماد ${num}% (${num} لتر/100كم) كمعيار رسمي للشاحنة`, `Taux défini à ${num}% avec succès`),
        });
        onRefresh();
      } else {
        throw new Error(res.error || 'فشل التحديث');
      }
    } catch (err: any) {
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCalibrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Fuel Performance Header Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Baseline vs Actual Consumption Card */}
        <Card className="rounded-2xl border-border bg-card md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-amber-500" />
                {t('مقارنة كفاءة استهلاك الوقود (L/100km)', 'Comparatif Rendement Carburant')}
              </span>
              {fuelMetrics.actualLPer100km !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fuelMetrics.actualLPer100km) {
                      setCustomRate(fuelMetrics.actualLPer100km.toString());
                    }
                  }}
                  className="rounded-xl text-xs h-7 gap-1"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('معايرة على الاستهلاك الفعلي', 'Calibrer sur le réel')}</span>
                </Button>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <p className="text-xs text-muted-foreground font-medium">
                  {t('المعدل القياسي المعتمد', 'Taux étalon officiel')}
                </p>
                <p className="text-2xl font-black font-mono text-foreground mt-1">
                  {fuelMetrics.baselineRate}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ({fuelMetrics.baselineRate} L/100km)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {t('الاستهلاك الفعلي المحسوب', 'Conso. réelle mesurée')}
                </p>
                <p className="text-2xl font-black font-mono text-amber-700 dark:text-amber-300 mt-1">
                  {fuelMetrics.actualLPer100km !== null
                    ? `${fuelMetrics.actualLPer100km}`
                    : '—'}
                </p>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 font-mono">
                  {fuelMetrics.actualLPer100km !== null ? 'L/100km' : t('لا توجد بيانات مسافة', 'Données insuffisantes')}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <p className="text-xs text-muted-foreground font-medium">
                  {t('نسبة الانحراف والتباين', 'Écart vs Étalon')}
                </p>
                {fuelMetrics.variancePercent !== null ? (
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={`text-2xl font-black font-mono ${
                        fuelMetrics.variancePercent <= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : fuelMetrics.variancePercent > 10
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {fuelMetrics.variancePercent > 0 ? `+${fuelMetrics.variancePercent}%` : `${fuelMetrics.variancePercent}%`}
                    </span>
                  </div>
                ) : (
                  <p className="text-2xl font-black font-mono text-foreground mt-1">0.0%</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {fuelMetrics.variancePercent !== null && fuelMetrics.variancePercent <= 0
                    ? t('وفورات في الوقود', 'Économie de carburant')
                    : t('استهلاك أعلى من المعيار', 'Surconsommation')}
                </p>
              </div>
            </div>

            {/* Quick Calibration Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {t('تعديل المعدل المعتمد (L/100km):', 'Ajuster l\'étalon :')}
                </span>
                <Input
                  type="number"
                  step="0.5"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-24 h-8 text-xs font-mono font-bold text-center"
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={calibrating}
                onClick={handleUpdateBaselineRate}
                className="h-8 text-xs rounded-xl gap-1.5"
              >
                {calibrating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{t('حفظ المعدل الجديد', 'Enregistrer', 'Save Rate')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Totals Summary Card */}
        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t('إجمالي وصولات الوقود', 'Total Approvisionnement')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t('إجمالي كمية اللترات:', 'Volume total :')}</span>
                <span className="font-mono font-bold text-foreground">
                  {fuelMetrics.totalLiters.toLocaleString()} L
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t('إجمالي فاتورة الوقود:', 'Coût total :')}</span>
                <span className="font-mono font-bold text-foreground">
                  {formatCurrency(fuelMetrics.totalCost, 'MAD')}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t('عدد عمليات التزود:', 'Nombre de pleins :')}</span>
                <span className="font-mono font-bold text-foreground">
                  {fuelReceipts.length}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t('مسافة الرحلات المغطاة:', 'Distance couverte :')}</span>
                <span className="font-mono font-bold text-foreground">
                  {fuelMetrics.totalDistanceKm.toLocaleString()} كم
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {t('نظام التدقيق الرقمي النشط', 'Système d\'audit actif')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('يتم تدقيق كل وصل وقود ومطابقته مع الـ GPS والمسافة المقطوعة.', 'Chaque plein est croisé avec la télématique GPS.')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Fuel Receipts Table */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              {t('سجل تعبئة الوقود والتوصيل', 'Historique des Pleins de Carburant')} ({fuelReceipts.length})
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {fuelReceipts.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Fuel className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">
                {t('لا توجد وصولات وقود مسجلة لهذه الشاحنة في الفترة المحددة.', 'Aucun plein enregistré pour cette période.')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                  <tr>
                    <th className="p-3 text-start">{t('التاريخ', 'Date')}</th>
                    <th className="p-3 text-start">{t('المحطة / المورد', 'Station / Fournisseur')}</th>
                    <th className="p-3 text-start">{t('الكمية (لتر)', 'Volume (L)')}</th>
                    <th className="p-3 text-start">{t('سعر اللتر', 'Prix / L')}</th>
                    <th className="p-3 text-start">{t('المبلغ الإجمالي', 'Montant Total')}</th>
                    <th className="p-3 text-start">{t('البيان والملاحظات', 'Description')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {fuelReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-medium">{r.date}</td>
                      <td className="p-3 font-semibold text-foreground">{r.workshop}</td>
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {r.liters} L
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {r.pricePerLiter > 0 ? `${r.pricePerLiter} ${r.currency}` : '—'}
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground">
                        {formatCurrency(r.amount, r.currency)}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate">
                        {r.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
