'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useToast } from '@/hooks/use-toast';
import {
  Gauge,
  Activity,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Thermometer,
  Zap,
  RefreshCw,
  Droplet,
  Truck,
  Wind,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import {
  getFleetTelematicsOverview,
  ingestFmsTelematicsPacket,
} from '../services/canbus-telematics.actions';
import type {
  TruckTelematicsState,
  TelematicsAlert,
} from '../types/telematics.types';

export function CanBusTelematicsMonitor() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [truckStates, setTruckStates] = useState<TruckTelematicsState[]>([]);
  const [alerts, setAlerts] = useState<TelematicsAlert[]>([]);
  const [summary, setSummary] = useState({
    totalMonitored: 0,
    criticalAlertsCount: 0,
    warningAlertsCount: 0,
    averageFuelLevelPercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const loadTelematics = useCallback(async () => {
    try {
      const data = await getFleetTelematicsOverview();
      setTruckStates(data.truckStates);
      setAlerts(data.activeAlerts);
      setSummary(data.summary);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTelematics();
    // Auto refresh every 20 seconds
    const interval = setInterval(loadTelematics, 20000);
    return () => clearInterval(interval);
  }, [loadTelematics]);

  // Simulate an incoming FMS Telemetry packet
  const handleSimulateFmsPacket = async (type: 'normal' | 'theft' | 'overheat') => {
    if (truckStates.length === 0) return;
    const target = truckStates[0];
    setSimulating(true);

    let fuelPercent = target.fuel_level_percent;
    let speed = 82;
    let coolant = 89;

    if (type === 'theft') {
      fuelPercent = Math.max(10, fuelPercent - 8.5); // Siphon drop
      speed = 0;
    } else if (type === 'overheat') {
      coolant = 106;
      speed = 88;
    }

    try {
      const res = await ingestFmsTelematicsPacket({
        truck_plate: target.plate_number,
        latitude: 35.7595,
        longitude: -5.834,
        speed_kmh: speed,
        fuel_level_percent: fuelPercent,
        engine_speed_rpm: speed > 0 ? 1520 : 600,
        engine_coolant_temp_c: coolant,
        odometer_km: 192300,
        reefer_temp_c: -18.2,
      });

      if (res.success) {
        toast({
          title: t('تم استقبال حزمة CAN-Bus جديدة', 'Paquet CAN-Bus reçu'),
          description:
            res.alerts.length > 0
              ? t(`تم رصد ${res.alerts.length} إنذار تشغيلي!`, `${res.alerts.length} alerte(s) détectée(s)!`)
              : t('الحالة الميكانيكية والوقود ضمن المعدلات الطبيعية', 'Paramètres FMS normaux'),
          variant: res.alerts.length > 0 ? 'destructive' : 'default',
        });
        await loadTelematics();
      }
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('شاحنات متصلة بنظام FMS', 'Camions connectés FMS')}</p>
              <p className="text-xl font-bold font-mono text-foreground mt-1 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                {summary.totalMonitored}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('إنذارات حرجة (سرقة/حرارة)', 'Alertes critiques')}</p>
              <p className="text-xl font-bold font-mono text-rose-600 mt-1">
                {summary.criticalAlertsCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('متوسط مستوى خزانات الأسطول', 'Niveau moyen carburant')}</p>
              <p className="text-xl font-bold font-mono text-foreground mt-1" dir="ltr">
                {summary.averageFuelLevelPercent}%
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Droplet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('حالة بروتوكول SAE J1939', 'Protocole CAN J1939')}</p>
              <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('بث حي نشط', 'Flux direct actif')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar & Simulation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {t('أدوات محاكاة فحص أجهزة التتبع وكمبيوتر الشاحنة:', 'Simulateur télématique FMS / CAN-Bus :')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={simulating || truckStates.length === 0}
            onClick={() => handleSimulateFmsPacket('normal')}
            className="rounded-xl text-xs h-8 gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            {t('محاكاة قيادة عادية', 'Signal FMS normal')}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={simulating || truckStates.length === 0}
            onClick={() => handleSimulateFmsPacket('theft')}
            className="rounded-xl text-xs h-8 gap-1.5 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
          >
            <Droplet className="w-3.5 h-3.5" />
            {t('محاكاة سحب/سرقة وقود', 'Test alerte siphonnage')}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={simulating || truckStates.length === 0}
            onClick={() => handleSimulateFmsPacket('overheat')}
            className="rounded-xl text-xs h-8 gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
          >
            <Thermometer className="w-3.5 h-3.5" />
            {t('محاكاة حرارة محرك عالية', 'Test surchauffe')}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={loadTelematics}
            className="rounded-xl text-xs h-8 px-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Active Alerts Stream */}
      {alerts.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5 shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-rose-500/20">
            <CardTitle className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{t('تنبيهات استشعار الشذوذ الحية (Active Telematics Alerts)', 'Alertes Télématiques Actives')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-background/80 border border-rose-500/20 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        a.severity === 'critical'
                          ? 'bg-rose-500/15 text-rose-600 border-rose-500/30 font-bold'
                          : 'bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold'
                      }
                    >
                      {a.severity === 'critical' ? t('حرج جداً', 'Critique') : t('تحذير', 'Avertissement')}
                    </Badge>
                    <span className="font-bold text-foreground font-mono">{a.truck_plate}</span>
                    <span className="text-muted-foreground text-[11px]">{a.timestamp}</span>
                  </div>
                  <p className="font-semibold text-rose-700 dark:text-rose-300">
                    {dir === 'rtl' ? a.title : a.title_fr}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {dir === 'rtl' ? a.description : a.description_fr}
                  </p>
                </div>
                {a.metrics.fuel_drop_liters && (
                  <Badge variant="destructive" className="font-mono text-xs shrink-0">
                    -{a.metrics.fuel_drop_liters} L
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Live Telematics Fleet Table */}
      <Card className="border border-border shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span>{t('قراءات كمبيوتر المحرك المباشرة (Live CAN-Bus ECU Telemetry)', 'Télémétrie ECU Directe')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('جاري مزامنة قراءات الـ FMS...', 'Synchronisation FMS en cours...')}
            </div>
          ) : truckStates.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('لا توجد شاحنات مسجلة في الأسطول.', 'Aucun camion enregistré.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="py-3 px-4 text-start font-semibold">{t('الشاحنة', 'Camion')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('مستوى الخزان', 'Niveau Réservoir')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('حرارة المحرك', 'Température Moteur')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('السرعة ودورات المحرك', 'Vitesse & RPM')}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t('الحالة الصحية', 'Santé Moteur')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {truckStates.map((st) => (
                    <tr key={st.truck_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <MatriculeBadge plate={st.plate_number} variant="badge" size="sm" />
                        <p className="text-[11px] text-muted-foreground mt-0.5">{st.model}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-semibold text-foreground">{st.fuel_level_percent}%</span>
                            <span className="text-muted-foreground">{st.fuel_liters_est} L</span>
                          </div>
                          <div className="w-28 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                st.fuel_level_percent < 20
                                  ? 'bg-rose-500'
                                  : st.fuel_level_percent < 40
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${st.fuel_level_percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Thermometer
                            className={`w-3.5 h-3.5 ${
                              st.engine_coolant_temp_c >= 104
                                ? 'text-rose-600'
                                : st.engine_coolant_temp_c >= 98
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          />
                          <span
                            className={`font-semibold ${
                              st.engine_coolant_temp_c >= 104
                                ? 'text-rose-600'
                                : st.engine_coolant_temp_c >= 98
                                ? 'text-amber-600'
                                : 'text-foreground'
                            }`}
                          >
                            {st.engine_coolant_temp_c}°C
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {st.engine_coolant_temp_c >= 104
                            ? t('خطر سخونة مفرطة', 'Surchauffe')
                            : t('نطاق تشغيلي آمن', 'Normal')}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono font-semibold text-foreground">
                          {Math.round(st.speed_kmh)} km/h
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {st.engine_rpm} RPM
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            st.engine_health === 'critical'
                              ? 'bg-rose-500/15 text-rose-600'
                              : st.engine_health === 'warning'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-emerald-500/15 text-emerald-600'
                          }`}
                        >
                          {st.engine_health === 'critical'
                            ? t('خطر حرج', 'Critique')
                            : st.engine_health === 'warning'
                            ? t('تحذير', 'Avertissement')
                            : t('سليم ومثالي', 'Optimal')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

