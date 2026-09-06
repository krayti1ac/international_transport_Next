'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, FileText, Scan, WifiOff, RefreshCw, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { compressImage } from '@/lib/image-compressor';
import { saveToOfflineQueue, getOfflineQueue, processOfflineQueue } from '@/lib/offline-sync';
import { processFuelReceiptOCR } from '@/features/fleet/services/ocr.actions';
import { OfflineSyncBadge } from '@/components/offline-sync-badge';

export default function FuelReceiptScanPage() {
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setPendingCount(getOfflineQueue().length);
    setDate(new Date().toISOString().split('T')[0]);
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
            title: '✨ تم استخراج البيانات بالذكاء الاصطناعي',
            description: `نسبة الثقة: ${data.confidence}% - يرجى مراجعة الحقول وتأكيدها.`,
          });
        } else {
          toast({
            title: 'تنبيه',
            description: ocrRes.error || 'تعذر القراءة التلقائية، يرجى ملء الحقول يدوياً.',
          });
        }
      } else {
        toast({
          title: 'الوضع غير متصل',
          description: 'تم ضغط الصورة وحفظها، سيتم إرسالها دون معالجة OCR سحابية.',
        });
      }
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء معالجة الصورة',
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
      toast({ title: 'خطأ', description: 'يرجى إدخال المبلغ والتاريخ', variant: 'destructive' });
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
        station ? `المحطة: ${station}` : null,
        liters ? `الكمية: ${liters} لتر` : null,
        confidence ? `دقة المسح: ${confidence}%` : null,
        ocrText ? `النص الأصلي:\n${ocrText}` : null,
      ].filter(Boolean).join('\n');

      if (!navigator.onLine) {
        let base64 = '';
        if (image) {
          base64 = await fileToBase64(image);
        }
        saveToOfflineQueue({
          truck_id: assignedTruckId,
          amount: parseFloat(amount),
          currency,
          date,
          notes: notesDetails,
          imageDataBase64: base64,
          fileName: `offline-fuel-${Date.now()}.jpg`,
        });

        toast({ title: '💾 تم حفظ الإيصال محلياً، وستتم مزامنته آلياً فور توفر الشبكة' });
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

        const finalNotes = imageUrl ? `${notesDetails}\n\nرابط الإيصال: ${imageUrl}` : notesDetails;

        const { error } = await supabase.from('truck_maintenance').insert({
          truck_id: assignedTruckId,
          type: 'fuel',
          expense_type: 'fuel',
          amount: parseFloat(amount),
          currency,
          maintenance_date: date,
          notes: finalNotes,
          payment_method: 'cash',
        });

        if (error) throw error;
        toast({ title: '✅ تم تسجيل وحفظ إيصال الوقود في النظام بنجاح' });
      }

      setAmount('');
      setStation('');
      setLiters('');
      setImage(null);
      setPreview(null);
      setOcrText('');
      setConfidence(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل حفظ الإيصال';
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Scan className="w-6 h-6 text-primary" />
            مسح إيصالات الوقود (OCR)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            التقط الفاتورة لاستخراج المبلغ واسم المحطة واللترات آلياً
          </p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>التقاط صورة الإيصال</span>
            {confidence !== null && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                دقة القراءة: {confidence}%
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
                            جاري فحص واستخراج البيانات...
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
                        إلغاء واختيار صورة أخرى
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4">
                    <Camera className="w-12 h-12 mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-semibold text-foreground mb-1">التقط صورة واضحة للفاتورة</p>
                    <p className="text-xs text-muted-foreground mb-4">احرص على إظهار المجموع واللترات وتاريخ التزود بوضوح</p>
                    
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
                      className="rounded-xl shadow-xs"
                    >
                      <Camera className="w-4 h-4 ml-2" />
                      فتح الكاميرا / اختيار صورة
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">المبلغ الإجمالي *</label>
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
                <label className="text-xs font-semibold text-foreground">التاريخ *</label>
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
                <label className="text-xs font-semibold text-foreground">اسم المحطة أو المزود</label>
                <Input
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  placeholder="مثال: Afriquia Port Tanger Med"
                  className="rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">الكمية المسجلة (لتر)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  placeholder="مثال: 350"
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
                  <span>جاري الحفظ والمزامنة...</span>
                </div>
              ) : isOnline ? (
                'تسجيل وحفظ الإيصال'
              ) : (
                'حفظ محلياً في الهاتف (Offline)'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <OfflineSyncBadge />
    </div>
  );
}
