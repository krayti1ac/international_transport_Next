'use client';

/**
 * Trans Bodanon TMS — Multi-Temp & Multi-Compartment Reefer Matrix View
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / USP <1151> MKT
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  DoorClosed,
  DoorOpen,
  Download,
  FileCheck2,
  Layers,
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
  recordCompartmentTelemetryAction,
  resolveBulkheadAlertAction,
} from '../services/multi-temp.actions';
import {
  exportCompartmentPdfReportAction,
  exportBatchCompartmentCertificatesAction,
} from '../services/multi-temp-certificate.actions';
import { MultiTempCertificateModal } from './MultiTempCertificateModal';
import type {
  CompartmentCode,
  DoorType,
  EvaporatorMode,
  MultiTempTrailerMatrixSummary,
  ReeferCompartmentProfile,
  ReeferCompartmentTelemetryLog,
  ReeferCrossBulkheadAlert,
} from '../types/multi-temp.types';

interface MultiTempCompartmentMatrixViewProps {
  initialSummary: MultiTempTrailerMatrixSummary;
  initialAlerts: ReeferCrossBulkheadAlert[];
  trailersList: { id: number; plateNumber: string }[];
  currentTrailerId: number;
}

export function MultiTempCompartmentMatrixView({
  initialSummary,
  initialAlerts,
  trailersList,
  currentTrailerId,
}: MultiTempCompartmentMatrixViewProps) {
  const t = useTranslations('reefer.multiTemp');
  const tCert = useTranslations('reefer.multiTempCertificate');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [summary, setSummary] = useState<MultiTempTrailerMatrixSummary>(initialSummary);
  const [alerts, setAlerts] = useState<ReeferCrossBulkheadAlert[]>(initialAlerts);
  const [activeTab, setActiveTab] = useState<'matrix' | 'alerts' | 'topology'>('matrix');

  // Certificate Modal State
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [activeCert, setActiveCert] = useState<{
    compartmentId?: string;
    certificateNumber?: string;
    compartmentCode?: string;
    htmlContent?: string;
    verificationHash?: string;
    verificationUrl?: string;
  } | null>(null);

  // Modal Dialog & Simulation State
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string>(
    initialSummary.compartments[0]?.profile.id || ''
  );

  const [telemetryForm, setTelemetryForm] = useState({
    compartmentId: initialSummary.compartments[0]?.profile.id || '',
    trailerId: currentTrailerId,
    supplyAirTempC: -22.0,
    returnAirTempC: -19.5,
    cargoProbeTempC: -20.2,
    evaporatorMode: 'cooling' as EvaporatorMode,
    doorOpen: false,
    doorType: 'none' as DoorType,
  });

  // Handle Recording Telemetry
  const handleSubmitTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordCompartmentTelemetryAction({
        compartmentId: telemetryForm.compartmentId,
        trailerId: currentTrailerId,
        supplyAirTempC: Number(telemetryForm.supplyAirTempC),
        returnAirTempC: Number(telemetryForm.returnAirTempC),
        cargoProbeTempC: Number(telemetryForm.cargoProbeTempC),
        evaporatorMode: telemetryForm.evaporatorMode,
        doorOpen: telemetryForm.doorOpen,
        doorType: telemetryForm.doorType,
      });

      if (!res.success) {
        toast({
          title: t('title'),
          description: res.error || 'فشل تسجيل قراءة التليماتيكس',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t('title'),
        description: res.bulkheadAlertCreated ? t('critical') : 'تم تسجيل قراءة الحجرة بنجاح',
        variant: res.bulkheadAlertCreated ? 'destructive' : 'default',
      });

      setIsRecordDialogOpen(false);

      // Optimistically update summary
      setSummary((prev) => {
        const updatedCompartments = prev.compartments.map((c) => {
          if (c.profile.id === telemetryForm.compartmentId) {
            const newLog: ReeferCompartmentTelemetryLog = {
              id: res.logId || Math.random().toString(),
              companyId: 1,
              compartmentId: c.profile.id,
              compartmentCode: c.profile.compartmentCode,
              compartmentName: c.profile.compartmentName,
              trailerId: currentTrailerId,
              supplyAirTempC: Number(telemetryForm.supplyAirTempC),
              returnAirTempC: Number(telemetryForm.returnAirTempC),
              cargoProbeTempC: Number(telemetryForm.cargoProbeTempC),
              evaporatorMode: telemetryForm.evaporatorMode,
              doorOpen: telemetryForm.doorOpen,
              doorType: telemetryForm.doorType,
              isExcursion:
                Number(telemetryForm.returnAirTempC) < c.profile.minTempLimitC ||
                Number(telemetryForm.returnAirTempC) > c.profile.maxTempLimitC,
              recordedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            return { ...c, latestLog: newLog };
          }
          return c;
        });

        return {
          ...prev,
          compartments: updatedCompartments,
        };
      });
    });
  };

  // Handle Resolve Alert
  const handleResolveAlert = async (alertId: string) => {
    startTransition(async () => {
      const res = await resolveBulkheadAlertAction({ alertId });
      if (!res.success) {
        toast({
          title: t('title'),
          description: res.error || 'فشل إغلاق الإنذار',
          variant: 'destructive',
        });
        return;
      }

      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() } : a
        )
      );

      toast({
        title: t('title'),
        description: t('resolved'),
      });
    });
  };

  // Handle Open Certificate
  const handleOpenCertificate = async (compartmentId: string, compCode: string) => {
    startTransition(async () => {
      const res = await exportCompartmentPdfReportAction({
        compartmentId,
        trailerId: currentTrailerId,
        locale: 'ar',
      });
      if (res.success && res.htmlContent) {
        setActiveCert({
          compartmentId,
          certificateNumber: res.certificateNumber,
          compartmentCode: res.compartmentCode || compCode,
          htmlContent: res.htmlContent,
          verificationHash: res.verificationHash,
          verificationUrl: res.verificationUrl,
        });
        setIsCertModalOpen(true);
      } else {
        toast({
          title: tCert('title'),
          description: res.error || 'فشل توليد وثيقة الشهادة',
          variant: 'destructive',
        });
      }
    });
  };

  // Handle Batch Export
  const handleBatchExport = async () => {
    startTransition(async () => {
      const res = await exportBatchCompartmentCertificatesAction({
        trailerId: currentTrailerId,
        locale: 'ar',
      });
      if (res.success && res.certificates && res.certificates.length > 0) {
        toast({
          title: tCert('title'),
          description: tCert('batchSuccess'),
        });
        const first = res.certificates[0];
        if (first.htmlContent) {
          setActiveCert({
            certificateNumber: first.certificateNumber,
            compartmentCode: first.compartmentCode,
            htmlContent: first.htmlContent,
            verificationHash: first.verificationHash,
            verificationUrl: first.verificationUrl,
          });
          setIsCertModalOpen(true);
        }
      } else {
        toast({
          title: tCert('title'),
          description: res.error || 'فشل تصدير حزمة الشهادات',
          variant: 'destructive',
        });
      }
    });
  };

  // Preset Simulation Scenarios
  const handlePresetSimulation = (scenario: 'normal' | 'leak' | 'side_door' | 'defrost') => {
    if (scenario === 'normal') {
      setTelemetryForm({
        ...telemetryForm,
        supplyAirTempC: -22.5,
        returnAirTempC: -19.8,
        cargoProbeTempC: -20.0,
        evaporatorMode: 'cooling',
        doorOpen: false,
        doorType: 'none',
      });
    } else if (scenario === 'leak') {
      setTelemetryForm({
        ...telemetryForm,
        supplyAirTempC: -14.0,
        returnAirTempC: -13.2, // Rising rapidly in frozen compartment
        cargoProbeTempC: -15.5,
        evaporatorMode: 'cooling',
        doorOpen: false,
        doorType: 'none',
      });
    } else if (scenario === 'side_door') {
      setTelemetryForm({
        ...telemetryForm,
        supplyAirTempC: 3.5,
        returnAirTempC: 7.8,
        cargoProbeTempC: 5.2,
        evaporatorMode: 'cooling',
        doorOpen: true,
        doorType: 'side',
      });
    } else if (scenario === 'defrost') {
      setTelemetryForm({
        ...telemetryForm,
        supplyAirTempC: -1.0,
        returnAirTempC: -14.0,
        cargoProbeTempC: -19.0,
        evaporatorMode: 'defrost',
        doorOpen: false,
        doorType: 'none',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -end-10 -top-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchExport}
            disabled={isPending}
            className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {tCert('batchExport')}
          </Button>
          <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2 shadow-lg shadow-cyan-900/30">
                <PlusCircle className="w-4 h-4" />
                {t('recordTelemetry')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] bg-slate-900 text-white border-slate-800">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-cyan-400 text-xl">
                  <Layers className="w-5 h-5" />
                  {t('recordTelemetry')}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {t('subtitle')}
                </DialogDescription>
              </DialogHeader>

              {/* Simulation Quick Scenario Presets */}
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {t('simTelemetry')}:
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('normal')}
                    className="text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                  >
                    {t('simNormal')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('leak')}
                    className="text-xs border-rose-500/40 text-rose-300 hover:bg-rose-950/40"
                  >
                    {t('simBulkheadLeak')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('side_door')}
                    className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/40"
                  >
                    {t('simSideDoorOpen')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSimulation('defrost')}
                    className="text-xs border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40"
                  >
                    {t('simDefrost')}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSubmitTelemetry} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      الحجرة المستهدفة
                    </label>
                    <select
                      value={telemetryForm.compartmentId}
                      onChange={(e) =>
                        setTelemetryForm({ ...telemetryForm, compartmentId: e.target.value })
                      }
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
                    >
                      {summary.compartments.map((c) => (
                        <option key={c.profile.id} value={c.profile.id}>
                          {c.profile.compartmentCode} — {c.profile.compartmentName} ({c.profile.setpointTempC}°C)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('evaporatorMode')}
                    </label>
                    <select
                      value={telemetryForm.evaporatorMode}
                      onChange={(e) =>
                        setTelemetryForm({
                          ...telemetryForm,
                          evaporatorMode: e.target.value as EvaporatorMode,
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="cooling">تبريد (Cooling)</option>
                      <option value="heating">تدفئة (Heating)</option>
                      <option value="defrost">إذابة جليد (Defrost)</option>
                      <option value="null">إيقاف (Null)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('supplyAir')} (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={telemetryForm.supplyAirTempC}
                      onChange={(e) =>
                        setTelemetryForm({ ...telemetryForm, supplyAirTempC: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('returnAir')} (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={telemetryForm.returnAirTempC}
                      onChange={(e) =>
                        setTelemetryForm({ ...telemetryForm, returnAirTempC: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('cargoProbe')} (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={telemetryForm.cargoProbeTempC}
                      onChange={(e) =>
                        setTelemetryForm({ ...telemetryForm, cargoProbeTempC: Number(e.target.value) })
                      }
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">
                      {t('doorStatus')}
                    </label>
                    <div className="flex items-center gap-3 pt-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={telemetryForm.doorOpen}
                          onChange={(e) =>
                            setTelemetryForm({
                              ...telemetryForm,
                              doorOpen: e.target.checked,
                              doorType: e.target.checked ? 'side' : 'none',
                            })
                          }
                          className="rounded bg-slate-800 border-slate-700 text-cyan-500"
                        />
                        {t('doorOpen')}
                      </label>

                      {telemetryForm.doorOpen && (
                        <select
                          value={telemetryForm.doorType}
                          onChange={(e) =>
                            setTelemetryForm({
                              ...telemetryForm,
                              doorType: e.target.value as DoorType,
                            })
                          }
                          className="bg-slate-800 border border-slate-700 text-white rounded text-xs px-2 py-1"
                        >
                          <option value="side">{t('doorSide')}</option>
                          <option value="rear">{t('doorRear')}</option>
                        </select>
                      )}
                    </div>
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
                    {isPending ? 'جاري الحفظ والتدقيق...' : 'حفظ وتدقيق العزل'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 2. Bento KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Bulkhead Integrity */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('bulkheadIntegrity')}</p>
              <h3 className="text-2xl font-bold text-cyan-400 mt-1">
                {summary.bulkheadIntegrityScore}%
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">سلامة العزل الحركي</p>
            </div>
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Compartments */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('totalCompartments')}</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {summary.totalCompartments}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تكوين {summary.configurationType.toUpperCase()}
              </p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Active Bulkhead Alerts */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('activeAlerts')}</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">
                {summary.activeBulkheadAlertsCount}
              </h3>
              <p className="text-[11px] text-amber-400/80 mt-0.5">تسريب حراري بيني</p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Overall Status */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">{t('overallStatus')}</p>
              <h3 className="text-lg font-bold mt-1">
                {summary.overallStatus === 'optimal' ? (
                  <span className="text-emerald-400">{t('optimal')}</span>
                ) : summary.overallStatus === 'warning' ? (
                  <span className="text-amber-400">{t('warning')}</span>
                ) : (
                  <span className="text-rose-400">{t('critical')}</span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">تقييم توازن المقطورة</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
              <Activity className="w-6 h-6 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Trailer Topology Diagram (Structural Multi-Compartment Map) */}
      <Card className="border-slate-800 bg-slate-900/80 text-white shadow-xl overflow-hidden">
        <CardHeader className="bg-slate-950/60 border-b border-slate-800 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-cyan-400">
            <Truck className="w-5 h-5 text-cyan-400" />
            {t('topologyTitle')} — {summary.trailerPlate}
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            توزيع الحواجز العازلة المتحركة ومواقع الأبواب الجانبية والخلفية
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative bg-slate-950 rounded-2xl border-2 border-slate-700 p-3 overflow-hidden shadow-2xl">
            {/* Front Kingpin Nose indicator */}
            <div className="absolute top-0 bottom-0 start-0 w-3 bg-cyan-600/60 rounded-s-xl flex items-center justify-center">
              <span className="text-[9px] font-mono rotate-90 text-white uppercase tracking-widest">FRONT</span>
            </div>

            {/* Rear Doors indicator */}
            <div className="absolute top-0 bottom-0 end-0 w-3 bg-rose-600/60 rounded-e-xl flex items-center justify-center">
              <span className="text-[9px] font-mono rotate-90 text-white uppercase tracking-widest">REAR</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ps-3 pe-3">
              {summary.compartments.map((comp, idx) => {
                const latest = comp.latestLog;
                const temp = latest?.returnAirTempC ?? comp.profile.setpointTempC;
                const isFrozen = comp.profile.cargoCategory === 'deep_frozen' || temp < -10;

                return (
                  <div
                    key={comp.profile.id}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isFrozen
                        ? 'border-cyan-500/50 bg-gradient-to-b from-cyan-950/40 to-slate-900/80'
                        : 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/40 to-slate-900/80'
                    }`}
                  >
                    {/* Moveable Bulkhead Barrier Divider */}
                    {idx > 0 && (
                      <div className="hidden lg:block absolute -start-2 top-0 bottom-0 w-1 bg-amber-500/80 shadow-md shadow-amber-500/50 z-20">
                        <span className="absolute -top-3 -start-2 text-[9px] bg-amber-500 text-slate-950 font-bold px-1 rounded">
                          حاجز
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isFrozen
                              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/60'
                              : 'border-emerald-400 text-emerald-300 bg-emerald-950/60'
                          }
                        >
                          {comp.profile.compartmentCode}
                        </Badge>
                        <span className="text-xs font-bold text-white">
                          {comp.profile.compartmentName}
                        </span>
                      </div>

                      {latest?.doorOpen ? (
                        <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] flex items-center gap-1">
                          <DoorOpen className="w-3 h-3" />
                          {t('doorOpen')}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800 text-slate-400 text-[10px] flex items-center gap-1">
                          <DoorClosed className="w-3 h-3" />
                          {t('doorClosed')}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between mt-3">
                      <div>
                        <span className="text-[11px] text-slate-400 block">{t('returnAir')}</span>
                        <div
                          className={`text-2xl font-extrabold font-mono ${
                            isFrozen ? 'text-cyan-400' : 'text-emerald-400'
                          }`}
                        >
                          {temp}°C
                        </div>
                      </div>

                      <div className="text-end text-xs text-slate-400">
                        <span>{t('setpoint')}: </span>
                        <span className="font-mono text-white font-semibold">
                          {comp.profile.setpointTempC}°C
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>MKT: <span className="text-slate-200 font-mono">{comp.mktAudit?.mktTempC ?? temp}°C</span></span>
                      <span>المبخر: <span className="text-cyan-300 font-medium">{latest?.evaporatorMode ?? 'cooling'}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Tabs: Matrix Cards & Bulkhead Alerts */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="matrix" className="gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            {t('tabMatrix')}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
            {t('tabAlerts')}
            <Badge variant="secondary" className="ms-1 px-1.5 py-0 text-xs">
              {alerts.filter((a) => !a.isResolved).length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Compartment Cards */}
        <TabsContent value="matrix" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.compartments.map((comp) => {
              const latest = comp.latestLog;
              const isFrozen = comp.profile.cargoCategory === 'deep_frozen';

              return (
                <Card
                  key={comp.profile.id}
                  className="border-slate-800 bg-slate-900/70 text-white shadow-lg overflow-hidden"
                >
                  <CardHeader className="bg-slate-950/40 pb-3 border-b border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isFrozen
                              ? 'border-cyan-500 text-cyan-300 bg-cyan-950/40'
                              : 'border-emerald-500 text-emerald-300 bg-emerald-950/40'
                          }
                        >
                          {comp.profile.compartmentCode}
                        </Badge>
                        <h4 className="font-bold text-white text-base">
                          {comp.profile.compartmentName}
                        </h4>
                      </div>

                      <Badge
                        variant="secondary"
                        className={
                          comp.mktAudit?.status === 'breached'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : comp.mktAudit?.status === 'warning'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }
                      >
                        {comp.mktAudit?.status === 'compliant'
                          ? 'مطابق'
                          : comp.mktAudit?.status === 'warning'
                          ? 'تحذير'
                          : 'مخالف'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{t('supplyAir')}</span>
                        <span className="text-base font-bold font-mono text-cyan-300">
                          {latest?.supplyAirTempC ?? '--'}°C
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{t('returnAir')}</span>
                        <span className="text-base font-bold font-mono text-white">
                          {latest?.returnAirTempC ?? '--'}°C
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{t('cargoProbe')}</span>
                        <span className="text-base font-bold font-mono text-amber-300">
                          {latest?.cargoProbeTempC ?? '--'}°C
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('mktIndex')}:</span>
                        <span className="font-mono font-semibold text-cyan-400">
                          {comp.mktAudit?.mktTempC}°C
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('setpoint')}:</span>
                        <span className="font-mono text-slate-200">
                          {comp.profile.setpointTempC}°C ({comp.profile.minTempLimitC}°C إلى {comp.profile.maxTempLimitC}°C)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('evaporatorMode')}:</span>
                        <span className="font-medium text-slate-200">
                          {latest?.evaporatorMode ?? 'cooling'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">الوصول:</span>
                        <span className="text-slate-200">
                          {comp.profile.hasSideDoor ? 'باب جانبي + خلفي' : 'باب خلفي فقط'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {latest ? new Date(latest.recordedAt).toLocaleTimeString() : 'لا توجد قراءات'}
                      </span>
                      <span>موقع الحاجز: {comp.profile.bulkheadPositionPct}%</span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCertificate(comp.profile.id, comp.profile.compartmentCode)}
                      disabled={isPending}
                      className="w-full mt-3 border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 text-xs gap-1.5"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      {tCert('buttonExport')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: Bulkhead Alerts */}
        <TabsContent value="alerts">
          {alerts.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">{t('noAlerts')}</h3>
              <p className="text-sm max-w-md mx-auto">{t('noAlertsDesc')}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alt) => (
                <Card
                  key={alt.id}
                  className={`border transition-all ${
                    alt.isResolved
                      ? 'border-slate-800 bg-slate-900/40 opacity-70'
                      : alt.severity === 'critical'
                      ? 'border-rose-500/50 bg-rose-950/10 shadow-lg shadow-rose-950/20'
                      : alt.severity === 'high'
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
                            alt.severity === 'critical'
                              ? 'border-rose-500 text-rose-400 bg-rose-950/40'
                              : alt.severity === 'high'
                              ? 'border-amber-500 text-amber-400 bg-amber-950/40'
                              : 'border-cyan-500 text-cyan-400 bg-cyan-950/40'
                          }
                        >
                          {alt.severity.toUpperCase()}
                        </Badge>
                        <span className="font-bold text-white text-sm">
                          {alt.sourceCompartmentCode} ↔ {alt.adjacentCompartmentCode}
                        </span>
                      </div>

                      {alt.isResolved ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                          {t('resolved')}
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs">
                          {t('open')}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-slate-300 text-xs leading-relaxed">{alt.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400">{t('deltaT')}: </span>
                        <span className="font-mono font-bold text-cyan-400">{alt.deltaTC}°C</span>
                      </div>
                      <div>
                        <span className="text-slate-400">{t('leakageRate')}: </span>
                        <span className="font-mono font-bold text-rose-400">
                          +{alt.leakageRateCPerHr}°C/hr
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60 text-xs">
                      <span className="font-semibold text-cyan-400 block mb-0.5">
                        {t('action')}:
                      </span>
                      <span className="text-slate-300">{alt.recommendedAction}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(alt.createdAt).toLocaleString()}
                      </span>

                      {!alt.isResolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveAlert(alt.id)}
                          disabled={isPending}
                          className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40 text-xs h-7"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                          {t('resolveAlert')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Multi-Temp Compartment Certificate Modal */}
      <MultiTempCertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        compartmentId={activeCert?.compartmentId}
        trailerId={currentTrailerId}
        tripId={summary.compartments[0]?.profile.tripId ?? null}
        certificateNumber={activeCert?.certificateNumber}
        compartmentCode={activeCert?.compartmentCode}
        htmlContent={activeCert?.htmlContent}
        verificationHash={activeCert?.verificationHash}
        verificationUrl={activeCert?.verificationUrl}
      />
    </div>
  );
}

