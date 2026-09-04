'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
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
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { useLanguage } from '@/components/language-provider';
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
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('app');
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'ar';

  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_login_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (rememberMe) {
      localStorage.setItem('saved_login_email', email);
    } else {
      localStorage.removeItem('saved_login_email');
    }

    const { role, error } = await signIn(email, password);
    if (error) {
      toast({
        title: t('common.error'),
        description: error,
        variant: 'destructive',
      });
      setLoading(false);
    } else {
      const targetRoute = role ? ROLE_DEFAULT_REDIRECT[role] : '/dashboard';
      router.push(`/${locale}${targetRoute}`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        title: t('common.error'),
        description: t('auth.email'),
        variant: 'destructive',
      });
      return;
    }

    setResetLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/${locale}/login`,
      });

      if (error) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('common.success'),
          description: 'تم إرسال رابط استعادة كلمة المرور بنجاح',
        });
        setShowForgotDialog(false);
      }
    } catch {
      toast({
        title: t('common.error'),
        description: 'حدث خطأ أثناء محاولة استعادة كلمة المرور',
        variant: 'destructive',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 dark:from-[#070a12] dark:via-blue-950/20 dark:to-[#090d16] relative transition-colors" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`absolute top-4 ${locale === 'ar' ? 'left-4' : 'right-4'} flex items-center gap-2 z-10`}>
        <LanguageToggle userKey={email.trim() || undefined} />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-border/80 dark:border-slate-800/80 bg-card/95 dark:bg-[#0c1322]/95 backdrop-blur-md rounded-2xl sm:rounded-3xl overflow-hidden">
        <CardHeader className="space-y-2 text-center pb-3 pt-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/10 mb-1">
            <Truck className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-bold font-amiri text-foreground tracking-wide">
            {locale === 'ar' ? 'النقل الدولي' : t('title')}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {locale === 'ar' ? 'تسجيل الدخول إلى نظام إدارة الشحنات' : t('auth.login')}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5 text-right">
              <label className="text-sm font-semibold text-foreground/90">{t('auth.email')}</label>
              <div className="relative flex items-center">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@domain.com"
                  required
                  dir="ltr"
                  className="pr-10 pl-3 h-11 rounded-xl bg-muted/40 dark:bg-slate-900/60 border-input dark:border-slate-800 focus-visible:ring-sky-500/30 focus-visible:border-sky-500"
                />
                <Mail className="w-5 h-5 text-muted-foreground absolute right-3 pointer-events-none" />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-right">
              <label className="text-sm font-semibold text-foreground/90">{t('auth.password')}</label>
              <div className="relative flex items-center">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="pr-10 pl-10 h-11 rounded-xl bg-muted/40 dark:bg-slate-900/60 border-input dark:border-slate-800 focus-visible:ring-sky-500/30 focus-visible:border-sky-500"
                />
                <Lock className="w-5 h-5 text-muted-foreground absolute right-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                <span>{locale === 'ar' ? 'تذكرني' : 'Remember me'}</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowForgotDialog(true);
                }}
                className="text-sky-500 hover:text-sky-400 dark:text-sky-400 dark:hover:text-sky-300 font-medium hover:underline transition-colors focus:outline-none"
              >
                {t('auth.forgotPassword')}
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
                  <span>{t('common.loading')}</span>
                </div>
              ) : (
                t('auth.login')
              )}
            </Button>

            {/* Register Link */}
            <div className="text-center text-xs sm:text-sm text-muted-foreground pt-3 border-t border-border/40">
              {locale === 'ar' ? 'ليس لديك حساب؟ ' : "Don't have an account? "}
              <Link href={`/${locale}/signup`} className="text-sky-500 hover:text-sky-400 dark:text-sky-400 dark:hover:text-sky-300 font-semibold hover:underline mr-1">
                {locale === 'ar' ? 'إنشاء حساب جديد' : t('auth.signup')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="sm:max-w-md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-bold font-amiri">{t('auth.forgotPassword')}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {locale === 'ar'
                ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور الخاصة بك.'
                : 'Enter your email address and we will send you a password reset link.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="space-y-1.5 text-right">
              <label className="text-sm font-semibold text-foreground/90">{t('auth.email')}</label>
              <div className="relative flex items-center">
                <Input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="example@domain.com"
                  required
                  dir="ltr"
                  className="pr-10 pl-3 h-11 rounded-xl"
                />
                <Mail className="w-5 h-5 text-muted-foreground absolute right-3 pointer-events-none" />
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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={resetLoading}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl"
              >
                {resetLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('common.loading')}</span>
                  </div>
                ) : (
                  locale === 'ar' ? 'إرسال رابط الاستعادة' : 'Send Reset Link'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
