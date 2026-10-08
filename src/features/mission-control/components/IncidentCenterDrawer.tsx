'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { IncidentAlert } from '../types';
import {
  acknowledgeIncidentAlertAction,
  dispatchIncidentEmergencyAlertAction,
} from '../services/mission-control.actions';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle,
  MessageSquare,
  Clock,
  Send,
  Loader2,
} from 'lucide-react';

interface IncidentCenterDrawerProps {
  alerts: IncidentAlert[];
  onAlertAcknowledged: (alertId: string) => void;
}

export function IncidentCenterDrawer({
  alerts,
  onAlertAcknowledged,
}: IncidentCenterDrawerProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAcknowledge = async (alert: IncidentAlert) => {
    setProcessingId(alert.id);
    try {
      const res = await acknowledgeIncidentAlertAction(
        alert.id,
        alert.truckPlate,
        'تم تأكيد ومعالجة الإنذار من شاشة غرفة العمليات'
      );
      if (res.success) {
        toast({
          title: t('تم تأكيد الإنذار بنجاح', 'Alerte acquittée avec succès'),
          description: t(`تم توثيق التدخل للشاحنة ${alert.truckPlate} في سجل التدقيق.`, `Intervention consignée pour le camion ${alert.truckPlate}.`),
        });
        onAlertAcknowledged(alert.id);
      } else {
        toast({
          title: t('خطأ أثناء التأكيد', "Erreur lors de l'acquittement"),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDispatchWhatsApp = async (alert: IncidentAlert) => {
    setProcessingId(alert.id);
    try {
      const res = await dispatchIncidentEmergencyAlertAction({
        alertId: alert.id,
        truckPlate: alert.truckPlate,
        driverPhone: alert.driverPhone,
        alertType: alert.titleAr,
        message: alert.messageAr,
      });

      if (res.success) {
        toast({
          title: t('تم إرسال إشعار الطوارئ ✅', 'Alerte d’urgence envoyée ✅'),
          description: t('تم إرسال تنبيه WhatsApp فوري للسائق وغرفة العمليات.', 'Notification WhatsApp d’urgence envoyée.'),
        });
      } else {
        toast({
          title: t('فشل الإرسال', 'Échec d’envoi'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="p-6 text-center rounded-2xl border border-dashed border-border bg-card/50">
        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
        <h4 className="font-bold text-sm text-foreground">
          {t('لا توجد إنذارات طارئة نشطة حالياً', 'Aucune alerte active')}
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          {t('كافة مبردات الأسطول والشاحنات تعمل ضمن الحدود الآمنة للمسار.', 'Tous les groupes frigo et camions fonctionnent dans les paramètres sécurisés.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir={dir}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-amiri text-foreground flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <span>{t('سجل الإنذارات الميدانية النشطة', 'Alertes Actives')}</span>
        </h3>
        <Badge variant="destructive" className="font-mono text-xs">
          {alerts.length} {t('إنذار', 'alertes')}
        </Badge>
      </div>

      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pe-1">
        {alerts.map((alert) => {
          const isCritical = alert.severity === 'critical';
          const isWarning = alert.severity === 'warning';
          const isProcessing = processingId === alert.id;

          return (
            <div
              key={alert.id}
              className={`p-3 rounded-xl border transition-all ${
                isCritical
                  ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900'
                  : isWarning
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900'
                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-xs px-2 py-0.5 rounded bg-background border border-border">
                      {alert.truckPlate}
                    </span>
                    <span className="font-semibold text-xs text-foreground">
                      {alert.titleAr}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {alert.messageAr}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(alert.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {alert.driverName && (
                      <span>
                        {t('السائق:', 'Chauffeur :')} {alert.driverName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 gap-1 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 border-emerald-300"
                    disabled={isProcessing}
                    onClick={() => handleAcknowledge(alert)}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    <span>{t('تأكيد ومعالجة', 'Acquitter')}</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-2 gap-1"
                    disabled={isProcessing}
                    onClick={() => handleDispatchWhatsApp(alert)}
                  >
                    <Send className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

