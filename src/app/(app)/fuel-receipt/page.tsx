'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, FileText, Scan, WifiOff, RefreshCw } from 'lucide-react';
import { compressImage } from '@/lib/image-compressor';
import { saveToOfflineQueue, getOfflineQueue, processOfflineQueue } from '@/lib/offline-sync';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';

export default function FuelReceiptScanPage() {
  const { t, dir, locale } = useLanguage();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [station, setStation] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setPendingCount(getOfflineQueue().length);

    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: t('🌐 عاد الاتصال بالإنترنت', '🌐 Connexion Internet rétablie') });
      handleSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: t('⚠️ انقطع الاتصال - تم تفعيل الحفظ المحلي (Offline)', '⚠️ Hors ligne - Mode local activé'),
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [t]);

  const handleSyncQueue = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const { successCount } = await processOfflineQueue();
      if (successCount > 0) {
        toast({
          title: t(`✅ تمت مزامنة ${successCount} إيصال محفوظ بنجاح`, `✅ ${successCount} reçu(s) synchronisé(s) avec succès`),
        });
      }
    } finally {
      setIsSyncing(false);
      setPendingCount(getOfflineQueue().length);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file);
        setImage(compressed);
        setPreview(URL.createObjectURL(compressed));
        simulateOCR(compressed);
      } catch {
        setImage(file);
        setPreview(URL.createObjectURL(file));
      } finally {
        setLoading(false);
      }
    }
  };

  const simulateOCR = async (_file: File) => {
    setTimeout(() => {
      setOcrText(locale === 'fr' 
        ? 'Station Afriquia - Tanger Med\nQuantité : 45.5 L\nMontant : 650.00 MAD' 
        : 'محطة إفريقيا - طنجة المتوسط\nالكمية: 45.5 لتر\nالمبلغ: 650.00 درهم');
      setAmount('650');
      setDate(new Date().toISOString().split('T')[0]);
      setStation(locale === 'fr' ? 'Station Afriquia - Tanger Med' : 'محطة إفريقيا - طنجة المتوسط');
    }, 1500);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: driverData } = await supabase
        .from('drivers')
        .select('default_truck_id')
        .eq('user_id', session?.user?.id || '')
        .maybeSingle();

      const assignedTruckId = driverData?.default_truck_id || null;
      const parsedAmount = new Decimal(amount || '0').toNumber();

      if (!navigator.onLine) {
        let base64 = '';
        if (image) {
          base64 = await fileToBase64(image);
        }
        saveToOfflineQueue({
          truck_id: assignedTruckId,
          amount: parsedAmount,
          currency: 'MAD',
          date,
          notes: `${t('المحطة: ', 'Station : ')}${station}\n${ocrText}`,
          imageDataBase64: base64,
          fileName: `offline-fuel-${Date.now()}.jpg`,
        });

        toast({ title: t('💾 تم حفظ الإيصال محلياً، ستتم المزامنة تلقائياً عند توفر الإنترنت', '💾 Reçu enregistré localement. Synchronisation automatique dès la reconnexion.') });
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

        const { error } = await supabase.from('truck_maintenance').insert({
          truck_id: assignedTruckId,
          expense_type: 'fuel',
          amount: parsedAmount,
          maintenance_date: date || new Date().toISOString(),
          description: `${station}\n\n${t('بيانات الفاتورة:', 'Détails de la facture :')}\n${ocrText}\n\n${t('رابط الإيصال:', 'Lien du reçu :')} ${imageUrl}`,
          payment_method: 'cash',
        });

        if (error) throw error;
        toast({ title: t('✅ تم تسجيل وحفظ إيصال الوقود بنجاح', '✅ Reçu de carburant enregistré avec succès') });
      }

      setAmount('');
      setDate('');
      setStation('');
      setImage(null);
      setPreview(null);
      setOcrText('');
    } catch (error: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">
            {t('مسح إيصالات الوقود', 'Scan des Reçus de Carburant')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('تسجيل فواتير الديزل الميدانية وضغطها تلقائياً', 'Enregistrement et compression automatique des tickets de gasoil')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 border border-rose-500/30 animate-pulse">
              <WifiOff className="w-3.5 h-3.5" /> {t('غير متصل', 'Hors ligne')}
            </span>
          )}
          {pendingCount > 0 && (
            <Button size="sm" variant="outline" onClick={handleSyncQueue} disabled={isSyncing || !isOnline}>
              <RefreshCw className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} ${isSyncing ? 'animate-spin' : ''}`} />
              {t('مزامنة', 'Synchroniser')} ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="font-amiri text-foreground">
            {t('التقاط أو رفع الفاتورة', 'Prendre une photo ou importer')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('صورة الإيصال', 'Photo du reçu')}</label>
              <div className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 rounded-xl p-6 text-center transition-colors">
                {preview ? (
                  <div className="space-y-4">
                    <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-sm" />
                    <Button type="button" variant="outline" onClick={() => { setImage(null); setPreview(null); }}>
                      {t('إلغاء واختيار صورة أخرى', 'Annuler et changer')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">{t('استخدم الكاميرا لالتقاط صورة الفاتورة', 'Utilisez l\'appareil photo pour capturer le ticket')}</p>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      className="hidden"
                      id="fuel-image"
                    />
                    <label htmlFor="fuel-image" className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm">
                        <Upload className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                        {t('التقاط / اختيار صورة', 'Capturer / Choisir photo')}
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <Scan className="w-5 h-5 text-primary animate-pulse" />
                <p className="text-sm font-medium text-primary">
                  {t('جاري معالجة وضغط الصورة واستخراج النصوص...', 'Traitement, compression et extraction OCR en cours...')}
                </p>
              </div>
            )}

            {ocrText && (
              <Card className="bg-muted/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4 text-primary" />
                    {t('البيانات المستخرجة (OCR)', 'Données extraites (OCR)')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-background p-3 rounded-lg border border-border">{ocrText}</pre>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('المبلغ (MAD) *', 'Montant (MAD) *')}</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('التاريخ *', 'Date *')}</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('اسم المحطة أو المزود', 'Station ou Fournisseur')}</label>
              <Input
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder={t('محطة التزود (Afriquia, Total, Shell...)', 'Station (Afriquia, Total, Shell...)')}
              />
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading || !amount || !date}>
              {loading
                ? t('جاري الحفظ...', 'Enregistrement en cours...')
                : isOnline
                ? t('تسجيل ورفع الإيصال', 'Enregistrer et téléverser')
                : t('حفظ محلياً (Offline)', 'Enregistrer localement (Offline)')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
