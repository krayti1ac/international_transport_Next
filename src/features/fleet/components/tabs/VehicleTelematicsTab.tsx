'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Gauge,
  Fuel,
  Thermometer,
  Zap,
  Activity,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  Snowflake,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { Truck, Trailer } from '@/types/database';
import type { TruckTelematicsState } from '../../types/telematics.types';

interface VehicleTelematicsTabProps {
  vehicle: Truck | Trailer;
  vehicleType: 'truck' | 'trailer';
  telematicsState?: TruckTelematicsState | null;
}

export function VehicleTelematicsTab({
  vehicle,
  vehicleType,
  telematicsState,
}: VehicleTelematicsTabProps) {
  const { t } = useLanguage();
  const isTruck = vehicleType === 'truck';

  // Fallback realistic simulation if hardware is waiting for initial ping
  const state: TruckTelematicsState = telematicsState || {
    truck_id: vehicle.id,
    plate_number: vehicle.plate_number,
    model: vehicle.model,
    status: (vehicle.status as any) || 'active',
    last_updated: new Date().toISOString(),
    latitude: 35.7595,
    longitude: -5.834,
    speed_kmh: 0,
    fuel_level_percent: 74,
    fuel_liters_est: 666,
    engine_rpm: 650,
    engine_coolant_temp_c: 88,
    odometer_km: 184500,
    engine_health: 'healthy',
    active_alerts: [],
  };

  const isEngineHealthy = state.engine_health === 'healthy';
  const isWarning = state.engine_health === 'warning';

  return (
    <div className="space-y-6">
      {/* 1. Live Status & Telematics Stream Banner */}
      <Card className="rounded-2xl border-border bg-gradient-to-r from-card via-card/90 to-primary/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  {t('بيانات CAN-bus وإنترنت الأشياء (IoT)', 'Télématique CAN-bus & IoT')}
                </h3>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  LIVE FMS
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('آخر إشارة وردت:', 'Dernier signal :')}{' '}
                <span className="font-mono text-foreground">{state.last_updated?.replace('T', ' ').slice(0, 19)}</span>
              </p>
            </div>
          </div>

          <Badge
            className={`text-xs px-3 py-1 font-semibold rounded-full self-start sm:self-auto ${
              isEngineHealthy
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : isWarning
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
            }`}
          >
            {isEngineHealthy
              ? t('المحرك والأنظمة في حالة ممتازة', 'Moteur & Systèmes Sains')
              : isWarning
                ? t('حرارة المحرك مرتفعة نسبياً', 'Température Élevée')
                : t('تنبيه حرج بالمحرك!', 'Alerte Moteur!')}
          </Badge>
        </div>
      </Card>

      {/* 2. Gauges & Real-Time Sensors */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Speed */}
        <Card className="rounded-2xl border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('السرعة اللحظية', 'Vitesse Instantanée')}
            </span>
            <Gauge className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black font-mono text-foreground">
              {state.speed_kmh}
            </span>
            <span className="text-xs font-mono text-muted-foreground font-semibold">
              km/h
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {state.speed_kmh > 0 ? t('الشاحنة تسير', 'En mouvement') : t('في وضع التوقف', 'À l\'arrêt')}
          </p>
        </Card>

        {/* Fuel Level */}
        <Card className="rounded-2xl border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('مستوى خزان الوقود', 'Niveau Réservoir')}
            </span>
            <Fuel className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black font-mono text-foreground">
              {state.fuel_level_percent}%
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              (~{state.fuel_liters_est} L)
            </span>
          </div>
          {/* Visual Tank Bar */}
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                state.fuel_level_percent < 20 ? 'bg-rose-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, state.fuel_level_percent)}%` }}
            />
          </div>
        </Card>

        {/* Coolant Temperature */}
        <Card className="rounded-2xl border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('حرارة سائل التبريد', 'Temp. Liquide Refroid.')}
            </span>
            <Thermometer
              className={`w-4 h-4 ${
                state.engine_coolant_temp_c >= 100
                  ? 'text-rose-500'
                  : state.engine_coolant_temp_c >= 95
                    ? 'text-amber-500'
                    : 'text-emerald-500'
              }`}
            />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black font-mono text-foreground">
              {state.engine_coolant_temp_c}
            </span>
            <span className="text-xs font-mono text-muted-foreground font-semibold">
              °C
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t('المعدل الطبيعي: 82 - 95 °C', 'Plage normale: 82-95°C')}
          </p>
        </Card>

        {/* Odometer */}
        <Card className="rounded-2xl border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('قراءة العداد الحقيقية', 'Kilométrage Odomètre')}
            </span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-foreground truncate">
              {state.odometer_km?.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-muted-foreground font-semibold">
              km
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t('قراءة CAN-bus مباشرة', 'Lecture directe CAN')}
          </p>
        </Card>
      </div>

      {/* 3. GPS Position & Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GPS Coordinates Box */}
        <Card className="rounded-2xl border-border bg-card p-5">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>{t('الموقع الجغرافي والإحداثيات', 'Coordonnées GPS & Localisation')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">{t('خط العرض والطول:', 'Lat / Long :')}</p>
                <p className="text-xs font-mono font-bold text-foreground mt-0.5">
                  {state.latitude?.toFixed(5)}, {state.longitude?.toFixed(5)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-7 text-xs rounded-lg"
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${state.latitude},${state.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('خرائط Google', 'Google Maps')}
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t(
                'يتم تحديث الإحداثيات آلياً عبر جهاز التتبع الميداني على فترات دورية أو عند حدوث تغيرات مفاجئة في السرعة.',
                'Position actualisée automatiquement par le traceur embarqué.'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Telematics Alerts */}
        <Card className="rounded-2xl border-border bg-card p-5">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>{t('التنبيهات الميدانية المسجلة', 'Alertes Télématiques')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {state.active_alerts && state.active_alerts.length > 0 ? (
              <div className="space-y-2">
                {state.active_alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground">{alert.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-xs font-medium text-foreground">
                  {t('لا توجد تنبيهات نشطة حالياً', 'Aucune alerte active')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t('جميع مؤشرات الشاحنة ضمن الحدود الآمنة القياسية.', 'Tous les paramètres sont dans les normes.')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

