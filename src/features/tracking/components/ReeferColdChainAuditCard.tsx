'use client';

import React, { useState, useTransition } from 'react';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ThermometerSnowflake,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Lock,
  Unlock,
  Fuel,
  Activity,
  AlertTriangle,
  Clock,
  Sparkles,
  Award,
  RefreshCw,
  PlusCircle,
  MessageCircle,
} from 'lucide-react';
import type {
  ColdChainAuditEvaluation,
  ReeferExcursionIncident,
  ReeferTelemetryLog,
  TripReeferMonitoringProfile,
} from '../types/reefer-compliance.types';
import { REEFER_CARGO_CATALOG } from '../types/reefer-compliance.types';
import { GdpComplianceCertificateModal } from './GdpComplianceCertificateModal';
import {
  generateReeferCertificateAction,
  logReeferTelemetryAction,
  dispatchReeferWhatsAppAlertAction,
} from '../services/reefer-compliance.actions';


interface ReeferColdChainAuditCardProps {
  tripId: string | number;
  profile: TripReeferMonitoringProfile;
  evaluation: ColdChainAuditEvaluation;
  logs?: ReeferTelemetryLog[];
  incidents?: ReeferExcursionIncident[];
  cmrNumber?: string;
  route?: string;
  clientName?: string;
  truckPlate?: string;
  trailerPlate?: string;
  onRefresh?: () => void;
  className?: string;
}

export function ReeferColdChainAuditCard({
  tripId,
  profile,
  evaluation: initialEvaluation,
  logs = [],
  incidents = [],
  cmrNumber,
  route,
  clientName,
  truckPlate,
  trailerPlate,
  onRefresh,
  className = '',
}: ReeferColdChainAuditCardProps) {
  const { t, locale, dir } = useLanguage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [evaluation, setEvaluation] = useState<ColdChainAuditEvaluation>(initialEvaluation);
  const [showCertModal, setShowCertModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'incidents'>('overview');
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);

  const cargoPreset = REEFER_CARGO_CATALOG[profile.cargoCategory] || REEFER_CARGO_CATALOG.fresh_produce;

  const isCompliant = evaluation.complianceStatus === 'compliant';
  const isWarning = evaluation.complianceStatus === 'warning';
  const isBreached = evaluation.complianceStatus === 'breached';

  // Handle WhatsApp Alert Dispatch
  const handleDispatchAlert = (inc: ReeferExcursionIncident) => {
    setSendingAlertId(inc.id);
    startTransition(async () => {
      const res = await dispatchReeferWhatsAppAlertAction({
        incidentId: inc.id,
        tripId,
        recipientPhone: '+212694585307',
        locale: locale === 'fr' ? 'fr' : locale === 'es' ? 'es' : 'ar',
        forceBypassCooldown: false,
      });

      setSendingAlertId(null);

      if (!res.success) {
        toast({
          title: 'فشل بث إنذار التبريد',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      if (res.skippedCooldown) {
        toast({
          title: 'الإنذار في فترة التهدئة المؤقتة (Cooldown)',
          description: 'تم إرسال هذا الإنذار مسبقاً خلال الـ 15 دقيقة الأخيرة لمنع تكرار الإزعاج.',
        });
      } else {
        toast({
          title: 'تم بث إنذار التبريد عبر WhatsApp بنجاح 🚨',
          description: `المستلم: ${res.phone} ${res.isSimulated ? '(وضع التجربة الآمن 🧪)' : ''}`,
        });
      }
    });
  };


  // Handle Certificate Generation
  const handleGenerateCertificate = () => {
    startTransition(async () => {
      const res = await generateReeferCertificateAction({
        tripId,
        forceReissue: isBreached,
      });

      if (!res.success) {
        toast({
          title: 'تعذر إصدار الشهادة',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      if (res.evaluation) {
        setEvaluation(res.evaluation);
      }

      toast({
        title: 'تم إصدار شهادة الامتثال الرقمية بنجاح',
        description: `كود الشهادة: ${res.certificateHash?.substring(0, 20)}...`,
      });

      setShowCertModal(true);
      if (onRefresh) onRefresh();
    });
  };

  const getCargoLabel = () => {
    switch (profile.cargoCategory) {
      case 'fresh_produce':
        return locale === 'fr'
          ? 'Fruits & Légumes frais'
          : locale === 'es'
          ? 'Frutas y verduras frescas'
          : 'بواكير وخضار وفواكه طازجة';
      case 'deep_frozen':
        return locale === 'fr'
          ? 'Poissons & Surgelés profonds'
          : locale === 'es'
          ? 'Pescados y ultracongelados'
          : 'أسماك ومجمدات عميقة';
      case 'pharma_cold':
        return locale === 'fr'
          ? 'Produits pharmaceutiques GDP'
          : locale === 'es'
          ? 'Productos farmacéuticos GDP'
          : 'أدوية ومستحضرات صيدلانية GDP';
      case 'meat_chilled':
        return locale === 'fr'
          ? 'Viandes réfrigérées'
          : locale === 'es'
          ? 'Carnes refrigeradas'
          : 'لحوم مبردة طازجة';
      default:
        return profile.cargoCategory;
    }
  };

  const latestLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <Card className={`border border-slate-800 bg-slate-900/90 text-slate-100 shadow-xl overflow-hidden ${className}`}>
      {/* Card Header */}
      <CardHeader className="bg-slate-950/60 border-b border-slate-800/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <ThermometerSnowflake className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                تدقيق سلسلة التبريد المعتمد (GDP / EN 12830)
              </CardTitle>
              <Badge variant="outline" className="bg-slate-800/60 border-slate-700 text-xs text-slate-300">
                ATP Classe {profile.atpClass.toUpperCase()}
              </Badge>
              <Badge
                className={`text-xs px-2.5 py-0.5 font-bold ${
                  isCompliant
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isWarning
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {isCompliant
                  ? 'مطابق للمعايير (Compliant)'
                  : isWarning
                  ? 'تحذير تقلبات (Warning)'
                  : 'مخالفة حرجة (Breached)'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              الشحنة: <strong className="text-slate-200">{getCargoLabel()}</strong> • نقطة الضبط:{' '}
              <strong className="text-emerald-400">{profile.setpointTemp > 0 ? `+${profile.setpointTemp}` : profile.setpointTemp}°C</strong> (النطاق المسموح: {profile.minTempThreshold}°C إلى {profile.maxTempThreshold}°C)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {evaluation.certificateHash ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCertModal(true)}
                className="bg-emerald-950/40 border-emerald-700/50 hover:bg-emerald-900/60 text-emerald-300 font-semibold"
              >
                <FileCheck2 className="w-4 h-4 me-1.5" />
                عرض الشهادة الرسمية
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={handleGenerateCertificate}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                <Award className="w-4 h-4 me-1.5" />
                {isPending ? 'جاري الاعتماد...' : 'إصدار الشهادة الرقمية'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* Bento Grid: Core Thermal & Kinetic KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* 1. MKT (Mean Kinetic Temperature) */}
          <div className="bg-slate-950/50 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-medium">الحرارة الحركية (MKT)</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-emerald-300">
                {evaluation.mktTemperatureCelsius > 0 ? `+${evaluation.mktTemperatureCelsius}` : evaluation.mktTemperatureCelsius}°C
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Arrhenius Kinetic Index
              </span>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
              مقارنة بنقطة الضبط: {profile.setpointTemp}°C
            </div>
          </div>

          {/* 2. Real-Time Air Temps */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">الهواء الراجع / الضخ</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">الراجع (Return):</span>
                <span className="text-base font-bold text-white">
                  {latestLog ? (latestLog.returnAirTemp > 0 ? `+${latestLog.returnAirTemp}` : latestLog.returnAirTemp) : evaluation.avgReturnTemp}°C
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">الضخ (Supply):</span>
                <span className="text-base font-bold text-cyan-300">
                  {latestLog ? (latestLog.supplyAirTemp > 0 ? `+${latestLog.supplyAirTemp}` : latestLog.supplyAirTemp) : evaluation.avgSupplyTemp}°C
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
              {logs.length} تسجيل EN 12830
            </div>
          </div>

          {/* 3. Thermal Excursions */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">مدة الانحراف الحراري</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-amber-300">
                {evaluation.totalExcursionMinutes} <span className="text-sm font-normal text-slate-400">دقيقة</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                الحد المسموح: {profile.maxAllowedExcursionMinutes} دقيقة
              </span>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
              {evaluation.totalExcursionMinutes <= profile.maxAllowedExcursionMinutes ? 'ضمن الهامش القانوني' : 'تجاوز المهلة الحرجة'}
            </div>
          </div>

          {/* 4. Transit Door & Security Integrity */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">أمان الأبواب والوقود</span>
              <Fuel className="w-4 h-4 text-blue-400" />
            </div>
            <div className="my-2 space-y-1">
              <div className="flex items-center gap-1.5">
                {latestLog?.doorOpenSensor && !latestLog?.isGeofenceSafe ? (
                  <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> خرق فتح الباب
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] flex items-center gap-1">
                    <Lock className="w-3 h-3" /> الأبواب مؤمنة
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-300">
                وقود التبريد: <strong className="text-white">{evaluation.totalDieselBurnedLiters}L</strong>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
              المعدل: {latestLog?.dieselBurnRateLph || 2.1} لتر/ساعة
            </div>
          </div>
        </div>

        {/* Excursion Incidents Alert (if any active) */}
        {incidents && incidents.length > 0 && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              تم رصد {incidents.length} واقعة انحراف حراري أو خرق تشغيلي أثناء الترانزيت:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {incidents.slice(0, 4).map((inc) => (
                <div key={inc.id} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      {inc.incidentType === 'temp_high'
                        ? 'ارتفاع حرارة غير مصرح'
                        : inc.incidentType === 'temp_low'
                        ? 'انخفاض وتجمد خطير'
                        : inc.incidentType === 'door_breach_transit'
                        ? 'فتح أبواب المقطورة بالترانزيت'
                        : 'عطل مفاجئ في الضاغط'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      الذروة: {inc.peakDeviationTemp}°C • المدة: {inc.durationMinutes} دقيقة
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={inc.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">
                      {inc.severity === 'critical' ? 'حرج' : 'تحذير'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sendingAlertId === inc.id}
                      onClick={() => handleDispatchAlert(inc)}
                      className="h-6 text-[10px] px-2 bg-rose-950/40 border-rose-700/60 text-rose-300 hover:bg-rose-900/60"
                      title="بث إنذار طوارئ عبر واتساب"
                    >
                      <MessageCircle className="w-3 h-3 me-1 text-rose-400" />
                      {sendingAlertId === inc.id ? 'جاري البث...' : 'بث واتساب'}
                    </Button>
                  </div>
                </div>
              ))}

            </div>
          </div>
        )}

        {/* Telemetry Stream Log Table (Recent 5 logs) */}
        {logs && logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>سجل التدفق اللحظي لحساسات مسجل التبريد EN 12830 (DataCOLD / TracKing)</span>
              <span>عرض آخر {Math.min(logs.length, 5)} قراءات</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
              <table className="w-full text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-[11px]">
                  <tr>
                    <th className="py-2 px-3 text-start">الوقت</th>
                    <th className="py-2 px-3 text-start">هواء الضخ</th>
                    <th className="py-2 px-3 text-start">هواء الراجع</th>
                    <th className="py-2 px-3 text-start">الضاغط</th>
                    <th className="py-2 px-3 text-start">الباب</th>
                    <th className="py-2 px-3 text-start">الوقود</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.slice(-5).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {new Date(log.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 font-semibold text-cyan-300">
                        {log.supplyAirTemp > 0 ? `+${log.supplyAirTemp}` : log.supplyAirTemp}°C
                      </td>
                      <td className="py-2 px-3 font-semibold text-white">
                        {log.returnAirTemp > 0 ? `+${log.returnAirTemp}` : log.returnAirTemp}°C
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[11px] capitalize text-slate-400">{log.compressorStatus}</span>
                      </td>
                      <td className="py-2 px-3">
                        {log.doorOpenSensor ? (
                          <span className="text-rose-400 font-bold text-[11px]">مفتوح</span>
                        ) : (
                          <span className="text-emerald-400 text-[11px]">مغلق</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {log.dieselBurnRateLph ? `${log.dieselBurnRateLph} L/h` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      {/* Official Certificate Modal */}
      <GdpComplianceCertificateModal
        open={showCertModal}
        onOpenChange={setShowCertModal}
        profile={profile}
        evaluation={evaluation}
        cmrNumber={cmrNumber}
        route={route}
        clientName={clientName}
        truckPlate={truckPlate}
        trailerPlate={trailerPlate}
      />
    </Card>
  );
}

