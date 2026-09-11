'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/forex';
import type { ExecutiveKpiSummary } from '../services/executive-metrics.actions';
import { Truck } from '@/components/icons/vehicle-icons';
import {
  TrendingUp,
  DollarSign,
  AlertOctagon,
  Gauge,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

interface ExecutiveKpiWidgetsProps {
  data: ExecutiveKpiSummary;
}

export function ExecutiveKpiWidgets({ data }: ExecutiveKpiWidgetsProps) {
  const { t, dir } = useLanguage();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" dir={dir}>
      <Card className="border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/10 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {t('صافي أرباح التشغيل', "Bénéfice net d'exploitation")}
            </p>
            <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(data.netProfitMAD, 'MAD')}
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              {t('هامش الربح:', 'Marge :')} {data.profitMarginPercent}%
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/10 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              {t('إجمالي المبيعات المفوترة', 'Chiffre d’affaires facturé')}
            </p>
            <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
              {formatCurrency(data.totalRevenueMAD, 'MAD')}
            </p>
            <p className="text-xs font-mono font-semibold text-muted-foreground">
              + {formatCurrency(data.totalRevenueEUR, 'EUR')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/10 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              {t('الديون المعلقة للعملاء', 'Créances clients en cours')}
            </p>
            <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
              {formatCurrency(data.totalOverdueDebtMAD, 'MAD')}
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">
              {data.unpaidInvoicesCount} {t('فواتير قيد التحصيل', 'factures en recouvrement')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {t('نسبة جاهزية وتشغيل الأسطول', 'Taux d’utilisation de la flotte')}
            </p>
            <p className="text-xl font-bold font-mono text-foreground">
              {data.fleetUtilizationRate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                `${data.activeTrucksCount} من أصل ${data.totalTrucksCount} شاحنة في الخدمة`,
                `${data.activeTrucksCount} sur ${data.totalTrucksCount} camions en service`
              )}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {t('إنجاز الرحلات الدولية', 'Exécution des trajets')}
            </p>
            <p className="text-xl font-bold font-mono text-foreground">
              {data.completedTripsCount} / {data.totalTripsCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`${data.activeTripsCount} رحلات جارية حالياً`, `${data.activeTripsCount} trajets en cours`)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {t('متوسط استهلاك الوقود', 'Consommation moyenne de carburant')}
            </p>
            <p className="text-xl font-bold font-mono text-foreground" dir="ltr">
              {data.fleetAverageLitersPer100Km} L/100 km
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {t('ضمن النطاق القياسي المعتمد', 'Dans la norme')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
