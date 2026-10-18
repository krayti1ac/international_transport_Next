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
  Snowflake,
  FileText,
} from 'lucide-react';
import {
  getFleetTelematicsOverview,
  ingestFmsTelematicsPacket,
} from '../services/canbus-telematics.actions';
import type {
  TruckTelematicsState,
  TelematicsAlert,
} from '../types/telematics.types';

type SimulationType =
  | 'normal'
  | 'theft'
  | 'overheat'
  | 'defrost'
  | 'leak'
  | 'breach_claim';

export function CanBusTelematicsMonitor() {
  const { t, dir, locale } = useLanguage();
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
    let mounted = true;
    const fetchInitial = async () => {
      if (mounted) {
        await loadTelematics();
      }
    };
    void fetchInitial();
    // Auto refresh every 20 seconds
    const interval = setInterval(loadTelematics, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [loadTelematics]);

  // Simulate an incoming FMS Telemetry packet with Reefer / Gas / Claim triggers
  const handleSimulateFmsPacket = async (type: SimulationType) => {
    if (truckStates.length === 0) return;
    const target = truckStates[0];
    setSimulating(true);

    let fuelPercent = target.fuel_level_percent;
    let speed = 82;
    let coolant = 89;
    let reeferTemp = -18.2;
    let reeferMode: 'cooling' | 'defrost' | 'heating' | 'standby' | 'off' = 'cooling';
    let isDefrost = false;
    let defrostMins = 0;
    let refrigPressure = 14.5;
    let refrigLeak = false;
    let setpoint = -18.0;

    if (type === 'theft') {
      fuelPercent = Math.max(10, fuelPercent - 8.5); // Siphon drop
      speed = 0;
      coolant = 88;
    } else if (type === 'overheat') {
      coolant = 106;
      speed = 88;
    } else if (type === 'defrost') {
      speed = 78;
      coolant = 89;
      reeferTemp = 7.4; // Temperature warming up due to stuck heating elements
      reeferMode = 'defrost';
      isDefrost = true;
      defrostMins = 52; // Exceeds 45m threshold!
      refrigPressure = 15.1;
      setpoint = 4.0;
    } else if (type === 'leak') {
      speed = 80;
      coolant = 90;
      reeferTemp = 8.6;
      reeferMode = 'cooling';
      refrigPressure = 4.2; // Circuit pressure drop < 8 bar!
      refrigLeak = true;
      setpoint = 4.0;
    } else if (type === 'breach_claim') {
      speed = 75;
      coolant = 91;
      reeferTemp = 9.8; // Critical breach triggering automated insurance dossier
      reeferMode = 'cooling';
      refrigPressure = 4.0;
      refrigLeak = true;
      setpoint = 4.0;
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
        reefer_temp_c: reeferTemp,
        reefer_mode: reeferMode,
        is_defrost_active: isDefrost,
        defrost_duration_minutes: defrostMins,
        refrigerant_pressure_bar: refrigPressure,
        refrigerant_leak_detected: refrigLeak,
        cargo_setpoint_c: setpoint,
      });

      if (res.success) {
        if (res.claim) {
          toast({
            title: t(
              `🚨 تم فتح ملف مطالبة تأمين آلياً: ${res.claim.claimReference}`,
              `🚨 Dossier sinistre ouvert automatiquement : ${res.claim.claimReference}`,
              `🚨 ¡Expediente de seguro abierto automáticamente: ${res.claim.claimReference}!`
            ),
            description: t(
              `تعويض تقديري صافي: ${res.claim.netIndemnityAmount.toLocaleString()} MAD (كسر سلسلة التبريد)`,
              `Indemnité nette estimée : ${res.claim.netIndemnityAmount.toLocaleString()} MAD (Rupture chaîne du froid)`,
              `Indemnización neta estimada: ${res.claim.netIndemnityAmount.toLocaleString()} MAD (Rotura cadena de frío)`
            ),
            variant: 'destructive',
          });
        } else {
          toast({
            title: t('تم استقبال حزمة CAN-Bus جديدة', 'Paquet CAN-Bus reçu', 'Paquete CAN-Bus recibido'),
            description:
              res.alerts.length > 0
                ? t(
                    `تم رصد ${res.alerts.length} إنذار تشغيلي!`,
                    `${res.alerts.length} alerte(s) détectée(s)!`,
                    `¡Se detectaron ${res.alerts.length} alertas operativas!`
                  )
                : t(
                    'الحالة الميكانيكية والوقود وسلسلة التبريد ضمن المعدلات الطبيعية',
                    'Paramètres FMS et frigo normaux',
                    'Parámetros FMS y de refrigeración normales'
                  ),
            variant: res.alerts.length > 0 ? 'destructive' : 'default',
          });
        }
        await loadTelematics();
      }
    } finally {
      setSimulating(false);
    }
  };

  const reeferExcursionCount = truckStates.filter(
    (s) => (s.reefer_temp_c !== undefined && s.reefer_temp_c > 4.0) || s.refrigerant_leak_detected
  ).length;

  return (
    <div className="space-y-6" dir={dir}>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('شاحنات متصلة بنظام FMS', 'Camions connectés FMS', 'Camiones conectados FMS')}</p>
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
              <p className="text-xs text-muted-foreground">{t('إنذارات حرجة (سرقة/حرارة)', 'Alertes critiques', 'Alertas críticas')}</p>
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
              <p className="text-xs text-muted-foreground">{t('متوسط مستوى خزانات الأسطول', 'Niveau moyen carburant', 'Nivel medio combustible')}</p>
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
              <p className="text-xs text-muted-foreground">{t('رقابة التبريد والتسريب', 'Veille Frigo & Gaz', 'Vigilancia Frigorífica y Gas')}</p>
              <p
                className={`text-xl font-bold font-mono mt-1 ${
                  reeferExcursionCount > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {reeferExcursionCount > 0
                  ? t(`${reeferExcursionCount} شذوذ`, `${reeferExcursionCount} écart(s)`, `${reeferExcursionCount} desvío(s)`)
                  : t('آمن 100%', '100% Conforme', '100% Seguro')}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                reeferExcursionCount > 0
                  ? 'bg-rose-500/10 text-rose-600'
                  : 'bg-cyan-500/10 text-cyan-600'
              }`}
            >
              <Snowflake className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('حالة بروتوكول SAE J1939', 'Protocole CAN J1939', 'Protocolo CAN J1939')}</p>
              <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('بث حي نشط', 'Flux direct actif', 'Flujo directo activo')}
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
            {t(
              'أدوات محاكاة فحص التبريد وكمبيوتر الشاحنة:',
              'Simulateur télématique CAN-Bus & Groupe Frigo :',
              'Simulador telemático CAN-Bus y Equipo Frigorífico:'
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={simulating || truckStates.length === 0}
            onClick={() => handleSimulateFmsPacket('normal')}
            className="rounded-xl text-xs h-8 gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            {t('قيادة عادية', 'Normal', 'Normal')}
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
            {t('سرقة وقود', 'Vol carburant', 'Robo combustible')}
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
            {t('سخونة محرك', 'Surchauffe', 'Sobrecalentamiento')}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={simulating || truckStates.length === 0}
            onClick={() => handleSimulateFmsPacket('defrost')}
            className="rounded-xl text-xs h-8 gap-1.5 text-orange-600 border-orange-500/30 hover:bg-orange-500/10"
          >
            <Flame className="w-3.5 h-3.5" />
            {t('عطل إذابة جليد (>45د)', 'Defrost bloqué', 'Desescarche bloqueado')}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={simulating || truckStates.length === 0}
            onClick={() => handleSimulateFmsPacket('leak')}
            className="rounded-xl text-xs h-8 gap-1.5 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
          >
            <Wind className="w-3.5 h-3.5" />
            {t('تسرب غاز التبريد', 'Fuite gaz frigo', 'Fuga refrigerante')}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={simulating || truckStates.length === 0}
            onClick={() => handleSimulateFmsPacket('breach_claim')}
            className="rounded-xl text-xs h-8 gap-1.5 bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/25 font-bold"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {t('كسر تبريد + فتح مطالبة تأمين', 'Sinistre Frigo + Auto-Claim', 'Siniestro Frío + Auto-Reclamación')}
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
              <span>
                {t(
                  'تنبيهات استشعار الشذوذ الحية (Active Telematics & Reefer Alerts)',
                  'Alertes Télématiques & Frigo Actives',
                  'Alertas Telemáticas y Frigoríficas Activas'
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-background/80 border border-rose-500/20 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        a.severity === 'critical'
                          ? 'bg-rose-500/15 text-rose-600 border-rose-500/30 font-bold'
                          : 'bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold'
                      }
                    >
                      {a.severity === 'critical'
                        ? t('حرج جداً', 'Critique', 'Crítico')
                        : t('تحذير', 'Avertissement', 'Advertencia')}
                    </Badge>
                    <span className="font-bold text-foreground font-mono">{a.truck_plate}</span>
                    <span className="text-muted-foreground text-[11px]">{a.timestamp}</span>
                  </div>
                  <p className="font-semibold text-rose-700 dark:text-rose-300">
                    {locale === 'ar' ? a.title : locale === 'es' ? (a.title_es || a.title_fr) : a.title_fr}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {locale === 'ar' ? a.description : locale === 'es' ? (a.description_es || a.description_fr) : a.description_fr}
                  </p>

                  {/* Automated Insurance Claim Banner */}
                  {a.metrics.claim_reference && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
                      <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 font-mono">
                        {t('ملف مطالبة تأمين معتمد:', 'Dossier d\'indemnisation :', 'Expediente de indemnización:')}{' '}
                        {a.metrics.claim_reference}
                      </span>
                      {a.metrics.gross_loss_estimate && (
                        <Badge variant="outline" className="font-mono text-[10px] bg-rose-500/20 text-rose-700 border-rose-500/40">
                          {t('خسارة تقديرية:', 'Perte estimée :', 'Pérdida estimada:')}{' '}
                          {a.metrics.gross_loss_estimate.toLocaleString()} MAD
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0 font-mono text-xs">
                  {a.metrics.fuel_drop_liters && (
                    <Badge variant="destructive">-{a.metrics.fuel_drop_liters} L</Badge>
                  )}
                  {a.metrics.defrost_duration_minutes !== undefined && (
                    <Badge variant="outline" className="text-orange-600 border-orange-500/30 bg-orange-500/10">
                      {a.metrics.defrost_duration_minutes} min defrost
                    </Badge>
                  )}
                  {a.metrics.refrigerant_pressure_bar !== undefined && (
                    <Badge variant="outline" className="text-rose-600 border-rose-500/30 bg-rose-500/10">
                      {a.metrics.refrigerant_pressure_bar} bar
                    </Badge>
                  )}
                </div>
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
            <span>
              {t(
                'قراءات كمبيوتر المحرك ووحدة التبريد المباشرة (CAN-Bus ECU & Reefer Telemetry)',
                'Télémétrie ECU & Groupe Frigo Directe',
                'Telemetría Directa ECU y Frigorífico'
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('جاري مزامنة قراءات الـ FMS والمستشعرات...', 'Synchronisation FMS & Frigo en cours...', 'Sincronizando FMS y sensores...')}
            </div>
          ) : truckStates.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('لا توجد شاحنات مسجلة في الأسطول.', 'Aucun camion enregistré.', 'Ningún camión registrado.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="py-3 px-4 text-start font-semibold">{t('الشاحنة', 'Camion', 'Camión')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('مستوى الخزان', 'Niveau Réservoir', 'Nivel Depósito')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('حرارة المحرك', 'Température Moteur', 'Temperatura Motor')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('مقطورة التبريد والغاز', 'Frigo & Gaz Réfrigérant', 'Frigorífico y Refrigerante')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('السرعة ودورات المحرك', 'Vitesse & RPM', 'Velocidad y RPM')}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t('الحالة الصحية', 'Santé Moteur', 'Salud Motor')}</th>
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
                            ? t('خطر سخونة مفرطة', 'Surchauffe', 'Sobrecalentamiento')
                            : t('نطاق تشغيلي آمن', 'Normal', 'Normal')}
                        </p>
                      </td>

                      {/* Reefer & Refrigerant Telematics Column */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono">
                            <Snowflake
                              className={`w-3.5 h-3.5 ${
                                st.reefer_temp_c !== undefined && st.reefer_temp_c > 4.0
                                  ? 'text-rose-600'
                                  : st.reefer_temp_c !== undefined && st.reefer_temp_c < -10
                                  ? 'text-cyan-600'
                                  : 'text-emerald-600'
                              }`}
                            />
                            <span
                              className={`font-bold ${
                                st.reefer_temp_c !== undefined && st.reefer_temp_c > 4.0
                                  ? 'text-rose-600'
                                  : st.reefer_temp_c !== undefined && st.reefer_temp_c < -10
                                  ? 'text-cyan-600'
                                  : 'text-foreground'
                              }`}
                            >
                              {st.reefer_temp_c !== undefined ? `${st.reefer_temp_c.toFixed(1)}°C` : '--'}
                            </span>

                            {/* Reefer Mode Badge */}
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 h-4 font-semibold ${
                                st.reefer_mode === 'defrost' || st.is_defrost_active
                                  ? st.defrost_duration_minutes && st.defrost_duration_minutes > 45
                                    ? 'bg-rose-500/15 text-rose-700 border-rose-500/30'
                                    : 'bg-orange-500/15 text-orange-700 border-orange-500/30'
                                  : st.reefer_mode === 'cooling'
                                  ? 'bg-cyan-500/15 text-cyan-700 border-cyan-500/30'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {st.reefer_mode === 'defrost' || st.is_defrost_active
                                ? t(`إذابة جليد (${st.defrost_duration_minutes ?? 0}د)`, `Dégivrage (${st.defrost_duration_minutes ?? 0}m)`, `Desescarche (${st.defrost_duration_minutes ?? 0}m)`)
                                : st.reefer_mode === 'cooling'
                                ? t('تبريد', 'Froid', 'Frío')
                                : t('متوقف', 'Veille', 'Espera')}
                            </Badge>
                          </div>

                          {/* Refrigerant Circuit Pressure Reading */}
                          <div className="flex items-center gap-1 text-[10px] font-mono">
                            <span className="text-muted-foreground">{t('الضغط:', 'Pression :', 'Presión:')}</span>
                            <span
                              className={`font-semibold ${
                                st.refrigerant_leak_detected || (st.refrigerant_pressure_bar !== undefined && st.refrigerant_pressure_bar < 8.0)
                                  ? 'text-rose-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {st.refrigerant_pressure_bar !== undefined ? `${st.refrigerant_pressure_bar.toFixed(1)} bar` : '14.5 bar'}
                            </span>
                            {(st.refrigerant_leak_detected || (st.refrigerant_pressure_bar !== undefined && st.refrigerant_pressure_bar < 8.0)) && (
                              <span className="text-[9px] text-rose-600 font-bold">
                                {t('(تسريب!)', '(Fuite!)', '(¡Fuga!)')}
                              </span>
                            )}
                          </div>

                          {/* Active Insurance Claim Reference */}
                          {st.active_claim_reference && (
                            <div className="flex items-center gap-1 text-[9px] font-mono text-primary font-bold">
                              <FileText className="w-2.5 h-2.5" />
                              <span>{st.active_claim_reference}</span>
                            </div>
                          )}
                        </div>
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
                            ? t('خطر حرج', 'Critique', 'Crítico')
                            : st.engine_health === 'warning'
                            ? t('تحذير', 'Avertissement', 'Advertencia')
                            : t('سليم ومثالي', 'Optimal', 'Óptimo')}
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
