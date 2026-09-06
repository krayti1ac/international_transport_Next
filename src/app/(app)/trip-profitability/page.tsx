'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder, Advance, TruckMaintenance, FinePenalty, FerryExpense, Driver, Truck } from '@/types/database';
import { calculateTripFinancials, TripFinancialSummary } from '@/lib/profitability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, DollarSign, Fuel, Search, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';

export default function TripProfitabilityPage() {
  const { t, dir, locale } = useLanguage();
  const [summaries, setSummaries] = useState<TripFinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardLayout, setCardLayout] = useCardViewMode('trip_profitability', 'grid');

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tripsRes, advancesRes, fuelRes, finesRes, ferriesRes, driversRes, trucksRes] = await Promise.all([
        supabase.from('trip_orders').select('*').order('departure_date', { ascending: false }),
        supabase.from('advances').select('*'),
        supabase.from('truck_maintenance').select('*'),
        supabase.from('fine_penalties').select('*'),
        supabase.from('ferry_expenses').select('*'),
        supabase.from('drivers').select('id, name'),
        supabase.from('trucks').select('id, plate_number'),
      ]);

      if (tripsRes.error) throw tripsRes.error;

      const trips = tripsRes.data || [];
      const advances = advancesRes.data || [];
      const fuelRecords = (fuelRes.data || []).filter((r: { expense_type?: string; type?: string }) => {
        const expType = (r.expense_type || r.type || '').toLowerCase();
        return !expType || expType === 'fuel' || expType === 'carburant' || expType === 'gasoil';
      });
      const fines = finesRes.data || [];
      const ferries = ferriesRes.data || [];
      const drivers = driversRes.data || [];
      const trucks = trucksRes.data || [];

      const calculated = trips.map((trip) => {
        const driver = drivers.find((d) => d.id === trip.driver_id);
        const truck = trucks.find((t) => t.id === trip.truck_id);

        return calculateTripFinancials({
          trip,
          advances,
          fuelRecords,
          fines,
          ferries,
          driverName: driver?.name,
          truckPlate: truck?.plate_number,
          distanceKm: 1850,
          fuelLiters: 580,
        });
      });

      setSummaries(calculated);
    } catch (error: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRevenueDec = summaries.reduce(
    (sum, s) => sum.plus(new Decimal(s.revenue || 0)),
    new Decimal(0)
  );
  const totalExpensesDec = summaries.reduce(
    (sum, s) => sum.plus(new Decimal(s.totalExpenses || 0)),
    new Decimal(0)
  );
  const netProfitDec = totalRevenueDec.minus(totalExpensesDec);
  const averageMarginDec = totalRevenueDec.gt(0)
    ? netProfitDec.dividedBy(totalRevenueDec).times(100)
    : new Decimal(0);

  const totalRevenue = totalRevenueDec.toNumber();
  const totalExpenses = totalExpensesDec.toNumber();
  const netProfit = netProfitDec.toNumber();
  const averageMargin = averageMarginDec.toNumber();

  const filtered = summaries.filter((s) => {
    const route = s.route?.toLowerCase() ?? '';
    const cmr = s.cmrNumber?.toLowerCase() ?? '';
    const driver = s.driverName?.toLowerCase() ?? '';
    const truck = s.truckPlate?.toLowerCase() ?? '';
    const query = searchQuery.toLowerCase();
    return route.includes(query) || cmr.includes(query) || driver.includes(query) || truck.includes(query);
  });

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold font-amiri text-foreground">
          {t('أرباح وتحليلات الرحلات والوقود', 'Rentabilité & Analyses des Trajets')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('تحليل صافي الربح الفعلي (P&L) ومعدلات استهلاك الديزل لكل رحلة', 'Analyse du résultat net réel (P&L) et de la consommation de gasoil par trajet')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('إجمالي إيرادات الرحلات', 'Total Chiffre d\'Affaires')}
            </CardTitle>
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{formatCurrency(totalRevenue, 'MAD')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summaries.length} {t('رحلة مسجلة', 'trajets enregistrés')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('إجمالي مصاريف المسارات', 'Total Frais d\'Itinéraires')}
            </CardTitle>
            <Fuel className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{formatCurrency(totalExpenses, 'MAD')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('وقود + سلف + عبّارة + غرامات', 'Gasoil + Avances + Ferry + Pénalités')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('صافي الأرباح المحققة', 'Bénéfice Net Réalisé')}
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
              {formatCurrency(netProfit, 'MAD')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('الأرباح الصافية بعد خصم كافة المصاريف', 'Résultat net après déduction de tous les coûts')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('متوسط هامش الربح', 'Marge Moyenne')}
            </CardTitle>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {averageMargin.toFixed(1)}%
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{averageMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('كفاءة تشغيل الأسطول', 'Efficience opérationnelle de la flotte')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
          <Input
            placeholder={t('بحث بالمسار، رقم CMR، السائق، أو رقم الشاحنة...', 'Rechercher par trajet, N° CMR, conducteur ou matricule...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${dir === 'rtl' ? 'pr-9' : 'pl-9'} h-9 text-xs rounded-xl`}
          />
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('جاري احتساب البيانات المالية...', 'Calcul des données financières en cours...')}</p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isProfitable = item.netProfit >= 0;
            return (
              <Card key={item.tripId} className="hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-amiri font-bold text-foreground">{item.route}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {item.cmrNumber || `${t('رحلة', 'Trajet')} #${item.tripId}`} • {item.departureDate}
                        </CardDescription>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                        isProfitable
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                      }`}>
                        {item.profitMarginPercentage}%
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground items-center">
                      <div>{t('السائق:', 'Conducteur :')} <span className="font-medium text-foreground">{item.driverName || t('غير محدد', 'Non assigné')}</span></div>
                      <div className="flex items-center gap-1">
                        <span>{t('الشاحنة:', 'Véhicule :')}</span>
                        {item.truckPlate ? (
                          <MatriculeBadge plate={item.truckPlate} variant="badge" size="xs" />
                        ) : (
                          <span className="text-foreground">{t('غير محدد', 'Non assigné')}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 p-3 bg-muted/40 rounded-xl border border-border text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('سعر الرحلة (الإيراد):', 'Prix du trajet (CA) :')}</span>
                        <span className="font-bold text-primary font-mono">{formatCurrency(item.revenue, 'MAD')}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('الوقود:', 'Gasoil :')}</span>
                        <span className="font-mono">-{formatCurrency(item.fuelCost, 'MAD')}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('سلف السائق:', 'Avances :')}</span>
                        <span className="font-mono">-{formatCurrency(item.advancesCost, 'MAD')}</span>
                      </div>
                      {item.ferryCost > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t('العبّارة البحرية:', 'Ferry :')}</span>
                          <span className="font-mono">-{formatCurrency(item.ferryCost, 'MAD')}</span>
                        </div>
                      )}
                      {item.finesCost > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>{t('الغرامات:', 'Pénalités :')}</span>
                          <span className="font-mono">-{formatCurrency(item.finesCost, 'MAD')}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-border pt-1.5 font-bold">
                        <span className="text-foreground">{t('صافي ربح الرحلة:', 'Bénéfice net :')}</span>
                        <span className={`font-mono ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {formatCurrency(item.netProfit, 'MAD')}
                        </span>
                      </div>
                    </div>

                    {item.litersPer100Km && (
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Fuel className="w-3.5 h-3.5 text-primary" />
                          {t('معدل استهلاك الديزل:', 'Consommation gasoil :')}
                        </span>
                        <span className="font-mono font-bold flex items-center gap-1">
                          {item.litersPer100Km} L/100km
                          {item.fuelStatus === 'high' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          {item.fuelStatus === 'efficient' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">{t('لا توجد رحلات مطابقة لمعايير البحث', 'Aucun trajet correspondant')}</p>
            </div>
          )}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filtered.map((item) => {
            const isProfitable = item.netProfit >= 0;
            return (
              <Card key={item.tripId} className="hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                  {/* Right: Route & Details */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isProfitable ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'
                    }`}>
                      {isProfitable ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <CardTitle className="text-base font-amiri font-bold text-foreground">{item.route}</CardTitle>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{item.cmrNumber || `${t('رحلة', 'Trajet')} #${item.tripId}`}</span>
                        <span>•</span>
                        <span>{item.departureDate}</span>
                        {item.truckPlate && (
                          <>
                            <span>•</span>
                            <MatriculeBadge plate={item.truckPlate} variant="badge" size="xs" />
                          </>
                        )}
                        {item.driverName && (
                          <>
                            <span>•</span>
                            <span>{item.driverName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Financials */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('الإيراد:', 'CA :')}</span>
                      <span className="font-bold text-foreground font-mono">{formatCurrency(item.revenue, 'MAD')}</span>
                    </div>

                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('التكاليف:', 'Coûts :')}</span>
                      <span className="font-mono text-muted-foreground">
                        -{formatCurrency(item.totalExpenses, 'MAD')}
                      </span>
                    </div>

                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('صافي الربح:', 'Résultat net :')}</span>
                      <span className={`font-mono font-bold ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {formatCurrency(item.netProfit, 'MAD')}
                      </span>
                    </div>

                    {item.litersPer100Km && (
                      <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                        <Fuel className="w-3.5 h-3.5 text-primary" />
                        {item.litersPer100Km} L/100km
                      </span>
                    )}
                  </div>

                  {/* Left: Margin Badge */}
                  <div className="flex items-center justify-end border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                      isProfitable
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                    }`}>
                      {t('هامش:', 'Marge :')} {item.profitMarginPercentage}%
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-muted-foreground">{t('لا توجد رحلات مطابقة لمعايير البحث', 'Aucun trajet correspondant')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
