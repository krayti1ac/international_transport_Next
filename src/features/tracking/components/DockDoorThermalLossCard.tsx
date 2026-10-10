'use client';

/**
 * Trans Bodanon TMS — Unloading Dock Door Open Duration & Thermal Loss Tracker Card
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Agreement (FRC)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Flame,
  PenTool,
  RefreshCw,
} from 'lucide-react';
import type {
  CargoCategory,
  DockDoorState,
  EpodColdChainIncidentAnnex,
} from '../types/thermal-loss-tracker.types';
import {
  attachThermalAnnexToEpodAction,
  logDockDoorCycleAction,
} from '../services/dock-thermal-loss.actions';

interface DockDoorThermalLossCardProps {
  tripId?: number;
  tripNumber?: string;
  truckId?: number;
  truckPlate?: string;
  driverId?: string | number;
  driverName?: string;
  dockId?: string;
  dockName?: string;
  facilityOrPort?: string;
  compartment?: 'C1' | 'C2' | 'C3';
  cargoCategory?: CargoCategory;
  initialAnnex?: EpodColdChainIncidentAnnex | null;
  onAnnexAttached?: (annex: EpodColdChainIncidentAnnex) => void;
}

export function DockDoorThermalLossCard({
  tripId = 8840,
  tripNumber = 'TRIP-2026-8840',
  truckId = 101,
  truckPlate = '67890-A-40',
  driverId = 105,
  driverName = 'Mohamed El Idrissi',
  dockId = 'DOCK-MAD-04',
  dockName = 'Mercamadrid Hall 4 Frigo',
  facilityOrPort = 'Mercamadrid Plataforma Logística Frigorífica',
  compartment = 'C1',
  cargoCategory = 'fresh_produce',
  initialAnnex = null,
  onAnnexAttached,
}: DockDoorThermalLossCardProps) {
  const t = useTranslations('dockThermalLoss');
  const tCommon = useTranslations('common');
  const { dir } = useLanguage();
  const { toast } = useToast();

  const [isDoorOpen, setIsDoorOpen] = useState<boolean>(false);
  const [openStartTime, setOpenStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [tempAtOpen, setTempAtOpen] = useState<number>(3.2);
  const [currentTemp, setCurrentTemp] = useState<number>(3.2);
  const [annex, setAnnex] = useState<EpodColdChainIncidentAnnex | null>(initialAnnex);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [receiverNameInput, setReceiverNameInput] = useState<string>('Carlos Gomez (Receptor Frío)');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Live stopwatch when door is open
  useEffect(() => {
    if (isDoorOpen && openStartTime) {
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - openStartTime) / 1000);
        setElapsedSeconds(seconds);

        // Simulate heat ingress gradient (+0.14°C per 60s when door is open)
        const simTemp = Number((tempAtOpen + (seconds / 60) * 0.14).toFixed(1));
        setCurrentTemp(simTemp);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isDoorOpen, openStartTime, tempAtOpen]);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedRemainingSec = elapsedSeconds % 60;
  const tempRise = Number((currentTemp - tempAtOpen).toFixed(1));

  // State classification
  let doorState: DockDoorState = 'closed';
  if (isDoorOpen) {
    if (elapsedMinutes >= 30 || tempRise > 5.0) {
      doorState = 'critical_excursion';
    } else if (elapsedMinutes >= 15 || tempRise >= 2.0) {
      doorState = 'extended_open_warning';
    } else {
      doorState = 'open';
    }
  }

  const handleOpenDoor = () => {
    const now = Date.now();
    setOpenStartTime(now);
    setIsDoorOpen(true);
    setElapsedSeconds(0);
    setTempAtOpen(3.2);
    setCurrentTemp(3.2);

    toast({
      title: t('doorOpenedTitle'),
      description: t('doorOpenedDesc'),
    });
  };

  const handleCloseDoor = async () => {
    if (!openStartTime) return;
    setIsProcessing(true);

    try {
      const openIso = new Date(openStartTime).toISOString();
      const closeIso = new Date().toISOString();

      const res = await logDockDoorCycleAction({
        tripId,
        tripNumber,
        truckId,
        truckPlate,
        driverId,
        driverName,
        dockId,
        dockName,
        facilityOrPort,
        compartment,
        cargoCategory,
        doorOpenTimestamp: openIso,
        doorCloseTimestamp: closeIso,
        tempAtOpenC: tempAtOpen,
        tempAtCloseC: currentTemp,
        ambientTempC: 26.5,
        maxAllowedTempC: 6.0,
        receiverName: receiverNameInput,
      });

      if (res.success && res.data) {
        setAnnex(res.data);
        setIsDoorOpen(false);
        setOpenStartTime(null);

        if (res.data.annexRequired) {
          toast({
            title: t('annexGeneratedTitle'),
            description: t('annexGeneratedDesc'),
            variant: res.data.incidentLevel === 'critical' ? 'destructive' : 'default',
          });
        } else {
          toast({
            title: t('doorClosedNormalTitle'),
            description: t('doorClosedNormalDesc'),
          });
        }
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || 'Failed to record door cycle',
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAttachSignatures = async () => {
    if (!annex) return;
    setIsProcessing(true);

    try {
      const res = await attachThermalAnnexToEpodAction({
        annexId: annex.annexId,
        tripId,
        receiverSignature: 'data:image/png;base64,mockReceiverSigAttached2026',
        driverSignature: 'data:image/png;base64,mockDriverSigAttached2026',
        receiverName: receiverNameInput,
        notes: 'Signed and attached to delivery docket e-POD',
      });

      if (res.success && res.data) {
        setAnnex(res.data);
        setShowSignModal(false);
        if (onAnnexAttached) onAnnexAttached(res.data);

        toast({
          title: t('signedSuccessTitle'),
          description: t('signedSuccessDesc'),
        });
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || 'Failed to attach signatures',
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border border-border shadow-sm overflow-hidden" dir={dir}>
      <CardHeader className="p-4 bg-muted/40 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              isDoorOpen
                ? doorState === 'critical_excursion'
                  ? 'bg-rose-500/20 text-rose-600 animate-pulse'
                  : 'bg-amber-500/20 text-amber-600 animate-pulse'
                : 'bg-emerald-500/10 text-emerald-600'
            }`}
          >
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm md:text-base font-bold flex items-center gap-2">
              <span>{t('cardTitle')}</span>
              <Badge variant="outline" className="text-[11px] font-mono">
                {compartment} • {truckPlate}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {dockName} ({facilityOrPort})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {doorState === 'critical_excursion' && (
            <Badge className="bg-rose-600 text-white animate-pulse gap-1 text-[11px]">
              <ShieldAlert className="h-3 w-3" />
              {t('badgeCritical')}
            </Badge>
          )}
          {doorState === 'extended_open_warning' && (
            <Badge className="bg-amber-500 text-white gap-1 text-[11px]">
              <AlertTriangle className="h-3 w-3" />
              {t('badgeWarning')}
            </Badge>
          )}
          {doorState === 'open' && (
            <Badge className="bg-blue-600 text-white gap-1 text-[11px]">
              <Clock className="h-3 w-3" />
              {t('badgeOpen')}
            </Badge>
          )}
          {doorState === 'closed' && (
            <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
              <CheckCircle2 className="h-3 w-3" />
              {t('badgeClosed')}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Live Stopwatch & Temperature Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Stopwatch */}
          <div
            className={`p-3 rounded-lg border flex flex-col justify-between ${
              doorState === 'critical_excursion'
                ? 'bg-rose-500/10 border-rose-500/30'
                : doorState === 'extended_open_warning'
                ? 'bg-amber-500/10 border-amber-500/30'
                : isDoorOpen
                ? 'bg-blue-500/10 border-blue-500/30'
                : 'bg-muted/30 border-border'
            }`}
          >
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {t('elapsedDuration')}
            </span>
            <div className="text-xl md:text-2xl font-mono font-bold tracking-wider mt-1">
              {String(elapsedMinutes).padStart(2, '0')}:{String(elapsedRemainingSec).padStart(2, '0')}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {isDoorOpen ? t('timerActive') : t('timerStopped')}
            </span>
          </div>

          {/* Current Air Temp */}
          <div className="p-3 rounded-lg border bg-muted/30 border-border flex flex-col justify-between">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5" />
              {t('currentTemp')}
            </span>
            <div
              className={`text-xl md:text-2xl font-mono font-bold mt-1 ${
                currentTemp > 6.0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}
            >
              {currentTemp > 0 ? `+${currentTemp}` : currentTemp}°C
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {t('atOpenLabel')}: +{tempAtOpen}°C
            </span>
          </div>

          {/* Thermal Ingress Rise ΔT */}
          <div className="p-3 rounded-lg border bg-muted/30 border-border flex flex-col justify-between">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" />
              {t('tempRiseDelta')}
            </span>
            <div
              className={`text-xl md:text-2xl font-mono font-bold mt-1 ${
                tempRise >= 4.0
                  ? 'text-rose-600 dark:text-rose-400'
                  : tempRise >= 2.0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              +{tempRise}°C
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {elapsedMinutes > 0
                ? `${(tempRise / elapsedMinutes).toFixed(2)} °C/min`
                : '0.00 °C/min'}
            </span>
          </div>

          {/* Exposure Threshold Indicator */}
          <div className="p-3 rounded-lg border bg-muted/30 border-border flex flex-col justify-between">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('thresholdStatus')}
            </span>
            <div className="text-sm font-semibold mt-1">
              {doorState === 'critical_excursion'
                ? t('thresholdCritical')
                : doorState === 'extended_open_warning'
                ? t('thresholdWarning')
                : t('thresholdOptimal')}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              Max: 15m / ΔT ≤ 2°C
            </span>
          </div>
        </div>

        {/* Action Controls for Door State */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          {!isDoorOpen ? (
            <Button
              size="sm"
              onClick={handleOpenDoor}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              {t('openDoorBtn')}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleCloseDoor}
              disabled={isProcessing}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 animate-pulse"
            >
              {isProcessing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {t('closeDoorBtn')}
            </Button>
          )}

          {annex && annex.annexRequired && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSignModal(true)}
              className="text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 ms-auto"
            >
              <PenTool className="h-3.5 w-3.5" />
              {annex.status === 'annex_attached'
                ? t('annexSignedBtn')
                : t('signAnnexBtn')}
            </Button>
          )}
        </div>

        {/* Incident Annex Preview Card (When Warning or Critical) */}
        {annex && (
          <div
            className={`p-3.5 rounded-lg border mt-3 space-y-2.5 ${
              annex.incidentLevel === 'critical'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200'
                : annex.incidentLevel === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-bold text-xs md:text-sm">
                  {t('officialAnnexTitle')} ({annex.annexId})
                </span>
              </div>
              <Badge
                className={
                  annex.status === 'annex_attached'
                    ? 'bg-emerald-600 text-white text-[10px]'
                    : 'bg-amber-600 text-white text-[10px]'
                }
              >
                {annex.status === 'annex_attached'
                  ? t('statusAttached')
                  : t('statusDraft')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-muted-foreground block">
                  {t('exposureDuration')}:
                </span>
                <span className="font-bold">{annex.doorCycle.durationMinutes} min</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">
                  {t('tempDelta')}:
                </span>
                <span className="font-bold">+{annex.thermalMetrics.tempRiseDeltaC}°C</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">
                  {t('mktImpact')}:
                </span>
                <span className="font-bold">+{annex.thermalMetrics.mktEstimatedImpactC}°C</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">
                  {t('receiverName')}:
                </span>
                <span className="truncate block">{annex.receiverName}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1 font-mono opacity-80">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>HMAC Seal: {annex.cryptographicSeal.slice(0, 24)}...</span>
              </div>
              <span className="opacity-70">{new Date(annex.generatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Signature Modal for e-POD Annex */}
      {showSignModal && annex && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm md:text-base flex items-center gap-2">
                <PenTool className="h-4 w-4 text-amber-500" />
                {t('signModalTitle')}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSignModal(false)}
                className="h-7 w-7 p-0"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('signModalDesc')}
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium block">
                {t('receiverNameInput')}
              </label>
              <input
                type="text"
                value={receiverNameInput}
                onChange={(e) => setReceiverNameInput(e.target.value)}
                className="w-full text-xs p-2 border rounded bg-background"
              />
            </div>

            <div className="p-3 bg-muted/30 border rounded text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span>{t('annexId')}:</span>
                <span className="font-bold">{annex.annexId}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('totalExposure')}:</span>
                <span>{annex.doorCycle.durationMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span>{t('thermalRise')}:</span>
                <span>+{annex.thermalMetrics.tempRiseDeltaC}°C</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSignModal(false)}
                className="text-xs"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleAttachSignatures}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                {isProcessing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {t('confirmAndAttach')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
