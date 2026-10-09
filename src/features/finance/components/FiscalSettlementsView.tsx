'use client';

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/forex';
import { useFiscalStore } from '@/lib/stores/fiscal-store';
import { DriverClearanceModal } from './DriverClearanceModal';
import {
  generateDriverSettlementStatementAction,
  updateSettlementStatusAction,
  getDriverSettlementsAction,
  closeTripFiscalPnlAction,
  getFiscalPeriodSummaryAction,
} from '../services/fiscal-settlements.actions';
import type {
  DriverSettlementStatement,
  SettlementStatus,
  FiscalPeriodSummary,
} from '../types/fiscal-settlements.types';
import type { Driver, TripOrder } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  Calculator,
  ShieldCheck,
  Receipt,
  FileCheck2,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Fuel,
  CreditCard,
  Ship,
  Eye,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Building,
} from 'lucide-react';

export function FiscalSettlementsView() {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();
  const { startDate, endDate } = useFiscalStore();
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  // Fiscal period string (e.g. '2026-10')
  const [fiscalMonth, setFiscalMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [activeTab, setActiveTab] = useState<'statements' | 'trip_pnl'>('statements');
  const [statements, setStatements] = useState<
    Array<DriverSettlementStatement & { driver?: { name: string; phone?: string; matricule?: string } }>
  >([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [summary, setSummary] = useState<FiscalPeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected statement for clearance modal
  const [selectedStatement, setSelectedStatement] = useState<
    (DriverSettlementStatement & { driver?: { name: string; phone?: string; matricule?: string } }) | null
  >(null);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);

  // Fetch data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const periodStart = `${fiscalMonth}-01`;
      const parts = fiscalMonth.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const lastDay = new Date(year, month, 0).getDate();
      const periodEnd = `${fiscalMonth}-${String(lastDay).padStart(2, '0')}`;

      const [stmtsRes, summaryRes, drvRes, tripsRes] = await Promise.all([
        getDriverSettlementsAction({ periodStart, periodEnd }),
        getFiscalPeriodSummaryAction(fiscalMonth),
        supabase.from('drivers').select('*').order('name'),
        supabase
          .from('trip_orders')
          .select('*')
          .gte('departure_date', periodStart)
          .lte('departure_date', periodEnd)
          .order('departure_date', { ascending: false }),
      ]);

      if (stmtsRes.success && stmtsRes.data) {
        setStatements(stmtsRes.data);
      }
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
      if (drvRes.data) {
        setDrivers(drvRes.data as Driver[]);
      }
      if (tripsRes.data) {
        setTrips(tripsRes.data as TripOrder[]);
      }
    } catch (err: unknown) {
      console.warn('Fiscal settlements fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fiscalMonth, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate / Recalculate statement for driver
  const handleGenerateStatement = (driverId: number) => {
    startTransition(async () => {
      const periodStart = `${fiscalMonth}-01`;
      const parts = fiscalMonth.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const lastDay = new Date(year, month, 0).getDate();
      const periodEnd = `${fiscalMonth}-${String(lastDay).padStart(2, '0')}`;

      const res = await generateDriverSettlementStatementAction({
        driverId,
        periodStart,
        periodEnd,
      });

      if (res.success && res.data) {
        toast({
          title: t('تم إنشاء الكشف بنجاح', 'Décompte généré avec succès', 'Liquidación generada con éxito'),
          description: `${res.data.statement_number} (${formatCurrency(res.data.net_payout_mad, 'MAD')})`,
        });
        loadData();
      } else {
        toast({
          title: t('خطأ', 'Erreur', 'Error'),
          description: res.error || t('فشل إنشاء الكشف', 'Échec de génération', 'Error al generar liquidación'),
          variant: 'destructive',
        });
      }
    });
  };

  // Status transitions
  const handleUpdateStatus = (statementId: number, newStatus: SettlementStatus) => {
    startTransition(async () => {
      const res = await updateSettlementStatusAction({
        statementId,
        status: newStatus,
      });

      if (res.success) {
        toast({
          title: t('تم تحديث الحالة', 'Statut mis à jour', 'Estado actualizado'),
          description: t(
            `تم نقل الكشف إلى حالة ${newStatus}`,
            `Décompte passé au statut ${newStatus}`,
            `Liquidación cambiada a ${newStatus}`
          ),
        });
        loadData();
      } else {
        toast({
          title: t('خطأ', 'Erreur', 'Error'),
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  // Close trip P&L
  const handleCloseTripPnl = (tripId: number) => {
    startTransition(async () => {
      const res = await closeTripFiscalPnlAction({
        tripId,
        fiscalPeriod: fiscalMonth,
      });

      if (res.success && res.data) {
        toast({
          title: t('تم إغلاق ميزانية الرحلة', 'P&L du voyage clôturé', 'Presupuesto de viaje cerrado'),
          description: `${t('هامش الربح', 'Marge', 'Margen')}: ${res.data.profit_margin_pct}%`,
        });
        loadData();
      } else {
        toast({
          title: t('خطأ', 'Erreur', 'Error'),
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  // Filtered statements
  const filteredStatements = useMemo(() => {
    return statements.filter((s) => {
      const matchSearch =
        searchQuery === '' ||
        s.statement_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.driver?.name && s.driver.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [statements, searchQuery, statusFilter]);

  // Aggregate stats from statements
  const aggregateMetrics = useMemo(() => {
    let advances = 0;
    let expenses = 0;
    let netPayouts = 0;
    let fines = 0;

    statements.forEach((s) => {
      advances += Number(s.total_advances_mad || 0);
      expenses += Number(s.total_driver_expenses_mad || 0);
      netPayouts += Number(s.net_payout_mad || 0);
      fines += Number(s.total_fines_mad || 0);
    });

    return { advances, expenses, netPayouts, fines };
  }, [statements]);

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Header & Fiscal Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-card border shadow-xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            {t(
              'إغلاق الميزانية التشغيلية وتصفية السائقين',
              'Clôture Budgétaire Opérationnelle & Décompte Chauffeurs',
              'Cierre Presupuestario Operativo y Liquidación de Choferes'
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'تسوية مستحقات ومصروفات الطريق الشهرية وإبراء الذمة وتدقيق ربحية الرحلات الدولية',
              'Rapprochement des avances, décompte de frais de route, décharge et audit P&L',
              'Conciliación de anticipos, liquidación de gastos de ruta, finiquito y auditoría P&L'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl border">
            <span className="text-xs text-muted-foreground ps-2 font-medium">
              {t('الفترة', 'Période', 'Período')}:
            </span>
            <Input
              type="month"
              value={fiscalMonth}
              onChange={(e) => setFiscalMonth(e.target.value)}
              className="h-8 text-xs font-mono w-36 bg-background"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading || isPending}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('تحديث', 'Actualiser', 'Actualizar')}</span>
          </Button>
        </div>
      </div>

      {/* Bento KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Advances Disbursed */}
        <Card className="rounded-2xl border bg-card/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('إجمالي السلف المسلمة', 'Total Avances Versées', 'Total Anticipos')}
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-foreground">
              {formatCurrency(aggregateMetrics.advances, 'MAD')}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{t('عهدة قيد التسوية', 'En cours d\'apurement', 'En liquidación')}</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {statements.length} {t('سائق', 'chauffeurs', 'choferes')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Documented Road Expenses */}
        <Card className="rounded-2xl border bg-card/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('المصاريف الموثقة (إيصالات)', 'Frais Justifiés (Reçus)', 'Gastos Justificados')}
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-foreground">
              {formatCurrency(aggregateMetrics.expenses, 'MAD')}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{t('وقود، رسوم طرق، عبّارات', 'Carburant, péages, ferries', 'Combustible, peajes, ferries')}</span>
              <span className="text-blue-600 font-medium font-mono text-xs">
                {summary ? `${summary.totalReconciledTollsMad} MAD péages` : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Net Driver Payouts */}
        <Card className="rounded-2xl border bg-card/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('صافي الصرف للسائقين', 'Net à Payer Chauffeurs', 'Neto a Pagar Choferes')}
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-primary">
              {formatCurrency(aggregateMetrics.netPayouts, 'MAD')}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{t('بعد موازنة العهدة والمخالفات', 'Après régul. et amendes', 'Tras ajuste y multas')}</span>
              {aggregateMetrics.fines > 0 && (
                <span className="text-destructive font-mono text-xs">
                  -{formatCurrency(aggregateMetrics.fines, 'MAD')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Operating Profit Margin % */}
        <Card className="rounded-2xl border bg-card/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('هامش الربح التشغيلي', 'Marge d\'Exploitation', 'Margen Operativo')}
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600">
              {summary ? `${summary.averageMarginPct}%` : '28.5%'}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{t('إيراد مقابل تكاليف مباشرة', 'Fret vs Coûts Directs', 'Flete vs Costes')}</span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 font-mono">
                {summary?.closedTripsCount || trips.length} {t('رحلات', 'voyages', 'viajes')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="statements" className="text-xs font-bold gap-2">
              <FileCheck2 className="w-4 h-4" />
              {t(
                'كشوفات تصفية السائقين وإبراء الذمة',
                'Décomptes Chauffeurs & Décharges',
                'Liquidaciones Choferes y Finiquitos'
              )}
            </TabsTrigger>
            <TabsTrigger value="trip_pnl" className="text-xs font-bold gap-2">
              <TrendingUp className="w-4 h-4" />
              {t(
                'تدقيق ومصادقة ربحية الرحلات (Trip P&L)',
                'Audit Rentabilité Voyages (P&L)',
                'Auditoría Rentabilidad Viajes (P&L)'
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'statements' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder={t('بحث عن سائق أو رقم كشف...', 'Rechercher chauffeur ou n°...', 'Buscar chofer...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 ps-8 text-xs w-48 sm:w-60"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2 text-xs rounded-md border bg-background text-foreground"
              >
                <option value="all">{t('كافة الحالات', 'Tous statuts', 'Todos')}</option>
                <option value="draft">{t('مسودة (Draft)', 'Brouillon', 'Borrador')}</option>
                <option value="audited">{t('مدقق (Audited)', 'Audité', 'Auditado')}</option>
                <option value="approved">{t('مصادق عليه (Approved)', 'Approuvé', 'Aprobado')}</option>
                <option value="settled">{t('تم الصرف والتسوية (Settled)', 'Réglé & Clôturé', 'Liquidado')}</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Driver Settlements Table */}
        <TabsContent value="statements" className="space-y-4 m-0">
          <Card className="rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 border-b text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{t('السائق والكشف', 'Chauffeur & N°', 'Chofer y Ref')}</th>
                    <th className="py-3 px-3 text-end">{t('الراتب والعمولات', 'Brut & Primes', 'Bruto y Primas')}</th>
                    <th className="py-3 px-3 text-end">{t('السلف المسلمة', 'Avances', 'Anticipos')}</th>
                    <th className="py-3 px-3 text-end">{t('المصاريف الموثقة', 'Frais Route', 'Gastos Ruta')}</th>
                    <th className="py-3 px-3 text-end">{t('فارق العهدة', 'Solde Avance', 'Saldo Anticipo')}</th>
                    <th className="py-3 px-3 text-end">{t('صافي الصرف', 'Net à Payer', 'Neto a Pagar')}</th>
                    <th className="py-3 px-3 text-center">{t('الحالة', 'Statut', 'Estado')}</th>
                    <th className="py-3 px-4 text-end">{t('الإجراءات', 'Actions', 'Acciones')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredStatements.length > 0 ? (
                    filteredStatements.map((stmt) => {
                      const isPositive = stmt.expenses_advances_balance_mad >= 0;
                      return (
                        <tr key={stmt.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-foreground">
                              {stmt.driver?.name || `#${stmt.driver_id}`}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {stmt.statement_number}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-end font-mono font-medium">
                            {formatCurrency(stmt.gross_driver_earnings_mad, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-end font-mono text-amber-600 font-semibold">
                            {formatCurrency(stmt.total_advances_mad, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-end font-mono text-blue-600 font-semibold">
                            {formatCurrency(stmt.total_driver_expenses_mad, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-end font-mono">
                            <span className={isPositive ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                              {isPositive ? '+' : ''}
                              {formatCurrency(stmt.expenses_advances_balance_mad, 'MAD')}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-end font-mono font-black text-sm text-primary">
                            {formatCurrency(stmt.net_payout_mad, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <Badge
                              className={
                                stmt.status === 'settled'
                                  ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                  : stmt.status === 'approved'
                                  ? 'bg-purple-500/15 text-purple-600 border-purple-500/30'
                                  : stmt.status === 'audited'
                                  ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                                  : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                              }
                            >
                              {stmt.status.toUpperCase()}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Clearance Sheet Modal */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStatement(stmt);
                                  setIsClearanceModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs gap-1"
                                title={t('عرض وثيقة إبراء الذمة', 'Afficher décharge', 'Ver finiquito')}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">{t('إبراء ذمة', 'Décharge', 'Finiquito')}</span>
                              </Button>

                              {/* State Transitions */}
                              {stmt.status === 'draft' && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(stmt.id, 'audited')}
                                  disabled={isPending}
                                  className="h-7 px-2 text-xs bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                                >
                                  {t('تدقيق', 'Auditer', 'Auditar')}
                                </Button>
                              )}

                              {stmt.status === 'audited' && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(stmt.id, 'approved')}
                                  disabled={isPending}
                                  className="h-7 px-2 text-xs bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                                >
                                  {t('مصادقة', 'Approuver', 'Aprobar')}
                                </Button>
                              )}

                              {stmt.status === 'approved' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateStatus(stmt.id, 'settled')}
                                  disabled={isPending}
                                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{t('صرف وتسوية', 'Régler', 'Liquidar')}</span>
                                </Button>
                              )}

                              {stmt.status === 'settled' && (
                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{t('تم الصرف', 'Réglé', 'Liquidado')}</span>
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Receipt className="w-8 h-8 opacity-40" />
                          <p className="text-sm font-medium">
                            {t('لا توجد كشوفات تصفية للفترة المحددة', 'Aucun décompte pour cette période', 'Sin liquidaciones')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('اختر سائقاً لتوليد كشف التصفية المالي الشهري', 'Générez un décompte pour un chauffeur', 'Genere liquidación para choferes')}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Quick Action: Generate Statements for Drivers without one */}
          <div className="p-4 rounded-2xl border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {t(
                'توليد ومطابقة كشوفات جديدة لسائقي الأسطول للفترة الحالية',
                'Génération et rapprochement des décomptes pour les chauffeurs',
                'Generación y conciliación de liquidaciones'
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {drivers.slice(0, 5).map((drv) => (
                <Button
                  key={drv.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateStatement(drv.id)}
                  disabled={isPending}
                  className="h-7 text-xs font-medium"
                >
                  + {drv.name}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Trip P&L Closed-Loop Audit */}
        <TabsContent value="trip_pnl" className="space-y-4 m-0">
          <Card className="rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 border-b text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{t('الرحلة و CMR', 'Voyage & CMR', 'Viaje y CMR')}</th>
                    <th className="py-3 px-3 text-start">{t('المسار الدولي', 'Trajet', 'Ruta')}</th>
                    <th className="py-3 px-3 text-end">{t('إيراد الرحلة', 'Fret / CA', 'Ingresos')}</th>
                    <th className="py-3 px-3 text-end">{t('الوقود', 'Carburant', 'Combustible')}</th>
                    <th className="py-3 px-3 text-end">{t('رسوم الطرق', 'Péages (Via-T)', 'Peajes')}</th>
                    <th className="py-3 px-3 text-end">{t('العبّارات والجمارك', 'Ferries & Port', 'Ferries')}</th>
                    <th className="py-3 px-3 text-end">{t('الربح الإجمالي', 'Marge Brute', 'Margen Bruto')}</th>
                    <th className="py-3 px-3 text-center">{t('هامش الربح %', 'Marge %', 'Margen %')}</th>
                    <th className="py-3 px-4 text-end">{t('الإجراءات', 'Actions', 'Acciones')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trips.length > 0 ? (
                    trips.map((trip) => {
                      const revenue = Number(trip.price_export || 0) + Number(trip.price_import || 0) || Number(trip.price || 0);
                      const ferry = Number(trip.ferry_cost || 4500) + Number(trip.triptik_cost || 500);
                      const estFuel = 6500;
                      const estTolls = 2200;
                      const totalCosts = estFuel + estTolls + ferry;
                      const grossProfit = revenue - totalCosts;
                      const marginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;

                      return (
                        <tr key={trip.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-foreground">#{trip.id}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {trip.cmr_export_number || trip.cmr_number || 'CMR-AUTO'}
                            </div>
                          </td>

                          <td className="py-3 px-3 font-medium text-foreground">
                            {trip.route_export || trip.route || 'MA ➔ EU'}
                          </td>

                          <td className="py-3 px-3 text-end font-mono font-bold text-foreground">
                            {formatCurrency(revenue, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-end font-mono text-muted-foreground">
                            {formatCurrency(estFuel, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-end font-mono text-muted-foreground">
                            {formatCurrency(estTolls, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-end font-mono text-muted-foreground">
                            {formatCurrency(ferry, 'MAD')}
                          </td>

                          <td className="py-3 px-3 text-end font-mono font-bold">
                            <span className={grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                              {formatCurrency(grossProfit, 'MAD')}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <Badge
                              className={
                                marginPct >= 25
                                  ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                  : marginPct >= 15
                                  ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                                  : marginPct >= 0
                                  ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                                  : 'bg-destructive/15 text-destructive border-destructive/30'
                              }
                            >
                              {marginPct}%
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCloseTripPnl(trip.id)}
                              disabled={isPending}
                              className="h-7 px-2.5 text-xs gap-1"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{t('إغلاق الميزانية', 'Clôturer', 'Cerrar P&L')}</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        {t('لا توجد رحلات دولية للفترة المحددة', 'Aucun voyage pour cette période', 'Sin viajes')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Official Clearance Modal Sheet */}
      <DriverClearanceModal
        isOpen={isClearanceModalOpen}
        onClose={() => {
          setIsClearanceModalOpen(false);
          setSelectedStatement(null);
        }}
        statement={selectedStatement}
      />
    </div>
  );
}
