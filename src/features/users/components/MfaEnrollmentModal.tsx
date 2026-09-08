'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Loader2, Copy, Check } from 'lucide-react';
import { enrollMfaFactor, verifyMfaChallenge } from '@/lib/auth-mfa';

import { useLanguage } from '@/components/language-provider';

interface MfaEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MfaEnrollmentModal({ isOpen, onClose, onSuccess }: MfaEnrollmentModalProps) {
  const { t, dir } = useLanguage();
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
      toast({ title: t('خطأ', 'Erreur'), description: res.error, variant: 'destructive' });
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.trim().length !== 6) {
      toast({ title: 'خطأ', description: 'الرمز يجب أن يتكون من 6 أرقام', variant: 'destructive' });
      toast({ title: t('خطأ', 'Erreur'), description: t('الرمز يجب أن يتكون من 6 أرقام', 'Le code doit contenir 6 chiffres'), variant: 'destructive' });
      return;
    }

    setLoading(true);
    const res = await verifyMfaChallenge(factorId, verifyCode.trim());
    setLoading(false);

    if (res.success) {
      toast({ title: t('تم التفعيل بنجاح', 'Activé avec succès'), description: t('تم تفعيل المصادقة الثنائية لحسابك بنجاح', 'L\'authentification à deux facteurs a été activée avec succès pour votre compte') });
      onSuccess();
      onClose();
    } else {
      toast({ title: t('رمز غير صحيح', 'Code invalide'), description: res.error, variant: 'destructive' });
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-amiri text-lg">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {t('تفعيل التحقق الثنائي (2FA / TOTP)', 'Activer l\'authentification à deux facteurs (2FA / TOTP)')}
          </DialogTitle>
          <DialogDescription>
            {t('حماية حسابك عبر تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator).', 'Protégez votre compte via une application d\'authentification (Google Authenticator ou Microsoft Authenticator).')}
          </DialogDescription>
        </DialogHeader>

        {step === 'initial' && (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('يُطلب من المشرفين والسكرتارية تفعيل هذه الطبقة الإضافية لحماية الحسابات البنكية والبيانات المالية.', 'Les administrateurs et gestionnaires doivent activer cette couche de sécurité pour protéger les comptes bancaires et données financières.')}
            </p>
            <Button onClick={handleStartEnrollment} disabled={loading} className="w-full">
              {loading ? <Loader2 className={`w-4 h-4 animate-spin ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} /> : null}
              {t('البدء الآن', 'Commencer')}
            </Button>
          </div>
        )}

        {step === 'qr' && (
          <form onSubmit={handleConfirmCode} className="space-y-4 pt-2">
            <div className="flex justify-center bg-white p-3 rounded-xl border max-w-xs mx-auto">
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-48 h-48" />
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('أو أدخل المفتاح يدوياً في التطبيق:', 'Ou saisissez la clé manuellement dans l\'application :')}</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded" dir="ltr">{secret}</code>
                <Button type="button" variant="ghost" size="sm" onClick={copySecret} className="h-7 w-7 p-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold">{t('أدخل الرمز المكون من 6 أرقام الظاهر في هاتفك:', 'Saisissez le code à 6 chiffres affiché sur votre téléphone :')}</label>
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
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{t('إلغاء', 'Annuler')}</Button>
              <Button type="submit" disabled={loading || verifyCode.length < 6}>
                {loading ? <Loader2 className={`w-4 h-4 animate-spin ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} /> : t('تأكيد وتفعيل', 'Confirmer et activer')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
