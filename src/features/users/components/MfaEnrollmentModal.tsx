'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Loader2, Copy, Check } from 'lucide-react';
import { enrollMfaFactor, verifyMfaChallenge } from '@/lib/auth-mfa';

interface MfaEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MfaEnrollmentModal({ isOpen, onClose, onSuccess }: MfaEnrollmentModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'initial' | 'qr' | 'verify'>('initial');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleStartEnrollment = async () => {
    setLoading(true);
    const res = await enrollMfaFactor();
    setLoading(false);

    if (res.success && res.data) {
      setFactorId(res.data.id);
      setQrSvg(res.data.qrCodeSvg);
      setSecret(res.data.secret);
      setStep('qr');
    } else {
      toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.trim().length !== 6) {
      toast({ title: 'خطأ', description: 'الرمز يجب أن يتكون من 6 أرقام', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const res = await verifyMfaChallenge(factorId, verifyCode.trim());
    setLoading(false);

    if (res.success) {
      toast({ title: 'تم التفعيل بنجاح', description: 'تم تفعيل المصادقة الثنائية لحسابك بنجاح' });
      onSuccess();
      onClose();
    } else {
      toast({ title: 'رمز غير صحيح', description: res.error, variant: 'destructive' });
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-amiri text-lg">
            <ShieldCheck className="w-5 h-5 text-primary" />
            تفعيل التحقق الثنائي (2FA / TOTP)
          </DialogTitle>
          <DialogDescription>
            حماية حسابك عبر تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator).
          </DialogDescription>
        </DialogHeader>

        {step === 'initial' && (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              يُطلب من المشرفين والسكرتارية تفعيل هذه الطبقة الإضافية لحماية الحسابات البنكية والبيانات المالية.
            </p>
            <Button onClick={handleStartEnrollment} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              البدء الآن
            </Button>
          </div>
        )}

        {step === 'qr' && (
          <form onSubmit={handleConfirmCode} className="space-y-4 pt-2">
            <div className="flex justify-center bg-white p-3 rounded-xl border max-w-xs mx-auto">
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-48 h-48" />
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">أو أدخل المفتاح يدوياً في التطبيق:</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded" dir="ltr">{secret}</code>
                <Button type="button" variant="ghost" size="sm" onClick={copySecret} className="h-7 w-7 p-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold">أدخل الرمز المكون من 6 أرقام الظاهر في هاتفك:</label>
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="text-center font-mono tracking-widest text-lg"
                dir="ltr"
                required
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>إلغاء</Button>
              <Button type="submit" disabled={loading || verifyCode.length < 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : 'تأكيد وتفعيل'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
