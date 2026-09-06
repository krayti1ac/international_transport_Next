'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { submitProofOfDelivery } from '@/features/trips/services/delivery.actions';
import { compressImage } from '@/lib/image-compressor';
import type { TripOrder } from '@/types/database';
import { Camera, MapPin, PenLine, CheckCircle2, Loader2, Trash2, Navigation } from 'lucide-react';

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
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      toast({ title: t('خطأ', 'Erreur'), description: t('المتصفح لا يدعم تحديد الموقع', 'La géolocalisation n’est pas supportée par votre navigateur'), variant: 'destructive' });
      return;
    }
    setGpsStatus('fetching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsStatus('success');
        toast({ title: t('✅ تم تحديد الموقع الجغرافي بنجاح', '✅ Coordonnées GPS récupérées avec succès') });
      },
      () => {
        setGpsStatus('error');
        toast({ title: t('خطأ', 'Erreur'), description: t('فشل الحصول على الموقع الجغرافي', 'Impossible d’obtenir la géolocalisation'), variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [toast, t]);

  const handleCmrChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1280, 1280, 0.7);
      setCmrPreview(URL.createObjectURL(compressed));
    } catch {
      setCmrPreview(URL.createObjectURL(file));
    }
  };

  const getSignatureBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSignature) {
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى التوقيع قبل الإرسال', 'Veuillez apposer votre signature avant de valider'), variant: 'destructive' });
      return;
    }
    if (!recipientName.trim()) {
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى إدخال اسم المستلم', 'Veuillez saisir le nom du destinataire'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const signatureBase64 = getSignatureBase64();
      if (!signatureBase64) throw new Error(t('فشل قراءة التوقيع', 'Échec de lecture de la signature'));

      const result = await submitProofOfDelivery({
        tripOrderId: trip.id,
        signatureBase64,
        recipientName,
        latitude,
        longitude,
        cmrImageBase64: cmrPreview || undefined,
        leg: deliveryLeg,
      });

      if (!result.success) {
        throw new Error(result.error || t('فشل إرسال إثبات التسليم', 'Échec de transmission du POD'));
      }

      setSubmitted(true);
      toast({ title: t('✅ تم تسليم إثبات التسليم بنجاح', '✅ Preuve de livraison validée avec succès') });
      onSuccess?.();
    } catch (err) {
      toast({ title: t('خطأ', 'Erreur'), description: err instanceof Error ? err.message : t('حدث خطأ غير متوقع', 'Une erreur inattendue est survenue'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" dir={dir}>
        <Card className="max-w-md w-full text-center p-8">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <CardTitle className="text-2xl font-amiri mb-2">{t('تم التأكيد بنجاح', 'Confirmation réussie')}</CardTitle>
          <p className="text-muted-foreground mb-6">
            {t('تم تسجيل إثبات التسليم وتحديث حالة الرحلة', 'La preuve de livraison a été enregistrée et le statut du voyage a été mis à jour')}
          </p>
          <Button onClick={onCancel} className="w-full">{t('إغلاق', 'Fermer')}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" dir={dir}>
      <Card className="max-w-lg w-full my-8">
        <CardHeader>
          <CardTitle className="text-xl font-amiri flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            {t('إثبات التسليم', 'Preuve de Livraison (POD)')} - {trip.route}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('توقيع المستلم وتصوير CMR وتحديد الموقع', 'Signature du destinataire, capture du CMR et géolocalisation')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('اسم المستلم', 'Nom du destinataire')}</label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={t('اسم الشخص المستلم للبضاعة', 'Nom de la personne réceptionnant la marchandise')}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('مرحلة التسليم', 'Sens du transport')}</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={deliveryLeg === 'export' ? 'default' : 'outline'}
                  onClick={() => setDeliveryLeg('export')}
                  className="flex-1"
                >
                  {t('ذهاب (Export)', 'Aller (Export)')}
                </Button>
                <Button
                  type="button"
                  variant={deliveryLeg === 'import' ? 'default' : 'outline'}
                  onClick={() => setDeliveryLeg('import')}
                  className="flex-1"
                >
                  {t('عودة (Import)', 'Retour (Import)')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                {t('توقيع المستلم', 'Signature du destinataire')}
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
                {t('مسح التوقيع', 'Effacer la signature')}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {t('صورة CMR المختوم', 'Photo du CMR visé / émargé')}
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
                {cmrPreview ? t('تغيير الصورة', 'Changer la photo') : t('التقاط صورة CMR', 'Prendre photo CMR')}
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
                {t('الموقع الجغرافي', 'Position Géographique GPS')}
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
                    {t('جاري تحديد الموقع...', 'Localisation en cours...')}
                  </>
                ) : gpsStatus === 'success' ? (
                  <>
                    <Navigation className={`w-4 h-4 text-emerald-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('تم تحديد الموقع', 'Position capturée')} ({latitude?.toFixed(4)}, {longitude?.toFixed(4)})
                  </>
                ) : (
                  <>
                    <MapPin className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('تحديد الموقع الحالي', 'Capturer la position GPS')}
                  </>
                )}
              </Button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className={`w-4 h-4 animate-spin ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('جاري الإرسال...', 'Envoi en cours...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('تأكيد التسليم', 'Valider la livraison')}
                  </>
                )}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                  {t('إلغاء', 'Annuler')}
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
              {t('جاري رفع الملفات وتأكيد التسليم...', 'Téléchargement et confirmation en cours...')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
