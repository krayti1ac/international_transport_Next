'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import type { TripOrder, Client } from '@/types/database';
import {
  ArrowRight,
  Printer,
  Edit3,
  MapPin,
  MessageSquare,
} from 'lucide-react';

interface TripHeaderProps {
  trip: TripOrder;
  clientExport: Client | null;
  onEditTrip?: () => void;
}

export function TripHeader({ trip, clientExport, onEditTrip }: TripHeaderProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();

  const handleDownloadDossier = () => {
    const dossierUrl = `/api/trips/${trip.id}/dossier-pdf`;
    window.open(dossierUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = () => {
    const clientPhone = clientExport?.phone?.replace(/[^\d+]/g, '') || '';
    const originCity = trip.origin_branch_id ? 'المغرب' : 'المغرب / طنجة المتوسط';
    const destinationCity = trip.route_export || trip.route || 'أوروبا';
    const cmrRef = trip.cmr_export_number || trip.cmr_number || `#${trip.id}`;

    const appBaseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
    const trackingUrl = `${appBaseUrl}/track/${trip.id}`;

    const textAr = `مرحباً بك،\nيسعدنا مشاركة رابط التتبع الحي لشحنتكم رقم #${trip.id} (CMR: ${cmrRef})\nالمسار: ${destinationCity}\nرابط التتبع المباشر:\n${trackingUrl}`;
    const textFr = `Bonjour,\nVoici le lien de suivi en direct de votre expédition #${trip.id} (CMR: ${cmrRef})\nItinéraire: ${destinationCity}\nLien de suivi:\n${trackingUrl}`;
    const message = dir === 'rtl' ? textAr : textFr;

    const waUrl = clientPhone
      ? `https://wa.me/${clientPhone.replace(/^00/, '').replace(/^0/, '212')}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: t('قيد الانتظار', 'En attente', 'Pending'),
          className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
        };
      case 'in_transit':
        return {
          label: t('في الطريق (ذهاب)', 'En transit (Aller)', 'In Transit (Outbound)'),
          className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
          dot: 'bg-blue-500 animate-ping',
        };
      case 'customs_export':
        return {
          label: t('التخليص الجمركي', 'Dédouanement Export', 'Customs Clearance'),
          className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
          dot: 'bg-purple-500',
        };
      case 'at_destination_export':
        return {
          label: t('في وجهة التفريغ بأوروبا', 'À destination (Europe)', 'At Destination'),
          className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
          dot: 'bg-indigo-500',
        };
      case 'en_route_inbound':
        return {
          label: t('في طريق العودة (استيراد)', 'En route retour (Import)', 'On Return Route'),
          className: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
          dot: 'bg-teal-500 animate-pulse',
        };
      case 'completed':
        return {
          label: t('تم التسليم بنجاح', 'Livraison effectuée', 'Delivered'),
          className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
        };
      case 'settled':
        return {
          label: t('تمت التسوية المالية', 'Règlement effectué', 'Settled'),
          className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
          dot: 'bg-slate-400',
        };
      default:
        return {
          label: status,
          className: 'bg-muted text-muted-foreground border-border',
          dot: 'bg-muted-foreground',
        };
    }
  };

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
            title={t('رجوع', 'Retour', 'Back')}
          >
            <ArrowRight className={`w-5 h-5 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
          </Button>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-amiri text-foreground tracking-tight">
                {t('ملف الرحلة الدولية', 'Dossier de Mission TIR', 'International Trip Dossier')} #{trip.id}
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
                {t('تاريخ الإنشاء:', 'Créé le :')}{' '}
                <span className="font-mono">{trip.created_at?.split('T')[0]}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          {/* WhatsApp Tracking Share */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareWhatsApp}
            className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            title={t('مشاركة رابط التتبع عبر واتساب للعميل', 'Partager le lien WhatsApp', 'Share on WhatsApp')}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('تتبع WhatsApp', 'Partager WhatsApp', 'Share Tracking')}</span>
          </Button>

          {/* Consolidated Dossier PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadDossier}
            className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium"
            title={t('تحميل الملف اللوجستي الموحد (PDF)', 'Télécharger le dossier PDF', 'Download Dossier PDF')}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('تحميل الأرشيف الموحد (PDF)', 'Dossier PDF', 'Dossier PDF')}</span>
          </Button>

          {/* Edit Trip Details */}
          {onEditTrip && (
            <Button
              variant="default"
              size="sm"
              onClick={onEditTrip}
              className="rounded-xl text-xs gap-1.5 shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t('تعديل الرحلة', 'Modifier', 'Edit Trip')}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

