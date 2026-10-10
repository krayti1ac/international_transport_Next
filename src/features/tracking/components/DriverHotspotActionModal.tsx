'use client';

/**
 * Trans Bodanon TMS — Driver PWA Hotspot Action Modal & Telematics Verification
 * Mobile-first interactive compliance confirmation card for drivers approaching critical hotspots.
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  Lock,
  Radio,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Thermometer,
  WifiOff,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  submitDriverHotspotConfirmationAction,
  verifyReeferTelematicsComplianceAction,
} from '../services/hotspot-confirmation.actions';
import type {
  DriverHotspotConfirmationRecord,
  TelematicsPreFlightVerification,
} from '../types/hotspot-confirmation.types';

export interface DriverHotspotActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  truckId: number;
  truckPlate: string;
  tripId: number;
  tripNumber: string;
  driverId: string | number;
  driverName: string;
  dockId: string;
  dockName: string;
  facilityOrPort: string;
  dviScore: number;
  distanceKm?: number;
  etaMinutes?: number;
  onConfirmed?: (record: DriverHotspotConfirmationRecord) => void;
}

export function DriverHotspotActionModal({
  isOpen,
  onClose,
  truckId,
  truckPlate,
  tripId,
  tripNumber,
  driverId,
  driverName,
  dockId,
  dockName,
  facilityOrPort,
  dviScore,
  distanceKm = 5.2,
  etaMinutes = 7,
  onConfirmed,
}: DriverHotspotActionModalProps) {
  const t = useTranslations('driverHotspotConfirmation');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Driver Affirmation Checkboxes
  const [continuousRunChecked, setContinuousRunChecked] = useState(true);
  const [doorsSealedChecked, setDoorsSealedChecked] = useState(true);
  const [curtainsDeployedChecked, setCurtainsDeployedChecked] = useState(true);

  // Live Telematics Verification State
  const [telematics, setTelematics] = useState<TelematicsPreFlightVerification | null>(null);
  const [isLoadingTelematics, setIsLoadingTelematics] = useState(false);
  const [confirmedRecord, setConfirmedRecord] = useState<DriverHotspotConfirmationRecord | null>(null);

  // Fetch live telematics pre-flight status
  const fetchLiveTelematics = async () => {
    setIsLoadingTelematics(true);
    try {
      const res = await verifyReeferTelematicsComplianceAction({ truckId, tripId, dockId });
      if (res.success && res.verification) {
        setTelematics(res.verification);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setIsLoadingTelematics(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveTelematics();
    }
  }, [isOpen, truckId, tripId]);

  if (!isOpen) return null;

  const handleSubmitConfirmation = () => {
    startTransition(async () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      const res = await submitDriverHotspotConfirmationAction({
        tripId,
        tripNumber,
        truckId,
        truckPlate,
        driverId,
        driverName,
        dockId,
        dockName,
        facilityOrPort,
        dviScore,
        riskLevel: dviScore >= 60 ? 'critical' : 'monitored',
        distanceKm,
        continuousRunChecked,
        doorsSealedChecked,
        curtainsDeployedChecked,
        offlineQueued: !isOnline,
      });

      if (res.success && res.record) {
        setConfirmedRecord(res.record);
        if (onConfirmed) onConfirmed(res.record);

        if (res.record.discrepancyDetected) {
          toast({
            title: t('warningDiscrepancyTitle'),
            description: t('warningDiscrepancyDescription'),
            variant: 'destructive',
          });
        } else {
          toast({
            title: t('successTitle'),
            description: t('successDescription'),
          });
        }
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Failed to submit confirmation',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs select-none">
      <Card className="w-full max-w-lg border-2 border-rose-500/50 shadow-2xl bg-background overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Alert Strip */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 px-4 py-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="font-bold text-sm tracking-wide flex items-center gap-1.5">
              <Flame className="h-4 w-4" />
              {t('hotspotAlert')} (DVI {dviScore}/100)
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1 text-white/80 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardHeader className="pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-sky-500" />
                <span>{dockName}</span>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {facilityOrPort}
              </CardDescription>
            </div>

            <div className="text-end text-xs font-mono">
              <div className="font-semibold text-rose-500 flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" />
                ~{etaMinutes} min ({t('etaMinutes')})
              </div>
              <div className="text-muted-foreground text-[11px]">
                ~{distanceKm} km ({t('distanceRemaining')})
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-1">{t('subtitle')}</p>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          {/* Live Telematics Pre-Flight Bar */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-sky-500 animate-pulse" />
                {t('telematicsStatus')}
              </span>

              <div className="flex items-center gap-2">
                {telematics && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono ${
                      telematics.preDockingScore >= 90
                        ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                        : telematics.preDockingScore >= 70
                        ? 'border-amber-500 text-amber-600 bg-amber-500/10'
                        : 'border-rose-500 text-rose-600 bg-rose-500/10'
                    }`}
                  >
                    {t('telematicsScore')}: {telematics.preDockingScore}/100
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-sky-600"
                  onClick={fetchLiveTelematics}
                  disabled={isLoadingTelematics}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingTelematics ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {telematics ? (
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {/* Compressor */}
                <div className="rounded-md bg-background/80 p-2 border">
                  <div className="text-muted-foreground text-[10px]">{t('compressorStatus')}</div>
                  <div className="font-bold flex items-center gap-1 mt-0.5">
                    {telematics.compressorRunning ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {t('running')}
                      </span>
                    ) : (
                      <span className="text-rose-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {t('idle')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mode */}
                <div className="rounded-md bg-background/80 p-2 border">
                  <div className="text-muted-foreground text-[10px]">{t('coolingMode')}</div>
                  <div className="font-bold flex items-center gap-1 mt-0.5 truncate">
                    {telematics.continuousRunActive ? (
                      <span className="text-emerald-600">{t('continuous')}</span>
                    ) : (
                      <span className="text-amber-500">{t('cycleSentry')}</span>
                    )}
                  </div>
                </div>

                {/* Doors */}
                <div className="rounded-md bg-background/80 p-2 border">
                  <div className="text-muted-foreground text-[10px]">{t('doorSensor')}</div>
                  <div className="font-bold flex items-center gap-1 mt-0.5">
                    {telematics.doorsClosed ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> {t('closed')}
                      </span>
                    ) : (
                      <span className="text-rose-500">{t('open')}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mx-auto text-sky-500" />
              </div>
            )}
          </div>

          {/* Mandatory Driver Action Checklist */}
          <div className="space-y-2">
            <span className="font-bold text-[11px] text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {t('mandatoryChecklist')}
            </span>

            {/* Item 1: Continuous Run */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={continuousRunChecked}
                onChange={(e) => setContinuousRunChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-primary text-primary focus:ring-primary"
              />
              <span className="text-[11px] leading-snug">
                {t('continuousRunLabel')}
              </span>
            </label>

            {/* Item 2: Doors Sealed */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={doorsSealedChecked}
                onChange={(e) => setDoorsSealedChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-primary text-primary focus:ring-primary"
              />
              <span className="text-[11px] leading-snug">
                {t('doorsSealedLabel')}
              </span>
            </label>

            {/* Item 3: Curtains Ready */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={curtainsDeployedChecked}
                onChange={(e) => setCurtainsDeployedChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-primary text-primary focus:ring-primary"
              />
              <span className="text-[11px] leading-snug">
                {t('curtainsReadyLabel')}
              </span>
            </label>
          </div>

          {/* Discrepancy Alert Banner if detected */}
          {confirmedRecord?.discrepancyDetected && (
            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 p-3 text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t('warningDiscrepancyTitle')}
              </div>
              <p className="text-[11px] leading-tight">
                {t('warningDiscrepancyDescription')}
              </p>
            </div>
          )}

          {/* Success Digital Seal Banner */}
          {confirmedRecord && !confirmedRecord.discrepancyDetected && (
            <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-3 text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t('successTitle')}
              </div>
              <p className="text-[10px] font-mono break-all opacity-85">
                HMAC Seal: {confirmedRecord.signatureHash.slice(0, 32)}...
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              {t('dismiss')}
            </Button>

            <Button
              size="sm"
              disabled={
                !continuousRunChecked ||
                !doorsSealedChecked ||
                isPending ||
                Boolean(confirmedRecord && !confirmedRecord.discrepancyDetected)
              }
              onClick={handleSubmitConfirmation}
              className={`text-xs gap-1.5 font-bold transition-all shadow-md ${
                confirmedRecord && !confirmedRecord.discrepancyDetected
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700 animate-pulse'
              }`}
            >
              {isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>{t('confirming')}</span>
                </>
              ) : confirmedRecord ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('successTitle')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{t('confirmButton')}</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

