'use client';

import React from 'react';
import { useLanguage } from '@/components/language-provider';
import type { TripOrder } from '@/types/database';
import {
  Package,
  Ship,
  FileCheck2,
  MapPinCheck,
  Check,
  Radio,
} from 'lucide-react';

interface PublicTripTimelineProps {
  trip: TripOrder;
}

type StageStatus = 'completed' | 'active' | 'upcoming';

interface MilestoneStage {
  id: number;
  key: string;
  icon: React.ElementType;
  titleAr: string;
  titleFr: string;
  titleEs: string;
  descAr: string;
  descFr: string;
  descEs: string;
  detail?: string | null;
  status: StageStatus;
}

export function PublicTripTimeline({ trip }: PublicTripTimelineProps) {
  const { t, dir, locale } = useLanguage();

  // Determine stage progression from trip.status
  // Statuses: 'pending', 'in_transit', 'customs_export', 'at_destination_export', 'en_route_inbound', 'completed', 'settled'
  const getStageStatuses = (): [StageStatus, StageStatus, StageStatus, StageStatus] => {
    switch (trip.status) {
      case 'completed':
      case 'settled':
        return ['completed', 'completed', 'completed', 'completed'];
      case 'at_destination_export':
      case 'en_route_inbound':
        return ['completed', 'completed', 'completed', 'active'];
      case 'customs_export':
        return ['completed', 'completed', 'active', 'upcoming'];
      case 'in_transit':
        // If in transit, departure is completed, maritime crossing / transit is active
        return ['completed', 'active', 'upcoming', 'upcoming'];
      case 'pending':
      default:
        return ['active', 'upcoming', 'upcoming', 'upcoming'];
    }
  };

  const [s1, s2, s3, s4] = getStageStatuses();

  // Extract route points
  const routeParts = (trip.route || '').split(/[-–—>→]/).map((s) => s.trim()).filter(Boolean);
  const originCity = routeParts[0] || t('المغرب', 'Maroc', 'Marruecos');
  const destCity = routeParts[1] || routeParts[routeParts.length - 1] || t('أوروبا', 'Europe', 'Europa');

  const stages: MilestoneStage[] = [
    {
      id: 1,
      key: 'departure',
      icon: Package,
      titleAr: 'الشحن والانطلاق',
      titleFr: 'Chargement & Départ',
      titleEs: 'Carga y Salida',
      descAr: s1 === 'completed'
        ? `تم انطلاق الشحنة من ${originCity}`
        : s1 === 'active'
          ? `جارٍ التجهيز والانطلاق من ${originCity}`
          : `نقطة الانطلاق: ${originCity}`,
      descFr: s1 === 'completed'
        ? `Départ effectué depuis ${originCity}`
        : s1 === 'active'
          ? `En cours de chargement à ${originCity}`
          : `Origine : ${originCity}`,
      descEs: s1 === 'completed'
        ? `Salida realizada desde ${originCity}`
        : s1 === 'active'
          ? `En preparación y salida de ${originCity}`
          : `Origen: ${originCity}`,
      detail: trip.departure_date ? `${t('التاريخ:', 'Date :', 'Fecha:')} ${trip.departure_date}` : null,
      status: s1,
    },
    {
      id: 2,
      key: 'ferry',
      icon: Ship,
      titleAr: 'المعبر البحري وميناء العبور',
      titleFr: 'Traversée Maritime & Port',
      titleEs: 'Travesía Marítima y Puerto',
      descAr: s2 === 'completed'
        ? 'تمت Traversée البحرية بنجاح'
        : s2 === 'active'
          ? 'في معبر ميناء طنجة المتوسط / الجزيرة الخضراء'
          : 'حجز العبّارة البحرية الدولية',
      descFr: s2 === 'completed'
        ? 'Traversée maritime effectuée avec succès'
        : s2 === 'active'
          ? 'En transit portuaire Tanger Med / Algésiras'
          : 'Traversée maritime programmée',
      descEs: s2 === 'completed'
        ? 'Travesía marítima completada con éxito'
        : s2 === 'active'
          ? 'En tránsito portuario Tánger Med / Algeciras'
          : 'Travesía marítima programada',
      detail: trip.ferry_company
        ? `${trip.ferry_company}${trip.ferry_localizador ? ` (${trip.ferry_localizador})` : ''}`
        : t('طنجة المتوسط ↔ الجزيرة الخضراء', 'Tanger Med ↔ Algésiras', 'Tánger Med ↔ Algeciras'),
      status: s2,
    },
    {
      id: 3,
      key: 'customs',
      icon: FileCheck2,
      titleAr: 'الجمارك والعبور القاري',
      titleFr: 'Dédouanement & Transit',
      titleEs: 'Aduana y Tránsito Continental',
      descAr: s3 === 'completed'
        ? 'تمت الإجراءات الجمركية بنجاح'
        : s3 === 'active'
          ? 'جارٍ استكمال التخليص الجمركي والعبور الدولي'
          : 'الرواق الجمركي الأوروبي السريع',
      descFr: s3 === 'completed'
        ? 'Formalités douanières validées'
        : s3 === 'active'
          ? 'Dédouanement et transit européen en cours'
          : 'Corridor douanier européen',
      descEs: s3 === 'completed'
        ? 'Trámites aduaneros validados'
        : s3 === 'active'
          ? 'Despacho de aduanas y tránsito en curso'
          : 'Corredor aduanero europeo',
      detail: trip.cmr_number ? `CMR: ${trip.cmr_number}` : null,
      status: s3,
    },
    {
      id: 4,
      key: 'delivery',
      icon: MapPinCheck,
      titleAr: 'الوصول والتسليم النهائي',
      titleFr: 'Arrivée & Livraison (e-POD)',
      titleEs: 'Llegada y Entrega (e-POD)',
      descAr: s4 === 'completed'
        ? `تم التسليم بنجاح في ${destCity}`
        : s4 === 'active'
          ? `وصلت الشاحنة إلى ${destCity} وجارٍ التفريغ`
          : `الوجهة النهائية: ${destCity}`,
      descFr: s4 === 'completed'
        ? `Livraison confirmée à ${destCity}`
        : s4 === 'active'
          ? `Arrivé à destination (${destCity}), déchargement`
          : `Destination finale : ${destCity}`,
      descEs: s4 === 'completed'
        ? `Entrega confirmada en ${destCity}`
        : s4 === 'active'
          ? `Llegado a destino (${destCity}), descarga en curso`
          : `Destino final: ${destCity}`,
      detail: trip.unloading_date_export
        ? `${t('تاريخ التفريغ:', 'Date livraison :', 'Fecha entrega:')} ${trip.unloading_date_export}`
        : null,
      status: s4,
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-5 md:p-6 shadow-xs" dir={dir}>
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <h2 className="text-base font-bold font-amiri text-foreground">
            {t('مخطط المسار ومراحل الشحنة الدولية', 'Corridor Logistique & Étapes d\'Acheminement', 'Corredor Logístico y Fases del Envío')}
          </h2>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {stages.filter((s) => s.status === 'completed').length} / 4 {t('مكتمل', 'complété', 'completado')}
        </span>
      </div>

      {/* Desktop Stepper (Horizontal) */}
      <div className="hidden md:grid grid-cols-4 gap-4 relative">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isCompleted = stage.status === 'completed';
          const isActive = stage.status === 'active';
          const title = locale === 'es' ? stage.titleEs : locale === 'fr' ? stage.titleFr : stage.titleAr;
          const desc = locale === 'es' ? stage.descEs : locale === 'fr' ? stage.descFr : stage.descAr;

          return (
            <div key={stage.key} className="relative flex flex-col items-center text-center group">
              {/* Connector line between steps */}
              {idx < stages.length - 1 && (
                <div
                  className={`absolute top-5 start-[55%] end-[-45%] h-1 z-0 transition-colors ${
                    isCompleted ? 'bg-emerald-500' : 'bg-muted'
                  }`}
                />
              )}

              {/* Step Circle / Badge */}
              <div
                className={`relative z-10 w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xs mb-3 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                    : isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-primary/30 animate-pulse'
                      : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                ) : isActive ? (
                  <Radio className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              {/* Step Info */}
              <div className="space-y-1 w-full px-1">
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={`text-xs font-bold ${
                      isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {desc}
                </p>
                {stage.detail && (
                  <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/60 mt-1">
                    {stage.detail}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Stepper (Vertical) */}
      <div className="md:hidden space-y-4 relative">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isCompleted = stage.status === 'completed';
          const isActive = stage.status === 'active';
          const title = locale === 'es' ? stage.titleEs : locale === 'fr' ? stage.titleFr : stage.titleAr;
          const desc = locale === 'es' ? stage.descEs : locale === 'fr' ? stage.descFr : stage.descAr;

          return (
            <div key={stage.key} className="relative flex items-start gap-3">
              {/* Vertical Connector Line */}
              {idx < stages.length - 1 && (
                <div
                  className={`absolute top-10 start-5 bottom-[-16px] w-0.5 z-0 ${
                    isCompleted ? 'bg-emerald-500' : 'bg-border'
                  }`}
                />
              )}

              {/* Step Icon */}
              <div
                className={`relative z-10 w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse'
                      : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                ) : isActive ? (
                  <Radio className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pb-3">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {title}
                  </h4>
                  {isActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20 animate-pulse">
                      {t('المرحلة الحالية', 'En cours', 'En curso')}
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      {t('مكتمل', 'Terminé', 'Completado')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                {stage.detail && (
                  <p className="text-[11px] font-mono text-muted-foreground mt-1 bg-muted/40 px-2 py-0.5 rounded border border-border/50 inline-block">
                    {stage.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

