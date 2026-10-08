'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ReeferColdChainMatrix } from './ReeferColdChainMatrix';
import { IncidentCenterDrawer } from './IncidentCenterDrawer';
import {
  getMissionControlDataAction,
  dispatchIncidentEmergencyAlertAction,
} from '../services/mission-control.actions';
import type {
  TelematicsTelemetry,
  IncidentAlert,
  MissionControlDashboardData,
} from '../types';
import {
  Radio,
  RefreshCw,
  Search,
  Layers,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Anchor,
  Activity,
  Send,
  Loader2,
  X,
} from 'lucide-react';

const MissionControlRadarMap = dynamic(
  () =>
    import('./MissionControlRadarMap').then((mod) => ({
      default: mod.MissionControlRadarMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full min-h-[520px] flex flex-col items-center justify-center bg-slate-900 text-slate-100 rounded-2xl gap-3">
        <RefreshCw className="w-9 h-9 animate-spin text-cyan-400" />
        <p className="text-sm font-medium animate-pulse">
          جاري تشغيل رادار التموضع والمبردات (Loading Live Radar)...
        </p>
      </div>
    ),
  }
);

export function MissionControlView() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MissionControlDashboardData | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<TelematicsTelemetry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [corridorFilter, setCorridorFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [tileTheme, setTileTheme] = useState<'dark' | 'satellite' | 'streets'>('dark');
  const [rightPanelTab, setRightPanelTab] = useState<'reefers' | 'incidents'>('reefers');

  // Emergency Modal State
  const [emergencyAsset, setEmergencyAsset] = useState<TelematicsTelemetry | null>(null);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [isSendingEmergency, setIsSendingEmergency] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMissionControlDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast({
          title: t('خطأ في جلب بيانات الرادار', 'Erreur chargement radar'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filtered telemetry list
  const filteredTelemetry = useMemo(() => {
    if (!data) return [];
    return data.telemetryList.filter((item) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        item.truckPlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.trailerPlate && item.trailerPlate.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.driverName && item.driverName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.tripRoute && item.tripRoute.toLowerCase().includes(searchQuery.toLowerCase()));

      // Corridor filter
      const matchesCorridor =
        corridorFilter === 'all' || item.corridorType === corridorFilter;

      // Severity filter
      const matchesSeverity =
        severityFilter === 'all' ||
        (severityFilter === 'critical' &&
          (item.tempStatus === 'critical_drift' || item.doorBreachRisk)) ||
        (severityFilter === 'warning' && item.tempStatus === 'warning') ||
        (severityFilter === 'in_port' && item.currentZoneId !== undefined);

      return matchesSearch && matchesCorridor && matchesSeverity;
    });
  }, [data, searchQuery, corridorFilter, severityFilter]);

  const handleTriggerEmergencyModal = (asset: TelematicsTelemetry) => {
    setEmergencyAsset(asset);
    setEmergencyMessage(
      `انحراف حراري بمبرد الشاحنة ${asset.truckPlate} (${asset.currentTemp}°C / المستهدف ${asset.targetTemp}°C). يرجى التوقف الفوري لفحص جهاز Frigo والباب.`
    );
  };

  const handleSendEmergency = async () => {
    if (!emergencyAsset) return;
    setIsSendingEmergency(true);
    try {
      const res = await dispatchIncidentEmergencyAlertAction({
        alertId: `emerg-${emergencyAsset.truckId}-${Date.now()}`,
        truckPlate: emergencyAsset.truckPlate,
        driverId: emergencyAsset.driverId,
        driverPhone: emergencyAsset.driverPhone,
        alertType: 'إنذار طوارئ غرفة العمليات (Mission Control)',
        message: emergencyMessage,
      });

      if (res.success) {
        toast({
          title: t('تم بث إنذار الطوارئ بنجاح 🚨', 'Alerte d’urgence diffusée 🚨'),
          description: t('تم توجيه الإشعار عبر WhatsApp والـ Push للسائق وغرفة المراقبة.', 'Notification diffusée au chauffeur et à la régie.'),
        });
        setEmergencyAsset(null);
      } else {
        toast({
          title: t('فشل الإرسال', 'Échec d’envoi'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSendingEmergency(false);
    }
  };

  const handleAlertAcknowledged = (alertId: string) => {
    if (!data) return;
    setData({
      ...data,
      activeAlerts: data.activeAlerts.filter((a) => a.id !== alertId),
    });
  };

  const summary = data?.summary;

  return (
    <div className="space-y-5" dir={dir}>
      {/* 1. Tactical Header & Live Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <h1 className="text-xl sm:text-2xl font-black font-amiri tracking-wide text-white">
              {t('غرفة العمليات المركزية ورادار المبردات TIR', 'Mission Control & Radar Frigorifique TIR')}
            </h1>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-mono">
              LIVE 24/7
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'الرصد الجيومكاني اللحظي للشاحنات، سلامة سلسلة التبريد Frigo، والسياج الجمركي لطنجة المتوسط والكركارات',
              'Suivi télématique en temps réel, intégrité de la chaîne du froid et géorepérage portuaire Tanger Med / Guerguerat'
            )}
          </p>
        </div>

        {/* Tactical Actions */}
        <div className="flex items-center gap-2">
          {/* Map Layer Switcher */}
          <div className="flex bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setTileTheme('dark')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                tileTheme === 'dark' ? 'bg-primary text-white font-bold' : 'text-slate-400'
              }`}
            >
              {t('تكتيكي', 'Tactique')}
            </button>
            <button
              onClick={() => setTileTheme('satellite')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                tileTheme === 'satellite' ? 'bg-primary text-white font-bold' : 'text-slate-400'
              }`}
            >
              {t('أقمار', 'Satellite')}
            </button>
            <button
              onClick={() => setTileTheme('streets')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                tileTheme === 'streets' ? 'bg-primary text-white font-bold' : 'text-slate-400'
              }`}
            >
              {t('طرق', 'Rues')}
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('تحديث الرادار', 'Actualiser')}</span>
          </Button>
        </div>
      </div>

      {/* 2. Tactical Metrics Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border p-3 rounded-xl shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('الأسطول النشط', 'Flotte Active')}
            </span>
            <div className="text-2xl font-black font-mono text-foreground mt-0.5 flex items-center gap-1.5">
              <Truck className="w-5 h-5 text-primary" />
              {summary.activeFleetCount}
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">
              {summary.inTransitCount} {t('على الطريق', 'en transit')}
            </span>
          </div>

          <div className="bg-card border border-border p-3 rounded-xl shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('في الموانئ والمعابر', 'Aux Ports / Douanes')}
            </span>
            <div className="text-2xl font-black font-mono text-foreground mt-0.5 flex items-center gap-1.5">
              <Anchor className="w-5 h-5 text-cyan-500" />
              {summary.portCustomsCount}
            </div>
            <span className="text-[10px] text-cyan-600 font-medium">
              {t('طنجة المتوسط والكركارات', 'Tanger Med & Guerguerat')}
            </span>
          </div>

          <div className="bg-card border border-border p-3 rounded-xl shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('مبردات Frigo المرصودة', 'Groupes Frigo')}
            </span>
            <div className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 flex items-center gap-1.5">
              <Snowflake className="w-5 h-5" />
              {summary.totalReefersAudited}
            </div>
            <span className="text-[10px] text-muted-foreground">Carrier / Thermo King</span>
          </div>

          <div
            className={`border p-3 rounded-xl shadow-xs ${
              summary.criticalDriftCount > 0
                ? 'bg-rose-500/10 border-rose-500/40'
                : 'bg-card border-border'
            }`}
          >
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('انحراف حراري حرج', 'Dérives Critiques')}
            </span>
            <div
              className={`text-2xl font-black font-mono mt-0.5 flex items-center gap-1.5 ${
                summary.criticalDriftCount > 0 ? 'text-rose-600 animate-pulse' : 'text-foreground'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              {summary.criticalDriftCount}
            </div>
            <span className="text-[10px] text-rose-600 font-medium">
              {summary.criticalDriftCount > 0 ? t('يتطلب تدخلاً فورياً!', 'Intervention Requise !') : t('0 انحراف حرج', 'Aucune')}
            </span>
          </div>

          <div
            className={`border p-3 rounded-xl shadow-xs ${
              summary.doorBreachCount > 0
                ? 'bg-rose-500/10 border-rose-500/40'
                : 'bg-card border-border'
            }`}
          >
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('فتح الأبواب أثناء السير', 'Portes Ouvertes')}
            </span>
            <div
              className={`text-2xl font-black font-mono mt-0.5 flex items-center gap-1.5 ${
                summary.doorBreachCount > 0 ? 'text-rose-600 animate-pulse' : 'text-foreground'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              {summary.doorBreachCount}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {t('مخاطر أمنية وسرقة', 'Risque sécuritaire')}
            </span>
          </div>

          <div className="bg-card border border-border p-3 rounded-xl shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('نزاهة سلسلة التبريد', 'Intégrité Chaîne Froid')}
            </span>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5" />
              {summary.overallColdChainIntegrity}%
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">
              {t('مؤشر التبريد العام', 'Indice global')}
            </span>
          </div>
        </div>
      )}

      {/* 3. Search & Filter Toolstrip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border/70 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'بحث برقم الشاحنة، المقطورة، السائق أو المسار...',
              'Rechercher immatriculation, chauffeur, itinéraire...'
            )}
            className="ps-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Corridor Filter */}
          <select
            value={corridorFilter}
            onChange={(e) => setCorridorFilter(e.target.value)}
            className="h-9 text-xs px-2.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">{t('جميع الممرات الدولية', 'Tous les corridors')}</option>
            <option value="european_maritime">
              {t('الممر الأوروبي البحري (طنجة Med ➔ إسبانيا)', 'Corridor Maritime Européen')}
            </option>
            <option value="african_overland">
              {t('الممر الإفريقي البري (الكركارات ➔ السنغال)', 'Corridor Terrestre Africain')}
            </option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 text-xs px-2.5 rounded-lg border border-border bg-background text-foreground font-medium"
          >
            <option value="all">{t('جميع الحالات', 'Tous les statuts')}</option>
            <option value="critical">{t('🚨 إنذارات حرجة فقط', '🚨 Alertes critiques uniquement')}</option>
            <option value="warning">{t('⚠️ تحذيرات تبريد', '⚠️ Avertissements')}</option>
            <option value="in_port">{t('⚓ في الموانئ والمعابر', '⚓ Dans les ports')}</option>
          </select>
        </div>
      </div>

      {/* 4. Split Command Center: Map Radar (60%) + Telematics Matrix / Incidents (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Geospatial Interactive Radar */}
        <div className="lg:col-span-7 h-[620px]">
          <MissionControlRadarMap
            telemetryList={filteredTelemetry}
            selectedAsset={selectedAsset}
            onSelectAsset={(asset) => setSelectedAsset(asset)}
            onTriggerEmergency={handleTriggerEmergencyModal}
            tileTheme={tileTheme}
          />
        </div>

        {/* Right: Reefer Telematics Matrix & Incidents Feed */}
        <div className="lg:col-span-5 space-y-4">
          {/* Panel Selector Tabs */}
          <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60">
            <button
              onClick={() => setRightPanelTab('reefers')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                rightPanelTab === 'reefers'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
              <span>{t('مصفوفة المبردات', 'Matrice Frigo')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono">
                {filteredTelemetry.length}
              </span>
            </button>

            <button
              onClick={() => setRightPanelTab('incidents')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                rightPanelTab === 'incidents'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>{t('مركز الإنذارات الميدانية', 'Centre d’Alertes')}</span>
              {data && data.activeAlerts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono animate-pulse">
                  {data.activeAlerts.length}
                </span>
              )}
            </button>
          </div>

          {/* Panel Content */}
          {rightPanelTab === 'reefers' ? (
            <ReeferColdChainMatrix
              telemetryList={filteredTelemetry}
              selectedAsset={selectedAsset}
              onSelectAsset={(asset) => setSelectedAsset(asset)}
              onTriggerEmergency={handleTriggerEmergencyModal}
            />
          ) : (
            <IncidentCenterDrawer
              alerts={data?.activeAlerts || []}
              onAlertAcknowledged={handleAlertAcknowledged}
            />
          )}
        </div>
      </div>

      {/* 5. Emergency Intervention Dispatch Modal */}
      {emergencyAsset && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-border">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-base">
                  {t('بث إنذار طوارئ فوري للشاحنة', 'Diffuser une Alerte d’Urgence')}
                </h3>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="w-7 h-7"
                onClick={() => setEmergencyAsset(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1">
                <p className="font-bold text-rose-700 dark:text-rose-300">
                  {t('الشاحنة المستهدفة:', 'Camion :')} {emergencyAsset.truckPlate} ({emergencyAsset.trailerPlate})
                </p>
                <p className="text-muted-foreground">
                  {t('السائق:', 'Chauffeur :')} {emergencyAsset.driverName} ({emergencyAsset.driverPhone || 'الهاتف غير مسجل'})
                </p>
                <p className="text-muted-foreground">
                  {t('درجة الحرارة الحالية:', 'Temp Actuelle :')}{' '}
                  <strong className="text-rose-600">{emergencyAsset.currentTemp}°C</strong>{' '}
                  ({t('المستهدف:', 'Consigne :')} {emergencyAsset.targetTemp}°C)
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  {t('نص الإنذار الموجه للسائق وغرفة العمليات:', 'Message d’alerte :')}
                </label>
                <textarea
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmergencyAsset(null)}
              >
                {t('إلغاء', 'Annuler')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={isSendingEmergency}
                onClick={handleSendEmergency}
              >
                {isSendingEmergency ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{t('إرسال فوري عبر WhatsApp & Push', 'Envoyer WhatsApp & Push')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

