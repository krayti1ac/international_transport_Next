'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import type { CharterOrder } from '@/features/charter/types/charter.types';
import {
  verifyEpodTokenAction,
  submitExternalEpodAction,
} from '@/features/charter/services/charter.actions';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PenTool,
  MapPin,
  Truck,
  RotateCcw,
  ShieldCheck,
  Send,
  Building,
} from 'lucide-react';

function ExternalEpodContent() {
  const { t, dir } = useLanguage();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [order, setOrder] = useState<CharterOrder | null>(null);

  const [receiverName, setReceiverName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSeal, setSubmittedSeal] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // 1. Verify Token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setTokenValid(false);
      setErrorMessage(t('رابط غير صالح: رمز الوصول مفقود', 'Lien invalide: token manquant', 'Enlace inválido: falta token'));
      return;
    }

    const verify = async () => {
      try {
        const res = await verifyEpodTokenAction(token);
        if (res.isValid && res.order) {
          setTokenValid(true);
          setOrder(res.order);
          if (res.order.status === 'DELIVERED') {
            setSubmittedSeal(res.order.epodHmacSeal || 'CONFIRMED');
            setSubmittedAt(res.order.epodSubmittedAt || null);
            setReceiverName(res.order.epodReceiverName || '');
          }
        } else {
          setTokenValid(false);
          setErrorMessage(res.error || t('انتهت صلاحية الرابط أو تم إلغاؤه', 'Lien expiré ou invalide', 'Enlace expirado'));
        }
      } catch {
        setTokenValid(false);
        setErrorMessage(t('فشل التحقق من الرابط', 'Échec de vérification', 'Error de verificación'));
      } finally {
        setLoading(false);
      }
    };

    verify();

    // Fetch GPS Geolocation if available
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Fallback gracefully without error
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [token]);

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !order) return;
    if (!hasSignature) {
      toast({
        title: t('توقيع المستلم مطلوب', 'Signature requise', 'Firma requerida'),
        description: t('يرجى توقيع المستلم على الشاشة قبل التأكيد', 'Veuillez signer sur l\'écran', 'Por favor firme en la pantalla'),
        variant: 'destructive',
      });
      return;
    }

    const canvas = canvasRef.current;
    const signatureBase64 = canvas ? canvas.toDataURL('image/png') : '';

    setSubmitting(true);
    try {
      const res = await submitExternalEpodAction({
        token,
        orderNumber: order.orderNumber,
        receiverName: receiverName.trim(),
        signatureBase64,
        latitude: coords.lat,
        longitude: coords.lng,
        notes,
      });

      if (res.success && res.hmacSeal) {
        setSubmittedSeal(res.hmacSeal);
        setSubmittedAt(res.submittedAt || new Date().toISOString());
        toast({
          title: t('تم تأكيد التسليم بنجاح', 'Livraison Confirmée', 'Entrega Confirmada'),
          description: t('تم إصدار الختم الجنائي المشفر لحماية التسليم', 'e-POD cryptographiquement scellé', 'e-POD sellado'),
        });
      } else {
        toast({
          title: t('فشل تسجيل التسليم', "Échec de validation", 'Error de validación'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue', 'Error inesperado'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-xs text-muted-foreground">{t('جاري التحقق من صلاحية رابط التسليم...', 'Vérification du lien...')}</p>
        </div>
      </div>
    );
  }

  if (!tokenValid || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" dir={dir}>
        <Card className="max-w-md w-full border-destructive/30 text-center p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">{t('تعذر فتح رابط التسليم', 'Accès Refusé', 'Acceso Denegado')}</h2>
          <p className="text-xs text-muted-foreground">{errorMessage}</p>
        </Card>
      </div>
    );
  }

  // Already Submitted / Success View
  if (submittedSeal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" dir={dir}>
        <Card className="max-w-lg w-full border-emerald-500/40 shadow-xl overflow-hidden">
          <div className="bg-emerald-600 text-white p-6 text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold">{t('تم تسجيل إثبات التسليم بنجاح', 'e-POD Certifié & Scellé', 'e-POD Certificado')}</h2>
            <p className="text-xs text-emerald-100">
              {t('تم قفل وتوثيق استلام الشحنة رسمياً في منظومة Trans Bodanon', 'Livraison officiellement enregistrée')}
            </p>
          </div>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1.5 border border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('رقم أمر النقل:', "N° Ordre:")}</span>
                <span className="font-mono font-bold text-foreground">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('المستلم المعتمد:', 'Destinataire:')}</span>
                <span className="font-semibold text-foreground">{receiverName || order.epodReceiverName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('توقيت التسليم:', 'Horodatage:')}</span>
                <span className="font-mono text-foreground">{submittedAt || new Date().toISOString()}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-900 text-slate-200 rounded-lg space-y-1 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('الختم الجنائي المشفر (HMAC-SHA256)', 'Sceau Cryptographique HMAC')}</span>
              </div>
              <p className="font-mono text-[10px] break-all text-slate-400">{submittedSeal}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active Submission Form
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8" dir={dir}>
      <div className="max-w-xl mx-auto space-y-5">
        {/* Brand Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Trans Bodanon TMS</h3>
              <p className="text-[11px] text-muted-foreground">{t('بوابة التسليم الخارجي اللاتلامسي (e-POD)', 'Portail e-POD Partenaire')}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 font-mono text-[11px]">
            {order.orderNumber}
          </Badge>
        </div>

        {/* Order Details Summary Card */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>{order.originCity} ➔ {order.destinationCity}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {order.cargoDescription} • {order.cargoWeightKg} kg • CMR: {order.cmrNumber}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>{t('الناقل المستأجر:', 'Transporteur:')}</span>
              <span className="font-semibold text-foreground">{order.carrier.companyName}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('السائق:', 'Chauffeur:')}</span>
              <span className="font-semibold text-foreground">{order.driver.name}</span>
            </div>
          </CardContent>
        </Card>

        {/* POD FORM */}
        <Card className="border-border/80 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PenTool className="w-4 h-4 text-amber-500" />
              <span>{t('تأكيد الاستلام والتوقيع الإلكتروني', 'Confirmation & Signature')}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {t('يرجى إدخال اسم المستلم وتوقيعه على الشاشة أدناه لإتمام التسليم.', 'Veuillez saisir le nom et signer.')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t('اسم الشخص المستلم للبضاعة *', 'Nom du Réceptionnaire *')}
                </label>
                <Input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder={t('مثال: سفيان العلمي / Juan Alvarez', 'Ex: Juan Alvarez')}
                  required
                  className="h-9 text-xs"
                />
              </div>

              {/* Signature Pad Canvas */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground">
                    {t('توقيع المستلم على الشاشة *', 'Signature Électronique *')}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearCanvas}
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('مسح التوقيع', 'Effacer', 'Borrar')}</span>
                  </Button>
                </div>

                <div className="border border-border/80 rounded-xl overflow-hidden bg-white touch-none">
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={180}
                    className="w-full h-44 cursor-crosshair bg-white"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('وقع بإصبعك أو القلم على المربع الأبيض أعلاه', 'Signez avec le doigt ou stylet ci-dessus')}
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t('ملاحظات التسليم (اختياري)', 'Observations de livraison')}
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('تم تفريغ البضاعة بحالة سليمة...', 'Marchandise conforme sans réserve...')}
                  className="h-9 text-xs"
                />
              </div>

              {coords.lat && coords.lng && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('تم تسجيل إحداثيات الـ GPS للتفريغ بنجاح', 'Position GPS enregistrée')}: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !receiverName.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-sm rounded-xl gap-2 shadow-md"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{t('تأكيد التسليم وختم الـ e-POD جنائياً', 'Valider la Livraison & Sceller e-POD')}</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ExternalEpodPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <ExternalEpodContent />
    </Suspense>
  );
}

