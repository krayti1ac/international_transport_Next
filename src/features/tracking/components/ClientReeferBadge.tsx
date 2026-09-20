'use client';

import React from 'react';
import { useLanguage } from '@/components/language-provider';
import {
  Snowflake,
  ThermometerSnowflake,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Wifi,
} from 'lucide-react';

export interface ClientReeferBadgeProps {
  temperature?: number | null;
  cargoDescription?: string | null;
  hasRefrigeration?: boolean;
  className?: string;
  compact?: boolean;
}

export type ReeferCargoType = 'frozen' | 'fresh' | 'ambient';
export type ReeferComplianceStatus = 'optimal' | 'acceptable' | 'warning' | 'idle';

export function ClientReeferBadge({
  temperature,
  cargoDescription,
  hasRefrigeration = true,
  className = '',
  compact = false,
}: ClientReeferBadgeProps) {
  const { t, dir, locale } = useLanguage();

  const text = (cargoDescription || '').toLowerCase();
  const isExplicitFrozen = /أسماك|سمك|لحوم|مجمدات|تجميد|ثلاجة|surgel|congel|pescado|carne|frozen/i.test(text);
  const isExplicitFresh = /فواكه|خضار|طازج|أدوية|بواكير|primeurs|frais|fruits|légumes|legumes|fresco|verduras|frutas|fresh/i.test(text);

  let cargoType: ReeferCargoType = 'fresh';
  if (isExplicitFrozen || (typeof temperature === 'number' && temperature <= -10)) {
    cargoType = 'frozen';
  } else if (isExplicitFresh || (typeof temperature === 'number' && temperature > -10)) {
    cargoType = 'fresh';
  } else if (!hasRefrigeration) {
    cargoType = 'ambient';
  }

  // Determine compliance and status
  let status: ReeferComplianceStatus = 'idle';
  let targetRangeText = '';
  let statusMessageAr = '';
  let statusMessageFr = '';
  let statusMessageEs = '';

  if (typeof temperature === 'number') {
    if (cargoType === 'frozen') {
      targetRangeText = '-22°C ~ -18°C';
      if (temperature <= -17.5 && temperature >= -26) {
        status = 'optimal';
        statusMessageAr = 'ضمن النطاق المثالي للتجميد العميق';
        statusMessageFr = 'Plage optimale de surgélation profonde';
        statusMessageEs = 'Rango óptimo de ultracongelación';
      } else if (temperature <= -15 && temperature > -17.5) {
        status = 'acceptable';
        statusMessageAr = 'نطاق تبريد مقبول';
        statusMessageFr = 'Plage thermique tolérée';
        statusMessageEs = 'Rango térmico aceptable';
      } else {
        status = 'warning';
        statusMessageAr = 'تنبيه: تجاوز النطاق الحراري الآمن';
        statusMessageFr = 'Alerte: Dépassement du seuil thermique';
        statusMessageEs = 'Alerta: Exceso del límite térmico seguro';
      }
    } else if (cargoType === 'fresh') {
      targetRangeText = '+2°C ~ +6°C';
      if (temperature >= 2 && temperature <= 6) {
        status = 'optimal';
        statusMessageAr = 'ضمن النطاق المثالي للمنتجات الطازجة';
        statusMessageFr = 'Plage optimale pour produits frais';
        statusMessageEs = 'Rango óptimo para productos frescos';
      } else if ((temperature >= 0 && temperature < 2) || (temperature > 6 && temperature <= 8)) {
        status = 'acceptable';
        statusMessageAr = 'نطاق تبريد مقبول';
        statusMessageFr = 'Plage thermique sous tolérance';
        statusMessageEs = 'Rango térmico con tolerancia';
      } else {
        status = 'warning';
        statusMessageAr = 'تنبيه: حرارة خارج نطاق الأمان اللوجستي';
        statusMessageFr = 'Alerte: Température hors plage de sécurité';
        statusMessageEs = 'Alerta: Temperatura fuera del margen seguro';
      }
    } else {
      targetRangeText = t('شحن جاف / غير مبرد', 'Fret sec / non réfrigéré', 'Carga seca / no refrigerada');
      status = 'acceptable';
      statusMessageAr = 'بضائع عامة / شحن قياسي';
      statusMessageFr = 'Marchandise générale standard';
      statusMessageEs = 'Carga general estándar';
    }
  } else {
    status = 'idle';
    statusMessageAr = 'نظام التبريد قيد المزامنة الآلية';
    statusMessageFr = 'Télémesure thermique en cours de liaison';
    statusMessageEs = 'Telemetría térmica sincronizando';
  }

  const getStatusBadgeStyle = () => {
    switch (status) {
      case 'optimal':
        return {
          container: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          dot: 'bg-emerald-500',
          icon: CheckCircle2,
          borderGlow: 'shadow-emerald-500/10',
        };
      case 'acceptable':
        return {
          container: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
          dot: 'bg-blue-500',
          icon: Activity,
          borderGlow: 'shadow-blue-500/10',
        };
      case 'warning':
        return {
          container: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 animate-pulse',
          dot: 'bg-rose-500',
          icon: AlertTriangle,
          borderGlow: 'shadow-rose-500/20',
        };
      case 'idle':
      default:
        return {
          container: 'border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300',
          dot: 'bg-slate-400',
          icon: Wifi,
          borderGlow: '',
        };
    }
  };

  const style = getStatusBadgeStyle();
  const StatusIcon = style.icon;

  const statusLabel =
    locale === 'es' ? statusMessageEs : locale === 'fr' ? statusMessageFr : statusMessageAr;

  const cargoTypeLabel =
    cargoType === 'frozen'
      ? t('مجمدات (-18°C)', 'Surgelé (-18°C)', 'Congelado (-18°C)')
      : cargoType === 'fresh'
        ? t('طازج (+4°C)', 'Frais (+4°C)', 'Fresco (+4°C)')
        : t('شحن جاف', 'Fret sec', 'Carga seca');

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${style.container} ${className}`}
        dir={dir}
      >
        <ThermometerSnowflake className="w-4 h-4 text-cyan-500 shrink-0" />
        <span className="text-xs font-mono font-bold">
          {typeof temperature === 'number'
            ? `${temperature > 0 ? '+' : ''}${temperature.toFixed(1)}°C`
            : t('مستقر', 'Stable', 'Estable')}
        </span>
        <span className="text-[11px] font-semibold opacity-90 truncate max-w-[150px]">
          {statusLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-4 md:p-5 transition-all duration-300 shadow-sm ${style.container} ${style.borderGlow} ${className}`}
      dir={dir}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left / Start: Icon & Title & Reassurance */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30 shadow-xs">
            <ThermometerSnowflake className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border border-cyan-500/30 flex items-center gap-1">
                <Snowflake className="w-3 h-3" />
                <span>Cold-Chain Guard</span>
              </span>
              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                <span>{cargoTypeLabel}</span>
                {targetRangeText && (
                  <span className="text-[11px] font-mono text-muted-foreground">({targetRangeText})</span>
                )}
              </span>
            </div>

            <h3 className="text-sm md:text-base font-bold font-amiri text-foreground flex items-center gap-1.5">
              <span>
                {t(
                  'سلسلة التبريد تحت المراقبة الآلية المستمرة ❄️',
                  'Chaîne du froid sous surveillance automatisée ❄️',
                  'Cadena de frío bajo supervisión continua ❄️'
                )}
              </span>
            </h3>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('معتمد للمطابقة ATP / HACCP', 'Conforme aux normes ATP / HACCP', 'Conforme con normas ATP / HACCP')}</span>
              </span>
              <span>•</span>
              <span className="font-mono text-[11px]">
                {t('حساسات Thermo King IoT Telematics', 'Capteurs Thermo King IoT Telematics', 'Sensores Thermo King IoT Telematics')}
              </span>
            </p>
          </div>
        </div>

        {/* Right / End: Temperature Gauge & Status Pill */}
        <div className="flex items-center gap-3 self-start md:self-center bg-card/80 backdrop-blur-xs p-2.5 rounded-2xl border border-border/80 shadow-xs">
          <div className="text-center px-2">
            <span className="text-[10px] font-medium text-muted-foreground block uppercase">
              {t('درجة الحرارة اللحظية', 'Température Actuelle', 'Temperatura Actual')}
            </span>
            <span className="text-2xl md:text-3xl font-black font-mono tracking-tight text-foreground block">
              {typeof temperature === 'number' ? (
                <>
                  <span className={temperature < 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {temperature > 0 ? `+${temperature.toFixed(1)}` : temperature.toFixed(1)}
                  </span>
                  <span className="text-sm font-sans ms-0.5 text-muted-foreground">°C</span>
                </>
              ) : (
                <span className="text-base text-muted-foreground font-sans">
                  {t('قيد القراءة', 'En attente', 'En espera')}
                </span>
              )}
            </span>
          </div>

          <div className="h-10 w-px bg-border/80" />

          <div className="flex flex-col justify-center pe-1">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${style.dot} animate-ping`} />
              <StatusIcon className="w-4 h-4" />
              <span className="text-xs font-bold leading-tight">{statusLabel}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {status === 'optimal'
                ? t('ضمن المعايير 100%', 'Conformité 100%', 'Conformidad 100%')
                : status === 'warning'
                  ? t('خارج النطاق المثالي', 'Hors plage cible', 'Fuera de rango objetivo')
                  : t('استقرار حراري', 'Stabilité thermique', 'Estabilidad térmica')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

