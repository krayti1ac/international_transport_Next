'use client';

import React from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  ParsedFrigoIoTData,
  ReeferAlarmCode,
  ReeferAnomaly,
} from '../types/frigo-iot.types';
import {
  Snowflake,
  Gauge,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Wrench,
  Thermometer,
  RotateCw,
  Clock,
  Battery,
  BatteryWarning,
  Flame,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface ReeferTelemetryCardProps {
  iotData: ParsedFrigoIoTData;
  compact?: boolean;
  className?: string;
  onAcknowledgeAlarm?: (alarmCode: string) => void;
}

export function ReeferTelemetryCard({
  iotData,
  compact = false,
  className = '',
  onAcknowledgeAlarm,
}: ReeferTelemetryCardProps) {
  const { t, locale, dir } = useLanguage();

  // Localized alarm description helper
  const getAlarmDescription = (alarm: ReeferAlarmCode): string => {
    if (locale === 'fr') return alarm.descriptionFr;
    if (locale === 'es') return alarm.descriptionEs;
    return alarm.descriptionAr;
  };

  const getAlarmRemedy = (alarm: ReeferAlarmCode): string | undefined => {
    if (locale === 'fr') return alarm.remedyFr;
    if (locale === 'es') return alarm.remedyEs;
    return alarm.remedyAr;
  };

  const getAnomalyTitle = (anomaly: ReeferAnomaly): string => {
    if (locale === 'fr') return anomaly.titleFr;
    if (locale === 'es') return anomaly.titleEs;
    return anomaly.titleAr;
  };

  const getAnomalyMessage = (anomaly: ReeferAnomaly): string => {
    if (locale === 'fr') return anomaly.messageFr;
    if (locale === 'es') return anomaly.messageEs;
    return anomaly.messageAr;
  };

  const isCarrier = iotData.unitBrand === 'carrier';
  const isThermoKing = iotData.unitBrand === 'thermo_king';

  const brandTitle = isCarrier
    ? 'Carrier Transicold (Vector)'
    : isThermoKing
    ? 'Thermo King (SLXi / Advancer)'
    : 'Generic Reefer IoT';

  // Mode localized labels
  const modeLabel =
    iotData.operatingMode === 'continuous'
      ? t('تشغيل مستمر (Continuous)', 'Continu (Continuous)', 'Continuo (Continuous)')
      : iotData.operatingMode === 'cycle_sentry'
      ? t('دورة ذكية (Start/Stop Sentry)', 'Cycle-Sentry (Start/Stop)', 'Cycle-Sentry (Start/Stop)')
      : iotData.operatingMode === 'electric_standby'
      ? t('توصيل كهربائي (Electric Standby)', 'Veille Électrique', 'Reserva Eléctrica')
      : t('متوقف (Off)', 'Arrêté (Off)', 'Apagado (Off)');

  // SDI Gauge color
  const sdiColorClass =
    iotData.sdiStatus === 'optimal'
      ? 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10'
      : iotData.sdiStatus === 'degraded'
      ? 'text-amber-500 border-amber-500/40 bg-amber-500/10'
      : 'text-rose-500 border-rose-500/40 bg-rose-500/10 animate-pulse';

  const sdiBadge =
    iotData.sdiStatus === 'optimal'
      ? t('استقرار تام', 'Optimal', 'Óptimo')
      : iotData.sdiStatus === 'degraded'
      ? t('تدهور طفيف', 'Dégradé', 'Degradado')
      : t('خطر حرج', 'Critique', 'Crítico');

  return (
    <Card
      dir={dir}
      className={`border-2 transition-all shadow-md bg-card text-card-foreground ${
        iotData.sdiStatus === 'critical'
          ? 'border-rose-500/70 shadow-rose-500/10'
          : iotData.sdiStatus === 'degraded'
          ? 'border-amber-500/60 shadow-amber-500/10'
          : 'border-cyan-500/40 shadow-cyan-500/5'
      } ${className}`}
    >
      <CardHeader className="p-4 pb-2 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Brand & Model */}
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                isCarrier
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : isThermoKing
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30'
              }`}
            >
              <Snowflake className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm font-mono tracking-tight">
                  {brandTitle}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0 border-border/80"
                >
                  {iotData.model}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {iotData.truckPlate} {iotData.trailerPlate ? `• [${iotData.trailerPlate}]` : ''}
              </p>
            </div>
          </div>

          {/* SDI Score & Mode Badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[11px] font-medium px-2 py-0.5 bg-muted/50 border-border"
            >
              <RotateCw className="w-3 h-3 me-1 text-primary animate-spin-slow" />
              {modeLabel}
            </Badge>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-mono font-black text-xs ${sdiColorClass}`}
              title={t(
                'مؤشر استقرار التبريد (Stability Degradation Index)',
                'Indice de Dégradation de Stabilité',
                'Índice de Degradación de Estabilidad'
              )}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>SDI: {iotData.sdiScore}%</span>
              <span className="text-[10px] font-sans font-bold">({sdiBadge})</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Row 1: Temperatures & Thermal Integrity */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-border/60">
            <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-cyan-500" />
              {t('الحرارة الفعلية', 'Température Actuelle', 'Temperatura Actual')}
            </span>
            <div className="text-xl font-black font-mono mt-1 text-cyan-600 dark:text-cyan-400">
              {iotData.currentTemp > 0 ? `+${iotData.currentTemp}` : iotData.currentTemp}°C
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-border/60">
            <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
              <Gauge className="w-3 h-3 text-primary" />
              {t('ضبط الضبط (Setpoint)', 'Consigne Cible', 'Consigna')}
            </span>
            <div className="text-xl font-black font-mono mt-1 text-foreground">
              {iotData.targetTemp > 0 ? `+${iotData.targetTemp}` : iotData.targetTemp}°C
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-border/60">
            <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
              <Activity className="w-3 h-3 text-amber-500" />
              {t('الانحراف الحراري', 'Écart Thermique', 'Desviación Térmica')}
            </span>
            <div
              className={`text-xl font-black font-mono mt-1 ${
                iotData.tempDeviation > 2.0
                  ? 'text-rose-600 dark:text-rose-400'
                  : iotData.tempDeviation > 1.0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              ±{iotData.tempDeviation}°C
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-border/60">
            <span className="text-[10px] text-muted-foreground block font-medium flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              {t('الجو المحيط (Ambient)', 'Temp. Ambiante', 'Temp. Ambiente')}
            </span>
            <div className="text-xl font-black font-mono mt-1 text-muted-foreground">
              +{iotData.ambientTemp}°C
            </div>
          </div>
        </div>

        {/* Row 2: CAN-Bus Refrigerant Pressures (Suction vs Discharge) */}
        <div className="p-3 rounded-xl bg-background border border-border/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-foreground">
              <Gauge className="w-4 h-4 text-blue-500" />
              {t(
                'دارة التبريد والضغوط (Refrigerant Circuit)',
                'Circuit Frigorifique & Pressions',
                'Circuito Frigorífico y Presiones'
              )}
            </span>
            <Badge
              variant={
                iotData.pressureStatus === 'critical'
                  ? 'destructive'
                  : iotData.pressureStatus === 'warning'
                  ? 'secondary'
                  : 'outline'
              }
              className="text-[10px] font-mono"
            >
              {iotData.pressureStatus === 'optimal'
                ? t('ضغوط مثالية', 'Optimal', 'Óptimo')
                : iotData.pressureStatus === 'warning'
                ? t('تحذير ضغط', 'Avertissement', 'Advertencia')
                : t('خطر تسريب / ضغط حرج', 'Fuite / Critique', 'Fuga / Crítico')}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {/* Suction Pressure */}
            <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t('ضغط السحب (Suction)', 'Aspiration (LP)', 'Aspiración (BP)')}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  (1.2 - 2.8 Bar)
                </span>
              </div>
              <div
                className={`text-lg font-black font-mono mt-0.5 ${
                  iotData.suctionPressureBar < 0.9
                    ? 'text-rose-600 font-extrabold animate-pulse'
                    : 'text-foreground'
                }`}
              >
                {iotData.suctionPressureBar.toFixed(2)} Bar
              </div>
            </div>

            {/* Discharge Pressure */}
            <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t('ضغط الطرد (Discharge)', 'Refoulement (HP)', 'Descarga (AP)')}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  (11.0 - 22.0 Bar)
                </span>
              </div>
              <div
                className={`text-lg font-black font-mono mt-0.5 ${
                  iotData.dischargePressureBar < 10.0 || iotData.dischargePressureBar > 23.0
                    ? 'text-rose-600 font-extrabold'
                    : 'text-foreground'
                }`}
              >
                {iotData.dischargePressureBar.toFixed(2)} Bar
              </div>
            </div>

            {/* Compression Ratio */}
            <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {t('نسبة الانضغاط (HP/LP)', 'Taux Compression', 'Ratio Compresión')}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">(6.0 - 12.0)</span>
              </div>
              <div
                className={`text-lg font-black font-mono mt-0.5 ${
                  iotData.compressionRatio < 4.5 || iotData.compressionRatio > 14.0
                    ? 'text-amber-600 font-extrabold'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {iotData.compressionRatio.toFixed(1)}:1
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Defrost Cycle & Auxiliaries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Defrost Module */}
          <div className="p-2.5 rounded-xl bg-background border border-border/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
                {t('دورة إذابة الصقيع (Defrost)', 'Cycle de Dégivrage', 'Ciclo Desescarche')}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  iotData.defrostStatus === 'overrun_critical'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                    : iotData.defrostStatus === 'overrun_warning'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : iotData.defrostActive
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {iotData.defrostActive
                  ? iotData.defrostStatus === 'overrun_critical'
                    ? t('تجاوز حرج للوقت (>45د)', 'Overrun Critique', 'Superación Crítica')
                    : t('إذابة نشطة الآن', 'Dégivrage Actif', 'Desescarche Activo')
                  : t('خامل (Idle)', 'Inactif', 'Inactivo')}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-0.5">
              <span>
                {t('المدة', 'Durée', 'Duración')}:{' '}
                <strong className="text-foreground">{iotData.defrostDurationMin} min</strong>
              </span>
              <span>
                {t('حرارة الوشيعة', 'Sonde Batterie', 'Sonda Batería')}:{' '}
                <strong className="text-foreground">
                  {iotData.defrostCoilTemp > 0
                    ? `+${iotData.defrostCoilTemp}`
                    : iotData.defrostCoilTemp}
                  °C
                </strong>
              </span>
            </div>
          </div>

          {/* Electrical & Auxiliaries */}
          <div className="p-2.5 rounded-xl bg-background border border-border/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                {t('النظام الكهربائي والضاغط', 'Électrique & Compresseur', 'Eléctrico y Compresor')}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  iotData.batteryStatus === 'critical'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : iotData.batteryStatus === 'low'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {iotData.backupBatteryVdc.toFixed(1)} VDC
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-0.5">
              <span>
                {t('دوران الضاغط', 'Régime Compresseur', 'Régimen')}:{' '}
                <strong className="text-foreground">{iotData.compressorRpm} RPM</strong>
              </span>
              <span>
                {t('ساعات التشغيل', 'Heures Moteur', 'Horas Motor')}:{' '}
                <strong className="text-foreground">{iotData.engineHours} h</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Row 4: Active Technical Alarms & Anomalies Banner */}
        {iotData.anomalies.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 animate-bounce" />
              {t(
                'الخلل المرصود بواسطة المحرك الذكي (Anomalies Détectées)',
                'Anomalies Détectées en Temps Réel',
                'Anomalías Detectadas en Tiempo Real'
              )}
            </span>
            <div className="space-y-1.5">
              {iotData.anomalies.map((anom, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                    anom.severity === 'critical'
                      ? 'bg-rose-500/10 border-rose-500/50 text-rose-800 dark:text-rose-200'
                      : 'bg-amber-500/10 border-amber-500/50 text-amber-800 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{getAnomalyTitle(anom)}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/80">
                      {anom.detectedValue} (معيار: {anom.thresholdValue})
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {getAnomalyMessage(anom)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Official Alarm Codes Catalog */}
        {iotData.alarms.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-primary" />
              {t('أكواد الأعطال الفنية الرسمية', 'Codes d’Alarme Constructeur', 'Códigos de Alarma Fabricante')}
            </span>
            <div className="space-y-2">
              {iotData.alarms.map((alarm) => {
                const desc = getAlarmDescription(alarm);
                const remedy = getAlarmRemedy(alarm);

                return (
                  <div
                    key={alarm.code}
                    className="p-2.5 rounded-xl bg-muted/40 border border-border/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={alarm.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="font-mono font-black text-xs px-2 py-0.5"
                        >
                          {alarm.code}
                        </Badge>
                        <span className="font-bold text-foreground">{desc}</span>
                      </div>
                      {onAcknowledgeAlarm && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => onAcknowledgeAlarm(alarm.code)}
                        >
                          {t('تأكيد الاستلام', 'Acquitter', 'Reconocer')}
                        </Button>
                      )}
                    </div>
                    {remedy && (
                      <div className="text-[11px] text-muted-foreground bg-background/70 p-2 rounded-lg border border-border/60">
                        <strong className="text-foreground">
                          {t('الإجراء الفني الموصى به:', 'Procédure recommandée :', 'Procedimiento recomendado :')}
                        </strong>{' '}
                        {remedy}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Safe State Confirmation if No Alarms */}
        {iotData.alarms.length === 0 && iotData.anomalies.length === 0 && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {t(
                'كافة مؤشرات دارة التبريد والضغوط ونظام الطاقة تعمل ضمن المعايير المصنعية المعتمدة.',
                'Tous les paramètres de réfrigération sont conformes aux spécifications constructeur.',
                'Todos los parámetros de refrigeración cumplen las especificaciones del fabricante.'
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

