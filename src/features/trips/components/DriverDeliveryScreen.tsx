'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
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
      toast({ title: 'خطأ', description: 'المتصفح لا يدعم تحديد الموقع', variant: 'destructive' });
      return;
    }
    setGpsStatus('fetching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsStatus('success');
        toast({ title: '✅ تم تحديد الموقع الجغرافي بنجاح' });
      },
      () => {
        setGpsStatus('error');
        toast({ title: 'خطأ', description: 'فشل الحصول على الموقع الجغرافي', variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [toast]);

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
      toast({ title: 'خطأ', description: 'يرجى التوقيع قبل الإرسال', variant: 'destructive' });
      return;
    }
    if (!recipientName.trim()) {
      toast({ title: 'خطأ', description: 'يرجى إدخال اسم المستلم', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const signatureBase64 = getSignatureBase64();
      if (!signatureBase64) throw new Error('فشل قراءة التوقيع');

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
        throw new Error(result.error || 'فشل إرسال إثبات التسليم');
      }

      setSubmitted(true);
      toast({ title: '✅ تم تسليم إثبات التسليم بنجاح' });
      onSuccess?.();
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'حدث خطأ غير متوقع', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" dir="rtl">
        <Card className="max-w-md w-full text-center p-8">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <CardTitle className="text-2xl font-amiri mb-2">تم التأكيد بنجاح</CardTitle>
          <p className="text-muted-foreground mb-6">تم تسجيل إثبات التسليم وتحديث حالة الرحلة</p>
          <Button onClick={onCancel} className="w-full">إغلاق</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
      <Card className="max-w-lg w-full my-8">
        <CardHeader>
          <CardTitle className="text-xl font-amiri flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            إثبات التسليم - {trip.route}
          </CardTitle>
          <p className="text-sm text-muted-foreground">توقيع المستلم وتصوير CMR وتحديد الموقع</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">اسم المستلم</label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="اسم الشخص المستلم للبضاعة"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">مرحلة التسليم</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={deliveryLeg === 'export' ? 'default' : 'outline'}
                  onClick={() => setDeliveryLeg('export')}
                  className="flex-1"
                >
                  ذهاب (Export)
                </Button>
                <Button
                  type="button"
                  variant={deliveryLeg === 'import' ? 'default' : 'outline'}
                  onClick={() => setDeliveryLeg('import')}
                  className="flex-1"
                >
                  عودة (Import)
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                توقيع المستلم
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
                <Trash2 className="w-4 h-4 ml-2" />
                مسح التوقيع
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Camera className="w-4 h-4" />
                صورة CMR المختوم
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
                <Camera className="w-4 h-4 ml-2" />
                {cmrPreview ? 'تغيير الصورة' : 'التقاط صورة CMR'}
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
                الموقع الجغرافي
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
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري تحديد الموقع...
                  </>
                ) : gpsStatus === 'success' ? (
                  <>
                    <Navigation className="w-4 h-4 ml-2 text-emerald-500" />
                    تم تحديد الموقع ({latitude?.toFixed(4)}, {longitude?.toFixed(4)})
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 ml-2" />
                    تحديد الموقع الحالي
                  </>
                )}
              </Button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                    تأكيد التسليم
                  </>
                )}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                  إلغاء
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
            <span className="text-foreground font-medium">جاري رفع الملفات وتأكيد التسليم...</span>
          </div>
        </div>
      )}
    </div>
  );
}
