'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import type {
  TollProvider,
  TollCountryCode,
  TollReconciliationStatus,
  TripTollExpense,
  TollCardInvoiceBatch,
  TollReconciliationSummary,
  VatRecoveryStatus,
} from '../types/european-tolls.types';
import {
  getTollReconciliationDataAction,
  uploadAndReconcileTollBatchAction,
  updateTollExpenseStatusAction,
} from '../services/european-tolls.actions';
import {
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Upload,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  FileText,
  Euro,
  Coins,
  Globe2,
  Navigation,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface TollReconciliationViewProps {
  initialSummary?: TollReconciliationSummary;
  initialExpenses?: TripTollExpense[];
  initialBatches?: TollCardInvoiceBatch[];
}

// Sample realistic statement data for instant simulation & testing
const SAMPLE_DKV_CSV = `ExitTime,CardOrOBU,TruckPlate,Country,Highway,ExitGate,NetEUR,VatRate,GrossEUR
2026-10-09T08:30:00Z,DKV-BOX-9841,12345-A-26,ES,AP-7,La Jonquera Frontière,48.20,0.21,58.32
2026-10-09T11:45:00Z,DKV-BOX-9841,12345-A-26,FR,A9,Montpellier Sud,62.50,0.20,75.00
2026-10-09T14:15:00Z,DKV-BOX-9841,12345-A-26,FR,A7,Valence Nord,44.10,0.20,52.92
2026-10-08T19:20:00Z,TEL-EU-4412,67890-B-40,ES,C-32,Túneles del Garraf,26.40,0.21,31.94
2026-10-08T22:10:00Z,TEL-EU-4412,67890-B-40,FR,A63,Bordeaux Sud,54.80,0.20,65.76
2026-10-07T10:00:00Z,VIGNETTE-NL,99999-C-01,NL,EUROVIGNETTE,Utrecht Transit (1 Day),12.00,0.00,12.00
2026-10-07T03:15:00Z,DKV-BOX-7721,55555-X-99,ES,AP-7,Girona Sud (Off-Route Swiped),38.00,0.21,45.98`;

export function TollReconciliationView({
  initialSummary,
  initialExpenses,
  initialBatches,
}: TollReconciliationViewProps) {
  const { t, locale, dir } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [summary, setSummary] = useState<TollReconciliationSummary | null>(initialSummary || null);
  const [expenses, setExpenses] = useState<TripTollExpense[]>(initialExpenses || []);
  const [batches, setBatches] = useState<TollCardInvoiceBatch[]>(initialBatches || []);
  const [loading, setLoading] = useState(false);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInMad, setShowInMad] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadProvider, setUploadProvider] = useState<TollProvider>('dkv');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [csvContent, setCsvContent] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Fetch initial data if not provided
  useEffect(() => {
    if (!summary || expenses.length === 0) {
      handleRefresh();
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await getTollReconciliationDataAction();
      setSummary(data.summary);
      setExpenses(data.expenses);
      setBatches(data.batches);
    } catch (err) {
      console.error('Failed to load toll data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!csvContent.trim()) {
      setUploadError(t('يرجى لصق أو تحميل محتوى الفاتورة', 'Veuillez saisir ou charger le fichier', 'Por favor ingrese el archivo'));
      return;
    }

    startTransition(async () => {
      const res = await uploadAndReconcileTollBatchAction({
        provider: uploadProvider,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        raw_file_content: csvContent,
        exchange_rate_to_mad: 10.85,
      });

      if (res.success && res.summary) {
        setUploadSuccess(
          t(
            `تمت مطابقة الفاتورة بنجاح: ${res.summary.matchedTransactions} من أصل ${res.summary.totalTransactions} معاملة`,
            `Facture réconciliée: ${res.summary.matchedTransactions}/${res.summary.totalTransactions} transactions`,
            `Factura conciliada: ${res.summary.matchedTransactions}/${res.summary.totalTransactions} transacciones`
          )
        );
        if (res.expenses) setExpenses(res.expenses);
        setSummary(res.summary);
        setTimeout(() => {
          setIsUploadOpen(false);
          setUploadSuccess(null);
          setCsvContent('');
        }, 1200);
      } else {
        setUploadError(res.error || 'Erreur lors de la réconciliation');
      }
    });
  };

  const handleUpdateVatStatus = async (id: number, currentStatus: VatRecoveryStatus) => {
    const nextStatus: VatRecoveryStatus =
      currentStatus === 'pending'
        ? 'submitted'
        : currentStatus === 'submitted'
        ? 'refunded'
        : 'pending';

    const res = await updateTollExpenseStatusAction({
      id,
      vat_recovery_status: nextStatus,
    });

    if (res.success) {
      setExpenses((prev) =>
        prev.map((item) => (item.id === id ? { ...item, vat_recovery_status: nextStatus } : item))
      );
    }
  };

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (countryFilter !== 'all' && item.country_code !== countryFilter) return false;
      if (providerFilter !== 'all' && item.provider !== providerFilter) return false;
      if (statusFilter !== 'all' && item.reconciliation_status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPlate = item.truck_plate?.toLowerCase().includes(q);
        const matchesGate = item.exit_gate.toLowerCase().includes(q);
        const matchesHighway = item.highway_code?.toLowerCase().includes(q);
        const matchesTrip = item.trip_code?.toLowerCase().includes(q);
        if (!matchesPlate && !matchesGate && !matchesHighway && !matchesTrip) return false;
      }

      return true;
    });
  }, [expenses, countryFilter, providerFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t(
                  'محرك رسوم الطرق الأوروبية وفواتير العبور (DKV / Telepass / AS 24)',
                  'Moteur de Péages Européens & Télébadges (DKV / Telepass / AS 24)',
                  'Motor de Peajes Europeos y Telepeaje (DKV / Telepass / AS 24)'
                )}
              </h1>
              <p className="text-sm text-slate-400">
                {t(
                  'مطابقة بطاقات Via-T، Télépéage، Eurovignette مع مسارات الأسطول واسترداد ضريبة TVA (التوجيه 8)',
                  'Réconciliation Via-T, Télépéage, Eurovignette & Récupération TVA UE (8e Directive)',
                  'Conciliación Via-T, Télépéage, Eurovignette y Recuperación IVA UE (8ª Directiva)'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInMad(!showInMad)}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <Coins className="w-4 h-4 me-2 text-amber-400" />
            {showInMad ? 'EUR (€)' : 'MAD (درهم)'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            {t('تحديث', 'Actualiser', 'Actualizar')}
          </Button>

          <Button
            onClick={() => setIsUploadOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
          >
            <Upload className="w-4 h-4 me-2" />
            {t('استيراد فاتورة المورد', 'Importer Facture Péage', 'Importar Factura de Peaje')}
          </Button>
        </div>
      </div>

      {/* Bento Grid: Executive Financial & Fraud KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tolls */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('إجمالي رسوم الطرق', 'Total Péages & Vignettes', 'Total Peajes y Viñetas')}</span>
              <Euro className="w-4 h-4 text-blue-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-white">
              {showInMad
                ? `${summary?.totalGrossMad || '0.00'} MAD`
                : `${summary?.totalGrossEur || '0.00'} €`}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Net: {summary?.totalNetEur || '0.00'} €</span>
              <span>•</span>
              <span>TVA: {summary?.totalVatEur || '0.00'} €</span>
            </div>
          </CardContent>
        </Card>

        {/* VAT Recoverable (8th Directive) */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('ضريبة TVA القابلة للاسترداد (UE)', 'TVA Récupérable (8e Dir.)', 'IVA Recuperable (UE 8ª Dir.)')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {summary?.recoverableVatEur || '0.00'} €
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] bg-emerald-950/40 border-emerald-600/40 text-emerald-300">
                {t('مؤهل للاسترجاع الضريبي', 'Éligible DGI / UE', 'Elegible DGI / UE')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Match Rate */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('نسبة المطابقة مع الرحلات', 'Taux de Concordance', 'Tasa de Coincidencia')}</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-cyan-400">
              {summary?.matchRatePercentage || '0.0%'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.matchedTransactions || 0} / {summary?.totalTransactions || 0}{' '}
              {t('معاملة مرتبطة بأمر نقل', 'passages validés', 'pasos validados')}
            </div>
          </CardContent>
        </Card>

        {/* Flagged Leakage / Anomalies */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('تسريبات ورسوم مشبوهة', 'Fuites & Fraudes Détectées', 'Fugas y Pasos No Autorizados')}</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-rose-400">
              {summary?.leakageCount || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="text-rose-400 font-medium">
                {summary?.leakageCount ? t('تتطلب مراجعة تدقيق فورية', 'Audit immédiat requis', 'Auditoría requerida') : t('لا توجد مخالفات', 'Aucune fuite détectée', 'Sin anomalías')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Country Breakdown Badges Bar */}
      {summary?.countryBreakdown && summary.countryBreakdown.length > 0 && (
        <Card className="bg-slate-900/60 border-slate-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-blue-400" />
              <span>{t('توزيع الرسوم عبر الشبكات الأوروبية', 'Répartition par Réseau National', 'Distribución por Red')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {summary.countryBreakdown.map((c) => (
                <div
                  key={c.countryCode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-200"
                >
                  <span className="font-bold text-blue-400">{c.countryCode}</span>
                  <span>{c.countryName.split(' ')[0]}</span>
                  <span className="font-semibold text-white">
                    {showInMad
                      ? `${(c.totalGrossEur * 10.85).toFixed(0)} MAD`
                      : `${c.totalGrossEur.toFixed(2)} €`}
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-slate-700 text-slate-300">
                    {c.transactionsCount} tx
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                'بحث برقم الشاحنة، البوابة، الطريق السيار...',
                'Recherche par immatriculation, péage, autoroute...',
                'Buscar por matrícula, peaje, autopista...'
              )}
              className="ps-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 me-1" />
            
            {/* Country Filter */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">{t('جميع الدول', 'Tous les pays', 'Todos los países')}</option>
              <option value="ES">🇪🇸 Espagne (AP-7 / Via-T)</option>
              <option value="FR">🇫🇷 France (A9/A7/A10)</option>
              <option value="DE">🇩🇪 Allemagne (LKW-Maut)</option>
              <option value="NL">🇳🇱 Pays-Bas / Eurovignette</option>
              <option value="MA">🇲🇦 Maroc (ADM)</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">{t('جميع الموردين', 'Tous les fournisseurs', 'Todos los proveedores')}</option>
              <option value="dkv">DKV Box Europe</option>
              <option value="telepass">Telepass EU</option>
              <option value="as24">AS 24 Eurotraffic</option>
              <option value="eurotoll">Eurotoll</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">{t('جميع الحالات', 'Tous les statuts', 'Todos los estados')}</option>
              <option value="matched">{t('مطابق مع رحلة', 'Concordant', 'Conciliado')}</option>
              <option value="flagged_leakage">{t('مشتبه به (تسريب)', 'Fuite / Fraude', 'Sospechoso')}</option>
              <option value="unmatched">{t('غير مرتبط', 'Non associé', 'No asociado')}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Toll Expenses Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/60 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 text-start">{t('الشاحنة / الرحلة', 'Véhicule & Mission', 'Vehículo y Misión')}</th>
                <th className="py-3 px-4 text-start">{t('المورد / النظام', 'Fournisseur & Système', 'Proveedor y Sistema')}</th>
                <th className="py-3 px-4 text-start">{t('المسار والبوابة', 'Autoroute & Péage', 'Autopista y Peaje')}</th>
                <th className="py-3 px-4 text-start">{t('تاريخ وتوقيت العبور', 'Date & Passage', 'Fecha y Paso')}</th>
                <th className="py-3 px-4 text-end">{t('المبلغ الصافي', 'Net HT', 'Neto')}</th>
                <th className="py-3 px-4 text-end">{t('ضريبة TVA', 'TVA', 'IVA')}</th>
                <th className="py-3 px-4 text-end">{t('الإجمالي', 'TTC Total', 'Total')}</th>
                <th className="py-3 px-4 text-center">{t('استرداد TVA (UE)', 'Récupération TVA', 'Recuperación IVA')}</th>
                <th className="py-3 px-4 text-center">{t('حالة المطابقة', 'Concordance', 'Estado')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>{t('لا توجد معاملات مطابقة للفلتر المحدد', 'Aucune transaction trouvée pour ces filtres', 'No se encontraron transacciones')}</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      row.reconciliation_status === 'flagged_leakage'
                        ? 'bg-rose-950/10'
                        : ''
                    }`}
                  >
                    {/* Vehicle & Trip */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <MatriculeBadge plate={row.truck_plate || 'INCONNU'} />
                        {row.trip_code ? (
                          <span className="text-[11px] font-medium text-blue-400">
                            {row.trip_code}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {t('بدون رحلة محددة', 'Sans mission', 'Sin misión')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Provider & System */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200 uppercase">
                          {row.provider}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase">
                          {row.toll_system.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Highway & Gate */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-medium text-white">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-600 bg-slate-800">
                            {row.country_code}
                          </Badge>
                          <span>{row.highway_code || 'Autoroute'}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {row.exit_gate}
                        </span>
                      </div>
                    </td>

                    {/* Date/Time */}
                    <td className="py-3 px-4">
                      <div className="text-slate-300">
                        {new Date(row.exit_time).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(row.exit_time).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Net */}
                    <td className="py-3 px-4 text-end font-mono">
                      {row.net_amount_eur.toFixed(2)} €
                    </td>

                    {/* VAT */}
                    <td className="py-3 px-4 text-end font-mono text-slate-400">
                      <div>{row.vat_amount_eur.toFixed(2)} €</div>
                      <div className="text-[10px] text-slate-500">
                        ({(row.vat_rate * 100).toFixed(0)}%)
                      </div>
                    </td>

                    {/* Gross */}
                    <td className="py-3 px-4 text-end font-mono font-bold text-white">
                      <div>
                        {showInMad
                          ? `${row.gross_amount_mad.toFixed(2)} MAD`
                          : `${row.gross_amount_eur.toFixed(2)} €`}
                      </div>
                    </td>

                    {/* VAT Recovery Status */}
                    <td className="py-3 px-4 text-center">
                      {row.vat_recoverable ? (
                        <button
                          onClick={() => handleUpdateVatStatus(row.id, row.vat_recovery_status)}
                          className="focus:outline-none"
                          title={t('انقر لتبديل حالة الاسترداد الضريبي', 'Cliquer pour basculer le statut', 'Clic para alternar estado')}
                        >
                          <Badge
                            className={`text-[10px] cursor-pointer ${
                              row.vat_recovery_status === 'refunded'
                                ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300'
                                : row.vat_recovery_status === 'submitted'
                                ? 'bg-amber-900/60 border-amber-500 text-amber-300'
                                : 'bg-blue-900/40 border-blue-600 text-blue-300'
                            }`}
                          >
                            {row.vat_recovery_status === 'refunded'
                              ? t('مسترجع ✓', 'Remboursé ✓', 'Reembolsado ✓')
                              : row.vat_recovery_status === 'submitted'
                              ? t('قيد المعالجة', 'Déposé', 'Tramitado')
                              : t('مؤهل (معلق)', 'Éligible', 'Pendiente')}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">
                          {t('معفى / غير مؤهل', 'Exonéré', 'Exento')}
                        </Badge>
                      )}
                    </td>

                    {/* Reconciliation Match Status */}
                    <td className="py-3 px-4 text-center">
                      {row.reconciliation_status === 'matched' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('مطابق', 'Concordant', 'Conciliado')}
                        </span>
                      ) : row.reconciliation_status === 'flagged_leakage' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-bold animate-pulse">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          {t('تسريب / مشبوه', 'Fuite / Fraude', 'Fuga')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {t('غير مرتبط', 'Non lié', 'No vinculado')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upload & Reconcile Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold">
                  {t('استيراد ومطابقة فاتورة رسوم الطرق الأوروبية', 'Importer Facture de Péage DKV / Telepass', 'Importar Factura de Peaje')}
                </h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Provider Select */}
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    {t('مزود الخدمة', 'Fournisseur', 'Proveedor')}
                  </label>
                  <select
                    value={uploadProvider}
                    onChange={(e) => setUploadProvider(e.target.value as TollProvider)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none"
                  >
                    <option value="dkv">DKV Box Europe</option>
                    <option value="telepass">Telepass EU</option>
                    <option value="as24">AS 24 Eurotraffic</option>
                    <option value="eurotoll">Eurotoll</option>
                    <option value="generic">Format Standard (CSV)</option>
                  </select>
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    {t('رقم الفاتورة', 'N° Facture', 'Nº Factura')}
                  </label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-xs text-white"
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    {t('تاريخ الفاتورة', 'Date Facture', 'Fecha Factura')}
                  </label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              {/* CSV Content Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    {t('محتوى الملف (CSV أو JSON)', 'Contenu du Fichier (CSV ou JSON)', 'Contenido del Archivo')}
                  </label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setCsvContent(SAMPLE_DKV_CSV)}
                    className="text-xs text-blue-400 p-0 h-auto"
                  >
                    {t('⚡ ملء نموذج تجريبي لـ DKV', '⚡ Charger exemple DKV', '⚡ Cargar ejemplo DKV')}
                  </Button>
                </div>
                <textarea
                  rows={8}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder={SAMPLE_DKV_CSV}
                  className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {uploadError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadOpen(false)}
                  className="border-slate-700 bg-slate-800 text-slate-300"
                >
                  {t('إلغاء', 'Annuler', 'Cancelar')}
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin me-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 me-2" />
                  )}
                  {t('تنفيذ المطابقة والترحيل', 'Lancer la Réconciliation', 'Iniciar Conciliación')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

