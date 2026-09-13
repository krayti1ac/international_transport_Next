'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  Fuel,
  Gauge,
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { FuelAuditResult } from '../services/fuel-fraud-detector.actions';
import { useLanguage } from '@/components/language-provider';

interface FuelFraudAuditBadgeProps {
  audit: FuelAuditResult | null;
  size?: 'sm' | 'md' | 'lg';
  showDetailsButton?: boolean;
}

export function FuelFraudAuditBadge({ audit, size = 'md', showDetailsButton = true }: FuelFraudAuditBadgeProps) {
  const { t, dir } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  if (!audit) return null;

  const { trustScore, rating, anomalies, isClean } = audit;

  let badgeVariant = 'default';
  let badgeColor = '';
  let badgeIcon = <ShieldCheck className="w-3.5 h-3.5" />;
  let label = '';

  if (rating === 'trustworthy') {
    badgeColor = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25';
    badgeIcon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;
    label = t(`موثوق ${trustScore}%`, `Fiable ${trustScore}%`);
  } else if (rating === 'warning') {
    badgeColor = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25';
    badgeIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
    label = t(`تنبيه تدقيق (${trustScore}%)`, `Alerte audit (${trustScore}%)`);
  } else {
    badgeColor = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25 animate-pulse';
    badgeIcon = <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />;
    label = t(`اشتباه احتيال (${trustScore}%)`, `Suspicion fraude (${trustScore}%)`);
  }

  const textSize = size === 'sm' ? 'text-[10px] px-2 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1';

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full font-bold border transition-all cursor-pointer ${badgeColor} ${textSize}`}
          title={t('انقر لعرض تفاصيل التدقيق الجغرافي ومكافحة الاحتيال', 'Cliquer pour voir les détails d\'audit géolocalisé')}
        >
          {badgeIcon}
          <span>{label}</span>
        </button>

        {showDetailsButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-6 px-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t('تفاصيل الفحص', 'Détails')}
          </Button>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl" dir={dir}>
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{t('نظام الفحص الثلاثي ومكافحة الاحتيال اللوجستي', 'Système d\'Audit Triangulaire Anti-Fraude')}</span>
            </div>
            <DialogTitle className="text-lg font-bold font-amiri flex items-center justify-between">
              <span>{t('تقرير تدقيق سند الوقود والتحقق الجغرافي', 'Rapport d\'audit du carburant et géolocalisation')}</span>
              <span
                className={`font-mono text-xs px-2.5 py-0.5 rounded-full border ${badgeColor}`}
              >
                {trustScore}% {rating === 'trustworthy' ? t('موثوق', 'Fiable') : rating === 'warning' ? t('تحذير', 'Avertissement') : t('مشتبه به', 'Suspect')}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t(
                'نتائج المطابقة التلقائية لموقع المحطة مع مسار الشاحنة (GPS)، وسعة الخزان، ومعدل الحرق القياسي.',
                'Résultats de la corrélation GPS camion/station, capacité réservoir et norme de consommation.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* 1. Geolocation Check */}
            <div className="p-3 rounded-xl border bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{t('1. التحقق المكاني والجغرافي (Geofence Matching)', '1. Vérification Géolocalisée')}</span>
                </div>
                {audit.distanceToTruckKm !== undefined ? (
                  audit.distanceToTruckKm <= 15 ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1 bg-emerald-500/10">
                      <CheckCircle2 className="w-3 h-3" />
                      {t(`مطابق (${audit.distanceToTruckKm} كم)`, `Conforme (${audit.distanceToTruckKm} km)`)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/30 gap-1 bg-rose-500/10">
                      <XCircle className="w-3 h-3" />
                      {t(`شاذ (${audit.distanceToTruckKm} كم)`, `Anomalie (${audit.distanceToTruckKm} km)`)}
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {t('بيانات GPS غير مكتملة', 'Données GPS incomplètes')}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {audit.stationMatchedName
                  ? `${t('المحطة المحددة:', 'Station identifiée :')} ${audit.stationMatchedName}`
                  : t('لم يتم تحديد محطة وقود مطابقة في الكتالوج الدولي.', 'Station non répertoriée dans le catalogue international.')}
              </p>
              {audit.distanceToTruckKm !== undefined && (
                <p className="text-[11px] text-muted-foreground">
                  {t('المسافة بين المحطة وأقرب موقع مسجل للشاحنة في تاريخ الوصل:', 'Distance entre la station et la position du camion :')}{' '}
                  <strong className="font-mono text-foreground">{audit.distanceToTruckKm} km</strong>{' '}
                  {audit.distanceToTruckKm <= 15
                    ? t('(ضمن نطاق الأمان المصرح به ≤ 15 كم)', '(Dans la zone autorisée ≤ 15 km)')
                    : t('(تتجاوز نطاق الأمان > 15 كم - اشتباه!)', '(Hors zone autorisée > 15 km - Suspect !)')}
                </p>
              )}
            </div>

            {/* 2. Tank Capacity Check */}
            <div className="p-3 rounded-xl border bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Fuel className="w-4 h-4 text-primary" />
                  <span>{t('2. فحص سعة الخزان الميكانيكية (Tank Capacity)', '2. Capacité Mécanique du Réservoir')}</span>
                </div>
                {anomalies.some((a) => a.type === 'TANK_OVERFILL') ? (
                  <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/30 gap-1 bg-rose-500/10">
                    <XCircle className="w-3 h-3" />
                    {t('تجاوز السعة القصوى', 'Dépassement de capacité')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1 bg-emerald-500/10">
                    <CheckCircle2 className="w-3 h-3" />
                    {t('سعة مطابقة للمواصفات', 'Volume conforme')}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {t('الحد الأقصى الفيزيائي لخزان الشاحنة المزدوج:', 'Capacité max physique du réservoir :')}{' '}
                <strong className="font-mono text-foreground">{audit.maxTankCapacityLiters} L</strong>
              </p>
            </div>

            {/* 3. Consumption Rate Deviation */}
            <div className="p-3 rounded-xl border bg-card space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Gauge className="w-4 h-4 text-primary" />
                  <span>{t('3. تباين معدل الاستهلاك القياسي (Consumption Deviation)', '3. Déviation de Consommation')}</span>
                </div>
                {anomalies.some((a) => a.type === 'EXCESSIVE_CONSUMPTION') ? (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 gap-1 bg-amber-500/10">
                    <AlertTriangle className="w-3 h-3" />
                    {t('انحراف في معدل الحرق', 'Écart anormal')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1 bg-emerald-500/10">
                    <CheckCircle2 className="w-3 h-3" />
                    {t('معدل حرق طبيعي', 'Consommation normale')}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {t('المعيار النموذجي المحدد:', 'Norme configurée :')}{' '}
                  <strong className="font-mono text-foreground">{audit.standardConsumptionRate} L/100km</strong>
                </span>
                {audit.calculatedConsumptionRate && (
                  <span>
                    {t('المعدل الفعلي المحسوب:', 'Taux réel calculé :')}{' '}
                    <strong className="font-mono text-foreground">{audit.calculatedConsumptionRate} L/100km</strong>
                  </span>
                )}
              </div>
            </div>

            {/* List of Anomalies (if any) */}
            {anomalies.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  {t('الشذوذات المسجلة في هذا السند:', 'Anomalies détectées sur ce reçu :')}
                </p>
                <div className="space-y-2">
                  {anomalies.map((anom, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-rose-700 dark:text-rose-300">
                        <span>{dir === 'rtl' ? anom.titleAr : anom.titleFr}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/20">
                          {anom.severity}
                        </span>
                      </div>
                      <p className="text-rose-600/90 dark:text-rose-400">
                        {dir === 'rtl' ? anom.descriptionAr : anom.descriptionFr}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">{anom.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-2 border-t">
            <Button size="sm" onClick={() => setIsOpen(false)} className="rounded-xl text-xs font-bold">
              {t('إغلاق', 'Fermer')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

