'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DeliverySignature } from '@/types/database';
import {
  getPodSignaturesOfflineQueue,
  processPodSignaturesOfflineQueue,
  type QueuedPodSignature,
} from '@/lib/offline-sync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { FileText, Download, MapPin, User, Clock, ExternalLink, RefreshCw } from 'lucide-react';

interface PodReportViewProps {
  tripOrderId: number;
}

export function PodReportView({ tripOrderId }: PodReportViewProps) {
  const [delivery, setDelivery] = useState<DeliverySignature | null>(null);
  const [offlinePod, setOfflinePod] = useState<QueuedPodSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const { t, dir, locale } = useLanguage();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchDelivery = async () => {
      try {
        const { data, error } = await supabase
          .from('delivery_signatures')
          .select('*')
          .eq('trip_order_id', tripOrderId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setDelivery(data as DeliverySignature);
          setOfflinePod(null);
        } else {
          // Check local offline queue for unsynced POD
          const localQueue = await getPodSignaturesOfflineQueue();
          const match = localQueue.find((q) => q.trip_id === tripOrderId);
          if (match) {
            setOfflinePod(match);
          }
        }
      } catch (error) {
        // If Supabase query fails (e.g. offline), attempt reading from local IndexedDB
        try {
          const localQueue = await getPodSignaturesOfflineQueue();
          const match = localQueue.find((q) => q.trip_id === tripOrderId);
          if (match) {
            setOfflinePod(match);
          }
        } catch {
          // Ignore secondary offline read errors
        }

        if (navigator.onLine) {
          toast({
            title: t('خطأ', 'Erreur', 'Error'),
            description:
              error instanceof Error
                ? error.message
                : t('فشل تحميل تقرير التسليم', 'Échec du chargement du rapport de livraison', 'Failed to load delivery report'),
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();

    channel = supabase
      .channel(`pod-${tripOrderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_signatures', filter: `trip_order_id=eq.${tripOrderId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setDelivery(payload.new as DeliverySignature);
            setOfflinePod(null);
          } else if (payload.eventType === 'DELETE') {
            setDelivery(null);
          }
        }
      )
      .subscribe();

    const handleOnline = () => {
      if (offlinePod) {
        handleManualSync();
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
    };
  }, [supabase, tripOrderId, toast, t]);

  const handleManualSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await processPodSignaturesOfflineQueue();
      if (res.successCount > 0) {
        toast({
          title: t('✅ تمت المزامنة بنجاح', '✅ Synchronisation réussie', '✅ Sincronización exitosa'),
          description: t('تم رفع إثبات التسليم إلى الخادم', 'POD téléversé sur le serveur', 'POD subido al servidor'),
        });
        // Re-fetch online record
        const { data } = await supabase
          .from('delivery_signatures')
          .select('*')
          .eq('trip_order_id', tripOrderId)
          .maybeSingle();
        if (data) {
          setDelivery(data as DeliverySignature);
          setOfflinePod(null);
        }
      }
    } catch (err) {
      toast({
        title: t('خطأ في المزامنة', 'Erreur de synchronisation', 'Error de sincronización'),
        description: err instanceof Error ? err.message : t('تعذر إكمال المزامنة الآن', 'Impossible de synchroniser maintenant', 'No se pudo sincronizar ahora'),
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleViewPdf = () => {
    const origin = window.location.origin;
    const pdfUrl = `${origin}/api/pod/pdf?tripOrderId=${tripOrderId}`;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <Card className="p-6 text-center" dir={dir}>
        <p className="text-muted-foreground">
          {t('جاري التحميل...', 'Chargement...', 'Cargando...')}
        </p>
      </Card>
    );
  }

  // Render Offline POD if not yet synced to Supabase
  if (!delivery && offlinePod) {
    const formattedDate = new Date(offlinePod.signed_at).toLocaleString(
      locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'es-ES'
    );

    return (
      <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20" dir={dir}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-lg font-amiri text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t('إثبات التسليم (محفوظ محلياً)', 'Preuve de livraison (Stockée localement)', 'Prueba de entrega (Guardada localmente)')}
            </CardTitle>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {t('تم الحفظ محلياً - بانتظار المزامنة 🔄', 'Enregistré localement - En attente de synchronisation 🔄', 'Guardado localmente - Pendiente de sincronización 🔄')}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t('المستلم:', 'Destinataire :', 'Destinatario:')}</span>
              <span className="font-medium text-foreground">{offlinePod.signed_by}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t('وقت التوقيع:', 'Date et heure :', 'Hora de firma:')}</span>
              <span className="font-medium text-foreground">{formattedDate}</span>
            </div>
            {offlinePod.latitude && offlinePod.longitude && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('موقع التسليم:', 'Localisation :', 'Ubicación:')}</span>
                <span className="font-mono text-xs text-foreground" dir="ltr">
                  {offlinePod.latitude.toFixed(5)}, {offlinePod.longitude.toFixed(5)}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg overflow-hidden border border-border bg-white dark:bg-slate-950">
              <p className="text-xs text-muted-foreground px-2 pt-2">
                {t('توقيع المستلم (محلي)', 'Signature du destinataire', 'Firma del destinatario')}
              </p>
              <img src={offlinePod.signature_base64} alt="Signature" className="w-full h-32 object-contain p-2" />
            </div>
            {offlinePod.cmr_image_base64 && (
              <div className="rounded-lg overflow-hidden border border-border bg-white dark:bg-slate-950">
                <p className="text-xs text-muted-foreground px-2 pt-2">
                  {t('صورة CMR (محلية)', 'Photo du CMR visé', 'Foto CMR sellado')}
                </p>
                <img src={offlinePod.cmr_image_base64} alt="CMR" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>

          <Button
            onClick={handleManualSync}
            disabled={!navigator.onLine || isSyncing}
            className="w-full"
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''} ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {isSyncing
              ? t('جاري المزامنة...', 'Synchronisation en cours...', 'Sincronizando...')
              : t('مزامنة مع الخادم الآن', 'Synchroniser avec le serveur', 'Sincronizar ahora con el servidor')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!delivery) {
    return (
      <Card className="p-6 text-center border-dashed" dir={dir}>
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">
          {t(
            'لم يتم تسجيل إثبات التسليم لهذه الرحلة بعد',
            'Aucune preuve de livraison enregistrée pour ce trajet',
            'No se ha registrado prueba de entrega para este viaje todavía'
          )}
        </p>
      </Card>
    );
  }

  const mapsUrl =
    delivery.latitude && delivery.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${delivery.latitude},${delivery.longitude}`
      : null;

  const formattedDate = new Date(delivery.signed_at).toLocaleString(
    locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'es-ES'
  );

  return (
    <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" dir={dir}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-amiri text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {t('تقرير إثبات التسليم (POD)', 'Preuve de livraison (POD)', 'Informe de Prueba de Entrega (POD)')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('المستلم:', 'Destinataire :', 'Destinatario:')}</span>
            <span className="font-medium text-foreground">{delivery.signed_by}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('وقت التوقيع:', 'Date et heure :', 'Hora de firma:')}</span>
            <span className="font-medium text-foreground">{formattedDate}</span>
          </div>
          {mapsUrl && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t('موقع التسليم:', 'Localisation :', 'Ubicación:')}</span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-mono text-xs"
                dir="ltr"
              >
                {delivery.latitude?.toFixed(5)}, {delivery.longitude?.toFixed(5)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg overflow-hidden border border-border bg-white dark:bg-slate-950">
            <p className="text-xs text-muted-foreground px-2 pt-2">
              {t('توقيع المستلم', 'Signature du destinataire', 'Firma del destinatario')}
            </p>
            <img src={delivery.signature_url} alt="Signature" className="w-full h-32 object-contain p-2" />
          </div>
          {delivery.cmr_image_url && (
            <div className="rounded-lg overflow-hidden border border-border bg-white dark:bg-slate-950">
              <p className="text-xs text-muted-foreground px-2 pt-2">
                {t('صورة الـ CMR المؤشر', 'Photo du CMR visé', 'Foto del CMR sellado')}
              </p>
              <img src={delivery.cmr_image_url} alt="CMR" className="w-full h-32 object-cover" />
            </div>
          )}
        </div>

        <Button onClick={handleViewPdf} className="w-full" variant="default">
          <Download className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
          {t('تحميل وثيقة التسليم (PDF)', 'Télécharger la preuve (PDF)', 'Descargar documento de entrega (PDF)')}
        </Button>
      </CardContent>
    </Card>
  );
}
