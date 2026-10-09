'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import type { Driver, Truck } from '@/types/database';
import type {
  TransitCorridorType,
  TransitComplianceStatus,
  TransitAuditResult,
  TransitWatchdogSummary,
  TransitExpiryAlertItem,
} from '../types/transit-watchdog.types';
import {
  getTransitWatchdogRadarDataAction,
  auditTripDispatchAction,
  sendDriverExpiryWhatsAppAlertAction,
  updateDriverTransitCredentialsAction,
} from '../services/transit-watchdog.actions';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Globe2,
  Calendar,
  Phone,
  Send,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  FileCheck,
  User,
  Truck as TruckIcon,
  HelpCircle,
} from 'lucide-react';

interface TransitWatchdogRadarViewProps {
  initialSummary?: TransitWatchdogSummary;
  initialDrivers?: Driver[];
  initialTrucks?: Truck[];
  initialAlerts?: TransitExpiryAlertItem[];
}

export function TransitWatchdogRadarView({
  initialSummary,
  initialDrivers,
  initialTrucks,
  initialAlerts,
}: TransitWatchdogRadarViewProps) {
  const { t, locale, dir } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [summary, setSummary] = useState<TransitWatchdogSummary | null>(initialSummary || null);
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers || []);
  const [trucks, setTrucks] = useState<Truck[]>(initialTrucks || []);
  const [alerts, setAlerts] = useState<TransitExpiryAlertItem[]>(initialAlerts || []);
  const [loading, setLoading] = useState(false);

  // Simulator State
  const [simDriverId, setSimDriverId] = useState<number>(0);
  const [simTruckId, setSimTruckId] = useState<number>(0);
  const [simCorridor, setSimCorridor] = useState<TransitCorridorType>('european_maritime');
  const [auditResult, setAuditResult] = useState<TransitAuditResult | null>(null);

  // Alerts search and filter
  const [alertSearch, setAlertSearch] = useState('');
  const [corridorFilter, setCorridorFilter] = useState<string>('all');
  const [alertStatusMessage, setAlertStatusMessage] = useState<string | null>(null);

  // Quick edit modal
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editPassportDate, setEditPassportDate] = useState('');
  const [editSchengenDate, setEditSchengenDate] = useState('');
  const [editAfricanDate, setEditAfricanDate] = useState('');

  useEffect(() => {
    if (!summary || drivers.length === 0) {
      handleRefresh();
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await getTransitWatchdogRadarDataAction();
      setSummary(data.summary);
      setDrivers(data.drivers);
      setTrucks(data.trucks);
      setAlerts(data.alerts);
      if (data.drivers.length > 0 && !simDriverId) {
        setSimDriverId(data.drivers[0].id);
      }
      if (data.trucks.length > 0 && !simTruckId) {
        setSimTruckId(data.trucks[0].id);
      }
    } catch (err) {
      console.error('Failed to load watchdog data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAuditSimulation = async () => {
    if (!simDriverId) return;
    startTransition(async () => {
      const res = await auditTripDispatchAction({
        driver_id: simDriverId,
        truck_id: simTruckId || null,
        corridor_type: simCorridor,
      });
      if (res.success && res.auditResult) {
        setAuditResult(res.auditResult);
      }
    });
  };

  const handleSendWhatsAppAlert = async (alertItem: TransitExpiryAlertItem) => {
    startTransition(async () => {
      const res = await sendDriverExpiryWhatsAppAlertAction({
        driver_id: alertItem.entity_id,
        document_name_ar: alertItem.document_name,
        document_name_fr: alertItem.document_name,
        document_name_es: alertItem.document_name,
        days_remaining: alertItem.days_remaining,
        expiry_date: alertItem.expiry_date,
        locale: locale === 'es' ? 'es' : locale === 'fr' ? 'fr' : 'ar',
      });

      if (res.success) {
        setAlertStatusMessage(
          t(
            `تم إرسال تنبيه واتساب بنجاح إلى السائق ${alertItem.entity_name}`,
            `Alerte WhatsApp envoyée avec succès à ${alertItem.entity_name}`,
            `Alerta de WhatsApp enviada con éxito a ${alertItem.entity_name}`
          )
        );
        setTimeout(() => setAlertStatusMessage(null), 4000);
      }
    });
  };

  const handleSaveDriverCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    startTransition(async () => {
      const res = await updateDriverTransitCredentialsAction({
        driver_id: editingDriver.id,
        passport_expiry_date: editPassportDate || null,
        visa_expiry_date: editSchengenDate || null,
        african_visa_expiry_date: editAfricanDate || null,
      });

      if (res.success) {
        setEditingDriver(null);
        handleRefresh();
      }
    });
  };

  const filteredAlerts = alerts.filter((a) => {
    if (corridorFilter !== 'all' && a.corridor_type !== corridorFilter) return false;
    if (alertSearch.trim()) {
      const q = alertSearch.toLowerCase();
      return a.entity_name.toLowerCase().includes(q) || a.document_name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header and Hero Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t(
                  'رادار وثائق العبور وتأشيرات السائقين الدولية (EU & Africa Watchdog)',
                  'Radar des Visas & Conformité Transit International (UE & Afrique)',
                  'Radar de Visados y Cumplimiento de Tránsito Internacional'
                )}
              </h1>
              <p className="text-sm text-slate-400">
                {t(
                  'فحص آلي مسبق لتأشيرات شنغن، موريتانيا، السنغال، والبطاقات الخضراء والبنية قبل انطلاق الرحلات',
                  'Contrôle automatique pré-dispatch des visas Schengen, Mauritanie, Sénégal, Carte Verte & Brune',
                  'Control automático previo al despacho de visados Schengen, Mauritania, Senegal, Carta Verde y Marrón'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {alertStatusMessage && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-600/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{alertStatusMessage}</span>
        </div>
      )}

      {/* Bento Grid: Watchdog KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Rate */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('معدل الجاهزية والامتثال الدولي', 'Taux de Conformité Roster', 'Tasa de Conformidad')}</span>
              <FileCheck className="w-4 h-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {summary?.complianceRatePercentage || '100%'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.compliantCount || 0} / {summary?.totalMonitoredDrivers || 0} {t('سائق جاهز دون موانع', 'chauffeurs qualifiés', 'conductores aptos')}
            </div>
          </CardContent>
        </Card>

        {/* European Corridor Ready */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('الممر الأوروبي (شنغن)', 'Corridor Europe (Schengen)', 'Corredor Europeo')}</span>
              <Globe2 className="w-4 h-4 text-blue-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-blue-400">
              {summary?.europeanCorridorReadyCount || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] bg-blue-950/40 border-blue-600/40 text-blue-300">
                {t('تأشيرة شنغن وبطاقة خضراء سارية', 'Visa Pro & Carte Verte OK', 'Visado y Carta Verde OK')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* African Corridor Ready */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('الممر الإفريقي (موريتانيا/السنغال)', 'Corridor Afrique (Transit)', 'Corredor Africano')}</span>
              <TruckIcon className="w-4 h-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-400">
              {summary?.africanCorridorReadyCount || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] bg-amber-950/40 border-amber-600/40 text-amber-300">
                {t('معبر الكركارات وبطاقة بنية OK', 'Guerguerat & Carte Brune OK', 'Guerguerat y Carta Marrón OK')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Expiring / Critical Alerts */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t('تنبيهات قرب الانتهاء (≤30 يوم)', 'Alertes Expirations Proches', 'Alertas de Vencimiento')}</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-rose-400">
              {alerts.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.expiredOrBlockedCount ? (
                <span className="text-rose-400 font-semibold">
                  {summary.expiredOrBlockedCount} {t('موانع انطلاق حرجة حالية', 'blocages actifs', 'bloqueos activos')}
                </span>
              ) : (
                <span className="text-emerald-400">
                  {t('لا توجد موانع انطلاق حرجة', 'Aucun blocage', 'Sin bloqueos')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulator: Interactive Trip Pre-Dispatch Checker */}
      <Card className="bg-slate-900 border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">
              {t('أداة محاكاة التحقق من أهلية الرحلة الدولية قبل الانطلاق', 'Simulateur d’Audit Pré-Dispatch de Mission', 'Simulador de Auditoría de Misión')}
            </h2>
          </div>
          <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-300">
            {t('حماية من التوقيف الحدودي', 'Protection Anti-Blocage Frontière', 'Protección Fronteriza')}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Driver Select */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              {t('السائق المرشح للرحلة', 'Chauffeur candidat', 'Conductor candidato')}
            </label>
            <select
              value={simDriverId}
              onChange={(e) => setSimDriverId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.has_valid_visa ? '✓ (Visa)' : '⚠️'}
                </option>
              ))}
            </select>
          </div>

          {/* Truck Select */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              {t('الشاحنة المخصصة', 'Tracteur affecté', 'Camión asignado')}
            </label>
            <select
              value={simTruckId}
              onChange={(e) => setSimTruckId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none"
            >
              <option value={0}>{t('بدون تحديد شاحنة', 'Sans tracteur spécifique', 'Sin camión específico')}</option>
              {trucks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.plate_number} ({tr.model || 'TIR'})
                </option>
              ))}
            </select>
          </div>

          {/* Corridor Select */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              {t('الممر الدولي المستهدف', 'Corridor International', 'Corredor')}
            </label>
            <select
              value={simCorridor}
              onChange={(e) => setSimCorridor(e.target.value as TransitCorridorType)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none"
            >
              <option value="european_maritime">🇪🇺 {t('الممر الأوروبي (طنجة المتوسط ➔ إسبانيا/فرنسا)', 'Europe (Tanger Med -> Espagne/France)', 'Europa (Tánger Med -> España/Francia)')}</option>
              <option value="african_overland">🇲🇷 {t('الممر الإفريقي البري (الكركارات ➔ موريتانيا/السنغال)', 'Afrique (Guerguerat -> Mauritanie/Sénégal)', 'África (Guerguerat -> Mauritania/Senegal)')}</option>
              <option value="domestic_morocco">🇲🇦 {t('النقل الوطني الداخلي بالمغرب', 'National Maroc', 'Nacional Marruecos')}</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleRunAuditSimulation}
            disabled={isPending || !simDriverId}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin me-2" /> : <ShieldCheck className="w-4 h-4 me-2" />}
            {t('فحص الأهلية المسبقة', 'Vérifier la Conformité', 'Comprobar Conformidad')}
          </Button>
        </div>

        {/* Audit Results Panel */}
        {auditResult && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-in fade-in">
            {/* Status Banner */}
            <div
              className={`p-4 rounded-xl flex items-center justify-between border ${
                auditResult.is_dispatch_allowed
                  ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-700 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {auditResult.is_dispatch_allowed ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {auditResult.is_dispatch_allowed
                      ? t('جاهز ومؤهل للانطلاق الدولي ✓', 'Dispatch de Mission Autorisé ✓', 'Despacho Autorizado ✓')
                      : t('محظور من الانطلاق الدولي ⛔', 'Dispatch de Mission Bloqué ⛔', 'Despacho Bloqueado ⛔')}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">
                    {auditResult.is_dispatch_allowed
                      ? t('كافة الوثائق الإلزامية صالحة وتلبي سقف الأمان الزمني للعبور', 'Tous les documents requis sont valides pour ce corridor', 'Todos los documentos requeridos son válidos')
                      : t('توجد وثائق منتهية أو غير مسجلة تحول دون العبور الجمركي', 'Des documents requis sont manquants ou expirés', 'Hay documentos obligatorios vencidos o no registrados')}
                  </p>
                </div>
              </div>
            </div>

            {/* Blockers or Warnings List */}
            {auditResult.block_reasons.length > 0 && (
              <div className="p-3 bg-rose-950/30 border border-rose-800 rounded-xl space-y-1">
                <span className="text-xs font-bold text-rose-400 block mb-1">
                  {t('أسباب المنع الإلزامية:', 'Motifs de blocage stricts:', 'Motivos de bloqueo:')}
                </span>
                {auditResult.block_reasons.map((reason, i) => (
                  <div key={i} className="text-xs text-rose-200 flex items-center gap-2">
                    <span className="text-rose-500">•</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Document Checklist Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {auditResult.evaluated_documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">
                      {locale === 'es' ? doc.documentNameEs : locale === 'fr' ? doc.documentNameFr : doc.documentNameAr}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {doc.expiryDate ? `${t('تاريخ الانتهاء:', 'Expire:', 'Vence:')} ${doc.expiryDate}` : t('غير مسجل', 'Non renseigné', 'No registrado')}
                    </span>
                  </div>

                  <div className="text-end">
                    {doc.status === 'compliant' ? (
                      <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-600">
                        {doc.daysRemaining}j {t('متبقي', 'restants', 'días')}
                      </Badge>
                    ) : doc.status === 'warning' ? (
                      <Badge className="bg-amber-950 text-amber-400 border border-amber-600">
                        {doc.daysRemaining}j ⚠️
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-950 text-rose-400 border border-rose-600">
                        {t('منتهي / غير متوفر', 'Expiré / Manquant', 'Vencido')}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Active Expiry Alerts & WhatsApp Trigger Table */}
      <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              {t('سجل التنبيهات الاستباقية للوثائق القريبة من الانتهاء', 'Registre des Alertes d’Expiration Proche', 'Registro de Alertas')}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-400" />
              <Input
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                placeholder={t('بحث بسجل السائق...', 'Rechercher chauffeur...', 'Buscar conductor...')}
                className="ps-8 text-xs bg-slate-800 border-slate-700 text-white h-8 w-48"
              />
            </div>

            <select
              value={corridorFilter}
              onChange={(e) => setCorridorFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none"
            >
              <option value="all">{t('جميع الممرات', 'Tous les corridors', 'Todos los corredores')}</option>
              <option value="european_maritime">Europe (Schengen)</option>
              <option value="african_overland">Afrique (Transit)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/60 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 text-start">{t('السائق', 'Chauffeur', 'Conductor')}</th>
                <th className="py-3 px-4 text-start">{t('الوثيقة', 'Document', 'Documento')}</th>
                <th className="py-3 px-4 text-start">{t('الممر', 'Corridor', 'Corredor')}</th>
                <th className="py-3 px-4 text-start">{t('تاريخ الانتهاء', 'Date Expiration', 'Fecha Vencimiento')}</th>
                <th className="py-3 px-4 text-center">{t('الأيام المتبقية', 'Jours Restants', 'Días')}</th>
                <th className="py-3 px-4 text-end">{t('الإجراءات', 'Actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />
                    <p>{t('جميع تأشيرات السائقين ووثائق العبور في وضعية سليمة', 'Tous les documents sont à jour et conformes', 'Todos los documentos están al día')}</p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      {item.entity_name}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {item.document_name}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] bg-slate-800 border-slate-700">
                        {item.corridor_type === 'european_maritime' ? '🇪🇺 Europe' : '🇲🇷 Afrique'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {item.expiry_date}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          item.days_remaining < 0
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : item.days_remaining <= 15
                            ? 'bg-rose-900/60 text-rose-300 border border-rose-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-700'
                        }`}
                      >
                        {item.days_remaining < 0 ? t('منتهي', 'Expiré', 'Vencido') : `${item.days_remaining}j`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const foundDriver = drivers.find((d) => d.id === item.entity_id);
                            if (foundDriver) {
                              setEditingDriver(foundDriver);
                              setEditPassportDate((foundDriver as any).passport_expiry_date || '');
                              setEditSchengenDate(foundDriver.visa_expiry_date || '');
                              setEditAfricanDate(foundDriver.african_visa_expiry_date || '');
                            }
                          }}
                          className="h-7 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                          {t('تحديث التاريخ', 'Mettre à jour', 'Actualizar')}
                        </Button>

                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleSendWhatsAppAlert(item)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <Send className="w-3 h-3 me-1.5" />
                          {t('تنبيه واتساب', 'Alerte WhatsApp', 'Alerta WhatsApp')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Edit Driver Credentials Modal */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold">
                {t(`تجديد وثائق السائق: ${editingDriver.name}`, `Mettre à jour les documents: ${editingDriver.name}`, `Actualizar documentos: ${editingDriver.name}`)}
              </h3>
              <button onClick={() => setEditingDriver(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveDriverCredentials} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  {t('تاريخ انتهاء جواز السفر الدولي (6 أشهر كحد أدنى)', 'Expiration Passeport International (min 6 mois)', 'Vencimiento Pasaporte')}
                </label>
                <Input
                  type="date"
                  value={editPassportDate}
                  onChange={(e) => setEditPassportDate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  {t('تاريخ انتهاء تأشيرة شنغن الأوروبية', 'Expiration Visa Schengen (Europe)', 'Vencimiento Visado Schengen')}
                </label>
                <Input
                  type="date"
                  value={editSchengenDate}
                  onChange={(e) => setEditSchengenDate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  {t('تاريخ انتهاء تأشيرة الممر الإفريقي (موريتانيا/السنغال)', 'Expiration Visa Transit Africain', 'Vencimiento Visado Africano')}
                </label>
                <Input
                  type="date"
                  value={editAfricanDate}
                  onChange={(e) => setEditAfricanDate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDriver(null)}
                  className="border-slate-700 bg-slate-800 text-slate-300"
                >
                  {t('إلغاء', 'Annuler', 'Cancelar')}
                </Button>
                <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-500 text-white">
                  {t('حفظ التحديث', 'Enregistrer', 'Guardar')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

