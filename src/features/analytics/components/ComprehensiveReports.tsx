'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, type ExportColumn } from '@/lib/export';
import {
  DEFAULT_TRIPS,
  DEFAULT_CLIENTS,
  DEFAULT_DRIVERS,
  DEFAULT_TRUCKS,
  DEFAULT_INVOICES,
  fallbackArray,
} from '@/lib/default-data';
import type { TripOrder, Invoice, Truck, Driver, Client } from '@/types/database';
import {
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  Truck as TruckIcon,
  Users,
  Wallet,
  Receipt,
  Route,
  Calendar,
  Layers,
  BarChart3,
  PieChart as PieChartIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  delivered: '#10b981',
  in_transit: '#3b82f6',
  in_progress: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  loaded: '#8b5cf6',
};

const STATUS_LABELS: Record<string, { label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'danger' }> = {
  completed: { label: 'مكتملة', badgeVariant: 'success' },
  delivered: { label: 'تم التسليم', badgeVariant: 'success' },
  in_transit: { label: 'في الطريق', badgeVariant: 'default' },
  in_progress: { label: 'قيد التنفيذ', badgeVariant: 'default' },
  loaded: { label: 'تم التحميل', badgeVariant: 'secondary' },
  pending: { label: 'معلقة / مجدولة', badgeVariant: 'warning' },
  cancelled: { label: 'ملغاة', badgeVariant: 'danger' },
};

const INVOICE_STATUS_LABELS: Record<string, { label: string; badgeVariant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  paid: { label: 'مدفوعة', badgeVariant: 'success' },
  pending: { label: 'معلقة / غير مسددة', badgeVariant: 'warning' },
  overdue: { label: 'متأخرة', badgeVariant: 'destructive' },
  draft: { label: 'مسودة', badgeVariant: 'outline' },
};

const CHART_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function ComprehensiveReports() {
  const { t, dir, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('trips');

  const statusLabels: Record<string, { label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'danger' }> = useMemo(() => ({
    completed: { label: t('مكتملة', 'Terminée'), badgeVariant: 'success' },
    delivered: { label: t('تم التسليم', 'Livrée'), badgeVariant: 'success' },
    in_transit: { label: t('في الطريق', 'En transit'), badgeVariant: 'default' },
    in_progress: { label: t('قيد التنفيذ', 'En cours'), badgeVariant: 'default' },
    loaded: { label: t('تم التحميل', 'Chargée'), badgeVariant: 'secondary' },
    pending: { label: t('معلقة / مجدولة', 'En attente / Planifiée'), badgeVariant: 'warning' },
    cancelled: { label: t('ملغاة', 'Annulée'), badgeVariant: 'danger' },
  }), [t]);

  const invoiceStatusLabels: Record<string, { label: string; badgeVariant: 'success' | 'warning' | 'destructive' | 'outline' }> = useMemo(() => ({
    paid: { label: t('مدفوعة', 'Payée'), badgeVariant: 'success' },
    pending: { label: t('معلقة / غير مسددة', 'En attente / Impayée'), badgeVariant: 'warning' },
    overdue: { label: t('متأخرة', 'En retard'), badgeVariant: 'destructive' },
    draft: { label: t('مسودة', 'Brouillon'), badgeVariant: 'outline' },
  }), [t]);

  // Filter States
  const [period, setPeriod] = useState<'all' | 'today' | 'month' | 'quarter' | 'year'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterTruck, setFilterTruck] = useState<string>('all');

  // Raw Data States
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [advances, setAdvances] = useState<{ id: number; driver_id?: number; amount: number; status: string }[]>([]);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Fetch all comprehensive report datasets
  const fetchReportData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [tripsRes, invoicesRes, trucksRes, driversRes, clientsRes, advancesRes] =
        await Promise.all([
          supabase
            .from('trip_orders')
            .select(`
              *,
              driver:drivers(name),
              truck:trucks(plate_number),
              client:clients(name)
            `)
            .order('id', { ascending: false }),
          supabase
            .from('invoices')
            .select(`
              *,
              client:clients(name)
            `)
            .order('id', { ascending: false }),
          supabase.from('trucks').select('*').order('id', { ascending: true }),
          supabase.from('drivers').select('*').order('id', { ascending: true }),
          supabase.from('clients').select('*').order('name', { ascending: true }),
          supabase.from('driver_advances').select('id, driver_id, amount, status'),
        ]);

      setTrips(fallbackArray(tripsRes.data, DEFAULT_TRIPS));
      setInvoices(fallbackArray(invoicesRes.data, DEFAULT_INVOICES));
      setTrucks(fallbackArray(trucksRes.data, DEFAULT_TRUCKS));
      setDrivers(fallbackArray(driversRes.data, DEFAULT_DRIVERS));
      setClients(fallbackArray(clientsRes.data, DEFAULT_CLIENTS));
      setAdvances((advancesRes.data as { id: number; driver_id?: number; amount: number; status: string }[]) || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'فشل في تحميل بيانات التقارير';
      toast({
        title: 'خطأ في جلب بيانات التقارير',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Period Date Range Filter Helpers
  const isDateInSelectedPeriod = useCallback((dateStr?: string | null) => {
    if (!dateStr || period === 'all') return true;
    const date = new Date(dateStr);
    const now = new Date();

    if (period === 'today') {
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }
    if (period === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (period === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const dateQuarter = Math.floor(date.getMonth() / 3);
      return currentQuarter === dateQuarter && date.getFullYear() === now.getFullYear();
    }
    if (period === 'year') {
      return date.getFullYear() === now.getFullYear();
    }
    return true;
  }, [period]);

  // Filtered Trips
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (!isDateInSelectedPeriod(trip.departure_date)) return false;
      if (filterStatus !== 'all' && trip.status !== filterStatus) return false;
      if (filterClient !== 'all' && String(trip.client_id) !== filterClient) return false;
      if (filterTruck !== 'all' && String(trip.truck_id) !== filterTruck) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const routeMatch = (trip.route || '').toLowerCase().includes(query);
        const cmrMatch = (trip.cmr_number || '').toLowerCase().includes(query);
        const idMatch = String(trip.id).includes(query);
        return routeMatch || cmrMatch || idMatch;
      }
      return true;
    });
  }, [trips, isDateInSelectedPeriod, filterStatus, filterClient, filterTruck, searchQuery]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (!isDateInSelectedPeriod(inv.created_at)) return false;
      if (filterClient !== 'all' && String(inv.client_id) !== filterClient) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const numMatch = (inv.invoice_number || '').toLowerCase().includes(query);
        return numMatch;
      }
      return true;
    });
  }, [invoices, isDateInSelectedPeriod, filterClient, searchQuery]);

  // Financial Aggregations using Decimal.js
  const summaryMetrics = useMemo(() => {
    let revenueMAD = new Decimal(0);
    let revenueEUR = new Decimal(0);
    let totalInvoicedMAD = new Decimal(0);
    let totalPaidInvoicedMAD = new Decimal(0);
    let totalAdvancesMAD = new Decimal(0);

    // Trip Revenues
    filteredTrips.forEach((trip) => {
      const p = new Decimal(trip.price || 0);
      revenueMAD = revenueMAD.plus(p);
    });

    // Invoices
    filteredInvoices.forEach((inv) => {
      const amt = new Decimal(inv.total_amount || 0);
      if (inv.currency === 'EUR') {
        revenueEUR = revenueEUR.plus(amt);
      } else {
        totalInvoicedMAD = totalInvoicedMAD.plus(amt);
        if (inv.status === 'paid') {
          totalPaidInvoicedMAD = totalPaidInvoicedMAD.plus(amt);
        }
      }
    });

    // Advances
    advances.forEach((adv) => {
      const advAmt = new Decimal(adv.amount || 0);
      totalAdvancesMAD = totalAdvancesMAD.plus(advAmt);
    });

    const collectionRate = totalInvoicedMAD.isZero()
      ? new Decimal(100)
      : totalPaidInvoicedMAD.dividedBy(totalInvoicedMAD).times(100);

    const completedTripsCount = filteredTrips.filter(
      (t) => t.status === 'completed' || t.status === 'delivered'
    ).length;

    const completionRate = filteredTrips.length === 0
      ? 100
      : Math.round((completedTripsCount / filteredTrips.length) * 100);

    return {
      revenueMAD: revenueMAD.toNumber(),
      revenueEUR: revenueEUR.toNumber(),
      totalInvoicedMAD: totalInvoicedMAD.toNumber(),
      collectionRate: collectionRate.toFixed(1),
      completedTripsCount,
      completionRate,
      totalAdvancesMAD: totalAdvancesMAD.toNumber(),
    };
  }, [filteredTrips, filteredInvoices, advances]);

  // Chart Data: Status Distribution
  const tripStatusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTrips.forEach((t) => {
      const s = t.status || 'pending';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([statusKey, count], idx) => ({
      name: statusLabels[statusKey]?.label || statusKey,
      value: count,
      color: STATUS_COLORS[statusKey] || CHART_PALETTE[idx % CHART_PALETTE.length],
    }));
  }, [filteredTrips, statusLabels]);

  // Chart Data: Monthly comparison
  const monthlyComparisonData = useMemo(() => {
    const months = [
      t('يناير', 'Jan'), t('فبراير', 'Fév'), t('مارس', 'Mar'), t('أبريل', 'Avr'),
      t('مايو', 'Mai'), t('يونيو', 'Juin'), t('يوليو', 'Juil'), t('أغسطس', 'Août'),
      t('سبتمبر', 'Sep'), t('أكتوبر', 'Oct'), t('نوفمبر', 'Nov'), t('ديسمبر', 'Déc')
    ];
    const map: Record<number, { revenue: InstanceType<typeof Decimal>; trips: number }> = {};

    filteredTrips.forEach((trip) => {
      if (trip.departure_date) {
        const m = new Date(trip.departure_date).getMonth();
        if (!map[m]) map[m] = { revenue: new Decimal(0), trips: 0 };
        map[m].revenue = map[m].revenue.plus(new Decimal(trip.price || 0));
        map[m].trips += 1;
      }
    });

    const result = [];
    const currentMonth = new Date().getMonth();
    for (let i = Math.max(0, currentMonth - 5); i <= currentMonth; i++) {
      result.push({
        month: months[i],
        revenue: Math.round(map[i]?.revenue?.toNumber() || 0),
        trips: map[i]?.trips || 0,
      });
    }
    return result;
  }, [filteredTrips, t]);

  // Export handlers
  const handleExportCSV = () => {
    if (activeTab === 'trips') {
      const cols: ExportColumn<TripOrder>[] = [
        { header: t('رقم الرحلة', 'N° Trajet'), key: 'id' },
        { header: t('رقم CMR', 'N° CMR'), key: (t) => t.cmr_number || '—' },
        { header: t('المسار', 'Trajet'), key: (t) => t.route || '—' },
        { header: t('العميل', 'Client'), key: (t) => (t as any).client?.name || '—' },
        { header: t('السائق', 'Chauffeur'), key: (t) => (t as any).driver?.name || '—' },
        { header: t('الشاحنة', 'Camion'), key: (t) => (t as any).truck?.plate_number || '—' },
        { header: t('تاريخ الانطلاق', 'Date départ'), key: (t) => t.departure_date || '—' },
        { header: t('المبلغ (د.م.)', 'Montant (MAD)'), key: (t) => t.price || 0 },
        { header: t('الحالة', 'Statut'), key: (t) => statusLabels[t.status]?.label || t.status },
      ];
      exportToCSV(filteredTrips, cols, t('تقرير_الرحلات_الشامل', 'Rapport_Trajets_Complet'));
      toast({
        title: t('تم التصدير', 'Export réussi'),
        description: t('تم تنزيل ملف تقرير الرحلات بصيغة CSV بنجاح.', 'Le rapport des trajets CSV a été téléchargé avec succès.')
      });
    } else if (activeTab === 'invoices') {
      const cols: ExportColumn<Invoice>[] = [
        { header: t('رقم الفاتورة', 'N° Facture'), key: 'invoice_number' },
        { header: t('العميل', 'Client'), key: (i) => (i as any).client?.name || '—' },
        { header: t('المبلغ الإجمالي', 'Montant Total'), key: 'total_amount' },
        { header: t('العملة', 'Devise'), key: (i) => i.currency || 'MAD' },
        { header: t('الحالة', 'Statut'), key: (i) => invoiceStatusLabels[i.status]?.label || i.status },
        { header: t('تاريخ الإصدار', 'Date émission'), key: (i) => i.created_at?.split('T')[0] || '—' },
      ];
      exportToCSV(filteredInvoices, cols, t('تقرير_الفواتير_الشامل', 'Rapport_Factures_Complet'));
      toast({
        title: t('تم التصدير', 'Export réussi'),
        description: t('تم تنزيل ملف تقرير الفواتير بصيغة CSV بنجاح.', 'Le rapport des factures CSV a été téléchargé avec succès.')
      });
    } else if (activeTab === 'fleet') {
      const cols: ExportColumn<Truck>[] = [
        { header: t('رقم اللوحة', 'Immatriculation'), key: 'plate_number' },
        { header: t('الموديل', 'Modèle'), key: 'model' },
        { header: t('الحالة', 'Statut'), key: (tr) => tr.status === 'maintenance' || tr.status === 'inactive' ? t('تحت الصيانة', 'En maintenance') : t('جاهزة للعمل', 'Opérationnel') },
        { header: t('السائق الافتراضي', 'Chauffeur par défaut'), key: (tr) => tr.default_driver_name || '—' },
      ];
      exportToCSV(trucks, cols, t('تقرير_الأسطول_الشامل', 'Rapport_Flotte_Complet'));
      toast({
        title: t('تم التصدير', 'Export réussi'),
        description: t('تم تنزيل ملف تقرير الأسطول بصيغة CSV بنجاح.', 'Le rapport de la flotte CSV a été téléchargé avec succès.')
      });
    } else {
      const cols: ExportColumn<Driver>[] = [
        { header: t('اسم السائق', 'Nom chauffeur'), key: 'name' },
        { header: t('الهاتف', 'Téléphone'), key: 'phone' },
        { header: t('رقم الرخصة', 'Permis'), key: 'license' },
        { header: t('الحالة', 'Statut'), key: (d) => d.status || t('نشط', 'Actif') },
        { header: t('الراتب الأساسي', 'Salaire de base'), key: 'base_salary' },
      ];
      exportToCSV(drivers, cols, t('تقرير_السائقين_الشامل', 'Rapport_Chauffeurs_Complet'));
      toast({
        title: t('تم التصدير', 'Export réussi'),
        description: t('تم تنزيل ملف تقرير السائقين بصيغة CSV بنجاح.', 'Le rapport des chauffeurs CSV a été téléchargé avec succès.')
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
  return (
    <div className="space-y-6 max-w-7xl mx-auto print:p-0 print:m-0" dir={dir}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>{t('نظام إعداد واستخراج التقارير المركزية', 'Système central de génération de rapports')}</span>
            <span className="text-border">|</span>
            <span className="text-primary font-bold">Trans Bodanon Analytics Hub</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            {t('مركز التقارير الشاملة والتحليلات', 'Centre des Rapports & Analyses Globales')}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {t(
              'تقارير تفصيلية قابلة للتصفية والتصدير والطباعة لحركة النقل الدولي، الفواتير، الأسطول، ومستحقات السائقين.',
              'Rapports détaillés filtrables, exportables et imprimables pour le transport international, factures, flotte et avances chauffeurs.'
            )}
          </p>
        </div>

        {/* Global Export & Print Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm rounded-xl h-10 px-3.5 transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 ms-1.5 text-emerald-600 dark:text-emerald-400" />
            {t('تصدير إلى Excel/CSV', 'Exporter Excel/CSV')}
          </Button>

          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm rounded-xl h-10 px-3.5 transition-all shadow-xs"
          >
            <Printer className="w-4 h-4 ms-1.5 text-blue-600 dark:text-blue-400" />
            {t('طباعة التقرير (Print)', 'Imprimer le rapport')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={fetchReportData}
            disabled={refreshing}
            title={t('تحديث البيانات', 'Actualiser les données')}
            className="rounded-xl h-10 w-10 border border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Print Header (Visible only when printing) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-xl font-bold font-amiri text-black">
          {t('شركة ترانس بودانون - Trans Bodanon TMS', 'Société Trans Bodanon - Trans Bodanon TMS')}
        </h1>
        <p className="text-xs text-gray-600">
          {t(
            `تقرير شامل للعمليات والتحليلات - تاريخ الاستخراج: ${new Date().toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}`,
            `Rapport global des opérations et analyses - Date d'extraction: ${new Date().toLocaleDateString('fr-FR')}`
          )}
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Freight Revenue */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">
              {t('إجمالي مبالغ الرحلات', 'Total Fret Trajets')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold font-mono text-foreground">
              {summaryMetrics.revenueMAD.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}{' '}
              <span className="text-xs font-normal text-muted-foreground">{t('د.م.', 'MAD')}</span>
            </div>
            {summaryMetrics.revenueEUR > 0 && (
              <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
                + {summaryMetrics.revenueEUR.toLocaleString()} €
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('حسب الفلاتر المحددة', 'Selon les filtres sélectionnés')}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Completed Trips */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">
              {t('الرحلات المنفذة', 'Trajets Réalisés')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold font-mono text-foreground">
              {summaryMetrics.completedTripsCount}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                / {filteredTrips.length} {t('رحلة', 'courses')}
              </span>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {t('نسبة الإنجاز:', 'Taux de réalisation:')} {summaryMetrics.completionRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('تشمل الرحلات المسلمة والمكتملة', 'Inclut trajets livrés et terminés')}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Invoiced & Collection */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">
              {t('الفواتير والتحصيل', 'Facturation & Recouvrement')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold font-mono text-foreground">
              {summaryMetrics.totalInvoicedMAD.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}{' '}
              <span className="text-xs font-normal text-muted-foreground">{t('د.م.', 'MAD')}</span>
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-1">
              {t('نسبة السداد:', 'Taux de paiement:')} {summaryMetrics.collectionRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {filteredInvoices.length} {t('فاتورة مفلترة', 'factures filtrées')}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Advances & Settlements */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">
              {t('إجمالي عهد السائقين', 'Total Avances Chauffeurs')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold font-mono text-foreground">
              {summaryMetrics.totalAdvancesMAD.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}{' '}
              <span className="text-xs font-normal text-muted-foreground">{t('د.م.', 'MAD')}</span>
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
              {t('سلف ومصاريف ميدانية', 'Avances et frais de route')}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('تشمل مصاريف المحروقات والمعابر', 'Carburant et traversées inclus')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters Bar */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Quick Period Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-bold text-muted-foreground ms-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t('الفترة:', 'Période:')}
              </span>
              {[
                { id: 'month', label: t('هذا الشهر', 'Ce mois') },
                { id: 'quarter', label: t('الربع الحالي', 'Ce trimestre') },
                { id: 'year', label: t('هذا العام', 'Cette année') },
                { id: 'today', label: t('اليوم', "Aujourd'hui") },
                { id: 'all', label: t('كل الفترات', 'Toutes') },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPeriod(item.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    period === item.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Filter Dropdowns & Search */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative min-w-[180px] flex-1 md:flex-initial">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('بحث برقم الرحلة، CMR أو المسار...', 'Rechercher N° trajet, CMR ou trajet...')}
                  className="h-9 pr-8 text-xs rounded-xl bg-background"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">{t('كافة الحالات', 'Tous les statuts')}</option>
                <option value="completed">{t('مكتملة', 'Terminées')}</option>
                <option value="in_transit">{t('في الطريق', 'En transit')}</option>
                <option value="loaded">{t('تم التحميل', 'Chargées')}</option>
                <option value="pending">{t('معلقة', 'En attente')}</option>
              </select>

              {/* Client Filter */}
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">{t('كافة العملاء', 'Tous les clients')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Truck Filter */}
              <select
                value={filterTruck}
                onChange={(e) => setFilterTruck(e.target.value)}
                className="h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">{t('كافة الشاحنات', 'Tous les camions')}</option>
                {trucks.map((tr) => (
                  <option key={tr.id} value={String(tr.id)}>
                    {tr.plate_number} - {tr.model}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabbed Reports Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/70 p-1 rounded-xl h-11 border border-border/40 w-full sm:w-auto overflow-x-auto justify-start print:hidden">
          <TabsTrigger value="trips" className="rounded-lg text-xs sm:text-sm font-semibold gap-1.5 px-4">
            <Route className="w-4 h-4 text-primary" />
            {t('تقرير الرحلات والـ CMR', 'Rapport Trajets & CMR')} ({filteredTrips.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-lg text-xs sm:text-sm font-semibold gap-1.5 px-4">
            <Receipt className="w-4 h-4 text-emerald-500" />
            {t('تقرير الفواتير والإيرادات', 'Rapport Factures & Revenus')} ({filteredInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="fleet" className="rounded-lg text-xs sm:text-sm font-semibold gap-1.5 px-4">
            <TruckIcon className="w-4 h-4 text-amber-500" />
            {t('أداء الأسطول والشاحنات', 'Flotte & Camions')} ({trucks.length})
          </TabsTrigger>
          <TabsTrigger value="drivers" className="rounded-lg text-xs sm:text-sm font-semibold gap-1.5 px-4">
            <Users className="w-4 h-4 text-purple-500" />
            {t('السائقين والعهد', 'Chauffeurs & Avances')} ({drivers.length})
          </TabsTrigger>
          <TabsTrigger value="trends" className="rounded-lg text-xs sm:text-sm font-semibold gap-1.5 px-4">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            {t('الرسوم والتحليل البياني', 'Graphiques & Analyses')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Trips Report */}
        <TabsContent value="trips" className="space-y-4">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
              <div>
                <CardTitle className="text-sm font-bold font-amiri">
                  {t('سجل الرحلات الدولية والوطنية المفصل', 'Journal détaillé des trajets internationaux et nationaux')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t(
                    'بيانات دقيقة لكل إرسالية مع أرقام بطاقات الـ CMR والتواريخ والمبالغ',
                    'Données précises pour chaque envoi avec numéros CMR, dates et tarifs'
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {filteredTrips.length} {t('رحلة مطابقة', 'trajets correspondants')}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                  <thead className="bg-muted/40 text-muted-foreground text-xs font-semibold uppercase border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3">{t('رقم الرحلة / CMR', 'N° Trajet / CMR')}</th>
                      <th className="px-4 py-3">{t('خط السير والموانئ', 'Itinéraire & Ports')}</th>
                      <th className="px-4 py-3">{t('العميل', 'Client')}</th>
                      <th className="px-4 py-3">{t('السائق والشاحنة', 'Chauffeur & Camion')}</th>
                      <th className="px-4 py-3">{t('تاريخ الانطلاق', 'Date départ')}</th>
                      <th className="px-4 py-3">{t('قيمة النقل', 'Tarif')}</th>
                      <th className="px-4 py-3 text-center">{t('الحالة', 'Statut')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTrips.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-xs">
                          {t('لا توجد رحلات تطابق معايير الفلترة المحددة', 'Aucun trajet ne correspond aux critères de filtre')}
                        </td>
                      </tr>
                    ) : (
                      filteredTrips.map((trip) => {
                        const statusInfo = statusLabels[trip.status] || {
                          label: trip.status || t('غير محدد', 'Non défini'),
                          badgeVariant: 'outline' as const,
                        };

                        return (
                          <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                              #{trip.id}
                              {trip.cmr_number && (
                                <span className="block text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                                  CMR: {trip.cmr_number}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-medium text-foreground">
                              {trip.route || t('غير محدد', 'Non défini')}
                              {trip.ferry_company && (
                                <span className="block text-[11px] text-muted-foreground mt-0.5">
                                  {t('معبر:', 'Ferry:')} {trip.ferry_company}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-muted-foreground">
                              {(trip as any).client?.name || t('عميل مسجل', 'Client enregistré')}
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              <span className="font-medium text-foreground block mb-1">
                                {(trip as any).driver?.name || t('سائق مكلف', 'Chauffeur assigné')}
                              </span>
                              {(trip as any).truck?.plate_number && (
                                <MatriculeBadge plate={(trip as any).truck.plate_number} variant="badge" size="xs" />
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                              {trip.departure_date ? new Date(trip.departure_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR') : '—'}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {trip.price ? `${trip.price.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')} ${t('د.م.', 'MAD')}` : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <Badge variant={statusInfo.badgeVariant} className="text-[10px] px-2.5 py-0.5 rounded-full">
                                {statusInfo.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Invoices Report */}
        <TabsContent value="invoices" className="space-y-4">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
              <div>
                <CardTitle className="text-sm font-bold font-amiri">
                  {t('تقرير الفواتير والإيرادات المالية', 'Rapport des factures et revenus financiers')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t(
                    'متابعة الفواتير المصدرة، المبالغ المستحقة، ومعدلات التحصيل',
                    'Suivi des factures émises, montants dus et taux de recouvrement'
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {filteredInvoices.length} {t('فاتورة', 'factures')}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                  <thead className="bg-muted/40 text-muted-foreground text-xs font-semibold uppercase border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3">{t('رقم الفاتورة', 'N° Facture')}</th>
                      <th className="px-4 py-3">{t('العميل', 'Client')}</th>
                      <th className="px-4 py-3">{t('تاريخ الإصدار', 'Date émission')}</th>
                      <th className="px-4 py-3">{t('تاريخ الاستحقاق', 'Date échéance')}</th>
                      <th className="px-4 py-3">{t('المبلغ الإجمالي', 'Montant Total')}</th>
                      <th className="px-4 py-3">{t('العملة', 'Devise')}</th>
                      <th className="px-4 py-3 text-center">{t('حالة السداد', 'Statut paiement')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-xs">
                          {t('لا توجد فواتير تطابق معايير الفلترة', 'Aucune facture ne correspond aux filtres')}
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const statusBadge = invoiceStatusLabels[inv.status] || {
                          label: inv.status,
                          badgeVariant: 'outline' as const,
                        };

                        return (
                          <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                              {inv.invoice_number}
                            </td>
                            <td className="px-4 py-3.5 font-medium text-foreground">
                              {(inv as any).client?.name || t('عميل تجاري', 'Client commercial')}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                              {inv.created_at ? new Date(inv.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR') : '—'}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                              {inv.due_date ? new Date(inv.due_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR') : '—'}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                              {Number(inv.total_amount || 0).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {inv.currency || 'MAD'}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <Badge variant={statusBadge.badgeVariant} className="text-[10px] px-2.5 py-0.5 rounded-full">
                                {statusBadge.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Fleet Report */}
        <TabsContent value="fleet" className="space-y-4">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
              <div>
                <CardTitle className="text-sm font-bold font-amiri">
                  {t('تقرير جاهزية وأداء أسطول الشاحنات', 'Rapport de disponibilité et performance de la flotte')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t(
                    'بيانات تشغيل المركبات، عدد الرحلات لكل شاحنة وحالة الصيانة',
                    'Suivi opérationnel des véhicules, nombre de trajets et maintenance'
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {trucks.length} {t('شاحنة بالأسطول', 'camions dans la flotte')}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                  <thead className="bg-muted/40 text-muted-foreground text-xs font-semibold uppercase border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3">{t('رقم اللوحة', 'Immatriculation')}</th>
                      <th className="px-4 py-3">{t('الموديل والطراز', 'Modèle & Type')}</th>
                      <th className="px-4 py-3">{t('السائق الافتراضي', 'Chauffeur par défaut')}</th>
                      <th className="px-4 py-3">{t('الرحلات المنفذة', 'Trajets effectués')}</th>
                      <th className="px-4 py-3 text-center">{t('حالة الشاحنة', 'État du véhicule')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {trucks.map((truck) => {
                      const truckTripsCount = trips.filter((t) => t.truck_id === truck.id).length;
                      const isMaintenance = truck.status === 'maintenance' || truck.status === 'inactive';

                      return (
                        <tr key={truck.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <MatriculeBadge plate={truck.plate_number} variant="badge" size="sm" />
                          </td>
                          <td className="px-4 py-3.5 font-medium text-foreground">
                            {truck.model || 'مرسيدس أكتروس Actros'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {truck.default_driver_name || t('سائق بالتبادل', 'Chauffeur en rotation')}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                            {truckTripsCount} {t('رحلة', 'trajets')}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge
                              variant={isMaintenance ? 'destructive' : 'success'}
                              className="text-[10px] px-2.5 py-0.5 rounded-full"
                            >
                              {isMaintenance ? t('تحت الصيانة', 'En maintenance') : t('جاهزة للعمل', 'Opérationnel')}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Drivers Report */}
        <TabsContent value="drivers" className="space-y-4">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
              <div>
                <CardTitle className="text-sm font-bold font-amiri">
                  {t('تقرير السائقين والعهد والتسويات', 'Rapport des chauffeurs, avances et règlements')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t(
                    'بيانات السائقين، الرحلات المنجزة، والعهد الممنوحة للتسوية',
                    'Suivi des chauffeurs, courses effectuées et avances à régulariser'
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {drivers.length} {t('سائق مسجل', 'chauffeurs enregistrés')}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                  <thead className="bg-muted/40 text-muted-foreground text-xs font-semibold uppercase border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3">{t('اسم السائق', 'Nom du chauffeur')}</th>
                      <th className="px-4 py-3">{t('رقم الهاتف', 'Téléphone')}</th>
                      <th className="px-4 py-3">{t('رخصة القيادة', 'Permis de conduire')}</th>
                      <th className="px-4 py-3">{t('الرحلات المنفذة', 'Trajets effectués')}</th>
                      <th className="px-4 py-3">{t('إجمالي العهد', 'Total avances')}</th>
                      <th className="px-4 py-3 text-center">{t('الحالة', 'Statut')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {drivers.map((driver) => {
                      const driverTripsCount = trips.filter((t) => t.driver_id === driver.id).length;
                      const driverAdvancesList = advances.filter((a) => a.driver_id === driver.id);
                      let driverAdvTotal = new Decimal(0);
                      driverAdvancesList.forEach((a) => {
                        driverAdvTotal = driverAdvTotal.plus(new Decimal(a.amount || 0));
                      });

                      return (
                        <tr key={driver.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5 font-medium text-foreground">
                            {driver.name}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                            {driver.phone || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                            {driver.license || '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                            {driverTripsCount} {t('رحلة', 'courses')}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                            {driverAdvTotal.toNumber().toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')} {t('د.م.', 'MAD')}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant="outline" className="text-[10px] px-2.5 py-0.5 rounded-full">
                              {t('نشط', 'Actif')}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Visual Trends & Distribution */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Monthly Financials */}
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold font-amiri">
                  {t('مقارنة الإيرادات الشهرية والرحلات', 'Comparaison des revenus mensuels et trajets')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('تطور حجم المداخيل وعدد الرحلات خلال الأشهر الأخيرة', 'Évolution des recettes et nombre de courses récentes')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparisonData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                      <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: '0.75rem',
                          direction: dir,
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="revenue" name={t('الإيرادات (د.م.)', 'Revenus (MAD)')} fill="#2563eb" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="trips" name={t('عدد الرحلات', 'Nombre de trajets')} fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Trip Status Breakdown */}
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold font-amiri">
                  {t('توزيع الحالات التشغيلية للرحلات', 'Répartition des statuts opérationnels des trajets')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('نسب الرحلات المكتملة، قيد النقل، والمعلقة', 'Pourcentages des trajets terminés, en transit et en attente')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tripStatusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {tripStatusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: '0.75rem',
                          direction: dir,
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {tripStatusChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground truncate">{item.name}:</span>
                      <span className="font-mono font-bold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
