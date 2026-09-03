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

export default function FuelReceiptScanPage() {
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
      toast({ title: '🌐 عاد الاتصال بالإنترنت' });
      handleSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({ title: '⚠️ انقطع الاتصال - تم تفعيل الحفظ المحلي (Offline)', variant: 'destructive' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSyncQueue = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const { successCount } = await processOfflineQueue();
      if (successCount > 0) {
        toast({ title: `✅ تمت مزامنة ${successCount} إيصال محفوظ بنجاح` });
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
      setOcrText('محطة إفريقيا - طنجة المتوسط\nالكمية: 45.5 لتر\nالمبلغ: 650.00 درهم');
      setAmount('650');
      setDate(new Date().toISOString().split('T')[0]);
      setStation('محطة إفريقيا - طنجة المتوسط');
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

      if (!navigator.onLine) {
        let base64 = '';
        if (image) {
          base64 = await fileToBase64(image);
        }
        saveToOfflineQueue({
          truck_id: assignedTruckId,
          amount: parseFloat(amount),
          currency: 'MAD',
          date,
          notes: `المحطة: ${station}\n${ocrText}`,
          imageDataBase64: base64,
          fileName: `offline-fuel-${Date.now()}.jpg`,
        });

        toast({ title: '💾 تم حفظ الإيصال محلياً، ستتم المزامنة تلقائياً عند توفر الإنترنت' });
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
          type: 'fuel',
          amount: parseFloat(amount),
          currency: 'MAD',
          date,
          notes: `${station}\n\nبيانات الفاتورة:\n${ocrText}\n\nرابط الإيصال: ${imageUrl}`,
          payment_method: 'cash',
        });

        if (error) throw error;
        toast({ title: '✅ تم تسجيل وحفظ إيصال الوقود بنجاح' });
      }

      setAmount('');
      setDate('');
      setStation('');
      setImage(null);
      setPreview(null);
      setOcrText('');
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">مسح إيصالات الوقود</h1>
          <p className="text-sm text-muted-foreground mt-0.5">تسجيل فواتير الديزل الميدانية وضغطها تلقائياً</p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 border border-rose-500/30 animate-pulse">
              <WifiOff className="w-3.5 h-3.5" /> غير متصل
            </span>
          )}
          {pendingCount > 0 && (
            <Button size="sm" variant="outline" onClick={handleSyncQueue} disabled={isSyncing || !isOnline}>
              <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              مزامنة ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="font-amiri text-foreground">التقاط أو رفع الفاتورة</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">صورة الإيصال</label>
              <div className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 rounded-xl p-6 text-center transition-colors">
                {preview ? (
                  <div className="space-y-4">
                    <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-sm" />
                    <Button type="button" variant="outline" onClick={() => { setImage(null); setPreview(null); }}>
                      إلغاء واختيار صورة أخرى
                    </Button>
                  </div>
                ) : (
                  <>
                    <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">استخدم الكاميرا لالتقاط صورة الفاتورة</p>
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
                        <Upload className="w-4 h-4 ml-2" />
                        التقاط / اختيار صورة
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <Scan className="w-5 h-5 text-primary animate-pulse" />
                <p className="text-sm font-medium text-primary">جاري معالجة وضغط الصورة واستخراج النصوص...</p>
              </div>
            )}

            {ocrText && (
              <Card className="bg-muted/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4 text-primary" />
                    البيانات المستخرجة (OCR)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-background p-3 rounded-lg border border-border">{ocrText}</pre>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">المبلغ (MAD) *</label>
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
                <label className="text-sm font-medium text-foreground">التاريخ *</label>
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
              <label className="text-sm font-medium text-foreground">اسم المحطة أو المزود</label>
              <Input
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="محطة التزود (Afriquia, Total, Shell...)"
              />
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading || !amount || !date}>
              {loading ? 'جاري الحفظ...' : isOnline ? 'تسجيل ورفع الإيصال' : 'حفظ محلياً (Offline)'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
