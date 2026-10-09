'use client';

/**
 * Trans Bodanon TMS — Reefer Refrigerant Leak & TXV Predictive Radar View
 * Standards: EN 12830 / ATP Treaty (FRC) / ISO 14903 Refrigerant Tightness
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  Gauge,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Truck,
  Wrench,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  recordCircuitDiagnosticsAction,
  resolveLeakIncidentAction,
} from '../services/refrigerant-radar.actions';
import type {
  ReeferCircuitDiagnosticsLog,
  ReeferPredictiveLeakIncident,
  RefrigerantRadarSummary,
  RefrigerantType,
} from '../types/refrigerant-radar.types';

interface RefrigerantPressureRadarViewProps {
  initialSummary: RefrigerantRadarSummary;
  initialLogs: ReeferCircuitDiagnosticsLog[];
  initialIncidents: ReeferPredictiveLeakIncident[];
  trailersList: { id: number; plateNumber: string }[];
}

export function RefrigerantPressureRadarView({
  initialSummary,
  initialLogs,
  initialIncidents,
  trailersList,
}: RefrigerantPressureRadarViewProps) {
  const t = useTranslations('reefer.refrigerantRadar');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [summary, setSummary] = useState<RefrigerantRadarSummary>(initialSummary);
  const [logs, setLogs] = useState<ReeferCircuitDiagnosticsLog[]>(initialLogs);
  const [incidents, setIncidents] = useState<ReeferPredictiveLeakIncident[]>(initialIncidents);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncidentFilter, setSelectedIncidentFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [activeTab, setActiveTab] = useState<'incidents' | 'logs'>('incidents');

  // Selected Log for Live Pressure Gauge Matrix
  const [selectedLogId, setSelectedLogId] = useState<string>(
    logs.length > 0 ? logs[0].id : ''
  );
  const activeLog = logs.find((l) => l.id === selectedLogId) || logs[0];

  // Modal Dialog
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    trailerId: trailersList.length > 0 ? trailersList[0].id : 1,
    refrigerantType: 'R452A' as RefrigerantType,
    suctionPressureBar: 1.85,
    dischargePressureBar: 15.2,
    evaporatorTempC: -18.0,
    suctionLineTempC: -9.5,
    condenserTempC: 38.0,
    liquidLineTempC: 32.5,
    compressorRpm: 1850,
    compressorDutyCyclePct: 78,
    ambientTempC: 26,
    source: 'manifold_gauge' as const,
  });

  // Handle Record Submission
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordCircuitDiagnosticsAction({
        trailerId: Number(recordForm.trailerId),
        refrigerantType: recordForm.refrigerantType,
        suctionPressureBar: Number(recordForm.suctionPressureBar),
        dischargePressureBar: Number(recordForm.dischargePressureBar),
        evaporatorTempC: Number(recordForm.evaporatorTempC),
        suctionLineTempC: Number(recordForm.suctionLineTempC),
        condenserTempC: Number(recordForm.condenserTempC),
        liquidLineTempC: Number(recordForm.liquidLineTempC),
        compressorRpm: Number(recordForm.compressorRpm),
        compressorDutyCyclePct: Number(recordForm.compressorDutyCyclePct),
        ambientTempC: Number(recordForm.ambientTempC),
        source: recordForm.source,
      });

      if (!res.success) {
        toast({
          title: t('title'),
          description: res.error || 'فشل تسجيل القراءات',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t('title'),
        description: res.incidentCreated ? t('anomalyAlert') : t('recordSuccess'),
        variant: res.incidentCreated ? 'destructive' : 'default',
      });

      setIsRecordDialogOpen(false);

      // Create optimistic log item
      const trailerPlate =
        trailersList.find((tr) => tr.id === Number(recordForm.trailerId))?.plateNumber ||
        `REM-${recordForm.trailerId}`;

      const superheatCalc = Number(
        (Number(recordForm.suctionLineTempC) - Number(recordForm.evaporatorTempC)).toFixed(2)
      );
      const subcoolingCalc = Number(
        (Number(recordForm.condenserTempC) - Number(recordForm.liquidLineTempC)).toFixed(2)
      );

      const newLogItem: ReeferCircuitDiagnosticsLog = {
        id: res.logId || Math.random().toString(),
        companyId: 1,
        trailerId: Number(recordForm.trailerId),
        trailerPlate,
        refrigerantType: recordForm.refrigerantType,
        suctionPressureBar: Number(recordForm.suctionPressureBar),
        dischargePressureBar: Number(recordForm.dischargePressureBar),
        evaporatorTempC: Number(recordForm.evaporatorTempC),
        suctionLineTempC: Number(recordForm.suctionLineTempC),
        condenserTempC: Number(recordForm.condenserTempC),
        liquidLineTempC: Number(recordForm.liquidLineTempC),
        superheatC: superheatCalc,
        subcoolingC: subcoolingCalc,
        compressorRpm: Number(recordForm.compressorRpm),
        compressorDutyCyclePct: Number(recordForm.compressorDutyCyclePct),
        ambientTempC: Number(recordForm.ambientTempC),
        source: recordForm.source,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      setLogs((prev) => [newLogItem, ...prev]);
      setSelectedLogId(newLogItem.id);
    });
  };

  // Handle Resolve Incident
  const handleResolveIncident = async (incidentId: string) => {
    startTransition(async () => {
      const res = await resolveLeakIncidentAction({ incidentId });
      if (!res.success) {
        toast({
          title: t('title'),
          description: res.error || 'فشل إغلاق الإنذار',
          variant: 'destructive',
        });
        return;
      }

      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === incidentId
            ? {
                ...inc,
                isResolved: true,
                resolvedAt: new Date().toISOString(),
                resolvedBy: 'Admin',
              }
            : inc
        )
      );

      toast({
        title: t('title'),
        description: t('resolved'),
      });
    });
  };

  // Preset Simulation Scenarios
  const handlePresetSimulation = (scenario: 'normal' | 'micro_leak' | 'txv_starve' | 'txv_flood') => {
    if (scenario === 'normal') {
      setRecordForm({
        ...recordForm,
        suctionPressureBar: 1.85,
        dischargePressureBar: 15.2,
        evaporatorTempC: -18.0,
        suctionLineTempC: -10.0,
        condenserTempC: 38.0,
        liquidLineTempC: 32.0,
        compressorRpm: 1800,
        compressorDutyCyclePct: 65,
      });
    } else if (scenario === 'micro_leak') {
      setRecordForm({
        ...recordForm,
        suctionPressureBar: 0.95,
        dischargePressureBar: 11.8,
        evaporatorTempC: -15.0,
        suctionLineTempC: 8.5, // Superheat = 23.5°C
        condenserTempC: 32.0,
        liquidLineTempC: 30.5, // Subcooling = 1.5°C
        compressorRpm: 2200,
        compressorDutyCyclePct: 98,
      });
    } else if (scenario === 'txv_starve') {
      setRecordForm({
        ...recordForm,
        suctionPressureBar: 0.65,
        dischargePressureBar: 14.5,
        evaporatorTempC: -16.0,
        suctionLineTempC: 11.0, // Superheat = 27.0°C
        condenserTempC: 39.0,
        liquidLineTempC: 31.0, // Subcooling = 8.0°C
        compressorRpm: 1950,
        compressorDutyCyclePct: 85,
      });
    } else if (scenario === 'txv_flood') {
      setRecordForm({
        ...recordForm,
        suctionPressureBar: 4.8,
        dischargePressureBar: 16.0,
        evaporatorTempC: -15.0,
        suctionLineTempC: -14.0, // Superheat = 1.0°C (DANGER)
        condenserTempC: 40.0,
        liquidLineTempC: 34.0,
        compressorRpm: 1750,
        compressorDutyCyclePct: 70,
      });
    }
  };

  // Filtered incidents
  const filteredIncidents = incidents.filter((inc) => {
    if (selectedIncidentFilter === 'unresolved' && inc.isResolved) return false;
    if (selectedIncidentFilter === 'resolved' && !inc.isResolved) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchPlate = inc.trailerPlate?.toLowerCase().includes(q);
      const matchDesc = inc.description.toLowerCase().includes(q);
      const matchType = inc.incidentType.toLowerCase().includes(q);
      return matchPlate || matchDesc || matchType;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -end-10 -top-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Gauge className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2 shadow-lg shadow-cyan-900/30">
                <PlusCircle className="w-4 h-4" />
                {t('recordDiagnostics')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px] bg-slate-900 text-white border-slate-800">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-cyan-400 text-xl">
                  <Gauge className="w-5 h-5" />
                  {t('recordDiagnostics')}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {t('subtitle')}
                </DialogDescription>
              </DialogHeader>

              {/* Simulation Quick Scenario Presets */}
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {t('simDiagnostics')}:
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('normal')}
                    className="text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                  >
                    {t('statusNormal')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('micro_leak')}
                    className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/40"
                  >
                    {t('statusMicroLeak')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('txv_starve')}
                    className="text-xs border-orange-500/40 text-orange-300 hover:bg-orange-950/40"
                  >
                    {t('statusTxvStarvation')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('txv_flood')}
                    className="text-xs border-rose-500/40 text-rose-300 hover:bg-rose-950/40"
                  >
                    {t('statusTxvFlooding')}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSubmitRecord} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('trailer')}
                    </label>
                    <select
                      value={recordForm.trailerId}
                      onChange={(e) => setRecordForm({ ...recordForm, trailerId: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
                    >
                      {trailersList.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.plateNumber}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('gasType')}
                    </label>
                    <select
                      value={recordForm.refrigerantType}
                      onChange={(e) =>
                        setRecordForm({
                          ...recordForm,
                          refrigerantType: e.target.value as RefrigerantType,
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="R452A">R452A (Opteon XL55 - ATP Class C)</option>
                      <option value="R404A">R404A (Standard Cargo)</option>
                      <option value="R134a">R134a (Chilled Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('suctionPressure')} (bar)
                    </label>
                    <Input
                      type="number"
                      step="0.05"
                      value={recordForm.suctionPressureBar}
                      onChange={(e) =>
                        setRecordForm({ ...recordForm, suctionPressureBar: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('dischargePressure')} (bar)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={recordForm.dischargePressureBar}
                      onChange={(e) =>
                        setRecordForm({ ...recordForm, dischargePressureBar: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      Evaporator Temp (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={recordForm.evaporatorTempC}
                      onChange={(e) =>
                        setRecordForm({ ...recordForm, evaporatorTempC: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      Suction Line Temp (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={recordForm.suctionLineTempC}
                      onChange={(e) =>
                        setRecordForm({ ...recordForm, suctionLineTempC: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      Condenser Temp (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={recordForm.condenserTempC}
                      onChange={(e) =>
                        setRecordForm({ ...recordForm, condenserTempC: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      Liquid Line Temp (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={recordForm.liquidLineTempC}
                      onChange={(e) =>
                        setRecordForm({ ...recordForm, liquidLineTempC: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsRecordDialogOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    {isPending ? 'جاري التحليل...' : 'تحليل وحفظ السجل'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 2. Bento KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Health Rate */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('healthRate')}</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {summary.fleetThermodynamicHealthRate}%
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {summary.healthyCircuitsCount} / {summary.totalMonitoredReefers} سليم
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Activity className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Average Charge */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('avgCharge')}</p>
              <h3 className="text-2xl font-bold text-cyan-400 mt-1">
                {summary.averageFleetRefrigerantChargePct}%
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">معدل شحن الأسطول</p>
            </div>
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Snowflake className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Micro-Leak Incidents */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('leakIncidents')}</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">
                {summary.activeLeakIncidentsCount}
              </h3>
              <p className="text-[11px] text-amber-400/80 mt-0.5">تسريب بطيء رصد تنبؤياً</p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: TXV Anomalies */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('txvAnomalies')}</p>
              <h3 className="text-2xl font-bold text-orange-400 mt-1">
                {summary.txvAnomaliesCount}
              </h3>
              <p className="text-[11px] text-orange-400/80 mt-0.5">خلل انغلاق/فيضان TXV</p>
            </div>
            <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20">
              <Wrench className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Critical Risk Reefers */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('criticalRisk')}</p>
              <h3 className="text-2xl font-bold text-rose-400 mt-1">
                {summary.criticalRiskTrailersCount}
              </h3>
              <p className="text-[11px] text-rose-400/80 mt-0.5">خطر توقف شحنات</p>
            </div>
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Live Thermodynamic Manifold Pressure Gauge Matrix */}
      {activeLog && (
        <Card className="border-slate-800 bg-slate-900/80 text-white shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-950/60 border-b border-slate-800 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-cyan-400">
                  <Compass className="w-5 h-5 text-cyan-400" />
                  {t('gaugeMatrix')} — {activeLog.trailerPlate}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  غاز {activeLog.refrigerantType} | آخر قراءة: {new Date(activeLog.recordedAt).toLocaleString()}
                </CardDescription>
              </div>

              {logs.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{t('trailer')}:</span>
                  <select
                    value={selectedLogId}
                    onChange={(e) => setSelectedLogId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-1.5 text-xs"
                  >
                    {logs.map((lg) => (
                      <option key={lg.id} value={lg.id}>
                        {lg.trailerPlate} ({lg.refrigerantType} - {lg.source})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Gauge 1: Suction Pressure (Low Side) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-cyan-300 font-semibold flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    {t('suctionPressure')} (BP)
                  </span>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 text-xs">
                    Low Side
                  </Badge>
                </div>
                <div className="text-3xl font-extrabold text-cyan-400">
                  {activeLog.suctionPressureBar} <span className="text-sm font-normal text-slate-400">bar</span>
                </div>
                <div className="mt-3 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>حرارة المبخر المشبعة:</span>
                    <span className="font-mono text-slate-200">{activeLog.evaporatorTempC}°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span>حرارة خط السحب:</span>
                    <span className="font-mono text-slate-200">{activeLog.suctionLineTempC}°C</span>
                  </div>
                </div>
              </div>

              {/* Gauge 2: Discharge Pressure (High Side) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-rose-400" />
                    {t('dischargePressure')} (HP)
                  </span>
                  <Badge variant="outline" className="border-rose-500/30 text-rose-300 text-xs">
                    High Side
                  </Badge>
                </div>
                <div className="text-3xl font-extrabold text-rose-400">
                  {activeLog.dischargePressureBar} <span className="text-sm font-normal text-slate-400">bar</span>
                </div>
                <div className="mt-3 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>حرارة التكثيف المشبعة:</span>
                    <span className="font-mono text-slate-200">{activeLog.condenserTempC}°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span>حرارة خط السائل:</span>
                    <span className="font-mono text-slate-200">{activeLog.liquidLineTempC}°C</span>
                  </div>
                </div>
              </div>

              {/* Gauge 3: Superheat (°C) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-amber-400" />
                    {t('superheat')}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      activeLog.superheatC < 2.0
                        ? 'border-rose-500 text-rose-400 bg-rose-950/30'
                        : activeLog.superheatC > 18.0
                        ? 'border-amber-500 text-amber-400 bg-amber-950/30'
                        : 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                    }`}
                  >
                    {activeLog.superheatC < 2.0 ? 'فيضان TXV' : activeLog.superheatC > 18.0 ? 'تسريب / نقص' : 'مثالي (5-12°C)'}
                  </Badge>
                </div>
                <div className="text-3xl font-extrabold text-amber-400">
                  {activeLog.superheatC} <span className="text-sm font-normal text-slate-400">°C</span>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  الفرق بين حرارة السحب وتشبع المبخر. مؤشر فوري لسلامة صمام التمدد وشحنة الغاز.
                </p>
              </div>

              {/* Gauge 4: Subcooling (°C) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-indigo-400" />
                    {t('subcooling')}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      activeLog.subcoolingC < 3.0
                        ? 'border-amber-500 text-amber-400 bg-amber-950/30'
                        : 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                    }`}
                  >
                    {activeLog.subcoolingC < 3.0 ? 'فقد شحنة سائل' : 'مثالي (4-10°C)'}
                  </Badge>
                </div>
                <div className="text-3xl font-extrabold text-indigo-400">
                  {activeLog.subcoolingC} <span className="text-sm font-normal text-slate-400">°C</span>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  الفرق بين حرارة التكثيف وخط السائل. يؤكد اكتمال كثافة السائل قبل دخوله الصمام التمددي.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Tabs: Incidents & Logs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="incidents" className="gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              {t('tabIncidents')}
              <Badge variant="secondary" className="ms-1 px-1.5 py-0 text-xs">
                {incidents.filter((i) => !i.isResolved).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              {t('tabLogs')}
              <Badge variant="secondary" className="ms-1 px-1.5 py-0 text-xs">
                {logs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="بحث برقم المقطورة أو العطل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 bg-slate-900 border-slate-800 text-white text-xs w-64"
              />
            </div>

            {activeTab === 'incidents' && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-xs">
                <Button
                  size="sm"
                  variant={selectedIncidentFilter === 'unresolved' ? 'secondary' : 'ghost'}
                  onClick={() => setSelectedIncidentFilter('unresolved')}
                  className="h-7 text-xs"
                >
                  {t('open')}
                </Button>
                <Button
                  size="sm"
                  variant={selectedIncidentFilter === 'resolved' ? 'secondary' : 'ghost'}
                  onClick={() => setSelectedIncidentFilter('resolved')}
                  className="h-7 text-xs"
                >
                  {t('resolved')}
                </Button>
                <Button
                  size="sm"
                  variant={selectedIncidentFilter === 'all' ? 'secondary' : 'ghost'}
                  onClick={() => setSelectedIncidentFilter('all')}
                  className="h-7 text-xs"
                >
                  الكل
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content 1: Incidents */}
        <TabsContent value="incidents">
          {filteredIncidents.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">{t('noIncidents')}</h3>
              <p className="text-sm max-w-md mx-auto">{t('noIncidentsDesc')}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIncidents.map((inc) => (
                <Card
                  key={inc.id}
                  className={`border transition-all ${
                    inc.isResolved
                      ? 'border-slate-800 bg-slate-900/40 opacity-70'
                      : inc.severity === 'critical'
                      ? 'border-rose-500/50 bg-rose-950/10 shadow-lg shadow-rose-950/20'
                      : inc.severity === 'high'
                      ? 'border-amber-500/50 bg-amber-950/10 shadow-lg shadow-amber-950/20'
                      : 'border-slate-800 bg-slate-900/70'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            inc.severity === 'critical'
                              ? 'border-rose-500 text-rose-400 bg-rose-950/40'
                              : inc.severity === 'high'
                              ? 'border-amber-500 text-amber-400 bg-amber-950/40'
                              : 'border-cyan-500 text-cyan-400 bg-cyan-950/40'
                          }
                        >
                          {inc.severity.toUpperCase()}
                        </Badge>
                        <h4 className="font-bold text-white text-base flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-slate-400" />
                          {inc.trailerPlate}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-slate-800 text-slate-300 font-mono text-xs"
                        >
                          خطر: {inc.riskScore}/100
                        </Badge>
                        {inc.isResolved ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                            {t('resolved')}
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs">
                            {t('open')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-slate-300 text-xs leading-relaxed">{inc.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400">النوع: </span>
                        <span className="font-semibold text-cyan-300">
                          {inc.incidentType === 'micro_leakage'
                            ? t('statusMicroLeak')
                            : inc.incidentType === 'txv_starvation_closed'
                            ? t('statusTxvStarvation')
                            : inc.incidentType === 'txv_flooding_open'
                            ? t('statusTxvFlooding')
                            : t('statusCompressorInefficient')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">الفقد المقدر: </span>
                        <span className="font-semibold text-rose-400">
                          {inc.estimatedRefrigerantLossPct}%
                        </span>
                      </div>
                      {inc.superheatC !== null && (
                        <div>
                          <span className="text-slate-400">فرط التسخين: </span>
                          <span className="font-mono text-amber-300">{inc.superheatC}°C</span>
                        </div>
                      )}
                      {inc.subcoolingC !== null && (
                        <div>
                          <span className="text-slate-400">فرط التبريد: </span>
                          <span className="font-mono text-indigo-300">{inc.subcoolingC}°C</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60 text-xs">
                      <span className="font-semibold text-cyan-400 block mb-0.5">
                        {t('action')}:
                      </span>
                      <span className="text-slate-300">{inc.recommendedAction}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(inc.createdAt).toLocaleString()}
                      </span>

                      {!inc.isResolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveIncident(inc.id)}
                          disabled={isPending}
                          className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40 text-xs h-7"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                          {t('resolveIncident')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab Content 2: Pressure Logs */}
        <TabsContent value="logs">
          <Card className="border-slate-800 bg-slate-900/60 text-white overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 text-start">{t('trailer')}</th>
                    <th className="py-3 px-4 text-start">{t('gasType')}</th>
                    <th className="py-3 px-4 text-start">{t('suctionPressure')} (bar)</th>
                    <th className="py-3 px-4 text-start">{t('dischargePressure')} (bar)</th>
                    <th className="py-3 px-4 text-start">{t('superheat')}</th>
                    <th className="py-3 px-4 text-start">{t('subcooling')}</th>
                    <th className="py-3 px-4 text-start">{t('source')}</th>
                    <th className="py-3 px-4 text-start">{t('date')}</th>
                    <th className="py-3 px-4 text-end">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-800/40 cursor-pointer ${
                        selectedLogId === row.id ? 'bg-cyan-950/20 border-s-2 border-s-cyan-500' : ''
                      }`}
                      onClick={() => setSelectedLogId(row.id)}
                    >
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        {row.trailerPlate}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                          {row.refrigerantType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {row.suctionPressureBar}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-400">
                        {row.dischargePressureBar}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-400">
                        {row.superheatC}°C
                      </td>
                      <td className="py-3 px-4 font-mono text-indigo-400">
                        {row.subcoolingC}°C
                      </td>
                      <td className="py-3 px-4 text-slate-400">{row.source}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(row.recordedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogId(row.id);
                          }}
                          className="h-6 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
                        >
                          عرض المانيفولد
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

