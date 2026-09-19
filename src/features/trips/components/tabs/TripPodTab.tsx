'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PodReportView } from '../PodReportView';
import { useLanguage } from '@/components/language-provider';
import type { TripOrder } from '@/types/database';
import { ShieldCheck } from 'lucide-react';

interface TripPodTabProps {
  trip: TripOrder;
}

export function TripPodTab({ trip }: TripPodTabProps) {
  const { t } = useLanguage();
  const isDelivered = trip.status === 'completed' || trip.status === 'settled';

  return (
    <div className="space-y-6">
      {/* POD Header Card */}
      <Card className="rounded-2xl border-border bg-gradient-to-r from-card via-card/90 to-emerald-500/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  {t(
                    'إثبات التسليم الرقمي المعتمد (e-POD)',
                    'Preuve de Livraison Numérique (e-POD)',
                    'Prueba de Entrega Digital (e-POD)'
                  )}
                </h3>
                <Badge
                  variant={isDelivered ? 'default' : 'secondary'}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    isDelivered
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isDelivered
                    ? t('تم تأكيد واستلام الشحنة', 'Livraison Confirmée', 'Entrega Confirmada')
                    : t('قيد النقل والتسليم', 'En cours de livraison', 'En curso de entrega')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'يتضمن توقيع المستلم الحي، الموقع الجغرافي بالـ GPS لحظة الاستلام، وصورة وصل الـ CMR المختوم.',
                  'Signature numérique, géolocalisation GPS et photo du document CMR tamponné.',
                  'Firma digital, geolocalización GPS y fotografía del documento CMR sellado.'
                )}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Embedded PodReportView */}
      <PodReportView tripOrderId={trip.id} />
    </div>
  );
}
