'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, RefreshCw, Scan, Sparkles, WifiOff } from 'lucide-react';
import { compressImage } from '@/lib/image-compressor';
import { saveToOfflineQueue, getOfflineQueue, processOfflineQueue } from '@/lib/offline-sync';
import { processFuelReceiptOCR } from '@/features/fleet/services/ocr.actions';
import { OfflineSyncBadge } from '@/components/offline-sync-badge';
import { useLanguage } from '@/components/language-provider';
import { useAutoIssueReporter } from '@/hooks/useAutoIssueReporter';
import Decimal from 'decimal.js';

export default function FuelReceiptScanPage() {
  const { t, dir } = useLanguage();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [station, setStation] = useState('');
  const [liters, setLiters] = useState('');
  const [currency, setCurrency] = useState<'MAD' | 'EUR'>('MAD');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const { reportValidation, reportSubmissionError } = useAutoIssueReporter({
    screenName: 'تسجيل وصل وقود (OCR)',
    screenRoute: '/fuel-receipt',
    componentName: 'FuelReceiptScanPage',
  });

  const handleSyncQueue = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const { successCount } = await processOfflineQueue();
      if (successCount > 0) {
        toast({
          title: t(`✅ تمت مزامنة ${successCount} إيصال محفوظ بنجاح`, `✅ ${successCount} reçus synchronisés avec succès`),
        });
      }
    } finally {
      setIsSyncing(false);
      setPendingCount(getOfflineQueue().length);
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setPendingCount(getOfflineQueue().length);
    setDate(new Date().toISOString().split('T')[0]);

    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: t('🌐 عاد الاتصال بالإنترنت', '🌐 Connexion Internet rétablie') });
      handleSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: t('⚠️ انقطع الاتصال - تم تفعيل الحفظ المحلي (Offline)', '⚠️ Hors ligne - Mode hors connexion activé'),
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setIsScanning(true);
    setConfidence(null);

    try {
      const compressed = await compressImage(file, 1280, 1280, 0.75);
      setImage(compressed);
      setPreview(URL.createObjectURL(compressed));

      if (navigator.onLine) {
        const base64 = await fileToBase64(compressed);
        const ocrRes = await processFuelReceiptOCR(base64);

        if (ocrRes.success && ocrRes.data) {
          const { data } = ocrRes;
          if (data.amount) setAmount(data.amount.toString());
          if (data.date) setDate(data.date);
          if (data.station) setStation(data.station);
          if (data.liters) setLiters(data.liters.toString());
          if (data.currency) setCurrency(data.currency);
          setConfidence(data.confidence);
          setOcrText(data.rawText);

          toast({
            title: t('✨ تم استخراج البيانات بالذكاء الاصطناعي', '✨ Données extraites par IA'),
            description: `${t('نسبة الثقة:', 'Taux de confiance :')} ${data.confidence}% - ${t('يرجى مراجعة الحقول وتأكيدها.', 'Veuillez vérifier et confirmer les champs.')}`,
          });
        } else {
          toast({
            title: t('تنبيه', 'Attention'),
            description: ocrRes.error || t('تعذر القراءة التلقائية، يرجى ملء الحقول يدوياً.', 'Lecture automatique impossible, veuillez remplir manuellement.'),
          });
        }
      } else {
        toast({
          title: t('الوضع غير متصل', 'Mode hors ligne'),
          description: t('تم ضغط الصورة وحفظها، سيتم إرسالها دون معالجة OCR سحابية.', 'Image compressée et sauvegardée, synchronisation ultérieure sans OCR cloud.'),
        });
      }
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('حدث خطأ أثناء معالجة الصورة', 'Une erreur est survenue lors du traitement de l\'image'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setIsScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date) {
      reportValidation({
        fieldName: !amount ? 'amount' : 'date',
        rejectedValue: !amount ? amount : date,
        validationRule: 'المبلغ والتاريخ حقول إلزامية لحفظ إيصال الوقود',
        errorMessage: 'يرجى إدخال المبلغ والتاريخ قبل محاولة الحفظ',
        formData: { amount, date, station, liters, currency },
      });
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى إدخال المبلغ والتاريخ', 'Veuillez renseigner le montant et la date'), variant: 'destructive' });
      return;
    }

    let parsedAmount: number;
    try {
      const dec = new Decimal(amount);
      if (dec.lessThanOrEqualTo(0) || !dec.isFinite()) {
        throw new Error('قيمة المبلغ غير صالحة');
      }
      parsedAmount = dec.toNumber();
    } catch {
      reportValidation({
        fieldName: 'amount',
        rejectedValue: amount,
        validationRule: 'يجب أن يكون المبلغ رقماً موجباً أكبر من صفر',
        errorMessage: 'صيغة المبلغ المدخل غير صحيحة أو أقل من الصفر',
        formData: { amount, date, station, liters, currency },
      });
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى إدخال مبلغ صحيح', 'Veuillez saisir un montant valide'), variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: driverData } = await supabase
        .from('drivers')
        .select('default_truck_id')
        .eq('user_id', session?.user?.id || '')
        .maybeSingle();

      const assignedTruckId = driverData?.default_truck_id || null;
      const notesDetails = [
        station ? `${t('المحطة:', 'Station :')} ${station}` : null,
        liters ? `${t('الكمية:', 'Quantité :')} ${liters} L` : null,
        confidence ? `${t('دقة المسح:', 'Précision scan :')} ${confidence}%` : null,
        ocrText ? `${t('النص الأصلي:', 'Texte brut :')}\n${ocrText}` : null,
      ].filter(Boolean).join('\n');

      if (!navigator.onLine) {
        let base64 = '';
        if (image) {
          base64 = await fileToBase64(image);
        }
        saveToOfflineQueue({
          truck_id: assignedTruckId,
          amount: parsedAmount,
          currency,
          date,
          notes: notesDetails,
          imageDataBase64: base64,
          fileName: `offline-fuel-${Date.now()}.jpg`,
        });

        toast({ title: t('💾 تم حفظ الإيصال محلياً، وستتم مزامنته آلياً فور توفر الشبكة', '💾 Reçu enregistré localement, synchronisation dès retour du réseau') });
        setPendingCount(getOfflineQueue().length);
      } else {
        let imageUrl = '';
        if (image && session?.user) {
          const fileName = `fuel-${session.user.id}-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage.from('fuel-receipts').upload(fileName, image);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('fuel-receipts').getPublicUrl(fileName);
            imageUrl = publicUrl;
          }
        }

        const finalNotes = imageUrl ? `${notesDetails}\n\n${t('رابط الإيصال:', 'Lien reçu :')} ${imageUrl}` : notesDetails;

        const { error } = await supabase.from('truck_maintenance').insert({
          truck_id: assignedTruckId,
          type: 'fuel',
          expense_type: 'fuel',
          amount: parsedAmount,
          currency,
          maintenance_date: date,
          notes: finalNotes,
          payment_method: 'cash',
        });

        if (error) throw error;
        toast({ title: t('✅ تم تسجيل وحفظ إيصال الوقود في النظام بنجاح', '✅ Reçu de carburant enregistré avec succès') });
      }

      setAmount('');
      setStation('');
      setLiters('');
      setImage(null);
      setPreview(null);
      setOcrText('');
      setConfidence(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('فشل حفظ الإيصال', 'Échec de l\'enregistrement du reçu');
      reportSubmissionError({
        operationName: 'تسجيل وصل وقود (truck_maintenance)',
        error,
        formData: { amount, date, station, liters, currency },
      });
      toast({ title: t('خطأ في الحفظ', 'Erreur d\'enregistrement'), description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Scan className="w-6 h-6 text-primary" />
            {t('مسح إيصالات الوقود (OCR)', 'Numérisation des Reçus de Carburant (OCR)')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'التقط الفاتورة لاستخراج المبلغ واسم المحطة واللترات آلياً',
              'Prenez le reçu en photo pour extraire automatiquement le montant, la station et les litres'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 border border-rose-500/30 animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              {t('غير متصل', 'Hors ligne')}
            </span>
          )}
          {pendingCount > 0 && (
            <Button size="sm" variant="outline" onClick={handleSyncQueue} disabled={isSyncing || !isOnline} className="rounded-xl text-xs gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{t(`مزامنة (${pendingCount})`, `Synchroniser (${pendingCount})`)}</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>{t('التقاط صورة الإيصال', 'Capture du reçu')}</span>
            {confidence !== null && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('دقة القراءة:', 'Précision :')} {confidence}%
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 rounded-2xl p-6 text-center transition-colors overflow-hidden">
                {preview ? (
                  <div className="space-y-3">
                    <div className="relative inline-block max-h-72 rounded-xl overflow-hidden shadow-md">
                      <img src={preview} alt="Receipt Preview" className="max-h-72 object-contain" />
                      {isScanning && (
                        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                          <div className="w-full h-1 bg-primary absolute top-0 animate-[bounce_2s_infinite]" />
                          <Scan className="w-8 h-8 text-primary animate-pulse" />
                          <span className="text-xs font-bold text-primary bg-background/90 px-3 py-1 rounded-full shadow">
                            {t('جاري فحص واستخراج البيانات...', 'Analyse et extraction des données en cours...')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setImage(null); setPreview(null); setConfidence(null); }}
                        className="rounded-xl text-xs"
                      >
                        {t('إلغاء واختيار صورة أخرى', 'Annuler et choisir une autre photo')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4">
                    <Camera className="w-12 h-12 mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-semibold text-foreground mb-1">{t('التقط صورة واضحة للفاتورة', 'Prenez une photo nette du reçu')}</p>
                    <p className="text-xs text-muted-foreground mb-4">{t('احرص على إظهار المجموع واللترات وتاريخ التزود بوضوح', 'Assurez-vous que le montant, les litres et la date soient bien lisibles')}</p>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      className="hidden"
                      id="receipt-camera-input"
                    />
                    
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl shadow-xs gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{t('فتح الكاميرا / اختيار صورة', 'Ouvrir la caméra / Choisir une image')}</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t('المبلغ الإجمالي *', 'Montant Total *')}</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    dir="ltr"
                    className="font-mono text-base font-bold rounded-xl h-10"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'MAD' | 'EUR')}
                    className="w-24 h-10 px-2 border border-input bg-card text-foreground rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="MAD">MAD (درهم)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t('التاريخ *', 'Date *')}</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  dir="ltr"
                  className="rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t('اسم المحطة أو المزود', 'Station ou Fournisseur')}</label>
                <Input
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  placeholder={t('مثال: Afriquia Port Tanger Med', 'Ex: Afriquia Port Tanger Med')}
                  className="rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t('الكمية المسجلة (لتر)', 'Quantité (Litres)')}</label>
                <Input
                  type="number"
                  step="0.1"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  placeholder={t('مثال: 350', 'Ex: 350')}
                  dir="ltr"
                  className="font-mono rounded-xl h-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !amount || !date}
              className="w-full h-11 text-base font-bold rounded-xl mt-4"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('جاري الحفظ والمزامنة...', 'Enregistrement et synchronisation en cours...')}</span>
                </div>
              ) : isOnline ? (
                t('تسجيل وحفظ الإيصال', 'Enregistrer le reçu')
              ) : (
                t('حفظ محلياً في الهاتف (Offline)', 'Sauvegarder localement (Hors ligne)')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <OfflineSyncBadge />
    </div>
  );
}
