'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Decimal from 'decimal.js';
import {
  MapPin,
  Navigation,
  Calendar,
  Clock,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Printer,
  Search,
  Building,
  Phone,
  Mail,
  Globe,
  ArrowRight,
  ArrowLeft,
  Download,
  Eye,
  RefreshCw,
  X,
  ChevronRight,
  Check,
  Building2,
  DollarSign,
  Layers,
  Map,
} from 'lucide-react';
import { Truck } from '@/components/icons/vehicle-icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { InvoicePrintModal } from '@/components/invoice-print-modal';
import { getClientPortalDataAction, getAvailablePortalClientsAction } from '../services/portal.actions';
import type { ClientPortalData, PortalTripItem } from '../types';
import type { Invoice, Client, DeliverySignature, BookingRequest } from '@/types/database';
import { BookingRequestModal } from './BookingRequestModal';
import { ClientReeferBadge } from '@/features/tracking/components/ClientReeferBadge';

import { SPANISH_DICTIONARY } from '@/i18n/dictionary';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface CustomerPortalViewProps {
  initialIce?: string;
  initialClientId?: number;
  initialCmr?: string;
  initialTab?: 'shipments' | 'bookings' | 'invoices' | 'pod';
}

export function CustomerPortalView({
  initialIce,
  initialClientId,
  initialCmr,
  initialTab,
}: CustomerPortalViewProps) {
  const [lang, setLang] = useState<'ar' | 'fr' | 'es'>('ar');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Client Data State
  const [portalData, setPortalData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available clients list for switching
  const [availableClients, setAvailableClients] = useState<
    { id: number; name: string; ice: string; city?: string }[]
  >([]);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Tab: 'shipments' | 'bookings' | 'invoices' | 'pod'
  const [activeTab, setActiveTab] = useState<'shipments' | 'bookings' | 'invoices' | 'pod'>(
    initialTab || 'shipments'
  );

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPodTrip, setSelectedPodTrip] = useState<PortalTripItem | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeSearchInput, setActiveSearchInput] = useState(initialCmr || initialIce || '');

  const [isPending, startTransition] = useTransition();

  // Helper translations
  const t = (ar: string, fr: string, es?: string) => {
    if (lang === 'fr') return fr;
    if (lang === 'es') {
      if (es) return es;
      const trimmedAr = ar?.trim();
      if (trimmedAr && SPANISH_DICTIONARY[trimmedAr]) return SPANISH_DICTIONARY[trimmedAr];
      const trimmedFr = fr?.trim();
      if (trimmedFr && SPANISH_DICTIONARY[trimmedFr]) return SPANISH_DICTIONARY[trimmedFr];
      return fr || ar;
    }
    return ar;
  };

  // Fetch client portal data
  const loadPortalData = async (identifier: {
    ice?: string;
    clientId?: number;
    cmrNumber?: string;
  }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getClientPortalDataAction(identifier);
      if (res.success && res.data) {
        setPortalData(res.data);
      } else {
        setErrorMsg(res.error || t('لم يتم العثور على بيانات العميل', 'Données client introuvables'));
      }
    } catch {
      setErrorMsg(t('حدث خطأ أثناء تحميل البيانات', 'Erreur lors du chargement des données'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData({
      ice: initialIce,
      clientId: initialClientId,
      cmrNumber: initialCmr,
    });

    getAvailablePortalClientsAction().then((clients) => {
      setAvailableClients(clients);
    });
  }, [initialIce, initialClientId, initialCmr]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = activeSearchInput.trim();
    if (!q) return;

    // Check if entered value looks like an ICE (starts with 00 or 15 digits) or CMR
    if (q.toUpperCase().startsWith('CMR') || q.includes('-')) {
      loadPortalData({ cmrNumber: q });
    } else if (/^\d+$/.test(q)) {
      if (q.length > 8) {
        loadPortalData({ ice: q });
      } else {
        loadPortalData({ clientId: parseInt(q, 10) });
      }
    } else {
      // Search by name in available clients
      const matched = availableClients.find((c) =>
        c.name.toLowerCase().includes(q.toLowerCase())
      );
      if (matched) {
        loadPortalData({ clientId: matched.id });
      } else {
        loadPortalData({ cmrNumber: q });
      }
    }
  };

  const client = portalData?.client;
  const trips = portalData?.trips || [];
  const invoices = portalData?.invoices || [];
  const bookings = portalData?.bookings || [];
  const stats = portalData?.stats;

  const handleExportInvoicesCsv = () => {
    if (!invoices.length) return;
    const headers = [
      'Invoice Number',
      'Issue Date',
      'Due Date',
      'TTC Amount',
      'Paid Amount',
      'Remaining Balance',
      'Currency',
      'Status',
    ];
    const rows = invoices.map((inv) => {
      const totalDec = new Decimal(inv.ttc_amount || inv.total_amount || 0);
      const paidDec = new Decimal(inv.paid_amount || 0);
      const remDec = totalDec.minus(paidDec);
      const status = remDec.lessThanOrEqualTo(0) ? 'PAID' : paidDec.greaterThan(0) ? 'PARTIALLY_PAID' : 'PENDING';
      return [
        inv.invoice_number,
        inv.issue_date || '',
        inv.due_date || '',
        totalDec.toFixed(2),
        paidDec.toFixed(2),
        remDec.toFixed(2),
        inv.currency || client?.currency || 'EUR',
        status,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoices_Statement_${client?.ice || 'Client'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter available clients in selector modal
  const filteredClients = useMemo(() => {
    if (!searchQuery) return availableClients;
    return availableClients.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ice.includes(searchQuery) ||
        (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [availableClients, searchQuery]);

  return (
    <div
      dir={dir}
      className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors"
    >
      {/* 1. Header & Branding Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0d1322]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black tracking-wider uppercase text-blue-600 dark:text-blue-400">
                  Trans Bodanon TMS
                </span>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {t('بوابة العملاء وتتبع الشحنات المباشرة', 'Portail Client & Suivi Direct')}
                </h1>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold sm:hidden">
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`px-2 py-1 rounded ${lang === 'ar' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
              >
                عربي
              </button>
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-2 py-1 rounded ${lang === 'fr' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`px-2 py-1 rounded ${lang === 'es' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
              >
                ES
              </button>
            </div>
          </div>

          {/* Client badge & switch button */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {client && (
              <Button
                size="sm"
                onClick={() => setIsBookingModalOpen(true)}
                className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-sm shadow-blue-500/20 shrink-0"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{t('+ طلب حجز شاحنة', '+ Réserver Fret', '+ Reservar Flete')}</span>
              </Button>
            )}

            {client && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50">
                <Building className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px] sm:max-w-[220px]">
                    {client.name}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ICE: {client.ice}
                  </p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClientSelector(true)}
              className="h-9 rounded-xl text-xs gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('تغيير أو بحث', 'Changer / Chercher')}</span>
            </Button>

            {/* Desktop Language Switcher */}
            <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`px-2.5 py-1 rounded ${lang === 'ar' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
              >
                عربي
              </button>
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-2.5 py-1 rounded ${lang === 'fr' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`px-2.5 py-1 rounded ${lang === 'es' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
              >
                Español
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Portal Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {t('جاري جلب ملفات وشحنات العميل...', 'Chargement du dossier client & expéditions...')}
            </p>
          </div>
        )}

        {/* Error message */}
        {!loading && errorMsg && (
          <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-center p-8">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <CardTitle className="text-base text-rose-700 dark:text-rose-400">{errorMsg}</CardTitle>
            <CardDescription className="text-xs mt-1">
              {t('يرجى التأكد من رقم الـ ICE أو رقم وثيقة الشحن والبحث مجدداً.', 'Veuillez vérifier votre identifiant ou numéro CMR.')}
            </CardDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClientSelector(true)}
              className="mt-4 rounded-xl text-xs"
            >
              {t('اختيار عميل آخر', 'Sélectionner un autre client')}
            </Button>
          </Card>
        )}

        {!loading && portalData && (
          <>
            {/* 2. Hero Client & Model Overview Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-6 text-white shadow-xl">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-blue-100 border border-white/15 mb-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('نموذج النقل المباشر Point-to-Point (TIR) معتمد', 'Transport direct Point-to-Point homologué')}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black">{client?.name}</h2>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl leading-relaxed">
                    {t(
                      'متابعة فورية للرحلات المباشرة، الروابط الجغرافية لمواقع الشحن والتفريغ، الفواتير المالية، وإثباتات التسليم الرقمية الموثقة قانونياً (e-POD / e-CMR).',
                      'Suivi temps réel des trajets directs, liens GPS de chargement/déchargement, factures et preuves de livraison certifiées (e-POD / e-CMR).'
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-medium shrink-0">
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                    <p className="text-blue-200 text-[11px]">{t('المدينة والوجهة', 'Ville & Destination')}</p>
                    <p className="font-bold text-sm mt-0.5">{client?.shipping_city || 'Tanger'}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                    <p className="text-blue-200 text-[11px]">{t('عملة الحساب', 'Devise')}</p>
                    <p className="font-bold text-sm mt-0.5">{client?.currency || 'EUR'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Statistical Metric Cards (Calculated with Decimal.js) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('شحنات في الطريق', 'En transit')}
                    </p>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                      {stats?.activeShipmentsCount || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Navigation className="w-5 h-5 animate-pulse" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('إثباتات تسليم e-POD', 'Livrées (e-POD)')}
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {stats?.deliveredShipmentsCount || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('إجمالي الفواتير', 'Total Facturé')}
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
                      {stats?.totalInvoiced} {stats?.currency}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('الرصيد المستحق', 'Solde Restant')}
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                      {stats?.totalRemaining} {stats?.currency}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 4. Tab Switcher Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-4 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('shipments')}
                className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'shipments'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>{t('الشحنات والمسارات المباشرة', 'Expéditions & Trajets Directs')}</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800">
                  {trips.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bookings')}
                className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'bookings'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{t('طلبات الحجز الذاتية', 'Demandes de Réservation', 'Reservas de Carga')}</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {bookings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'invoices'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{t('الفواتير والوضعية المالية', 'Factures & Situation')}</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800">
                  {invoices.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pod')}
                className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'pod'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{t('إثباتات التسليم الرقمية (e-POD)', 'Preuves de Livraison (e-POD)')}</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {trips.filter((t) => t.deliveryProof || t.status === 'completed').length}
                </span>
              </button>
            </div>

            {/* TAB 1: SHIPMENTS & POINT-TO-POINT DIRECT JOURNEY */}
            {activeTab === 'shipments' && (
              <div className="space-y-4">
                {trips.length === 0 ? (
                  <Card className="p-8 text-center border-dashed">
                    <Truck className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="font-semibold">{t('لا توجد شحنات مسجلة حالياً', 'Aucune expédition enregistrée')}</p>
                  </Card>
                ) : (
                  trips.map((trip) => {
                    const isCompleted = trip.status === 'completed';
                    const isInTransit = trip.status === 'in_transit';

                    // Point to point direct locations
                    const loadingLocation = trip.route_export?.split('->')?.[0]?.trim() || trip.route?.split('->')?.[0]?.trim() || 'طنجة';
                    const unloadingLocation = trip.route_export?.split('->')?.[1]?.trim() || trip.route?.split('->')?.[1]?.trim() || 'بربينيان (فرنسا)';
                    const ferryCrossing = trip.ferry_company || t('طنجة المتوسط - الجزيرة الخضراء', 'Tanger Med - Algésiras');

                    const priceExportDec = new Decimal(trip.price_export || trip.price || 0);

                    const isAfrican =
                      trip.corridor_type === 'african_overland' ||
                      /dakar|rosso|nouakchott|mauritanie|senegal|sénégal|guerguerat|nouadhibou|الكركارات|روصو|دكار/i.test(
                        `${trip.route} ${trip.route_export} ${trip.destination}`
                      );

                    return (
                      <Card
                        key={trip.id}
                        className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:border-blue-500/50 transition-all"
                      >
                        <CardHeader className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 py-3 px-4 sm:px-6 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                              <Truck className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {trip.route}
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  {trip.cmr_number || `CMR-${trip.id}`}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {t('تاريخ الانطلاق: ', 'Départ : ')}
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {trip.departure_date}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] sm:text-[11px] gap-1 px-2.5 py-0.5 font-bold ${
                                isAfrican
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                              }`}
                            >
                              {isAfrican ? (
                                <>
                                  <span>🌍</span>
                                  <span>{t('الممر الإفريقي البري', 'Corridor Africain', 'Corredor Africano')}</span>
                                </>
                              ) : (
                                <>
                                  <span>🚢</span>
                                  <span>{t('الممر الأوروبي البحري', 'Corridor Maritime Europe', 'Corredor Marítimo Europa')}</span>
                                </>
                              )}
                            </Badge>

                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : isInTransit
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isCompleted
                                ? t('تم التسليم بنجاح', 'Livré', 'Entregado')
                                : isInTransit
                                  ? t('الشحنة في الطريق', 'En transit', 'En tránsito')
                                  : t('قيد التجهيز', 'En préparation', 'En preparación')}
                            </span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-4 sm:p-6 space-y-5">
                          {/* Cold Chain & Telematics Banner */}
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">{t('طبيعة الشحنة:', 'Nature fret :', 'Tipo carga :')}</span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {trip.cargo_type || trip.cargo_description || t('بضائع مبردة طازجة', 'Produits frais', 'Productos frescos')}
                              </span>
                            </div>
                            <ClientReeferBadge
                              temperature={typeof trip.current_temperature === 'number' ? trip.current_temperature : typeof trip.target_temperature === 'number' ? trip.target_temperature : 4}
                              cargoDescription={trip.cargo_type || trip.cargo_description || 'خضار وفواكه'}
                              compact
                            />
                          </div>

                          {/* 3-Stage Direct Point-to-Point Flow */}
                          <div className="relative border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900/60">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                              {t('مسار النقل المباشر لنقطة وصول واحدة (Point-to-Point Direct Flow)', 'Trajet direct Point-to-Point vers destination unique')}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                              {/* Stage 1: Origin & Loading (Box 4 e-CMR) */}
                              <div className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {t('1. نقطة التحميل (خانة 4 e-CMR)', '1. Chargement (Case 4 e-CMR)')}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{trip.departure_date}</span>
                                </div>
                                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                  {loadingLocation}
                                </p>

                                {client?.loading_gps_url ? (
                                  <a
                                    href={client.loading_gps_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                                  >
                                    <Navigation className="w-3.5 h-3.5" />
                                    <span>{t('موقع التحميل (Google Maps)', 'GPS Chargement (Maps)')}</span>
                                    <ExternalLink className="w-3 h-3 ms-auto" />
                                  </a>
                                ) : (
                                  <span className="mt-3 text-[11px] text-slate-400 italic">
                                    {t('موقع التحميل مسجل بالوثائق', 'Lieu enregistré dans les documents')}
                                  </span>
                                )}
                              </div>

                              {/* Stage 2: Maritime Crossing (Ferry) */}
                              <div className="flex flex-col p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                    <Globe className="w-3.5 h-3.5" />
                                    {t('2. المعبر البحري (العبّارة)', '2. Traversée Maritime (Ferry)')}
                                  </span>
                                  {trip.ferry_localizador && (
                                    <span className="text-[10px] font-mono text-indigo-500">
                                      #{trip.ferry_localizador}
                                    </span>
                                  )}
                                </div>
                                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                  {ferryCrossing}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                  {t('ربط لوجستي بحري مباشر عبر مضيق جبل طارق', 'Liaison directe via Détroit de Gibraltar')}
                                </p>
                              </div>

                              {/* Stage 3: Destination & Delivery (Box 3 e-CMR) */}
                              <div className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {t('3. نقطة الوصول والتسليم (خانة 3 e-CMR)', '3. Livraison finale (Case 3 e-CMR)')}
                                  </span>
                                  {trip.unloading_date_export && (
                                    <span className="text-[10px] text-slate-400">{trip.unloading_date_export}</span>
                                  )}
                                </div>
                                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                  {unloadingLocation}
                                </p>

                                {client?.unloading_gps_url ? (
                                  <a
                                    href={client.unloading_gps_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                                  >
                                    <Navigation className="w-3.5 h-3.5" />
                                    <span>{t('موقع التسليم (Google Maps)', 'GPS Livraison (Maps)')}</span>
                                    <ExternalLink className="w-3 h-3 ms-auto" />
                                  </a>
                                ) : (
                                  <span className="mt-3 text-[11px] text-slate-400 italic">
                                    {t('موقع التسليم النهائي للعميل', 'Point de livraison direct')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Shipment details and action buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                            <div className="flex items-center gap-4 text-xs">
                              <div>
                                <span className="text-slate-400 block">{t('سعر الشحن (تصدير):', 'Fret Export :')}</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {priceExportDec.toFixed(2)} {client?.currency || 'EUR'}
                                </span>
                              </div>
                              {trip.truck && (
                                <div>
                                  <span className="text-slate-400 block">{t('الشاحنة:', 'Camion :')}</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                    {trip.truck.plate_number}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Live Track Link */}
                              <a
                                href={`/track/${trip.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
                              >
                                <Map className="w-3.5 h-3.5" />
                                <span>{t('تتبع حي مباشر (GPS)', 'Suivi GPS en direct')}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>

                              {/* e-POD Proof Button */}
                              {(trip.deliveryProof || isCompleted) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedPodTrip(trip)}
                                  className="rounded-xl text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{t('إثبات التسليم (e-POD)', 'Preuve e-POD')}</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 1.5: BOOKING REQUESTS (Self-Service Engine) */}
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span>{t('طلبات حجز الشاحنات الدولية', 'Demandes de Réservation de Fret', 'Reservas de Transporte Internacional')}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t(
                        'إرسال ومتابعة طلبات حجز المأموريات ذاتياً مع التنبيه الفوري لغرفة العمليات عبر WhatsApp.',
                        'Réservation directe et alerte temps réel à la régulation via WhatsApp.',
                        'Reserva directa y alerta en tiempo real a operaciones vía WhatsApp.'
                      )}
                    </p>
                  </div>

                  <Button
                    onClick={() => setIsBookingModalOpen(true)}
                    className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-sm shadow-blue-500/20 shrink-0"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>{t('+ طلب حجز جديد', '+ Nouvelle Demande', '+ Nueva Reserva')}</span>
                  </Button>
                </div>

                {bookings.length === 0 ? (
                  <Card className="p-12 text-center border-dashed rounded-2xl">
                    <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t('لا توجد طلبات حجز مسجلة حالياً', 'Aucune demande de réservation', 'No hay solicitudes de reserva')}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {t(
                        'يمكنك تقديم طلب حجز شاحنة دولية (مبرد أو شراع) بالضغط على الزر أدناه.',
                        'Vous pouvez soumettre une nouvelle réservation de transport en cliquant ci-dessous.',
                        'Puede enviar una nueva reserva de transporte haciendo clic a continuación.'
                      )}
                    </p>
                    <Button
                      onClick={() => setIsBookingModalOpen(true)}
                      className="mt-4 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                    >
                      {t('تقديم طلب حجز الآن', 'Créer une Réservation', 'Crear una Reserva')}
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bookings.map((booking) => {
                      const isAfrican =
                        booking.corridor_type === 'african_overland' ||
                        /dakar|rosso|nouakchott|mauritanie|senegal|sénégal|guerguerat/i.test(booking.route_to);

                      return (
                        <Card
                          key={booking.id}
                          className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-500/40 transition"
                        >
                          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                {booking.booking_number}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 font-bold ${
                                  isAfrican
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                }`}
                              >
                                {isAfrican ? '🌍 إفريقي' : '🚢 أوروبي'}
                              </Badge>
                            </div>

                            <Badge
                              variant="outline"
                              className={`text-[11px] font-bold ${
                                booking.status === 'confirmed' || booking.status === 'assigned'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : booking.status === 'rejected' || booking.status === 'cancelled'
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {booking.status === 'assigned'
                                ? t('تم تعيين الشاحنة 🚛', 'Camion Affecté 🚛', 'Camión Asignado 🚛')
                                : booking.status === 'confirmed'
                                  ? t('مؤكد وجاري التجهيز', 'Confirmé', 'Confirmado')
                                  : booking.status === 'rejected'
                                    ? t('مرفوض', 'Refusé', 'Rechazado')
                                    : t('قيد المراجعة والتعيين', 'En attente', 'Pendiente')}
                            </Badge>
                          </CardHeader>

                          <CardContent className="p-4 space-y-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">{t('المسار:', 'Trajet :', 'Trayecto :')}</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {booking.route_from} ➔ {booking.route_to}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">{t('تاريخ الشحن المرغوب:', 'Date d\'enlèvement :', 'Fecha de recogida :')}</span>
                              <span className="font-mono font-bold">{booking.pickup_date}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-[10px] text-slate-400 block">{t('نوع الحمولة', 'Marchandise', 'Carga')}</span>
                                <span className="font-bold text-[11px]">
                                  {booking.cargo_type === 'frozen_fish'
                                    ? '❄️ أسماك مجمدة'
                                    : booking.cargo_type === 'fresh_produce'
                                      ? '🥬 خضار وفواكه'
                                      : booking.cargo_type === 'pharmaceuticals'
                                        ? '💊 أدوية وصحي'
                                        : '📦 بضائع عامة'}
                                </span>
                              </div>

                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-[10px] text-slate-400 block">{t('المقطورة والحرارة', 'Équipement', 'Equipo')}</span>
                                <span className="font-bold text-[11px]">
                                  {booking.trailer_type === 'frigo' ? '❄️ Frigo' : '🚛 Bâchée'}{' '}
                                  {booking.target_temperature !== null && booking.target_temperature !== undefined
                                    ? `(${booking.target_temperature}°C)`
                                    : ''}
                                </span>
                              </div>
                            </div>

                            {booking.special_instructions && (
                              <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                                &quot;{booking.special_instructions}&quot;
                              </p>
                            )}

                            {booking.pickup_gps_url && (
                              <a
                                href={booking.pickup_gps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>{t('موقع التحميل (Google Maps)', 'Lieu d\'enlèvement GPS', 'Lugar de carga GPS')}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: INVOICES & FINANCIAL SUMMARY */}
            {activeTab === 'invoices' && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold">
                      {t('سجل فواتير النقل المستحقة والمسددة', 'Relevé des factures de transport')}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {t('كافة الفواتير محتسبة بدقة متناهية تشمل ضريبة القيمة المضافة ومطابقة الأرصدة.', 'Calculs financiers conformes et conformité TVA.')}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportInvoicesCsv}
                      className="h-9 rounded-xl text-xs gap-1.5 border-slate-300 dark:border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('تصدير كشف الحساب (CSV)', 'Exporter Relevé (CSV)', 'Exportar Estado (CSV)')}</span>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {invoices.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>{t('لا توجد فواتير مسجلة لهذا العميل حتى الآن', 'Aucune facture enregistrée')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-slate-500">
                            <th className="py-3 px-4 text-start font-bold">{t('رقم الفاتورة', 'N° Facture')}</th>
                            <th className="py-3 px-4 text-start font-bold">{t('تاريخ الإصدار', 'Date')}</th>
                            <th className="py-3 px-4 text-start font-bold">{t('تاريخ الاستحقاق', 'Échéance')}</th>
                            <th className="py-3 px-4 text-end font-bold">{t('المبلغ الإجمالي TTC', 'Montant TTC')}</th>
                            <th className="py-3 px-4 text-end font-bold">{t('المسدد', 'Réglé')}</th>
                            <th className="py-3 px-4 text-end font-bold">{t('المتبقي', 'Reste')}</th>
                            <th className="py-3 px-4 text-center font-bold">{t('الحالة', 'Statut')}</th>
                            <th className="py-3 px-4 text-end font-bold">{t('الإجراءات', 'Actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {invoices.map((inv) => {
                            const totalDec = new Decimal(inv.ttc_amount || inv.total_amount || 0);
                            const paidDec = new Decimal(inv.paid_amount || 0);
                            const remDec = totalDec.minus(paidDec);

                            const isPaid = remDec.lessThanOrEqualTo(0);
                            const isPartial = paidDec.greaterThan(0) && remDec.greaterThan(0);

                            return (
                              <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                  {inv.invoice_number}
                                </td>
                                <td className="py-3 px-4 text-slate-500 font-sans">
                                  {inv.issue_date || '—'}
                                </td>
                                <td className="py-3 px-4 text-slate-500 font-sans">
                                  {inv.due_date || '—'}
                                </td>
                                <td className="py-3 px-4 text-end font-bold text-slate-900 dark:text-slate-100">
                                  {totalDec.toFixed(2)} {inv.currency || client?.currency}
                                </td>
                                <td className="py-3 px-4 text-end text-emerald-600 font-bold">
                                  {paidDec.toFixed(2)} {inv.currency || client?.currency}
                                </td>
                                <td className="py-3 px-4 text-end text-amber-600 font-bold">
                                  {remDec.toFixed(2)} {inv.currency || client?.currency}
                                </td>
                                <td className="py-3 px-4 text-center font-sans">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                      isPaid
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : isPartial
                                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {isPaid
                                      ? t('خالصة بالكامل', 'Payée')
                                      : isPartial
                                        ? t('سداد جزئي', 'Partiel')
                                        : t('مستحقة', 'Non payée')}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-end font-sans">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedInvoice(inv)}
                                    className="h-8 rounded-lg text-xs gap-1.5"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>{t('معاينة / طباعة', 'Imprimer')}</span>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TAB 3: CERTIFIED e-POD ARCHIVE */}
            {activeTab === 'pod' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                        {t('سجل إثباتات التسليم الرقمية المعتمدة قانونياً (e-POD)', 'Registre des preuves de livraison certifiées e-POD')}
                      </h3>
                      <p className="text-xs text-emerald-800 dark:text-emerald-400">
                        {t(
                          'تتضمن كل شحنة توقيع المستلم، الإحداثيات الجغرافية للحظة الوصول، وصورة وثيقة الـ CMR المختومة.',
                          'Chaque dossier inclut signature électronique, géolocalisation GPS et cachet CMR.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trips
                    .filter((t) => t.deliveryProof || t.status === 'completed')
                    .map((trip) => {
                      const proof = trip.deliveryProof;
                      const hasGps = proof?.latitude && proof?.longitude;
                      const mapsUrl = hasGps
                        ? `https://www.google.com/maps/search/?api=1&query=${proof.latitude},${proof.longitude}`
                        : null;

                      return (
                        <Card
                          key={trip.id}
                          className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                        >
                          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 py-3 px-4 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between">
                            <div>
                              <p className="font-bold text-sm">{trip.route}</p>
                              <p className="text-xs text-slate-500 font-mono">
                                {trip.cmr_number || `CMR-${trip.id}`}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              {t('تسليم معتمد', 'Certifié')}
                            </span>
                          </CardHeader>

                          <CardContent className="p-4 space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                                <span className="text-slate-400 block">{t('المستلم / الموقع:', 'Signataire :')}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {proof?.signed_by || t('مسؤول المستودع', 'Réceptionnaire')}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                                <span className="text-slate-400 block">{t('توقيت التسليم:', 'Horodatage :')}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {proof?.signed_at ? new Date(proof.signed_at).toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'ar-MA') : trip.departure_date}
                                </span>
                              </div>
                            </div>

                            {/* Electronic Signature or CMR Thumbnail */}
                            <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                {proof?.signature_url ? (
                                  <img
                                    src={proof.signature_url}
                                    alt="Signature"
                                    className="h-10 max-w-[100px] object-contain border border-slate-200 rounded p-1 bg-white"
                                  />
                                ) : (
                                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                )}
                                <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-200">
                                    {t('التوقيع الإلكتروني للمستلم', 'Signature Électronique')}
                                  </p>
                                  {mapsUrl && (
                                    <a
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] mt-0.5"
                                    >
                                      <MapPin className="w-3 h-3" />
                                      <span>{t('إحداثيات لحظة التسليم', 'Coordonnées GPS')}</span>
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedPodTrip(trip)}
                                  className="h-7 text-xs rounded-lg gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>{t('معاينة', 'Détails')}</span>
                                </Button>
                                <a
                                  href={`/api/pod/pdf?tripOrderId=${trip.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>PDF</span>
                                </a>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 5. Client Selector / Lookup Modal */}
      {showClientSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-lg w-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {t('البحث عن ملف العميل أو الشحنة', 'Recherche Client ou Expédition')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('أدخل رقم الـ ICE أو رقم وثيقة الشحن CMR للوصول المباشر.', 'Entrez votre ICE ou référence CMR.')}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowClientSelector(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                  <Input
                    value={activeSearchInput}
                    onChange={(e) => setActiveSearchInput(e.target.value)}
                    placeholder={t('رقم الـ ICE أو CMR (مثلاً: 001928374000082 أو CMR-1001)', 'ICE ou CMR...')}
                    className="ps-9 h-10 rounded-xl text-xs"
                  />
                </div>
                <Button type="submit" className="h-10 rounded-xl text-xs font-bold bg-blue-600 text-white">
                  {t('بحث', 'Rechercher')}
                </Button>
              </form>

              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">
                  {t('أو اختر من الشركات المعتمدة:', 'Ou sélectionnez parmi nos clients :')}
                </p>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setShowClientSelector(false);
                        loadPortalData({ clientId: c.id });
                      }}
                      className="w-full text-start p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 transition-all flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">ICE: {c.ice}</p>
                      </div>
                      <span className="text-[11px] text-slate-400">{c.city}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 6. e-POD Detailed Modal */}
      {selectedPodTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-xl w-full rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-row items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">
                  {t('إثبات التسليم الرقمي المعتمد (e-POD)', 'Preuve de Livraison Certifiée (e-POD)')}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPodTrip(null)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <div>
                  <p className="text-slate-400">{t('الرحلة ووثيقة الشحن:', 'Trajet & Document :')}</p>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{selectedPodTrip.route}</p>
                  <p className="font-mono text-slate-500 font-bold">{selectedPodTrip.cmr_number || `CMR-${selectedPodTrip.id}`}</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  {t('مكتملة ومسلمة', 'Livraison Validée')}
                </Badge>
              </div>

              {/* Delivery info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-400">{t('اسم المستلم:', 'Signé par :')}</p>
                  <p className="font-bold text-sm mt-0.5 text-slate-900 dark:text-white">
                    {selectedPodTrip.deliveryProof?.signed_by || t('مسؤول الاستلام بالمستودع', 'Réceptionnaire')}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-slate-400">{t('توقيت التسليم الموثق:', 'Date & Heure :')}</p>
                  <p className="font-bold text-sm mt-0.5 text-slate-900 dark:text-white">
                    {selectedPodTrip.deliveryProof?.signed_at
                      ? new Date(selectedPodTrip.deliveryProof.signed_at).toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'ar-MA')
                      : selectedPodTrip.departure_date}
                  </p>
                </div>
              </div>

              {/* Signature Image */}
              {selectedPodTrip.deliveryProof?.signature_url && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-xs text-slate-400 mb-2">{t('التوقيع الإلكتروني الحي للمستلم:', 'Signature électronique du destinataire :')}</p>
                  <img
                    src={selectedPodTrip.deliveryProof.signature_url}
                    alt="Recipient Signature"
                    className="max-h-24 mx-auto object-contain bg-white rounded-lg p-2 border border-slate-200"
                  />
                </div>
              )}

              {/* Stamped CMR image */}
              {(selectedPodTrip.deliveryProof?.cmr_image_url || selectedPodTrip.cmr_export_url) && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-xs text-slate-400 mb-2">{t('صورة وثيقة الـ CMR المختومة عند التسليم:', 'Copie CMR tamponnée à la livraison :')}</p>
                  <img
                    src={selectedPodTrip.deliveryProof?.cmr_image_url || selectedPodTrip.cmr_export_url}
                    alt="Stamped CMR"
                    className="max-h-36 mx-auto object-contain rounded-lg border border-slate-200"
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <a
                  href={`/api/pod/pdf?tripOrderId=${selectedPodTrip.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('تحميل وثيقة التسليم الرسمية (PDF)', 'Télécharger rapport e-POD (PDF)')}</span>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7. Invoice Print / PDF Modal */}
      {selectedInvoice && (
        <InvoicePrintModal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          invoice={selectedInvoice}
          client={client || undefined}
        />
      )}

      {/* 8. Self-Service Booking Request Modal */}
      {client && (
        <BookingRequestModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          client={client}
          lang={lang}
          onBookingCreated={(newBooking) => {
            setPortalData((prev) =>
              prev
                ? {
                    ...prev,
                    bookings: [newBooking, ...(prev.bookings || [])],
                  }
                : null
            );
          }}
        />
      )}
    </div>
  );
}

