'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Truck, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ROLE_DEFAULT_REDIRECT } from '@/lib/rbac';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { signIn } = useAuth();
  const { locale, dir, setLocale, t, getUserPreferredLanguage } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_login_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
      const userPref = getUserPreferredLanguage(savedEmail);
      if (userPref && userPref !== locale) {
        setLocale(userPref, savedEmail);
      }
    }
  }, [getUserPreferredLanguage, locale, setLocale]);

  const handleEmailBlur = () => {
    if (email.trim()) {
      const userPref = getUserPreferredLanguage(email.trim());
      if (userPref && userPref !== locale) {
        setLocale(userPref, email.trim());
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (rememberMe) {
      localStorage.setItem('saved_login_email', email);
    } else {
      localStorage.removeItem('saved_login_email');
    }

    // Save language preference for this email
    await setLocale(locale, email.trim());

    const { role, error } = await signIn(email, password);
    if (error) {
      toast({
        title: t('خطأ في تسجيل الدخول', 'Erreur de connexion'),
        description: error,
        variant: 'destructive',
      });
      setLoading(false);
    } else {
      const targetRoute = role ? ROLE_DEFAULT_REDIRECT[role] : '/dashboard';
      router.push(targetRoute);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        title: t('تنبيه', 'Attention'),
        description: t('يرجى إدخال البريد الإلكتروني', 'Veuillez saisir votre adresse e-mail'),
        variant: 'destructive',
      });
      return;
    }

    setResetLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        toast({
          title: t('خطأ في الإرسال', "Erreur d'envoi"),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('تم إرسال الرابط', 'Lien envoyé'),
          description: t(
            'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح',
            'Le lien de réinitialisation du mot de passe a été envoyé avec succès à votre adresse e-mail'
          ),
        });
        setShowForgotDialog(false);
      }
    } catch {
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue'),
        description: t('حدث خطأ أثناء محاولة إرسال رابط الاستعادة', "Une erreur est survenue lors de l'envoi du lien"),
        variant: 'destructive',
      });
    } finally {
      setResetLoading(false);
    }
  };

  const isRTL = locale === 'ar';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 dark:from-[#070a12] dark:via-blue-950/20 dark:to-[#090d16] relative transition-colors"
      dir={dir}
    >
      {/* Top Controls: Language Switcher & Theme Toggle */}
      <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} flex items-center gap-2 z-10`}>
        <LanguageToggle userKey={email.trim() || undefined} />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-border/80 dark:border-slate-800/80 bg-card/95 dark:bg-[#0c1322]/95 backdrop-blur-md rounded-2xl sm:rounded-3xl overflow-hidden">
        <CardHeader className="space-y-2 text-center pb-3 pt-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/10 mb-1">
            <Truck className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-bold font-amiri text-foreground tracking-wide">
            {t('النقل الدولي', 'Transport International')}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t('تسجيل الدخول إلى نظام إدارة الشحنات', 'Connexion au système de gestion du transport')}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className={`space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <label className="text-sm font-semibold text-foreground/90">
                {t('البريد الإلكتروني', 'Adresse e-mail')}
              </label>
              <div className="relative flex items-center">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="example@domain.com"
                  required
                  dir="ltr"
                  className={`${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} h-11 rounded-xl bg-muted/40 dark:bg-slate-900/60 border-input dark:border-slate-800 focus-visible:ring-sky-500/30 focus-visible:border-sky-500`}
                />
                <Mail
                  className={`w-5 h-5 text-muted-foreground absolute ${
                    isRTL ? 'right-3' : 'left-3'
                  } pointer-events-none`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className={`space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <label className="text-sm font-semibold text-foreground/90">
                {t('كلمة المرور', 'Mot de passe')}
              </label>
              <div className="relative flex items-center">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className={`${isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'} h-11 rounded-xl bg-muted/40 dark:bg-slate-900/60 border-input dark:border-slate-800 focus-visible:ring-sky-500/30 focus-visible:border-sky-500`}
                />
                <Lock
                  className={`w-5 h-5 text-muted-foreground absolute ${
                    isRTL ? 'right-3' : 'left-3'
                  } pointer-events-none`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${
                    isRTL ? 'left-3' : 'right-3'
                  } text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md focus:outline-none`}
                  aria-label={showPassword ? t('إخفاء كلمة المرور', 'Masquer le mot de passe') : t('إظهار كلمة المرور', 'Afficher le mot de passe')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Options Row: Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-input bg-card accent-sky-500 h-4 w-4 cursor-pointer"
                />
                <span>{t('تذكرني', 'Se souvenir de moi')}</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowForgotDialog(true);
                }}
                className="text-sky-500 hover:text-sky-400 dark:text-sky-400 dark:hover:text-sky-300 font-medium hover:underline transition-colors focus:outline-none"
              >
                {t('نسيت كلمة المرور؟', 'Mot de passe oublié ?')}
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20 rounded-xl transition-all active:scale-[0.99] mt-2"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('جاري التحقق...', 'Vérification en cours...')}</span>
                </div>
              ) : (
                t('تسجيل الدخول', 'Se connecter')
              )}
            </Button>

            {/* Register Link */}
            <div className="text-center text-xs sm:text-sm text-muted-foreground pt-3 border-t border-border/40">
              {t('ليس لديك حساب؟ ', "Vous n'avez pas de compte ? ")}
              <Link
                href="/signup"
                className="text-sky-500 hover:text-sky-400 dark:text-sky-400 dark:hover:text-sky-300 font-semibold hover:underline mx-1"
              >
                {t('إنشاء حساب جديد', 'Créer un nouveau compte')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <DialogTitle className="text-xl font-bold font-amiri">
              {t('استعادة كلمة المرور', 'Récupération du mot de passe')}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {t(
                'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور الخاصة بك.',
                'Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.'
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className={`space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <label className="text-sm font-semibold text-foreground/90">
                {t('البريد الإلكتروني', 'Adresse e-mail')}
              </label>
              <div className="relative flex items-center">
                <Input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="example@domain.com"
                  required
                  dir="ltr"
                  className={`${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} h-11 rounded-xl`}
                />
                <Mail
                  className={`w-5 h-5 text-muted-foreground absolute ${
                    isRTL ? 'right-3' : 'left-3'
                  } pointer-events-none`}
                />
              </div>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotDialog(false)}
                disabled={resetLoading}
                className="rounded-xl"
              >
                {t('إلغاء', 'Annuler')}
              </Button>
              <Button
                type="submit"
                disabled={resetLoading}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl"
              >
                {resetLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('جاري الإرسال...', 'Envoi en cours...')}</span>
                  </div>
                ) : (
                  t('إرسال رابط الاستعادة', 'Envoyer le lien')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
