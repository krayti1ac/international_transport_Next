'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { submitProofOfDelivery } from '@/features/trips/services/delivery.actions';
import { compressImage } from '@/lib/image-compressor';
import {
  savePodSignatureToOfflineQueue,
  processPodSignaturesOfflineQueue,
} from '@/lib/offline-sync';
import type { TripOrder } from '@/types/database';
import {
  Camera,
  MapPin,
  PenLine,
  CheckCircle2,
  Loader2,
  Trash2,
  Navigation,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

interface DriverDeliveryScreenProps {
  trip: TripOrder;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DriverDeliveryScreen({ trip, onSuccess, onCancel }: DriverDeliveryScreenProps) {
  const { t, dir } = useLanguage();
  const [recipientName, setRecipientName] = useState('');
  const [deliveryLeg, setDeliveryLeg] = useState<'export' | 'import'>('export');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [cmrPreview, setCmrPreview] = useState<string | null>(null);
  const [cmrBase64, setCmrBase64] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        processPodSignaturesOfflineQueue().then((res) => {
          if (res.successCount > 0) {
            toast({
              title: t('🌐 تم استعادة الاتصال بالإنترنت', '🌐 Connexion Internet rétablie', '🌐 Conexión a Internet restablecida'),
              description: t(
                `تمت مزامنة ${res.successCount} إثبات تسليم في الخلفية بنجاح`,
                `${res.successCount} preuve(s) de livraison synchronisée(s) en arrière-plan`,
                `${res.successCount} prueba(s) de entrega sincronizada(s) en segundo plano`
              ),
            });
          }
        }).catch(console.error);
      }
    };

    const handleOfflineStatus = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, [t, toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = useCallback((e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getPos]);

  const draw = useCallback((e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }, [isDrawing, getPos]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  const captureGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: t('المتصفح لا يدعم تحديد الموقع', 'La géolocalisation n’est pas supportée par votre navigateur', 'El navegador no soporta geolocalización'),
        variant: 'destructive',
      });
      return;
    }
    setGpsStatus('fetching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsStatus('success');
        toast({
          title: t('✅ تم تحديد الموقع الجغرافي بنجاح', '✅ Coordonnées GPS récupérées avec succès', '✅ Posición GPS capturada con éxito'),
        });
      },
      () => {
        setGpsStatus('error');
        toast({
          title: t('خطأ', 'Erreur', 'Error'),
          description: t('فشل الحصول على الموقع الجغرافي', 'Impossible d’obtenir la géolocalisation', 'Error al obtener la ubicación GPS'),
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [toast, t]);

  const handleCmrChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Use adaptive compression configured for roaming / network bandwidth
      const compressed = await compressImage(file);
      setCmrPreview(URL.createObjectURL(compressed));

      const reader = new FileReader();
      reader.onload = () => {
        setCmrBase64(reader.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch {
      setCmrPreview(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onload = () => {
        setCmrBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getSignatureBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSignature) {
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: t('يرجى التوقيع قبل الإرسال', 'Veuillez apposer votre signature avant de valider', 'Por favor firme antes de enviar'),
        variant: 'destructive',
      });
      return;
    }
    if (!recipientName.trim()) {
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: t('يرجى إدخال اسم المستلم', 'Veuillez saisir le nom du destinataire', 'Por favor ingrese el nombre del destinatario'),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const signatureBase64 = getSignatureBase64();
      if (!signatureBase64) {
        throw new Error(t('فشل قراءة التوقيع', 'Échec de lecture de la signature', 'Error al leer la firma'));
      }

      const idempotencyKey = `pod_${trip.id}_${deliveryLeg}_${recipientName.trim().toLowerCase()}`;

      // 1. Offline Mode: Immediately store in IndexedDB
      if (!navigator.onLine) {
        await savePodSignatureToOfflineQueue({
          trip_id: trip.id,
          signed_by: recipientName.trim(),
          signature_base64: signatureBase64,
          cmr_image_base64: cmrBase64 || undefined,
          latitude,
          longitude,
          signed_at: new Date().toISOString(),
          leg: deliveryLeg,
          idempotency_key: idempotencyKey,
        });

        setSavedOffline(true);
        setSubmitted(true);
        toast({
          title: t('تم الحفظ محلياً - بانتظار المزامنة 🔄', 'Enregistré localement - En attente de synchronisation 🔄', 'Guardado localmente - Pendiente de sincronización 🔄'),
          description: t(
            'أنت في وضع عدم الاتصال (Offline). تم حفظ إثبات التسليم بأمان في هاتفك وستتم المزامنة تلقائياً عند عودة الشبكة.',
            'Mode hors ligne actif. POD sauvegardé localement, synchronisation automatique dès retour du réseau.',
            'Modo sin conexión activo. POD guardado localmente, sincronización automática al volver a tener red.'
          ),
        });
        onSuccess?.();
        return;
      }

      // 2. Online Mode: Submit directly to Supabase with fallback to Offline Queue
      try {
        const result = await submitProofOfDelivery({
          tripOrderId: trip.id,
          signatureBase64,
          recipientName: recipientName.trim(),
          latitude,
          longitude,
          cmrImageBase64: cmrBase64 || cmrPreview || undefined,
          leg: deliveryLeg,
        });

        if (!result.success) {
          throw new Error(result.error || t('فشل إرسال إثبات التسليم', 'Échec de transmission du POD', 'Error al enviar POD'));
        }

        setSavedOffline(false);
        setSubmitted(true);
        toast({
          title: t('✅ تم تسليم إثبات التسليم بنجاح', '✅ Preuve de livraison validée avec succès', '✅ Prueba de entrega validada con éxito'),
        });
        onSuccess?.();
      } catch (onlineErr) {
        console.warn('Online submission failed, persisting to offline queue as fallback:', onlineErr);
        await savePodSignatureToOfflineQueue({
          trip_id: trip.id,
          signed_by: recipientName.trim(),
          signature_base64: signatureBase64,
          cmr_image_base64: cmrBase64 || undefined,
          latitude,
          longitude,
          signed_at: new Date().toISOString(),
          leg: deliveryLeg,
          idempotency_key: idempotencyKey,
        });

        setSavedOffline(true);
        setSubmitted(true);
        toast({
          title: t('تم الحفظ محلياً - بانتظار المزامنة 🔄', 'Enregistré localement - En attente de synchronisation 🔄', 'Guardado localmente - Pendiente de sincronización 🔄'),
          description: t(
            'تعذر الاتصال بالخادم. تم حفظ إثبات التسليم بأمان محلياً في هاتفك وستتم المزامنة تلقائياً.',
            'Connexion au serveur échouée. POD sécurisé localement, synchronisation automatique dès retour en ligne.',
            'Conexión fallida. POD guardado localmente, sincronización automática al volver en línea.'
          ),
        });
        onSuccess?.();
      }
    } catch (err) {
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: err instanceof Error ? err.message : t('حدث خطأ غير متوقع', 'Une erreur inattendue est survenue', 'Ocurrió un error inesperado'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" dir={dir}>
        <Card className="max-w-md w-full text-center p-8">
          {savedOffline ? (
            <div className="w-16 h-16 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          )}

          <CardTitle className="text-2xl font-amiri mb-2">
            {savedOffline
              ? t('تم الحفظ محلياً - بانتظار المزامنة 🔄', 'Enregistré localement - En attente de synchronisation 🔄', 'Guardado localmente - Pendiente de sincronización 🔄')
              : t('تم التأكيد بنجاح', 'Confirmation réussie', 'Confirmación exitosa')}
          </CardTitle>

          <p className="text-muted-foreground mb-6 text-sm">
            {savedOffline
              ? t(
                  'تم حفظ التوقيع وبيانات التسليم في ذاكرة الهاتف الآمنة. سيتم إرسالها إلى الإدارة فور اتصالك بالإنترنت.',
                  'La signature et la preuve sont stockées sur votre appareil. Elles seront téléversées dès reconnexion.',
                  'La firma y la prueba están guardadas en el dispositivo. Se enviarán tan pronto como se restablezca la conexión.'
                )
              : t(
                  'تم تسجيل إثبات التسليم وتحديث حالة الرحلة لدى الشركة والعميل.',
                  'La preuve de livraison a été enregistrée et le statut du voyage a été mis à jour.',
                  'La prueba de entrega ha sido registrada y el estado del viaje ha sido actualizado.'
                )}
          </p>
          <Button onClick={onCancel} className="w-full">
            {t('إغلاق', 'Fermer', 'Cerrar')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" dir={dir}>
      <Card className="max-w-lg w-full my-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-amiri flex items-center gap-2">
              <PenLine className="w-5 h-5 text-primary" />
              {t('إثبات التسليم', 'Preuve de Livraison (POD)', 'Prueba de Entrega (POD)')} - {trip.route}
            </CardTitle>
            {!isOnline && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 border border-rose-500/30 font-bold">
                <WifiOff className="w-3 h-3" />
                {t('وضع غير متصل', 'Hors ligne', 'Sin conexión')}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              'توقيع المستلم وتصوير CMR وتحديد الموقع الجغرافي',
              'Signature du destinataire, capture du CMR et géolocalisation',
              'Firma del destinatario, captura de CMR y geolocalización'
            )}
          </p>

          {!isOnline && (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>
                {t(
                  'الوضع غير المتصل (Offline) نشط — سيتم حفظ التوقيع محلياً ومزامنته تلقائياً عند استعادة الاتصال.',
                  'Mode hors ligne actif — la signature sera sauvegardée localement et synchronisée automatiquement.',
                  'Modo sin conexión activo — la firma se guardará localmente y se sincronizará automáticamente.'
                )}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('اسم المستلم', 'Nom du destinataire', 'Nombre del destinatario')}
              </label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={t(
                  'اسم الشخص المستلم للبضاعة',
                  'Nom de la personne réceptionnant la marchandise',
                  'Nombre de la persona que recibe la mercancía'
                )}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('مرحلة التسليم', 'Sens du transport', 'Sentido del transporte')}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={deliveryLeg === 'export' ? 'default' : 'outline'}
                  onClick={() => setDeliveryLeg('export')}
                  className="flex-1"
                >
                  {t('ذهاب (Export)', 'Aller (Export)', 'Ida (Export)')}
                </Button>
                <Button
                  type="button"
                  variant={deliveryLeg === 'import' ? 'default' : 'outline'}
                  onClick={() => setDeliveryLeg('import')}
                  className="flex-1"
                >
                  {t('عودة (Import)', 'Retour (Import)', 'Vuelta (Import)')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                {t('توقيع المستلم الحي', 'Signature du destinataire', 'Firma del destinatario')}
              </label>
              <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white dark:bg-slate-950 touch-none">
                <canvas
                  ref={canvasRef}
                  className="w-full h-40 cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={clearSignature} className="w-full">
                <Trash2 className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                {t('مسح التوقيع', 'Effacer la signature', 'Borrar firma')}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {t('صورة CMR المختوم', 'Photo du CMR visé / émargé', 'Foto del CMR sellado')}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCmrChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Camera className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                {cmrPreview
                  ? t('تغيير الصورة', 'Changer la photo', 'Cambiar foto')
                  : t('التقاط صورة CMR (ضغط تكيفي)', 'Prendre photo CMR (Compression adaptative)', 'Tomar foto CMR (Compresión adaptativa)')}
              </Button>
              {cmrPreview && (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={cmrPreview} alt="CMR Preview" className="w-full h-48 object-cover" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t('الموقع الجغرافي', 'Position Géographique GPS', 'Posición Geográfica GPS')}
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={captureGPS}
                disabled={gpsStatus === 'fetching'}
                className="w-full"
              >
                {gpsStatus === 'fetching' ? (
                  <>
                    <Loader2 className={`w-4 h-4 animate-spin ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('جاري تحديد الموقع بدقة عالية...', 'Localisation haute précision en cours...', 'Ubicando con alta precisión...')}
                  </>
                ) : gpsStatus === 'success' ? (
                  <>
                    <Navigation className={`w-4 h-4 text-emerald-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('تم تحديد الموقع', 'Position capturée', 'Posición capturada')} ({latitude?.toFixed(4)}, {longitude?.toFixed(4)})
                  </>
                ) : (
                  <>
                    <MapPin className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('تحديد الموقع الحالي GPS', 'Capturer la position GPS', 'Capturar posición GPS')}
                  </>
                )}
              </Button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className={`w-4 h-4 animate-spin ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('جاري الحفظ والمعالجة...', 'Traitement en cours...', 'Procesando...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('تأكيد التسليم', 'Valider la livraison', 'Validar entrega')}
                  </>
                )}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                  {t('إلغاء', 'Annuler', 'Cancelar')}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {submitting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-3 shadow-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-foreground font-medium">
              {t(
                'جاري معالجة إثبات التسليم والتخزين الآمن...',
                'Traitement du POD et sécurisation en cours...',
                'Procesando POD y almacenamiento seguro...'
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
