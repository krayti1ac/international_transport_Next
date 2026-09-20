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
  ShieldCheck,
  Navigation,
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

  // Extract route points
  const routeParts = (trip.route || '').split(/[-–—>→]/).map((s) => s.trim()).filter(Boolean);
  const originCity = routeParts[0] || t('المغرب', 'Maroc', 'Marruecos');
  const destCity = routeParts[1] || routeParts[routeParts.length - 1] || t('الوجهة الدولية', 'Destination', 'Destino');

  // Detect Corridor Type: African Overland vs European Maritime
  const routeString = `${trip.route || ''} ${originCity} ${destCity}`.toLowerCase();
  const isAfricanCorridor =
    trip.corridor_type === 'african_overland' ||
    /(?:موريتانيا|السنغال|دكار|داكار|روصو|الكركارات|نواكشوط|نواديبو|dakar|rosso|guerguerat|nouakchott|nouadhibou|mauritanie|mauritania|s[ée]n[ée]gal|senegal)/i.test(
      routeString
    );

  // Milestone Stages Definition based on corridor
  let stages: MilestoneStage[] = [];

  if (isAfricanCorridor) {
    // 5 Stages for African Overland Trade Corridor
    const getAfricanStageStatuses = (): [StageStatus, StageStatus, StageStatus, StageStatus, StageStatus] => {
      switch (trip.status) {
        case 'completed':
        case 'settled':
          return ['completed', 'completed', 'completed', 'completed', 'completed'];
        case 'at_destination_export':
        case 'en_route_inbound':
          return ['completed', 'completed', 'completed', 'completed', 'active'];
        case 'customs_export':
          return ['completed', 'completed', 'completed', 'active', 'upcoming'];
        case 'in_transit':
          return ['completed', 'completed', 'active', 'upcoming', 'upcoming'];
        case 'pending':
        default:
          return ['active', 'upcoming', 'upcoming', 'upcoming', 'upcoming'];
      }
    };

    const [a1, a2, a3, a4, a5] = getAfricanStageStatuses();

    stages = [
      {
        id: 1,
        key: 'departure',
        icon: Package,
        titleAr: 'الشحن والانطلاق (المغرب)',
        titleFr: 'Chargement & Départ (Maroc)',
        titleEs: 'Carga y Salida (Marruecos)',
        descAr: a1 === 'completed'
          ? `تم انطلاق الشحنة بنجاح من ${originCity}`
          : a1 === 'active'
            ? `جارٍ التجهيز والانطلاق من ${originCity}`
            : `نقطة الانطلاق: ${originCity}`,
        descFr: a1 === 'completed'
          ? `Départ effectué depuis ${originCity}`
          : a1 === 'active'
            ? `En cours de chargement à ${originCity}`
            : `Origine : ${originCity}`,
        descEs: a1 === 'completed'
          ? `Salida realizada desde ${originCity}`
          : a1 === 'active'
            ? `En preparación y salida de ${originCity}`
            : `Origen: ${originCity}`,
        detail: trip.departure_date ? `${t('التاريخ:', 'Date :', 'Fecha:')} ${trip.departure_date}` : null,
        status: a1,
      },
      {
        id: 2,
        key: 'guerguerat',
        icon: ShieldCheck,
        titleAr: 'معبر الكركارات الحدودي (🇲🇦/🇲🇷)',
        titleFr: 'Poste Frontière Guerguerat',
        titleEs: 'Paso Fronterizo Guerguerat',
        descAr: a2 === 'completed'
          ? 'تم اجتياز التفتيش والجمارك بالكركارات بنجاح'
          : a2 === 'active'
            ? 'في المعبر الحدودي للكركارات / تخليص الصادرات'
            : 'نقطة المراقبة الحدودية المغربية الموريتانية',
        descFr: a2 === 'completed'
          ? 'Passage frontalier Guerguerat validé'
          : a2 === 'active'
            ? 'En cours au poste frontière Guerguerat'
            : 'Point de contrôle frontalier 🇲🇦/🇲🇷',
        descEs: a2 === 'completed'
          ? 'Paso fronterizo Guerguerat validado'
          : a2 === 'active'
            ? 'En tránsito por Guerguerat'
            : 'Control fronterizo 🇲🇦/🇲🇷',
        detail: t('نطاق المراقبة الذكية 5 كم', 'Périmètre sécurisé 5 km', 'Perímetro seguro 5 km'),
        status: a2,
      },
      {
        id: 3,
        key: 'mauritania_transit',
        icon: Navigation,
        titleAr: 'العبور الموريتاني ونواكشوط (🇲🇷)',
        titleFr: 'Transit Mauritanie & Nouakchott',
        titleEs: 'Tránsito Mauritania y Nuakchot',
        descAr: a3 === 'completed'
          ? 'تم عبور الأراضي الموريتانية ومحطة نواكشوط'
          : a3 === 'active'
            ? 'في الطريق الدولي الموريتاني (نواديبو ↔ نواكشوط)'
            : 'الممر البري الصحراوي الدولي',
        descFr: a3 === 'completed'
          ? 'Traversée mauritanienne et Nouakchott effectuée'
          : a3 === 'active'
            ? 'En transit sur le corridor mauritanien'
            : 'Corridor routier saharien international',
        descEs: a3 === 'completed'
          ? 'Cruce por Mauritania y Nuakchot completado'
          : a3 === 'active'
            ? 'En tránsito por el corredor mauritano'
            : 'Corredor terrestre internacional',
        detail: t('المحور اللوجستي نواكشوط', 'Hub Logistique Nouakchott', 'Hub Logístico Nuakchot'),
        status: a3,
      },
      {
        id: 4,
        key: 'rosso_ferry',
        icon: Ship,
        titleAr: 'معبر نهر السنغال / عبّارة روصو',
        titleFr: 'Bac de Rosso / Fleuve Sénégal',
        titleEs: 'Ferry del Río Senegal / Rosso',
        descAr: a4 === 'completed'
          ? 'تم عبور نهر السنغال والدخول للأراضي السنغالية'
          : a4 === 'active'
            ? 'في محطة عبّارة روصو النهرية / جمارك السنغال'
            : 'المعبر الحدودي النهري بين موريتانيا والسنغال',
        descFr: a4 === 'completed'
          ? 'Franchissement du fleuve Sénégal effectué'
          : a4 === 'active'
            ? 'Au bac de Rosso / douane sénégalaise'
            : 'Traversée fluviale Rosso (🇲🇷/🇸🇳)',
        descEs: a4 === 'completed'
          ? 'Cruce del río Senegal completado'
          : a4 === 'active'
            ? 'En ferry de Rosso / aduana de Senegal'
            : 'Paso fluvial de Rosso (🇲🇷/🇸🇳)',
        detail: t('نهر السنغال ↔ المعبر الحدودي', 'Fleuve Sénégal ↔ Frontière', 'Río Senegal ↔ Frontera'),
        status: a4,
      },
      {
        id: 5,
        key: 'delivery',
        icon: MapPinCheck,
        titleAr: 'الوصول والتسليم النهائي (دكار 🇸🇳)',
        titleFr: 'Arrivée & Livraison (Dakar 🇸🇳)',
        titleEs: 'Llegada y Entrega (Dakar 🇸🇳)',
        descAr: a5 === 'completed'
          ? `تم تسليم الشحنة بنجاح في ${destCity}`
          : a5 === 'active'
            ? `وصلت الشاحنة إلى ${destCity} وجارٍ التفريغ`
            : `الوجهة الإفريقية النهائية: ${destCity}`,
        descFr: a5 === 'completed'
          ? `Livraison effectuée avec succès à ${destCity}`
          : a5 === 'active'
            ? `Arrivé à ${destCity}, déchargement e-POD`
            : `Destination finale : ${destCity}`,
        descEs: a5 === 'completed'
          ? `Entrega realizada con éxito en ${destCity}`
          : a5 === 'active'
            ? `Llegado a ${destCity}, descarga e-POD`
            : `Destino final: ${destCity}`,
        detail: trip.unloading_date_export
          ? `${t('التفريغ:', 'Déchargement :', 'Descarga:')} ${trip.unloading_date_export}`
          : null,
        status: a5,
      },
    ];
  } else {
    // 4 Stages for European Maritime Corridor
    const getEuropeanStageStatuses = (): [StageStatus, StageStatus, StageStatus, StageStatus] => {
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
          return ['completed', 'active', 'upcoming', 'upcoming'];
        case 'pending':
        default:
          return ['active', 'upcoming', 'upcoming', 'upcoming'];
      }
    };

    const [e1, e2, e3, e4] = getEuropeanStageStatuses();

    stages = [
      {
        id: 1,
        key: 'departure',
        icon: Package,
        titleAr: 'الشحن والانطلاق (المغرب)',
        titleFr: 'Chargement & Départ (Maroc)',
        titleEs: 'Carga y Salida (Marruecos)',
        descAr: e1 === 'completed'
          ? `تم انطلاق الشحنة من ${originCity}`
          : e1 === 'active'
            ? `جارٍ التجهيز والانطلاق من ${originCity}`
            : `نقطة الانطلاق: ${originCity}`,
        descFr: e1 === 'completed'
          ? `Départ effectué depuis ${originCity}`
          : e1 === 'active'
            ? `En cours de chargement à ${originCity}`
            : `Origine : ${originCity}`,
        descEs: e1 === 'completed'
          ? `Salida realizada desde ${originCity}`
          : e1 === 'active'
            ? `En preparación y salida de ${originCity}`
            : `Origen: ${originCity}`,
        detail: trip.departure_date ? `${t('التاريخ:', 'Date :', 'Fecha:')} ${trip.departure_date}` : null,
        status: e1,
      },
      {
        id: 2,
        key: 'ferry',
        icon: Ship,
        titleAr: 'المعبر البحري وميناء العبور',
        titleFr: 'Traversée Maritime & Port',
        titleEs: 'Travesía Marítima y Puerto',
        descAr: e2 === 'completed'
          ? 'تمت Traversée البحرية بنجاح'
          : e2 === 'active'
            ? 'في معبر ميناء طنجة المتوسط / الجزيرة الخضراء'
            : 'حجز العبّارة البحرية الدولية',
        descFr: e2 === 'completed'
          ? 'Traversée maritime effectuée avec succès'
          : e2 === 'active'
            ? 'En transit portuaire Tanger Med / Algésiras'
            : 'Traversée maritime programmée',
        descEs: e2 === 'completed'
          ? 'Travesía marítima completada con éxito'
          : e2 === 'active'
            ? 'En tránsito portuario Tánger Med / Algeciras'
            : 'Travesía marítima programada',
        detail: trip.ferry_company
          ? `${trip.ferry_company}${trip.ferry_localizador ? ` (${trip.ferry_localizador})` : ''}`
          : t('طنجة المتوسط ↔ الجزيرة الخضراء', 'Tanger Med ↔ Algésiras', 'Tánger Med ↔ Algeciras'),
        status: e2,
      },
      {
        id: 3,
        key: 'customs',
        icon: FileCheck2,
        titleAr: 'الجمارك والرواق الأوروبي السريع',
        titleFr: 'Dédouanement & Transit Européen',
        titleEs: 'Aduana y Tránsito Continental',
        descAr: e3 === 'completed'
          ? 'تمت الإجراءات الجمركية والعبور القاري بنجاح'
          : e3 === 'active'
            ? 'جارٍ استكمال التخليص الجمركي والعبور الدولي'
            : 'الرواق الجمركي الأوروبي السريع',
        descFr: e3 === 'completed'
          ? 'Formalités douanières et transit européen validés'
          : e3 === 'active'
            ? 'Dédouanement et transit européen en cours'
            : 'Corridor douanier européen',
        descEs: e3 === 'completed'
          ? 'Trámites aduaneros y tránsito europeo validados'
          : e3 === 'active'
            ? 'Despacho de aduanas y tránsito en curso'
            : 'Corredor aduanero europeo',
        detail: trip.cmr_number ? `CMR: ${trip.cmr_number}` : null,
        status: e3,
      },
      {
        id: 4,
        key: 'delivery',
        icon: MapPinCheck,
        titleAr: 'الوصول والتسليم النهائي (e-POD)',
        titleFr: 'Arrivée & Livraison (e-POD)',
        titleEs: 'Llegada y Entrega (e-POD)',
        descAr: e4 === 'completed'
          ? `تم التسليم بنجاح في ${destCity}`
          : e4 === 'active'
            ? `وصلت الشاحنة إلى ${destCity} وجارٍ التفريغ`
            : `الوجهة النهائية: ${destCity}`,
        descFr: e4 === 'completed'
          ? `Livraison confirmée à ${destCity}`
          : e4 === 'active'
            ? `Arrivé à destination (${destCity}), déchargement`
            : `Destination finale : ${destCity}`,
        descEs: e4 === 'completed'
          ? `Entrega confirmada en ${destCity}`
          : e4 === 'active'
            ? `Llegado a destino (${destCity}), descarga en curso`
            : `Destino final: ${destCity}`,
        detail: trip.unloading_date_export
          ? `${t('تاريخ التفريغ:', 'Date livraison :', 'Fecha entrega:')} ${trip.unloading_date_export}`
          : null,
        status: e4,
      },
    ];
  }

  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalStages = stages.length;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 md:p-6 shadow-xs" dir={dir}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <h2 className="text-base font-bold font-amiri text-foreground">
            {t('مخطط مسار الشحنة الدولية', 'Corridor Logistique & Étapes d\'Acheminement', 'Corredor Logístico y Fases del Envío')}
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {isAfricanCorridor
              ? t('الممر الإفريقي البري 🌍', 'Corridor Africain 🌍', 'Corredor Africano 🌍')
              : t('الممر الأوروبي البحري 🚢', 'Corridor Maritime Européen 🚢', 'Corredor Marítimo Europeo 🚢')}
          </span>
        </div>
        <span className="text-xs font-mono font-semibold text-muted-foreground">
          {completedCount} / {totalStages} {t('مكتمل', 'complété', 'completado')}
        </span>
      </div>

      {/* Desktop Stepper (Horizontal: 4 or 5 columns) */}
      <div className={`hidden md:grid ${isAfricanCorridor ? 'grid-cols-5' : 'grid-cols-4'} gap-3 relative`}>
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
                    className={`text-xs font-bold leading-snug ${
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
                  <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/60 mt-1 truncate max-w-full">
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
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-sm font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {title}
                  </h4>
                  {isActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20 shrink-0 animate-pulse">
                      {t('المرحلة الحالية', 'En cours', 'En curso')}
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 shrink-0">
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
