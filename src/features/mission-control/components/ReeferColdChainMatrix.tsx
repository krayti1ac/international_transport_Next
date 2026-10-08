'use client';

import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CARGO_THERMAL_PROFILES, type TelematicsTelemetry } from '../types';
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
} from 'lucide-react';

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

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-amiri text-foreground flex items-center gap-2">
          <Snowflake className="w-5 h-5 text-cyan-500 animate-spin-slow" />
          <span>{t('رادار مبردات الشحن وسلسلة التبريد Frigo', 'Matrice Télématique Frigorifique')}</span>
        </h3>
        <Badge variant="outline" className="text-xs font-mono font-medium">
          {telemetryList.length} {t('وحدات نشطة', 'unités actives')}
        </Badge>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
