'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';
import { Truck, User, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

export default function SignUpPage() {
  const { t, dir } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password, name);
    if (error) {
      toast({
        title: t('خطأ في إنشاء الحساب', 'Erreur de création de compte'),
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('تم إنشاء الحساب بنجاح', 'Compte créé avec succès'),
        description: t('يمكنك الآن تسجيل الدخول', 'Vous pouvez maintenant vous connecter'),
      });
      router.push('/login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 dark:from-[#070a12] dark:via-blue-950/20 dark:to-[#090d16] relative transition-colors" dir={dir}>
      <div className={`absolute top-4 ${dir === 'rtl' ? 'left-4' : 'right-4'}`}>
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-border/80 dark:border-slate-800/80 bg-card/95 dark:bg-[#0c1322]/95 backdrop-blur-md rounded-2xl sm:rounded-3xl overflow-hidden">
        <CardHeader className="space-y-2 text-center pb-3 pt-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/10 mb-1">
            <Truck className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-bold font-amiri text-foreground tracking-wide">{t('إنشاء حساب جديد', 'Créer un compte')}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">{t('أدخل بياناتك للانضمام إلى النظام', 'Entrez vos informations pour accéder à la plateforme')}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-foreground/90">{t('الاسم الكامل', 'Nom complet')}</label>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mohamed Ahmed"
                  required
                  className={`${dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'} h-11 rounded-xl bg-muted/40 dark:bg-slate-900/60 border-input dark:border-slate-800 focus-visible:ring-sky-500/30 focus-visible:border-sky-500`}
                />
                <User className={`w-5 h-5 text-muted-foreground absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} pointer-events-none`} />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-foreground/90">{t('البريد الإلكتروني', 'Adresse e-mail')}</label>
              <div className="relative flex items-center">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@domain.com"
                  required
                  dir="ltr"
                  className={`${dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'} h-11 rounded-xl bg-muted/40 dark:bg-slate-900/60 border-input dark:border-slate-800 focus-visible:ring-sky-500/30 focus-visible:border-sky-500`}
                />
                <Mail className={`w-5 h-5 text-muted-foreground absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} pointer-events-none`} />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-foreground/90">{t('كلمة المرور', 'Mot de passe')}</label>
              <div className="relative flex items-center">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className={`${dir === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'} h-11 rounded-xl bg-muted/40 dark:bg-slate-900/60 border-input dark:border-slate-800 focus-visible:ring-sky-500/30 focus-visible:border-sky-500`}
                />
                <Lock className={`w-5 h-5 text-muted-foreground absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} pointer-events-none`} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md focus:outline-none`}
                  aria-label={showPassword ? t('إخفاء كلمة المرور', 'Masquer mot de passe') : t('إظهار كلمة المرور', 'Afficher mot de passe')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
                  <span>{t('جاري الإنشاء...', 'Création en cours...')}</span>
                </div>
              ) : (
                t('إنشاء الحساب', 'Créer le compte')
              )}
            </Button>

            {/* Login Link */}
            <div className="text-center text-xs sm:text-sm text-muted-foreground pt-3 border-t border-border/40">
              {t('لديك حساب بالفعل؟ ', 'Vous avez déjà un compte ? ')}
              <Link href="/login" className="text-sky-500 hover:text-sky-400 dark:text-sky-400 dark:hover:text-sky-300 font-semibold hover:underline">
                {t('تسجيل الدخول', 'Se connecter')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
