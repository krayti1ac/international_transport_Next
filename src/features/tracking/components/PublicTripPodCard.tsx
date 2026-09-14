'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import type { TripOrder, DeliverySignature } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileCheck,
  Download,
  MapPin,
  User,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Eye,
} from 'lucide-react';

interface PublicTripPodCardProps {
  trip: TripOrder;
  deliverySignature: DeliverySignature | null;
  loading?: boolean;
}

export function PublicTripPodCard({ trip, deliverySignature, loading }: PublicTripPodCardProps) {
  const { t, dir, locale } = useLanguage();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isCompleted = trip.status === 'completed' || trip.status === 'settled';
  const hasPod = Boolean(deliverySignature?.signature_url);

  const handleDownloadPdf = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pdfUrl = `${origin}/api/pod/pdf?tripOrderId=${trip.id}`;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <Card className="border-border bg-card shadow-xs p-6 text-center" dir={dir}>
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          {t('جاري فحص وثائق وإثبات التسليم الرقمي...', 'Vérification du rapport de livraison...', 'Checking proof of delivery...')}
        </p>
      </Card>
    );
  }

  // If POD exists or trip is marked completed
  if (hasPod && deliverySignature) {
    const mapsUrl =
      deliverySignature.latitude && deliverySignature.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${deliverySignature.latitude},${deliverySignature.longitude}`
        : null;

    const formattedDate = deliverySignature.signed_at
      ? new Date(deliverySignature.signed_at).toLocaleString(
          locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'es-ES',
          {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }
        )
      : '—';

    return (
      <Card
        className="border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 via-card to-card shadow-md overflow-hidden"
        dir={dir}
      >
        <CardHeader className="pb-3 border-b border-emerald-500/20 bg-emerald-500/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold font-amiri text-emerald-800 dark:text-emerald-300">
                  {t('إثبات التسليم الرقمي المعتمد (e-POD)', 'Preuve de Livraison Certifiée (e-POD)', 'Prueba de Entrega Certificada (e-POD)')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t('تم توثيق استلام الشحنة وتوقيع إبراء الذمة إلكترونياً', 'Réception validée et décharge émargée électroniquement', 'Recepción validada y descargo firmado electrónicamente')}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleDownloadPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 rounded-xl shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('تحميل وثيقة التسليم (PDF)', 'Télécharger e-POD (PDF)', 'Descargar e-POD (PDF)')}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Signer */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70">
              <User className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="overflow-hidden">
                <span className="text-[11px] text-muted-foreground block">
                  {t('المستلم / الموقع:', 'Réceptionnaire :', 'Destinatario / Firmante:')}
                </span>
                <span className="text-xs font-bold text-foreground truncate block mt-0.5">
                  {deliverySignature.signed_by || t('المستلم المعتمد', 'Destinataire agréé', 'Destinatario autorizado')}
                </span>
              </div>
            </div>

            {/* Signed At */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70">
              <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] text-muted-foreground block">
                  {t('تاريخ وتوقيت التسليم:', 'Date et heure de décharge :', 'Fecha y hora de entrega:')}
                </span>
                <span className="text-xs font-bold text-foreground block mt-0.5 font-mono">
                  {formattedDate}
                </span>
              </div>
            </div>

            {/* GPS Location */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="overflow-hidden">
                <span className="text-[11px] text-muted-foreground block">
                  {t('الموقع الجغرافي للتسليم:', 'Localisation de décharge :', 'Ubicación de entrega:')}
                </span>
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary hover:underline flex items-center gap-1 mt-0.5"
                    dir="ltr"
                  >
                    <span>{deliverySignature.latitude?.toFixed(4)}, {deliverySignature.longitude?.toFixed(4)}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {t('تم التسجيل بنجاح', 'Enregistré avec succès', 'Registrado con éxito')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Visual Proofs (Signature & Stamped CMR) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Signature Preview */}
            <div className="rounded-xl border border-border bg-white dark:bg-slate-950 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  {t('توقيع المستلم الحي', 'Signature manuscrite', 'Firma manuscrita')}
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div
                className="h-28 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg p-2 cursor-pointer border border-border/40 hover:border-primary/50 transition-colors"
                onClick={() => setSelectedImage(deliverySignature.signature_url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={deliverySignature.signature_url}
                  alt="Signature"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>

            {/* Stamped CMR Preview if available */}
            {deliverySignature.cmr_image_url ? (
              <div className="rounded-xl border border-border bg-white dark:bg-slate-950 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {t('صورة الـ CMR المؤشر بختم الوصول', 'CMR visé avec cachet', 'CMR visado con sello')}
                  </span>
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div
                  className="h-28 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden cursor-pointer border border-border/40 hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedImage(deliverySignature.cmr_image_url || null)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={deliverySignature.cmr_image_url}
                    alt="CMR Document"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 flex flex-col items-center justify-center text-center">
                <FileCheck className="w-8 h-8 text-muted-foreground/60 mb-1.5" />
                <span className="text-xs font-medium text-foreground">
                  {t('إثبات التسليم الرقمي معتمد', 'e-POD validé numériquement', 'e-POD validado digitalmente')}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {t('التوقيع الإلكتروني وبيانات الاستلام مسجلة رسمياً', 'Signature électronique et décharge enregistrées', 'Firma electrónica y entrega registradas')}
                </span>
              </div>
            )}
          </div>
        </CardContent>

        {/* Modal for full image view */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-2xl max-h-[85vh] bg-card rounded-2xl overflow-hidden p-2 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage}
                alt="Enlarged Proof"
                className="max-h-[80vh] w-auto object-contain mx-auto rounded-xl"
              />
              <p className="text-center text-xs text-muted-foreground mt-2">
                {t('انقر في أي مكان للإغلاق', 'Cliquer pour fermer', 'Haga clic para cerrar')}
              </p>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // If completed without deliverySignature record yet
  if (isCompleted) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs" dir={dir}>
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground font-amiri">
                {t('تم تأكيد تسليم الشحنة بنجاح', 'Expédition livrée avec succès', 'Envío entregado con éxito')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {trip.unloading_date_export
                  ? `${t('تاريخ التفريغ:', 'Date de déchargement :', 'Fecha de descarga:')} ${trip.unloading_date_export}`
                  : t('اكتملت جميع مراحل المسار اللوجستي الدولي', 'Toutes les étapes logistiques sont complétées', 'Todas las etapas logísticas están completadas')}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('تحميل إشعار التسليم (PDF)', 'Télécharger récépissé', 'Descargar recibo')}</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Ongoing / In Transit State (Waiting for POD)
  return (
    <Card className="border-dashed border-border bg-muted/20 shadow-xs" dir={dir}>
      <CardContent className="p-5 flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/20">
          <FileCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-foreground">
            {t('إثبات التسليم الرقمي (e-POD)', 'Preuve de Livraison Électronique (e-POD)', 'Prueba de Entrega Electrónica (e-POD)')}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {t(
              'الشحنة حالياً في طريقها للوجهة المحددة. فور وصول الشاحنة وإتمام تفريغ البضائع، سيتم إدراج توقيع المستلم والختم وتحديد موقع التسليم الجغرافي مباشرة في هذه الصفحة.',
              'L\'expédition est actuellement en cours d\'acheminement. Dès l\'arrivée à destination et le déchargement de la marchandise, la signature du destinataire et le récépissé e-POD horodaté seront consultables ici.',
              'El envío se encuentra en ruta. A la llegada a destino y finalización de la descarga, la firma del destinatario y el comprobante e-POD geolocalizado estarán disponibles aquí.'
            )}
          </p>
          {trip.unloading_date_export && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary mt-2">
              <Clock className="w-3 h-3" />
              {t('موعد الوصول والتسليم المتوقع:', 'Livraison estimée :', 'Entrega estimada:')}{' '}
              <span className="font-bold">{trip.unloading_date_export}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

