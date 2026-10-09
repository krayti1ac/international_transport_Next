'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CARGO_THERMAL_PROFILES, type TelematicsTelemetry } from '../types';
import { ReeferTelemetryCard } from '@/features/tracking/components/ReeferTelemetryCard';
import {
  Snowflake,
  ShieldAlert,
  PhoneCall,
  MapPin,
  Clock,
  Gauge,
  Lock,
  Unlock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wrench,
  FileCheck2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { GdpComplianceCertificateModal } from '@/features/tracking/components/GdpComplianceCertificateModal';
import { useTelematicsStream } from '@/features/tracking/hooks/useTelematicsStream';


interface ReeferColdChainMatrixProps {
  telemetryList: TelematicsTelemetry[];
  selectedAsset: TelematicsTelemetry | null;
  onSelectAsset: (asset: TelematicsTelemetry) => void;
  onTriggerEmergency: (asset: TelematicsTelemetry) => void;
}

export function ReeferColdChainMatrix({
  telemetryList,
  selectedAsset,
  onSelectAsset,
  onTriggerEmergency,
}: ReeferColdChainMatrixProps) {
  const { t, dir } = useLanguage();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [certAsset, setCertAsset] = useState<TelematicsTelemetry | null>(null);

  // Real-time telematics stream connection
  const { status: streamStatus, reconnect: reconnectStream } = useTelematicsStream({
    enabled: true,
  });

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-bold font-amiri text-foreground flex items-center gap-2">
          <Snowflake className="w-5 h-5 text-cyan-500 animate-spin-slow" />
          <span>{t('رادار مبردات الشحن وسلسلة التبريد Frigo', 'Matrice Télématique Frigorifique')}</span>
        </h3>
        <div className="flex items-center gap-2">
          {streamStatus === 'connected' ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 text-[11px] py-0.5 px-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3 h-3 text-emerald-500" />
              <span>{t('reefer.stream.live', 'بث لحظي نشط (SSE)')}</span>
            </Badge>
          ) : streamStatus === 'connecting' ? (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 text-[11px] py-0.5 px-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <Wifi className="w-3 h-3 text-amber-500" />
              <span>{t('reefer.stream.connecting', 'جاري الاتصال...')}</span>
            </Badge>
          ) : (
            <Badge
              onClick={reconnectStream}
              className="cursor-pointer bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] py-0.5 px-2 transition-colors"
              title="إعادة الاتصال بالبث المباشر"
            >
              <WifiOff className="w-3 h-3 text-rose-500" />
              <span>{t('reefer.stream.reconnect', 'إعادة الاتصال')}</span>
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-mono font-medium">
            {telemetryList.length} {t('وحدات نشطة', 'unités actives')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pe-1">
        {telemetryList.map((asset) => {
          const isSelected = selectedAsset?.truckId === asset.truckId;
          const isCritical = asset.tempStatus === 'critical_drift' || asset.doorBreachRisk;
          const isWarning = asset.tempStatus === 'warning';
          const cargo = CARGO_THERMAL_PROFILES[asset.cargoProfile];

          return (
            <Card
              key={asset.truckId}
              onClick={() => onSelectAsset(asset)}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                isSelected
                  ? 'border-primary shadow-md bg-accent/20'
                  : isCritical
                  ? 'border-rose-500/80 bg-rose-500/5 hover:border-rose-600'
                  : isWarning
                  ? 'border-amber-400/80 bg-amber-500/5 hover:border-amber-500'
                  : 'border-border/70 hover:border-primary/50'
              }`}
            >
              <CardContent className="p-3.5 space-y-3">
                {/* Header Strip */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold font-mono text-sm text-foreground">
                        {asset.truckPlate}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        [{asset.trailerPlate || 'Frigo'}]
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                      {asset.tripRoute || 'ممر دولي'}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isCritical
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                        : isWarning
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {isCritical ? (
                      <>
                        <ShieldAlert className="w-3 h-3" />
                        {t('إنذار حرج', 'Critique')}
                      </>
                    ) : isWarning ? (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        {t('انحراف بسيط', 'Écart')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        {t('سليم', 'Optimal')}
                      </>
                    )}
                  </span>
                </div>

                {/* Temperature Indicator Block */}
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      {cargo.nameAr}
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span
                        className={`text-2xl font-black font-mono ${
                          isCritical
                            ? 'text-rose-600'
                            : isWarning
                            ? 'text-amber-600'
                            : 'text-cyan-600 dark:text-cyan-400'
                        }`}
                      >
                        {asset.currentTemp > 0 ? `+${asset.currentTemp}` : asset.currentTemp}°C
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        / {asset.targetTemp > 0 ? `+${asset.targetTemp}` : asset.targetTemp}°C
                      </span>
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="text-[10px] text-muted-foreground block">
                      {t('الانحراف', 'Déviation')}
                    </span>
                    <span
                      className={`font-mono font-bold text-xs ${
                        isCritical ? 'text-rose-600 font-extrabold' : 'text-foreground'
                      }`}
                    >
                      ±{asset.tempDeviation}°C
                    </span>
                  </div>
                </div>

                {/* Sub-Metrics: Door Sensor & SDI Score */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-background border border-border/60">
                    {asset.doorOpen ? (
                      <Unlock className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-bounce" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        asset.doorBreachRisk
                          ? 'text-rose-600 font-bold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {asset.doorOpen
                        ? asset.doorBreachRisk
                          ? t('باب مفتوح أثناء السير!', 'Porte ouverte en route !')
                          : t('باب مفتوح', 'Porte ouverte')
                        : t('الباب مغلق', 'Porte fermée')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-background border border-border/60">
                    <Gauge className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-muted-foreground">
                      SDI: <strong className="text-foreground">{asset.reeferSdiScore}%</strong>
                    </span>
                  </div>
                </div>

                {/* Interactive Controls */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {asset.driverName || 'كابتن الرحلة'}
                  </span>

                  <div className="flex gap-1.5 shrink-0">
                    {asset.frigoIoT && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] px-2 gap-1 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950"
                        title={t('تشخيص تيليماتكس التبريد', 'Diagnostics Frigo IoT', 'Diagnóstico Frigo IoT')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === asset.truckId ? null : asset.truckId);
                        }}
                      >
                        <Wrench className="w-3 h-3" />
                        <span>{t('تيليماتكس', 'IoT', 'IoT')}</span>
                        {expandedId === asset.truckId ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] px-2 gap-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      title={t('شهادة مطابقة سلسلة التبريد GDP', 'Certificat GDP / EN 12830', 'Certificado GDP')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCertAsset(asset);
                      }}
                    >
                      <FileCheck2 className="w-3 h-3" />
                      <span>{t('شهادة GDP', 'Certif GDP', 'Certif GDP')}</span>
                    </Button>

                    {asset.driverPhone && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                        title={t('اتصال بالكابتن', 'Appeler')}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`tel:${asset.driverPhone}`, '_self');
                        }}
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant={isCritical ? 'destructive' : 'outline'}
                      className="h-7 text-xs px-2.5 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTriggerEmergency(asset);
                      }}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>{t('إنذار', 'Alerte')}</span>
                    </Button>
                  </div>
                </div>

                {/* Expanded Frigo IoT Telematics Diagnostics Card */}
                {(expandedId === asset.truckId || isSelected) && asset.frigoIoT && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <ReeferTelemetryCard iotData={asset.frigoIoT} compact />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Official GDP Compliance Certificate Modal */}
      {certAsset && (
        <GdpComplianceCertificateModal
          open={Boolean(certAsset)}
          onOpenChange={(open) => {
            if (!open) setCertAsset(null);
          }}
          profile={{
            id: `prof-${certAsset.tripId ?? certAsset.truckId}`,
            companyId: 1,
            tripId: certAsset.tripId ?? certAsset.truckId,
            trailerId: certAsset.trailerId ?? null,
            coolingUnitBrand: certAsset.frigoIoT?.model || certAsset.reeferModel || 'Carrier Transicold Vector 1550',
            atpClass: 'class_c',
            cargoCategory:
              certAsset.cargoProfile === 'frozen_fish'
                ? 'deep_frozen'
                : certAsset.cargoProfile === 'frozen_meat'
                ? 'meat_chilled'
                : certAsset.cargoProfile === 'pharmaceuticals'
                ? 'pharma_cold'
                : 'fresh_produce',
            setpointTemp: certAsset.targetTemp,
            minTempThreshold: certAsset.cargoProfile === 'frozen_fish' ? -25 : 2,
            maxTempThreshold: certAsset.cargoProfile === 'frozen_fish' ? -18 : 6,
            maxAllowedExcursionMinutes: 45,
            mktActivationEnergyKj: 83.144,
            isActive: true,
          }}
          evaluation={{
            tripId: certAsset.tripId ?? certAsset.truckId,
            atpClass: 'class_c',
            cargoCategory:
              certAsset.cargoProfile === 'frozen_fish'
                ? 'deep_frozen'
                : certAsset.cargoProfile === 'frozen_meat'
                ? 'meat_chilled'
                : certAsset.cargoProfile === 'pharmaceuticals'
                ? 'pharma_cold'
                : 'fresh_produce',
            totalLogsCount: 48,
            setpointTemp: certAsset.targetTemp,
            avgSupplyTemp: certAsset.currentTemp,
            avgReturnTemp: certAsset.currentTemp,
            mktTemperatureCelsius: certAsset.currentTemp,
            complianceStatus:
              certAsset.tempStatus === 'critical_drift'
                ? 'breached'
                : certAsset.tempStatus === 'warning'
                ? 'warning'
                : 'compliant',
            totalExcursionMinutes: certAsset.tempStatus === 'critical_drift' ? 60 : 0,
            doorBreachesCount: certAsset.doorBreachRisk ? 1 : 0,
            totalDieselBurnedLiters: 112.5,
            complianceScorePercent: certAsset.tempStatus === 'critical_drift' ? 70 : 100,
            certificateHash: `ATP-CLASS_C-${certAsset.tripId ?? certAsset.truckId}-A892F109C4819E77`,
          }}
          truckPlate={certAsset.truckPlate}
          trailerPlate={certAsset.trailerPlate}
          route={certAsset.tripRoute || undefined}
        />
      )}
    </div>
  );
}


