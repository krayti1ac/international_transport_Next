'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Wrench,
  DollarSign,
  Cpu,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Truck,
  TrendingUp,
  Layers,
  Thermometer,
  Gauge,
  Zap,
} from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import {
  getFleetObdRadarDataAction,
  ingestDtcFaultAction,
  resolveDtcFaultAction,
  scheduleFromRecommendationAction,
  type FleetObdRadarDataResponse,
} from '../services/obd-maintenance.actions';
import { STANDARD_DTC_CATALOG, lookupDtcProfile } from '../services/predictive-maintenance-radar.service';
import type {
  FleetObdDiagnosticEvent,
  PredictiveMaintenanceRecommendation,
  HighRiskTruckAlert,
  DtcSeverity,
  UrgencyLevel,
} from '../types/obd-diagnostic.types';

export function PredictiveMaintenanceRadarView() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState<FleetObdRadarDataResponse | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedTruckFilter, setSelectedTruckFilter] = useState<number | undefined>(undefined);

  // Ingestion Modal State
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [ingestTruckId, setIngestTruckId] = useState<number | ''>('');
  const [ingestDtcCode, setIngestDtcCode] = useState<string>('P0299');
  const [ingestCorridor, setIngestCorridor] = useState<'DOMESTIC' | 'MA-ES-FR' | 'MA-MR-SN'>('DOMESTIC');
  const [ingestCoolantTemp, setIngestCoolantTemp] = useState<string>('95');
  const [ingestOilPressure, setIngestOilPressure] = useState<string>('350');
  const [ingestBatteryVoltage, setIngestBatteryVoltage] = useState<string>('24.2');
  const [isSubmittingIngest, setIsSubmittingIngest] = useState(false);

  // Resolve Modal State
  const [selectedEventToResolve, setSelectedEventToResolve] = useState<FleetObdDiagnosticEvent | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [createScheduleOnResolve, setCreateScheduleOnResolve] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  // Schedule Modal State
  const [selectedRecToSchedule, setSelectedRecToSchedule] = useState<PredictiveMaintenanceRecommendation | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [isScheduling, setIsScheduling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFleetObdRadarDataAction({
        truck_id: selectedTruckFilter,
        severity: severityFilter as 'all' | 'critical' | 'moderate' | 'minor' | 'informational',
      });
      if (res.success && res.data) {
        setRadarData(res.data);
      } else {
        toast({
          title: t('خطأ', 'Erreur', 'Error'),
          description: res.error || t('فشل تحميل رادار الأعطال', 'Échec du chargement du radar'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ title: t('خطأ', 'Erreur', 'Error'), description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedTruckFilter, severityFilter, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Preview profile for the selected DTC in simulator modal
  const previewProfile = useMemo(() => {
    if (!ingestDtcCode) return null;
    return lookupDtcProfile(ingestDtcCode);
  }, [ingestDtcCode]);

  const handleIngestDtc = async () => {
    if (!ingestTruckId) {
      toast({
        title: t('تنبيه', 'Attention', 'Warning'),
        description: t('يرجى اختيار الشاحنة', 'Veuillez sélectionner le camion', 'Please select a truck'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingIngest(true);
    try {
      const res = await ingestDtcFaultAction({
        truck_id: Number(ingestTruckId),
        dtc_code: ingestDtcCode.trim(),
        target_corridor: ingestCorridor,
        freeze_frame: {
          coolant_temp_c: ingestCoolantTemp ? Number(ingestCoolantTemp) : undefined,
          oil_pressure_kpa: ingestOilPressure ? Number(ingestOilPressure) : undefined,
          battery_voltage: ingestBatteryVoltage ? Number(ingestBatteryVoltage) : undefined,
        },
      });

      if (res.success) {
        toast({
          title: t('تم تسجيل العطل بنجاح', 'Anomalie enregistrée avec succès', 'Fault recorded successfully'),
          description: t(
            `تم توليد التوصية الوقائية لكود ${ingestDtcCode}`,
            `Recommandation préventive générée pour ${ingestDtcCode}`,
            `Preventive recommendation generated for ${ingestDtcCode}`
          ),
        });
        setIsIngestModalOpen(false);
        fetchData();
      } else {
        toast({ title: t('خطأ', 'Erreur', 'Error'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSubmittingIngest(false);
    }
  };

  const handleResolveEvent = async () => {
    if (!selectedEventToResolve) return;
    if (!resolutionNotes.trim()) {
      toast({
        title: t('تنبيه', 'Attention', 'Warning'),
        description: t('يرجى كتابة ملاحظات الإصلاح', 'Veuillez renseigner les notes d\'intervention', 'Please enter repair notes'),
        variant: 'destructive',
      });
      return;
    }

    setIsResolving(true);
    try {
      const res = await resolveDtcFaultAction({
        event_id: selectedEventToResolve.id,
        resolution_notes: resolutionNotes.trim(),
        create_maintenance_schedule: createScheduleOnResolve,
      });

      if (res.success) {
        toast({
          title: t('تم إغلاق العطل', 'Anomalie résolue', 'Fault resolved'),
          description: t('تم تحديث حالة الواقعة بنجاح', 'Statut mis à jour avec succès', 'Status updated successfully'),
        });
        setSelectedEventToResolve(null);
        setResolutionNotes('');
        fetchData();
      } else {
        toast({ title: t('خطأ', 'Erreur', 'Error'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsResolving(false);
    }
  };

  const handleScheduleRecommendation = async () => {
    if (!selectedRecToSchedule) return;

    setIsScheduling(true);
    try {
      const res = await scheduleFromRecommendationAction({
        recommendation_id: selectedRecToSchedule.id,
        scheduled_date: scheduleDate,
      });

      if (res.success) {
        toast({
          title: t('تم إدراج الموعد في جدول الصيانة', 'Maintenance programmée', 'Maintenance scheduled'),
          description: t(
            `تمت جدولة الصيانة لتاريخ ${scheduleDate}`,
            `Planifiée pour le ${scheduleDate}`,
            `Scheduled for ${scheduleDate}`
          ),
        });
        setSelectedRecToSchedule(null);
        fetchData();
      } else {
        toast({ title: t('خطأ', 'Erreur', 'Error'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsScheduling(false);
    }
  };

  const summary = radarData?.summary;
  const events = radarData?.events || [];
  const recommendations = radarData?.recommendations || [];
  const trucks = radarData?.trucks || [];

  const getSeverityBadge = (sev: DtcSeverity) => {
    switch (sev) {
      case 'critical':
        return <Badge variant="destructive" className="bg-rose-500/15 text-rose-600 border-rose-500/30 font-bold">{t('حرج جداً', 'Critique', 'Critical')}</Badge>;
      case 'moderate':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold">{t('متوسط', 'Modéré', 'Moderate')}</Badge>;
      case 'minor':
        return <Badge className="bg-sky-500/15 text-sky-600 border-sky-500/30 font-bold">{t('طفيف', 'Mineur', 'Minor')}</Badge>;
      default:
        return <Badge variant="secondary">{t('معلوماتي', 'Info', 'Info')}</Badge>;
    }
  };

  const getUrgencyBadge = (urg: UrgencyLevel) => {
    switch (urg) {
      case 'immediate_stop':
        return <Badge className="bg-red-600 text-white font-extrabold animate-pulse">{t('إيقاف فوري للشاحنة', 'Arrêt Immédiat', 'Immediate Stop')}</Badge>;
      case 'within_24h':
        return <Badge className="bg-amber-600/90 text-white font-bold">{t('خلال 24 ساعة', 'Sous 24h', 'Within 24h')}</Badge>;
      case 'next_scheduled_service':
        return <Badge className="bg-blue-600/90 text-white font-bold">{t('الصيانة القادمة', 'Prochain service', 'Next Service')}</Badge>;
      default:
        return <Badge variant="outline">{t('أولوية منخفضة', 'Basse priorité', 'Low Priority')}</Badge>;
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header with Title and Simulation Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            <span>
              {t(
                'رادار الصيانة التنبؤية وتشخيص الأعطال بالذكاء الاصطناعي (OBD-II / J1939)',
                'Radar de Maintenance Prédictive & Diagnostics IA (OBD-II / J1939)',
                'Predictive Maintenance Radar & AI Diagnostics (OBD-II / J1939)'
              )}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'الاستشعار المبكر للأعطال الميكانيكية، حساب احتمالية التوقف القسري، والوفر المالي الميداني بدقة Decimal.js',
              'Détection précoce des anomalies, calcul des probabilités de panne et économies d\'entretien',
              'Early mechanical fault sensing, roadside breakdown probability calculation, and financial savings'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('تحديث', 'Actualiser', 'Refresh')}</span>
          </Button>

          <Button
            onClick={() => setIsIngestModalOpen(true)}
            className="rounded-xl text-xs gap-1.5 h-9 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('محاكاة فحص OBD-II للشاحنة', 'Simuler diagnostic OBD-II', 'Simulate OBD-II Scan')}</span>
          </Button>
        </div>
      </div>

      {/* Bento Grid KPI Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Fleet Health Index */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('مؤشر الصحة الميكانيكية للأسطول', 'Indice de Santé Global', 'Fleet Mechanical Health')}
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {summary?.average_fleet_health_index || '100.00'}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">/ 100</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Active Critical Faults */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('أعطال حرجة نشطة (DTC)', 'Pannes Critiques Actives', 'Active Critical Faults')}
              </p>
              <p className="text-2xl font-bold font-mono text-rose-600 mt-0.5">
                {summary?.critical_faults_count || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Trucks at Breakdown Risk */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('شاحنات معرضة للتعطل على الطريق', 'Camions à Risque de Panne', 'Trucks at Breakdown Risk')}
              </p>
              <p className="text-2xl font-bold font-mono text-amber-600 mt-0.5">
                {summary?.trucks_at_breakdown_risk || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Financial Net Savings */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('الوفر المالي للصيانة الاستباقية', 'Économies Prédictives', 'Projected Net Savings')}
              </p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                {formatCurrency(Number(summary?.total_net_savings_mad || '0'), 'MAD')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: High Risk Radar + Real-time Telemetry Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): High Risk Radar Table */}
        <Card className="lg:col-span-2 border-border overflow-hidden">
          <CardHeader className="border-b border-border/70 py-3.5 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-500" />
              <span>
                {t(
                  'رادار الشاحنات عالية الخطورة الميكانيكية',
                  'Radar des Camions à Haut Risque Mécanique',
                  'High Risk Mechanical Radar'
                )}
              </span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {summary?.high_risk_trucks.length || 0} {t('شاحنة قيد الرصد', 'surveillés', 'monitored')}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {summary?.high_risk_trucks && summary.high_risk_trucks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 text-start font-semibold">{t('الشاحنة', 'Camion', 'Truck')}</th>
                      <th className="py-2.5 px-4 text-start font-semibold">{t('مؤشر الصحة', 'Santé', 'Health')}</th>
                      <th className="py-2.5 px-4 text-start font-semibold">{t('احتمالية التعطل', 'Risque Panne', 'Breakdown Risk')}</th>
                      <th className="py-2.5 px-4 text-start font-semibold">{t('أبرز كود عطل', 'Code Principal', 'Top Fault')}</th>
                      <th className="py-2.5 px-4 text-start font-semibold">{t('مستوى الاستعجال', 'Urgence', 'Urgency')}</th>
                      <th className="py-2.5 px-4 text-end font-semibold">{t('إجراء', 'Action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.high_risk_trucks.map((truck) => (
                      <tr key={truck.truck_id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <MatriculeBadge plate={truck.plate_number} />
                          {truck.model && <p className="text-[10px] text-muted-foreground mt-0.5">{truck.model}</p>}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <div className="flex items-center gap-1.5">
                            <span className={Number(truck.health_index) < 70 ? 'text-rose-600' : 'text-amber-600'}>
                              {truck.health_index}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className={Number(truck.risk_pct) > 60 ? 'text-rose-600' : 'text-amber-600'}>
                            {truck.risk_pct}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-foreground">{truck.top_fault}</span>
                            {getSeverityBadge(truck.severity)}
                          </div>
                        </td>
                        <td className="py-3 px-4">{getUrgencyBadge(truck.urgency)}</td>
                        <td className="py-3 px-4 text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTruckFilter(truck.truck_id)}
                            className="h-7 text-xs px-2 text-primary"
                          >
                            {t('فحص التفاصيل', 'Détails', 'Inspect')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p>
                  {t(
                    'كافة شاحنات الأسطول تتمتع بصحة ميكانيكية ممتازة ولا توجد أعطال حرجة.',
                    'Tous les camions sont en excellent état mécanique sans anomalie critique.',
                    'All fleet trucks are operating in optimal mechanical condition with no critical faults.'
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Predictive Recommendations & Parts List */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="border-b border-border/70 py-3.5 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-500" />
              <span>
                {t(
                  'توصيات الصيانة وقطع الغيار',
                  'Recommandations & Pièces',
                  'Predictive Action Plan'
                )}
              </span>
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {recommendations.length} {t('توصية', 'actions', 'actions')}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5 max-h-[460px] overflow-y-auto">
            {recommendations.length > 0 ? (
              recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl border border-border bg-card/50 space-y-2 hover:border-indigo-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                      {rec.truck?.plate_number || `#${rec.truck_id}`}
                    </span>
                    {getUrgencyBadge(rec.urgency)}
                  </div>

                  <p className="text-xs text-foreground font-semibold line-clamp-2">
                    {rec.recommended_action}
                  </p>

                  {/* Financial Savings comparison */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/50">
                    <div>
                      <span className="text-muted-foreground">{t('كلفة الاستبدال:', 'Coût:', 'Proactive Cost:')}</span>{' '}
                      <span className="font-mono font-bold text-foreground">
                        {formatCurrency(Number(rec.estimated_cost_mad), 'MAD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('وفر التعطل:', 'Épargne:', 'Savings:')}</span>{' '}
                      <span className="font-mono font-bold text-emerald-600">
                        {formatCurrency(Number(rec.estimated_savings_mad), 'MAD')}
                      </span>
                    </div>
                  </div>

                  {rec.status === 'pending' ? (
                    <Button
                      size="sm"
                      onClick={() => setSelectedRecToSchedule(rec)}
                      className="w-full h-7 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white mt-1"
                    >
                      <Calendar className="w-3.5 h-3.5 me-1" />
                      {t('جدولة في خطة الصيانة', 'Planifier en atelier', 'Schedule in Maintenance')}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="w-full justify-center py-1 text-emerald-600 border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 me-1" />
                      {t('تمت الجدولة بنجاح', 'Maintenance Planifiée', 'Scheduled')}
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {t('لا توجد توصيات صيانة معلقة حالياً.', 'Aucune recommandation en attente.', 'No pending recommendations.')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Ingested OBD-II Telemetry Events Feed */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="border-b border-border/70 py-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>
                {t(
                  'سجل وقائع أكواد الأعطال التشخيصية (Active OBD-II / DTC Stream)',
                  'Flux d\'Événements Télématiques OBD-II Actifs',
                  'Active OBD-II / DTC Telemetry Event Stream'
                )}
              </span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">{events.length}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
            >
              <option value="all">{t('كافة مستويات الخطورة', 'Toutes sévérités', 'All Severities')}</option>
              <option value="critical">{t('حرج فقط', 'Critique uniquement', 'Critical only')}</option>
              <option value="moderate">{t('متوسط', 'Modéré', 'Moderate')}</option>
              <option value="minor">{t('طفيف', 'Mineur', 'Minor')}</option>
            </select>

            {selectedTruckFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTruckFilter(undefined)}
                className="h-8 text-xs text-muted-foreground"
              >
                {t('إلغاء تصفية الشاحنة', 'Réinitialiser filtre', 'Clear Truck Filter')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('الشاحنة', 'Camion', 'Truck')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('كود DTC', 'Code DTC', 'DTC Code')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('الفئة والخطورة', 'Catégorie & Sévérité', 'Category & Severity')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('التشخيص الميداني', 'Description', 'Description')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('بيانات التجميد (Freeze-Frame)', 'Freeze-Frame', 'Freeze Frame')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('الحالة', 'Statut', 'Status')}</th>
                    <th className="py-2.5 px-4 text-end font-semibold">{t('إجراء', 'Action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <MatriculeBadge plate={evt.truck?.plate_number || `#${evt.truck_id}`} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-foreground text-sm">{evt.dtc_code}</span>
                          {evt.mil_status && (
                            <Badge variant="destructive" className="h-4 text-[9px] px-1 font-bold">
                              MIL
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="capitalize text-muted-foreground">{evt.category}</span>
                          <div>{getSeverityBadge(evt.severity)}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="line-clamp-2 text-foreground font-medium">{evt.description}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground">
                          {evt.freeze_frame_data?.coolant_temp_c !== undefined && (
                            <span className="flex items-center gap-0.5">
                              <Thermometer className="w-3 h-3 text-rose-500" />
                              {evt.freeze_frame_data.coolant_temp_c}°C
                            </span>
                          )}
                          {evt.freeze_frame_data?.oil_pressure_kpa !== undefined && (
                            <span className="flex items-center gap-0.5">
                              <Gauge className="w-3 h-3 text-sky-500" />
                              {evt.freeze_frame_data.oil_pressure_kpa} kPa
                            </span>
                          )}
                          {evt.freeze_frame_data?.battery_voltage !== undefined && (
                            <span className="flex items-center gap-0.5">
                              <Zap className="w-3 h-3 text-amber-500" />
                              {evt.freeze_frame_data.battery_voltage}V
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {evt.status === 'active' ? (
                          <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold">
                            {t('نشط', 'Actif', 'Active')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500/20 font-bold">
                            {t('تم الإصلاح', 'Résolu', 'Resolved')}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end">
                        {evt.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEventToResolve(evt)}
                            className="h-7 text-xs px-2 text-indigo-600 hover:text-indigo-700"
                          >
                            {t('إغلاق ومعالجة', 'Résoudre', 'Resolve')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('لا توجد وقائع أعطال مسجلة تطابق التصفية الحالية.', 'Aucune anomalie enregistrée.', 'No diagnostic events matching filter.')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulation / Ingest Fault Modal */}
      <Dialog open={isIngestModalOpen} onOpenChange={setIsIngestModalOpen}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>{t('محاكاة فحص واستقبال كود OBD-II / DTC للشاحنة', 'Simulateur Diagnostic OBD-II', 'Simulate OBD-II Diagnostic Scan')}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Truck Selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('اختر الشاحنة المعنية', 'Camion cible', 'Select Target Truck')}</label>
              <select
                value={ingestTruckId}
                onChange={(e) => setIngestTruckId(e.target.value ? Number(e.target.value) : '')}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 font-medium text-xs"
              >
                <option value="">{t('-- اختر شاحنة من الأسطول --', '-- Choisir un camion --', '-- Select a truck --')}</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.plate_number} {t.model ? `(${t.model})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Standard DTC Code Selection */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('كود العطل التشخيصي (DTC / J1939)', 'Code DTC', 'Diagnostic DTC Code')}</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={ingestDtcCode}
                  onChange={(e) => setIngestDtcCode(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 font-mono font-bold text-xs"
                >
                  <option value="P0299">P0299 - Turbo Underboost</option>
                  <option value="P20EE">P20EE - SCR NOx Catalyst (Euro VI)</option>
                  <option value="P0217">P0217 - Engine Overheating</option>
                  <option value="C1095">C1095 - EBS Brake Valve</option>
                  <option value="U0100">U0100 - ECM Communication CAN</option>
                  <option value="P0524">P0524 - Low Oil Pressure</option>
                  <option value="P0101">P0101 - MAF Sensor</option>
                  <option value="C0040">C0040 - Wheel Speed Sensor</option>
                </select>
                <Input
                  value={ingestDtcCode}
                  onChange={(e) => setIngestDtcCode(e.target.value.toUpperCase())}
                  placeholder="Custom DTC Code"
                  className="h-9 font-mono font-bold text-xs"
                />
              </div>
            </div>

            {/* Target Corridor */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('الممر اللوجستي للرحلة', 'Couloir logistique', 'Corridor')}</label>
              <select
                value={ingestCorridor}
                onChange={(e) => setIngestCorridor(e.target.value as 'DOMESTIC' | 'MA-ES-FR' | 'MA-MR-SN')}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
              >
                <option value="DOMESTIC">{t('الخطوط الداخلية الوطنية (المغرب)', 'Lignes intérieures nationales', 'Domestic Intra-Morocco')}</option>
                <option value="MA-ES-FR">{t('الممر الأوروبي الدولي (المغرب - إسبانيا - فرنسا)', 'Couloir Européen (MA-ES-FR)', 'European Corridor (MA-ES-FR)')}</option>
                <option value="MA-MR-SN">{t('الممر الصحراوي الإفريقي (الكركرات - موريتانيا - السنغال)', 'Couloir Saharien (MA-MR-SN)', 'Sahara Corridor (MA-MR-SN)')}</option>
              </select>
            </div>

            {/* Live Freeze Frame Telemetry Inputs */}
            <div className="p-3 bg-muted/40 rounded-xl space-y-2 border border-border">
              <span className="font-bold text-[11px] text-muted-foreground block">
                {t('بيانات حساسات المحرك الفورية (CAN-Bus Freeze Frame):', 'Télémétrie en temps réel:', 'Live Engine Sensor Telemetry:')}
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block">حرارة التبريد (°C)</label>
                  <Input
                    value={ingestCoolantTemp}
                    onChange={(e) => setIngestCoolantTemp(e.target.value)}
                    type="number"
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">ضغط الزيت (kPa)</label>
                  <Input
                    value={ingestOilPressure}
                    onChange={(e) => setIngestOilPressure(e.target.value)}
                    type="number"
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">جهد البطارية (V)</label>
                  <Input
                    value={ingestBatteryVoltage}
                    onChange={(e) => setIngestBatteryVoltage(e.target.value)}
                    type="number"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Live Catalog Preview Card */}
            {previewProfile && (
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-700 dark:text-indigo-400">
                    {previewProfile.name_ar}
                  </span>
                  {getUrgencyBadge(previewProfile.urgency)}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {previewProfile.description_ar}
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span>قطع الغيار التقديرية:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(Number(previewProfile.estimated_parts_cost_mad), 'MAD')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsIngestModalOpen(false)}
              disabled={isSubmittingIngest}
              className="text-xs"
            >
              {t('إلغاء', 'Annuler', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleIngestDtc}
              disabled={isSubmittingIngest || !ingestTruckId}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmittingIngest ? t('جاري التسجيل...', 'Enregistrement...', 'Saving...') : t('تسجيل العطل وتوليد التوصيات', 'Enregistrer et prédire', 'Ingest & Predict')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Event Modal */}
      <Dialog open={!!selectedEventToResolve} onOpenChange={() => setSelectedEventToResolve(null)}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{t('إغلاق ومعالجة العطل التشخيصي', 'Résoudre l\'anomalie de diagnostic', 'Resolve Diagnostic Fault')}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedEventToResolve && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-sm">{selectedEventToResolve.dtc_code}</span>
                  <MatriculeBadge plate={selectedEventToResolve.truck?.plate_number || `#${selectedEventToResolve.truck_id}`} />
                </div>
                <p className="text-muted-foreground text-[11px]">{selectedEventToResolve.description}</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  {t('تقرير وملاحظات الإصلاح الميداني', 'Rapport d\'intervention', 'Field Repair Notes')}
                </label>
                <Input
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder={t('مثال: تم استبدال الحساس وفحص الخراطيم بنجاح', 'Ex: Capteur remplacé et durites vérifiées', 'e.g. Replaced sensor and verified hoses')}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="createSchedule"
                  checked={createScheduleOnResolve}
                  onChange={(e) => setCreateScheduleOnResolve(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="createSchedule" className="text-xs text-foreground cursor-pointer">
                  {t('إضافة قيد في سجل الصيانة المجدولة للتوثيق', 'Ajouter au registre de maintenance', 'Add entry to maintenance record')}
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEventToResolve(null)}
              disabled={isResolving}
              className="text-xs"
            >
              {t('إلغاء', 'Annuler', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleResolveEvent}
              disabled={isResolving || !resolutionNotes.trim()}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isResolving ? t('جاري الإغلاق...', 'Traitement...', 'Resolving...') : t('تأكيد الإصلاح والإغلاق', 'Confirmer la résolution', 'Confirm Resolution')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule from Recommendation Modal */}
      <Dialog open={!!selectedRecToSchedule} onOpenChange={() => setSelectedRecToSchedule(null)}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>{t('جدولة الصيانة التنبؤية في الورشة', 'Programmer en atelier', 'Schedule in Maintenance Workshop')}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedRecToSchedule && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5">
                <span className="font-semibold text-foreground block">
                  {selectedRecToSchedule.recommended_action}
                </span>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{t('الكلفة التقديرية:', 'Coût estimé:', 'Estimated Cost:')}</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(Number(selectedRecToSchedule.estimated_cost_mad), 'MAD')}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  {t('تاريخ الصيانة المبرمج', 'Date programmée', 'Scheduled Date')}
                </label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRecToSchedule(null)}
              disabled={isScheduling}
              className="text-xs"
            >
              {t('إلغاء', 'Annuler', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleScheduleRecommendation}
              disabled={isScheduling}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isScheduling ? t('جاري الجدولة...', 'Planification...', 'Scheduling...') : t('تأكيد إدراج الموعد', 'Confirmer la programmation', 'Confirm Schedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
