'use client';

/**
 * Trans Bodanon TMS — Reefer Sensor Calibration & ATP Recertification Radar View
 * Interactive Dashboard for Fleet Managers & Compliance Officers
 * Standards: EN 12830 / ATP Treaty (FRC / FRA / FNA)
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldCheck,
  ShieldAlert,
  Snowflake,
  Thermometer,
  Activity,
  AlertTriangle,
  Clock,
  PlusCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  Truck,
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
  recordAtpCertificationAction,
  recordSensorCalibrationAction,
  checkTrailerPreTripComplianceAction,
} from '../services/reefer-calibration.actions';
import type {
  AtpClassType,
  PreTripReeferComplianceCheck,
  ReeferAtpCertification,
  ReeferCalibrationRadarSummary,
  ReeferSensorCalibrationLog,
  ReeferSensorType,
} from '../types/reefer-calibration.types';

interface ReeferCalibrationRadarViewProps {
  initialSummary: ReeferCalibrationRadarSummary;
  initialAtpCerts: ReeferAtpCertification[];
  initialCalibrationLogs: ReeferSensorCalibrationLog[];
  trailersList: { id: number; plateNumber: string }[];
}

export function ReeferCalibrationRadarView({
  initialSummary,
  initialAtpCerts,
  initialCalibrationLogs,
  trailersList,
}: ReeferCalibrationRadarViewProps) {
  const t = useTranslations('reefer.calibration');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [summary] = useState<ReeferCalibrationRadarSummary>(initialSummary);
  const [atpCerts, setAtpCerts] = useState<ReeferAtpCertification[]>(initialAtpCerts);
  const [calibLogs, setCalibLogs] = useState<ReeferSensorCalibrationLog[]>(initialCalibrationLogs);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'atp' | 'sensors'>('atp');

  // Pre-Trip Gatekeeper state
  const [selectedTrailerId, setSelectedTrailerId] = useState<string>(
    trailersList.length > 0 ? String(trailersList[0].id) : ''
  );
  const [gatekeeperResult, setGatekeeperResult] = useState<PreTripReeferComplianceCheck | null>(null);
  const [isCheckingGate, setIsCheckingGate] = useState(false);

  // Modal Dialogs
  const [isAtpDialogOpen, setIsAtpDialogOpen] = useState(false);
  const [isCalibDialogOpen, setIsCalibDialogOpen] = useState(false);

  // New ATP Form State
  const [atpForm, setAtpForm] = useState({
    trailerId: trailersList.length > 0 ? trailersList[0].id : 1,
    certificateNumber: '',
    atpType: 'FRC' as AtpClassType,
    issueDate: new Date().toISOString().substring(0, 10),
    expiryDate: new Date(Date.now() + 3 * 365 * 24 * 3600 * 1000).toISOString().substring(0, 10),
    kValue: 0.38,
    testingStation: 'Cematrans / CEMAFROID',
    renewalCycleYears: 3,
  });

  // New Calibration Form State
  const [calibForm, setCalibForm] = useState({
    trailerId: trailersList.length > 0 ? trailersList[0].id : 1,
    sensorType: 'return_air_probe' as ReeferSensorType,
    calibratedAt: new Date().toISOString().substring(0, 10),
    nextDueDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().substring(0, 10),
    referenceTemp: 0.0,
    measuredTemp: 0.1,
    calibratedBy: 'Laboratoire National d\'Essais (LNE)',
    certificateReference: '',
    notes: '',
  });

  // Handle Pre-Trip Gatekeeper Check
  const handleRunGatekeeperCheck = async (trailerId: string) => {
    if (!trailerId) return;
    setIsCheckingGate(true);
    try {
      const res = await checkTrailerPreTripComplianceAction(trailerId);
      if (res.success && res.gatekeeper) {
        setGatekeeperResult(res.gatekeeper);
      } else {
        toast({ title: 'فشل فحص المقطورة', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsCheckingGate(false);
    }
  };

  // Submit new ATP Certification
  const handleSubmitAtp = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordAtpCertificationAction(atpForm);
      if (res.success) {
        toast({ title: 'تم تسجيل شهادة ATP بنجاح 📋' });
        setIsAtpDialogOpen(false);
        const trailer = trailersList.find((t) => t.id === Number(atpForm.trailerId));
        setAtpCerts((prev) => [
          {
            id: res.id || String(Date.now()),
            companyId: 1,
            trailerId: Number(atpForm.trailerId),
            trailerPlate: trailer?.plateNumber || `REM-${atpForm.trailerId}`,
            certificateNumber: atpForm.certificateNumber,
            atpType: atpForm.atpType,
            issueDate: atpForm.issueDate,
            expiryDate: atpForm.expiryDate,
            kValue: atpForm.kValue,
            testingStation: atpForm.testingStation,
            status: 'valid',
            warningLevel: 'safe',
            daysRemaining: 1095,
            renewalCycleYears: atpForm.renewalCycleYears,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        toast({ title: 'فشل حفظ شهادة ATP', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Submit new Sensor Calibration
  const handleSubmitCalib = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordSensorCalibrationAction(calibForm);
      if (res.success) {
        toast({ title: 'تم توثيق معايرة الحساس بنجاح 🌡️' });
        setIsCalibDialogOpen(false);
        const trailer = trailersList.find((t) => t.id === Number(calibForm.trailerId));
        const drift = Number((calibForm.measuredTemp - calibForm.referenceTemp).toFixed(2));
        setCalibLogs((prev) => [
          {
            id: res.id || String(Date.now()),
            companyId: 1,
            trailerId: Number(calibForm.trailerId),
            trailerPlate: trailer?.plateNumber || `REM-${calibForm.trailerId}`,
            sensorType: calibForm.sensorType,
            calibratedAt: calibForm.calibratedAt,
            nextDueDate: calibForm.nextDueDate,
            referenceTemp: calibForm.referenceTemp,
            measuredTemp: calibForm.measuredTemp,
            driftDelta: drift,
            isPassed: Math.abs(drift) <= 0.5,
            warningLevel: 'safe',
            daysRemaining: 365,
            calibratedBy: calibForm.calibratedBy,
            certificateReference: calibForm.certificateReference,
            notes: calibForm.notes,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        toast({ title: 'فشل حفظ سجل المعايرة', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Filter lists by query
  const filteredAtp = atpCerts.filter(
    (c) =>
      c.certificateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.trailerPlate && c.trailerPlate.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.atpType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCalib = calibLogs.filter(
    (l) =>
      l.sensorType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.trailerPlate && l.trailerPlate.toLowerCase().includes(searchQuery.toLowerCase())) ||
      l.calibratedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Snowflake className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">
                {t('radarTitle')}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('radarSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
              Accord ATP • FRC Class C (-20°C)
            </Badge>
            <Badge variant="outline" className="text-[11px] border-cyan-500/30 text-cyan-400 bg-cyan-500/5">
              Norme EN 12830 (±0.5°C)
            </Badge>
            <Badge variant="outline" className="text-[11px] border-indigo-500/30 text-indigo-400 bg-indigo-500/5">
              EU GDP 2013/C 343/01
            </Badge>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* New ATP Dialog */}
          <Dialog open={isAtpDialogOpen} onOpenChange={setIsAtpDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md">
                <PlusCircle className="w-4 h-4" />
                <span>{t('recordNewAtp')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  تسجيل شهادة اعتماد ميثاق ATP
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  إدخال بيانات شهادة الفحص الحراري الصادرة من محطة CEMAFROID / Cematrans
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitAtp} className="space-y-3.5 text-xs mt-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">المقطورة المعنية</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                    value={atpForm.trailerId}
                    onChange={(e) => setAtpForm({ ...atpForm, trailerId: Number(e.target.value) })}
                  >
                    {trailersList.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.plateNumber} (ID: #{tr.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">رقم الشهادة</label>
                    <Input
                      required
                      placeholder="FRC-2026-9921"
                      value={atpForm.certificateNumber}
                      onChange={(e) => setAtpForm({ ...atpForm, certificateNumber: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">التصنيف</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                      value={atpForm.atpType}
                      onChange={(e) => setAtpForm({ ...atpForm, atpType: e.target.value as AtpClassType })}
                    >
                      <option value="FRC">FRC (عزل مقوى -20°C)</option>
                      <option value="FRA">FRA (عزل مقوى 0°C)</option>
                      <option value="FNA">FNA (عزل قياسي 0°C)</option>
                      <option value="IR">IR (عزل حراري بدون وحدة)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">تاريخ الإصدار</label>
                    <Input
                      type="date"
                      required
                      value={atpForm.issueDate}
                      onChange={(e) => setAtpForm({ ...atpForm, issueDate: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">تاريخ الانتهاء</label>
                    <Input
                      type="date"
                      required
                      value={atpForm.expiryDate}
                      onChange={(e) => setAtpForm({ ...atpForm, expiryDate: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">معامل العزل K-Value</label>
                    <Input
                      type="number"
                      step="0.001"
                      required
                      value={atpForm.kValue}
                      onChange={(e) => setAtpForm({ ...atpForm, kValue: Number(e.target.value) })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">محطة الفحص</label>
                    <Input
                      required
                      value={atpForm.testingStation}
                      onChange={(e) => setAtpForm({ ...atpForm, testingStation: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold mt-2"
                >
                  {isPending ? 'جاري الحفظ...' : 'حفظ الشهادة وتحديث الرادار'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* New Sensor Calibration Dialog */}
          <Dialog open={isCalibDialogOpen} onOpenChange={setIsCalibDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 font-bold text-xs gap-1.5"
              >
                <Thermometer className="w-4 h-4 text-cyan-400" />
                <span>{t('recordNewCalib')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
                  <Thermometer className="w-5 h-5 text-cyan-400" />
                  تسجيل فحص معايرة حساس (EN 12830)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  فحص دقة المجسات ومسجلات درجات الحرارة السنوية وتحديد نسبة الانحراف
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitCalib} className="space-y-3.5 text-xs mt-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">المقطورة المعنية</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                    value={calibForm.trailerId}
                    onChange={(e) => setCalibForm({ ...calibForm, trailerId: Number(e.target.value) })}
                  >
                    {trailersList.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.plateNumber} (ID: #{tr.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">نوع الحساس / المجس</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                    value={calibForm.sensorType}
                    onChange={(e) => setCalibForm({ ...calibForm, sensorType: e.target.value as ReeferSensorType })}
                  >
                    <option value="return_air_probe">مجس هواء الإرجاع (Return Air Probe)</option>
                    <option value="supply_air_probe">مجس هواء الضخ (Supply Air Probe)</option>
                    <option value="cargo_probe_1">مجس قلب الشحنة 1 (Cargo Probe #1)</option>
                    <option value="cargo_probe_2">مجس قلب الشحنة 2 (Cargo Probe #2)</option>
                    <option value="data_logger">مسجل البيانات المدمج (DataCOLD Logger)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">الحرارة المرجعية (°C)</label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={calibForm.referenceTemp}
                      onChange={(e) => setCalibForm({ ...calibForm, referenceTemp: Number(e.target.value) })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">الحرارة المقاسة (°C)</label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      value={calibForm.measuredTemp}
                      onChange={(e) => setCalibForm({ ...calibForm, measuredTemp: Number(e.target.value) })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">فارق الانحراف المتوقع:</span>
                  <span
                    className={`font-mono font-bold ${
                      Math.abs(calibForm.measuredTemp - calibForm.referenceTemp) <= 0.5
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {(calibForm.measuredTemp - calibForm.referenceTemp).toFixed(2)}°C{' '}
                    {Math.abs(calibForm.measuredTemp - calibForm.referenceTemp) <= 0.5
                      ? '(مطابق ≤ ±0.5°C)'
                      : '(مرفوض > ±0.5°C)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">تاريخ المعايرة</label>
                    <Input
                      type="date"
                      required
                      value={calibForm.calibratedAt}
                      onChange={(e) => setCalibForm({ ...calibForm, calibratedAt: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">الاستحقاق القادم</label>
                    <Input
                      type="date"
                      required
                      value={calibForm.nextDueDate}
                      onChange={(e) => setCalibForm({ ...calibForm, nextDueDate: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">الجهة الفاحصة / التقني</label>
                  <Input
                    required
                    value={calibForm.calibratedBy}
                    onChange={(e) => setCalibForm({ ...calibForm, calibratedBy: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold mt-2"
                >
                  {isPending ? 'جاري التوثيق...' : 'حفظ تقرير المعايرة'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bento Grid: 4 Core Radar Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Valid ATP Certs */}
        <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">{t('validCerts')}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-emerald-400">{summary.validAtpCount}</span>
              <span className="text-xs text-slate-400">/ {summary.totalReeferTrailers} مقطورة</span>
            </div>
            <div className="text-[11px] text-emerald-500/80 pt-1 border-t border-slate-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>مؤهلة للترانزيت الأوروبي</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Expiring Soon */}
        <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">{t('expiringSoon')}</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-amber-400">
                {summary.expiring30dCount + summary.expiring60dCount}
              </span>
              <span className="text-xs text-slate-400">شهادة</span>
            </div>
            <div className="text-[11px] text-amber-500/80 pt-1 border-t border-slate-800 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>خلال 30 - 60 يوماً</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Grounded / Prohibited Trailers */}
        <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">
                {t('grounded')}
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-rose-500">{summary.groundedTrailersCount}</span>
              <span className="text-xs text-slate-400">مقطورة</span>
            </div>
            <div className="text-[11px] text-rose-500/80 pt-1 border-t border-slate-800 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              <span>شهادات منتهية أو معايرة راسبة</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Fleet Compliance Health Rate */}
        <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">
                {t('complianceRate')}
              </span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-cyan-400">
                {summary.fleetComplianceHealthRate}%
              </span>
            </div>
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
              <span>معايرات نشطة:</span>
              <span className="font-mono text-slate-200">{summary.validSensorCalibrationsCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pre-Trip Gatekeeper: Interactive Trailer Clearance Checker */}
      <Card className="bg-slate-900/95 border-2 border-indigo-500/30 text-slate-100 shadow-md">
        <CardHeader className="pb-3 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">
                  {t('preTripGatekeeper')}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  فحص إلزامي لأهلية المقطورة المبردة وتوافق حساساتها وميثاق ATP قبل إسناد أمر الشحن الدولي
                </CardDescription>
              </div>
            </div>

            {/* Trailer Selection Dropdown */}
            <div className="flex items-center gap-2">
              <select
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                value={selectedTrailerId}
                onChange={(e) => {
                  setSelectedTrailerId(e.target.value);
                  handleRunGatekeeperCheck(e.target.value);
                }}
              >
                {trailersList.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.plateNumber} (ID: #{tr.id})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={isCheckingGate}
                onClick={() => handleRunGatekeeperCheck(selectedTrailerId)}
                className="bg-indigo-950/40 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/60 text-xs h-8"
              >
                <RefreshCw className={`w-3.5 h-3.5 me-1.5 ${isCheckingGate ? 'animate-spin' : ''}`} />
                {t('checkClearance')}
              </Button>
            </div>
          </div>
        </CardHeader>

        {gatekeeperResult && (
          <CardContent className="p-5">
            <div
              className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                gatekeeperResult.isClearedForDispatch
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-rose-950/20 border-rose-500/40'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    gatekeeperResult.isClearedForDispatch
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {gatekeeperResult.isClearedForDispatch ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : (
                    <XCircle className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      المقطورة: {gatekeeperResult.trailerPlate}
                    </span>
                    <Badge
                      className={`text-[11px] font-bold ${
                        gatekeeperResult.isClearedForDispatch
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {gatekeeperResult.isClearedForDispatch
                        ? t('cleared')
                        : t('blocked')}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
                    <span>شهادة ATP: <strong>{gatekeeperResult.atpCertificateNumber || 'غير متوفرة'}</strong></span>
                    {gatekeeperResult.atpDaysRemaining !== undefined && (
                      <span className="font-mono">
                        (متبقي {gatekeeperResult.atpDaysRemaining} يوماً)
                      </span>
                    )}
                    <span>حساسات مسجلة: <strong>{gatekeeperResult.activeSensorsCount}</strong></span>
                  </div>
                </div>
              </div>

              {/* Status details & block reasons */}
              <div className="text-xs space-y-1 md:text-end">
                {gatekeeperResult.blockingReasons.length > 0 ? (
                  gatekeeperResult.blockingReasons.map((reason, idx) => (
                    <div key={idx} className="text-rose-400 font-semibold flex items-center md:justify-end gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-emerald-400 font-medium flex items-center md:justify-end gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>كافة شهادات ATP ومعايرات الحساسات سارية ومطابقة لمعايير EN 12830</span>
                  </div>
                )}
                {gatekeeperResult.warnings.map((warn, idx) => (
                  <div key={idx} className="text-amber-400 text-[11px] flex items-center md:justify-end gap-1.5">
                    <span>⚠️ {warn}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Tables Tabs: ATP vs Sensors */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'atp' | 'sensors')} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger
              value="atp"
              className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <ShieldCheck className="w-3.5 h-3.5 me-1.5" />
              {t('tabAtp')} ({atpCerts.length})
            </TabsTrigger>
            <TabsTrigger
              value="sensors"
              className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
            >
              <Thermometer className="w-3.5 h-3.5 me-1.5" />
              {t('tabSensors')} ({calibLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-500" />
            <Input
              placeholder="بحث بالرقم أو المقطورة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 bg-slate-900 border-slate-800 text-xs h-9 text-slate-200"
            />
          </div>
        </div>

        {/* Tab 1: ATP Certifications Table */}
        <TabsContent value="atp" className="mt-0">
          <Card className="bg-slate-900/90 border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">المقطورة</th>
                    <th className="py-3 px-4 text-start">رقم الشهادة</th>
                    <th className="py-3 px-4 text-start">التصنيف</th>
                    <th className="py-3 px-4 text-start">معامل K-Value</th>
                    <th className="py-3 px-4 text-start">تاريخ الإصدار</th>
                    <th className="py-3 px-4 text-start">تاريخ الانتهاء</th>
                    <th className="py-3 px-4 text-start">محطة الفحص</th>
                    <th className="py-3 px-4 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAtp.length > 0 ? (
                    filteredAtp.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cert.trailerPlate}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {cert.certificateNumber}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="font-mono text-[11px] font-bold">
                            {cert.atpType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={
                              cert.kValue <= 0.4 ? 'text-emerald-400 font-bold' : 'text-amber-400'
                            }
                          >
                            {cert.kValue.toFixed(3)} W/m²·K
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{cert.issueDate}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <div>{cert.expiryDate}</div>
                          <div
                            className={`text-[10px] ${
                              cert.daysRemaining < 0
                                ? 'text-rose-500 font-bold'
                                : cert.daysRemaining <= 30
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            {cert.daysRemaining < 0
                              ? `منتهي منذ ${Math.abs(cert.daysRemaining)} يوماً`
                              : `متبقي ${cert.daysRemaining} يوماً`}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{cert.testingStation}</td>
                        <td className="py-3 px-4">
                          <Badge
                            className={`text-[10px] ${
                              cert.status === 'valid' && cert.warningLevel === 'safe'
                                ? 'bg-emerald-600 text-white'
                                : cert.warningLevel === 'notice_60d' || cert.warningLevel === 'urgent_30d'
                                ? 'bg-amber-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {cert.status === 'valid' && cert.warningLevel === 'safe'
                              ? 'سارية (Valid)'
                              : cert.daysRemaining < 0
                              ? 'منتهية (Expired)'
                              : 'تجديد قريب'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        لا توجد شهادات مسجلة مطابقة للبحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Sensor Calibration Logs Table */}
        <TabsContent value="sensors" className="mt-0">
          <Card className="bg-slate-900/90 border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">المقطورة</th>
                    <th className="py-3 px-4 text-start">نوع الحساس</th>
                    <th className="py-3 px-4 text-start">تاريخ المعايرة</th>
                    <th className="py-3 px-4 text-start">الاستحقاق القادم</th>
                    <th className="py-3 px-4 text-start">الحرارة المرجعية</th>
                    <th className="py-3 px-4 text-start">الحرارة المقاسة</th>
                    <th className="py-3 px-4 text-start">فارق الانحراف (Δ Drift)</th>
                    <th className="py-3 px-4 text-start">الجهة الفاحصة</th>
                    <th className="py-3 px-4 text-start">النتيجة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCalib.length > 0 ? (
                    filteredCalib.map((cal) => (
                      <tr key={cal.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cal.trailerPlate}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-200">
                          {cal.sensorType === 'return_air_probe'
                            ? 'مجس الهواء الراجع (Return)'
                            : cal.sensorType === 'supply_air_probe'
                            ? 'مجس هواء الضخ (Supply)'
                            : cal.sensorType === 'data_logger'
                            ? 'مسجل DataCOLD'
                            : cal.sensorType}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{cal.calibratedAt}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <div>{cal.nextDueDate}</div>
                          <div
                            className={`text-[10px] ${
                              cal.daysRemaining < 0
                                ? 'text-rose-500 font-bold'
                                : cal.daysRemaining <= 30
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            {cal.daysRemaining < 0
                              ? `مستحقة منذ ${Math.abs(cal.daysRemaining)} يوماً`
                              : `متبقي ${cal.daysRemaining} يوماً`}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono">{cal.referenceTemp.toFixed(1)}°C</td>
                        <td className="py-3 px-4 font-mono">{cal.measuredTemp.toFixed(1)}°C</td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span
                            className={
                              Math.abs(cal.driftDelta) <= 0.5 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {cal.driftDelta > 0 ? `+${cal.driftDelta}` : cal.driftDelta}°C
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                          {cal.calibratedBy}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={`text-[10px] ${
                              cal.isPassed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}
                          >
                            {cal.isPassed
                              ? t('pass')
                              : t('fail')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        لا توجد سجلات معايرة مسجلة مطابقة للبحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

