'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import type { TripOrder, Client } from '@/types/database';
import {
  ALLOWED_STAGE_TRANSITIONS,
  normalizeTripStage,
  type TripStage,
} from '@/features/trips/services/trip-state-machine';
import {
  ArrowRight,
  Printer,
  FileText,
  Edit3,
  MapPin,
  MessageSquare,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface TripHeaderProps {
  trip: TripOrder;
  clientExport: Client | null;
  onEditTrip?: () => void;
  onPrintCmr?: () => void;
  onStatusChange?: (newStatus: string) => Promise<void>;
}

export function TripHeader({ trip, clientExport, onEditTrip, onPrintCmr, onStatusChange }: TripHeaderProps) {
  const router = useRouter();
  const { t, dir, locale } = useLanguage();
  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);

  const handleDownloadDossier = () => {
    const dossierUrl = `/api/trips/${trip.id}/dossier-pdf?lang=${locale}`;
    window.open(dossierUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = () => {
    const clientPhone = clientExport?.phone?.replace(/[^\d+]/g, '') || '';
    const destinationCity = trip.route_export || trip.route || (locale === 'ar' ? 'أوروبا' : locale === 'es' ? 'Europa' : 'Europe');
    const cmrRef = trip.cmr_export_number || trip.cmr_number || `#${trip.id}`;

    const appBaseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
    const trackingUrl = `${appBaseUrl}/track/${trip.id}`;

    const textAr = `مرحباً بك،\nيسعدنا مشاركة رابط التتبع الحي لشحنتكم رقم #${trip.id} (CMR: ${cmrRef})\nالمسار: ${destinationCity}\nرابط التتبع المباشر:\n${trackingUrl}`;
    const textFr = `Bonjour,\nVoici le lien de suivi en direct de votre expédition #${trip.id} (CMR: ${cmrRef})\nItinéraire: ${destinationCity}\nLien de suivi:\n${trackingUrl}`;
    const textEs = `Hola,\nAquí tiene el enlace de seguimiento en directo de su expedición #${trip.id} (CMR: ${cmrRef})\nItinerario: ${destinationCity}\nEnlace de seguimiento:\n${trackingUrl}`;
    const message = locale === 'ar' ? textAr : locale === 'es' ? textEs : textFr;

    const waUrl = clientPhone
      ? `https://wa.me/${clientPhone.replace(/^00/, '').replace(/^0/, '212')}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
      case 'pending':
        return {
          label: t('مسودة / قيد الانتظار', 'Brouillon / En attente', 'Borrador / Pendiente'),
          className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
        };
      case 'assigned':
        return {
          label: t('تم تعيين الطاقم', 'Équipage assigné', 'Tripulación asignada'),
          className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
          dot: 'bg-sky-500',
        };
      case 'loading':
        return {
          label: t('جاري التحميل', 'En cours de chargement', 'En carga'),
          className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
          dot: 'bg-indigo-500 animate-pulse',
        };
      case 'in_transit':
        return {
          label: t('في الطريق (ذهاب)', 'En transit (Aller)', 'En tránsito (Ida)'),
          className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
          dot: 'bg-blue-500 animate-ping',
        };
      case 'customs_export':
        return {
          label: t('التخليص الجمركي', 'Dédouanement Export', 'Despacho de aduanas'),
          className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
          dot: 'bg-purple-500',
        };
      case 'at_destination_export':
        return {
          label: t('في وجهة التفريغ بأوروبا', 'À destination (Europe)', 'En destino (Europa)'),
          className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
          dot: 'bg-indigo-500',
        };
      case 'en_route_inbound':
        return {
          label: t('في طريق العودة (استيراد)', 'En route retour (Import)', 'En ruta de retorno (Importación)'),
          className: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
          dot: 'bg-teal-500 animate-pulse',
        };
      case 'delivered':
      case 'completed':
        return {
          label: t('تم التسليم بنجاح', 'Livraison effectuée', 'Entregado con éxito'),
          className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
        };
      case 'settled':
        return {
          label: t('تمت التسوية المالية', 'Règlement effectué', 'Liquidado'),
          className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
          dot: 'bg-slate-400',
        };
      case 'closed':
        return {
          label: t('ملف مغلق ومؤرشف', 'Dossier clôturé', 'Expediente cerrado'),
          className: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30',
          dot: 'bg-gray-500',
        };
      case 'cancelled':
        return {
          label: t('ملغاة', 'Annulée', 'Cancelada'),
          className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
          dot: 'bg-rose-500',
        };
      default:
        return {
          label: status,
          className: 'bg-muted text-muted-foreground border-border',
          dot: 'bg-muted-foreground',
        };
    }
  };

  const getStageActionLabel = (stage: TripStage) => {
    switch (stage) {
      case 'assigned':
        return t('تعيين الطاقم', 'Assigner équipage', 'Asignar tripulación');
      case 'loading':
        return t('بدء التحميل', 'Commencer chargement', 'Iniciar carga');
      case 'in_transit':
        return t('انطلاق الشاحنة', 'Départ en transit', 'Salida en tránsito');
      case 'customs_export':
        return t('دخول الجمارك', 'Entrée en douane', 'Entrada en aduana');
      case 'delivered':
        return t('تأكيد التسليم (e-POD)', 'Confirmer livraison (e-POD)', 'Confirmar entrega (e-POD)');
      case 'settled':
        return t('اعتماد التسوية', 'Valider règlement', 'Liquidar');
      case 'closed':
        return t('إغلاق وأرشفة الرحلة', 'Clôturer le dossier', 'Cerrar expediente');
      default:
        return stage;
    }
  };

  const handleStageTransition = async (targetStage: string) => {
    if (!onStatusChange) return;
    setTransitioningTo(targetStage);
    try {
      await onStatusChange(targetStage);
    } finally {
      setTransitioningTo(null);
    }
  };

  const currentStage = normalizeTripStage(trip.status);
  const nextAllowedStages = (ALLOWED_STAGE_TRANSITIONS[currentStage] || []).filter(
    (s) => s !== 'cancelled'
  );
  const statusBadge = getStatusBadge(trip.status);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/95 to-muted/30 p-6 sm:p-7 shadow-xs">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Title & Back Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full hover:bg-muted"
            title={t('رجوع', 'Retour', 'Volver')}
          >
            <ArrowRight className={`w-5 h-5 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
          </Button>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-amiri text-foreground tracking-tight">
                {t('ملف الرحلة الدولية', 'Dossier de Mission TIR', 'Expediente de Misión TIR')} #{trip.id}
              </h1>
              <Badge
                className={`text-xs px-3 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${statusBadge.className}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                <span>{statusBadge.label}</span>
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-1.5 ms-12 text-xs text-muted-foreground flex-wrap">
              {(trip.cmr_export_number || trip.cmr_number) && (
                <span className="font-mono font-medium">
                  CMR: <strong className="text-foreground">{trip.cmr_export_number || trip.cmr_number}</strong>
                </span>
              )}
              <span>•</span>
              <span>
                {t('تاريخ الإنشاء:', 'Créé le :', 'Fecha de creación:')}{' '}
                <span className="font-mono">{trip.created_at?.split('T')[0]}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          {/* State Machine Transition Buttons */}
          {onStatusChange && nextAllowedStages.map((targetStage) => (
            <Button
              key={targetStage}
              variant="secondary"
              size="sm"
              disabled={transitioningTo !== null}
              onClick={() => handleStageTransition(targetStage)}
              className="rounded-xl text-xs gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold"
            >
              {transitioningTo === targetStage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : dir === 'rtl' ? (
                <ChevronLeft className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>{getStageActionLabel(targetStage)}</span>
            </Button>
          ))}

          {/* WhatsApp Tracking Share */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareWhatsApp}
            className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            title={t('مشاركة رابط التتبع عبر واتساب للعميل', 'Partager le lien WhatsApp', 'Compartir enlace por WhatsApp')}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('تتبع WhatsApp', 'Partager WhatsApp', 'Seguimiento WhatsApp')}</span>
          </Button>

          {/* Smart e-CMR Print */}
          {onPrintCmr && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrintCmr}
              className="rounded-xl text-xs gap-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium"
              title={t('طباعة بيان الشحنة الدولي (CMR)', 'Imprimer lettre de voiture CMR', 'Imprimir carta de porte CMR')}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t('طباعة CMR', 'Imprimer CMR', 'Imprimir CMR')}</span>
            </Button>
          )}

          {/* Consolidated Dossier PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadDossier}
            className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium"
            title={t('تحميل الملف اللوجستي الموحد (PDF)', 'Télécharger le dossier PDF', 'Descargar expediente logístico PDF')}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('تحميل الأرشيف الموحد (PDF)', 'Dossier PDF', 'Expediente PDF')}</span>
          </Button>

          {/* Edit Trip Details */}
          {onEditTrip && currentStage !== 'closed' && (
            <Button
              variant="default"
              size="sm"
              onClick={onEditTrip}
              className="rounded-xl text-xs gap-1.5 shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t('تعديل الرحلة', 'Modifier', 'Modificar viaje')}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
